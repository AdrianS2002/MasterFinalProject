var express = require('express');
var router = express.Router();

router.get('/', function (req, res, next) {
    res.render('index', {title: 'Express'}); //res.json({ message: "Welcome to Blockchain API!" }); // 
});

module.exports = router;
