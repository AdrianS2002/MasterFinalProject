let CredentialsDTO = function (request) {
    return {
        username: (request.username) ? request.username : "",
        address: (request.address) ? request.address : "0x",
        passphrase: (request.passphrase) ? request.passphrase : "",
    };
};

module.exports = {
    CredentialsDTO
};
