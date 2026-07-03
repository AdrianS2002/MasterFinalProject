// const { expect } = require("chai");
// const sinon = require("sinon");

// // Actualizează calea după structura proiectului tău
// const service = require("../src/eth-business/test-contract-bll.js"); 

// // Dependențele care vor fi stub-uite
// const accountDao = require("../src/db-dao/accounts-dao.js");
// const contractDao = require("../src/db-dao/contracts-dao.js");
// const ContractDAO = require("../src/eth-business/test-contract-bll.js");

// describe("Service: setNumber and getNumber", function () {

//   afterEach(function () {
//     // Restaurează stub-urile după fiecare test
//     sinon.restore();
//   });

//   describe("setNumber", function () {
//     it("should set number successfully", async function () {
//       const username = "testUser";
//       const value = 42;
//       const fakeAccount = { address: "0xAccount" };
//       const fakeContract = { address: "0xContract" };
//       const fakeTx = { txHash: "0xTransaction" };

//       // Stub pentru accountDao.QueryAccountAddressByUsername
//       sinon.stub(accountDao, "QueryAccountAddressByUsername").resolves(fakeAccount);
//       // Stub pentru contractDao.QueryContractByTypeAndOwner
//       sinon.stub(contractDao, "QueryContractByTypeAndOwner").resolves(fakeContract);
//       // Stub pentru ContractDAO.setNumber
//       sinon.stub(ContractDAO, "setNumber").resolves(fakeTx);

//       const result = await service.setNumber(username, value);
//       expect(result).to.deep.equal(fakeTx);

//     });

//     it("should reject if accountDao fails", async function () {
//       const username = "testUser";
//       const value = 42;
//       const errorMessage = "Account not found";
      
//       sinon.stub(accountDao, "QueryAccountAddressByUsername").rejects(new Error(errorMessage));

//       try {
//         await service.setNumber(username, value);
//         expect.fail("Expected promise to be rejected");
//       } catch (err) {
//         expect(err).to.be.an("error");
//         expect(err.message).to.equal(errorMessage);
//       }
//     });
//   });

//   describe("getNumber", function () {
//     it("should get number successfully", async function () {
//       const username = "testUser";
//       const fakeAccount = { address: "0xAccount" };
//       const fakeContract = { address: "0xContract" };
//       const fakeNumber = 100;
  
//       sinon.stub(accountDao, "QueryAccountAddressByUsername").resolves(fakeAccount);
//       sinon.stub(contractDao, "QueryContractByTypeAndOwner").resolves(fakeContract);
//       sinon.stub(ContractDAO, "getNumber").resolves(fakeNumber);
  
//       const result = await service.getNumber(username);
//       expect(result).to.equal(fakeNumber);
//     });
  
//     it("should reject if ContractDAO.getNumber fails", async function () {
//       const username = "testUser";
//       const fakeAccount = { address: "0xAccount" };
//       const fakeContract = { address: "0xContract" };
//       const errorMessage = "getNumber error";
  
//       sinon.stub(accountDao, "QueryAccountAddressByUsername").resolves(fakeAccount);
//       sinon.stub(contractDao, "QueryContractByTypeAndOwner").resolves(fakeContract);
//       sinon.stub(ContractDAO, "getNumber").rejects(new Error(errorMessage));
  
//       try {
//         await service.getNumber(username);
//         expect.fail("Expected promise to be rejected");
//       } catch (err) {
//         expect(err).to.be.an("error");
//         expect(err.message).to.equal(errorMessage);
//       }
//     });
//   });
  
// });
