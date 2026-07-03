const db = require('./database'); // conexiune la MySQL
const { getUnique } = require('../utils/commons');
const { SqlError } = require('../models/db-errors');
const { LocationDTO } = require('../models/location'); // DTO-ul creat anterior

const sqlSelectLocationByContractId = "SELECT * FROM locations WHERE contract_id = ?";
const sqlInsertLocation = "INSERT INTO locations (contract_id, country, city, address) VALUES (?, ?, ?, ?)";

function queryLocationByContractId(contractId) {
    return new Promise((resolve, reject) => {
        db.query(sqlSelectLocationByContractId, [contractId])
            .then(([rows]) => {
                try {
                    resolve(getUnique(rows, LocationDTO, "ContractId"));
                } catch (e) {
                    reject(e);
                }
            })
            .catch((err) => reject(new SqlError("queryLocationByContractId")));
    });
}

function insertLocation({ contractId, country, city, address }) {
    return new Promise((resolve, reject) => {
        db.query(sqlInsertLocation, [contractId, country, city, address])
            .then(([result]) => resolve(result.insertId))
            .catch((err) => reject(new SqlError("insertLocation")));
    });
}

module.exports = {
    queryLocationByContractId,
    insertLocation
};
