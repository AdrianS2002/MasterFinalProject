let express = require('express');
let path = require('path');
let cookieParser = require('cookie-parser');
let logger = require('morgan');
let mysql = require('mysql2');
let cors = require('cors');
let createError = require('http-errors');
const { Web3 } = require('web3');
const { ethers } = require('ethers');
const swaggerUI = require('swagger-ui-express');


//controllere
let indexRouter = require('./src/routes/index');
let testRouter = require('./src/routes/test-contract-route');
let chainRouter = require('./src/routes/chain-route');
const authRoutes = require('./src/routes/auth-routes');
const contractRoutes = require('./src/routes/contract-routes');
const userRoutes = require('./src/routes/user-routes');
const locationRoutes = require('./src/routes/location-routes');
const nodesRouter = require('./src/routes/eth-routes/node-routes');
const globalRoutes = require('./src/routes/eth-routes/global-routes');
const dayaheadRoutes = require('./src/routes/eth-routes/dayahead-routes');
const intradayRoutes = require('./src/routes/eth-routes/intraday-routes');
const clusterRoutes = require('./src/routes/eth-routes/cluster-routes');


let app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');  //jade era inainte
app.disable('etag');
app.use(logger('dev'));
app.use(cors());
app.use(cookieParser());

app.use((req, res, next) => {
    console.log("==== New request received ====");
    console.log("Method:", req.method);
    console.log("URL:", req.originalUrl);
    console.log("Headers:", req.headers);
    console.log("Body:", req.body);
    next();
});


app.use(express.static(path.join(__dirname, 'public')));

let baseURL = '/blockchain-api';

app.use(baseURL + '/', indexRouter);
app.use(baseURL + '/chain', chainRouter);
app.use(baseURL + '/test', testRouter);
app.use(baseURL + '/auth', authRoutes);
app.use(baseURL + '/contracts', contractRoutes);
app.use(baseURL + '/locations', locationRoutes)
app.use(baseURL + '/users', userRoutes);
app.use(baseURL + '/nodes', nodesRouter);
app.use(baseURL + '/global', globalRoutes);
app.use(baseURL + '/dayahead', dayaheadRoutes);
app.use(baseURL + '/intraday', intradayRoutes);
app.use(baseURL + '/clusters', clusterRoutes);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
    console.log(err);
    err.path = req.path;
    err.timestamp = Date.now();
    res.status(err.status || 500);
    res.send(err);
});




//posibil si port
let host = 'localhost';
let user = 'root';
let password = 'root';
let database = 'licenta-dsrl';

let db_config = {
    host: host,
    user: user,
    password: password,
    database: database
};

let db;

// connect to database
function handleDisconnect() {
    db = mysql.createConnection(db_config); // Recreate the connection, since
    // the old one cannot be reused.

    console.log('Connecting... ');
    db.connect(function (err) {              // The server is either down
        if (err) {                                     // or restarting (takes a while sometimes).
            console.log('error when connecting to db:', err);
            setTimeout(handleDisconnect, 2000); // We introduce a delay before attempting to reconnect,
        }                                     // to avoid a hot loop, and to allow our node script to
    });                                     // process asynchronous requests in the meantime.

    // If you're also serving http, display a 503 error.
    db.on('error', function (err) {
        console.log('db error', err);
        if (err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
            console.log('Connection lost, reconnecting... ');
            handleDisconnect();
            global.db = db; // lost due to either server restart, or a
        } else {                                      // connection idle timeout (the wait_timeout
            console.log('Unhandled error... ');
            throw err;                                  // server letiable configures this)
        }
    });
}

handleDisconnect();
global.db = db;

let ip = 'http://localhost:8545';  //blockchain
global.web3 = new Web3(ip); //adaugat 22.03.2025

global.provider = new ethers.JsonRpcProvider(ip);
global.ethers = ethers;
global.createError = createError;

async function checkEthersConnection() {
    try {
        const provider = new ethers.JsonRpcProvider(ip);
        const network = await provider.getNetwork();
        console.log(`✅ Connected to blockchain: ${network.name} (Chain ID: ${network.chainId})`);
    } catch (error) {
        console.error("❌ Error connecting to blockchain:", error);
    }
}



// Verifică conexiunea imediat ce aplicația pornește
checkEthersConnection();


module.exports = app;

