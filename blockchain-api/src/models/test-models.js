var DateTimeDTO = function (request) {
    return {
        minute: (request.minute) ? request.minute : -1,
        hour: (request.hour) ? request.hour : -1,
        day: (request.day) ? request.day : -1,
        month: (request.month) ? request.month : -1,
        year: (request.year) ? request.year : -1,
    };
};

module.exports = {
    DateTimeDTO
}