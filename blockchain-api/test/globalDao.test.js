const { expect } = require("chai");
const { ethers } = require("hardhat");

// Definim provider-ul din Hardhat
const provider = ethers.provider;

// Importăm DAO-urile pentru GlobalContract și Node
const globalDAO = require("../src/eth-dao/global-dao");
const nodeDAO = require("../src/eth-dao/node-dao");

describe("Full DAO Integration Tests", function () {
  let globalContract, nodeContract;
  let deployer, other;
  let globalAddress, nodeAddress;

  // Parametrii inițiali pentru Node (exemplu)
  const initialPosition = [80, 85, 90, 95, 100];
  const initialVelocity = [0, 0, 0, 0, 0];
  const initialTariff = [10, 10, 10, 10, 10];
  const initialCapacity = [100, 100, 100, 100, 100];
  const initialRenewableGeneration = [50, 50, 50, 50, 50];
  const initialBatteryCapacity = [20, 20, 20, 20, 20];
  const initialBatteryCharge = [10, 10, 10, 10, 10];
  const initialFlexibleLoad = [30, 30, 30, 30, 30];
  const flexibilityAbove = [5, 5, 5, 5, 5];
  const flexibilityBelow = [5, 5, 5, 5, 5];

  before(async function () {
    [deployer, other] = await ethers.getSigners();

    // Deploy GlobalContract
    const GlobalContract = await ethers.getContractFactory("GlobalContract");
    globalContract = await GlobalContract.deploy();
    await globalContract.waitForDeployment();
    globalAddress = globalContract.target || globalContract.address;
    console.log("GlobalContract deployed at:", globalAddress);

    // Deploy Node contract, folosind adresa GlobalContract
    const Node = await ethers.getContractFactory("Node");
    nodeContract = await Node.deploy(
      globalAddress,
      initialPosition,
      initialVelocity,
      initialTariff,
      initialCapacity,
      initialRenewableGeneration,
      initialBatteryCapacity,
      initialBatteryCharge,
      initialFlexibleLoad,
      flexibilityAbove,
      flexibilityBelow
    );
    await nodeContract.waitForDeployment();
    nodeAddress = nodeContract.target || nodeContract.address;
    console.log("Node contract deployed at:", nodeAddress);
  });

  describe("Global DAO Tests", function () {
    it("should update node result", async function () {
      // Update node result: folosește adresa deployer ca exemplu de nod
      const tx = await globalDAO.updateNodeResult(
        globalAddress,
        initialPosition,
        11250,  // cost exemplu
        flexibilityAbove,
        deployer.address
      );
      expect(tx).to.exist;
    });

    it("should compute global optimal plan and update lastUpdatedTimestamp", async function () {
      const txCompute = await globalDAO.computeGlobalOptimalPlan(globalAddress, deployer.address);
      expect(txCompute).to.exist;

      const tsObj = await globalDAO.getLastUpdatedTimestamp(globalAddress);
      expect(Number(tsObj.lastUpdatedTimestamp)).to.be.gt(0);
      console.log("Last updated timestamp:", tsObj.lastUpdatedTimestamp.toString());
    });

    it("should return global optimal plan array", async function () {
      const planArrayObj = await globalDAO.getGlobalOptimalPlanArray(globalAddress);
      expect(planArrayObj.globalOptimalPlanArray).to.be.an("array");
      console.log("Global optimal plan array:", planArrayObj.globalOptimalPlanArray.map(x => x.toString()));
    });

    it("should return global optimal plan for a given hour", async function () {
      // Testăm pentru ora 2 (index 2) – asigură-te că numărul de ore este cel puțin 3.
      const planHourObj = await globalDAO.getGlobalOptimalPlanHour(globalAddress, 2);
      expect(planHourObj.globalOptimalPlanHour).to.exist;
      console.log("Global optimal plan at hour 2:", planHourObj.globalOptimalPlanHour.toString());
    });

    it("should return best position for a given node", async function () {
      const bestPosObj = await globalDAO.getBestPosition(globalAddress, deployer.address);
      expect(bestPosObj.bestPosition).to.be.an("array");
      console.log("Best position for node", deployer.address, ":", bestPosObj.bestPosition.map(x => x.toString()));
    });

    it("should finalize global plan and return frozen global cost", async function () {
      await globalDAO.computeGlobalOptimalPlan(globalAddress, deployer.address);
      await globalContract.finalizePlan();
      const frozenCostObj = await globalDAO.getFrozenGlobalCost(globalAddress);
      expect(frozenCostObj.frozenGlobalCost).to.exist;
      console.log("Frozen global cost:", frozenCostObj.frozenGlobalCost.toString());
    });

    it("should return best global plan (stored)", async function () {
      const bestPlanObj = await globalDAO.getBestGlobalPlan(globalAddress);
      expect(bestPlanObj.bestGlobalPlan).to.be.an("array");
      console.log("Best global plan:", bestPlanObj.bestGlobalPlan.map(x => x.toString()));
    });
  });

  describe("Node DAO Tests", function () {
    it("should return initial node position", async function () {
      const posObj = await nodeDAO.getPosition(nodeAddress);
      expect(posObj.position.map(x => x.toString())).to.deep.equal(initialPosition.map(String));
      console.log("Initial node position:", posObj.position.map(x => x.toString()));
    });

    it("should update best positions and return personal best score and best position", async function () {
      const tx = await nodeDAO.updateBestPositions(nodeAddress, deployer.address);
      expect(tx).to.exist;

      const bestScore = await nodeDAO.getPersonalBestScore(nodeAddress);
      expect(bestScore).to.exist;
      console.log("Personal best score:", bestScore.toString());

      const bestPos = await nodeDAO.getPersonalBestPosition(nodeAddress);
      expect(bestPos).to.be.an("array");
      console.log("Personal best position (snapshot):", bestPos.map(x => x.toString()));
    });

    it("should update velocity and position", async function () {
      const tx = await nodeDAO.updateVelocityAndPosition(nodeAddress, deployer.address, globalAddress);
      expect(tx).to.exist;

      const posObj = await nodeDAO.getPosition(nodeAddress);
      expect(posObj.position).to.be.an("array");
      console.log("Updated node position:", posObj.position.map(x => x.toString()));
    });

    it("should return objective function result for current position", async function () {
      const posObj = await nodeDAO.getPosition(nodeAddress);
      const result = await nodeDAO.getObjectiveFunctionResult(nodeAddress, posObj.position);
      expect(result).to.exist;
      console.log("Objective function result:", result.toString());
    });

    it("should return frozen cost based on snapshot", async function () {
      const frozenCost = await nodeDAO.getFrozenCost(nodeAddress);
      expect(frozenCost).to.exist;
      console.log("Frozen cost from node:", frozenCost.toString());
    });
  });
});
