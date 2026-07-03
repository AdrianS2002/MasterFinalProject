"""
weather_service.py
──────────────────
Fetches weather forecasts from the Open-Meteo API (free, no API key required).

Open-Meteo provides:
  • temperature_2m        – 2-metre air temperature (°C)
  • wind_speed_10m        – 10-metre wind speed (km/h)
  • shortwave_radiation   – global horizontal irradiance (W/m²)
  • relative_humidity_2m  – relative humidity (%)
  • direct_radiation      – direct normal irradiance (W/m²)
  • precipitation         – precipitation (mm)  ← affects solar output

Location default: Cluj-Napoca, Romania (matching the deploy.js address data).
Override via WEATHER_LAT / WEATHER_LON environment variables for other sites.
"""

import os
import requests
from datetime import datetime, timedelta
import pytz

# ── Configuration ─────────────────────────────────────────────────────────────
LATITUDE  = float(os.getenv("WEATHER_LAT",  "46.7712"))   # Cluj-Napoca
LONGITUDE = float(os.getenv("WEATHER_LON",  "23.5824"))
TIMEZONE  = os.getenv("WEATHER_TZ",         "Europe/Bucharest")

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


# ── Open-Meteo helpers ────────────────────────────────────────────────────────

def _fetch_open_meteo_hourly(days: int = 2) -> dict:
    """
    Fetches hourly weather data for the next `days` days from Open-Meteo.

    Returns a dict keyed by ISO timestamp:
    {
        "2025-07-01T00:00": {
            "temperature": 18.5,     # °C
            "windspeed":   12.3,     # km/h
            "radiation":   0.0,      # W/m²
            "humidity":    65.0,     # %
            "direct_rad":  0.0       # W/m²
        },
        ...
    }
    """
    params = {
        "latitude":  LATITUDE,
        "longitude": LONGITUDE,
        "hourly": ",".join([
            "temperature_2m",
            "wind_speed_10m",
            "shortwave_radiation",
            "relative_humidity_2m",
            "direct_radiation",
            "precipitation"
        ]),
        "forecast_days": days,
        "timezone":      TIMEZONE,
    }
    resp = requests.get(OPEN_METEO_URL, params=params, timeout=10)
    resp.raise_for_status()
    data = resp.json()["hourly"]
    n    = len(data["time"])

    result = {}
    for i, ts in enumerate(data["time"]):
        result[ts] = {
            "temperature":   data["temperature_2m"][i],
            "windspeed":     data["wind_speed_10m"][i],
            "radiation":     (data.get("shortwave_radiation") or [0] * n)[i] or 0,
            "humidity":      data["relative_humidity_2m"][i],
            "direct_rad":    (data.get("direct_radiation")   or [0] * n)[i] or 0,
            "precipitation": (data.get("precipitation")       or [0] * n)[i] or 0,
        }
    return result


def _fetch_open_meteo_15min(days: int = 1) -> dict:
    """
    Fetches 15-minute weather data from Open-Meteo for intraday forecasting.
    Returns a dict keyed by ISO timestamp with the same schema as hourly.
    """
    params = {
        "latitude":    LATITUDE,
        "longitude":   LONGITUDE,
        "minutely_15": ",".join([
            "temperature_2m",
            "wind_speed_10m",
            "shortwave_radiation",
            "direct_radiation",
        ]),
        "forecast_days": days,
        "timezone":      TIMEZONE,
    }
    resp = requests.get(OPEN_METEO_URL, params=params, timeout=10)
    resp.raise_for_status()
    data = resp.json().get("minutely_15", {})
    times = data.get("time", [])
    n     = len(times)

    result = {}
    for i, ts in enumerate(times):
        result[ts] = {
            "temperature":   (data.get("temperature_2m")      or [0] * n)[i] or 0,
            "windspeed":     (data.get("wind_speed_10m")       or [0] * n)[i] or 0,
            "radiation":     (data.get("shortwave_radiation")  or [0] * n)[i] or 0,
            "direct_rad":    (data.get("direct_radiation")     or [0] * n)[i] or 0,
            "humidity":      0,   # not available in the 15-min endpoint
            "precipitation": 0,
        }
    return result


# ── Public API ────────────────────────────────────────────────────────────────

def get_hourly_forecast(days: int = 2) -> dict:
    """
    Returns hourly weather forecast from Open-Meteo for the next `days` days.
    """
    return _fetch_open_meteo_hourly(days=days)


def get_15min_forecast() -> dict:
    """
    Returns 15-minute resolution weather data for intraday forecasting.
    Only Open-Meteo supports 15-minute resolution natively.
    """
    return _fetch_open_meteo_15min(days=1)


def get_weather_as_arrays(target_date: str | None = None) -> dict:
    """
    Returns weather data as flat arrays aligned to hours 0-23.
    Useful for direct ingestion into the LSTM pipeline.

    Args:
        target_date: "YYYY-MM-DD" string. Defaults to tomorrow.

    Returns:
        {
            "temperature":   [float×24],
            "windspeed":     [float×24],
            "radiation":     [float×24],
            "direct_rad":    [float×24],
            "humidity":      [float×24],
            "precipitation": [float×24],
        }
    """
    tz = pytz.timezone(TIMEZONE)
    if target_date is None:
        target_date = (datetime.now(tz) + timedelta(days=1)).strftime("%Y-%m-%d")

    forecast = get_hourly_forecast(days=2)

    arrays = {k: [] for k in ["temperature", "windspeed", "radiation", "direct_rad", "humidity", "precipitation"]}
    for h in range(24):
        ts_key = f"{target_date}T{h:02d}:00"
        entry  = forecast.get(ts_key, {})
        for k in arrays:
            arrays[k].append(entry.get(k, 0.0))

    return arrays


def get_15min_arrays_today() -> dict:
    """
    Returns weather data as flat arrays aligned to 96 fifteen-minute slots (today).

    Returns:
        {
            "temperature":  [float×96],
            "windspeed":    [float×96],
            "radiation":    [float×96],
            "direct_rad":   [float×96],
        }
    """
    tz  = pytz.timezone(TIMEZONE)
    now = datetime.now(tz)
    today = now.strftime("%Y-%m-%d")

    forecast = get_15min_forecast()
    arrays   = {k: [] for k in ["temperature", "windspeed", "radiation", "direct_rad"]}

    for slot in range(96):
        h   = slot // 4
        m   = (slot % 4) * 15
        ts  = f"{today}T{h:02d}:{m:02d}"
        entry = forecast.get(ts, {})
        for k in arrays:
            arrays[k].append(entry.get(k, 0.0))

    return arrays


# ── Renewable generation estimate ─────────────────────────────────────────────

def estimate_renewable_from_weather(
    radiation_wm2: list,
    windspeed_kmh: list,
    panel_kw:  float = 5.0,    # installed PV capacity (kW)
    turbine_kw: float = 2.0,   # installed wind turbine capacity (kW)
    panel_eff:  float = 0.18,  # PV panel efficiency
    area_m2:    float = 30.0,  # PV panel area (m²)
) -> list:
    """
    Estimates renewable energy generation per time slot (kWh) from weather data.

    Solar PV model:  E_solar = radiation × area × efficiency × (1 - temp_loss)
    Wind model:      E_wind  = min(turbine_kw, 0.5 × ρ × A × v³ / 1000)
                               simplified to a fraction of rated power

    Args:
        radiation_wm2: list of GHI values (W/m²) per slot
        windspeed_kmh: list of wind speeds (km/h) per slot
        panel_kw, turbine_kw, panel_eff, area_m2: system parameters

    Returns: list of estimated renewable kWh per slot
    """
    generation = []
    for rad, wind in zip(radiation_wm2, windspeed_kmh):
        # Solar contribution (kWh per hour or per 15-min slot)
        solar_kw  = (rad / 1000) * area_m2 * panel_eff  # kW at this irradiance
        solar_kw  = min(solar_kw, panel_kw)              # clamp to installed capacity

        # Wind contribution — simplified cubic power curve
        wind_ms   = wind / 3.6                           # km/h → m/s
        wind_frac = min(1.0, (wind_ms / 12.0) ** 3)     # fraction of rated power (12 m/s = rated)
        wind_kw   = turbine_kw * wind_frac

        generation.append(round(solar_kw + wind_kw, 3))

    return generation
