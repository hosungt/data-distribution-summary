// Game state machine. No DOM, no Firebase. All mutations return new state.

import { computeStats, modesEqual } from './stats-core.js';
import {
  sampleGoalData,
  pickSelectedClasses,
  rearrangeToStartData,
} from './distribution-sampler.js';
import { computeFullScore } from './score-formatter.js';

export const TIME_LIMIT_MS = 5 * 60 * 1000; // 300_000
export const MOVES_LIMIT = 100;
export const VALID_MODES = new Set(['time', 'moves', 'practice']);

const MAX_SAMPLE_ATTEMPTS = 200;

// Generate goal + SC + start such that median AND mode differ between goal and start.
// Falls back to last attempt if MAX_SAMPLE_ATTEMPTS reached (extremely unlikely).
function sampleGameData(n, rand) {
  let last = null;
  for (let i = 0; i < MAX_SAMPLE_ATTEMPTS; i++) {
    const goal = sampleGoalData({ n, rand });
    const goalStats = computeStats(goal.values);
    const selectedClasses = pickSelectedClasses(rand);
    const startValues = rearrangeToStartData(goal.values, selectedClasses, rand);
    const startStats = computeStats(startValues);
    last = { goal, goalStats, selectedClasses, startValues, startStats };
    const medianDiffers = goalStats.median !== startStats.median;
    const modeDiffers = !modesEqual(goalStats.mode, startStats.mode);
    if (medianDiffers && modeDiffers) return last;
  }
  console.warn('sampleGameData: could not satisfy median+mode mismatch within attempts');
  return last;
}

// Create a new game. mode: 'time' | 'moves' | 'practice'. n: variate count (default 100).
// rand: optional Math.random replacement for seeded testing.
export function createGame({ mode = 'time', n = 100, rand = Math.random } = {}) {
  if (!VALID_MODES.has(mode)) {
    throw new Error(`Unknown mode: ${mode}`);
  }
  const { goal, goalStats, selectedClasses, startValues, startStats } = sampleGameData(n, rand);

  const state = {
    mode,
    n,
    createdAt: Date.now(),
    startedAt: null, // set by start()
    endedAt: null,
    finished: false,
    goalValues: goal.values.slice(),
    goalDistType: goal.type,
    goalStats,
    selectedClasses,
    values: startValues,           // committed values
    currentStats: startStats,      // stats of committed values
    preview: null,                 // { pointIdx, fromX, toX, previewStats } for moves mode only
    selectedPointIdx: null,
    commits: 0,
    elapsedMs: 0,
  };
  state.score = computeFullScore(state, { elapsedMs: 0, commits: 0 });
  return state;
}

export function startGame(state, now = Date.now()) {
  if (state.startedAt) return state;
  return { ...state, startedAt: now };
}

// Compute display values: committed + preview overlay (moves mode).
export function getDisplayValues(state) {
  if (!state.preview) return state.values;
  const v = state.values.slice();
  v[state.preview.pointIdx] = state.preview.toX;
  return v;
}

// Compute display stats: previewStats if active, else currentStats.
export function getDisplayStats(state) {
  if (state.preview) return state.preview.previewStats;
  return state.currentStats;
}

// Select a point by its index in values array.
// In moves mode: cancels any active preview belonging to a different point.
export function selectPoint(state, pointIdx) {
  if (state.finished) return state;
  if (pointIdx == null) {
    return { ...state, selectedPointIdx: null, preview: null };
  }
  // Switching point in moves mode cancels prior preview.
  if (state.mode === 'moves' && state.preview && state.preview.pointIdx !== pointIdx) {
    return { ...state, selectedPointIdx: pointIdx, preview: null };
  }
  return { ...state, selectedPointIdx: pointIdx };
}

function clampX(x) {
  return Math.max(0, Math.min(25, Math.round(x)));
}

// Move the currently selected point.
//   - time mode: applied immediately (mutates committed values, recomputes currentStats).
//   - moves mode: stored as preview, currentStats unchanged.
// `toX` is rounded and clamped to [0, 25].
export function moveSelectedTo(state, toX) {
  if (state.finished) return state;
  if (state.selectedPointIdx == null) return state;
  const target = clampX(toX);

  if (state.mode === 'time' || state.mode === 'practice') {
    if (state.values[state.selectedPointIdx] === target) return state;
    const v = state.values.slice();
    v[state.selectedPointIdx] = target;
    const stats = computeStats(v);
    const next = { ...state, values: v, currentStats: stats };
    next.score = computeFullScore(next, { elapsedMs: state.elapsedMs, commits: state.commits });
    return next;
  }

  // moves mode -> preview
  const fromX = state.values[state.selectedPointIdx];
  if (target === fromX) {
    return { ...state, preview: null };
  }
  const previewVals = state.values.slice();
  previewVals[state.selectedPointIdx] = target;
  const previewStats = computeStats(previewVals);
  const next = {
    ...state,
    preview: { pointIdx: state.selectedPointIdx, fromX, toX: target, previewStats },
  };
  next.score = computeFullScore(
    { ...next, currentStats: previewStats },
    { elapsedMs: state.elapsedMs, commits: state.commits }
  );
  return next;
}

// Commit the active preview (moves mode). Increments commits.
export function commitMove(state) {
  if (state.finished) return state;
  if (state.mode !== 'moves' || !state.preview) return state;
  const v = state.values.slice();
  v[state.preview.pointIdx] = state.preview.toX;
  const stats = computeStats(v);
  const commits = state.commits + 1;
  const next = {
    ...state,
    values: v,
    currentStats: stats,
    preview: null,
    selectedPointIdx: state.preview.pointIdx, // keep the same point selected
    commits,
  };
  if (commits >= MOVES_LIMIT) {
    next.finished = true;
    next.endedAt = Date.now();
  }
  next.score = computeFullScore(next, { elapsedMs: state.elapsedMs, commits });
  return next;
}

// Cancel any active preview (moves mode).
export function cancelPreview(state) {
  if (!state.preview) return state;
  const next = { ...state, preview: null };
  next.score = computeFullScore(next, { elapsedMs: state.elapsedMs, commits: state.commits });
  return next;
}

// Update elapsed time (time mode). Auto-finishes when limit reached.
export function tickElapsed(state, elapsedMs) {
  if (state.finished) return state;
  let next = { ...state, elapsedMs };
  if (state.mode === 'time' && elapsedMs >= TIME_LIMIT_MS) {
    next.elapsedMs = TIME_LIMIT_MS;
    next.finished = true;
    next.endedAt = Date.now();
  }
  next.score = computeFullScore(
    { ...next, currentStats: getDisplayStats(next) },
    { elapsedMs: next.elapsedMs, commits: next.commits }
  );
  return next;
}

// User clicks "여기서 끝내기".
export function finalize(state) {
  if (state.finished) return state;
  // In moves mode, cancel any pending preview before finalizing.
  let next = state.preview ? cancelPreview(state) : state;
  next = { ...next, finished: true, endedAt: Date.now() };
  next.score = computeFullScore(next, { elapsedMs: next.elapsedMs, commits: next.commits });
  return next;
}
