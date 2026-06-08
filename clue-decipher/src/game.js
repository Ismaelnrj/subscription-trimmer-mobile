'use strict';

const readline = require('readline');
const { STAGES, normalize, readTreasure } = require('./story');
const { autoDecode } = require('./ciphers');

/**
 * rl.question() attaches a one-time 'line' listener, so when input arrives
 * faster than questions are asked (e.g. piped multi-line input), extra lines
 * race ahead and get silently dropped. Queue lines ourselves instead.
 */
function createPrompter(rl) {
  const buffered = [];
  const waiters = [];
  rl.on('line', (line) => {
    if (waiters.length) waiters.shift()(line);
    else buffered.push(line);
  });
  return function ask(prompt) {
    process.stdout.write(prompt);
    if (buffered.length) return Promise.resolve(buffered.shift());
    return new Promise((resolve) => waiters.push(resolve));
  };
}

const BANNER = `
========================================================
   CLUE DECIPHER — The Lost Cipher of the Four Vaults
========================================================
A trail of encoded clues is scattered across different
storage locations: an env file, a scroll, a database,
and a cached API response. Decode each one to uncover
where the next clue is hidden.

Commands at any prompt:
  <your answer>   - submit your decoded guess
  hint            - reveal which cipher is in play
  reveal          - reveal the location of the ciphertext
  solve           - let the engine attempt to auto-decode it
  quit            - leave the adventure
========================================================
`;

async function runStage(ask, stage) {
  console.log(`\n${stage.title}`);
  console.log(stage.intro);
  const ciphertext = stage.getCiphertext();
  console.log(`\nCiphertext found:\n  "${ciphertext}"\n`);

  const targetNorm = normalize(stage.expected);

  for (;;) {
    const answer = (await ask('> ')).trim();
    const lower = answer.toLowerCase();

    if (lower === 'quit') {
      console.log('\nYou pack up your gear and head home. The trail will wait for you...\n');
      return false;
    }
    if (lower === 'hint') {
      console.log(`Hint: this looks like ${stage.cipherHint}.`);
      continue;
    }
    if (lower === 'reveal') {
      console.log(`The ciphertext was found in: ${stage.locationLabel}`);
      continue;
    }
    if (lower === 'solve') {
      const [best] = autoDecode(ciphertext);
      if (best) {
        console.log(`Auto-decode engine's best guess (${best.cipher}${best.params ? ` shift=${best.params}` : ''}):`);
        console.log(`  "${best.plaintext}"`);
      } else {
        console.log('The engine could not produce a confident guess.');
      }
      continue;
    }

    if (normalize(answer) === targetNorm) {
      console.log(`\nCorrect! Decoded: "${stage.expected}"`);
      return true;
    }
    console.log("That doesn't match. Try 'hint', 'solve', or keep working it out.");
  }
}

async function play() {
  console.log(BANNER);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = createPrompter(rl);

  try {
    for (const stage of STAGES) {
      const advanced = await runStage(ask, stage);
      if (!advanced) return;
    }
    console.log('\n' + readTreasure());
  } finally {
    rl.close();
  }
}

module.exports = { play };
