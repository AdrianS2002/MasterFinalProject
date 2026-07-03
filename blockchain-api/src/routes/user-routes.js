const express = require('express');
const router = express.Router();
const userService = require('../db-bll/userService');

// Get all users
router.get('/', async (req, res) => {
    try {
        const users = await userService.getAllUsers();
        res.send(users);
    } catch (err) {
        console.error('Get all users error:', err.message);
        res.status(500).send({ error: err.message });
    }
});

// Get user by ID
router.get('/:id', async (req, res) => {
    try {
        const user = await userService.getUserById(req.params.id);
        if (!user) {
            return res.status(404).send({ error: 'User not found' });
        }
        res.send(user);
    } catch (err) {
        console.error('Get user by ID error:', err.message);
        res.status(500).send({ error: err.message });
    }
});

// Create new user
router.post('/', async (req, res) => {
    try {
        const { username, password, address, passphrase, role } = req.body;
        if (!username || !password || !address || !passphrase || !role) {
            return res.status(400).send({ error: 'Missing required fields' });
        }
        const userId = await userService.createUser({ username, password, address, passphrase, role });
        res.status(201).send({ message: 'User created', userId });
    } catch (err) {
        console.error('Create user error:', err.message);
        res.status(500).send({ error: err.message });
    }
});

// Update user
router.put('/:id', async (req, res) => {
    try {
        await userService.updateUser(req.params.id, req.body);
        res.send({ message: 'User updated' });
    } catch (err) {
        console.error('Update user error:', err.message);
        res.status(500).send({ error: err.message });
    }
});

// Delete user
router.delete('/:id', async (req, res) => {
    try {
        await userService.deleteUser(req.params.id);
        res.send({ message: 'User deleted' });
    } catch (err) {
        console.error('Delete user error:', err.message);
        res.status(500).send({ error: err.message });
    }
});


router.get('/consumption-point/:username', async (req, res) => {
    const username = req.params.username;

    try {
        const point = await userService.getConsumptionPointByUsername(username);
        if (!point) {
            return res.status(404).json({ message: 'No consumption point found' });
        }
        res.json(point);
    } catch (err) {
        console.error('❌ Eroare la obținerea punctului de consum:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
