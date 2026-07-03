let LocationDTO = function (request) {
    return {
        contractId: request.contract_id || null,  // dacă îl selectezi și pe acesta
        country: request.country || "",
        city: request.city || "",
        address: request.address || ""
    };
};

module.exports = {
    LocationDTO
};
