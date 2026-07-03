const express = require('express');
const router = express.Router();
const globalService = require('../../eth-business/global-bll');
const { getResults } = require('../../../scripts/psoResults'); 

function stringifyBigInt(obj) {
    return JSON.parse(
        JSON.stringify(obj, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
        )
    );
}

// ✅ Calculează planul global optim
router.post('/compute', async (req, res) => {
    try {
        const tx = await globalService.computeGlobalOptimalPlan();
        res.json({ message: 'Global optimal plan computed', transaction: tx });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/plan-history', async (req, res) => {
    try {
        const result = await globalService.getGlobalPlanHistory();
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ✅ Obține valoarea planului global pentru o anumită oră
router.get('/optimal-plan-hour/:hour', async (req, res) => {
    try {
        const result = await globalService.getGlobalOptimalPlanHour(req.params.hour);
        res.json(stringifyBigInt(result));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ✅ Obține întregul plan global optim ca array
router.get('/optimal-plan-array', async (req, res) => {
    try {
        const result = await globalService.getGlobalOptimalPlanArray();
        res.json(stringifyBigInt(result));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ✅ Obține timestamp-ul ultimei actualizări globale
router.get('/last-updated', async (req, res) => {
    try {
        const result = await globalService.getLastUpdatedTimestamp();
        res.json(stringifyBigInt(result));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ✅ Actualizează rezultatul unui nod în GlobalContract (dacă vrei să folosești explicit de la un frontend)
router.post('/update-node-result', async (req, res) => {
    const { newPosition, newScore, newFlexibilityWeight } = req.body;
    try {
        const tx = await globalService.updateNodeResult(newPosition, newScore, newFlexibilityWeight);
        res.json({ message: 'Node result updated in GlobalContract', transaction: tx });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ✅ Obține cea mai bună poziție pentru un anumit nod
router.get('/best-position/:nodeAddress', async (req, res) => {
    try {
        const result = await globalService.getBestPosition(req.params.nodeAddress);
        res.json(stringifyBigInt(result));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ✅ Obține frozen global cost
router.get('/frozen-global-cost', async (req, res) => {
    try {
        const result = await globalService.getFrozenGlobalCost();
        res.json(stringifyBigInt(result));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ✅ Obține cel mai bun plan global
router.get('/best-global-plan', async (req, res) => {
    try {
        const result = await globalService.getBestGlobalPlan();
        res.json(stringifyBigInt(result));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


router.get('/node-addresses', async (req, res) => {
    try {
        const result = await globalService.getNodeAddresses();
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/pso-results', (req, res) => {
  res.json(getResults());
});


router.get('/personalBestScoreByAddress/:address', async (req, res) => {
    try {
      const result = await globalService.getPersonalBestScoreByAddress(req.params.address);
      res.json({ score: result.score.toString() });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });


module.exports = router;
