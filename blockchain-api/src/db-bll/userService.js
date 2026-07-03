const db = require('../db-dao/database');

// Get all users with credentials and roles
async function getAllUsers() {
    const [users] = await db.query(`
        SELECT u.id, u.address, u.passphrase, c.username, c.password AS user_password, ur.role 
        FROM users u
        JOIN credentials c ON c.user_id = u.id
        JOIN user_role ur ON ur.user = u.id
    `);
    return users;
}

// Get single user by ID
async function getUserById(id) {
    const [users] = await db.query(`
        SELECT u.id, u.address, u.passphrase, c.username, c.password AS user_password, ur.role 
        FROM users u
        JOIN credentials c ON c.user_id = u.id
        JOIN user_role ur ON ur.user = u.id
        WHERE u.id = ?
    `, [id]);
    return users[0];
}

// Add new user with role
async function createUser({ username, password, address, passphrase, role }) {
    const [userResult] = await db.query(
        'INSERT INTO users (address, passphrase, sKey) VALUES (?, ?, ?)', [address, passphrase, '']
    );
    const userId = userResult.insertId;

    await db.query(
        'INSERT INTO credentials (user_id, username, password) VALUES (?, ?, ?)', 
        [userId, username, password]
    );

    await db.query(
        'INSERT INTO user_role (user, role) VALUES (?, ?)', 
        [userId, role]
    );
    return userId;
}

// Update user fields (partial update)
async function updateUser(id, data) {
    const currentUser = await getUserById(id);
    if (!currentUser) throw new Error('User not found');

    const updatedAddress = data.address || currentUser.address;
    const updatedPassphrase = data.passphrase || currentUser.passphrase;
    const updatedUsername = data.username || currentUser.username;
    const updatedPassword = data.password || currentUser.user_password;
    const updatedRole = data.role || currentUser.role;

    await db.query(
        'UPDATE users SET address=?, passphrase=? WHERE id=?',
        [updatedAddress, updatedPassphrase, id]
    );

    await db.query(
        'UPDATE credentials SET username=?, password=? WHERE user_id=?',
        [updatedUsername, updatedPassword, id]
    );

    await db.query(
        'UPDATE user_role SET role=? WHERE user=?',
        [updatedRole, id]
    );
}

// Delete user by ID
async function deleteUser(userId) {
    // Găsește adresa userului
    const [user] = await db.query('SELECT address FROM users WHERE id = ?', [userId]);
    if (!user || user.length === 0) {
      throw new Error('User not found');
    }
  
    const address = user[0].address;
  
    // Dezactivează contractele asociate (setează owner la 0x0000...)
    await db.query('UPDATE contracts SET owner = ? WHERE owner = ?', [
      '0x0000000000000000000000000000000000000000',
      address
    ]);
  
    // Șterge userul
    await db.query('DELETE FROM users WHERE id = ?', [userId]);
  
    // Șterge din alte tabele dacă e nevoie
    await db.query('DELETE FROM credentials WHERE user_id = ?', [userId]);
    await db.query('DELETE FROM user_role WHERE user = ?', [userId]);
  }
async function getConsumptionPointByUsername(username) {
    const [rows] = await db.query(`
        SELECT c.id, c.name, c.address, c.type
        FROM credentials cr
        JOIN users u ON cr.user_id = u.id
        JOIN contracts c ON u.address = c.owner
        WHERE cr.username = ? AND c.type = 'Node'
    `, [username]);

    return rows[0] || null;
}

module.exports = {
    getAllUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
    getConsumptionPointByUsername
};
