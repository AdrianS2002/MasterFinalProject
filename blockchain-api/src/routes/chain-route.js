const { Web3 } = require('web3');
const { ethers } = require('ethers');
const express = require('express');
let router = express.Router();

const providerUrl = 'http://localhost:8545';
const provider = new ethers.JsonRpcProvider(providerUrl);
const web3 = new Web3('http://localhost:8545');


function stringifyBigInt(obj) {
    return JSON.parse(
        JSON.stringify(obj, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
        )
    );
}

router.get('/block/:number', async (req, res) => {
    try {
        const block = await web3.eth.getBlock(parseInt(req.params.number));
        res.send(stringifyBigInt(block));
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Could not fetch block', details: err.message });
    }
});


router.get('/tx/:hash', async (req, res) => {
    try {
        const receipt = await web3.eth.getTransactionReceipt(req.params.hash);
        if (receipt) {
            res.send(stringifyBigInt(receipt));
        } else {
            res.status(404).send({ error: 'Transaction receipt not found. It might not be mined yet.' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Could not fetch transaction receipt', details: err.message });
    }
});


router.get('/accounts', async function (req, res, next) {
    try {
        const accounts = await web3.eth.getAccounts();
        res.send(accounts);
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Failed to fetch accounts', details: err.message });
    }
});



router.get('/provider', async (req, res) => {
    try {
        const network = await provider.getNetwork();
        res.send({
            providerUrl: providerUrl,
            networkName: network.name,
            chainId: network.chainId.toString()
        });
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Could not get provider info', details: err.message });
    }
});


router.get('/tx-data/:hash', async (req, res) => {
    try {
        const tx = await web3.eth.getTransaction(req.params.hash);
        res.send(stringifyBigInt(tx));
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Could not fetch transaction data', details: err.message });
    }
});

router.get('/block-number', async (req, res) => {
    try {
        const blockNumber = await web3.eth.getBlockNumber();
        res.send({ blockNumber: blockNumber.toString() }); // Convert direct în string
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Failed to get current block number', details: err.message });
    }
});


router.get('/fee-history', async (req, res) => {
    try {
        const history = await web3.eth.getFeeHistory(5, 'latest', [25, 50, 75]);
        res.send(stringifyBigInt(history));
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Failed to get fee history', details: err.message });
    }
});



module.exports = router;
