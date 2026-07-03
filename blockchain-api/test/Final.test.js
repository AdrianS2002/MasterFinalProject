const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadCSVData } = require("../scripts/loadCSVData");

describe("PSO Algorithm Simulation with Nodes from CSV", function () {
  let GlobalContract, globalContract;
  let Node, nodes;
  let accounts;
  let nodeParams;

  before(async function () {
    accounts = await ethers.getSigners();
    nodeParams = await loadCSVData(); // Load node parameters from CSV
    console.log("🔹 Node parameters loaded:", JSON.stringify(nodeParams, null, 2));

    // Deploy GlobalContract
    GlobalContract = await ethers.getContractFactory("GlobalContract");
    globalContract = await GlobalContract.deploy();
    await globalContract.waitForDeployment();
    console.log("✅ GlobalContract deployed at:", globalContract.target);

    // Deploy Nodes
    Node = await ethers.getContractFactory("Node");
    nodes = [];
    for (let i = 0; i < nodeParams.length; i++) {
      const params = nodeParams[i];
      const node = await Node.deploy(
        globalContract.target,
        Array.from(params.initialPosition),
        Array.from(params.initialVelocity),
        Array.from(params.initialTariff),
        Array.from(params.initialCapacity),
        Array.from(params.initialRenewableGeneration),
        Array.from(params.initialBatteryCapacity),
        Array.from(params.initialBatteryCharge),
        Array.from(params.initialFlexibleLoad),
        Array.from(params.flexibilityAbove),
        Array.from(params.flexibilityBelow)
      );
      await node.waitForDeployment();
      nodes.push(node);
      console.log(`✅ Node ${i + 1} deployed at:`, node.target);
    }
  });

  it("Simulates PSO algorithm and monitors cost evolution, then compares the final snapshot cost with the frozen global cost", async function () {
    console.log("\n=== Initial Node Positions ===");
    for (let i = 0; i < nodes.length; i++) {
      let posArray = Array.from(await nodes[i].getPosition());
      console.log(`Node ${i + 1} initial position:`, posArray.map(p => p.toString()));
      await nodes[i].updateBestPositions();
    }

    // Compute initial global plan
    await globalContract.computeGlobalOptimalPlan();
    console.log("\n=== Global Optimal Plan (Initially) ===");
    let initialPlan = Array.from(await globalContract.getGlobalOptimalPlanArray());
    console.log(initialPlan.map(gp => gp.toString()));

    // Helper: calculează costul total folosind snapshot-ul (personalBestScore)
    async function getTotalSnapshotCost() {
      let totalCost = BigInt(0);
      for (let i = 0; i < nodes.length; i++) {
        let cost = await nodes[i].personalBestScore();
        totalCost += BigInt(cost.toString());
      }
      return totalCost;
    }

    // Helper: calculează costul curent al rețelei (folosind starea actuală a nodurilor)
    async function getCurrentNetworkCost() {
      let totalCost = BigInt(0);
      for (let i = 0; i < nodes.length; i++) {
        let pos = Array.from(await nodes[i].getPosition());
        let cost = await nodes[i].objectiveFunction(pos);
        totalCost += BigInt(cost.toString());
      }
      return totalCost;
    }

    let snapshotCostBefore = await getTotalSnapshotCost();
    let currentCostBefore = await getCurrentNetworkCost();
    console.log("💰 Total network snapshot cost BEFORE optimization:", snapshotCostBefore.toString());
    //console.log("💰 Total network current cost BEFORE optimization:", currentCostBefore.toString());

    const iterations = 20;
    for (let iter = 0; iter < iterations; iter++) {
      console.log(`\n--- Iteration ${iter + 1} ---`);

      // Update best positions for each node
      for (let i = 0; i < nodes.length; i++) {
        await nodes[i].updateBestPositions();
      }

      // Recalculate global plan (actualizează bestGlobalPlan dacă se îmbunătățește costul)
      await globalContract.computeGlobalOptimalPlan();
      let currentGlobalPlan = Array.from(await globalContract.getGlobalOptimalPlanArray());
      console.log(`Iteration ${iter + 1} - Global Optimal Plan:`, currentGlobalPlan.map(gp => gp.toString()));

      // Update velocities and positions
      for (let i = 0; i < nodes.length; i++) {
        await nodes[i].updateVelocityAndPosition();
      }

      // Update best positions after movement
      for (let i = 0; i < nodes.length; i++) {
        await nodes[i].updateBestPositions();
      }

      // Print positions of nodes
      for (let i = 0; i < nodes.length; i++) {
        let posArray = Array.from(await nodes[i].getPosition());
        console.log(`Iteration ${iter + 1} - Node ${i + 1} position:`, posArray.map(p => p.toString()));
      }

      let snapshotCost = await getTotalSnapshotCost();
      let currentCost = await getCurrentNetworkCost();
      console.log(`Iteration ${iter + 1} - Total network snapshot cost:`, snapshotCost.toString());
     // console.log(`Iteration ${iter + 1} - Total network current cost:`, currentCost.toString());
    }

    let snapshotCostAfter = await getTotalSnapshotCost();
    let currentCostAfter = await getCurrentNetworkCost();
    console.log("\n💰 Total network snapshot cost AFTER optimization:", snapshotCostAfter.toString());
 //   console.log("💰 Total network current cost AFTER optimization:", currentCostAfter.toString());

    // Finalize global plan in GlobalContract (snapshot frozen)
    await globalContract.finalizePlan();

    // Afișăm pozițiile finale ale nodurilor (nu se vor actualiza, păstrând snapshot-ul)
    for (let i = 0; i < nodes.length; i++) {
      let posArray = Array.from(await nodes[i].getPosition());
      console.log(`Final Node ${i + 1} position:`, posArray.map(p => p.toString()));
    }

    // Compare frozen cost stored in GlobalContract with cost calculated as suma personalBestScore din noduri
    let frozenCostFromContract = await globalContract.bestGlobalCost();
    console.log("💰 Frozen Best Global Cost from Contract:", frozenCostFromContract.toString());

    let frozenCostFromNodes = await getTotalSnapshotCost();
    console.log("💰 Total network snapshot cost AFTER optimization (from nodes):", frozenCostFromNodes.toString());

    // Ne așteptăm ca valorile finale (snapshot) să fie egale
    expect(frozenCostFromNodes.toString()).to.equal(frozenCostFromContract.toString());
  });
});

