const abi = require('../../artifacts/contracts/GlobalContract.sol/GlobalContract.json').abi;
const bin_data = require('../../artifacts/contracts/GlobalContract.sol/GlobalContract.json').bytecode;

let ErrorHandling = require('../models/error-handling');
const { getSignerForUser } = require('../utils/commons');
let EthErrors = require('../models/eth-errors.js');
const { ethers } = require("hardhat");
const { provider } = require('../utils/commons.js');



// Funcție pentru a calcula planul global optim.
// Necesită o semnătură (signer), deoarece se trimite o tranzacție.
async function computeGlobalOptimalPlan(contract_address, ownerAddress) {
    const signer = await getSignerForUser(ownerAddress);
    const contract = new ethers.Contract(contract_address, abi, signer);
    try {
        let tx = await contract.computeGlobalOptimalPlan();
        await tx.wait();
        return tx;
    } catch (e) {
        console.log(e);
        return new EthErrors.MethodCallError("GlobalContract", "computeGlobalOptimalPlan", "computeGlobalOptimalPlan");
    }
}

async function getGlobalPlanHistory(contractAddress, fromBlock = 0, toBlock = "latest") {
    const contract = new ethers.Contract(contractAddress, abi, provider);

    try {
        const filter = contract.filters.GlobalPlanComputed();
        const events = await contract.queryFilter(filter, fromBlock, toBlock);
        
        return events.map(e => ({
            plan: e.args.newPlan.map(v => v.toString()),
            timestamp: e.args.timestamp.toString(),
            blockNumber: e.blockNumber,
            txHash: e.transactionHash
        }));
    } catch (err) {
        console.error("❌ Error fetching GlobalPlanComputed events:", err);
        throw new Error("Could not retrieve event history");
    }
}


// Funcție pentru a obține valoarea planului global pentru o anumită oră.
async function getGlobalOptimalPlanHour(contract_address, hour) {
    const contract = new ethers.Contract(contract_address, abi, provider);
    try {
        let result = await contract.getGlobalOptimalPlanHour(hour);
        return { globalOptimalPlanHour: result };
    } catch (e) {
        console.log(e);
        return new EthErrors.MethodCallError("GlobalContract", "getGlobalOptimalPlanHour", "getGlobalOptimalPlanHour");
    }
}

// Funcție pentru a obține planul global complet sub formă de array.
async function getGlobalOptimalPlanArray(contract_address) {
    const contract = new ethers.Contract(contract_address, abi, provider);
    try {
        let result = await contract.getGlobalOptimalPlanArray();
        return { globalOptimalPlanArray: result };
    } catch (e) {
        console.log(e);
        return new EthErrors.MethodCallError("GlobalContract", "getGlobalOptimalPlanArray", "getGlobalOptimalPlanArray");
    }
}

// Funcție pentru a obține timestamp-ul global actualizat din contractul global
async function getLastUpdatedTimestamp(contract_address) {
    const contract = new ethers.Contract(contract_address, abi, provider);
    try {
        let result = await contract.getLastUpdatedTimestamp();
        return { lastUpdatedTimestamp: result };
    } catch (e) {
        console.log(e);
        return new EthErrors.MethodCallError("GlobalContract", "getLastUpdatedTimestamp", "getLastUpdatedTimestamp");
    }
}


// Funcție pentru a actualiza rezultatul unui nod în contract.
// Necesită o semnătură (signer) deoarece se trimite o tranzacție.
async function updateNodeResult(contract_address, newPosition, newScore, newFlexibilityWeight, ownerAddress) {
    const signer = await getSignerForUser(ownerAddress);
    const contract = new ethers.Contract(contract_address, abi, signer);
    try {
        let tx = await contract.updateNodeResult(newPosition, newScore, newFlexibilityWeight);
        await tx.wait();
        return tx;
    } catch (e) {
        console.log(e);
        return new EthErrors.MethodCallError("GlobalContract", "updateNodeResult", "updateNodeResult");
    }
}

// Funcție pentru a obține poziția optimă a unui nod specific din contract.
async function getBestPosition(contract_address, nodeAddress) {
    const contract = new ethers.Contract(contract_address, abi, provider);
    try {
        let result = await contract.getBestPosition(nodeAddress);
        return { bestPosition: result };
    } catch (e) {
        console.log(e);
        return new EthErrors.MethodCallError("GlobalContract", "getBestPosition", "getBestPosition");
    }
}

async function getFrozenGlobalCost(contract_address) {
    const contract = new ethers.Contract(contract_address, abi, provider);
    try {
      let result = await contract.frozenGlobalCost();
      return { frozenGlobalCost: result };
    } catch (e) {
      console.log(e);
      return new EthErrors.MethodCallError("GlobalContract", "getFrozenGlobalCost", "frozenGlobalCost");
    }
  }
  
  // Funcție pentru a obține planul global optim stocat (getBestGlobalPlan)
  async function getBestGlobalPlan(contract_address) {
    const contract = new ethers.Contract(contract_address, abi, provider);
    try {
      let result = await contract.getBestGlobalPlan();
      return { bestGlobalPlan: result };
    } catch (e) {
      console.log(e);
      return new EthErrors.MethodCallError("GlobalContract", "getBestGlobalPlan", "getBestGlobalPlan");
    }
  }

  async function getNodeAddresses(contract_address) {
    const contract = new ethers.Contract(contract_address, abi, provider);
    try {
        let result = await contract.getNodeAddresses();
        return { nodeAddresses: result };
    } catch (e) {
        console.log(e);
        return new EthErrors.MethodCallError("GlobalContract", "getNodeAddresses", "getNodeAddresses");
    }
}

async function getPersonalBestScoreByAddress(contract_address, nodeAddress) {
    const contract = new ethers.Contract(contract_address, abi, provider);
    try {
      const result = await contract.nodeResults(nodeAddress);
      return { score: result.bestScore };
    } catch (e) {
      console.log(e);
      return new EthErrors.MethodCallError("GlobalContract", "getPersonalBestScoreByAddress", "nodeResults.bestScore");
    }
  }
  
  


module.exports = {
    computeGlobalOptimalPlan,
    getGlobalOptimalPlanHour,
    getGlobalOptimalPlanArray,
    getLastUpdatedTimestamp,
    updateNodeResult,
    getBestPosition,
    getFrozenGlobalCost,   
    getBestGlobalPlan,
    getGlobalPlanHistory,
    getNodeAddresses,
    getPersonalBestScoreByAddress
};
