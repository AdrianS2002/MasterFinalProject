// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title  DayAheadMarket
 * @notice Implements a 24-hour Day-Ahead (DA) energy market.
 *
 *  Workflow
 *  ────────
 *  1. Off-chain LSTM engine calls openBidding() with renewable + demand forecast.
 *  2. Each prosumer Node calls submitBid() with hourly quantity + price.
 *  3. Operator calls clearMarket() which runs a simplified uniform-price merit
 *     order and stores one Market Clearing Price (MCP) per hour.
 *  4. PSO optimisation in Node contracts uses the DA MCP array as the social
 *     guide so particles converge to the market-optimal schedule.
 *
 *  Fixed-point convention
 *  ──────────────────────
 *  All prices and quantities are stored ×100 (i.e. 5.25 €/kWh → 525).
 *  This avoids Solidity floating-point limitations.
 *
 *  Merit-order clearing
 *  ────────────────────
 *  Renewable generation enters supply at zero marginal cost.
 *  When renewables ≥ demand the MCP collapses toward 0 (or negative),
 *  which is the correct market signal for surplus-RE conditions.
 */
contract DayAheadMarket {

    uint public constant HOURS = 24;

    // ── Operator (market authority / off-chain engine address) ────────────────
    address public operator;

    // ── LSTM forecast committed on-chain for transparency ────────────────────
    int[24] public forecastRenewable; // kWh per hour (×100)
    int[24] public forecastDemand;    // kWh per hour (×100)

    // ── Cleared MCP (result of merit-order clearing) ──────────────────────────
    int[24] public dayAheadMCP;

    // ── Per-node DA schedule assigned after clearing ──────────────────────────
    mapping(address => int[24]) private _nodeSchedule;

    // ── Bid structure ─────────────────────────────────────────────────────────
    struct Bid {
        int[24] quantity; // positive = consume, negative = inject/sell
        int[24] price;    // max WTP (consumers) or min sell price (injectors) ×100
        bool    submitted;
    }
    mapping(address => Bid) public bids;
    address[] public bidders;

    // ── Market day & state ────────────────────────────────────────────────────
    uint public marketDay;     // Unix day index (timestamp / 86400 + 1 for next day)
    bool public biddingOpen;
    bool public marketCleared;

    // ── Events ────────────────────────────────────────────────────────────────
    event BiddingOpened(uint indexed day, uint timestamp);
    event ForecastCommitted(int[24] renewable, int[24] demand, uint timestamp);
    event BidSubmitted(address indexed node, uint timestamp);
    event MarketCleared(int[24] mcp, uint timestamp);

    modifier onlyOperator() {
        require(msg.sender == operator, "DA: only operator");
        _;
    }

    constructor() {
        operator = msg.sender;
    }

    // ── Phase 1: open bidding + commit forecast ───────────────────────────────

    /**
     * @notice Opens bidding for the next day and commits the LSTM forecast.
     *         Called by the off-chain prediction engine after it generates
     *         the 24-hour renewable + demand forecast.
     *
     * @param renewable  24-element array of forecast renewable generation (×100 kWh).
     * @param demand     24-element array of forecast consumption (×100 kWh).
     */
    function openBidding(
        int[24] calldata renewable,
        int[24] calldata demand
    ) external onlyOperator {
        require(!biddingOpen, "DA: bidding already open");

        // Reset previous market state
        marketCleared = false;
        biddingOpen   = true;
        marketDay     = block.timestamp / 86400 + 1; // next calendar day

        // Persist forecast on-chain for auditability
        for (uint i = 0; i < HOURS; i++) {
            forecastRenewable[i] = renewable[i];
            forecastDemand[i]    = demand[i];
        }

        // Clear previous bid registry
        for (uint i = 0; i < bidders.length; i++) {
            delete bids[bidders[i]];
        }
        delete bidders;

        emit BiddingOpened(marketDay, block.timestamp);
        emit ForecastCommitted(renewable, demand, block.timestamp);
    }

    // ── Phase 2: node bid submission ─────────────────────────────────────────

    /**
     * @notice A prosumer node submits its 24-hour bid.
     *
     *   Consumption bid : quantity[h] > 0, price[h] = max willingness-to-pay.
     *   Injection bid   : quantity[h] < 0, price[h] = min acceptable sell price.
     *
     *  The off-chain DA workflow adjusts quantity using weather-scaled
     *  consumption (see data_pipeline.py) before calling this function.
     *
     * @param quantity 24 hourly quantities (×100 kWh).
     * @param price    24 hourly bid prices (×100 €/kWh).
     */
    function submitBid(
        int[24] calldata quantity,
        int[24] calldata price
    ) external {
        require(biddingOpen && !marketCleared, "DA: bidding not active");

        if (!bids[msg.sender].submitted) {
            bidders.push(msg.sender);
        }
        for (uint i = 0; i < HOURS; i++) {
            bids[msg.sender].quantity[i] = quantity[i];
            bids[msg.sender].price[i]    = price[i];
        }
        bids[msg.sender].submitted = true;
        emit BidSubmitted(msg.sender, block.timestamp);
    }

    // ── Phase 3: market clearing ──────────────────────────────────────────────

    /**
     * @notice Clears the DA market hour-by-hour using a merit-order algorithm.
     *
     *  For each hour h:
     *    supply_zero_cost = forecastRenewable[h]     (free renewable)
     *    net_demand       = sum(positive bids) - supply_zero_cost
     *
     *    if net_demand ≤ 0   → MCP = 0 (renewables cover everything, no conventional needed)
     *    else               → MCP = price of the last accepted conventional supply bid
     *                               (the "marginal unit" in the merit order)
     *
     *  All accepted bidders receive the uniform MCP (not their own bid price).
     *  Schedules are set equal to submitted quantities for accepted bids.
     *
     * @dev O(n) scan per hour — suitable for small networks (< 100 nodes).
     */
    function clearMarket() external onlyOperator {
        require(biddingOpen && !marketCleared, "DA: cannot clear");
        require(bidders.length > 0, "DA: no bids");

        for (uint h = 0; h < HOURS; h++) {
            // ── Aggregate demand for this hour ──
            int totalDemand = 0;
            for (uint j = 0; j < bidders.length; j++) {
                if (bids[bidders[j]].quantity[h] > 0) {
                    totalDemand += bids[bidders[j]].quantity[h];
                }
            }

            // ── Net demand after zero-cost renewable supply ──
            int netDemand = totalDemand - forecastRenewable[h];

            int hourMCP;
            if (netDemand <= 0) {
                // Renewable surplus → negative price signal to encourage consumption
                hourMCP = (netDemand * 2) / 100; // mild negative price per unit surplus
            } else {
                // Find the cheapest injection bids to satisfy remaining demand.
                // Walk through bids in ascending price order (greedy merit order).
                int remaining = netDemand;
                int marginal  = 0;
                bool satisfied = false;

                // Simple O(n) minimum-price scan (sufficient for < 100 nodes)
                bool[] memory used = new bool[](bidders.length);
                while (remaining > 0) {
                    int   bestPrice   = type(int).max;
                    uint  bestIdx     = type(uint).max;
                    for (uint j = 0; j < bidders.length; j++) {
                        if (
                            !used[j] &&
                            bids[bidders[j]].quantity[h] < 0 &&
                            bids[bidders[j]].price[h] < bestPrice
                        ) {
                            bestPrice = bids[bidders[j]].price[h];
                            bestIdx   = j;
                        }
                    }
                    if (bestIdx == type(uint).max) break; // no more supply bids
                    used[bestIdx] = true;
                    marginal       = bestPrice;
                    remaining     += bids[bidders[bestIdx]].quantity[h]; // negative qty
                    if (remaining <= 0) { satisfied = true; break; }
                }
                hourMCP = satisfied ? marginal : forecastDemand[h] / 10; // fallback: 10% of demand as price
            }

            dayAheadMCP[h] = hourMCP;

            // Assign schedules (accepted quantity = submitted quantity)
            for (uint j = 0; j < bidders.length; j++) {
                _nodeSchedule[bidders[j]][h] = bids[bidders[j]].quantity[h];
            }
        }

        biddingOpen   = false;
        marketCleared = true;
        emit MarketCleared(dayAheadMCP, block.timestamp);
    }

    // ── Getters ───────────────────────────────────────────────────────────────

    function getDayAheadMCP() external view returns (int[24] memory) {
        return dayAheadMCP;
    }

    function getNodeSchedule(address node) external view returns (int[24] memory) {
        return _nodeSchedule[node];
    }

    function getForecastRenewable() external view returns (int[24] memory) {
        return forecastRenewable;
    }

    function getForecastDemand() external view returns (int[24] memory) {
        return forecastDemand;
    }

    function getBidderCount() external view returns (uint) {
        return bidders.length;
    }

    function getMCPForHour(uint hour) external view returns (int) {
        require(hour < HOURS, "DA: invalid hour");
        return dayAheadMCP[hour];
    }
}
