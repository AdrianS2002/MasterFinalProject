class SqlError extends Error {
    constructor(queryName) {
        super("SQL Error on " + queryName);
        this.name = "SqlError";
    }
}

class SqlNoResultError extends Error{
    constructor(queryName) {
        super("No SQL results on " + queryName);
    }
}

class SqlNotUniqueError extends Error{
    constructor(entityName, queryName) {
        super(entityName + " is not unique on " + queryName);
    }
}

module.exports = {
    SqlError,
    SqlNoResultError,
    SqlNotUniqueError
}