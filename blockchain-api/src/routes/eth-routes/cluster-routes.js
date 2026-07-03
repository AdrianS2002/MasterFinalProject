const express = require('express');
const router = express.Router();
const clusterService = require('../../eth-business/cluster-bll');
 
function stringifyBigInt(obj) {
    return JSON.parse(
        JSON.stringify(obj, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
        )
    );
}
 
// GET /blockchain-api/clusters/summary
// Returns all clusters with best plan, node count, cost, and last updated.
router.get('/summary', async (req, res) => {
    try {
        console.log('📡 [cluster-routes] GET /summary called');
        const result = await clusterService.getAllClustersSummary();
        console.log(`📡 [cluster-routes] Returning ${result.length} cluster(s)`);
        res.json(stringifyBigInt(result));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// GET /blockchain-api/clusters/:address/best-plan
router.get('/:address/best-plan', async (req, res) => {
    try {
        const result = await clusterService.getClusterBestPlan(req.params.address);
        res.json(stringifyBigInt(result));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
 
// GET /blockchain-api/clusters/:address/nodes
router.get('/:address/nodes', async (req, res) => {
    try {
        const result = await clusterService.getClusterNodes(req.params.address);
        res.json(stringifyBigInt(result));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
 
module.exports = router;