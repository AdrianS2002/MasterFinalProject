// const ethers = require("ethers");
// const nodeDAO = require("../eth-dao/node-dao");

// // Coeficienți pentru penalizare (ajustați după caz)
// const ALPHA = 5;  // Penalizare pentru consum peste capacitate
// const BETA = 3;   // Penalizare pentru depășirea flexibilității
// const GAMMA = 2;  // Penalizare pentru neutilizarea energiei regenerabile

// async function c(username) {
//     try {
//         // 1️⃣ Obținem datele nodului
//         let { contractAddress } = await getNodeContractForUser(username);
//         let position = await nodeDAO.getPosition(contractAddress);
//         let bestPosition = await nodeDAO.getPersonalBestPosition(contractAddress);
//         let capacity = await nodeDAO.getCapacity(contractAddress);
//         let renewable = await nodeDAO.getRenewableGeneration(contractAddress);
//         let flexibilityAbove = await nodeDAO.getFlexibilityAbove(contractAddress);
//         let flexibilityBelow = await nodeDAO.getFlexibilityBelow(contractAddress);

//         let totalPenalty = 0;
//         let hourlyPenalties = [];

//         for (let i = 0; i < position.length; i++) {
//             let consumption = position[i];
//             let bestConsumption = bestPosition[i];
//             let maxCapacity = capacity[i];
//             let maxRenewable = renewable[i];
//             let maxFlexibility = flexibilityAbove[i] + flexibilityBelow[i];

//             // 2️⃣ Calculăm penalizările
//             let overConsumption = Math.max(0, consumption - maxCapacity);
//             let flexibilityViolation = Math.max(0, Math.abs(consumption - bestConsumption) - maxFlexibility);
//             let unusedRenewable = Math.max(0, maxRenewable - consumption);

//             // 3️⃣ Aplicăm coeficienții de penalizare
//             let penalty = (overConsumption * ALPHA) + (flexibilityViolation * BETA) + (unusedRenewable * GAMMA);
//             hourlyPenalties.push(penalty);
//             totalPenalty += penalty;
//         }

//         return { totalPenalty, hourlyPenalties };
//     } catch (e) {
//         console.error("Error calculating penalties:", e);
//         throw e;
//     }
// }

// module.exports = {
//     calculateNodePenalty
// };
