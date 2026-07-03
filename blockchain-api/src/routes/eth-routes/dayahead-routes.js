/**
 * dayahead-routes.js
 * ──────────────────
 * Express routes for the Day-Ahead energy market.
 * Mounted at /blockchain-api/dayahead in app.js.
 *
 * All :username params are the authenticated user's username, which the BLL
 * uses to look up the DayAheadMarket contract address from the database.
 */

const express   = require('express');
const router    = express.Router();
const dayaheadBLL = require('../../eth-business/dayahead-bll');

/** Serialises BigInt values returned by ethers.js to strings. */
function stringifyBigInt(obj) {
    return JSON.parse(
        JSON.stringify(obj, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
        )
    );
}

// ── Write endpoints ────────────────────────────────────────────────────────

/**
 * POST /blockchain-api/dayahead/open-bidding/:username
 * Body: { renewable: number[24], demand: number[24] }
 * Opens bidding for the next day and commits LSTM forecast on-chain.
 * Only the market operator account should call this endpoint.
 */
router.post('/open-bidding/:username', async (req, res) => {
    try {
        const { renewable, demand } = req.body;
        if (!Array.isArray(renewable) || renewable.length !== 24 ||
            !Array.isArray(demand)    || demand.length    !== 24) {
            return res.status(400).json({ error: 'renewable and demand must each be a 24-element array' });
        }
        const result = await dayaheadBLL.openBidding(req.params.username, renewable, demand);
        res.json(stringifyBigInt(result));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /blockchain-api/dayahead/submit-bid/:username
 * Body: { quantity: number[24], price: number[24] }
 * Submits a 24-hour bid for the node owned by :username.
 */
router.post('/submit-bid/:username', async (req, res) => {
    try {
        const { quantity, price } = req.body;
        if (!Array.isArray(quantity) || quantity.length !== 24 ||
            !Array.isArray(price)    || price.length    !== 24) {
            return res.status(400).json({ error: 'quantity and price must each be a 24-element array' });
        }
        const result = await dayaheadBLL.submitBid(req.params.username, quantity, price);
        res.json(stringifyBigInt(result));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /blockchain-api/dayahead/compute/:username
 * Clears the market and establishes the 24-hour MCP profile.
 * Should be called by the operator after the bidding window closes.
 */
router.post('/compute/:username', async (req, res) => {
    try {
        const result = await dayaheadBLL.clearMarket(req.params.username);
        res.json(stringifyBigInt(result));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Read endpoints ─────────────────────────────────────────────────────────

/**
 * GET /blockchain-api/dayahead/mcp/:username
 * Returns the full 24-hour MCP array (×100 €/kWh strings).
 */
router.get('/mcp/:username', async (req, res) => {
    try {
        const mcp = await dayaheadBLL.getDayAheadMCP(req.params.username);
        res.json(stringifyBigInt(mcp));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /blockchain-api/dayahead/schedule/:username/:nodeAddress
 * Returns the accepted 24-hour schedule for a specific node.
 */
router.get('/schedule/:username/:nodeAddress', async (req, res) => {
    try {
        const schedule = await dayaheadBLL.getNodeSchedule(
            req.params.username, req.params.nodeAddress
        );
        res.json(stringifyBigInt(schedule));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /blockchain-api/dayahead/forecast/:username
 * Returns both the renewable and demand forecasts committed on-chain.
 */
router.get('/forecast/:username', async (req, res) => {
    try {
        const [renewable, demand] = await Promise.all([
            dayaheadBLL.getForecastRenewable(req.params.username),
            dayaheadBLL.getForecastDemand(req.params.username),
        ]);
        res.json(stringifyBigInt({ forecastRenewable: renewable, forecastDemand: demand }));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /blockchain-api/dayahead/state/:username
 * Returns biddingOpen, marketCleared, marketDay, bidderCount.
 */
router.get('/state/:username', async (req, res) => {
    try {
        const state = await dayaheadBLL.getMarketState(req.params.username);
        res.json(stringifyBigInt(state));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /blockchain-api/dayahead/dashboard/:username
 * Aggregates MCP + forecast + state in one response for the frontend.
 */
router.get('/dashboard/:username', async (req, res) => {
    try {
        const data = await dayaheadBLL.getDashboardData(req.params.username);
        res.json(stringifyBigInt(data));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
