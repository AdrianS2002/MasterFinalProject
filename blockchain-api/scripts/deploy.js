let mysql = require('mysql2');
const SqlErrors = require("../src/models/db-errors");
const { loadCSVData } = require("../scripts/loadCSVData");
const { setResults } = require('./psoResults');
let dbIp = 'localhost';
let dbUser = 'root';
let dbPass = 'root';
let dbname = 'licenta-dsrl';  // licenta-dsrl
 
let db_config = {
    host: dbIp,
    user: dbUser,
    password: dbPass,
    database: dbname
};
 
let db;
 
const sqlDeleteAllContracts = "DELETE FROM contracts WHERE true;";
const sqlAddContractWithOwner = "INSERT INTO contracts (id, name, address, owner, type) VALUES (?, ?, ?, ?, ?)";
const sqlAddContractWithOwnerMe = "INSERT INTO contracts (name, address, owner, type) VALUES (?, ?, ?, ?)";
 
InsertContractWithUUID = (contract_uuid, name, address, owner, type) => {
    db.query(sqlAddContractWithOwner, [contract_uuid, name, address, owner, type], (err, contract) => {
        if (err) {
            console.log(new SqlErrors.SqlError("QueryInsertContract"));
            console.error("SQL Insert Error:", err.sqlMessage || err);
            console.error("Query:", sqlAddContractWithOwner);
            console.error("Params:", { contract_uuid, name, address, owner, type });
        }
        try {
            console.log("Inserted: " + name + " with address: " + address);
        } catch (e) {
            console.log(e);
        }
    });
};
 
const InsertContract = (name, address, owner, type) => {
    // console.log(`📥 Inserting contract ${name}, type ${type}, address ${address}, owner ${owner} in DB`);
    db.query(sqlAddContractWithOwnerMe, [name, address, owner, type], (err) => {
        if (err) {
            console.error("❌ SQL Insert Error:", err.sqlMessage || err);
            console.error("Query:", sqlAddContractWithOwnerMe);
            console.error("Params:", { name, address, owner, type });
        } else {
            //  console.log(`✅ Inserted contract: ${name} with address: ${address}`);
        }
    });
};
 
 
const sqlAddLocation = "INSERT INTO locations (contract_id, country, city, address) VALUES (?, ?, ?, ?)";
 
function InsertLocation(contractId, country, city, address) {
    db.query(sqlAddLocation, [contractId, country, city, address], (err) => {
        if (err) {
            console.error("❌ SQL Insert Location Error:", err.sqlMessage || err);
            console.error("Query:", sqlAddLocation);
            console.error("Params:", { contractId, country, city, address });
        } else {
            // console.log(`📍 Inserted location: ${country}, ${city}, ${address} for contract ${contractId}`);
        }
    });
}
 
DeleteAll = () => {
    db.query(sqlDeleteAllContracts, (err, result) => {
        if (err) {
            console.log(new SqlErrors.SqlError("DeleteAllContracts"));
        }
        console.log("Deleted all contracts");
    });
};
 
async function getAddressByUsername(username) {
    //console.log(`🔎 Caut adresa pentru username: ${username}`);
    const [rows] = await db.promise().query(
        'SELECT address FROM users WHERE id = (SELECT user_id FROM credentials WHERE username = ?)',
        [username]
    );
    console.log("📥 Rezultat găsit pentru user:", rows);
    if (rows.length > 0) {
        console.log(`✅ Adresă utilizator: ${rows[0].address}`);
        return rows[0].address;
    } else {
        throw new Error(`❌ User ${username} not found in DB`);
    }
}
 
 
async function runPSO(globalContract, nodes, clusters = [], iterations = 3) {
    // console.log("=== Initial Node Positions ===");
    const iterationStats = [];
    const iterStatsGrid = []
    for (let i = 0; i < nodes.length; i++) {
        let posArray = Array.from(await nodes[i].getPosition());
        //console.log(`Node ${i + 1} initial position:`, posArray.map(p => p.toString()));
        await nodes[i].updateBestPositions();
    }
 
    // Flush each cluster before computing the global plan (hierarchical PSO).
    // This is a no-op when clusters = [] (flat-PSO mode).
    for (const cluster of clusters) {
        await cluster.computeClusterPlan();
    }
    await globalContract.computeGlobalOptimalPlan();
    //console.log("\n=== Initial Global Plan ===");
    let initialPlan = Array.from(await globalContract.getGlobalOptimalPlanArray());
    console.log(initialPlan.map(x => x.toString()));
    let avgExecTime = 0;
    for (let iter = 0; iter < iterations; iter++) {
        const iterStart = Date.now();
        //console.log(`\n--- Iteration ${iter + 1} ---`);
 
        for (const node of nodes) {
            await node.updateBestPositions();
        }
 
        // Flush clusters before global aggregation.
        for (const cluster of clusters) {
            await cluster.computeClusterPlan();
        }
        await globalContract.computeGlobalOptimalPlan();
        let currentGlobalPlan = Array.from(await globalContract.getGlobalOptimalPlanArray());
        // console.log(`Iteration ${iter + 1} - Global Plan:`, currentGlobalPlan.map(x => x.toString()));
 
        for (const node of nodes) {
            await node.updateVelocityAndPosition();
        }
 
        for (const node of nodes) {
            await node.updateBestPositions();
        }
 
        for (let i = 0; i < nodes.length; i++) {
            let posArray = Array.from(await nodes[i].getPosition());
            // console.log(`Node ${i + 1} position:`, posArray.map(x => x.toString()));
        }
 
        let totalCost = 0;
        let totalRenewable = 0;
        let totalConsumtionInGrid = 0;
        let bestGlobalCost = await globalContract.bestGlobalCost();
        for (const node of nodes) {
            const position = await node.getPosition();
            const tariff = await node.getTariff();
            const renewable = await node.getUsedRenewablePlan();
 
 
            for (let i = 0; i < position.length; i++) {
                const pos = Number(position[i]);
                const tar = Number(tariff[i]);
                const ren = Number(renewable[i]);
 
                totalCost += pos * tar;
                totalConsumtionInGrid += pos;
                totalRenewable += ren;
            }
        }
 
 
 
        console.log(`Iteration ${iter + 1} Consumption in hole grid: ${totalConsumtionInGrid}💰 Cost: ${totalCost / 100} | 🌿 Renewable Used: ${totalRenewable} bestGlobal ${bestGlobalCost}`);
        iterStatsGrid.push({
            iteration: iter + 1,
            totalConsumtionInGrid,
            totalCost: (totalCost / 100).toFixed(2),
            totalRenewable: (totalRenewable),
            bestGlobalCost: bestGlobalCost,
        });
        const iterEnd = Date.now();
        let execTimeMs = ((iterEnd - iterStart) / 1000).toFixed(2);
 
        avgExecTime += parseFloat(execTimeMs);
        iterationStats.push({
            iteration: iter + 1,
            execTimeMs,
            globalPlan: currentGlobalPlan.map(x => x.toString()),
            avgExecTime,
        });
 
        console.log(`🕒 Iteration ${iter + 1} took ${execTimeMs}ms`);
    }
    console.log(`\nAverage execution time per iteration: ${(avgExecTime / iterations).toFixed(2)} seconds`);
    await globalContract.finalizePlan();
    console.log("✅ Plan finalized in contract.");
    console.log("\n📊 Iteration performance summary:");
    console.table(iterationStats);
    setResults(iterStatsGrid);
    console.log("PSO Results set in psoResults.js", iterStatsGrid);
    return iterStatsGrid;
 
}
 
async function getContractIdByAddress(address) {
    const [rows] = await db.promise().query("SELECT id FROM contracts WHERE address = ?", [address]);
    return rows.length > 0 ? rows[0].id : null;
}
 
 
 
// Connect to DB, delete all contracts,
async function main() {
    console.log(`🌐 Connecting to MySQL at ${dbIp}, database: ${dbname}...`);
 
 
    db = mysql.createConnection(db_config); // Recreate the connection, since the old one cannot be reused.
 
    console.log('Connecting... ');
    db.connect(function (err) {
        if (err) {
            console.log('error when connecting to db:', err);
        }
    });
 
    DeleteAll();
 
    const accounts = await ethers.getSigners();  // All accounts from hardhat.config
 
    const nodeParams = await loadCSVData();
 
    // const SCALE = 1e6;
    // function scaleArray(arr, scale = SCALE) {
    //     return arr.map(val => Math.floor(val * scale)); // sau Math.round
    // }
 
 
    // for (let i = 0; i < nodeParams.length; i++) {
    //     const node = nodeParams[i];
 
    //     node.initialPosition = scaleArray(node.initialPosition);
    //     node.initialVelocity = scaleArray(node.initialVelocity);
    //     node.initialTariff = scaleArray(node.initialTariff);
    //     node.initialCapacity = scaleArray(node.initialCapacity);
    //     node.initialRenewableGeneration = scaleArray(node.initialRenewableGeneration);
    //     node.initialBatteryCapacity = scaleArray(node.initialBatteryCapacity);
    //     node.initialBatteryCharge = scaleArray(node.initialBatteryCharge);
    //     node.initialFlexibleLoad = scaleArray(node.initialFlexibleLoad);
    //     node.flexibilityAbove = scaleArray(node.flexibilityAbove);
    //     node.flexibilityBelow = scaleArray(node.flexibilityBelow);
    // }
 
    //console.log("🔹 CSV Data Loaded:", JSON.stringify(nodeParams, null, 2));
 
    const DateTime = await ethers.getContractFactory("DateTime");
    const dateTime = await DateTime.deploy();
    await dateTime.waitForDeployment();
    // Fetch all usernames dynamically from the database
    const [userRows] = await db.promise().query("SELECT username FROM credentials");
    const allUsernames = userRows.map(row => row.username);
    
    console.log(`👥 Found ${allUsernames.length} users in the database:`, allUsernames);
 
    // Deploy GlobalContract using ethers v6
    const GlobalContract = await ethers.getContractFactory("GlobalContract");
    const globalContract = await GlobalContract.deploy();
    await globalContract.waitForDeployment();
    console.log("Deployed GlobalContract at:", globalContract.target);
 
    // Deploy Node folosind globalContract.target
    const Node = await ethers.getContractFactory("Node");
    let nodes = [];
 
    for (let i = 0; i < nodeParams.length; i++) {
        const params = nodeParams[i];
 
        const node = await Node.deploy(
            globalContract.target,
            [...params.initialPosition],
            [...params.initialVelocity],
            [...params.initialTariff],
            [...params.initialCapacity],
            [...params.initialRenewableGeneration],
            [...params.initialBatteryCapacity],
            [...params.initialBatteryCharge],
            [...params.initialFlexibleLoad],
            [...params.flexibilityAbove],
            [...params.flexibilityBelow]
        );
 
        await node.waitForDeployment();
        nodes.push(node);
        // console.log(`✅ Node ${i + 1} deployed at:`, node.target);
 
        const code = await ethers.provider.getCode(node.target);
        // console.log(`🔍 Contract code length for Node ${i + 1}: ${code.length}`);
        if (code.length <= 2) {
            console.error(`❌ Contractul pentru Node ${i + 1} NU a fost implementat corect la adresa ${node.target}`);
        } else {
            // console.log(`✅ Contractul pentru Node ${i + 1} verificat on-chain la adresa ${node.target}`);
        }
 
        let ownerAddress = "0x0000000000000000000000000000000000000000";
 
        if (i === 0) {
            ownerAddress = "0x727d94033a8e61a8911ff9d84ae72222565eab09";
        }
        else if (i === 1) {
            ownerAddress = "0x09DB0a93B389bEF724429898f539AEB7ac2Dd55f";
        }
        else if (i === 2) {
            ownerAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
        }
        // Salvează nodul în baza de date
        InsertContract(`Node ${i + 1}`, node.target, ownerAddress, "Node");
        const contractId = await getContractIdByAddress(node.target);
 
        InsertLocation(contractId, "Romania", `Cluj-Napoca`, `Nicolae Titulescu Nr. ${i + 1}`);
    }
 
    // Save contracts in database using .target
    InsertContract("GlobalContract", globalContract.target, accounts[0].address, "GlobalContract");

    // =========================================================================
    // 🚀 DEPLOY MARKET CONTRACTS (DAY-AHEAD & INTRADAY)
    // =========================================================================
    console.log("\n🏛️ Deploying Market Contracts...");

    // 1. Deploy DayAheadMarket
    const DayAheadMarket = await ethers.getContractFactory("DayAheadMarket");
    const dayAheadMarket = await DayAheadMarket.deploy();
    await dayAheadMarket.waitForDeployment();
    console.log("✅ Deployed DayAheadMarket at:", dayAheadMarket.target);

    // 2. Deploy IntradayMarket (assuming it accepts the DA market address in its constructor)
    const IntradayMarket = await ethers.getContractFactory("IntradayMarket");
    const intradayMarket = await IntradayMarket.deploy(dayAheadMarket.target);
    await intradayMarket.waitForDeployment();
    console.log("✅ Deployed IntradayMarket at:", intradayMarket.target);


    // =========================================================================
    // 💾 AUTOMATICALLY REGISTER MARKETS FOR ALL USERS
    // =========================================================================
    console.log("\n👥 Registering marketplaces for all users in DB...");

    // Define all the usernames that need access to the dashboards/marketplaces
    const marketUsers = allUsernames;

    for (const username of marketUsers) {
        // Register DayAheadMarket for this user
        InsertContract(
            `DayAhead Market - ${username}`, 
            dayAheadMarket.target, 
            username, 
            "DayAheadMarket"  // Must match exactly what your API searches for
        );

        // Register IntradayMarket for this user
        InsertContract(
            `Intraday Market - ${username}`, 
            intradayMarket.target, 
            username, 
            "IntradayMarket"   // Must match exactly what your API searches for
        );
        
        console.log(`📡 Linked Day-Ahead & Intraday markets to user: ${username}`);
    }

    
 
    // ── Deploy ClusterContracts (decentralised / hierarchical PSO) ────────────
    // Nodes are grouped into clusters of NODES_PER_CLUSTER.
    // Each cluster aggregates its nodes' results before reporting to GlobalContract.
    const NODES_PER_CLUSTER = 10;
    const ClusterContractFactory = await ethers.getContractFactory("ClusterContract");
    const clusters = [];

    for (let ci = 0; ci < nodes.length; ci += NODES_PER_CLUSTER) {
        const clusterNodes = nodes.slice(ci, ci + NODES_PER_CLUSTER);
        const clusterIndex = Math.floor(ci / NODES_PER_CLUSTER) + 1;

        const cluster = await ClusterContractFactory.deploy(globalContract.target);
        await cluster.waitForDeployment();
        console.log(`Deployed Cluster ${clusterIndex} at: ${cluster.target}`);

        // Wire each node in this cluster to the ClusterContract.
        for (const node of clusterNodes) {
            const tx = await node.setClusterContract(cluster.target);
            await tx.wait();
        }

        // Register cluster in DB strictly for 'dsrl' so only they see it
        InsertContract(
            `Cluster ${clusterIndex}`, 
            cluster.target, 
            "dsrl", // <-- Changed from accounts[0].address to the username "dsrl"
            "Cluster"
        );
        clusters.push(cluster);
    }
    console.log(`✅ Deployed ${clusters.length} cluster(s), wired ${nodes.length} nodes to their clusters.`);
 
    //  const TestContract = await ethers.getContractFactory("TestContract");
    // const testContract = await TestContract.connect(accounts[1]).deploy(100);
    //await testContract.waitForDeployment();
    // await InsertContractWithUUID("d00597e0-2e5c-4487-ac6c-72866ad3514c", "TestContract", testContract.target, accounts[1].address, "TestContract");
 
    console.log("===========================================");
    db.query('SELECT * FROM contracts', (err, results) => {
        if (err) {
            console.error("❌ Eroare la citirea contractelor din DB");
        } else {
            // console.log("📜 Contractele existente în baza de date:");
            // console.table(results);
        }
    });
 
    console.log("\n🚀 Running PSO optimization after deploy...");
    const startTime = Date.now();
    await runPSO(globalContract, nodes, clusters, 20);
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.log("Timp total pentru PSO:", duration, "secunde");
    // console.log("\n✅ PSO Optimization completed and frozen in blockchain.");
 
    // Opțional: verifici frozen cost-ul:
    const frozenCost = await globalContract.bestGlobalCost();
    console.log(`💰 Frozen best global cost after deploy optimization: ${frozenCost}`);
 
}
 
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });