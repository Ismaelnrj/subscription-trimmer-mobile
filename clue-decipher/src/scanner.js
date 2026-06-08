'use strict';

const fs = require('fs');
const path = require('path');
const { autoDecode } = require('./ciphers');

const TOKEN_PATTERN = /[A-Za-z0-9+/=._-]{8,}|[.\- /]{8,}|[01\s]{16,}|[A-Z][A-Z ]{9,}[A-Z0-9]/g;
const SCORE_THRESHOLD = 8;
const TOP_CANDIDATES = 1;

/**
 * Scan a chunk of text for substrings that look like ciphertext, run the
 * decipher engine on each, and return any decodes that look plausibly
 * English. This is the "find clues hidden in diverse places" detector —
 * point it at any file or directory.
 */
function scanText(text) {
  const findings = [];
  const seen = new Set();
  const tokens = text.match(TOKEN_PATTERN) || [];

  for (const token of tokens) {
    const trimmed = token.trim();
    if (trimmed.length < 6 || seen.has(trimmed)) continue;
    seen.add(trimmed);

    const candidates = autoDecode(trimmed);
    const top = candidates.slice(0, TOP_CANDIDATES).filter((c) => c.score >= SCORE_THRESHOLD);
    for (const c of top) {
      findings.push({ ciphertext: trimmed, ...c });
    }
  }
  return findings;
}

function scanFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  return scanText(text).map((f) => ({ ...f, source: filePath }));
}

function scanPath(targetPath) {
  const stat = fs.statSync(targetPath);
  if (stat.isFile()) return scanFile(targetPath);

  let results = [];
  for (const entry of fs.readdirSync(targetPath)) {
    const full = path.join(targetPath, entry);
    const entryStat = fs.statSync(full);
    if (entryStat.isDirectory()) {
      results = results.concat(scanPath(full));
    } else if (entryStat.isFile()) {
      try {
        results = results.concat(scanFile(full));
      } catch (_) {
        // skip unreadable/binary files
      }
    }
  }
  return results;
}

module.exports = { scanText, scanFile, scanPath };
