
let ErrorHandling = require('../models/error-handling');

let TRANSACTION_PARAMETERS = {
    'GAS': 3000000000,
    'GAS_PRICE': '300000000000'
};

function getPastEventsWithDetails(contract, event, eventModel, filter, startBlock, endBlock, callback) {
    contract.getPastEvents(event, {filter: filter, fromBlock: startBlock, toBlock: endBlock}, (error, events) => {
        let values = [];
        for (let i = 0; i < events.length; i++) {
            let value = eventModel(events[i]);
            values.push(value);
        }
        return callback(null, values);
    }).catch((err) => {
        console.log(1);
        return callback(ErrorHandling.factoryPartialErrorHandling(new createError.InternalServerError("EVM revert on getPastEvents-getPastEvents")));
    });
}


module.exports = {
    TRANSACTION_PARAMETERS,
    getPastEventsWithDetails
};
