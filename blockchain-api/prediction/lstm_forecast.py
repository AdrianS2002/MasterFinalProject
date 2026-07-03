"""
lstm_forecast.py
─────────────────
Two LSTM models for energy market forecasting:

  DAForecastModel  – Day-Ahead (DA): 24-hour consumption + renewable forecast.
  IDForecastModel  – Intra-Day (ID): next-hour (4 × 15-min) forecast.

Architecture overview
─────────────────────
Both models share the same input feature set (8 features):
  0  temperature_norm       – normalised air temperature
  1  windspeed_norm         – normalised wind speed
  2  radiation_norm         – normalised solar irradiance
  3  humidity_norm          – normalised relative humidity
  4  consumption_lag_norm   – normalised historical consumption (lagged)
  5  renewable_lag_norm     – normalised historical renewable generation (lagged)
  6  hour_sin               – sin(2π × hour / 24)  ← encodes time-of-day cyclically
  7  hour_cos               – cos(2π × hour / 24)

Day-Ahead LSTM
  Input  : (168, 8)  — last 7 days × 24 hours of weather + consumption history
  LSTM layers: 128 → 64
  Output : (48,)     — 24 values for consumption + 24 for renewable generation

Intra-Day LSTM
  Input  : (16, 8)   — last 4 hours × 4 slots (15-min resolution)
  LSTM layer : 64
  Output : (8,)      — 4 values for consumption + 4 for renewable (next 1 hour)

Weather-adjusted consumption model
────────────────────────────────────
On top of the LSTM output we apply two corrections:

  1. Weather factor (heating / cooling degree days):
       weather_factor = 1 + α × (T_ref - T_actual) / T_ref
       α = 0.02 (2% change in consumption per °C deviation from reference 18 °C)

  2. Price elasticity (demand response):
       consumption_adjusted = consumption_lstm × (1 + β × (P_ref - P_current) / P_ref)
       β = 0.05 (5% demand response to price signals)

Usage
─────
    from lstm_forecast import DAForecastModel, IDForecastModel

    da_model = DAForecastModel()
    da_model.build()
    # da_model.train(X_train, y_train)   ← optional; loads pre-trained weights if available
    consumption_24h, renewable_24h = da_model.predict(feature_window_168h)

    id_model = IDForecastModel()
    id_model.build()
    consumption_4slot, renewable_4slot = id_model.predict(feature_window_16slot)
"""

import os
import math
import numpy as np

# Lazy TensorFlow import so the module can be imported even without TF installed
# (e.g., in unit tests or when running only the Node.js backend).
try:
    import tensorflow as tf
    from tensorflow.keras import layers, Model, Input
    from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False

from sklearn.preprocessing import MinMaxScaler

# ── Constants ─────────────────────────────────────────────────────────────────
FEATURES       = 8
DA_SEQ_LEN     = 168   # 7 days × 24 hours
DA_OUTPUT_LEN  = 48    # 24 consumption + 24 renewable
ID_SEQ_LEN     = 16    # 4 hours × 4 slots (15-min)
ID_OUTPUT_LEN  = 8     # 4 consumption + 4 renewable

WEIGHTS_DIR    = os.path.join(os.path.dirname(__file__), "weights")

# Weather adjustment hyperparameters
ALPHA_WEATHER  = 0.02   # 2% consumption shift per °C from reference
T_REFERENCE    = 18.0   # Comfortable indoor temperature reference (°C)
BETA_PRICE     = 0.05   # 5% demand response per unit price deviation


# ── Feature engineering helpers ───────────────────────────────────────────────

def encode_time_features(hour: int) -> tuple:
    """
    Cyclically encodes hour-of-day using sin/cos so the model understands
    that hour 23 is close to hour 0 (circular time).
    """
    angle = 2 * math.pi * hour / 24
    return math.sin(angle), math.cos(angle)


def compute_weather_factor(temperature: float) -> float:
    """
    Returns a multiplicative consumption adjustment based on the deviation
    from the reference indoor comfort temperature.

    When it is colder than T_REFERENCE, heating increases consumption.
    When it is warmer, cooling (air-con) increases consumption.
    The sign convention: any deviation from T_REFERENCE raises consumption.
    """
    deviation  = abs(T_REFERENCE - temperature)
    return 1.0 + ALPHA_WEATHER * deviation / T_REFERENCE


def apply_price_elasticity(consumption: float, price_ref: float, price_current: float) -> float:
    """
    Adjusts forecast consumption using a simple linear price-elasticity model.
    High prices → reduce consumption; low prices → increase consumption.

    Args:
        consumption:   LSTM-forecasted consumption value.
        price_ref:     Reference (DA) price.
        price_current: Current (real-time) price.

    Returns: elasticity-adjusted consumption.
    """
    if price_ref == 0:
        return consumption
    return consumption * (1.0 + BETA_PRICE * (price_ref - price_current) / price_ref)


def build_feature_matrix(
    temperatures: list,
    windspeeds:   list,
    radiations:   list,
    humidities:   list,
    consumption_history: list,
    renewable_history:   list,
    scaler: MinMaxScaler | None = None,
) -> tuple:
    """
    Assembles and normalises the 8-feature input matrix.

    Args:
        temperatures, windspeeds, radiations, humidities:
            Weather arrays, one value per time slot.
        consumption_history, renewable_history:
            Historical values for the same time slots.
        scaler: Pre-fitted MinMaxScaler. If None, a new one is fitted.

    Returns:
        (feature_matrix: np.ndarray shape (N,8), scaler: MinMaxScaler)
    """
    N = len(temperatures)
    raw = np.zeros((N, FEATURES))

    for i in range(N):
        hour             = i % 24
        sin_h, cos_h     = encode_time_features(hour)
        raw[i, 0] = temperatures[i]
        raw[i, 1] = windspeeds[i]
        raw[i, 2] = radiations[i]
        raw[i, 3] = humidities[i]
        raw[i, 4] = consumption_history[i] if i < len(consumption_history) else 0
        raw[i, 5] = renewable_history[i]   if i < len(renewable_history)   else 0
        raw[i, 6] = sin_h
        raw[i, 7] = cos_h

    if scaler is None:
        scaler = MinMaxScaler()
        normalised = scaler.fit_transform(raw)
    else:
        normalised = scaler.transform(raw)

    return normalised, scaler


# ── Day-Ahead LSTM model ──────────────────────────────────────────────────────

class DAForecastModel:
    """
    LSTM model for 24-hour Day-Ahead energy forecasting.

    Predicts:
      - 24-hour consumption profile (×100 kWh fixed-point)
      - 24-hour renewable generation profile (×100 kWh fixed-point)
    """

    def __init__(self):
        self.model   = None
        self.scaler  = MinMaxScaler()
        self.weights = os.path.join(WEIGHTS_DIR, "da_lstm_weights.h5")

    def build(self) -> None:
        """Constructs the LSTM architecture using the Keras Functional API."""
        if not TF_AVAILABLE:
            raise ImportError("TensorFlow is required to build the LSTM model.")

        inp = Input(shape=(DA_SEQ_LEN, FEATURES), name="da_input")

        # First LSTM layer — returns full sequences for the second layer
        x = layers.LSTM(128, return_sequences=True, dropout=0.2,
                        recurrent_dropout=0.1, name="lstm_1")(inp)

        # Second LSTM layer — returns only the final hidden state
        x = layers.LSTM(64, return_sequences=False, dropout=0.2,
                        name="lstm_2")(x)

        # Dense head — 48 outputs (24 consumption + 24 renewable)
        x  = layers.Dense(64, activation="relu",    name="dense_1")(x)
        out = layers.Dense(DA_OUTPUT_LEN,            name="da_output")(x)

        self.model = Model(inputs=inp, outputs=out, name="DayAheadLSTM")
        self.model.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
            loss="mse",
            metrics=["mae"]
        )

        # Load pre-trained weights if available
        if os.path.exists(self.weights):
            self.model.load_weights(self.weights)
            print(f"[DA-LSTM] Loaded weights from {self.weights}")
        else:
            print("[DA-LSTM] No pre-trained weights found. Model requires training.")

    def train(self, X: np.ndarray, y: np.ndarray, epochs: int = 50, batch_size: int = 32) -> None:
        """
        Trains the DA model.

        Args:
            X: Training inputs  shape (samples, DA_SEQ_LEN, FEATURES)
            y: Training targets shape (samples, DA_OUTPUT_LEN)
        """
        os.makedirs(WEIGHTS_DIR, exist_ok=True)
        callbacks = [
            EarlyStopping(patience=10, restore_best_weights=True),
            ModelCheckpoint(self.weights, save_best_only=True, save_weights_only=True),
        ]
        self.model.fit(X, y, epochs=epochs, batch_size=batch_size,
                       validation_split=0.15, callbacks=callbacks, verbose=1)

    def predict(
        self,
        feature_window: np.ndarray,
        temperatures_next24: list | None = None,
        prices_da:  list | None = None,
        prices_rt:  list | None = None,
    ) -> tuple:
        """
        Runs inference on a 7-day feature window to forecast the next 24 hours.

        Args:
            feature_window: np.ndarray shape (DA_SEQ_LEN, FEATURES).
            temperatures_next24: Optional list of temperature forecasts for the
                                 next 24 hours (for weather factor correction).
            prices_da, prices_rt: Optional DA and real-time prices for price
                                  elasticity correction.

        Returns:
            (consumption_24h: list[float], renewable_24h: list[float])
            Both in physical units (kWh), NOT ×100 fixed-point.
        """
        if self.model is None:
            raise RuntimeError("Call build() before predict()")

        x = feature_window[np.newaxis, :, :]   # add batch dimension → (1, 168, 8)
        raw = self.model.predict(x, verbose=0)[0]  # shape (48,)

        consumption_raw = raw[:24].tolist()
        renewable_raw   = raw[24:].tolist()

        # Apply weather factor correction if temperatures provided
        if temperatures_next24 and len(temperatures_next24) == 24:
            for i in range(24):
                wf = compute_weather_factor(temperatures_next24[i])
                consumption_raw[i] *= wf

        # Apply price elasticity correction if prices provided
        if prices_da and prices_rt and len(prices_da) == 24 and len(prices_rt) == 24:
            for i in range(24):
                consumption_raw[i] = apply_price_elasticity(
                    consumption_raw[i], prices_da[i], prices_rt[i]
                )

        # Clamp to non-negative values (physical constraint)
        consumption_24h = [max(0.0, v) for v in consumption_raw]
        renewable_24h   = [max(0.0, v) for v in renewable_raw]

        return consumption_24h, renewable_24h


# ── Intra-Day LSTM model ──────────────────────────────────────────────────────

class IDForecastModel:
    """
    LSTM model for real-time Intra-Day forecasting (15-minute resolution).

    Predicts the next 4 fifteen-minute slots (= 1 hour ahead):
      - 4-slot consumption profile
      - 4-slot renewable generation profile
    """

    def __init__(self):
        self.model   = None
        self.scaler  = MinMaxScaler()
        self.weights = os.path.join(WEIGHTS_DIR, "id_lstm_weights.h5")

    def build(self) -> None:
        if not TF_AVAILABLE:
            raise ImportError("TensorFlow is required to build the LSTM model.")

        inp = Input(shape=(ID_SEQ_LEN, FEATURES), name="id_input")

        # Lighter single LSTM layer (speed matters for 15-min latency)
        x  = layers.LSTM(64, return_sequences=False, dropout=0.1, name="id_lstm")(inp)
        x  = layers.Dense(32, activation="relu", name="id_dense")(x)
        out = layers.Dense(ID_OUTPUT_LEN,         name="id_output")(x)

        self.model = Model(inputs=inp, outputs=out, name="IntradayLSTM")
        self.model.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=2e-3),
            loss="mse",
            metrics=["mae"]
        )

        if os.path.exists(self.weights):
            self.model.load_weights(self.weights)
            print(f"[ID-LSTM] Loaded weights from {self.weights}")

    def train(self, X: np.ndarray, y: np.ndarray, epochs: int = 30, batch_size: int = 64) -> None:
        os.makedirs(WEIGHTS_DIR, exist_ok=True)
        callbacks = [
            EarlyStopping(patience=8, restore_best_weights=True),
            ModelCheckpoint(self.weights, save_best_only=True, save_weights_only=True),
        ]
        self.model.fit(X, y, epochs=epochs, batch_size=batch_size,
                       validation_split=0.1, callbacks=callbacks, verbose=1)

    def predict(
        self,
        feature_window: np.ndarray,
        current_temperature: float | None = None,
        price_da_current: float | None = None,
        price_rt_current: float | None = None,
    ) -> tuple:
        """
        Runs inference on a 4-hour (16-slot) feature window.

        Returns:
            (consumption_4slots: list[float], renewable_4slots: list[float])
        """
        if self.model is None:
            raise RuntimeError("Call build() before predict()")

        x   = feature_window[np.newaxis, :, :]
        raw = self.model.predict(x, verbose=0)[0]

        consumption_raw = raw[:4].tolist()
        renewable_raw   = raw[4:].tolist()

        if current_temperature is not None:
            wf = compute_weather_factor(current_temperature)
            consumption_raw = [v * wf for v in consumption_raw]

        if price_da_current is not None and price_rt_current is not None:
            consumption_raw = [
                apply_price_elasticity(v, price_da_current, price_rt_current)
                for v in consumption_raw
            ]

        return [max(0.0, v) for v in consumption_raw], [max(0.0, v) for v in renewable_raw]


# ── Synthetic data generator (training / demo without real data) ──────────────

def generate_synthetic_training_data(n_days: int = 60) -> dict:
    """
    Generates synthetic training data based on a realistic residential
    load profile shaped by:
      - Time-of-day (morning and evening peaks)
      - Weekend vs weekday (20% lower on weekends)
      - Temperature (heating / cooling)
      - Simulated solar generation (daytime only)

    This data can be used to pre-train the models before real smart-meter
    data is available.

    Returns:
        {
            "da_X": np.ndarray (n_samples, DA_SEQ_LEN, FEATURES),
            "da_y": np.ndarray (n_samples, DA_OUTPUT_LEN),
            "id_X": np.ndarray (n_samples, ID_SEQ_LEN, FEATURES),
            "id_y": np.ndarray (n_samples, ID_OUTPUT_LEN),
        }
    """
    rng  = np.random.default_rng(42)
    n_h  = n_days * 24

    # Synthetic temperature: seasonal sinusoid + daily variation + noise
    t_base = np.array([
        15 + 10 * math.sin(2 * math.pi * h / (365 * 24)) +   # seasonal
         5 * math.sin(2 * math.pi * (h % 24) / 24 - math.pi)  # daily dip at night
        for h in range(n_h)
    ]) + rng.normal(0, 1.5, n_h)

    # Synthetic solar irradiance (Gaussian centred at noon, 0 at night)
    radiation = np.array([
        max(0, 800 * math.exp(-0.5 * ((h % 24 - 12) / 3) ** 2))
        for h in range(n_h)
    ]) * (1 + rng.normal(0, 0.1, n_h))

    # Synthetic wind speed (log-normal)
    windspeed = np.abs(rng.normal(10, 5, n_h))
    humidity  = 60 + rng.normal(0, 10, n_h)

    # Consumption profile: morning peak (7-9h), evening peak (18-22h)
    load_profile = np.array([
        80 + 40 * math.exp(-0.5 * ((h % 24 - 8) / 1.5) ** 2) +   # morning
        60 * math.exp(-0.5 * ((h % 24 - 20) / 2.0) ** 2)          # evening
        for h in range(n_h)
    ])
    # Weekend reduction
    for day in range(n_days):
        if (day % 7) >= 5:  # Saturday/Sunday
            load_profile[day*24:(day+1)*24] *= 0.8
    # Weather correction
    consumption = load_profile * np.array([compute_weather_factor(t) for t in t_base])
    consumption += rng.normal(0, 3, n_h)
    consumption  = np.clip(consumption, 10, 200)

    # Renewable generation (solar + wind)
    renewable = (
        (radiation / 1000) * 30 * 0.18 +          # solar PV: 30 m², 18% efficiency
        np.minimum(2.0, (windspeed/3.6)**3 / 1e4)  # wind turbine
    )
    renewable = np.clip(renewable, 0, 10) + rng.normal(0, 0.2, n_h)
    renewable  = np.clip(renewable, 0, None)

    # Build feature matrix (n_h, FEATURES)
    features = np.zeros((n_h, FEATURES))
    features[:, 0] = t_base
    features[:, 1] = windspeed
    features[:, 2] = radiation
    features[:, 3] = humidity
    features[:, 4] = consumption
    features[:, 5] = renewable
    for i in range(n_h):
        features[i, 6], features[i, 7] = encode_time_features(i % 24)

    # Normalise
    scaler   = MinMaxScaler()
    features = scaler.fit_transform(features)

    # Build DA samples: input = 7-day window, target = next 24h
    da_X, da_y = [], []
    for i in range(DA_SEQ_LEN, n_h - 24):
        da_X.append(features[i - DA_SEQ_LEN : i])
        da_y.append(np.concatenate([consumption[i:i+24], renewable[i:i+24]]))

    # Build ID samples: input = 4-hour (16 slots) window, target = next 1h (4 slots)
    # (In a real system these would be 15-min data; here we treat 4 hours as 16 hourly slots)
    id_X, id_y = [], []
    for i in range(ID_SEQ_LEN, n_h - 4):
        id_X.append(features[i - ID_SEQ_LEN : i])
        id_y.append(np.concatenate([consumption[i:i+4], renewable[i:i+4]]))

    return {
        "da_X": np.array(da_X),
        "da_y": np.array(da_y),
        "id_X": np.array(id_X),
        "id_y": np.array(id_y),
    }
