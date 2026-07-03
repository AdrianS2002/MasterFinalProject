let latestPSOResults = [];

function setResults(results) {
  latestPSOResults = results;
}

function getResults() {
  return latestPSOResults;
}

module.exports = { setResults, getResults };