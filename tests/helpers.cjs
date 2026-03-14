// tests/helpers.cjs
// ═══════════════════════════════════════════════════
// Shared test helpers for Smart Ads AI E2E tests
// ═══════════════════════════════════════════════════

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

/**
 * Read a project file by relative path
 * @param {string} filePath - Relative path from project root
 * @returns {string|null}
 */
function readFile(filePath) {
  const full = path.join(ROOT, filePath);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, "utf8");
}

/**
 * List files in a project directory
 * @param {string} dirPath - Relative path from project root
 * @param {string} ext - File extension filter (e.g. ".jsx")
 * @returns {string[]}
 */
function listFiles(dirPath, ext = "") {
  const full = path.join(ROOT, dirPath);
  if (!fs.existsSync(full)) return [];
  let files = fs.readdirSync(full);
  if (ext) files = files.filter(f => f.endsWith(ext));
  return files;
}

module.exports = { readFile, listFiles, ROOT };
