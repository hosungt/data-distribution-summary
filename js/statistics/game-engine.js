// Game state machine. No DOM, no Firebase. All mutations return new state.
//
// Level 1~7 + 연습모드(Level 1~7) 시스템. LEVEL_CONFIG 가 게임 동작의 단일 진실 원천.
// state.config.movesLimit 유무로 입력 모드를 판별:
//   - movesLimit === null  → Level 1~3: 점 이동 즉시 반영
//   - movesLimit !== null  → Level 4~7: preview → commit 2단계 (확정 횟수 카운트)

import { computeStats, modesEqual } from './stats-core.js';
import {
  sampleGoalData,
  pickSelectedClasses,
  rearrangeToStartData,
  sampleRandomGoalData,
  getFixedStartData,
  sampleRandomStartData,
  sampleTypedStartData,
} from './distribution-sampler.js';
import { computeFullScore } from './score-formatter.js';
import { LEVEL_CONFIG, MAX_LEVEL } from './level-config.js';

// 기존 호환성용 — 외부에서 default 값을 참조할 수 있도록 export 유지.
// 실제 게임 로직은 state.config.timeLimit / state.config.movesLimit 를 본다.
export const TIME_LIMIT_MS = 10 * 60 * 1000;  // Level 7 default 10분
export const MOVES_LIMIT = 100;                // Level 4~7 default

const MAX_SAMPLE_ATTEMPTS = 200;

function usesPreview(config) {
  return config.movesLimit != null;
}

// Generate goal + SC + start for a given Level.
// Level 5~7 ('median' 또는 'mode' 가 scoreItems 에 포함) 인 경우, goal 과 start 의 median·mode 가
// 다르도록 재시도 (게임 시작 시 체감 차이 확보용).
function sampleGameData(level, n, rand) {
  const config = LEVEL_CONFIG[level];
  const requireMedianDiffer = config.scoreItems.includes('median');
  const requireModeDiffer = config.scoreItems.includes('mode');
  const needsRetry = requireMedianDiffer || requireModeDiffer;

  let last = null;
  const attempts = needsRetry ? MAX_SAMPLE_ATTEMPTS : 1;

  for (let i = 0; i < attempts; i++) {
    const goal = config.goalType === 'random'
      ? sampleRandomGoalData({ n, rand })
      : sampleGoalData({ n, rand });
    const goalStats = computeStats(goal.values);
    const selectedClasses = pickSelectedClasses({ count: config.scCount, rand });

    let startValues;
    if (config.startType === 'fixed') {
      startValues = getFixedStartData();
    } else if (config.startType === 'typed-ghi') {
      startValues = sampleTypedStartData({ rand }).values;
    } else if (config.startType === 'random') {
      startValues = sampleRandomStartData({ n, rand });
    } else {
      // 미사용 분기 — 안전장치
      startValues = rearrangeToStartData(goal.values, selectedClasses, rand);
    }
    const startStats = computeStats(startValues);
    last = { goal, goalStats, selectedClasses, startValues, startStats };

    if (!needsRetry) return last;
    const medianOk = !requireMedianDiffer || goalStats.median !== startStats.median;
    const modeOk = !requireModeDiffer || !modesEqual(goalStats.mode, startStats.mode);
    if (medianOk && modeOk) return last;
  }
  if (needsRetry) {
    console.warn(`sampleGameData: median/mode 재시도 한도 초과 (level ${level})`);
  }
  return last;
}

// Create a new game.
// level: 1..MAX_LEVEL, isPractice: 본 게임 진행도(잠금)에 영향 줄지 여부.
export function createGame({ level = 1, isPractice = false, n = 100, rand = Math.random } = {}) {
  if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) {
    throw new Error(`Unknown level: ${level}`);
  }
  const config = LEVEL_CONFIG[level];
  const { goal, goalStats, selectedClasses, startValues, startStats } = sampleGameData(level, n, rand);

  const state = {
    level,
    isPractice,
    config,
    n,
    createdAt: Date.now(),
    startedAt: null,
    endedAt: null,
    finished: false,
    goalValues: goal.values.slice(),
    goalDistType: goal.type,  // null for goalType='random'
    goalStats,
    selectedClasses,
    values: startValues,
    currentStats: startStats,
    preview: null,
    selectedPointIdx: null,
    commits: 0,
    elapsedMs: 0,
  };
  state.score = computeFullScore(state);
  return state;
}

export function startGame(state, now = Date.now()) {
  if (state.startedAt) return state;
  return { ...state, startedAt: now };
}

export function getDisplayValues(state) {
  if (!state.preview) return state.values;
  const v = state.values.slice();
  v[state.preview.pointIdx] = state.preview.toX;
  return v;
}

export function getDisplayStats(state) {
  if (state.preview) return state.preview.previewStats;
  return state.currentStats;
}

export function selectPoint(state, pointIdx) {
  if (state.finished) return state;
  if (pointIdx == null) {
    return { ...state, selectedPointIdx: null, preview: null };
  }
  // preview 사용 모드(Level 4~7)에서 다른 점 선택 시 기존 preview 취소.
  if (usesPreview(state.config) && state.preview && state.preview.pointIdx !== pointIdx) {
    return { ...state, selectedPointIdx: pointIdx, preview: null };
  }
  return { ...state, selectedPointIdx: pointIdx };
}

function clampX(x) {
  return Math.max(0, Math.min(25, Math.round(x)));
}

// 점 이동.
//   - Level 1~3 (preview 미사용): 즉시 반영, currentStats 갱신.
//   - Level 4~7 (preview 사용):   preview 로 저장, currentStats 는 그대로.
export function moveSelectedTo(state, toX) {
  if (state.finished) return state;
  if (state.selectedPointIdx == null) return state;
  const target = clampX(toX);

  if (!usesPreview(state.config)) {
    if (state.values[state.selectedPointIdx] === target) return state;
    const v = state.values.slice();
    v[state.selectedPointIdx] = target;
    const stats = computeStats(v);
    const next = { ...state, values: v, currentStats: stats };
    next.score = computeFullScore(next);
    return next;
  }

  // preview 사용 모드
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
  next.score = computeFullScore({ ...next, currentStats: previewStats });
  return next;
}

// Commit active preview (Level 4~7). Increments commits, finishes if movesLimit reached.
export function commitMove(state) {
  if (state.finished) return state;
  if (!usesPreview(state.config) || !state.preview) return state;
  const v = state.values.slice();
  v[state.preview.pointIdx] = state.preview.toX;
  const stats = computeStats(v);
  const commits = state.commits + 1;
  const next = {
    ...state,
    values: v,
    currentStats: stats,
    preview: null,
    selectedPointIdx: state.preview.pointIdx,
    commits,
  };
  if (state.config.movesLimit != null && commits >= state.config.movesLimit) {
    next.finished = true;
    next.endedAt = Date.now();
  }
  next.score = computeFullScore(next);
  return next;
}

export function cancelPreview(state) {
  if (!state.preview) return state;
  const next = { ...state, preview: null };
  next.score = computeFullScore(next);
  return next;
}

// 시간 갱신. Level 7 (timeLimit 설정) 의 경우 한도 도달 시 자동 종료.
export function tickElapsed(state, elapsedMs) {
  if (state.finished) return state;
  let next = { ...state, elapsedMs };
  const limit = state.config.timeLimit;
  if (limit != null && elapsedMs >= limit) {
    next.elapsedMs = limit;
    next.finished = true;
    next.endedAt = Date.now();
  }
  next.score = computeFullScore({ ...next, currentStats: getDisplayStats(next) });
  return next;
}

export function finalize(state) {
  if (state.finished) return state;
  let next = state.preview ? cancelPreview(state) : state;
  next = { ...next, finished: true, endedAt: Date.now() };
  next.score = computeFullScore(next);
  return next;
}
