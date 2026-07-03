const express = require('express');
const router = express.Router();
const locationService = require('../db-bll/locationService');


router.get('/', async (req, res) => {
    try {
        const locations = await locationService.getLocations();
        res.json(locations);
    } catch (error) {
        res.status(500).json({ error: 'Eroare la obținerea locațiilor' });
    }
});


router.get('/:id', async (req, res) => {
    try {
        const location = await locationService.getLocationById(req.params.id);
        if (!location) return res.status(404).json({ error: 'Locație inexistentă' });
        res.json(location);
    } catch (error) {
        res.status(500).json({ error: 'Eroare la obținerea locației' });
    }
});


router.get('/contract/:contractId', async (req, res) => {
    try {
        const location = await locationService.getLocationByContractId(req.params.contractId);
        if (!location) return res.status(404).json({ error: 'Locație pentru contract inexistentă' });
        res.json(location);
    } catch (error) {
        res.status(500).json({ error: 'Eroare la obținerea locației' });
    }
});

router.post('/', async (req, res) => {
    const { contract_id, country, city, address } = req.body;
    try {
        const newId = await locationService.addLocation({ contract_id, country, city, address });
        res.status(201).json({ id: newId });
    } catch (error) {
        res.status(500).json({ error: 'Eroare la adăugarea locației' });
    }
});

router.put('/:id', async (req, res) => {
    try {
        await locationService.updateLocation(req.params.id, req.body);
        res.json({ message: 'Locație actualizată cu succes' });
    } catch (error) {
        res.status(500).json({ error: 'Eroare la actualizarea locației' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        await locationService.deleteLocation(req.params.id);
        res.json({ message: 'Locație ștearsă' });
    } catch (error) {
        res.status(500).json({ error: 'Eroare la ștergerea locației' });
    }
});

module.exports = router;
