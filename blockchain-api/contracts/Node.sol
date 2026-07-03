//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

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

/**
 * @notice Interface for ClusterContract — the PSO neighbourhood aggregator.
 *         Exposes the same updateNodeResult / getLastUpdatedTimestamp signatures as
 *         GlobalContractInterface so Node contracts can be wired to a cluster with
 *         no constructor changes.  The additional getClusterBestPlan() method returns
 *         the intra-cluster best plan used as the PSO social (neighbourhood) guide.
 */
interface IClusterContract {
    function updateNodeResult(
        int[] calldata newPosition,
        int newScore,
        uint[] calldata newFlexibilityWeight
    ) external;
    /// @notice Intra-cluster best plan — used as the c2 social guide in velocity update.
    function getClusterBestPlan() external view returns (int[] memory);
    /// @notice Forwards the network-wide best plan for global-deviation penalty calculation.
    function getBestGlobalPlan() external view returns (int[] memory);
    function getLastUpdatedTimestamp() external view returns (uint);
    function frozenGlobalCost() external view returns (int);
}

/* CONTRACTUL PENTRU UN NOD (prosumer)
   Fiecare nod își gestionează planul de consum pe ore și își actualizează
   poziția și costul folosind un algoritm PSO. Se salvează snapshot-ul costului
   optim și al anumitor parametri (ex.: resurse regenerabile și nivelul bateriei)
   pentru a putea recalcula costul ulterior, în condiții identice.
*/
contract Node {
    // Vectorii pentru planul de consum (ex: 24 de ore)
    int[] public position;
    int[] public velocity;
    int[] public personalBestPosition;
    int public personalBestScore = type(int).max;
    uint public lastKnownGlobalTimestamp;

    // Parametrii PSO (scalari — folosiți ca fallback când TDM nu este activat)
    int public w = 50;
    int public c1 = 200;
    int public c2 = 200;

    // ── TDM PSO parameters ────────────────────────────────────────────────────
    // Per-hour arrays that override the scalar values above once tdmEnabled = true.
    // Typical strategy:
    //   • Peak hours   (07-09, 17-20): low w (less inertia), high c2 (align with cluster)
    //   • Off-peak     (22-06):        high w (keep momentum), high c1 (explore personally)
    //   • Shoulder     (rest):         medium values
    int[] public w_tdm;
    int[] public c1_tdm;
    int[] public c2_tdm;
    bool  public tdmEnabled;

    // Date specifice nodului
    int[] public tariff;
    uint[] public capacity;
    uint[] public renewableGeneration;
    uint[] public batteryCapacity;
    uint[] public batteryCharge;
    uint[] public flexibleLoad;
    int[] public baselinePosition;

    // Penalizări locale (scalare — fallback când TDM nu este activat)
    int public ALPHA = 75;
    int public BETA = 43;
    int public GAMMA = 18;

    // ── TDM penalty parameters ────────────────────────────────────────────────
    // Per-hour penalty coefficients.  Example:
    //   • Peak hours:   higher ALPHA (capacity constraints tighter)
    //   • Off-peak:     lower BETA/GAMMA (more flexibility tolerance)
    int[] public ALPHA_tdm;
    int[] public BETA_tdm;
    int[] public GAMMA_tdm;

    // Parametrii pentru influența planului global
    int constant PENALTY_GLOBAL = 4;
    int constant REDEEM_GLOBAL = 2;

    // Valorile de flexibilitate
    uint[] public flexibilityAbove;
    uint[] public flexibilityBelow;

    GlobalContractInterface public globalContract;

    /// @notice Optional cluster reference.  When set:
    ///   • node reports its result to the cluster instead of directly to GlobalContract;
    ///   • velocity update uses cluster best plan as PSO social guide (hierarchical PSO).
    /// When address(0), the node operates in classic flat-PSO mode (backwards compatible).
    IClusterContract public clusterContract;

    event BestPositionUpdated(address indexed node, int newScore);
    event NewPlanReceived(uint timestamp);
    event ClusterContractSet(address indexed cluster);
    event TDMParametersSet(uint numSlots);

    // changed: Adăugăm variabile pentru snapshot-ul parametrilor critici
    uint[] public frozenRenewableGeneration;
    uint[] public frozenBatteryCharge;

    // Constructor extins
    constructor(
        address globalContractAddress,
        int[] memory initialPosition,
        int[] memory initialVelocity,
        int[] memory initialTariff,
        uint[] memory initialCapacity,
        uint[] memory initialRenewableGeneration,
        uint[] memory initialBatteryCapacity,
        uint[] memory initialBatteryCharge,
        uint[] memory initialFlexibleLoad,
        uint[] memory _flexibilityAbove,
        uint[] memory _flexibilityBelow
    ) {
        globalContract = GlobalContractInterface(globalContractAddress);
        baselinePosition = initialPosition;
        position = new int[](initialPosition.length);
        velocity = new int[](initialVelocity.length);
        personalBestPosition = new int[](initialPosition.length);
        tariff = new int[](initialTariff.length);
        capacity = new uint[](initialCapacity.length);
        renewableGeneration = new uint[](initialRenewableGeneration.length);
        batteryCapacity = new uint[](initialBatteryCapacity.length);
        batteryCharge = new uint[](initialBatteryCharge.length);
        flexibleLoad = new uint[](initialFlexibleLoad.length);
        flexibilityAbove = new uint[](_flexibilityAbove.length);
        flexibilityBelow = new uint[](_flexibilityBelow.length);

        for (uint i = 0; i < initialPosition.length; i++) {
            position[i] = initialPosition[i];
            personalBestPosition[i] = initialPosition[i];
            velocity[i] = initialVelocity[i];
            tariff[i] = initialTariff[i];
            capacity[i] = initialCapacity[i];
            renewableGeneration[i] = initialRenewableGeneration[i];
            batteryCapacity[i] = initialBatteryCapacity[i];
            batteryCharge[i] = initialBatteryCharge[i];
            flexibleLoad[i] = initialFlexibleLoad[i];
            flexibilityAbove[i] = _flexibilityAbove[i];
            flexibilityBelow[i] = _flexibilityBelow[i];
        }
    }

    // ── TDM & Cluster Configuration ──────────────────────────────────────────

    /**
     * @notice Assign a ClusterContract as this node's neighbourhood aggregator.
     *         Once set, the node reports results to the cluster and uses the
     *         cluster best plan as its PSO social guide (c2 term).
     * @param _cluster Address of the deployed ClusterContract.
     *                 Pass address(0) to detach and revert to flat-PSO mode.
     */
    function setClusterContract(address _cluster) external {
        clusterContract = IClusterContract(_cluster);
        emit ClusterContractSet(_cluster);
    }

    /**
     * @notice Activate Time-Division Multiplexing for PSO and penalty parameters.
     *         Each array must have exactly position.length elements (one per hour).
     *
     *         Suggested 24-hour profile (scale values × 100 for fixed-point):
     *           w      — 70 off-peak, 40 peak  (higher inertia in quiet hours)
     *           c1     — 250 off-peak, 150 peak (more personal exploration off-peak)
     *           c2     — 150 off-peak, 250 peak (stronger social alignment at peak)
     *           ALPHA  — 50 off-peak, 100 peak  (strict capacity at peak)
     *           BETA   — 30 off-peak, 60 peak
     *           GAMMA  — 10 off-peak, 25 peak
     */
    function setTDMParameters(
        int[] calldata _w,
        int[] calldata _c1,
        int[] calldata _c2,
        int[] calldata _alpha,
        int[] calldata _beta,
        int[] calldata _gamma
    ) external {
        uint n = position.length;
        require(
            _w.length == n && _c1.length == n && _c2.length == n &&
            _alpha.length == n && _beta.length == n && _gamma.length == n,
            "TDM array length mismatch"
        );
        w_tdm     = _w;
        c1_tdm    = _c1;
        c2_tdm    = _c2;
        ALPHA_tdm = _alpha;
        BETA_tdm  = _beta;
        GAMMA_tdm = _gamma;
        tdmEnabled = true;
        emit TDMParametersSet(n);
    }

    // ── TDM-aware internal getters ────────────────────────────────────────────

    /// @dev Returns the inertia weight for a given hour slot (TDM-aware).
    function _getW(uint hour) internal view returns (int) {
        return (tdmEnabled && w_tdm.length > hour) ? w_tdm[hour] : w;
    }

    /// @dev Returns the cognitive (personal-best) coefficient for a given hour (TDM-aware).
    function _getC1(uint hour) internal view returns (int) {
        return (tdmEnabled && c1_tdm.length > hour) ? c1_tdm[hour] : c1;
    }

    /// @dev Returns the social (neighbourhood-best) coefficient for a given hour (TDM-aware).
    function _getC2(uint hour) internal view returns (int) {
        return (tdmEnabled && c2_tdm.length > hour) ? c2_tdm[hour] : c2;
    }

    /// @dev Returns the over-consumption penalty for a given hour (TDM-aware).
    function _getALPHA(uint hour) internal view returns (int) {
        return (tdmEnabled && ALPHA_tdm.length > hour) ? ALPHA_tdm[hour] : ALPHA;
    }

    /// @dev Returns the flexibility-violation penalty for a given hour (TDM-aware).
    function _getBETA(uint hour) internal view returns (int) {
        return (tdmEnabled && BETA_tdm.length > hour) ? BETA_tdm[hour] : BETA;
    }

    /// @dev Returns the unused-renewable penalty for a given hour (TDM-aware).
    function _getGAMMA(uint hour) internal view returns (int) {
        return (tdmEnabled && GAMMA_tdm.length > hour) ? GAMMA_tdm[hour] : GAMMA;
    }

    /* 
       Funcția obiectiv calculează costul total de energie pentru un plan de consum,
       ținând cont de consum, tarife, penalizări locale și ajustări globale.
    */
    function objectiveFunction(int[] memory pos) public view returns (int) {
        int totalCost = 0;
        uint len = pos.length;
        // Copii locale ale valorilor curente
        uint[] memory tempRenewable = renewableGeneration;
        uint[] memory tempBattery = batteryCharge;

        int[] memory globalPlan = globalContract.getBestGlobalPlan();

        for (uint i = 0; i < len; i++) {
            int consumption = pos[i];
            int localCost = 0;

            if (consumption < 0) {
                // int effectiveTariff = getEffectiveTariff(i, consumption);
                // localCost = -effectiveTariff * (-consumption);
                int exportTariff = int(tariff[i]); // sau poți seta o constantă fixă, ex: 5
                localCost = exportTariff * consumption; // va fi un număr pozitiv (cost)
            } else {
                uint cons = uint(consumption);
                if (tempRenewable[i] >= cons) {
                    tempRenewable[i] -= cons;
                    cons = 0;
                } else {
                    cons -= tempRenewable[i];
                    tempRenewable[i] = 0;
                }
                if (tempBattery[i] >= cons) {
                    tempBattery[i] -= cons;
                    cons = 0;
                } else {
                    cons -= tempBattery[i];
                    tempBattery[i] = 0;
                }
                localCost = int(tariff[i]) * int(cons);
            }

            int overConsumption = consumption > int(capacity[i])
                ? consumption - int(capacity[i])
                : int(0);
            int bestCons = personalBestPosition[i];
            int flex = int(flexibilityAbove[i] + flexibilityBelow[i]);
            int diff = consumption - bestCons;
            int absDiff = diff >= 0 ? diff : -diff;
            int flexibilityViolation = absDiff > flex ? absDiff - flex : int(0);
            int maxRenew = int(renewableGeneration[i]);
            int unusedRenewable = maxRenew > consumption
                ? maxRenew - consumption
                : int(0);
            // TDM-aware penalties: different weights for each hour slot.
            int localPenalty = overConsumption    * _getALPHA(i) +
                               flexibilityViolation * _getBETA(i)  +
                               unusedRenewable    * _getGAMMA(i);

            int globalAdjustment = 0;
            if (globalPlan.length == len) {
                int globalValue = globalPlan[i];
                int deviation = consumption - globalValue;
                int absDeviation = deviation >= 0 ? deviation : -deviation;
                int threshold = globalValue != 0 ? globalValue / 10 : int(0);
                if (absDeviation > threshold) {
                    if (deviation > 0) {
                        globalAdjustment =
                            (absDeviation - threshold) *
                            PENALTY_GLOBAL;
                    } else {
                        globalAdjustment = -((absDeviation - threshold) *
                            REDEEM_GLOBAL);
                    }
                }
            }
            int hourCost = localCost + localPenalty + globalAdjustment;
            totalCost += hourCost;
        }
        return totalCost;
    }

    // Funcția de calcul a tarifului efectiv (cu discount)  Ar fi o idee sa le fac variabile in functie de ore
    function getEffectiveTariff(
        uint hour,
        int consumption
    ) public view returns (int) {
        // int base = int(tariff[hour]);
        // if (consumption < 0) {
        //     uint absConsumption = uint(-consumption);
        //     uint extraDiscount = absConsumption / 2;
        //     uint totalDiscount = 20 + extraDiscount;
        //     if (totalDiscount > 40) {
        //         totalDiscount = 40;
        //     }
        //     return (base * int(100 - totalDiscount)) / 100;
        // } else {
        //     return base;
        // }
        return int(tariff[hour]);
    }

    // Actualizează cea mai bună poziție și transmite rezultatul către GlobalContract.
    function updateBestPositions() public {
        int currentScore = objectiveFunction(position);
        if (currentScore < personalBestScore) {
            personalBestScore = currentScore;
            personalBestPosition = position;
            // : Salvăm și snapshot-ul valorilor critice la momentul obținerii celui mai bun cost.
            delete frozenRenewableGeneration;
            delete frozenBatteryCharge;
            for (uint i = 0; i < renewableGeneration.length; i++) {
                frozenRenewableGeneration.push(renewableGeneration[i]);
                frozenBatteryCharge.push(batteryCharge[i]);
            }
            emit BestPositionUpdated(address(this), currentScore);
        }
        uint[] memory flexWeights = calculateFlexibilityWeight();
        // Report to cluster if one is assigned; otherwise report directly to GlobalContract.
        if (address(clusterContract) != address(0)) {
            clusterContract.updateNodeResult(position, currentScore, flexWeights);
        } else {
            globalContract.updateNodeResult(position, currentScore, flexWeights);
        }
    }

    // Calculează "ponderile de flexibilitate" pentru fiecare oră.
    function calculateFlexibilityWeight()
        internal
        view
        returns (uint[] memory)
    {
        uint len = flexibilityAbove.length;
        uint[] memory weights = new uint[](len);
        for (uint i = 0; i < len; i++) {
            weights[i] = (flexibilityAbove[i] + flexibilityBelow[i]) / 2;
        }
        return weights;
    }

    mapping(uint256 => int256) public usedRenewablePerHour;

    function updateVelocityAndPosition() public {
        uint globalTimestamp = globalContract.getLastUpdatedTimestamp();
        if (globalTimestamp > lastKnownGlobalTimestamp) {
            lastKnownGlobalTimestamp = globalTimestamp;
            emit NewPlanReceived(globalTimestamp);
        }

        // Social (neighbourhood) guide:
        //   • With cluster: use cluster best plan  → hierarchical PSO neighbourhood-best
        //   • Without cluster: fall back to global best plan  → classic flat PSO
        int[] memory socialPlan = (address(clusterContract) != address(0))
            ? clusterContract.getClusterBestPlan()
            : globalContract.getBestGlobalPlan();
        require(socialPlan.length == position.length, "Dimensiuni inegale");

        for (uint i = 0; i < position.length; i++) {
            uint r1 = uint(
                keccak256(abi.encodePacked(block.timestamp, i, position[i]))
            ) % 100;
            uint r2 = uint(
                keccak256(abi.encodePacked(block.timestamp, i + 1, velocity[i]))
            ) % 100;
            int randomFactor = int(
                uint(
                    keccak256(abi.encodePacked(block.timestamp, i, velocity[i]))
                ) % 101
            ) - 50;

            int diffPersonal = personalBestPosition[i] - position[i];
            // diffSocial uses the neighbourhood-best (cluster or global) for the c2 term.
            int diffSocial = socialPlan[i] - position[i];

            // TDM-aware PSO coefficients: inertia, cognitive, and social weights are
            // specific to the current hour slot, allowing peak-vs-off-peak tuning.
            velocity[i] =
                (_getW(i) *
                    velocity[i] +
                    (_getC1(i) * int(r1) * diffPersonal) /
                    100 +
                    (_getC2(i) * int(r2) * diffSocial) /
                    100 +
                    randomFactor) /
                100;

            position[i] += velocity[i];

            int minTotal = int(flexibilityBelow[i]);
            int maxTotal = int(flexibilityAbove[i]);
            int renewable = int(renewableGeneration[i]);
            usedRenewablePerHour[i] = 0;

            int usedRenewable = renewable;
            if (position[i] + usedRenewable > maxTotal) {
                usedRenewable = maxTotal - position[i]; 
            }
            if (usedRenewable < 0) {
                usedRenewable = 0;
            }

            usedRenewablePerHour[i] = usedRenewable;

            // Actualizează consumul total
            int total = position[i] + usedRenewable;

            // Dacă totalul este sub minimul permis → completezi din grid (crești position)
            if (total < minTotal) {
                int neededFromGrid = minTotal - total;
                position[i] += neededFromGrid;
                total = minTotal;
            }

            // Dacă totalul depășește maximul permis → ajustezi regenerabilul în jos
            if (total > maxTotal) {
                int overflow = total - maxTotal;
                if (usedRenewablePerHour[i] >= overflow) {
                    usedRenewablePerHour[i] -= overflow;
                } else {
                    int rest = overflow - usedRenewablePerHour[i];
                    usedRenewablePerHour[i] = 0;
                    position[i] -= rest;
                }
            }
        }
    }

    function objectiveFunctionFrozen(
        int[] memory pos
    ) public view returns (int) {
        int totalCost = 0;
        uint len = pos.length;
        // Copiem snapshot-ul valorilor salvate
        uint[] memory tempRenewable = new uint[](
            frozenRenewableGeneration.length
        );
        for (uint i = 0; i < frozenRenewableGeneration.length; i++) {
            tempRenewable[i] = frozenRenewableGeneration[i];
        }
        uint[] memory tempBattery = new uint[](frozenBatteryCharge.length);
        for (uint i = 0; i < frozenBatteryCharge.length; i++) {
            tempBattery[i] = frozenBatteryCharge[i];
        }
        int[] memory globalPlan = globalContract.getBestGlobalPlan();

        for (uint i = 0; i < len; i++) {
            int consumption = pos[i];
            int localCost = 0;

            if (consumption < 0) {
                // int effectiveTariff = getEffectiveTariff(i, consumption);
                // localCost = -effectiveTariff * (-consumption);
                int exportTariff = int(tariff[i]); // sau poți seta o constantă fixă, ex: 5
                localCost = exportTariff * consumption; // va fi un număr pozitiv (cost)
            } else {
                uint cons = uint(consumption);
                if (tempRenewable[i] >= cons) {
                    tempRenewable[i] -= cons;
                    cons = 0;
                } else {
                    cons -= tempRenewable[i];
                    tempRenewable[i] = 0;
                }
                if (tempBattery[i] >= cons) {
                    tempBattery[i] -= cons;
                    cons = 0;
                } else {
                    cons -= tempBattery[i];
                    tempBattery[i] = 0;
                }
                localCost = int(tariff[i]) * int(cons);
            }

            int overConsumption = consumption > int(capacity[i])
                ? consumption - int(capacity[i])
                : int(0);
            int bestCons = personalBestPosition[i];
            int flex = int(flexibilityAbove[i] + flexibilityBelow[i]);
            int diff = consumption - bestCons;
            int absDiff = diff >= 0 ? diff : -diff;
            int flexibilityViolation = absDiff > flex ? absDiff - flex : int(0);
            // Folosim snapshot-ul pentru resurse regenerabile
            int maxRenew = int(frozenRenewableGeneration[i]);
            int unusedRenewable = maxRenew > consumption
                ? maxRenew - consumption
                : int(0);
            // TDM-aware penalties (same slot-specific coefficients as objectiveFunction).
            int localPenalty = overConsumption    * _getALPHA(i) +
                               flexibilityViolation * _getBETA(i)  +
                               unusedRenewable    * _getGAMMA(i);

            int globalAdjustment = 0;
            if (globalPlan.length == len) {
                int globalValue = globalPlan[i];
                int deviation = consumption - globalValue;
                int absDeviation = deviation >= 0 ? deviation : -deviation;
                int threshold = globalValue != 0 ? globalValue / 10 : int(0);
                if (absDeviation > threshold) {
                    if (deviation > 0) {
                        globalAdjustment =
                            (absDeviation - threshold) *
                            PENALTY_GLOBAL;
                    } else {
                        globalAdjustment = -((absDeviation - threshold) *
                            REDEEM_GLOBAL);
                    }
                }
            }
            int hourCost = localCost + localPenalty + globalAdjustment;
            totalCost += hourCost;
        }
        return totalCost;
    }
    function getPersonalBestPosition() public view returns (int[] memory) {
        return personalBestPosition;
    }

    // Convenience function: returnează costul calculat cu snapshot-ul
    function getFrozenCost() public view returns (int) {
        return objectiveFunctionFrozen(personalBestPosition);
    }

    function getPosition() public view returns (int[] memory) {
        int[] memory copy = new int[](position.length);
        for (uint i = 0; i < position.length; i++) {
            copy[i] = position[i];
        }
        return copy;
    }

    function getTariff() public view returns (int[] memory) {
        return tariff;
    }

    function getCapacity() public view returns (uint[] memory) {
        return capacity;
    }

    function getBatteryCharge() public view returns (uint[] memory) {
        return batteryCharge;
    }

    function getUsedRenewablePlan() external view returns (int256[] memory) {
        int256[] memory result = new int256[](position.length);
        for (uint i = 0; i < position.length; i++) {
            result[i] = usedRenewablePerHour[i];
        }
        return result;
    }

    function getBatteryCapacity() public view returns (uint[] memory) {
        return batteryCapacity;
    }

    function getRenewableGeneration() public view returns (uint[] memory) {
        return renewableGeneration;
    }

    function getFlexibilityAbove() public view returns (uint[] memory) {
        return flexibilityAbove;
    }

    function getFlexibilityBelow() public view returns (uint[] memory) {
        return flexibilityBelow;
    }

    struct HourlyBreakdown {
        int consumption;
        bool isInjection;
        uint fromRenewable;
        uint fromBattery;
        uint fromGrid;
        int globalTarget;
        int deviationFromGlobal;
    }

    function getFlexibleLoad() public view returns (uint[] memory) {
        return flexibleLoad;
    }

    function getFrozenEnergyBreakdown()
        public
        view
        returns (HourlyBreakdown[] memory)
    {
        uint len = personalBestPosition.length;
        HourlyBreakdown[] memory breakdown = new HourlyBreakdown[](len);
        int[] memory globalPlan = globalContract.getBestGlobalPlan();

        for (uint i = 0; i < len; i++) {
            int cons = personalBestPosition[i];
            HourlyBreakdown memory hour;

            hour.consumption = cons;
            hour.isInjection = cons < 0;
            hour.globalTarget = globalPlan.length == len
                ? globalPlan[i]
                : int(0);
            hour.deviationFromGlobal = cons - hour.globalTarget;

            if (cons > 0) {
                uint remaining = uint(cons);
                uint renew = frozenRenewableGeneration[i];
                uint battery = frozenBatteryCharge[i];

                if (renew >= remaining) {
                    hour.fromRenewable = remaining;
                    remaining = 0;
                } else {
                    hour.fromRenewable = renew;
                    remaining -= renew;
                }

                if (battery >= remaining) {
                    hour.fromBattery = remaining;
                    remaining = 0;
                } else {
                    hour.fromBattery = battery;
                    remaining -= battery;
                }

                hour.fromGrid = remaining;
            }

            breakdown[i] = hour;
        }

        return breakdown;
    }
}
