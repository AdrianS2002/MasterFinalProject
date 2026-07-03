const abi = require('../../artifacts/contracts/TestContract.sol/TestContract.json').abi;  //contract compilat
const bin_data = require('../../artifacts/contracts/TestContract.sol/TestContract.json').bytecode;

let ErrorHandling = require('../models/error-handling');
const {getSignerForUser} = require("../utils/commons");
let EthErrors = require("../models/eth-errors.js");

async function setNumber(contract_address, ownerAddress, value){
    const signer = await getSignerForUser(ownerAddress)
    const contract = new ethers.Contract(contract_address, abi, signer);
    try{
        let tx = await contract.setNumber(value);
        await tx.wait();
        return tx;
    }catch (e) {
        console.log(e)
        return  new EthErrors.MethodCallError("Apartment", "setFlexibility", "setFlexibility");
    }
}

async function getNumber(contract_address){
    const contract = new ethers.Contract(contract_address, abi, provider); //provider=cine semneaza / reteaua de blockchain
    try{
        let result = await contract.getNumber();
        return {
            number: result
        }
    }catch (e) {
        console.log(e)
        return  new EthErrors.MethodCallError("TestContract", "getNumber", "getNumber");
    }
}

module.exports = {
    getNumber,
    setNumber
}
