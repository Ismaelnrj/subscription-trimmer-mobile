#!/usr/bin/env node
'use strict';

const path = require('path');
const { scanPath } = require('../src/scanner');

const target = process.argv[2];
if (!target) {
  console.error('Usage: node bin/scan.js <file-or-directory>');
  process.exitCode = 1;
} else {
  const resolved = path.resolve(process.cwd(), target);
  console.log(`Scanning ${resolved} for hidden ciphered clues...\n`);
  const findings = scanPath(resolved);

  if (findings.length === 0) {
    console.log('No likely ciphertext found.');
  } else {
    for (const f of findings) {
      console.log(`[${f.source}]`);
      console.log(`  ciphertext : ${f.ciphertext}`);
      console.log(`  cipher     : ${f.cipher}${f.params ? ` (shift=${f.params})` : ''}`);
      console.log(`  decoded    : ${f.plaintext}`);
      console.log(`  confidence : ${f.score.toFixed(1)}`);
      console.log('');
    }
    console.log(`Found ${findings.length} candidate clue(s).`);
  }
}
