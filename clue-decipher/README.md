# Clue Decipher — The Lost Cipher of the Four Vaults

An Indiana-Jones / Tomb-Raider style text adventure: a trail of encoded
clues is scattered across **diverse storage locations** — an environment
file, a plain-text "scroll", a JSON "vault database", and a cached "API
response". Decode each one to find where the next clue is hidden.

It ships with two things:

1. **The game** (`bin/play.js`) — an interactive CLI adventure.
2. **The decipher engine / scanner** (`bin/scan.js`) — a standalone tool
   that hunts through any file or directory for ciphertext-looking strings
   (Base64, Morse, hex, binary, Caesar, Atbash) and tries to crack them,
   ranking guesses by how "English" the result looks.

## Play the adventure

```bash
cd clue-decipher
npm run play
```

You'll be shown a ciphertext pulled live from one of these locations:

| Stage | Location                                             | Cipher  |
|-------|------------------------------------------------------|---------|
| 1     | `locations/secrets.env` (env-style config file)      | Base64  |
| 2     | `locations/papyrus.txt` (plain text file)            | Morse   |
| 3     | `locations/vault.json` (JSON "database" record)      | Caesar  |
| 4     | `locations/relic_api.json` (cached "API" response)   | Atbash  |

Type your decoded guess to advance. At any prompt you can also type:

- `hint` — reveals which cipher is in play
- `reveal` — reveals which file/location the ciphertext came from
- `solve` — asks the built-in decipher engine for its best guess
- `quit` — leave the adventure

## Run the standalone scanner

Point it at any file or folder and it will scan for ciphertext-looking
substrings and try to decode them:

```bash
npm run scan -- locations
npm run scan -- /path/to/some/project
```

## Run tests

```bash
npm test
```

## How the engine works (`src/ciphers.js`)

`autoDecode(text)` recognizes a few cipher "shapes" by pattern (Morse,
binary, hex, Base64) and decodes them directly; for ambiguous alphabetic
ciphertext it brute-forces every Caesar shift plus Atbash and scores each
candidate plaintext by how much it resembles English (common-word matches
+ printable-character ratio), returning the ranked list. The game's
`solve` command and the scanner both call straight into this engine.
