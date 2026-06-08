'use strict';

const assert = require('assert');
const {
  caesarShift, atbash, morseEncode, morseDecode,
  base64Encode, base64Decode, binaryEncode, binaryDecode,
  hexEncode, hexDecode, autoDecode,
} = require('../src/ciphers');

function check(name, fn) {
  try {
    fn();
    console.log(`ok   - ${name}`);
  } catch (err) {
    console.error(`FAIL - ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

check('caesar round-trip', () => {
  const plain = 'Attack at dawn';
  assert.strictEqual(caesarShift(caesarShift(plain, 7), -7), plain);
});

check('atbash is its own inverse', () => {
  const plain = 'HELLO WORLD';
  assert.strictEqual(atbash(atbash(plain)), plain);
});

check('morse round-trip', () => {
  const plain = 'SOS HELP';
  assert.strictEqual(morseDecode(morseEncode(plain)), plain);
});

check('base64 round-trip', () => {
  const plain = 'open the vault';
  assert.strictEqual(base64Decode(base64Encode(plain)), plain);
});

check('binary round-trip', () => {
  const plain = 'KEY';
  assert.strictEqual(binaryDecode(binaryEncode(plain)), plain);
});

check('hex round-trip', () => {
  const plain = 'relic';
  assert.strictEqual(hexDecode(hexEncode(plain)), plain);
});

check('autoDecode finds caesar shift', () => {
  const plain = 'QUERY THE RELIC API FOR ENTRY ID 1947';
  const cipher = caesarShift(plain, 7);
  const [best] = autoDecode(cipher);
  assert.strictEqual(best.cipher, 'caesar');
  assert.strictEqual(best.params, 7);
  assert.strictEqual(best.plaintext, plain);
});

check('autoDecode finds base64', () => {
  const plain = 'OPEN THE FILE LOCATIONS PAPYRUS TXT';
  const cipher = base64Encode(plain);
  const [best] = autoDecode(cipher);
  assert.strictEqual(best.cipher, 'base64');
  assert.strictEqual(best.plaintext, plain);
});

check('autoDecode finds morse', () => {
  const plain = 'FIND KEY KAIRO';
  const cipher = morseEncode(plain);
  const [best] = autoDecode(cipher);
  assert.strictEqual(best.cipher, 'morse');
  assert.strictEqual(best.plaintext, plain);
});
