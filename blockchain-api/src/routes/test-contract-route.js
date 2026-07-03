const express = require('express');
let router = express.Router();
const testContractBll = require('../eth-business/test-contract-bll');
const CURRENT_RESOURCE_NAME = "TEST";

let handleResponse = function (resourceName, res, next, err, response) {
    if (err) {
        err.resource = resourceName;
        return next(err);
    }
    return res.send(response);
}

let handleError = function (resourceName, err, req, res) {
    let error = {
        timestamp: Date.now(),
        status: 422,
        error: err.message,
        path: req.path,
        resource: resourceName,
    };
    console.log(error);
    res.status(422);
    res.send(error);
}

router.get('/', function (req, res, next) {
    res.send("Test contract endpoint");
});

router.post('/set-number/:username',
    async function (req, res, next) {
    try {
        let numberSetTx = await testContractBll.setNumber(req.params.username, req.body.value)
        res.send(numberSetTx)
    } catch (error) {
        handleError(CURRENT_RESOURCE_NAME, error, req, res)
    }
});

router.get('/get-number/:username',
    async function (req, res, next) {
    try {
        let number = await testContractBll.getNumber(req.params.username)
        res.send(number)
    } catch (error) {
        handleError(CURRENT_RESOURCE_NAME, error, req, res)
    }
});

module.exports = router;