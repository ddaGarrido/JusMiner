import path from "path";

function getRunDir(runId) {
  return path.join("runs", runId);
}

function getLogPath(runId) {
  return path.join(getRunDir(runId), "app.jsonl");
}

function getSummaryPath(runId) {
  return path.join(getRunDir(runId), "run-summary.json");
}

export { getRunDir, getLogPath, getSummaryPath };
