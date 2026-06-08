#!/usr/bin/env node
'use strict';

const { play } = require('../src/game');

play().catch((err) => {
  console.error('The adventure crashed unexpectedly:', err);
  process.exitCode = 1;
});
