const db = require('../db-dao/database');
const { getHardhatAccounts } = require("../utils/commons");

async function registerUser(username, password, address, passphrase) {
    let finalAddress = address;
    if (!finalAddress) {
        finalAddress = await findFreeAddress(); // ✅ adrese din Hardhat
        console.log(`📦 Address auto-assigned: ${finalAddress}`);
    }

    const [userResult] = await db.query(
        'INSERT INTO users (address, passphrase, sKey) VALUES (?, ?, ?)',
        [finalAddress, passphrase, '']
    );
    const userId = userResult.insertId;

    await db.query(
        'INSERT INTO credentials (user_id, username, password) VALUES (?, ?, ?)',
        [userId, username, password]
    );

    await db.query(
        'INSERT INTO user_role (user, role) VALUES (?, ?)',
        [userId, '2'] // Default: USER
    );

    return userId;
}


async function findFreeAddress() {
    const allAccounts = await getHardhatAccounts();
    const accountsWithoutFirst = allAccounts.slice(1);

    const [used] = await db.query('SELECT address FROM users');
    const usedAddresses = used
        .map(u => u.address)
        .filter(addr => addr !== null)
        .map(addr => addr.toLowerCase());

    const free = accountsWithoutFirst.find(acc => !usedAddresses.includes(acc.toLowerCase()));

    if (!free) throw new Error("No free address found!");
    return free;
}


async function loginUser(username, password) {
    const [rows] = await db.query(
      'SELECT c.password, c.user_id, c.username FROM credentials c WHERE c.username = ?',
      [username]
    );
    if (rows.length === 0) throw new Error('User not found');
    if (rows[0].password !== password) throw new Error('Invalid password');
    const userId = rows[0].user_id;
    const foundUsername = rows[0].username;

  
    // Alăturăm tabela user_role cu tabela roles pentru a obține numele rolurilor
    const [roleRows] = await db.query(
      `SELECT r.role 
       FROM user_role ur 
       JOIN roles r ON ur.role = r.id 
       WHERE ur.user = ?`,
      [userId]
    );
    
    const roles = roleRows.map(r => r.role);
    return { userId,username: foundUsername, roles };
  }

module.exports = {
    registerUser,
    loginUser,
    findFreeAddress
};
