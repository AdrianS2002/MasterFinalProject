let enums = require('../models/enums');
let testDAO = require('../eth-dao/test-contract-dao');
let accountDao = require('../db-dao/accounts-dao.js');
let contractDao = require('../db-dao/contracts-dao.js');
const ContractDAO = require("./test-contract-bll");

async function setNumber(username, value) {
    try {
        let account = await accountDao.QueryAccountAddressByUsername(username);
        let contract = await contractDao.QueryContractByTypeAndOwner(enums.ContractType.TEST, account.address);
        let numberRegisteredTx = await ContractDAO.setNumber(contract.address, value)
        return Promise.resolve({numberRegisteredTx})
    } catch (e) {
        return Promise.reject(e)
    }
}

async function getNumber(username) {
    try {
        let account = await accountDao.QueryAccountAddressByUsername(username);
        let contract = await contractDao.QueryContractByTypeAndOwner(enums.ContractType.TEST, account.address);
        let number = await ContractDAO.getNumber(contract.address)
        return Promise.resolve({number})
    } catch (e) {
        return Promise.reject(e)
    }
}

module.exports = {
    setNumber,
    getNumber
}