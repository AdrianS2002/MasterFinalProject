const ContractType = {
    TEST: "TEST",
    NODE: "Node",
    GLOBAL: "GlobalContract",
    CLUSTER: "Cluster",
    DAYAHEAD: "DayAheadMarket",
    INTRADAY: "IntradayMarket"
};

const TYPE = {
    CONTRACT: "Contract",
    LIBRARY: "Library",
};

const LibraryName = {
    DATETIME_LIBRARY: "DatetimeLibrary"
};

let UserRoles = {
    MANAGER: "MANAGER",
    USER: "USER"
};

module.exports = {
    ContractType, LibraryName, TYPE,
    UserRoles
};
