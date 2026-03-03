/**
 * apply-split.js
 * Run from your project root:
 *   node apply-split.js
 *
 * This script:
 * 1. Creates app/components/ folder
 * 2. Copies ProductModal.jsx into it (you must place it in project root first)
 * 3. Patches app/routes/app._index.jsx:
 *    - Adds import for ProductModal + ScoreRing
 *    - Removes ScoreRing definition
 *    - Removes ModalScrollLock function
 *    - Removes ProductModal function
 */

const fs = require("fs");
const path = require("path");

const INDEX_PATH = path.join("app", "routes", "app._index.jsx");
const COMP_DIR = path.join("app", "components");
const MODAL_SRC = "ProductModal.jsx"; // must be in project root
const MODAL_DST = path.join(COMP_DIR, "ProductModal.jsx");

// ── Safety: backup first ──
const backup = INDEX_PATH + ".backup-" + Date.now();
console.log(`\n📋 Backing up to ${backup}`);
fs.copyFileSync(INDEX_PATH, backup);

let code = fs.readFileSync(INDEX_PATH, "utf-8");
const originalSize = code.length;
console.log(`📄 Original file: ${originalSize.toLocaleString()} bytes, ${code.split("\n").length} lines`);

// ── 1. Create components dir + copy ProductModal ──
if (!fs.existsSync(COMP_DIR)) fs.mkdirSync(COMP_DIR, { recursive: true });
if (fs.existsSync(MODAL_SRC)) {
  fs.copyFileSync(MODAL_SRC, MODAL_DST);
  console.log(`✅ Copied ${MODAL_SRC} → ${MODAL_DST}`);
} else {
  console.log(`⚠️  ${MODAL_SRC} not found in project root — copy it manually to ${MODAL_DST}`);
}

// ── 2. Add import line ──
const importLine = 'import ProductModal, { ScoreRing } from "../components/ProductModal";';
if (code.includes(importLine)) {
  console.log("⏩ Import already exists — skipping");
} else {
  // Insert after the last existing import at the top
  const importInsertPoint = 'import { getShopProducts, getSyncStatus } from "../sync.server.js";';
  if (code.includes(importInsertPoint)) {
    code = code.replace(importInsertPoint, importInsertPoint + "\n" + importLine);
    console.log("✅ Added import for ProductModal + ScoreRing");
  } else {
    // Fallback: insert after authenticate import
    const fallback = 'import { authenticate } from "../shopify.server";';
    code = code.replace(fallback, fallback + "\n" + importLine);
    console.log("✅ Added import (fallback position)");
  }
}

// ── 3. Remove ScoreRing definition ──
const scoreRingStart = 'const ScoreRing = React.memo(function ScoreRing({ score, size = 54 }) {';
const scoreRingEnd = '});';
const srIdx = code.indexOf(scoreRingStart);
if (srIdx === -1) {
  console.log("⏩ ScoreRing already removed — skipping");
} else {
  // Find the closing }); after ScoreRing
  // ScoreRing is short - find the next }); after it
  let searchFrom = srIdx + scoreRingStart.length;
  let endIdx = code.indexOf("\n});\n", searchFrom);
  if (endIdx !== -1) {
    endIdx += "\n});".length;
    // Also remove the blank line before
    let startIdx = srIdx;
    if (code[startIdx - 1] === "\n") startIdx--;
    if (code[startIdx - 1] === "\n") startIdx--;
    code = code.slice(0, startIdx) + code.slice(endIdx);
    console.log("✅ Removed ScoreRing definition (13 lines)");
  } else {
    console.log("❌ Could not find ScoreRing end — manual removal needed");
  }
}

// ── 4. Remove ModalScrollLock ──
const mslStart = "function ModalScrollLock() {";
const mslIdx = code.indexOf(mslStart);
if (mslIdx === -1) {
  console.log("⏩ ModalScrollLock already removed — skipping");
} else {
  let endIdx = code.indexOf("\n}\n", mslIdx);
  if (endIdx !== -1) {
    endIdx += "\n}".length;
    let startIdx = mslIdx;
    if (code[startIdx - 1] === "\n") startIdx--;
    if (code[startIdx - 1] === "\n") startIdx--;
    code = code.slice(0, startIdx) + code.slice(endIdx);
    console.log("✅ Removed ModalScrollLock (7 lines)");
  } else {
    console.log("❌ Could not find ModalScrollLock end — manual removal needed");
  }
}

// ── 5. Remove ProductModal function ──
const pmStart = "function ProductModal({ product, onClose, aiResults,";
const pmIdx = code.indexOf(pmStart);
if (pmIdx === -1) {
  console.log("⏩ ProductModal already removed — skipping");
} else {
  // ProductModal ends with \n}\n\n before "export default function Index()"
  const afterPm = "export default function Index()";
  const afterIdx = code.indexOf(afterPm, pmIdx);
  if (afterIdx !== -1) {
    // Go back to find the end of ProductModal — the } right before "export default"
    let endSlice = afterIdx;
    // Skip whitespace backwards
    while (endSlice > 0 && (code[endSlice - 1] === "\n" || code[endSlice - 1] === " ")) endSlice--;
    endSlice++; // keep one newline
    
    let startIdx = pmIdx;
    if (code[startIdx - 1] === "\n") startIdx--;
    if (code[startIdx - 1] === "\n") startIdx--;
    
    code = code.slice(0, startIdx) + "\n\n" + code.slice(afterIdx);
    console.log("✅ Removed ProductModal function (~109 lines)");
  } else {
    console.log("❌ Could not find end of ProductModal — manual removal needed");
  }
}

// ── 6. Write result ──
fs.writeFileSync(INDEX_PATH, code, "utf-8");
const newSize = code.length;
const newLines = code.split("\n").length;
const saved = originalSize - newSize;
console.log(`\n📄 New file: ${newSize.toLocaleString()} bytes, ${newLines} lines`);
console.log(`📉 Removed: ${saved.toLocaleString()} bytes (~${Math.round(saved/originalSize*100)}%)`);
console.log(`\n🎉 Done! Run 'npm run dev' to test.`);
console.log(`💾 Backup saved as: ${backup}`);
