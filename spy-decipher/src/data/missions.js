'use strict';

import { caesarShift, morseEncode, base64Encode, atbash } from '../lib/ciphers';

/**
 * DEV_MODE: drops are placed at metre offsets from the device's real GPS
 * position so the game works anywhere for testing. Set to false and supply
 * real { lat, lng } coordinates for a live public deployment.
 */
export const DEV_MODE = true;

const RAW = [
  {
    id: 'alpha',
    codeName: 'DROP ALPHA',
    objectType: 'briefcase',
    objectEmoji: '💼',
    // Dev offset: ~35m North-North-East
    devOffset: { northM: 30, eastM: 18 },
    // Production coordinates (edit for real deployment):
    prodCoords: { lat: 48.8584, lng: 2.2945 }, // example: Eiffel Tower area
    cipherType: 'Base64',
    plaintext: 'INTEL SECURED: ASSET ROMEO IS COMPROMISED',
    get ciphertext() { return base64Encode(this.plaintext); },
    intelFragment: '[ ROMEO COMPROMISED ]',
  },
  {
    id: 'bravo',
    codeName: 'DROP BRAVO',
    objectType: 'envelope',
    objectEmoji: '📁',
    // Dev offset: ~65m East-South-East
    devOffset: { northM: -20, eastM: 62 },
    prodCoords: { lat: 48.8530, lng: 2.3499 }, // example: Notre Dame area
    cipherType: 'Morse',
    plaintext: 'MEET AT CLOCK TOWER MIDNIGHT ZERO ZERO',
    get ciphertext() { return morseEncode(this.plaintext); },
    intelFragment: '[ CLOCK TOWER MIDNIGHT ]',
  },
  {
    id: 'charlie',
    codeName: 'DROP CHARLIE',
    objectType: 'usb',
    objectEmoji: '💾',
    // Dev offset: ~50m South
    devOffset: { northM: -50, eastM: 8 },
    prodCoords: { lat: 48.8462, lng: 2.3470 }, // example: Gare de Lyon area
    cipherType: 'Caesar shift 5',
    plaintext: 'THE MOLE IS INSIDE THE AGENCY EXFILTRATE NOW',
    get ciphertext() { return caesarShift(this.plaintext, 5); },
    intelFragment: '[ MOLE INSIDE AGENCY ]',
  },
];

export const MISSIONS = RAW;

export const STORY = {
  agentName: 'AGENT X',
  missionName: 'OPERATION BLACKCIPHER',
  briefing: [
    'Three encrypted dead drops have been planted in your immediate area.',
    'Each contains a fragment of intercepted intel.',
    'Approach each drop, activate AR mode, and decode the message.',
    'Assemble all three fragments to reconstruct the stolen intelligence.',
    '--- THIS BRIEFING SELF-DESTRUCTS IN 10 SECONDS ---',
  ],
  finalIntel:
    'FULL INTEL ASSEMBLED:\n\n' +
    '[ ROMEO COMPROMISED ]\n[ CLOCK TOWER MIDNIGHT ]\n[ MOLE INSIDE AGENCY ]\n\n' +
    'Exfiltrate immediately. Good luck, Agent.',
};
