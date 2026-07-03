/**
 * dayahead-bll.js
 * ───────────────
 * Business Logic Layer for Day-Ahead market operations.
 * Resolves the DayAheadMarket contract address from the DB,
 * then delegates to dayahead-dao.js for on-chain calls.
 */

const dayaheadDAO      = require('../eth-dao/dayahead-dao');
const { QueryContractByTypeAndOwner } = require('../db-dao/contracts-dao');
const { ContractType } = require('../models/enums');
const EthErrors        = require('../models/eth-errors');


/**
 * Opens DA bidding for the next day by committing the LSTM forecast on-chain.
 * @param {string}   username   Owner/operator username (maps to Ethereum address).
 * @param {number[]} renewable  24-element ×100 kWh forecast (from data_pipeline.py).
 * @param {number[]} demand     24-element ×100 kWh forecast.
 */
async function openBidding(username, renewable, demand) {
    const contract = await QueryContractByTypeAndOwner(ContractType.DAYAHEAD, username);
    return dayaheadDAO.openBidding(contract.address, username, renewable, demand);
}

/**
 * Submits a 24-hour bid for a prosumer node.
 * @param {string}   username   Node owner.
 * @param {number[]} quantity   24 values ×100 kWh.
 * @param {number[]} price      24 bid prices ×100 €/kWh.
 */
async function submitBid(username, quantity, price) {
    const contract = await QueryContractByTypeAndOwner(ContractType.DAYAHEAD, username);
    return dayaheadDAO.submitBid(contract.address, username, quantity, price);
}

/**
 * Clears the DA market (runs merit-order clearing on-chain).
 * Must be called after the bid window closes.
 * @param {string} username Operator username.
 */
async function clearMarket(username) {
    const contract = await QueryContractByTypeAndOwner(ContractType.DAYAHEAD, username);
    return dayaheadDAO.clearMarket(contract.address, username);
}

/**
 * Returns the full 24-hour DA MCP array.
 */
async function getDayAheadMCP(username) {
    const contract = await QueryContractByTypeAndOwner(ContractType.DAYAHEAD, username);
    return dayaheadDAO.getDayAheadMCP(contract.address);
}

/**
 * Returns the DA schedule for a specific node address.
 */
async function getNodeSchedule(username, nodeAddress) {
    const contract = await QueryContractByTypeAndOwner(ContractType.DAYAHEAD, username);
    return dayaheadDAO.getNodeSchedule(contract.address, nodeAddress);
}

/**
 * Returns the renewable generation forecast committed on-chain.
 */
async function getForecastRenewable(username) {
    const contract = await QueryContractByTypeAndOwner(ContractType.DAYAHEAD, username);
    return dayaheadDAO.getForecastRenewable(contract.address);
}

/**
 * Returns the demand forecast committed on-chain.
 */
async function getForecastDemand(username) {
    const contract = await QueryContractByTypeAndOwner(ContractType.DAYAHEAD, username);
    return dayaheadDAO.getForecastDemand(contract.address);
}

/**
 * Returns the current market state (bidding open, cleared, bidder count, etc.).
 */
async function getMarketState(username) {
    const contract = await QueryContractByTypeAndOwner(ContractType.DAYAHEAD, username);
    return dayaheadDAO.getMarketState(contract.address);
}

/**
 * Convenience: returns MCP + forecast + market state in a single call.
 * Used by the frontend dashboard to load all DA data at once.
 */
async function getDashboardData(username) {
    const contract = await QueryContractByTypeAndOwner(ContractType.DAYAHEAD, username);
    const addr     = contract.address;

    const [mcp, renewable, demand, state] = await Promise.all([
        dayaheadDAO.getDayAheadMCP(addr),
        dayaheadDAO.getForecastRenewable(addr),
        dayaheadDAO.getForecastDemand(addr),
        dayaheadDAO.getMarketState(addr),
    ]);

    return { mcp, forecastRenewable: renewable, forecastDemand: demand, state };
}

module.exports = {
    openBidding,
    submitBid,
    clearMarket,
    getDayAheadMCP,
    getNodeSchedule,
    getForecastRenewable,
    getForecastDemand,
    getMarketState,
    getDashboardData,
};
