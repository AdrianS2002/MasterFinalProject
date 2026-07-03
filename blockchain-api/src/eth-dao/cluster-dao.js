const abi = require('../../artifacts/contracts/ClusterContract.sol/ClusterContract.json').abi;
const { getSignerForUser } = require('../utils/commons');
const { ethers } = require('hardhat');
let EthErrors = require('../models/eth-errors.js');
const { provider } = require('../utils/commons.js');
 
/**
 * Triggers the intra-cluster aggregation and propagates the cluster's best plan
 * up to the parent GlobalContract.
 * Must be called BEFORE globalContract.computeGlobalOptimalPlan() whenever
 * nodes are wired to this cluster.
 */
async function computeClusterPlan(contract_address, ownerAddress) {
    const signer = await getSignerForUser(ownerAddress);
    const contract = new ethers.Contract(contract_address, abi, signer);
    try {
        const tx = await contract.computeClusterPlan();
        await tx.wait();
        return tx;
    } catch (e) {
        console.error('❌ cluster-dao.computeClusterPlan error:', e);
        return new EthErrors.MethodCallError('ClusterContract', 'computeClusterPlan', 'computeClusterPlan');
    }
}
 
async function getClusterBestPlan(contract_address) {
    const contract = new ethers.Contract(contract_address, abi, provider);
    try {
        const result = await contract.getClusterBestPlan();
        return { clusterBestPlan: result };
    } catch (e) {
        console.error('❌ cluster-dao.getClusterBestPlan error:', e);
        return new EthErrors.MethodCallError('ClusterContract', 'getClusterBestPlan', 'getClusterBestPlan');
    }
}
 
async function getNodeAddresses(contract_address) {
    const contract = new ethers.Contract(contract_address, abi, provider);
    try {
        const result = await contract.getNodeAddresses();
        return { nodeAddresses: result };
    } catch (e) {
        console.error('❌ cluster-dao.getNodeAddresses error:', e);
        return new EthErrors.MethodCallError('ClusterContract', 'getNodeAddresses', 'getNodeAddresses');
    }
}
 
async function getClusterBestCost(contract_address) {
    const contract = new ethers.Contract(contract_address, abi, provider);
    try {
        const result = await contract.clusterBestCost();
        return { clusterBestCost: result };
    } catch (e) {
        console.error('❌ cluster-dao.getClusterBestCost error:', e);
        return new EthErrors.MethodCallError('ClusterContract', 'getClusterBestCost', 'clusterBestCost');
    }
}
 
async function getLastUpdatedTimestamp(contract_address) {
    const contract = new ethers.Contract(contract_address, abi, provider);
    try {
        const result = await contract.lastUpdatedTimestamp();
        return { lastUpdatedTimestamp: result };
    } catch (e) {
        console.error('❌ cluster-dao.getLastUpdatedTimestamp error:', e);
        return new EthErrors.MethodCallError('ClusterContract', 'getLastUpdatedTimestamp', 'lastUpdatedTimestamp');
    }
}
 
module.exports = {
    computeClusterPlan,
    getClusterBestPlan,
    getNodeAddresses,
    getClusterBestCost,
    getLastUpdatedTimestamp
};