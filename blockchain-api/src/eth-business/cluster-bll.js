const clusterDAO = require('../eth-dao/cluster-dao');
const contractDao = require('../db-dao/contracts-dao.js');
const enums = require('../models/enums');
 
/**
 * Returns a summary of every ClusterContract registered in the DB:
 * name, address, nodeCount, clusterBestCost, lastUpdated, clusterBestPlan.
 */
async function getAllClustersSummary() {
    const clusters = await contractDao.QueryContractsByType(enums.ContractType.CLUSTER);
    console.log(`📦 [cluster-bll] Clusters found in DB (type=Cluster): ${clusters.length}`, clusters.map(c => ({ name: c.name, address: c.address })));
 
    const summaries = await Promise.all(clusters.map(async (cluster) => {
        try {
            console.log(`🔍 [cluster-bll] Fetching data for cluster: ${cluster.name} @ ${cluster.address}`);
            const [planResult, nodesResult, costResult, tsResult] = await Promise.all([
                clusterDAO.getClusterBestPlan(cluster.address),
                clusterDAO.getNodeAddresses(cluster.address),
                clusterDAO.getClusterBestCost(cluster.address),
                clusterDAO.getLastUpdatedTimestamp(cluster.address),
            ]);
 
            console.log(`✅ [cluster-bll] ${cluster.name} — nodes: ${nodesResult.nodeAddresses?.length}, cost: ${costResult.clusterBestCost}, ts: ${tsResult.lastUpdatedTimestamp}, planLen: ${planResult.clusterBestPlan?.length}`);
            return {
                name: cluster.name,
                address: cluster.address,
                nodeCount: nodesResult.nodeAddresses ? nodesResult.nodeAddresses.length : 0,
                nodeAddresses: nodesResult.nodeAddresses || [],
                clusterBestCost: costResult.clusterBestCost !== undefined
                    ? costResult.clusterBestCost.toString()
                    : null,
                lastUpdatedTimestamp: tsResult.lastUpdatedTimestamp !== undefined
                    ? tsResult.lastUpdatedTimestamp.toString()
                    : null,
                clusterBestPlan: planResult.clusterBestPlan
                    ? Array.from(planResult.clusterBestPlan).map(v => v.toString())
                    : [],
            };
        } catch (e) {
            console.error(`❌ Error fetching summary for cluster ${cluster.address}:`, e.message);
            return {
                name: cluster.name,
                address: cluster.address,
                nodeCount: 0,
                nodeAddresses: [],
                clusterBestCost: null,
                lastUpdatedTimestamp: null,
                clusterBestPlan: [],
            };
        }
    }));
 
    return summaries;
}
 
async function getClusterBestPlan(clusterAddress) {
    try {
        return await clusterDAO.getClusterBestPlan(clusterAddress);
    } catch (e) {
        return Promise.reject(e);
    }
}
 
async function getClusterNodes(clusterAddress) {
    try {
        return await clusterDAO.getNodeAddresses(clusterAddress);
    } catch (e) {
        return Promise.reject(e);
    }
}
 
module.exports = {
    getAllClustersSummary,
    getClusterBestPlan,
    getClusterNodes,
};