require("@nomicfoundation/hardhat-ignition-ethers");

module.exports = {
    solidity: {
        version: "0.8.23",
        evmVersion: "paris",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            },
            viaIR: true
        }
    },
    networks: {
        hardhat: {
            chainId: 1337,
            allowUnlimitedContractSize: true,
            allowUnlimitedTransactionSize: true,
            accounts: {
                count: 40
            }
        }
    },
    paths: {
        sources: "./contracts",
        tests: "./test",
        cache: "./cache",
        artifacts: "./artifacts"
    },
    mocha: {
        timeout: 40000
    }
}