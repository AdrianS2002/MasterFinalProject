const db = require('./database'); // Import the database connection
let ErrorHandling = require('../models/error-handling');
const { getUnique } = require("../utils/commons");
const { SqlError } = require("../models/db-errors");
const commons = require("../utils/commons");

const selectFromUserInnerJoinCredentials = "SELECT * FROM users inner join credentials on users.id = credentials.user_id ";
const sqlSelectByUsername = selectFromUserInnerJoinCredentials + "where credentials.username like ? ";
const selectAddressByUsernameInnerJoinCredentials = "SELECT u.address FROM users u inner join credentials on u.id = credentials.user_id where credentials.username like ? ";

async function queryCredentialsByUsername(username) {
    try {
        let account = await QueryAccountByUsername(username);
        return Promise.resolve(user.CredentialsDTO(account));
    } catch (error) {
        return Promise.reject(error);
    }
}

// ✅ Use `db` from the imported module
QueryAccountByUsername = (username) => {
    return new Promise((resolve, reject) => {
        db.query(sqlSelectByUsername, [username])
            .then(([account]) => {
                try {
                    resolve(getUnique(account, "QueryAccountByUsername", "Username"));
                } catch (e) {
                    reject(e);
                }
            })
            .catch((err) => reject(new SqlError("QueryAccountByUsername")));
    });
};

QueryAccountAddressByUsername = (username) => {
    return new Promise((resolve, reject) => {
        db.query(selectAddressByUsernameInnerJoinCredentials, [username])
            .then(([account]) => {
                try {
                    resolve(commons.getUnique(account, "QueryAccountAddressByUsername", "Username"));
                } catch (e) {
                    reject(e);
                }
            })
            .catch((err) => {
                console.log(err);
                reject(new SqlError("QueryAccountAddressByUsername"));
            });
    });
};

module.exports = {
    QueryAccountByUsername,
    QueryAccountAddressByUsername,
};
