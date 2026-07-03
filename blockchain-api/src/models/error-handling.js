class ErrorHandling {
    constructor() {
        this.timestamp = null;
        this.status = null;
        this.error = null;
        this.message = null;
        this.path = null;
        this.resource = null;
        this.details = null;
    }

    static factoryPartialErrorHandling(error) {
        let errorHandling = new ErrorHandling();
        errorHandling.error = error.name;
        errorHandling.message = error.message;
        errorHandling.status = error.statusCode;
        errorHandling.details = [];
        return errorHandling;
    }
}

module.exports = ErrorHandling;
