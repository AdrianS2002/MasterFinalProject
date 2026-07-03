/**
 * dayahead-dao.js
 * ───────────────
 * DAO (Data Access Object) for the DayAheadMarket smart contract.
 * Wraps all ABI calls with error handling consistent with the rest of the codebase.
 *
 * ABI is loaded from the Hardhat artifact produced by `npx hardhat compile`.
 */

const { ethers }         = require('hardhat');
const { getSignerForUser, provider } = require('../utils/commons');
const EthErrors          = require('../models/eth-errors');

// Load artifact (must run `npx hardhat compile` first)
const artifact = require('../../artifacts/contracts/DayAheadMarket.sol/DayAheadMarket.json');
const abi      = artifact.abi;

const CONTRACT = 'DayAheadMarket';


// ── Write functions (require signer / gas) ─────────────────────────────────

/**
 * Opens DA bidding for the next day and commits the LSTM forecast on-chain.
 * @param {string}   contractAddress  Deployed DayAheadMarket address.
 * @param {string}   ownerAddress     Operator account (must be contract.operator).
 * @param {number[]} renewable        24-element array ×100 kWh (integer).
 * @param {number[]} demand           24-element array ×100 kWh (integer).
 */
async function openBidding(contractAddress, ownerAddress, renewable, demand) {
    const signer   = await getSignerForUser(ownerAddress);
    const contract = new ethers.Contract(contractAddress, abi, signer);
    try {
        const tx = await contract.openBidding(renewable, demand);
        await tx.wait();
        return tx;
    } catch (e) {
        console.error('[DayAheadDAO] openBidding:', e);
        throw new EthErrors.MethodCallError(CONTRACT, 'openBidding', e.message);
    }
}

/**
 * Submits a 24-hour bid on behalf of a prosumer node.
 * @param {string}   contractAddress
 * @param {string}   nodeOwnerAddress  Account that owns the node (msg.sender in Solidity).
 * @param {number[]} quantity          24 values ×100 kWh; positive=consume, negative=inject.
 * @param {number[]} price             24 values ×100 €/kWh bid prices.
 */
async function submitBid(contractAddress, nodeOwnerAddress, quantity, price) {
    const signer   = await getSignerForUser(nodeOwnerAddress);
    const contract = new ethers.Contract(contractAddress, abi, signer);
    try {
        const tx = await contract.submitBid(quantity, price);
        await tx.wait();
        return tx;
    } catch (e) {
        console.error('[DayAheadDAO] submitBid:', e);
        throw new EthErrors.MethodCallError(CONTRACT, 'submitBid', e.message);
    }
}

/**
 * Clears the DA market (runs merit-order algorithm on-chain).
 * Only the operator can call this.
 */
async function clearMarket(contractAddress, ownerAddress) {
    const signer   = await getSignerForUser(ownerAddress);
    const contract = new ethers.Contract(contractAddress, abi, signer);
    try {
        const tx = await contract.clearMarket();
        await tx.wait();
        return tx;
    } catch (e) {
        console.error('[DayAheadDAO] clearMarket:', e);
        throw new EthErrors.MethodCallError(CONTRACT, 'clearMarket', e.message);
    }
}


// ── Read functions (no gas, use shared provider) ───────────────────────────

/**
 * Returns the full 24-element MCP array (×100 €/kWh).
 */
async function getDayAheadMCP(contractAddress) {
    const contract = new ethers.Contract(contractAddress, abi, provider);
    try {
        const mcp = await contract.getDayAheadMCP();
        return mcp.map(v => v.toString());
    } catch (e) {
        console.error('[DayAheadDAO] getDayAheadMCP:', e);
        throw new EthErrors.MethodCallError(CONTRACT, 'getDayAheadMCP', e.message);
    }
}

/**
 * Returns a node's accepted 24-hour schedule (×100 kWh).
 */
async function getNodeSchedule(contractAddress, nodeAddress) {
    const contract = new ethers.Contract(contractAddress, abi, provider);
    try {
        const schedule = await contract.getNodeSchedule(nodeAddress);
        return schedule.map(v => v.toString());
    } catch (e) {
        console.error('[DayAheadDAO] getNodeSchedule:', e);
        throw new EthErrors.MethodCallError(CONTRACT, 'getNodeSchedule', e.message);
    }
}

/**
 * Returns the LSTM renewable generation forecast stored on-chain (×100 kWh).
 */
async function getForecastRenewable(contractAddress) {
    const contract = new ethers.Contract(contractAddress, abi, provider);
    try {
        const fc = await contract.getForecastRenewable();
        return fc.map(v => v.toString());
    } catch (e) {
        console.error('[DayAheadDAO] getForecastRenewable:', e);
        throw new EthErrors.MethodCallError(CONTRACT, 'getForecastRenewable', e.message);
    }
}

/**
 * Returns the LSTM demand forecast stored on-chain (×100 kWh).
 */
async function getForecastDemand(contractAddress) {
    const contract = new ethers.Contract(contractAddress, abi, provider);
    try {
        const fc = await contract.getForecastDemand();
        return fc.map(v => v.toString());
    } catch (e) {
        console.error('[DayAheadDAO] getForecastDemand:', e);
        throw new EthErrors.MethodCallError(CONTRACT, 'getForecastDemand', e.message);
    }
}

/**
 * Returns the number of bids submitted in the current session.
 */
async function getBidderCount(contractAddress) {
    const contract = new ethers.Contract(contractAddress, abi, provider);
    try {
        const count = await contract.getBidderCount();
        return count.toString();
    } catch (e) {
        console.error('[DayAheadDAO] getBidderCount:', e);
        throw new EthErrors.MethodCallError(CONTRACT, 'getBidderCount', e.message);
    }
}

/**
 * Returns the MCP for a single hour.
 */
async function getMCPForHour(contractAddress, hour) {
    const contract = new ethers.Contract(contractAddress, abi, provider);
    try {
        const mcp = await contract.getMCPForHour(hour);
        return mcp.toString();
    } catch (e) {
        console.error('[DayAheadDAO] getMCPForHour:', e);
        throw new EthErrors.MethodCallError(CONTRACT, 'getMCPForHour', e.message);
    }
}

/**
 * Returns basic market state flags.
 */
async function getMarketState(contractAddress) {
    const contract = new ethers.Contract(contractAddress, abi, provider);
    try {
        const [biddingOpen, marketCleared, marketDay, bidderCount] = await Promise.all([
            contract.biddingOpen(),
            contract.marketCleared(),
            contract.marketDay(),
            contract.getBidderCount(),
        ]);
        return {
            biddingOpen:   biddingOpen,
            marketCleared: marketCleared,
            marketDay:     marketDay.toString(),
            bidderCount:   bidderCount.toString(),
        };
    } catch (e) {
        console.error('[DayAheadDAO] getMarketState:', e);
        throw new EthErrors.MethodCallError(CONTRACT, 'getMarketState', e.message);
    }
}

module.exports = {
    openBidding,
    submitBid,
    clearMarket,
    getDayAheadMCP,
    getNodeSchedule,
    getForecastRenewable,
    getForecastDemand,
    getBidderCount,
    getMCPForHour,
    getMarketState,
};