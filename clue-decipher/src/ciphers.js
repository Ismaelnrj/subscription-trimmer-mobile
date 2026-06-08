'use strict';

const MORSE_MAP = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.',
  H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.',
  O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-',
  V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-',
  5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
};
const MORSE_REVERSE = Object.fromEntries(Object.entries(MORSE_MAP).map(([k, v]) => [v, k]));

const COMMON_WORDS = [
  'THE', 'AND', 'YOU', 'FOR', 'ARE', 'IN', 'IS', 'IT', 'OF', 'TO',
  'KEY', 'VAULT', 'FIND', 'OPEN', 'NEXT', 'PATH', 'QUERY', 'RELIC',
  'TREASURE', 'API', 'JSON', 'HOLDS', 'ENTRY', 'LOCATIONS', 'FOR', 'ID',
];

function caesarShift(text, shift) {
  return text.replace(/[A-Za-z]/g, (ch) => {
    const base = ch <= 'Z' ? 65 : 97;
    return String.fromCharCode(((ch.charCodeAt(0) - base + shift) % 26 + 26) % 26 + base);
  });
}

function atbash(text) {
  return text.replace(/[A-Za-z]/g, (ch) => {
    const base = ch <= 'Z' ? 65 : 97;
    return String.fromCharCode(base + (25 - (ch.charCodeAt(0) - base)));
  });
}

function morseEncode(text) {
  return text
    .toUpperCase()
    .split(' ')
    .map((word) => word.split('').map((ch) => MORSE_MAP[ch] || '').join(' '))
    .join(' / ');
}

function morseDecode(text) {
  return text
    .trim()
    .split(' / ')
    .map((word) => word.trim().split(/\s+/).map((sym) => MORSE_REVERSE[sym] || '').join(''))
    .join(' ');
}

function base64Encode(text) {
  return Buffer.from(text, 'utf8').toString('base64');
}

function base64Decode(text) {
  return Buffer.from(text, 'base64').toString('utf8');
}

function binaryEncode(text) {
  return text
    .split('')
    .map((ch) => ch.charCodeAt(0).toString(2).padStart(8, '0'))
    .join(' ');
}

function binaryDecode(text) {
  return text
    .trim()
    .split(/\s+/)
    .map((byte) => String.fromCharCode(parseInt(byte, 2)))
    .join('');
}

function hexEncode(text) {
  return Buffer.from(text, 'utf8').toString('hex').match(/.{1,2}/g).join(' ');
}

function hexDecode(text) {
  return Buffer.from(text.replace(/\s+/g, ''), 'hex').toString('utf8');
}

function englishScore(text) {
  const upper = text.toUpperCase();
  let score = 0;
  for (const word of COMMON_WORDS) {
    if (upper.includes(word)) score += word.length;
  }
  const printable = (text.match(/[ -~]/g) || []).length;
  score += printable / Math.max(text.length, 1);
  return score;
}

const CIPHERS = {
  caesar: { encode: (t, shift) => caesarShift(t, shift), decode: (t, shift) => caesarShift(t, -shift) },
  atbash: { encode: atbash, decode: atbash },
  morse: { encode: morseEncode, decode: morseDecode },
  base64: { encode: base64Encode, decode: base64Decode },
  binary: { encode: binaryEncode, decode: binaryDecode },
  hex: { encode: hexEncode, decode: hexDecode },
};

const MORSE_PATTERN = /^[.\- /]+$/;
const BINARY_PATTERN = /^[01\s]+$/;
const HEX_PATTERN = /^[0-9a-fA-F\s]+$/;
const BASE64_PATTERN = /^[A-Za-z0-9+/=\s]+$/;

/**
 * Try to identify and decode a piece of ciphertext, returning ranked guesses.
 * This is the core "decipher" engine shared by the scanner CLI and the game's
 * hint/auto-solve features.
 */
function autoDecode(ciphertext) {
  const text = ciphertext.trim();
  const candidates = [];

  if (MORSE_PATTERN.test(text) && /[.-]/.test(text)) {
    candidates.push({ cipher: 'morse', params: null, plaintext: morseDecode(text) });
  }
  if (BINARY_PATTERN.test(text) && text.replace(/\s+/g, '').length % 8 === 0 && text.replace(/\s+/g, '').length > 0) {
    try {
      candidates.push({ cipher: 'binary', params: null, plaintext: binaryDecode(text) });
    } catch (_) { /* not valid binary */ }
  }
  if (HEX_PATTERN.test(text) && text.replace(/\s+/g, '').length % 2 === 0 && text.replace(/\s+/g, '').length > 0) {
    try {
      const decoded = hexDecode(text);
      if (/^[\x09\x0A\x0D\x20-\x7E]*$/.test(decoded)) {
        candidates.push({ cipher: 'hex', params: null, plaintext: decoded });
      }
    } catch (_) { /* not valid hex */ }
  }
  if (BASE64_PATTERN.test(text) && text.replace(/\s+/g, '').length % 4 === 0 && text.replace(/\s+/g, '').length > 0) {
    try {
      const decoded = base64Decode(text.replace(/\s+/g, ''));
      if (/^[\x09\x0A\x0D\x20-\x7E]*$/.test(decoded) && decoded.length > 0) {
        candidates.push({ cipher: 'base64', params: null, plaintext: decoded });
      }
    } catch (_) { /* not valid base64 */ }
  }

  candidates.push({ cipher: 'atbash', params: null, plaintext: atbash(text) });
  for (let shift = 1; shift < 26; shift++) {
    candidates.push({ cipher: 'caesar', params: shift, plaintext: caesarShift(text, -shift) });
  }

  for (const c of candidates) c.score = englishScore(c.plaintext);
  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

module.exports = {
  CIPHERS,
  caesarShift,
  atbash,
  morseEncode,
  morseDecode,
  base64Encode,
  base64Decode,
  binaryEncode,
  binaryDecode,
  hexEncode,
  hexDecode,
  englishScore,
  autoDecode,
};
