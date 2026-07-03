const db = require('../db-dao/database');

async function getContracts() {
    const [contracts] = await db.query('SELECT * FROM contracts');
    return contracts;
}

async function getContractById(id) {
    const [contracts] = await db.query('SELECT * FROM contracts WHERE id = ?', [id]);
    return contracts[0];
}

async function getGlobalContract(){
    const [contracts] = await db.query('SELECT * FROM contracts WHERE type = "GlobalContract"');
    return contracts[0];
}

async function addContract({ name, address, type, owner }) {
    const [result] = await db.query('INSERT INTO contracts (name, address, type, owner) VALUES (?, ?, ?, ?)', [name, address, type, owner]);
    return result.insertId;
}

async function deleteContract(id) {
    await db.query('DELETE FROM contracts WHERE id = ?', [id]);
}

async function getClusterContract() {
    const [contracts] = await db.query('SELECT * FROM contracts WHERE type = "Cluster"');
    return contracts;
}

async function updateContract(id, data) {
    // 1. Obține contractul curent
    const [rows] = await db.query('SELECT * FROM contracts WHERE id = ?', [id]);
    if (rows.length === 0) throw new Error('Contract not found');
    const currentContract = rows[0];

    // 2. Folosește noile valori sau valorile existente dacă nu sunt transmise
    const updatedName = data.name || currentContract.name;
    const updatedAddress = data.address || currentContract.address;
    const updatedType = data.type || currentContract.type;
    const updatedOwner = data.owner || currentContract.owner;

    // 3. Fă update-ul
    await db.query(
        'UPDATE contracts SET name=?, address=?, type=?, owner=? WHERE id = ?',
        [updatedName, updatedAddress, updatedType, updatedOwner, id]
    );
}

async function updateContractOwner(id, newOwner) {
    await db.query(
      'UPDATE contracts SET owner = ? WHERE id = ?',
      [newOwner, id]
    );
  }



module.exports = {
    getContracts,
    getContractById,
    addContract,
    getGlobalContract,
    deleteContract,
    updateContract,
    updateContractOwner
};
