// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title  IntradayMarket
 * @notice Implements a real-time Intra-Day (ID) energy market with 96
 *         fifteen-minute intervals per day (24 h × 4).
 *
 *  Workflow (every 15 minutes, triggered off-chain)
 *  ─────────────────────────────────────────────────
 *  1. The PSO engine runs a fast intraday optimisation using the latest
 *     weather data and the deviations accumulated since the DA schedule.
 *  2. It calls updateInterval() with:
 *       - the new MCP for this 15-min slot
 *       - the PSO-computed aggregate adjustment
 *       - per-node deviations from the DA schedule
 *  3. Nodes that deviate from their DA schedule incur an imbalance cost
 *     (penaltyPositive for over-consumption, penaltyNegative rebate for under-consumption).
 *  4. The off-chain LSTM re-forecasts renewable generation hourly and commits
 *     the updated 15-min forecast via updateRenewableForecast().
 *
 *  Relationship with DA market
 *  ────────────────────────────
 *  The DA schedule (from DayAheadMarket.sol) is the reference baseline.
 *  ID trading allows prosumers to trade the delta between DA schedule and
 *  actual production/consumption at the real-time MCP.
 *
 *  Fixed-point: all values ×100.
 */
contract IntradayMarket {

    uint public constant INTERVALS_PER_DAY = 96; // 24 × 4  (15-min resolution)

    // ── MCP array for all 96 intervals ────────────────────────────────────────
    // Updated progressively as each interval closes.
    int[96] public intradayMCP;

    // ── PSO-computed aggregate adjustment per interval ────────────────────────
    // Represents the total network consumption adjustment the PSO recommended.
    mapping(uint => int) public psoAdjustedAggregate;

    // ── Per-node deviation tracking ───────────────────────────────────────────
    // deviation[node][interval] = actual_consumption - da_schedule (×100 kWh)
    // Positive  → node consumed MORE than its DA schedule (over-delivery risk)
    // Negative  → node consumed LESS  (under-delivery)
    mapping(address => mapping(uint => int)) public deviation;

    // ── Imbalance penalty / rebate coefficients (×100 €/kWh) ─────────────────
    int public penaltyPositive = 300; // 3.00 €/kWh for over-consumption
    int public penaltyNegative = 150; // 1.50 €/kWh rebate for under-consumption

    // ── Rolling weather-adjusted renewable forecast ───────────────────────────
    // Updated each time new weather data arrives (typically once per hour).
    int[96] public forecastRenewable15min;

    // ── Market state ──────────────────────────────────────────────────────────
    uint public currentInterval;  // last updated interval index (0-95)
    uint public lastUpdateBlock;
    uint public marketDay;        // Unix day index
    address public operator;

    // ── Reference to the DA market for reading the base schedule ─────────────
    address public dayAheadMarketAddress;

    // ── Events ────────────────────────────────────────────────────────────────
    event IntervalUpdated(
        uint indexed interval,
        int  mcp,
        int  psoAggregate,
        uint timestamp
    );
    event DeviationRecorded(address indexed node, uint indexed interval, int dev);
    event RenewableForecastUpdated(uint timestamp);
    event PenaltiesUpdated(int positive, int negative);

    modifier onlyOperator() {
        require(msg.sender == operator, "ID: only operator");
        _;
    }

    constructor(address _dayAheadMarket) {
        operator             = msg.sender;
        dayAheadMarketAddress = _dayAheadMarket;
        marketDay            = block.timestamp / 86400;
    }

    // ── Core interval update (called by PSO engine every 15 min) ─────────────

    /**
     * @notice Updates a 15-minute interval with new MCP and PSO results.
     *
     *  Called by the off-chain intraday PSO engine after it:
     *    1. Reads real-time smart-meter data (actual consumption).
     *    2. Computes deviations from each node's DA schedule.
     *    3. Runs one PSO iteration to minimise imbalance cost.
     *    4. Derives a new equilibrium MCP for this slot.
     *
     * @param intervalIndex  0–95 slot index.
     * @param newMCP         Cleared MCP for this slot (×100 €/kWh).
     * @param aggregateAdj   Total network consumption adjustment (×100 kWh).
     * @param nodeAddresses  Prosumer node addresses.
     * @param nodeDeviations Corresponding deviations from DA schedule (×100 kWh).
     */
    function updateInterval(
        uint      intervalIndex,
        int       newMCP,
        int       aggregateAdj,
        address[] calldata nodeAddresses,
        int[]     calldata nodeDeviations
    ) external onlyOperator {
        require(intervalIndex < INTERVALS_PER_DAY, "ID: invalid interval");
        require(nodeAddresses.length == nodeDeviations.length, "ID: array mismatch");

        intradayMCP[intervalIndex]          = newMCP;
        psoAdjustedAggregate[intervalIndex] = aggregateAdj;
        currentInterval                     = intervalIndex;
        lastUpdateBlock                     = block.number;

        // Record per-node deviations for settlement at end of day
        for (uint i = 0; i < nodeAddresses.length; i++) {
            deviation[nodeAddresses[i]][intervalIndex] = nodeDeviations[i];
            emit DeviationRecorded(nodeAddresses[i], intervalIndex, nodeDeviations[i]);
        }

        emit IntervalUpdated(intervalIndex, newMCP, aggregateAdj, block.timestamp);
    }

    // ── Renewable forecast update (called when new weather data arrives) ──────

    /**
     * @notice Updates the 15-minute renewable generation forecast.
     *         The off-chain LSTM re-runs whenever fresh weather data arrives
     *         (typically hourly from the weather API) and commits the new
     *         96-slot forecast here.
     *
     * @param forecast 96-element array of forecast renewable generation (×100 kWh).
     */
    function updateRenewableForecast(
        int[96] calldata forecast
    ) external onlyOperator {
        for (uint i = 0; i < INTERVALS_PER_DAY; i++) {
            forecastRenewable15min[i] = forecast[i];
        }
        emit RenewableForecastUpdated(block.timestamp);
    }

    // ── Imbalance settlement ──────────────────────────────────────────────────

    /**
     * @notice Computes the total imbalance cost for a node over a range of intervals.
     *
     *  Over-consumption (deviation > 0): cost = deviation × penaltyPositive
     *  Under-consumption (deviation < 0): cost = deviation × penaltyNegative
     *    → negative × negative = positive (rebate reduces total cost)
     *
     * @param node      Node address.
     * @param fromSlot  Inclusive start interval.
     * @param toSlot    Inclusive end interval.
     * @return cost     Net imbalance cost (×100 ×100 — divide by 10000 for €).
     */
    function computeImbalanceCost(
        address node,
        uint    fromSlot,
        uint    toSlot
    ) external view returns (int cost) {
        for (uint i = fromSlot; i <= toSlot && i < INTERVALS_PER_DAY; i++) {
            int dev = deviation[node][i];
            if (dev > 0) {
                cost += dev * penaltyPositive;      // penalty for over-consumption
            } else if (dev < 0) {
                cost += dev * penaltyNegative;      // rebate (negative cost) for under-consumption
            }
        }
    }

    /**
     * @notice Operator adjusts imbalance penalty rates to reflect regulatory changes.
     *         In a real market, these coefficients are set by the grid operator (TSO).
     */
    function setPenalties(int positive, int negative) external onlyOperator {
        require(positive >= 0 && negative >= 0, "ID: non-negative penalties");
        penaltyPositive = positive;
        penaltyNegative = negative;
        emit PenaltiesUpdated(positive, negative);
    }

    // ── Getters ───────────────────────────────────────────────────────────────

    function getIntradayMCPFull() external view returns (int[96] memory) {
        return intradayMCP;
    }

    function getMCPForInterval(uint interval) external view returns (int) {
        require(interval < INTERVALS_PER_DAY, "ID: invalid interval");
        return intradayMCP[interval];
    }

    function getDeviation(address node, uint interval) external view returns (int) {
        return deviation[node][interval];
    }

    function getRenewableForecast15min() external view returns (int[96] memory) {
        return forecastRenewable15min;
    }

    function getCurrentIntervalIndex() external view returns (uint) {
        // Derives the current expected interval from block timestamp
        uint secondsInDay = block.timestamp % 86400;
        return secondsInDay / 900; // 900 seconds = 15 minutes
    }
}
