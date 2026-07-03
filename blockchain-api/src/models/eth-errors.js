class UnlockError extends Error {
    constructor(message) {
        super("EVM revert on unlockAccount: " + message);
        this.name = "UnlockError";
    }
}

class MethodCallError extends Error {
    constructor(contractName, functionName, methodName) {
        super("[" + contractName + "] " + "EVM revert on " + functionName + " - " + methodName);
        this.name = "MethodCallError";
    }
}

class DeployContractError extends Error{
    constructor(contractName) {
        super("[" + contractName + "] " + "EVM revert on deploy");
        this.name = "DeployContractError";
    }
}

class GetBalanceError extends Error{
    constructor()
    {
        super("Error on get account balance");
        this.name = "GetBalanceError"
    }
}

class GetEvents extends Error{
    constructor(contractName, eventName)
    {
        super("[" + contractName + "]" + " Error on get " + eventName + "events" );
        this.name = "GetBalanceError"
    }
}

class LockError extends Error{
    constructor(message) {
        super(message);
    }
}

module.exports={
    GetBalanceError,
    DeployContractError,
    UnlockError,
    MethodCallError,
    GetEvents,
    LockError
}