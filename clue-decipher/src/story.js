'use strict';

const path = require('path');
const fs = require('fs');

const LOCATIONS_DIR = path.join(__dirname, '..', 'locations');

function readEnvFile() {
  const raw = fs.readFileSync(path.join(LOCATIONS_DIR, 'secrets.env'), 'utf8');
  const match = raw.match(/^ADVENTURE_CLUE=(.+)$/m);
  return match ? match[1].trim() : '';
}

function readPapyrus() {
  const raw = fs.readFileSync(path.join(LOCATIONS_DIR, 'papyrus.txt'), 'utf8');
  const match = raw.match(/^([.\- /]+)\s*$/m);
  return match ? match[1].trim() : '';
}

function readVaultEntry(key) {
  const db = JSON.parse(fs.readFileSync(path.join(LOCATIONS_DIR, 'vault.json'), 'utf8'));
  return db.entries[key];
}

function readRelicRecord(id) {
  const api = JSON.parse(fs.readFileSync(path.join(LOCATIONS_DIR, 'relic_api.json'), 'utf8'));
  const record = api.records.find((r) => r.id === id);
  return record ? record.cipher_note : undefined;
}

function readTreasure() {
  return fs.readFileSync(path.join(LOCATIONS_DIR, 'treasure.txt'), 'utf8');
}

/**
 * Each stage names a real on-disk "storage location" the clue lives in,
 * the cipher used to scramble it, and the expected decoded answer the
 * player needs to type to advance (matched loosely: case/whitespace-insensitive).
 */
const STAGES = [
  {
    id: 'env',
    title: 'Stage 1 — The Field Journal',
    locationLabel: `environment file: locations/secrets.env (key ADVENTURE_CLUE)`,
    intro: 'Your guide vanished a year ago. All that remains is a field journal with one encoded line.',
    cipherHint: 'Base64',
    getCiphertext: readEnvFile,
    expected: 'OPEN THE FILE LOCATIONS PAPYRUS TXT',
  },
  {
    id: 'papyrus',
    title: 'Stage 2 — The Papyrus Scroll',
    locationLabel: 'text file: locations/papyrus.txt',
    intro: 'Inside the file, dots and dashes are tapped across a brittle scroll.',
    cipherHint: 'Morse code',
    getCiphertext: readPapyrus,
    expected: 'FIND KEY KAIRO IN THE VAULT JSON',
  },
  {
    id: 'vault',
    title: 'Stage 3 — The Vault Database',
    locationLabel: `database record: locations/vault.json -> entries["KAIRO"]`,
    intro: 'A dusty JSON export from an old expedition vault. The scroll named a key: KAIRO.',
    cipherHint: 'Caesar cipher (unknown shift — try them all)',
    getCiphertext: () => readVaultEntry('KAIRO'),
    expected: 'QUERY THE RELIC API FOR ENTRY ID 1947',
  },
  {
    id: 'api',
    title: 'Stage 4 — The Relic Registry API',
    locationLabel: 'cached API response: locations/relic_api.json -> records[id=1947]',
    intro: 'A cached response from a long-dead web API. Record 1947 holds a final note.',
    cipherHint: 'Atbash cipher (A<->Z, B<->Y, ...)',
    getCiphertext: () => readRelicRecord(1947),
    expected: 'THE TREASURE AWAITS IN LOCATIONS TREASURE TXT',
  },
];

function normalize(text) {
  return text.toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

module.exports = { STAGES, normalize, readTreasure, LOCATIONS_DIR };
