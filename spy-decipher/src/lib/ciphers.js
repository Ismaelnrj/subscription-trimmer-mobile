'use strict';

const MORSE_MAP = {
  A:'.-', B:'-...', C:'-.-.', D:'-..', E:'.', F:'..-.', G:'--.', H:'....',
  I:'..', J:'.---', K:'-.-', L:'.-..', M:'--', N:'-.', O:'---', P:'.--.',
  Q:'--.-', R:'.-.', S:'...', T:'-', U:'..-', V:'...-', W:'.--', X:'-..-',
  Y:'-.--', Z:'--..',
  0:'-----', 1:'.----', 2:'..---', 3:'...--', 4:'....-',
  5:'.....', 6:'-....', 7:'--...', 8:'---..', 9:'----.',
};
const MORSE_REV = Object.fromEntries(Object.entries(MORSE_MAP).map(([k,v])=>[v,k]));

const COMMON = ['THE','AND','IS','IN','AT','FOR','ARE','ASSET','DROP','DEAD',
  'INTEL','MEET','ZERO','MOLE','AGENCY','SECURE','CODE','CLOCK','MIDNIGHT',
  'COMPROMISED','RENDEZVOUS','HUNDRED','TOWER','INSIDE','EXFILTRATE'];

export function caesarShift(text, n) {
  return text.replace(/[A-Za-z]/g, ch => {
    const b = ch <= 'Z' ? 65 : 97;
    return String.fromCharCode(((ch.charCodeAt(0)-b+n)%26+26)%26+b);
  });
}

export function atbash(text) {
  return text.replace(/[A-Za-z]/g, ch => {
    const b = ch <= 'Z' ? 65 : 97;
    return String.fromCharCode(b+(25-(ch.charCodeAt(0)-b)));
  });
}

export function morseEncode(text) {
  return text.toUpperCase().split(' ')
    .map(w => w.split('').map(c => MORSE_MAP[c]||'').join(' '))
    .join(' / ');
}

export function morseDecode(text) {
  return text.trim().split(' / ')
    .map(w => w.trim().split(/\s+/).map(s => MORSE_REV[s]||'').join(''))
    .join(' ');
}

export function base64Encode(text) {
  return btoa(unescape(encodeURIComponent(text)));
}

export function base64Decode(text) {
  try { return decodeURIComponent(escape(atob(text))); } catch { return ''; }
}

function score(text) {
  const up = text.toUpperCase();
  let s = (text.match(/[ -~]/g)||[]).length / Math.max(text.length,1);
  for (const w of COMMON) if (up.includes(w)) s += w.length;
  return s;
}

export function autoDecode(ciphertext) {
  const t = ciphertext.trim();
  const candidates = [];

  if (/^[.\- /]+$/.test(t) && /[.-]/.test(t))
    candidates.push({ cipher:'morse', params:null, plaintext:morseDecode(t) });

  if (/^[A-Za-z0-9+/=\s]+$/.test(t) && t.replace(/\s/g,'').length%4===0) {
    const d = base64Decode(t.replace(/\s/g,''));
    if (d && /^[\x20-\x7E]*$/.test(d))
      candidates.push({ cipher:'base64', params:null, plaintext:d });
  }

  candidates.push({ cipher:'atbash', params:null, plaintext:atbash(t) });
  for (let s=1; s<26; s++)
    candidates.push({ cipher:'caesar', params:s, plaintext:caesarShift(t,-s) });

  for (const c of candidates) c.score = score(c.plaintext);
  candidates.sort((a,b)=>b.score-a.score);
  return candidates;
}
