// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
/* CONTRACTUL GLOBAL
   Acest contract colectează rezultatele de la toate nodurile, stocate într-un mapping,
   și calculează planul optim global folosind un mapping (cheia fiind ora din zi).
   Astfel se elimină necesitatea de a gestiona explicit matrice 2D.
*/

/* INTERFAȚĂ PENTRU GLOBAL CONTRACT */
interface GlobalContractInterface {
    function updateNodeResult(
        int[] calldata newPosition,
        int newScore,
        uint[] calldata newFlexibilityWeight
    ) external;
    function getGlobalOptimalPlanArray() external view returns (int[] memory);
    function getLastUpdatedTimestamp() external view returns (uint);
    function getBestGlobalPlan() external view returns (int[] memory);
    function frozenGlobalCost() external view returns (int);
}

contract GlobalContract {
    struct NodeResult {
        int[] bestPosition;
        int bestScore;
        uint[] flexibilityWeight;
        bool exists;
    }

    // Mapping de la adresa nodului la rezultatul său
    mapping(address => NodeResult) public nodeResults;
    // Lista adreselor nodurilor înregistrate
    address[] public nodeAddresses;

    // ── Cluster registry ────────────────────────────────────────────────────
    // Tracks which nodeAddresses entries are ClusterContracts rather than
    // individual nodes.  Purely informational — the aggregation logic is identical
    // because a ClusterContract reports itself as a single "super-node".
    mapping(address => bool) public isCluster;
    // Mapping de la oră (index) la valoarea optimă agregată (planul global)
    mapping(uint => int) public globalOptimalPlan;
    // Numărul de ore pentru care se definește planul (ex.: 24)
    uint public numHours;

    // Variabile noi pentru stocarea celui mai bun rezultat global
    int public bestGlobalCost = type(int).max;
    int[] public bestGlobalPlan;

    int public frozenGlobalCost;
    uint public lastUpdatedTimestamp; // Momentul ultimei actualizări globale

    bool public finalized = false;

    event NodeResultUpdated(address indexed node, int bestScore);
    event GlobalPlanComputed(
        address indexed trigger,
        int[] newPlan,
        uint timestamp
    );
    /// @notice Emitted when a ClusterContract registers itself as a cluster aggregator.
    event ClusterRegistered(address indexed cluster);

    // Nodurile apelează această funcție pentru a-și transmite rezultatul optim.
    // Se folosește un mapping pentru a stoca rezultatele și o listă pentru a itera ulterior.
    function updateNodeResult(
        int[] calldata newPosition,
        int newScore,
        uint[] calldata newFlexibilityWeight
    ) external {
        if (!nodeResults[msg.sender].exists) {
            nodeResults[msg.sender] = NodeResult(
                newPosition,
                newScore,
                newFlexibilityWeight,
                true
            );
            nodeAddresses.push(msg.sender);
        } else {
            if (newScore < nodeResults[msg.sender].bestScore) {
                nodeResults[msg.sender].bestScore = newScore;
                nodeResults[msg.sender].bestPosition = newPosition;
                nodeResults[msg.sender]
                    .flexibilityWeight = newFlexibilityWeight;
            }
        }
        // Setează numărul de ore din planul de consum, dacă nu a fost deja stabilit.
        if (numHours == 0) {
            numHours = newPosition.length;
        } else {
            require(
                newPosition.length == numHours,
                "Dimensiune necorespunzatoare"
            );
        }
        emit NodeResultUpdated(msg.sender, newScore);
    }

    /**
     * @notice Called by a ClusterContract to declare itself as a cluster aggregator.
     *         This is optional and purely informational — it marks the caller's address
     *         in the isCluster mapping so off-chain tooling can distinguish clusters from
     *         individual nodes when reading nodeAddresses.
     *
     *         ClusterContracts should call this once after deployment.
     */
    function registerAsCluster() external {
        isCluster[msg.sender] = true;
        emit ClusterRegistered(msg.sender);
    }

    // Returnează planul global complet sub formă de array.
    function getGlobalOptimalPlanArray() external view returns (int[] memory) {
        int[] memory copy = new int[](numHours);
        for (uint i = 0; i < numHours; i++) {
            copy[i] = globalOptimalPlan[i];
        }
        return copy;
    }

    // Calculează planul global optim. Pentru fiecare oră, se calculează media planurilor
    // optime ale nodurilor și se stochează în mapping-ul globalOptimalPlan.
    function computeGlobalOptimalPlan() public {
        require(nodeAddresses.length > 0, "Niciun nod inregistrat");
        require(numHours > 0, "numHours nu este setat");

        // Calculul planului global curent ca medie ponderată
        for (uint i = 0; i < numHours; i++) {
            int weightedSum = 0;
            uint totalWeight = 0;
            for (uint j = 0; j < nodeAddresses.length; j++) {
                if (nodeResults[nodeAddresses[j]].exists) {
                    uint weight = nodeResults[nodeAddresses[j]]
                        .flexibilityWeight[i];
                    weightedSum +=
                        int(weight) *
                        nodeResults[nodeAddresses[j]].bestPosition[i];
                    totalWeight += weight;
                }
            }
            if (totalWeight > 0) {
                globalOptimalPlan[i] = weightedSum / int(totalWeight);
            } else {
                globalOptimalPlan[i] = 5; // Valoare default
            }
        }
        lastUpdatedTimestamp = block.timestamp;
        emit GlobalPlanComputed(
            msg.sender,
            this.getGlobalOptimalPlanArray(),
            lastUpdatedTimestamp
        );

        // Calculează costul total curent al rețelei (suma costurilor minime ale nodurilor)
        int currentNetworkCost = 0;
        for (uint j = 0; j < nodeAddresses.length; j++) {
            if (nodeResults[nodeAddresses[j]].exists) {
                currentNetworkCost += nodeResults[nodeAddresses[j]].bestScore;
            }
        }

        // Actualizează bestGlobalPlan doar dacă s-a găsit un cost mai mic
        if (bestGlobalPlan.length == 0 || currentNetworkCost < bestGlobalCost) {
            bestGlobalCost = currentNetworkCost;
            if (bestGlobalPlan.length != numHours) {
                bestGlobalPlan = new int[](numHours);
            }
            for (uint i = 0; i < numHours; i++) {
                bestGlobalPlan[i] = globalOptimalPlan[i];
            }
        }
    }

    // Funcția pentru a "îngheța" soluția finală
    function finalizePlan() external {
        finalized = true;
        frozenGlobalCost = bestGlobalCost;
    }
    // Returnează valoarea planului global pentru o anumită oră.
    function getGlobalOptimalPlanHour(uint hour) external view returns (int) {
        require(hour < numHours, "Ora in afara intervalului");
        return globalOptimalPlan[hour];
    }

    function getBestGlobalPlan() external view returns (int[] memory) {
        return bestGlobalPlan;
    }

    function getBestPosition(address _node) public view returns (int[] memory) {
        return nodeResults[_node].bestPosition;
    }

    function getLastUpdatedTimestamp() external view returns (uint) {
        return lastUpdatedTimestamp;
    }

    function getNodeAddresses() public view returns (address[] memory) {
        return nodeAddresses;
    }
}
