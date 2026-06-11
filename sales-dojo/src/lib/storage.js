// All persistence for Sales Dojo lives in localStorage — no backend required.
import { FLASHCARDS } from '../data/flashcards.js';

const KEYS = {
  API_KEY: 'sales-dojo:api-key',
  MODEL: 'sales-dojo:model',
  PROGRESS: 'sales-dojo:progress',
  FLASHCARDS: 'sales-dojo:flashcards',
  ROLEPLAY: 'sales-dojo:roleplay-sessions',
};

export const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';

export const MODEL_OPTIONS = [
  { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5 (recommended)' },
  { value: 'claude-opus-4-1-20250805', label: 'Claude Opus 4.1 (highest quality, slower)' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (fastest, cheapest)' },
];

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// --- Settings ---

export function getApiKey() {
  return localStorage.getItem(KEYS.API_KEY) || '';
}

export function setApiKey(key) {
  if (key) {
    localStorage.setItem(KEYS.API_KEY, key);
  } else {
    localStorage.removeItem(KEYS.API_KEY);
  }
}

export function getModel() {
  return localStorage.getItem(KEYS.MODEL) || DEFAULT_MODEL;
}

export function setModel(model) {
  localStorage.setItem(KEYS.MODEL, model || DEFAULT_MODEL);
}

// --- Lesson & quiz progress ---
// shape: { completedLessons: { [lessonId]: true }, quizScores: { [moduleId]: { score, total, date } } }

function getProgress() {
  return readJSON(KEYS.PROGRESS, { completedLessons: {}, quizScores: {} });
}

function saveProgress(progress) {
  writeJSON(KEYS.PROGRESS, progress);
}

export function isLessonComplete(lessonId) {
  return !!getProgress().completedLessons[lessonId];
}

export function markLessonComplete(lessonId) {
  const progress = getProgress();
  progress.completedLessons[lessonId] = true;
  saveProgress(progress);
}

export function getQuizScore(moduleId) {
  return getProgress().quizScores[moduleId] || null;
}

export function saveQuizScore(moduleId, score, total) {
  const progress = getProgress();
  progress.quizScores[moduleId] = { score, total, date: new Date().toISOString() };
  saveProgress(progress);
}

export function getCompletedLessons() {
  return getProgress().completedLessons;
}

// --- Flashcards (Leitner system) ---
// shape: { [cardId]: { box: 1-5, due: ISOString } }

const BOX_INTERVALS_DAYS = [0, 1, 3, 7, 14];

function getFlashcardState() {
  const state = readJSON(KEYS.FLASHCARDS, {});
  let changed = false;
  for (const card of FLASHCARDS) {
    if (!state[card.id]) {
      state[card.id] = { box: 1, due: new Date().toISOString() };
      changed = true;
    }
  }
  if (changed) writeJSON(KEYS.FLASHCARDS, state);
  return state;
}

export function getDueCards(moduleId = null) {
  const state = getFlashcardState();
  const now = new Date();
  return FLASHCARDS.filter((card) => {
    if (moduleId && card.moduleId !== moduleId) return false;
    const cardState = state[card.id];
    return new Date(cardState.due) <= now;
  });
}

export function getCardState(cardId) {
  return getFlashcardState()[cardId];
}

export function reviewCard(cardId, knewIt) {
  const state = getFlashcardState();
  const current = state[cardId] || { box: 1, due: new Date().toISOString() };
  let box = knewIt ? Math.min(current.box + 1, BOX_INTERVALS_DAYS.length) : 1;
  const days = BOX_INTERVALS_DAYS[box - 1];
  const due = new Date();
  due.setDate(due.getDate() + days);
  state[cardId] = { box, due: due.toISOString() };
  writeJSON(KEYS.FLASHCARDS, state);
}

export function getFlashcardStats() {
  const state = getFlashcardState();
  const stats = { total: FLASHCARDS.length, byBox: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, due: 0 };
  const now = new Date();
  for (const card of FLASHCARDS) {
    const cardState = state[card.id];
    stats.byBox[cardState.box] = (stats.byBox[cardState.box] || 0) + 1;
    if (new Date(cardState.due) <= now) stats.due += 1;
  }
  return stats;
}

// --- Roleplay session history ---
// shape: { [scenarioId]: { lastFeedback, lastScore, attempts, date } }

export function getRoleplayHistory() {
  return readJSON(KEYS.ROLEPLAY, {});
}

export function saveRoleplayResult(scenarioId, feedback) {
  const history = getRoleplayHistory();
  const prev = history[scenarioId] || { attempts: 0 };
  history[scenarioId] = {
    attempts: prev.attempts + 1,
    lastFeedback: feedback,
    date: new Date().toISOString(),
  };
  writeJSON(KEYS.ROLEPLAY, history);
}
