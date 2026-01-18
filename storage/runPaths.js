import path from "path";

function getRunDir(runId) {
  return path.join("runs", runId);
}

function getLogPath(runId) {
  return path.join(getRunDir(runId), "app.json");
}

function getSummaryPath(runId) {
  return path.join(getRunDir(runId), "run-summary.json");
}

function getResultsPath(runId) {
  return path.join(getRunDir(runId), "results.json");
}

function getCasesPath(runId) {
  return path.join(getRunDir(runId), "cases.json");
}

export { getRunDir, getLogPath, getSummaryPath, getResultsPath, getCasesPath };
