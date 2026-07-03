// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title  ClusterContract
 * @notice Hierarchical PSO cluster aggregator sitting between Node contracts and the
 *         GlobalContract.  Each cluster manages a set of prosumer Nodes as its
 *         neighbourhood swarm.  After every PSO iteration the cluster:
 *
 *   1. Aggregates the per-node best positions into a weighted-average
 *      intra-cluster plan  (clusterBestPlan).
 *   2. Propagates the aggregated result up to the parent GlobalContract so the
 *      network-wide optimisation can proceed.
 *
 * Benefits over flat PSO
 * ──────────────────────
 * • Decentralised: each cluster optimises independently; only the summary is
 *   sent to the global level, reducing on-chain communication.
 * • Neighbourhood-best: nodes use the cluster best plan as their social guide
 *   (c2 term) instead of the full network-wide plan, which improves exploration
 *   diversity and avoids premature convergence.
 * • Scalable: adding more clusters adds no extra work to the GlobalContract.
 *
 * TDM compatibility
 * ─────────────────
 * ClusterContract is fully compatible with the TDM-enabled Node contracts;
 * the cluster plan it produces is already time-slot-aware because it is built
 * from TDM-optimised node positions.
 */

/* ── Interface for the parent GlobalContract ───────────────────────────────── */
interface IGlobalContract {
    function updateNodeResult(
        int[]  calldata newPosition,
        int    newScore,
        uint[] calldata newFlexibilityWeight
    ) external;
    function getBestGlobalPlan() external view returns (int[] memory);
    function getLastUpdatedTimestamp() external view returns (uint);
    function frozenGlobalCost() external view returns (int);
}

contract ClusterContract {

    // ── Storage ──────────────────────────────────────────────────────────────

    struct NodeResult {
        int[]  bestPosition;
        int    bestScore;
        uint[] flexibilityWeight;
        bool   exists;
    }

    /// @notice Parent GlobalContract reference.
    IGlobalContract public globalContract;

    /// @notice Node results keyed by node address.
    mapping(address => NodeResult) public nodeResults;
    address[] public nodeAddresses;

    /// @notice Number of time slots (set on first updateNodeResult call).
    uint public numHours;

    /// @notice Current iteration weighted-average plan.
    mapping(uint => int) public clusterOptimalPlan;

    /// @notice Best cluster plan seen across all iterations.
    int[] public clusterBestPlan;

    /// @notice Aggregate cost of all nodes' personal bests at the best iteration.
    int public clusterBestCost = type(int).max;

    /// @notice Timestamp of the last computeClusterPlan call.
    uint public lastUpdatedTimestamp;

    // ── Events ────────────────────────────────────────────────────────────────

    event NodeRegistered(address indexed node);
    event ClusterResultUpdated(address indexed node, int score);
    event ClusterPlanComputed(
        address indexed trigger,
        int[]   plan,
        uint    timestamp
    );

    // ── Constructor ───────────────────────────────────────────────────────────

    /**
     * @param _globalContract Address of the deployed GlobalContract.
     */
    constructor(address _globalContract) {
        require(_globalContract != address(0), "Invalid global contract address");
        globalContract = IGlobalContract(_globalContract);
    }

    // ── Node-facing interface (mirrors GlobalContract) ────────────────────────

    /**
     * @notice Called by each Node to push its personal-best result into the cluster.
     *
     * @dev The signature is intentionally identical to GlobalContract.updateNodeResult
     *      so Node contracts can point their `clusterContract` reference at this
     *      contract without any interface change.
     *
     * @param newPosition         Node's current best consumption plan (one value per hour).
     * @param newScore            Objective-function value of that plan.
     * @param newFlexibilityWeight Per-hour flexibility weight used for the weighted average.
     */
    function updateNodeResult(
        int[]  calldata newPosition,
        int    newScore,
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
            emit NodeRegistered(msg.sender);
        } else {
            // Only update if the new score is strictly better.
            if (newScore < nodeResults[msg.sender].bestScore) {
                nodeResults[msg.sender].bestScore         = newScore;
                nodeResults[msg.sender].bestPosition      = newPosition;
                nodeResults[msg.sender].flexibilityWeight = newFlexibilityWeight;
            }
        }

        if (numHours == 0) {
            numHours = newPosition.length;
        } else {
            require(newPosition.length == numHours, "Position length mismatch");
        }

        emit ClusterResultUpdated(msg.sender, newScore);
    }

    // ── Cluster aggregation ───────────────────────────────────────────────────

    /**
     * @notice Computes the intra-cluster weighted-average optimal plan, keeps the
     *         best plan seen so far, and propagates the aggregated result up to the
     *         parent GlobalContract.
     *
     *         Call order in the PSO loop:
     *           1. All nodes call updateBestPositions()  (→ updateNodeResult here)
     *           2. ClusterContract.computeClusterPlan()  (this function)
     *           3. GlobalContract.computeGlobalOptimalPlan()
     *           4. All nodes call updateVelocityAndPosition()
     */
    function computeClusterPlan() external {
        require(nodeAddresses.length > 0, "No nodes registered in cluster");
        require(numHours > 0, "numHours not set");

        // ── Step 1: weighted-average plan across cluster nodes ────────────────
        for (uint i = 0; i < numHours; i++) {
            int  weightedSum = 0;
            uint totalWeight = 0;
            for (uint j = 0; j < nodeAddresses.length; j++) {
                NodeResult storage nr = nodeResults[nodeAddresses[j]];
                if (nr.exists) {
                    uint wt = nr.flexibilityWeight[i];
                    weightedSum += int(wt) * nr.bestPosition[i];
                    totalWeight += wt;
                }
            }
            clusterOptimalPlan[i] = (totalWeight > 0)
                ? weightedSum / int(totalWeight)
                : int(5); // default fallback
        }

        // ── Step 2: sum of node personal-best scores = cluster cost ───────────
        int currentClusterCost = 0;
        for (uint j = 0; j < nodeAddresses.length; j++) {
            if (nodeResults[nodeAddresses[j]].exists) {
                currentClusterCost += nodeResults[nodeAddresses[j]].bestScore;
            }
        }

        // ── Step 3: update clusterBestPlan if improved ────────────────────────
        if (clusterBestPlan.length == 0 || currentClusterCost < clusterBestCost) {
            clusterBestCost = currentClusterCost;
            if (clusterBestPlan.length != numHours) {
                clusterBestPlan = new int[](numHours);
            }
            for (uint i = 0; i < numHours; i++) {
                clusterBestPlan[i] = clusterOptimalPlan[i];
            }
        }

        lastUpdatedTimestamp = block.timestamp;
        emit ClusterPlanComputed(msg.sender, clusterBestPlan, lastUpdatedTimestamp);

        // ── Step 4: propagate aggregated result to GlobalContract ─────────────
        // The cluster reports itself as a single "super-node" to the global level.
        uint[] memory avgWeights = _computeAggregateWeights();
        globalContract.updateNodeResult(clusterBestPlan, currentClusterCost, avgWeights);
    }

    // ── Read helpers ──────────────────────────────────────────────────────────

    /**
     * @notice Returns the best cluster plan for use as the PSO social (neighbourhood) guide
     *         in the velocity update of each Node.
     */
    function getClusterBestPlan() external view returns (int[] memory) {
        return clusterBestPlan;
    }

    /**
     * @notice Forwards the network-wide best plan from GlobalContract.
     *         Used by Node contracts for global-deviation penalty calculation.
     */
    function getBestGlobalPlan() external view returns (int[] memory) {
        return globalContract.getBestGlobalPlan();
    }

    /**
     * @notice Returns the timestamp of the last computeClusterPlan call.
     *         Nodes can use this to check whether a fresh cluster plan is available.
     */
    function getLastUpdatedTimestamp() external view returns (uint) {
        return lastUpdatedTimestamp;
    }

    /**
     * @notice Forwards the frozen global cost from GlobalContract.
     */
    function frozenGlobalCost() external view returns (int) {
        return globalContract.frozenGlobalCost();
    }

    /**
     * @notice Returns the current iteration weighted-average cluster plan as an array.
     */
    function getClusterOptimalPlanArray() external view returns (int[] memory) {
        int[] memory arr = new int[](numHours);
        for (uint i = 0; i < numHours; i++) {
            arr[i] = clusterOptimalPlan[i];
        }
        return arr;
    }

    /**
     * @notice Returns the addresses of all nodes registered in this cluster.
     */
    function getNodeAddresses() external view returns (address[] memory) {
        return nodeAddresses;
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    /**
     * @dev Computes per-hour average flexibility weight across all cluster nodes.
     *      Used as the aggregate weight when reporting the cluster result to GlobalContract.
     */
    function _computeAggregateWeights() internal view returns (uint[] memory) {
        uint[] memory avg = new uint[](numHours);
        for (uint i = 0; i < numHours; i++) {
            uint total = 0;
            uint count = 0;
            for (uint j = 0; j < nodeAddresses.length; j++) {
                if (nodeResults[nodeAddresses[j]].exists) {
                    total += nodeResults[nodeAddresses[j]].flexibilityWeight[i];
                    count++;
                }
            }
            avg[i] = (count > 0) ? total / count : 1;
        }
        return avg;
    }
}
