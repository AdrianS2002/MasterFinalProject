const db = require('../db-dao/database');

async function getLocations() {
    const [locations] = await db.query('SELECT * FROM locations');
    return locations;
}


async function getLocationById(id) {
    const [locations] = await db.query('SELECT * FROM locations WHERE id = ?', [id]);
    return locations[0];
}


async function getLocationByContractId(contractId) {
    const [locations] = await db.query('SELECT * FROM locations WHERE contract_id = ?', [contractId]);
    return locations[0];
}


async function addLocation({ contract_id, country, city, address }) {
    const [result] = await db.query(
        'INSERT INTO locations (contract_id, country, city, address) VALUES (?, ?, ?, ?)',
        [contract_id, country, city, address]
    );
    return result.insertId;
}


async function deleteLocation(id) {
    await db.query('DELETE FROM locations WHERE id = ?', [id]);
}

async function updateLocation(id, data) {
    const [rows] = await db.query('SELECT * FROM locations WHERE id = ?', [id]);
    if (rows.length === 0) throw new Error('Location not found');
    const currentLocation = rows[0];

    const updatedCountry = data.country || currentLocation.country;
    const updatedCity = data.city || currentLocation.city;
    const updatedAddress = data.address || currentLocation.address;

    await db.query(
        'UPDATE locations SET country=?, city=?, address=? WHERE id = ?',
        [updatedCountry, updatedCity, updatedAddress, id]
    );
}

module.exports = {
    getLocations,
    getLocationById,
    getLocationByContractId,
    addLocation,
    deleteLocation,
    updateLocation
};
