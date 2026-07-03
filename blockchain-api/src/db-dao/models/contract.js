let ContractDTO = function (request) {
    return {
        id: (request.id),
        name: (request.name),
        address: (request.address),
        type: (request.type),
        owner: (request.owner)
    };
};

module.exports = {
    ContractDTO
};
