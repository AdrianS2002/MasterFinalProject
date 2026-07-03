let contract = require('./models/contract.js');
let ErrorHandling = require('../models/error-handling');
const {SqlError} = require("../models/db-errors");
const commons = require("../utils/commons");
const contractModel = require("./models/contract");

const sqlSelectByTypeAndOwner = "SELECT * FROM contracts WHERE type = ? AND LOWER(owner) = LOWER(?)";const sqlSelectByType = "SELECT * FROM contracts WHERE type = ?";

const sqlAddContractWithOwner = "INSERT INTO contracts (name, address, owner, type) VALUES (?, ?, ?, ?)";

const QueryContractByTypeAndOwner = (type, owner) => {
    console.log(`➡️ Executing QueryContractByTypeAndOwner with type='${type}' and owner='${owner}'`);
    return new Promise((resolve, reject) => {
        db.query(sqlSelectByTypeAndOwner, [type, owner], (err, contracts) => {
            if (err) {
                console.error("❌ SQL Error in QueryContractByTypeAndOwner:", err);
                return reject(new SqlError("QueryContractByTypeAndOwner"));
            }
            //console.log("📥 Query results:", contracts);
            if (!contracts || contracts.length === 0) {
                console.error("⚠️ No SQL results for QueryContractByTypeAndOwner");
                return reject(new Error("No SQL results on QueryContractByTypeAndOwner"));
            }
            return resolve(contracts[0]);
        });
    });
};


const QueryContractsByType = (type) => {
    return new Promise((resolve, reject) => {
        db.query(sqlSelectByType, [type], (err, contracts) => {
            if (err) {
                return reject(new SqlError("QueryContractsByType"));
            }
            return resolve(contracts || []);
        });
    });
};

QueryInsertContract = (name, address, owner, type) => {
    let contract_id = commons.generateUUID();
    return new Promise((resolve, reject) => {
        db.query(sqlAddContractWithOwner, [name, address, owner, type], (err, contract) => {
            if(err){
                reject(new SqlError("QueryInsertContract"));
            }
            try{
                return resolve(commons.getUnique(contract, contractModel.ContractDTO));
            }catch (e) {
                return reject(e);
            }
        })
    })
}



module.exports = {
    QueryInsertContract,
    QueryContractByTypeAndOwner,
    QueryContractsByType
};
