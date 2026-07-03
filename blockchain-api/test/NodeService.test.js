const { expect } = require("chai");
const sinon = require("sinon");

// Importăm serviciul și DAO-ul
const nodeBLL = require("../src/eth-business/node-bll");
const nodeDAO = require("../src/eth-dao/node-dao");
const accountDao = require("../src/db-dao/accounts-dao");
const contractDao = require("../src/db-dao/contracts-dao");
const globalContractService = require("../src/eth-business/global-bll");

describe("🔹 Node BLL Service Tests", function () {
    let username = "dsrl";
    let contractAddress = "0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0";
    let ownerAddress = "0xabcdef123456789";

    beforeEach(() => {
        sinon.restore(); // Resetăm toate mock-urile înainte de fiecare test
    });

    it("should retrieve the Node contract for a user", async function () {
        sinon.stub(accountDao, "QueryAccountAddressByUsername").resolves({ address: ownerAddress });
        sinon.stub(contractDao, "QueryContractByTypeAndOwner").resolves({ address: contractAddress });
    
        let contractInfo;
        try {
            contractInfo = await nodeBLL.getPosition(username);
            console.log("✅ Contract Info:", contractInfo);
        } catch (error) {
            console.log("❌ Error:", error);
            throw error; // 🔴 Afișează eroarea reală dacă apare
        }
    
        expect(contractInfo).to.have.property("position"); // 🟢 Așteptăm un obiect { position: [...] }
    });
    
    

    //  Test pentru actualizarea vitezei și poziției
    it("should update velocity and position when timestamp is updated", async function () {
        sinon.stub(accountDao, "QueryAccountAddressByUsername").resolves({ address: ownerAddress });
        sinon.stub(contractDao, "QueryContractByTypeAndOwner").resolves({ address: contractAddress });
        sinon.stub(nodeDAO, "getLastKnownGlobalTimestamp").resolves(100);
        sinon.stub(globalContractService, "getLastUpdatedTimestamp").resolves(200);
        sinon.stub(nodeDAO, "updateVelocityAndPosition").resolves({ txHash: "0xabc" });

        let result = await nodeBLL.updateVelocityAndPosition(username, contractAddress);
        expect(result).to.have.property("transaction");
        expect(result.transaction.txHash).to.equal("0xabc");
    });

    //  Test pentru cazul când nu există update nou de timestamp
    it("should not update velocity and position if no new global timestamp", async function () {
        sinon.stub(accountDao, "QueryAccountAddressByUsername").resolves({ address: ownerAddress });
        sinon.stub(contractDao, "QueryContractByTypeAndOwner").resolves({ address: contractAddress });
        sinon.stub(nodeDAO, "getLastKnownGlobalTimestamp").resolves(200);
        sinon.stub(globalContractService, "getLastUpdatedTimestamp").resolves(200);

        let result = await nodeBLL.updateVelocityAndPosition(username, contractAddress);
        expect(result.message).to.equal("No update needed");
    });

    //  Test pentru obținerea poziției curente
    it("should retrieve current position", async function () {
        sinon.stub(accountDao, "QueryAccountAddressByUsername").resolves({ address: ownerAddress });
        sinon.stub(contractDao, "QueryContractByTypeAndOwner").resolves({ address: contractAddress });
        sinon.stub(nodeDAO, "getPosition").resolves({ position: [10, 20, 30] });
    
        let result = await nodeBLL.getPosition(username);
        console.log("Test Result:", result); // Debugging
        expect(result.position).to.deep.equal([10, 20, 30]);
    });
    

    //  Test pentru obținerea timestamp-ului global cunoscut de nod
    it("should get last known global timestamp", async function () {
        sinon.stub(accountDao, "QueryAccountAddressByUsername").resolves({ address: ownerAddress });
        sinon.stub(contractDao, "QueryContractByTypeAndOwner").resolves({ address: contractAddress });
        sinon.stub(nodeDAO, "getLastKnownGlobalTimestamp").resolves(100);

        let result = await nodeBLL.getLastKnownGlobalTimestamp(username);
        expect(result.timestamp).to.equal(100);
    });

    //  Test pentru obținerea scorului cel mai bun personal
    it("should get personal best score", async function () {
        sinon.stub(accountDao, "QueryAccountAddressByUsername").resolves({ address: ownerAddress });
        sinon.stub(contractDao, "QueryContractByTypeAndOwner").resolves({ address: contractAddress });
        sinon.stub(nodeDAO, "getPersonalBestScore").resolves(50);

        let result = await nodeBLL.getPersonalBestScore(username);
        expect(result.score).to.equal(50);
    });

    //  Test pentru obținerea celei mai bune poziții personale
    it("should get personal best position", async function () {
        sinon.stub(accountDao, "QueryAccountAddressByUsername").resolves({ address: ownerAddress });
        sinon.stub(contractDao, "QueryContractByTypeAndOwner").resolves({ address: contractAddress });
        sinon.stub(nodeDAO, "getPersonalBestPosition").resolves([5, 10, 15]);

        let result = await nodeBLL.getPersonalBestPosition(username);
        expect(result.position).to.deep.equal([5, 10, 15]);
    });

    //  Test pentru actualizarea celei mai bune poziții
    it("should update best position", async function () {
        sinon.stub(accountDao, "QueryAccountAddressByUsername").resolves({ address: ownerAddress });
        sinon.stub(contractDao, "QueryContractByTypeAndOwner").resolves({ address: contractAddress });
        sinon.stub(nodeDAO, "updateBestPositions").resolves({ txHash: "0xdef" });

        let result = await nodeBLL.updateBestPositions(username);
        expect(result.transaction.txHash).to.equal("0xdef");
    });

    //Test pentru obținerea rezultatului funcției obiectiv
    it("should get objective function result", async function () {
        sinon.stub(accountDao, "QueryAccountAddressByUsername").resolves({ address: ownerAddress });
        sinon.stub(contractDao, "QueryContractByTypeAndOwner").resolves({ address: contractAddress });
        sinon.stub(nodeDAO, "getObjectiveFunctionResult").resolves(150);

        let result = await nodeBLL.getObjectiveFunctionResult(username);
        expect(result.result).to.equal(150);
    });

    // // Test pentru calculul penalizării nodului
    // it("should calculate node penalty", async function () {
    //     sinon.stub(nodeBLL, "getNodePenalty").resolves({ totalPenalty: 200, hourlyPenalties: [50, 50, 50, 50] });

    //     let result = await nodeBLL.getNodePenalty(username);
    //     expect(result.totalPenalty).to.equal(200);
    //     expect(result.hourlyPenalties).to.deep.equal([50, 50, 50, 50]);
    // });

    afterEach(() => {
        sinon.restore(); // Curățăm mock-urile după fiecare test
    });
});
