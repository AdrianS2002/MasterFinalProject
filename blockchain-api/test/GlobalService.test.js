const { expect } = require("chai");
const sinon = require("sinon");

// Importăm serviciul și DAO-ul
const globalBLL = require("../src/eth-business/global-bll");
const globalDAO = require("../src/eth-dao/global-dao");
const accountDao = require("../src/db-dao/accounts-dao");
const contractDao = require("../src/db-dao/contracts-dao");

describe("🔹 Global BLL Service Tests", function () {
    let username = "dsrl";
    let contractAddress = "0x123456789abcdef";
    let ownerAddress = "0xabcdef123456789";
    let nodeAddress = "0x987654321abcdef";

    beforeEach(() => {
        sinon.restore(); // Resetăm toate mock-urile înainte de fiecare test
    });

    // 📌 1️⃣ Test pentru calculul planului global optim
    it("should compute global optimal plan", async function () {
        sinon.stub(accountDao, "QueryAccountAddressByUsername").resolves({ address: ownerAddress });
        sinon.stub(contractDao, "QueryContractByTypeAndOwner").resolves({ address: contractAddress });
        sinon.stub(globalDAO, "computeGlobalOptimalPlan").resolves({ txHash: "0xabc" });

        let result = await globalBLL.computeGlobalOptimalPlan(username);
        expect(result.transaction.txHash).to.equal("0xabc");
    });

    // 📌 2️⃣ Test pentru obținerea planului optim global pe o anumită oră
    it("should retrieve global optimal plan for a specific hour", async function () {
        sinon.stub(contractDao, "QueryContractByTypeAndOwner").resolves({ address: contractAddress });
        sinon.stub(globalDAO, "getGlobalOptimalPlanHour").resolves({ globalOptimalPlanHour: 50 });

        let result = await globalBLL.getGlobalOptimalPlanHour(username, 2);
        expect(result.globalOptimalPlanHour).to.equal(50);
    });

    // 📌 3️⃣ Test pentru obținerea întregului plan optim global
    it("should retrieve the entire global optimal plan", async function () {
        sinon.stub(contractDao, "QueryContractByTypeAndOwner").resolves({ address: contractAddress });
        sinon.stub(globalDAO, "getGlobalOptimalPlanArray").resolves({ globalOptimalPlanArray: [10, 20, 30] });

        let result = await globalBLL.getGlobalOptimalPlanArray(username);
        expect(result.globalOptimalPlanArray).to.deep.equal([10, 20, 30]);
    });

    // 📌 4️⃣ Test pentru obținerea timestamp-ului global actualizat
    it("should get last updated global timestamp", async function () {
        sinon.stub(contractDao, "QueryContractByTypeAndOwner").resolves({ address: contractAddress });
        sinon.stub(globalDAO, "getLastUpdatedTimestamp").resolves({ lastUpdatedTimestamp: 200 });

        let result = await globalBLL.getLastUpdatedTimestamp(username);
        expect(result.lastUpdatedTimestamp).to.equal(200);
    });

    // 📌 5️⃣ Test pentru actualizarea unui rezultat al unui nod
    it("should update node result", async function () {
        let newPosition = [10, 20, 30];
        let newScore = 90;
        let newFlexibilityWeight = [5, 3, 2];

        sinon.stub(accountDao, "QueryAccountAddressByUsername").resolves({ address: ownerAddress });
        sinon.stub(contractDao, "QueryContractByTypeAndOwner").resolves({ address: contractAddress });
        sinon.stub(globalDAO, "updateNodeResult").resolves({ txHash: "0xdef" });

        let result = await globalBLL.updateNodeResult(username, newPosition, newScore, newFlexibilityWeight);
        expect(result.transaction.txHash).to.equal("0xdef");
    });

    // 📌 6️⃣ Test pentru obținerea celei mai bune poziții a unui nod
    it("should retrieve best position of a node", async function () {
        sinon.stub(contractDao, "QueryContractByTypeAndOwner").resolves({ address: contractAddress });
        sinon.stub(globalDAO, "getBestPosition").resolves({ bestPosition: [15, 25, 35] });

        let result = await globalBLL.getBestPosition(username, nodeAddress);
        expect(result.bestPosition).to.deep.equal([15, 25, 35]);
    });

    afterEach(() => {
        sinon.restore(); // Curățăm mock-urile după fiecare test
    });
});
