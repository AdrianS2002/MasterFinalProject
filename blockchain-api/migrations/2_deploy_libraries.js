let DateTimeLibrary = artifacts.require("./DateTime.sol");

let dateTimeLibrary;


function linkFile(path){
    let fs = require('fs')
    fs.readFile(path, 'utf8', function (err,data) {
        if (err) {
            return console.log(err);
        }

        data = data.replace(/_+DateTime__+/g, dateTimeLibrary.address.replace("0x",""));

        fs.writeFile(path, data, 'utf8', function (err) {
            if (err) return console.log(err);
        });
    });
}
function solveCompilation(){
    linkFile('build/contracts/TestContract.json');
}
module.exports = function(deployer) {
    deployer.then(function() {
        return deployer.deploy(DateTimeLibrary);
    }).then(function(instance) {
        dateTimeLibrary = instance;
        console.log("DateTime Library");
        console.log(dateTimeLibrary.address);
        solveCompilation();
    });
};
