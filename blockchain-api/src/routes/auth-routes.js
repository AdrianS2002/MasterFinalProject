const express = require('express');
const router = express.Router();
const authService = require('../db-bll/authService');

router.post('/signup', async (req, res) => {
    console.log("==== Signup request body ====");
    console.log(req.body);
    
    try {
        const { username, password, address, passphrase } = req.body;

        // ✅ Acum address este opțional!
        if (!username || !password || !passphrase) {
            return res.status(400).send({ error: 'Missing required fields' });
        }

        const userId = await authService.registerUser(username, password, address, passphrase);
        res.status(201).send({ message: 'User created', userId });
    } catch (err) {
        console.error('Signup error:', err.message);
        res.status(500).send({ error: err.message });
    }
});

router.post('/login', async (req, res) => {
    console.log('==== BODY RECEIVED ====');  
    console.log(req.body); // aici ar trebui să vezi body-ul
    const { username, password } = req.body;
    if (!username || !password) {
        console.log('Missing username or password');
        return res.status(400).send({ error: "Missing username or password" });
    }
    try {
        const user = await authService.loginUser(username, password);
        res.send({ message: 'Login successful', user });
    } catch (err) {
        console.error('Login error:', err.message);
        res.status(401).send({ error: err.message });
    }
});


module.exports = router;
