"""
data_pipeline.py
─────────────────
Orchestrates the full off-chain forecast → smart-contract commit pipeline.

Day-Ahead pipeline  (run once per day, e.g. at 12:00 for the following day)
──────────────────────────────────────────────────────────────────────────────
  1. Fetch 48-hour hourly weather forecast from Open-Meteo.
  2. Build a 7-day feature window from historical consumption + weather.
  3. Run the DA LSTM to get 24h consumption + renewable forecasts.
  4. Apply weather-factor and price-elasticity corrections.
  5. Call DayAheadMarket.openBidding() via Web3.py to commit the forecast.
  6. Each prosumer node (if automated) calls submitBid() with its adjusted
     quantity and its bid price.
  7. After bid window closes, call clearMarket() to establish the DA MCP.

Intra-Day pipeline  (run every 15 minutes)
──────────────────────────────────────────
  1. Fetch latest 15-min weather data.
  2. Read current consumption from smart meters (or Node contract state).
  3. Build a 4-hour (16-slot) feature window.
  4. Run the ID LSTM to forecast the next 4 slots.
  5. Compute deviations from the DA schedule.
  6. Run a lightweight PSO step to suggest adjustments.
  7. Call IntradayMarket.updateInterval() to record MCP + deviations.
  8. Optionally call IntradayMarket.updateRenewableForecast() if weather changed.

Usage
─────
    python data_pipeline.py --mode da         # day-ahead pipeline
    python data_pipeline.py --mode id         # intraday pipeline (one interval)
    python data_pipeline.py --mode train-da   # pre-train DA LSTM
    python data_pipeline.py --mode train-id   # pre-train ID LSTM
"""

import argparse
import json
import math
import os
import sys

import numpy as np

# web3 is only needed when committing forecasts to the blockchain.
# It is imported lazily inside _connect_web3() so that training and
# dry-run modes work without web3 installed.

# Local modules (in the same prediction/ folder)
from weather_service import (
    get_weather_as_arrays,
    get_15min_arrays_today,
    estimate_renewable_from_weather,
)
from lstm_forecast import (
    DAForecastModel,
    IDForecastModel,
    build_feature_matrix,
    generate_synthetic_training_data,
    compute_weather_factor,
    TF_AVAILABLE,
)

# ── Blockchain configuration ──────────────────────────────────────────────────
RPC_URL = os.getenv("ETH_RPC_URL",       "http://127.0.0.1:8545")
OPERATOR_ADDR  = os.getenv("OPERATOR_ADDRESS", "")
OPERATOR_PKEY  = os.getenv("OPERATOR_PRIVATE_KEY", "")   # ← never hard-code keys

DA_CONTRACT_ADDR = os.getenv("DA_CONTRACT_ADDRESS",  "")
ID_CONTRACT_ADDR = os.getenv("ID_CONTRACT_ADDRESS",  "")

# ABI paths (built by Hardhat)
ARTIFACTS_DIR = os.path.join(os.path.dirname(__file__), "..", "artifacts", "contracts")
DA_ABI_PATH   = os.path.join(ARTIFACTS_DIR, "DayAheadMarket.sol",  "DayAheadMarket.json")
ID_ABI_PATH   = os.path.join(ARTIFACTS_DIR, "IntradayMarket.sol",  "IntradayMarket.json")

# CSV baseline path
DATA_CSV  = os.path.join(os.path.dirname(__file__), "..", "data", "consum_data.csv")

# Fixed-point scale (same as Solidity contracts)
FP_SCALE = 100


# ── Fallback forecasts (no TensorFlow required) ───────────────────────────────

def _weather_baseline_da(weather: dict, baseline: dict) -> tuple:
    """
    Simple weather-adjusted consumption + renewable forecast for the DA pipeline
    when TensorFlow is not installed. Uses the CSV baseline profile scaled by
    the heating/cooling weather factor.
    """
    consumption_24h = [
        baseline["positions"][h] * compute_weather_factor(weather["temperature"][h])
        for h in range(24)
    ]
    renewable_24h = estimate_renewable_from_weather(
        weather["radiation"], weather["windspeed"]
    )
    return consumption_24h, renewable_24h


def _weather_baseline_id(weather15: dict, baseline: dict, interval_index: int) -> tuple:
    """
    Simple weather-adjusted forecast for the next 4 intraday slots when
    TensorFlow is not installed.
    """
    slots = [min(interval_index + k, 95) for k in range(4)]
    rad   = [weather15["radiation"][s] for s in slots]
    wind  = [weather15["windspeed"][s] for s in slots]
    temps = [weather15["temperature"][s] for s in slots]
    hour  = [s // 4 % 24 for s in slots]

    consumption_4 = [
        baseline["positions"][hour[i]] * compute_weather_factor(temps[i])
        for i in range(4)
    ]
    renewable_4 = estimate_renewable_from_weather(rad, wind)
    return consumption_4, renewable_4


# ── Web3 setup ────────────────────────────────────────────────────────────────

def _connect_web3():
    try:
        from web3 import Web3
    except ImportError:
        raise ImportError(
            "web3 is required for blockchain commits.\n"
            "Install it with: pip install web3"
        )
    w3 = Web3(Web3.HTTPProvider(RPC_URL))
    if not w3.is_connected():
        raise ConnectionError(f"Cannot connect to Ethereum node at {RPC_URL}")
    return w3


def _load_contract(w3, abi_path: str, address: str):
    """Loads a Hardhat-compiled contract given the artifact JSON path."""
    if not os.path.exists(abi_path):
        raise FileNotFoundError(f"ABI not found: {abi_path}. Run `npx hardhat compile` first.")
    with open(abi_path) as f:
        artifact = json.load(f)
    from web3 import Web3
    return w3.eth.contract(address=Web3.to_checksum_address(address), abi=artifact["abi"])


def _send_tx(w3, fn_call, gas: int = 3_000_000):
    """
    Signs and broadcasts a contract transaction with the operator key.
    The private key is read from OPERATOR_PRIVATE_KEY env var; it is never
    passed as a command-line argument or stored in source code.
    """
    if not OPERATOR_PKEY:
        raise EnvironmentError("OPERATOR_PRIVATE_KEY env var not set")

    acct    = w3.eth.account.from_key(OPERATOR_PKEY)
    nonce   = w3.eth.get_transaction_count(acct.address)
    tx      = fn_call.build_transaction({
        "from":     acct.address,
        "nonce":    nonce,
        "gas":      gas,
        "gasPrice": w3.eth.gas_price,
    })
    signed  = acct.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
    return receipt


# ── Baseline data loader ──────────────────────────────────────────────────────

def _load_csv_baseline() -> dict:
    """
    Reads consum_data.csv and returns average values across all nodes.
    The CSV stores arrays of 5 values per node; we project them to 24 hours
    by repeating with a realistic daily load shape.

    Returns:
        {
            "positions":  [float×24],   # avg consumption (kWh)
            "capacity":   [float×24],
            "flexible":   [float×24],
            "battery_cap":float,
            "battery_chg":float,
        }
    """
    import pandas as pd

    df = pd.read_csv(DATA_CSV)

    def parse_arr(col):
        rows = []
        for v in df[col]:
            try:
                rows.append(json.loads(v))
            except Exception:
                rows.append([0] * 5)
        # Average across nodes
        avg = np.mean(rows, axis=0)
        return avg.tolist()

    pos5 = parse_arr("initialPosition")
    cap5 = parse_arr("initialCapacity")
    flx5 = parse_arr("initialFlexibleLoad")

    # Project 5-slot values to 24 hours via cubic interpolation
    x5   = np.linspace(0, 23, 5)
    x24  = np.arange(24)
    pos24 = np.interp(x24, x5, pos5).tolist()
    cap24 = np.interp(x24, x5, cap5).tolist()
    flx24 = np.interp(x24, x5, flx5).tolist()

    return {
        "positions":   pos24,
        "capacity":    cap24,
        "flexible":    flx24,
        "battery_cap": float(np.mean(parse_arr("initialBatteryCapacity"))),
        "battery_chg": float(np.mean(parse_arr("initialBatteryCharge"))),
    }


# ── Day-Ahead pipeline ────────────────────────────────────────────────────────

def run_da_pipeline(dry_run: bool = False) -> dict:
    """
    Executes the full Day-Ahead pipeline.

    Args:
        dry_run: If True, compute forecasts but do NOT commit to blockchain.

    Returns:
        {
            "consumption_24h": [float×24],
            "renewable_24h":   [float×24],
            "mcp_estimate":    [float×24],
        }
    """
    print("[DA] Fetching weather forecast …")
    weather = get_weather_as_arrays()   # next day's 24-hour arrays

    print("[DA] Loading CSV baseline …")
    baseline = _load_csv_baseline()

    # Build a 7-day synthetic history by repeating baseline with weather variation
    # (In production, replace with real 7-day smart-meter history)
    n_hist    = 168   # 7 × 24
    hist_temp = [weather["temperature"][h % 24] + np.random.normal(0, 1) for h in range(n_hist)]
    hist_wind = [weather["windspeed"][h % 24]   + np.random.normal(0, 0.5) for h in range(n_hist)]
    hist_rad  = [weather["radiation"][h % 24]   * max(0, 1 + np.random.normal(0, 0.05)) for h in range(n_hist)]
    hist_hum  = [weather["humidity"][h % 24]    + np.random.normal(0, 2) for h in range(n_hist)]
    hist_con  = [baseline["positions"][h % 24]  * (1 + np.random.normal(0, 0.02)) for h in range(n_hist)]
    hist_ren  = estimate_renewable_from_weather(hist_rad, hist_wind)

    feature_matrix, _ = build_feature_matrix(
        hist_temp, hist_wind, hist_rad, hist_hum, hist_con, hist_ren
    )

    print("[DA] Running LSTM inference …")
    if TF_AVAILABLE:
        da_model = DAForecastModel()
        da_model.build()
        consumption_24h, renewable_24h = da_model.predict(
            feature_matrix,
            temperatures_next24=weather["temperature"]
        )
    else:
        print("[DA] TensorFlow not installed — using weather-adjusted baseline forecast")
        consumption_24h, renewable_24h = _weather_baseline_da(weather, baseline)

    # Convert to ×100 fixed-point for the contract
    consumption_fp = [int(round(v * FP_SCALE)) for v in consumption_24h]
    renewable_fp   = [int(round(v * FP_SCALE)) for v in renewable_24h]

    print(f"[DA] Forecast: avg consumption {sum(consumption_24h)/24:.1f} kWh/h, "
          f"avg renewable {sum(renewable_24h)/24:.2f} kWh/h")

    if not dry_run and DA_CONTRACT_ADDR:
        print("[DA] Committing forecast to DayAheadMarket contract …")
        w3      = _connect_web3()
        da_ctr  = _load_contract(w3, DA_ABI_PATH, DA_CONTRACT_ADDR)
        receipt = _send_tx(w3, da_ctr.functions.openBidding(consumption_fp, renewable_fp))
        print(f"[DA] openBidding tx: {receipt.transactionHash.hex()}")
    else:
        print("[DA] Dry-run mode — skipping blockchain commit")

    return {
        "consumption_24h": consumption_24h,
        "renewable_24h":   renewable_24h,
        "consumption_fp":  consumption_fp,
        "renewable_fp":    renewable_fp,
    }


# ── Intra-Day pipeline ────────────────────────────────────────────────────────

def run_id_pipeline(interval_index: int | None = None, dry_run: bool = False) -> dict:
    """
    Executes one 15-minute intraday update.

    Args:
        interval_index: Which 15-min slot (0-95). If None, computed from current time.
        dry_run:        Skip blockchain commit.

    Returns:
        {
            "interval":        int,
            "consumption_4":   [float×4],
            "renewable_4":     [float×4],
            "mcp_current":     float,
            "deviations":      { node_address: float, … },
        }
    """
    import time
    from datetime import datetime

    if interval_index is None:
        # Current 15-min slot based on wall clock
        now = datetime.now()
        interval_index = (now.hour * 60 + now.minute) // 15

    print(f"[ID] Interval {interval_index}/95 ({interval_index*15//60:02d}:{interval_index*15%60:02d})")

    print("[ID] Fetching 15-min weather data …")
    weather15 = get_15min_arrays_today()

    baseline = _load_csv_baseline()

    # Build 16-slot history window
    start_slot = max(0, interval_index - 16)
    hist_temp  = weather15["temperature"][start_slot:interval_index]
    hist_wind  = weather15["windspeed"][start_slot:interval_index]
    hist_rad   = weather15["radiation"][start_slot:interval_index]
    hist_hum   = [60.0] * len(hist_temp)   # humidity not available in 15-min endpoint
    hist_con   = [baseline["positions"][(start_slot + i) // 4 % 24] for i in range(len(hist_temp))]
    hist_ren   = estimate_renewable_from_weather(hist_rad, hist_wind)

    # Pad to 16 slots if near the start of the day
    while len(hist_temp) < 16:
        hist_temp.insert(0, hist_temp[0] if hist_temp else 15.0)
        hist_wind.insert(0, hist_wind[0] if hist_wind else 10.0)
        hist_rad.insert(0,  hist_rad[0]  if hist_rad  else 0.0)
        hist_hum.insert(0,  60.0)
        hist_con.insert(0,  baseline["positions"][0])
        hist_ren.insert(0,  0.0)

    feature_matrix, _ = build_feature_matrix(
        hist_temp[:16], hist_wind[:16], hist_rad[:16], hist_hum[:16],
        hist_con[:16],  hist_ren[:16]
    )

    print("[ID] Running LSTM inference …")
    if TF_AVAILABLE:
        id_model = IDForecastModel()
        id_model.build()
        consumption_4, renewable_4 = id_model.predict(
            feature_matrix,
            current_temperature=weather15["temperature"][interval_index] if interval_index < 96 else 15.0
        )
    else:
        print("[ID] TensorFlow not installed — using weather-adjusted baseline forecast")
        consumption_4, renewable_4 = _weather_baseline_id(weather15, baseline, interval_index)

    # Convert consumption from ×100 fixed-point to kWh, and renewable from kW to kWh
    # (estimate_renewable_from_weather returns instantaneous kW; ×0.25 for 15-min slots)
    consumption_kwh = [v / FP_SCALE for v in consumption_4]
    renewable_kwh   = [v * 0.25     for v in renewable_4]

    # Simplified MCP: net demand (kWh) × tariff rate (€/kWh)
    avg_demand    = sum(consumption_kwh) / 4
    avg_renewable = sum(renewable_kwh)   / 4
    net_demand    = max(0.0, avg_demand - avg_renewable)
    mcp_current   = round(net_demand * 0.5, 4)  # 0.50 €/kWh base tariff on net demand

    # Deviations are normally read from smart meters; here we simulate small noise
    # In production: replace with real smart-meter readings per node
    simulated_deviations = {}   # { node_address: deviation_float }

    if not dry_run and ID_CONTRACT_ADDR:
        consumption_fp   = [int(round(v * FP_SCALE)) for v in consumption_4]
        renewable_fp     = [int(round(v * FP_SCALE)) for v in renewable_4]
        mcp_fp           = int(round(mcp_current * FP_SCALE))

        node_addrs       = list(simulated_deviations.keys())
        node_devs_fp     = [int(round(d * FP_SCALE)) for d in simulated_deviations.values()]
        aggregate_fp     = int(round((sum(consumption_fp) - sum(renewable_fp)) / 4))

        print("[ID] Committing to IntradayMarket contract …")
        w3      = _connect_web3()
        id_ctr  = _load_contract(w3, ID_ABI_PATH, ID_CONTRACT_ADDR)
        receipt = _send_tx(w3, id_ctr.functions.updateInterval(
            interval_index, mcp_fp, aggregate_fp, node_addrs, node_devs_fp
        ))
        print(f"[ID] updateInterval tx: {receipt.transactionHash.hex()}")

        # Also refresh renewable forecast every 4 slots (≈ 1 hour)
        if interval_index % 4 == 0:
            forecast_fp = [int(round(v * FP_SCALE)) for v in
                           estimate_renewable_from_weather(weather15["radiation"], weather15["windspeed"])]
            forecast_fp += [0] * (96 - len(forecast_fp))   # pad to 96
            receipt2 = _send_tx(w3, id_ctr.functions.updateRenewableForecast(forecast_fp[:96]))
            print(f"[ID] updateRenewableForecast tx: {receipt2.transactionHash.hex()}")
    else:
        print("[ID] Dry-run mode — skipping blockchain commit")

    return {
        "interval":      interval_index,
        "consumption_4": consumption_4,
        "renewable_4":   renewable_4,
        "mcp_current":   mcp_current,
        "deviations":    simulated_deviations,
    }


# ── Full-day intraday simulation (testing / demo only) ───────────────────────

def run_id_full_day(dry_run: bool = True) -> dict:
    """
    Simulates all 96 fifteen-minute intervals for today in one call.
    Intended for testing and visualisation — NOT for production use.

    In production, run_id_pipeline() is called every 15 minutes by a scheduler
    so that each interval uses fresh real-time meter data and weather updates.

    Returns a dict with four 96-element arrays:
        mcp_96, consumption_96, renewable_96, labels_96
    """
    print("[ID-FULL] Fetching 15-min weather data for today …")
    weather15 = get_15min_arrays_today()
    baseline  = _load_csv_baseline()

    mcp_96         = []
    consumption_96 = []
    renewable_96   = []
    labels_96      = []

    for slot in range(96):
        h = slot // 4
        m = (slot % 4) * 15
        labels_96.append(f"{h:02d}:{m:02d}")

        # Weather-adjusted consumption (convert from ×100 fixed-point to kWh)
        temp  = weather15["temperature"][slot]
        c_kwh = baseline["positions"][h % 24] / FP_SCALE * compute_weather_factor(temp)

        # Renewable for this slot: kW × 0.25 h = kWh per 15-min slot
        rad   = weather15["radiation"][slot]
        wind  = weather15["windspeed"][slot]
        r_kwh = estimate_renewable_from_weather([rad], [wind])[0] * 0.25

        net = max(0.0, c_kwh - r_kwh)
        mcp = round(net * 0.5, 4)   # 0.50 €/kWh base tariff on net demand

        consumption_96.append(round(c_kwh, 4))
        renewable_96.append(round(r_kwh, 4))
        mcp_96.append(mcp)

    print(f"[ID-FULL] Done. Avg MCP: {sum(mcp_96)/96:.4f} €/kWh, "
          f"Avg consumption: {sum(consumption_96)/96:.3f} kWh/slot, "
          f"Avg renewable: {sum(renewable_96)/96:.3f} kWh/slot")

    return {
        "mcp_96":         mcp_96,
        "consumption_96": consumption_96,
        "renewable_96":   renewable_96,
        "labels_96":      labels_96,
    }


# ── Training helper ───────────────────────────────────────────────────────────

def run_training(model_type: str = "da") -> None:
    """Trains the DA or ID LSTM on synthetic data."""
    print(f"[TRAIN] Generating synthetic training data for {model_type.upper()} model …")
    data = generate_synthetic_training_data(n_days=90)

    if model_type == "da":
        model = DAForecastModel()
        model.build()
        print(f"[TRAIN-DA] Training on {len(data['da_X'])} samples …")
        model.train(data["da_X"], data["da_y"], epochs=50)
        print("[TRAIN-DA] Training complete.")

    elif model_type == "id":
        model = IDForecastModel()
        model.build()
        print(f"[TRAIN-ID] Training on {len(data['id_X'])} samples …")
        model.train(data["id_X"], data["id_y"], epochs=30)
        print("[TRAIN-ID] Training complete.")


# ── CLI entry point ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Energy market prediction pipeline")
    parser.add_argument(
        "--mode",
        choices=["da", "id", "id-full", "train-da", "train-id"],
        default="da",
        help="Pipeline mode: da=day-ahead, id=one 15-min interval, id-full=all 96 intervals (demo), train-da/train-id=train LSTM"
    )
    parser.add_argument("--dry-run", action="store_true",
                        help="Compute forecast but skip blockchain commit")
    parser.add_argument("--interval", type=int, default=None,
                        help="Intraday interval index (0-95), default=current")
    args = parser.parse_args()

    if args.mode == "da":
        result = run_da_pipeline(dry_run=args.dry_run)
        print(json.dumps(result, indent=2))

    elif args.mode == "id":
        result = run_id_pipeline(interval_index=args.interval, dry_run=args.dry_run)
        print(json.dumps(result, indent=2))

    elif args.mode == "id-full":
        result = run_id_full_day(dry_run=True)
        print(json.dumps(result, indent=2))

    elif args.mode == "train-da":
        if not TF_AVAILABLE:
            print("[TRAIN] TensorFlow is required for training.")
            print("        Install it with: pip install tensorflow")
            sys.exit(1)
        run_training("da")

    elif args.mode == "train-id":
        if not TF_AVAILABLE:
            print("[TRAIN] TensorFlow is required for training.")
            print("        Install it with: pip install tensorflow")
            sys.exit(1)
        run_training("id")
