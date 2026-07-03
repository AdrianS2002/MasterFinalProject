const express = require('express');
const contractService = require('../../db-bll/contractService');
const router = express.Router();
const nodeService = require('../../eth-business/node-bll'); // schimbă calea dacă e diferită

function stringifyBigInt(obj) {
  return JSON.parse(
    JSON.stringify(obj, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )
  );
}

router.get('/position/:username', async (req, res) => {
  try {
    const data = await nodeService.getPosition(req.params.username);
    res.json(stringifyBigInt(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/renewableUsed/:username', async (req, res) => {
  try{
    const data = await nodeService.getUsedRenewablePlan(req.params.username);
    res.json(stringifyBigInt(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/personalBestScore/:username', async (req, res) => {
  try {
    const data = await nodeService.getPersonalBestScore(req.params.username);
    res.json((stringifyBigInt(data)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/personalBestPosition/:username', async (req, res) => {
  try {
    const data = await nodeService.getPersonalBestPosition(req.params.username);
    res.json((stringifyBigInt(data)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/updateBestPositions/:username', async (req, res) => {
  try {
    const result = await nodeService.updateBestPositions(req.params.username);
    res.json((stringifyBigInt(result)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/updateVelocity/:username', async (req, res) => {
  try {
    const globalContract = await contractService.getGlobalContract();
    if (!globalContract || !globalContract.address) {
      return res.status(404).json({ error: "Global contract not found" });
    }

    const result = await nodeService.updateVelocityAndPosition(req.params.username, globalContract.address);
    res.json(stringifyBigInt(result));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



router.get('/frozenCost/:username', async (req, res) => {
  try {
    const data = await nodeService.getFrozenCost(req.params.username);
    res.json((stringifyBigInt(data)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/objectiveFunction/:username', async (req, res) => {
  try {
    const data = await nodeService.getObjectiveFunctionResult(req.params.username);
    res.json((stringifyBigInt(data)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.get('/effectiveTariff/:username/:hour/:consumption', async (req, res) => {
  try {
    const hour = parseInt(req.params.hour, 10);
    const consumption = parseInt(req.params.consumption, 10);
    const data = await nodeService.getEffectiveTariff(req.params.username, hour, consumption);
    res.json(stringifyBigInt(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/tariff/:username', async (req, res) => {
  try {
    const data = await nodeService.getTariff(req.params.username);
    res.json(stringifyBigInt(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/capacity/:username', async (req, res) => {
  try {
    const data = await nodeService.getCapacity(req.params.username);
    res.json(stringifyBigInt(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/batteryCharge/:username', async (req, res) => {
  try {
    const data = await nodeService.getBatteryCharge(req.params.username);
    res.json(stringifyBigInt(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/batteryCapacity/:username', async (req, res) => {
  try {
    const data = await nodeService.getBatteryCapacity(req.params.username);
    res.json(stringifyBigInt(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/renewableGeneration/:username', async (req, res) => {
  try {
    const data = await nodeService.getRenewableGeneration(req.params.username);
    res.json(stringifyBigInt(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/flexibilityAbove/:username', async (req, res) => {
  try {
    const data = await nodeService.getFlexibilityAbove(req.params.username);
    res.json(stringifyBigInt(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/flexibilityBelow/:username', async (req, res) => {
  try {
    const data = await nodeService.getFlexibilityBelow(req.params.username);
    res.json(stringifyBigInt(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/flexibilityLoad/:username', async (req, res) => {
  try {
    const data = await nodeService.getFlexibleLoad(req.params.username);
    res.json(stringifyBigInt(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
);
router.get('/frozenBreakdown/:username', async (req, res) => {
  try {
    const data = await nodeService.getFrozenEnergyBreakdown(req.params.username);
    res.json(stringifyBigInt(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;
