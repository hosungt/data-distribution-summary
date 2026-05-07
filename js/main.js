// 글루 코드: 모드 선택 화면, 게임 lifecycle, 입력, localStorage 기록, 결과 화면.
// 순수 모듈은 ./statistics/* 에 분리되어 있음.

import {
  createGame, startGame, selectPoint, moveSelectedTo,
  commitMove, cancelPreview, tickElapsed, finalize,
  getDisplayValues, getDisplayStats,
} from './statistics/game-engine.js';
import {
  setupDotGraphCanvas, drawScene, columnFromPx,
  hitTestDot, buildDotPositions,
} from './statistics/dot-graph-render.js';
import { roundToThird } from './statistics/stats-core.js';
import { formatNumber, formatModeText, buildBreakdownLines } from './statistics/score-formatter.js';
import { LEVEL_CONFIG, LEVEL_LIST, MAX_LEVEL, LEVEL_PASS_THRESHOLD } from './statistics/level-config.js';

// ---------------------------------------------------------
// URL 라우팅
// ---------------------------------------------------------
const params = new URLSearchParams(window.location.search);
const requestedMode = params.get('contentMode');

const MODE_RE = /^(?:(practice)-)?level([1-7])$/;
function parseMode(raw) {
  if (!raw) return null;
  const m = MODE_RE.exec(raw);
  if (!m) return null;
  return { level: Number(m[2]), isPractice: m[1] === 'practice' };
}

// ---------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------
const KEY_PREFIX = 'dds-level1:scores:';
const UNLOCK_KEY = 'dds-level1:unlocked-level';

function getUnlockedLevel() {
  const v = Number(localStorage.getItem(UNLOCK_KEY) || '1');
  if (!Number.isFinite(v)) return 1;
  return Math.max(1, Math.min(MAX_LEVEL, v));
}
function setUnlockedLevel(n) {
  localStorage.setItem(UNLOCK_KEY, String(Math.max(1, Math.min(MAX_LEVEL, n))));
}
function tryUnlockNextLevel(state) {
  if (state.isPractice) return null;
  const total = state.score.total;
  const cur = getUnlockedLevel();
  if (state.level === cur && total < LEVEL_PASS_THRESHOLD && cur < MAX_LEVEL) {
    setUnlockedLevel(cur + 1);
    return cur + 1;
  }
  return null;
}
function recordsKey({ level, isPractice }) {
  return KEY_PREFIX + (isPractice ? 'practice-level' : 'level') + level;
}
function loadRecords(slot) {
  try {
    const raw = localStorage.getItem(recordsKey(slot));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveRecord(slotInfo, record) {
  const list = loadRecords(slotInfo);
  list.push(record);
  list.sort((a, b) => a.total - b.total);
  const trimmed = list.slice(0, 50);
  try { localStorage.setItem(recordsKey(slotInfo), JSON.stringify(trimmed)); }
  catch (err) { console.warn('records save failed:', err); }
}

// ---------------------------------------------------------
// Mode label / level tag
// ---------------------------------------------------------
function modeLabel(slotInfo) {
  const head = slotInfo.isPractice ? '연습 모드' : '본 게임';
  return `${head} — Level ${slotInfo.level}`;
}

function describeLevelTag(config) {
  const parts = [];
  if (config.scoreItems.includes('mean')) parts.push('평균');
  if (config.scoreItems.includes('stdev')) parts.push('표준편차');
  if (config.scoreItems.includes('sc')) parts.push(config.scCount === 1 ? 'SC 1개' : `SC ${config.scCount}개`);
  if (config.scoreItems.includes('median')) parts.push('중앙값');
  if (config.scoreItems.includes('mode')) parts.push('최빈값');
  const limits = [];
  if (config.movesLimit != null) limits.push(`${config.movesLimit}회`);
  if (config.timeLimit != null) limits.push(`${Math.round(config.timeLimit / 60000)}분`);
  return parts.join(' · ') + (limits.length ? `<br><span style="color:#9ca3af;">제한 ${limits.join(', ')}</span>` : '');
}

// ---------------------------------------------------------
// Mode selector view 렌더
// ---------------------------------------------------------
const modeSelectorView = document.getElementById('modeSelectorView');
const gameView = document.getElementById('gameView');
const modeSubtitle = document.getElementById('modeSubtitle');
const mainGrid = document.getElementById('mainLevelGrid');
const practiceGrid = document.getElementById('practiceLevelGrid');

const slot = parseMode(requestedMode);
const initialUnlocked = getUnlockedLevel();

function isUnlocked(level) {
  // 본 게임 / 연습 모두 unlocked-level 까지 활성
  return level <= getUnlockedLevel();
}

function createLevelCard({ level, isPractice, config, locked, passed }) {
  const card = document.createElement('div');
  card.className = 'level-card' + (locked ? ' locked' : '') + (passed ? ' passed' : '');
  card.dataset.level = String(level);
  card.dataset.practice = isPractice ? 'true' : 'false';
  card.innerHTML = `
    ${locked ? '<span class="lock-icon">🔒</span>' : ''}
    <div class="level-num">Level ${level}</div>
    <div class="level-tag">${describeLevelTag(config)}</div>
  `;
  if (!locked) {
    card.addEventListener('click', () => {
      const url = new URL(window.location.href);
      url.searchParams.set('contentMode', (isPractice ? 'practice-level' : 'level') + level);
      window.location.href = url.toString();
    });
  }
  return card;
}

function renderLevelSelector() {
  if (!mainGrid || !practiceGrid) return;
  mainGrid.innerHTML = '';
  practiceGrid.innerHTML = '';
  const cur = getUnlockedLevel();
  for (const level of LEVEL_LIST) {
    const config = LEVEL_CONFIG[level];
    mainGrid.appendChild(createLevelCard({
      level, isPractice: false, config,
      locked: level > cur,
      passed: level < cur,
    }));
    practiceGrid.appendChild(createLevelCard({
      level, isPractice: true, config,
      locked: level > cur,
      passed: false,
    }));
  }
}

// 잘못된 contentMode / 잠긴 Level 직행 시도 → URL 정리 후 모드 선택 화면
const validSlot = slot && isUnlocked(slot.level);
if (!validSlot) {
  if (requestedMode) {
    const url = new URL(window.location.href);
    url.searchParams.delete('contentMode');
    history.replaceState({}, '', url.toString());
  }
  modeSelectorView.style.display = '';
  renderLevelSelector();
} else {
  gameView.style.display = '';
  modeSubtitle.textContent = modeLabel(slot);
  document.title = `자료의 분포와 요약 — ${modeSubtitle.textContent}`;
}

// ---------------------------------------------------------
// Toast helper
// ---------------------------------------------------------
const toastStack = document.getElementById('toastStack');
function toast(msg, kind = 'info', ms = 1800) {
  const el = document.createElement('div');
  el.className = `toast ${kind === 'info' ? '' : kind}`.trim();
  el.textContent = msg;
  toastStack.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .25s'; }, ms - 250);
  setTimeout(() => el.remove(), ms);
}

// ---------------------------------------------------------
// Records (per-slot)
// ---------------------------------------------------------
function renderRecords() {
  const body = document.getElementById('recordsBody');
  if (!body || !slot) return;
  const records = loadRecords(slot).slice(0, 5);
  if (!records.length) {
    body.className = 'records-empty';
    body.textContent = '아직 기록이 없습니다.';
    return;
  }
  body.className = 'records-list';
  body.innerHTML = '';
  records.forEach((r, i) => {
    const row = document.createElement('div');
    row.className = 'record-row';
    const date = new Date(r.completedAt);
    const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    const distLabel = r.distType ? `· 분포 ${r.distType} ` : '';
    row.innerHTML = `<span class="rank">${i + 1}위</span>
      <span><span class="meta">${dateStr} ${distLabel}· 기본 ${Math.round(r.base)} + 추가 ${Math.round(r.extra)}</span></span>
      <span class="score">${Math.round(r.total)}점</span>`;
    body.appendChild(row);
  });
}

if (validSlot) renderRecords();

// ---------------------------------------------------------
// Game state and rendering
// ---------------------------------------------------------
let state = null;
let geometry = null;
let dragState = null;
let timerHandle = null;
let timerStart = null;

const canvas = document.getElementById('dotGraphCanvas');
const startBtn = document.getElementById('startBtn');
const endBtn = document.getElementById('endBtn');
const confirmBtn = document.getElementById('confirmBtn');
const cancelPreviewBtn = document.getElementById('cancelPreviewBtn');
const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');
const modeSelectBtn = document.getElementById('modeSelectBtn');
const hintLine = document.getElementById('hintLine');

function ensureGeometry() {
  if (!canvas) return;
  geometry = setupDotGraphCanvas(canvas);
}
window.addEventListener('resize', () => {
  if (!state) return;
  ensureGeometry();
  render();
});

function setState(newState) {
  state = newState;
  render();
}

function usesPreview(config) {
  return config.movesLimit != null;
}

function render() {
  if (!state || !geometry) return;
  drawScene(canvas, state, geometry);
  renderRightPanel();
  renderClassInfoRow();
  renderStatsTable();
  renderControls();
}

function renderStatsTable() {
  // Level 의 scoreItems 에 포함된 컬럼만 노출.
  // mean, stdev 는 모든 Level 에 포함되므로 항상 표시.
  // median: Level 5 부터, mode: Level 6 부터.
  const items = state.config.scoreItems;
  for (const col of ['mean', 'median', 'mode', 'stdev']) {
    const show = items.includes(col);
    document.querySelectorAll(`[data-stat-col="${col}"]`).forEach((el) => {
      el.style.display = show ? '' : 'none';
    });
  }

  const goalStats = state.goalStats;
  const dispStats = getDisplayStats(state);

  document.getElementById('goalMean').textContent = formatNumber(roundToThird(goalStats.mean));
  document.getElementById('goalMedian').textContent = formatNumber(goalStats.median, goalStats.median % 1 === 0 ? 0 : 1);
  document.getElementById('goalMode').textContent = formatModeText(goalStats.mode);
  document.getElementById('goalStdev').textContent = formatNumber(roundToThird(goalStats.stdev));
  ['goalMean', 'goalMedian', 'goalMode', 'goalStdev'].forEach(id => document.getElementById(id).classList.remove('muted'));

  document.getElementById('curMean').textContent = formatNumber(roundToThird(dispStats.mean));
  document.getElementById('curMedian').textContent = formatNumber(dispStats.median, dispStats.median % 1 === 0 ? 0 : 1);
  document.getElementById('curMode').textContent = formatModeText(dispStats.mode);
  document.getElementById('curStdev').textContent = formatNumber(roundToThird(dispStats.stdev));
  ['curMean', 'curMedian', 'curMode', 'curStdev'].forEach(id => document.getElementById(id).classList.remove('muted'));
}

function renderClassInfoRow() {
  const row = document.getElementById('classInfoRow');
  const sc = new Set(state.selectedClasses);
  const dispStats = getDisplayStats(state);
  const goalFreq = state.goalStats.classFreq;
  const curFreq = dispStats.classFreq;
  const labels = ['0~5', '5~10', '10~15', '15~20', '20~25'];
  let html = '';
  for (let i = 0; i < 5; i++) {
    const isSc = sc.has(i);
    if (isSc) {
      const cur = curFreq[i];
      const goal = goalFreq[i];
      const match = cur === goal;
      html += `<div class="class-info sc">
        <div class="range">${labels[i]}</div>
        <div class="count ${match ? 'match' : 'mismatch'}">현재 ${cur} / 목표 ${goal}</div>
      </div>`;
    } else {
      html += `<div class="class-info">
        <div class="range">${labels[i]}</div>
      </div>`;
    }
  }
  row.innerHTML = html;
}

function renderRightPanel() {
  const chips = document.getElementById('metaChips');
  const total = document.getElementById('scoreTotal');
  const breakdown = document.getElementById('scoreBreakdown');
  const score = state.score;
  total.textContent = `${Math.round(score.total)}점`;
  breakdown.textContent = `기본 ${Math.round(score.base)} + 추가 ${Math.round(score.extra)}`;

  const config = state.config;
  let chipHtml = '';
  chipHtml += `<div class="chip">${state.isPractice ? '연습' : '본'} <b>Level ${state.level}</b></div>`;
  if (state.goalDistType) {
    chipHtml += `<div class="chip">분포 <b>${state.goalDistType}</b></div>`;
  }
  if (config.timeLimit != null) {
    const remainMs = Math.max(0, config.timeLimit - state.elapsedMs);
    const minutes = Math.floor(remainMs / 60000);
    const seconds = Math.floor((remainMs % 60000) / 1000);
    const isLow = remainMs < 30000;
    chipHtml += `<div class="chip ${isLow ? 'warn' : ''}">남은 시간 <b>${minutes}:${String(seconds).padStart(2, '0')}</b></div>`;
  }
  if (config.movesLimit != null) {
    const remain = config.movesLimit - state.commits;
    const isLow = remain < 10;
    chipHtml += `<div class="chip ${isLow ? 'warn' : ''}">남은 횟수 <b>${remain}</b></div>`;
    chipHtml += `<div class="chip">확정 <b>${state.commits}</b></div>`;
  }
  if (config.timeLimit == null && config.movesLimit == null) {
    chipHtml += `<div class="chip">제한 없음</div>`;
  }
  chips.innerHTML = chipHtml;
}

function renderControls() {
  const playing = state.startedAt && !state.finished;
  startBtn.disabled = playing;
  startBtn.textContent = state.startedAt ? '진행 중' : '게임 시작';
  endBtn.disabled = !playing;
  leftBtn.disabled = !playing || state.selectedPointIdx == null;
  rightBtn.disabled = !playing || state.selectedPointIdx == null;
  if (usesPreview(state.config)) {
    confirmBtn.style.display = '';
    confirmBtn.disabled = !playing || !state.preview;
    cancelPreviewBtn.style.display = state.preview ? '' : 'none';
  } else {
    confirmBtn.style.display = 'none';
    cancelPreviewBtn.style.display = 'none';
  }
  if (!state.startedAt) {
    hintLine.textContent = '게임 시작 버튼을 눌러 자료를 생성하세요.';
  } else if (state.finished) {
    hintLine.textContent = '게임이 종료됐어요.';
  } else if (state.selectedPointIdx == null) {
    hintLine.textContent = usesPreview(state.config)
      ? '점을 클릭해 선택한 뒤 옮기면 미리보기로 표시돼요. 확정을 눌러야 1회로 카운트돼요.'
      : '점을 클릭하면 선택돼요. 선택 후 좌우 버튼 / 화살표 키 / 드래그로 옮길 수 있어요.';
  } else if (usesPreview(state.config) && state.preview) {
    hintLine.textContent = `미리보기: ${state.preview.fromX} → ${state.preview.toX}. 확정 또는 취소를 선택하세요.`;
  } else {
    hintLine.textContent = '좌우 버튼 / 화살표 키 / 드래그로 옮기세요. 다른 점을 클릭하면 선택이 바뀌어요.';
  }
}

// ---------------------------------------------------------
// Game lifecycle
// ---------------------------------------------------------
function newGame() {
  if (!slot) return;
  const initial = createGame({ level: slot.level, isPractice: slot.isPractice, n: 100 });
  state = initial;
  ensureGeometry();
  render();
}

function buildStartMessage(s) {
  const config = s.config;
  if (config.timeLimit != null) {
    const min = Math.round(config.timeLimit / 60000);
    return `${min}분 안에 통계량을 맞춰 보세요!`;
  }
  if (config.movesLimit != null) {
    return `점을 옮긴 뒤 확정을 눌러 카운트하세요. ${config.movesLimit}회까지 가능합니다.`;
  }
  return '자유롭게 점을 옮기며 통계량 변화를 관찰해 보세요.';
}

function startCurrentGame() {
  if (!state) return;
  const next = startGame(state);
  timerStart = Date.now();
  setState(next);
  if (state.config.timeLimit != null) startTicker();
  toast(buildStartMessage(state));
}

function startTicker() {
  stopTicker();
  timerHandle = setInterval(() => {
    if (!state || state.finished) { stopTicker(); return; }
    const elapsed = Date.now() - timerStart;
    const next = tickElapsed(state, elapsed);
    setState(next);
    if (next.finished) {
      stopTicker();
      showResult();
    }
  }, 250);
}
function stopTicker() {
  if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
}

function endNow() {
  if (!state || state.finished) return;
  stopTicker();
  const next = finalize(state);
  setState(next);
  showResult();
}

// ---------------------------------------------------------
// Result panel
// ---------------------------------------------------------
function showResult() {
  const overlay = document.getElementById('resultOverlay');
  const title = document.getElementById('resultTitle');
  const totalEl = document.getElementById('resultTotal');
  const tableEl = document.getElementById('resultBreakdown');
  const banner = document.getElementById('unlockBanner');
  const actions = document.getElementById('resultActions');

  title.textContent = `${modeLabel(slot)} 결과`;
  totalEl.textContent = `${Math.round(state.score.total)}점`;

  const lines = buildBreakdownLines(state);
  tableEl.innerHTML = lines.map((l) => `
    <tr>
      <td class="label">${l.label}</td>
      <td class="value">${l.value}</td>
      <td class="points">+${Math.round(l.points)}</td>
    </tr>
  `).join('') + `<tr>
    <td class="label"><b>합계</b></td>
    <td class="value"></td>
    <td class="points"><b>${Math.round(state.score.total)}점</b></td>
  </tr>`;

  // 잠금 해제 처리 (본 게임 통과 시에만)
  const newlyUnlocked = tryUnlockNextLevel(state);
  if (newlyUnlocked) {
    banner.style.display = '';
    banner.textContent = `🎉 Level ${newlyUnlocked} 가 활성화되었습니다!`;
  } else {
    banner.style.display = 'none';
  }

  // 두 갈래 버튼: 새로 잠금 해제 + 본 게임 → [Level X 도전] / [모드 선택으로]
  // 그 외 → [다시 도전] / [모드 선택으로]
  if (newlyUnlocked && !state.isPractice) {
    actions.innerHTML = `
      <button class="btn ghost" id="resultModeBtn">모드 선택으로</button>
      <button class="btn primary" id="resultNextBtn">Level ${newlyUnlocked} 도전</button>
    `;
  } else {
    actions.innerHTML = `
      <button class="btn ghost" id="resultModeBtn">모드 선택으로</button>
      <button class="btn primary" id="resultRetryBtn">다시 도전</button>
    `;
  }
  bindResultActions(newlyUnlocked);
  overlay.style.display = '';

  // 기록 저장
  saveRecord(slot, {
    total: state.score.total,
    base: state.score.base,
    extra: state.score.extra,
    completedAt: Date.now(),
    distType: state.goalDistType || null,
    level: state.level,
    isPractice: state.isPractice,
  });
  renderRecords();
}

function bindResultActions(newlyUnlocked) {
  const modeBtn = document.getElementById('resultModeBtn');
  if (modeBtn) {
    modeBtn.addEventListener('click', () => {
      const url = new URL(window.location.href);
      url.searchParams.delete('contentMode');
      window.location.href = url.toString();
    });
  }
  const nextBtn = document.getElementById('resultNextBtn');
  if (nextBtn && newlyUnlocked) {
    nextBtn.addEventListener('click', () => {
      const url = new URL(window.location.href);
      url.searchParams.set('contentMode', 'level' + newlyUnlocked);
      window.location.href = url.toString();
    });
  }
  const retryBtn = document.getElementById('resultRetryBtn');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      document.getElementById('resultOverlay').style.display = 'none';
      newGame();
      startCurrentGame();
    });
  }
}

// ---------------------------------------------------------
// Initial UI (before first game)
// ---------------------------------------------------------
function setInitialUi() {
  startBtn.disabled = false;
  startBtn.textContent = '게임 시작';
  endBtn.disabled = true;
  leftBtn.disabled = true;
  rightBtn.disabled = true;
  confirmBtn.disabled = true;
  cancelPreviewBtn.style.display = 'none';
  hintLine.textContent = '게임 시작 버튼을 눌러 자료를 생성하세요.';
}

// ---------------------------------------------------------
// Event wiring (game view only)
// ---------------------------------------------------------
if (validSlot) {
  setInitialUi();

  startBtn.addEventListener('click', () => {
    if (state && state.startedAt && !state.finished) return;
    newGame();
    startCurrentGame();
  });
  endBtn.addEventListener('click', endNow);
  modeSelectBtn.addEventListener('click', () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('contentMode');
    window.location.href = url.toString();
  });
  confirmBtn.addEventListener('click', () => {
    if (!state.preview) return;
    const next = commitMove(state);
    setState(next);
    if (next.finished) showResult();
  });
  cancelPreviewBtn.addEventListener('click', () => {
    const next = cancelPreview(state);
    setState(next);
  });

  leftBtn.addEventListener('click', () => moveSelected(-1));
  rightBtn.addEventListener('click', () => moveSelected(+1));

  canvas.addEventListener('keydown', (e) => {
    if (!state || !state.startedAt || state.finished) return;
    if (state.selectedPointIdx == null) return;
    if (e.key === 'ArrowLeft') { moveSelected(-1); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { moveSelected(+1); e.preventDefault(); }
  });

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerUp);
}

function moveSelected(delta) {
  if (!state || !state.startedAt || state.finished) return;
  if (state.selectedPointIdx == null) return;
  const curX = state.preview ? state.preview.toX : state.values[state.selectedPointIdx];
  const next = moveSelectedTo(state, curX + delta);
  setState(next);
  if (next.finished) showResult();
}

function getCanvasXY(e) {
  const rect = canvas.getBoundingClientRect();
  return { px: e.clientX - rect.left, py: e.clientY - rect.top };
}

function onPointerDown(e) {
  if (!state || !state.startedAt || state.finished) return;
  canvas.focus();
  canvas.setPointerCapture(e.pointerId);
  const { px, py } = getCanvasXY(e);
  const positions = buildDotPositions(state);
  const hit = hitTestDot(positions, geometry, px, py);
  if (hit != null) {
    const next = selectPoint(state, hit);
    setState(next);
    dragState = { pointerId: e.pointerId, dragging: true, lastColumn: state.values[hit] };
  } else {
    if (state.selectedPointIdx != null) {
      setState(selectPoint(state, null));
    }
    dragState = null;
  }
}

function onPointerMove(e) {
  if (!dragState || dragState.pointerId !== e.pointerId) return;
  if (!state || state.finished || state.selectedPointIdx == null) return;
  const { px } = getCanvasXY(e);
  const col = columnFromPx(px, geometry.w);
  if (col === dragState.lastColumn) return;
  dragState.lastColumn = col;
  const next = moveSelectedTo(state, col);
  setState(next);
  if (next.finished) showResult();
}

function onPointerUp(e) {
  if (!dragState || dragState.pointerId !== e.pointerId) return;
  try { canvas.releasePointerCapture(e.pointerId); } catch {}
  dragState = null;
}
