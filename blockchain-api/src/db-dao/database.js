const mysql = require("mysql2");

const db_config = {
    host: "localhost",      // Use the correct DB host
    user: "root",           // Your DB username
    password: "root",       // Your DB password
    database: "licenta-dsrl" // Your DB name
};

// Create a connection pool (better for multiple queries)
const db = mysql.createPool(db_config).promise();

module.exports = db;
