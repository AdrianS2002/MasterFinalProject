/**
 * intraday-routes.js
 * ──────────────────
 * Express routes for the Intra-Day energy market.
 * Mounted at /blockchain-api/intraday in app.js.
 */

const express      = require('express');
const router       = express.Router();
const intradayBLL  = require('../../eth-business/intraday-bll');

function stringifyBigInt(obj) {
    return JSON.parse(
        JSON.stringify(obj, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
        )
    );
}

// ── Write endpoints ────────────────────────────────────────────────────────

/**
 * POST /blockchain-api/intraday/update-interval/:username
 * Body:
 * {
 *   intervalIndex: number,     0-95
 *   newMCP: number,            ×100 €/kWh
 *   aggregateAdj: number,      ×100 kWh
 *   nodeAddresses: string[],
 *   nodeDeviations: number[]   ×100 kWh
 * }
 * Records the PSO result for one 15-minute slot.
 */
router.post('/update-interval/:username', async (req, res) => {
    try {
        const { intervalIndex, newMCP, aggregateAdj, nodeAddresses, nodeDeviations } = req.body;
        if (
            typeof intervalIndex  !== 'number' || intervalIndex < 0 || intervalIndex > 95 ||
            typeof newMCP         !== 'number' ||
            typeof aggregateAdj   !== 'number' ||
            !Array.isArray(nodeAddresses) ||
            !Array.isArray(nodeDeviations) ||
            nodeAddresses.length  !== nodeDeviations.length
        ) {
            return res.status(400).json({ error: 'Invalid request body' });
        }
        const result = await intradayBLL.updateInterval(
            req.params.username,
            intervalIndex, newMCP, aggregateAdj,
            nodeAddresses, nodeDeviations
        );
        res.json(stringifyBigInt(result));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /blockchain-api/intraday/renewable-forecast/:username
 * Body: { forecast: number[96] }
 * Updates the 96-slot renewable generation forecast.
 */
router.post('/renewable-forecast/:username', async (req, res) => {
    try {
        const { forecast } = req.body;
        if (!Array.isArray(forecast) || forecast.length !== 96) {
            return res.status(400).json({ error: 'forecast must be a 96-element array' });
        }
        const result = await intradayBLL.updateRenewableForecast(req.params.username, forecast);
        res.json(stringifyBigInt(result));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /blockchain-api/intraday/penalties/:username
 * Body: { positive: number, negative: number }
 * Adjusts imbalance penalty coefficients.
 */
router.post('/penalties/:username', async (req, res) => {
    try {
        const { positive, negative } = req.body;
        if (typeof positive !== 'number' || typeof negative !== 'number' ||
            positive < 0 || negative < 0) {
            return res.status(400).json({ error: 'positive and negative must be non-negative numbers' });
        }
        const result = await intradayBLL.setPenalties(req.params.username, positive, negative);
        res.json(stringifyBigInt(result));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Read endpoints ─────────────────────────────────────────────────────────

/**
 * GET /blockchain-api/intraday/mcp/:username
 * Returns the full 96-slot intraday MCP array.
 */
router.get('/mcp/:username', async (req, res) => {
    try {
        const mcp = await intradayBLL.getIntradayMCPFull(req.params.username);
        res.json(stringifyBigInt(mcp));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /blockchain-api/intraday/deviation/:username/:nodeAddress/:interval
 * Returns the deviation of a node from its DA schedule for a given interval.
 */
router.get('/deviation/:username/:nodeAddress/:interval', async (req, res) => {
    try {
        const interval = parseInt(req.params.interval, 10);
        if (isNaN(interval) || interval < 0 || interval > 95) {
            return res.status(400).json({ error: 'interval must be 0-95' });
        }
        const dev = await intradayBLL.getDeviation(
            req.params.username, req.params.nodeAddress, interval
        );
        res.json(stringifyBigInt({ deviation: dev }));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /blockchain-api/intraday/imbalance-cost/:username/:nodeAddress
 * Query params: from (default 0), to (default 95)
 * Returns the total imbalance cost for a node over a range of intervals.
 */
router.get('/imbalance-cost/:username/:nodeAddress', async (req, res) => {
    try {
        const fromSlot = parseInt(req.query.from || '0',  10);
        const toSlot   = parseInt(req.query.to   || '95', 10);
        if (fromSlot < 0 || toSlot > 95 || fromSlot > toSlot) {
            return res.status(400).json({ error: 'Invalid from/to range (0-95)' });
        }
        const cost = await intradayBLL.computeImbalanceCost(
            req.params.username, req.params.nodeAddress, fromSlot, toSlot
        );
        res.json(stringifyBigInt({ imbalanceCost: cost }));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /blockchain-api/intraday/renewable-forecast/:username
 * Returns the 96-slot renewable forecast stored on-chain.
 */
router.get('/renewable-forecast/:username', async (req, res) => {
    try {
        const forecast = await intradayBLL.getRenewableForecast15min(req.params.username);
        res.json(stringifyBigInt(forecast));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /blockchain-api/intraday/state/:username
 * Returns market state: currentInterval, lastUpdateBlock, penaltyPositive/Negative.
 */
router.get('/state/:username', async (req, res) => {
    try {
        const state = await intradayBLL.getMarketState(req.params.username);
        res.json(stringifyBigInt(state));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /blockchain-api/intraday/dashboard/:username
 * Aggregates MCP + renewable forecast + state in one response.
 */
router.get('/dashboard/:username', async (req, res) => {
    try {
        const data = await intradayBLL.getDashboardData(req.params.username);
        res.json(stringifyBigInt(data));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
