let enums = require('../models/enums');
let nodeDAO = require('../eth-dao/node-dao');
let accountDao = require('../db-dao/accounts-dao.js');
let contractDao = require('../db-dao/contracts-dao.js');
const globalContractService = require('./global-bll');

//Funcție auxiliară pentru a obține contractul Node asociat unui utilizator
async function getNodeContractForUser(username) {
    console.log(`🔎 Looking for account by username: ${username}`);
    let account = await accountDao.QueryAccountAddressByUsername(username);
    console.log("📥 Account result:", account);

    if (!account || !account.address) {
        throw new Error(`⚠️ No account found for username: ${username}`);
    }

    console.log(`🔎 Looking for Node contract for address: ${account.address}`);
    let contract = await contractDao.QueryContractByTypeAndOwner(enums.ContractType.NODE, account.address);
    console.log("📥 Contract query result:", contract);

    if (!contract || !contract.address) {
        throw new Error(`⚠️ No Node contract found for user: ${username}`);
    }

    console.log("✅ Found Node Contract:", contract.address);
    return { contractAddress: contract.address, ownerAddress: account.address };
}



//Actualizează viteza și poziția pentru un nod (doar dacă timestamp-ul global s-a schimbat)
async function updateVelocityAndPosition(username, global_contract_address) {
    try {
        let { contractAddress, ownerAddress } = await getNodeContractForUser(username);

        // Obținem timestamp-urile pentru sincronizare
        let lastKnownGlobalTimestamp = await nodeDAO.getLastKnownGlobalTimestamp(contractAddress);
        let lastUpdatedTimestamp = await globalContractService.getLastUpdatedTimestamp(global_contract_address);

        if (lastUpdatedTimestamp <= lastKnownGlobalTimestamp) {
            console.log(`⚠️ No new update for ${username}, skipping updateVelocityAndPosition.`);
            return { message: "No update needed", lastKnownGlobalTimestamp, lastUpdatedTimestamp };
        }

        let tx = await nodeDAO.updateVelocityAndPosition(contractAddress, ownerAddress);
        return Promise.resolve({ transaction: tx });
    } catch (e) {
        return Promise.reject(e);
    }
}

// Obține poziția curentă a unui nod
async function getPosition(username) {
    console.log(`➡️  getPosition called with username: ${username}`);
    try {
        let { contractAddress } = await getNodeContractForUser(username);
        console.log(`✅ Contract address found for ${username}: ${contractAddress}`);
        let positionData = await nodeDAO.getPosition(contractAddress);
        console.log("📊 Fetched position from DAO:", positionData);
        return positionData;
    } catch (e) {
        console.error("❌ Error in getPosition:", e);
        return Promise.reject(e);
    }
}


async function getUsedRenewablePlan(username) {
    try{
        let { contractAddress } = await getNodeContractForUser(username);
        let usedRenewablePlan = await nodeDAO.getUsedRenewablePlan(contractAddress);
        console.log("RENEWABLE USEDDDDD:", usedRenewablePlan);
        return usedRenewablePlan;
    }
    catch (e) {
        console.error("❌ Error in getUsedRenewablePlan:", e);
        return Promise.reject(e);
    }
}



// Obține timestamp-ul global cunoscut de nod
async function getLastKnownGlobalTimestamp(username) {
    try {
        let { contractAddress } = await getNodeContractForUser(username);
        let timestamp = await nodeDAO.getLastKnownGlobalTimestamp(contractAddress);
        return Promise.resolve({ timestamp });
    } catch (e) {
        return Promise.reject(e);
    }
}

// Obține cel mai bun scor personal al unui nod
async function getPersonalBestScore(username) {
    try {
        let { contractAddress } = await getNodeContractForUser(username);
        let score = await nodeDAO.getPersonalBestScore(contractAddress);
        return Promise.resolve({ score });
    } catch (e) {
        return Promise.reject(e);
    }
}

// Obține cea mai bună poziție personală a unui nod
async function getPersonalBestPosition(username) {
    try {
        let { contractAddress } = await getNodeContractForUser(username);
        let position = await nodeDAO.getPersonalBestPosition(contractAddress);
        return Promise.resolve({ position });
    } catch (e) {
        return Promise.reject(e);
    }
}

// Actualizează cea mai bună poziție a unui nod și o trimite la Global Contract
async function updateBestPositions(username) {
    try {
        let { contractAddress, ownerAddress } = await getNodeContractForUser(username);
        let tx = await nodeDAO.updateBestPositions(contractAddress, ownerAddress);
        return Promise.resolve({ transaction: tx });
    } catch (e) {
        return Promise.reject(e);
    }
}

// POATE TREBUIE SA EVIN LA ASTA  Obține rezultatul funcției obiectiv pentru un nod
// async function getObjectiveFunctionResult(username) {
//     try {
//         let { contractAddress } = await getNodeContractForUser(username);
//         let result = await nodeDAO.getObjectiveFunctionResult(contractAddress);
//         return Promise.resolve({ result });
//     } catch (e) {
//         return Promise.reject(e);
//     }
// }


// Obține frozen cost (costul înghețat al nodului)
async function getFrozenCost(username) {
    try {
        let { contractAddress } = await getNodeContractForUser(username);
        console.log("🧪 Contract address for getFrozenCost:", contractAddress);

        let frozenCost = await nodeDAO.getFrozenCost(contractAddress);
        console.log("🧊 Frozen cost from contract:", frozenCost);

        return Promise.resolve({ frozenCost });
    } catch (e) {
        console.error("❌ Error in getFrozenCost BLL:", e);
        return Promise.reject(e);
    }
}


async function getObjectiveFunctionResult(username) {
    try {
        let { contractAddress } = await getNodeContractForUser(username);
        let positionObj = await nodeDAO.getPosition(contractAddress);
        let result = await nodeDAO.getObjectiveFunctionResult(contractAddress, Array.from(positionObj.position));
        return Promise.resolve({ result });
    } catch (e) {
        return Promise.reject(e);
    }
}

// async function getNodePenalty(username) {
//     try {
//         let penaltyData = await calculateNodePenalty(username);
//         return Promise.resolve(penaltyData);
//     } catch (e) {
//         return Promise.reject(e);
//     }
// }

async function getEffectiveTariff(username, hour, consumption) {
    try {
        let { contractAddress } = await getNodeContractForUser(username);
        let effectiveTariff = await nodeDAO.getEffectiveTariff(contractAddress, hour, consumption);
        return Promise.resolve({ effectiveTariff });
    } catch (e) {
        return Promise.reject(e);
    }
}

async function getTariff(username) {
    try {
        const { contractAddress } = await getNodeContractForUser(username);
        console.log("📦 [getTariff] Contract address for", username, ":", contractAddress);

        const result = await nodeDAO.getTariff(contractAddress);
        console.log("📊 Tariff data:", result);

        return Promise.resolve({ tariff: result });
    } catch (e) {
        console.error("❌ Error in getTariff:", e);
        return Promise.reject(e);
    }
}


async function getCapacity(username) {
    try {
        const { contractAddress } = await getNodeContractForUser(username);
        const result = await nodeDAO.getCapacity(contractAddress);
        return Promise.resolve({ capacity: result });
    }
    catch (e) {
        console.error("❌ Error in getCapacity:", e);
        return Promise.reject(e);
    }
}

async function getBatteryCharge(username) {
    try {
        let { contractAddress } = await getNodeContractForUser(username);
        let result = await nodeDAO.getBatteryCharge(contractAddress);
        return Promise.resolve(result);
    }
    catch (e) {
        console.error("❌ Error in getBatteryCharge:", e);
        return Promise.reject(e);
    }
}

async function getBatteryCapacity(username) {
    try{
        const { contractAddress } = await getNodeContractForUser(username);
        const result = await nodeDAO.getBatteryCapacity(contractAddress);
        return Promise.resolve({ batteryCapacity: result });
    }
    catch (e) {
        console.error("❌ Error in getBatteryCapacity:", e);
        return Promise.reject(e);
    }
}

async function getRenewableGeneration(username) {
    try {
      console.log(`🔍 [BLL] Looking for contract for user: ${username}`);
      const { contractAddress } = await getNodeContractForUser(username);
      console.log(`✅ [BLL] Contract address for renewableGeneration: ${contractAddress}`);
  
      const result = await nodeDAO.getRenewableGeneration(contractAddress);
      console.log("📈 [BLL] Renewable generation from DAO:", result);
  
      return Promise.resolve({ renewableGeneration: result });
    } catch (e) {
      console.error("❌ [BLL] Error in getRenewableGeneration:", e);
      return Promise.reject(e);
    }
  }
  

async function getFlexibilityAbove(username) {
   try{
        let { contractAddress } = await getNodeContractForUser(username);
        let result = await nodeDAO.getFlexibilityAbove(contractAddress);
        return Promise.resolve(result);
    }
    catch (e) {
        console.error("❌ Error in getFlexibilityAbove:", e);
        return Promise.reject(e);
    }
}

async function getFlexibilityBelow(username) {
    try{
        let { contractAddress } = await getNodeContractForUser(username);
        let result = await nodeDAO.getFlexibilityBelow(contractAddress);
        return Promise.resolve(result);
    }
    catch (e) {
        console.error("❌ Error in getFlexibilityBelow:", e);
        return Promise.reject(e);
    }
}


async function getFlexibleLoad(username){
    try {
        let { contractAddress } = await getNodeContractForUser(username);
        let result = await nodeDAO.getFlexibleLoad(contractAddress);
        return Promise.resolve(result);
    } catch (e) {
        console.error("❌ Error in getFlexibleLoad:", e);
        return Promise.reject(e);
    }
}

async function getFrozenEnergyBreakdown(username) {
    try {
        let { contractAddress } = await getNodeContractForUser(username);
        console.log("📦 [getFrozenEnergyBreakdown] Contract address for", username, ":", contractAddress);

        const result = await nodeDAO.getFrozenEnergyBreakdown(contractAddress);
        console.log("📊 Frozen energy breakdown:", result);

        return Promise.resolve({ breakdown: result });
    } catch (e) {
        console.error("❌ Error in getFrozenEnergyBreakdown:", e);
        return Promise.reject(e);
    }
}



module.exports = {
    updateVelocityAndPosition,
    getPosition,
    getLastKnownGlobalTimestamp,
    getPersonalBestScore,
    getPersonalBestPosition,
    updateBestPositions,
    getObjectiveFunctionResult,
    getFrozenCost,
    getEffectiveTariff,
    // getNodePenalty
    getTariff,
    getUsedRenewablePlan,
    getCapacity,
    getBatteryCharge,
    getBatteryCapacity,
    getRenewableGeneration,
    getFlexibilityAbove,
    getFlexibleLoad,
    getFlexibilityBelow,
    getFrozenEnergyBreakdown
};
