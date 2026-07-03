/**
 * intraday-dao.js
 * ───────────────
 * DAO for the IntradayMarket smart contract.
 * Provides write operations (operator functions) and read operations
 * for the 15-minute intraday market.
 */

const { ethers }         = require('hardhat');
const { getSignerForUser, provider } = require('../utils/commons');
const EthErrors          = require('../models/eth-errors');

const artifact = require('../../artifacts/contracts/IntradayMarket.sol/IntradayMarket.json');
const abi      = artifact.abi;

const CONTRACT = 'IntradayMarket';


// ── Write functions ────────────────────────────────────────────────────────

/**
 * Updates a 15-minute interval with PSO results and per-node deviations.
 * Called by the off-chain intraday PSO engine.
 *
 * @param {string}   contractAddress
 * @param {string}   ownerAddress       Operator account.
 * @param {number}   intervalIndex      0-95 slot index.
 * @param {number}   newMCP             Cleared MCP ×100 €/kWh.
 * @param {number}   aggregateAdj       PSO aggregate adjustment ×100 kWh.
 * @param {string[]} nodeAddresses      Node addresses.
 * @param {number[]} nodeDeviations     Per-node deviations ×100 kWh.
 */
async function updateInterval(
    contractAddress, ownerAddress,
    intervalIndex, newMCP, aggregateAdj,
    nodeAddresses, nodeDeviations
) {
    const signer   = await getSignerForUser(ownerAddress);
    const contract = new ethers.Contract(contractAddress, abi, signer);
    try {
        const tx = await contract.updateInterval(
            intervalIndex, newMCP, aggregateAdj, nodeAddresses, nodeDeviations
        );
        await tx.wait();
        return tx;
    } catch (e) {
        console.error('[IntradayDAO] updateInterval:', e);
        throw new EthErrors.MethodCallError(CONTRACT, 'updateInterval', e.message);
    }
}

/**
 * Commits updated 96-slot renewable forecast when new weather data arrives.
 * @param {string}   contractAddress
 * @param {string}   ownerAddress
 * @param {number[]} forecast  96-element array ×100 kWh.
 */
async function updateRenewableForecast(contractAddress, ownerAddress, forecast) {
    const signer   = await getSignerForUser(ownerAddress);
    const contract = new ethers.Contract(contractAddress, abi, signer);
    try {
        const tx = await contract.updateRenewableForecast(forecast);
        await tx.wait();
        return tx;
    } catch (e) {
        console.error('[IntradayDAO] updateRenewableForecast:', e);
        throw new EthErrors.MethodCallError(CONTRACT, 'updateRenewableForecast', e.message);
    }
}

/**
 * Updates imbalance penalty coefficients.
 * @param {number} positive ×100 €/kWh penalty for over-consumption.
 * @param {number} negative ×100 €/kWh rebate for under-consumption.
 */
async function setPenalties(contractAddress, ownerAddress, positive, negative) {
    const signer   = await getSignerForUser(ownerAddress);
    const contract = new ethers.Contract(contractAddress, abi, signer);
    try {
        const tx = await contract.setPenalties(positive, negative);
        await tx.wait();
        return tx;
    } catch (e) {
        console.error('[IntradayDAO] setPenalties:', e);
        throw new EthErrors.MethodCallError(CONTRACT, 'setPenalties', e.message);
    }
}


// ── Read functions ─────────────────────────────────────────────────────────

/**
 * Returns the full 96-element MCP array for today.
 */
async function getIntradayMCPFull(contractAddress) {
    const contract = new ethers.Contract(contractAddress, abi, provider);
    try {
        const mcp = await contract.getIntradayMCPFull();
        return mcp.map(v => v.toString());
    } catch (e) {
        console.error('[IntradayDAO] getIntradayMCPFull:', e);
        throw new EthErrors.MethodCallError(CONTRACT, 'getIntradayMCPFull', e.message);
    }
}

/**
 * Returns the MCP for a single 15-min interval.
 */
async function getMCPForInterval(contractAddress, interval) {
    const contract = new ethers.Contract(contractAddress, abi, provider);
    try {
        const mcp = await contract.getMCPForInterval(interval);
        return mcp.toString();
    } catch (e) {
        console.error('[IntradayDAO] getMCPForInterval:', e);
        throw new EthErrors.MethodCallError(CONTRACT, 'getMCPForInterval', e.message);
    }
}

/**
 * Returns a node's deviation from its DA schedule for a given interval.
 */
async function getDeviation(contractAddress, nodeAddress, interval) {
    const contract = new ethers.Contract(contractAddress, abi, provider);
    try {
        const dev = await contract.getDeviation(nodeAddress, interval);
        return dev.toString();
    } catch (e) {
        console.error('[IntradayDAO] getDeviation:', e);
        throw new EthErrors.MethodCallError(CONTRACT, 'getDeviation', e.message);
    }
}

/**
 * Computes the total imbalance cost for a node over a range of intervals.
 * @returns {string} Cost in ×100×100 units (divide by 10000 for €).
 */
async function computeImbalanceCost(contractAddress, nodeAddress, fromSlot, toSlot) {
    const contract = new ethers.Contract(contractAddress, abi, provider);
    try {
        const cost = await contract.computeImbalanceCost(nodeAddress, fromSlot, toSlot);
        return cost.toString();
    } catch (e) {
        console.error('[IntradayDAO] computeImbalanceCost:', e);
        throw new EthErrors.MethodCallError(CONTRACT, 'computeImbalanceCost', e.message);
    }
}

/**
 * Returns the full 96-slot renewable forecast.
 */
async function getRenewableForecast15min(contractAddress) {
    const contract = new ethers.Contract(contractAddress, abi, provider);
    try {
        const fc = await contract.getRenewableForecast15min();
        return fc.map(v => v.toString());
    } catch (e) {
        console.error('[IntradayDAO] getRenewableForecast15min:', e);
        throw new EthErrors.MethodCallError(CONTRACT, 'getRenewableForecast15min', e.message);
    }
}

/**
 * Returns basic intraday market state.
 */
async function getMarketState(contractAddress) {
    const contract = new ethers.Contract(contractAddress, abi, provider);
    try {
        const [currentInterval, lastUpdateBlock, marketDay, penaltyPos, penaltyNeg] = await Promise.all([
            contract.currentInterval(),
            contract.lastUpdateBlock(),
            contract.marketDay(),
            contract.penaltyPositive(),
            contract.penaltyNegative(),
        ]);
        return {
            currentInterval:  currentInterval.toString(),
            lastUpdateBlock:  lastUpdateBlock.toString(),
            marketDay:        marketDay.toString(),
            penaltyPositive:  penaltyPos.toString(),
            penaltyNegative:  penaltyNeg.toString(),
        };
    } catch (e) {
        console.error('[IntradayDAO] getMarketState:', e);
        throw new EthErrors.MethodCallError(CONTRACT, 'getMarketState', e.message);
    }
}

module.exports = {
    updateInterval,
    updateRenewableForecast,
    setPenalties,
    getIntradayMCPFull,
    getMCPForInterval,
    getDeviation,
    computeImbalanceCost,
    getRenewableForecast15min,
    getMarketState,
};