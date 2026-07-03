const SqlErrors = require("../models/db-errors.js");
const user = require("../db-dao/models/account.js");
const uuid = require("uuid");
const { ethers } = require("hardhat");
const abi = require("../../artifacts/contracts/Node.sol/Node.json").abi;
const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545", {
    name: "localnet",
    chainId: 1337
});
function generateUUID()
{
    return uuid.v4();
}

async function getSignerForUser(userAddress) {
    // const account = signers.find(acc => acc.toLowerCase() === userAddress.toLowerCase());
    //
    // if (!account) {
    //     throw new Error("Signer not found for the provided address");
    // }
    return await provider.getSigner(userAddress);
}

async function getDefaultSigner() {

}

function getUnique(list, method, name)
{
    if(list.length < 1){
        throw new SqlErrors.SqlNoResultError(method);
    }
    if(list.length > 1){
        throw new SqlErrors.SqlNotUniqueError(name, method);
    }
    return list[0];
}

function listToDTO(list, model)
{
    let dtoList=[]
    for(let i = 0; i<list.length; i++)
    {
        dtoList.push(model(list[i]))
    }
    return dtoList;
}

async function getHardhatAccounts() {
    const accounts = await ethers.getSigners();
    return accounts.map(signer => signer.address);
}

function loadNodeContract(contractAddress) {
    return new ethers.Contract(contractAddress, abi, provider);
  }

module.exports ={
    generateUUID,
    getUnique,
    listToDTO,
    getSignerForUser,
    getDefaultSigner,
    provider,
    getHardhatAccounts,
    loadNodeContract
}