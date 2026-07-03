/**
 * intraday-bll.js
 * ───────────────
 * Business Logic Layer for Intra-Day market operations.
 * Resolves contract addresses from the DB and delegates to intraday-dao.js.
 */

const intradayDAO      = require('../eth-dao/intraday-dao');
const { QueryContractByTypeAndOwner } = require('../db-dao/contracts-dao');
const { ContractType } = require('../models/enums');


/**
 * Updates a 15-minute interval with new MCP and PSO-computed deviations.
 * @param {string}   username        Operator username.
 * @param {number}   intervalIndex   0-95 slot.
 * @param {number}   newMCP          ×100 €/kWh.
 * @param {number}   aggregateAdj    ×100 kWh.
 * @param {string[]} nodeAddresses
 * @param {number[]} nodeDeviations  ×100 kWh.
 */
async function updateInterval(username, intervalIndex, newMCP, aggregateAdj, nodeAddresses, nodeDeviations) {
    const contract = await QueryContractByTypeAndOwner(ContractType.INTRADAY, username);
    return intradayDAO.updateInterval(
        contract.address, username,
        intervalIndex, newMCP, aggregateAdj,
        nodeAddresses, nodeDeviations
    );
}

/**
 * Commits a refreshed 96-slot renewable forecast to the contract.
 * @param {string}   username
 * @param {number[]} forecast  96-element ×100 kWh array.
 */
async function updateRenewableForecast(username, forecast) {
    const contract = await QueryContractByTypeAndOwner(ContractType.INTRADAY, username);
    return intradayDAO.updateRenewableForecast(contract.address, username, forecast);
}

/**
 * Updates the imbalance penalty rates.
 */
async function setPenalties(username, positive, negative) {
    const contract = await QueryContractByTypeAndOwner(ContractType.INTRADAY, username);
    return intradayDAO.setPenalties(contract.address, username, positive, negative);
}

/**
 * Returns the full 96-slot MCP array.
 */
async function getIntradayMCPFull(username) {
    const contract = await QueryContractByTypeAndOwner(ContractType.INTRADAY, username);
    return intradayDAO.getIntradayMCPFull(contract.address);
}

/**
 * Returns a node's deviation for a specific interval.
 */
async function getDeviation(username, nodeAddress, interval) {
    const contract = await QueryContractByTypeAndOwner(ContractType.INTRADAY, username);
    return intradayDAO.getDeviation(contract.address, nodeAddress, interval);
}

/**
 * Returns imbalance cost for a node over a range of intervals.
 */
async function computeImbalanceCost(username, nodeAddress, fromSlot, toSlot) {
    const contract = await QueryContractByTypeAndOwner(ContractType.INTRADAY, username);
    return intradayDAO.computeImbalanceCost(contract.address, nodeAddress, fromSlot, toSlot);
}

/**
 * Returns the 96-slot renewable forecast stored on-chain.
 */
async function getRenewableForecast15min(username) {
    const contract = await QueryContractByTypeAndOwner(ContractType.INTRADAY, username);
    return intradayDAO.getRenewableForecast15min(contract.address);
}

/**
 * Returns general intraday market state.
 */
async function getMarketState(username) {
    const contract = await QueryContractByTypeAndOwner(ContractType.INTRADAY, username);
    return intradayDAO.getMarketState(contract.address);
}

/**
 * Convenience: loads all ID dashboard data in one call.
 */
async function getDashboardData(username) {
    const contract = await QueryContractByTypeAndOwner(ContractType.INTRADAY, username);
    const addr     = contract.address;

    const [mcp, renewable, state] = await Promise.all([
        intradayDAO.getIntradayMCPFull(addr),
        intradayDAO.getRenewableForecast15min(addr),
        intradayDAO.getMarketState(addr),
    ]);

    return { mcp, forecastRenewable15min: renewable, state };
}

module.exports = {
    updateInterval,
    updateRenewableForecast,
    setPenalties,
    getIntradayMCPFull,
    getDeviation,
    computeImbalanceCost,
    getRenewableForecast15min,
    getMarketState,
    getDashboardData,
};
