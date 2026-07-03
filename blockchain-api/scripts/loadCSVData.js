const fs = require("fs");
const csv = require("csv-parser");

function fixArrayFormat(value) {
    return JSON.parse(value.replace(/""/g, '"')); // Convert CSV string to an array
}

async function loadCSVData() {
    return new Promise((resolve, reject) => {
        let nodeParams = [];

        fs.createReadStream("data/nodes.csv")
            .pipe(csv())
            .on("data", (row) => {
                 if (Object.values(row).every(value => value === '')) {
        return;
    }
                try {
                    nodeParams.push({
                        initialPosition: JSON.parse(JSON.stringify(fixArrayFormat(row.initialPosition))), 
                        initialVelocity: JSON.parse(JSON.stringify(fixArrayFormat(row.initialVelocity))),
                        initialTariff: JSON.parse(JSON.stringify(fixArrayFormat(row.initialTariff))),
                        initialCapacity: JSON.parse(JSON.stringify(fixArrayFormat(row.initialCapacity))),
                        initialRenewableGeneration: JSON.parse(JSON.stringify(fixArrayFormat(row.initialRenewableGeneration))),
                        initialBatteryCapacity: JSON.parse(JSON.stringify(fixArrayFormat(row.initialBatteryCapacity))),
                        initialBatteryCharge: JSON.parse(JSON.stringify(fixArrayFormat(row.initialBatteryCharge))),
                        initialFlexibleLoad: JSON.parse(JSON.stringify(fixArrayFormat(row.initialFlexibleLoad))),
                        flexibilityAbove: JSON.parse(JSON.stringify(fixArrayFormat(row.flexibilityAbove))),
                        flexibilityBelow: JSON.parse(JSON.stringify(fixArrayFormat(row.flexibilityBelow)))
                    });
                } catch (error) {
                    console.error("❌ Eroare la parsarea unui rând din CSV:", row);
                    console.error("Mesaj eroare:", error.message);
                }
            })
            .on("end", () => {
                if (nodeParams.length === 0) {
                    return reject(new Error("❌ CSV-ul este gol sau datele nu au fost parseate corect."));
                }

                // 🔹 Afișăm conținutul nodeParams înainte de returnare
              //  console.log("🔹 Before returning nodeParams:", JSON.stringify(nodeParams, null, 2));

                resolve(nodeParams);
            })
            .on("error", (error) => {
                reject(error);
            });
    });
}

module.exports = { loadCSVData };
