import fs from "fs";
import path from "path";

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

/**
 * Appends a JSON object as a line to a JSONL file
 * @param {string} filePath - Path to the JSONL file
 * @param {Object} data - Object to append
 */
function appendJsonl(filePath, data) {
  ensureDir(path.dirname(filePath));
  const line = JSON.stringify(data) + '\n';
  fs.appendFileSync(filePath, line, 'utf8');
}

/**
 * Writes an array of objects to a JSONL file
 * @param {string} filePath - Path to the JSONL file
 * @param {Array} items - Array of objects to write
 */
function writeJsonl(filePath, items) {
  ensureDir(path.dirname(filePath));
  const lines = items.map(item => JSON.stringify(item)).join('\n') + '\n';
  fs.writeFileSync(filePath, lines, 'utf8');
}

export { ensureDir, writeJson, appendJsonl, writeJsonl };
