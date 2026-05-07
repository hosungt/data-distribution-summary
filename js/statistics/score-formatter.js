// Pure score breakdown helpers. No DOM, no Firebase.
//
// Level 1~7 시스템:
//   - state.config.scoreItems  : ['mean'|'stdev'|'sc'|'median'|'mode'] 중 포함된 것만 base 점수로 합산
//   - state.config.extraScore  : null / 'moves' / 'moves+time'
//   - state.selectedClasses    : 길이 0/1/2 (Level 1: 0, Level 2: 1, Level 3~7: 2)

import { roundToThird, modesEqual } from './stats-core.js';
import { MOVE_SCORE_PER_COMMIT, TIME_SCORE_PER_5_SECONDS } from './level-config.js';

export function formatNumber(x, decimals = 2) {
  if (!isFinite(x)) return '-';
  return x.toFixed(decimals);
}

export function formatModeText(modeValue) {
  if (!modeValue || modeValue.type === 'none') return '없음';
  return modeValue.values.join(', ');
}

// scoreItems / selectedClasses 기반 동적 합산.
export function computeBaseBreakdown(state) {
  const g = state.goalStats;
  const c = state.currentStats;
  const items = state.config.scoreItems;
  const sc = state.selectedClasses || [];

  const breakdown = {};
  let base = 0;

  if (items.includes('mean')) {
    const meanDiff = Math.abs(roundToThird(g.mean) - roundToThird(c.mean));
    const meanPts = meanDiff * 1000;
    breakdown.meanDiff = meanDiff;
    breakdown.meanPts = meanPts;
    base += meanPts;
  }

  if (items.includes('stdev')) {
    const stdevDiff = Math.abs(roundToThird(g.stdev) - roundToThird(c.stdev));
    const stdevPts = stdevDiff * 100;
    breakdown.stdevDiff = stdevDiff;
    breakdown.stdevPts = stdevPts;
    base += stdevPts;
  }

  if (items.includes('sc') && sc.length > 0) {
    const scDetails = sc.map((idx) => ({
      idx,
      diff: Math.abs(c.classFreq[idx] - g.classFreq[idx]),
    }));
    const scDiffSum = scDetails.reduce((a, d) => a + d.diff, 0);
    const scPts = scDiffSum * 20;
    breakdown.scDetails = scDetails;
    breakdown.scPts = scPts;
    base += scPts;
  }

  if (items.includes('median')) {
    const medianPts = Math.abs(g.median - c.median) < 1e-9 ? 0 : 100;
    breakdown.medianPts = medianPts;
    base += medianPts;
  }

  if (items.includes('mode')) {
    const modePts = modesEqual(g.mode, c.mode) ? 0 : 100;
    breakdown.modePts = modePts;
    base += modePts;
  }

  breakdown.base = base;
  return breakdown;
}

// 추가점 계산. state.config.extraScore 분기.
//   null          → 0
//   'moves'       → commits * 3   (Level 4~6)
//   'moves+time'  → commits * 3 + ⌊elapsedMs / 5000⌋  (Level 7)
export function computeExtra(state) {
  const kind = state.config.extraScore;
  const commits = Math.max(0, state.commits || 0);
  const elapsedMs = Math.max(0, state.elapsedMs || 0);

  if (kind === null || kind === undefined) {
    return { extra: 0, extraDetail: {} };
  }

  const movesLimit = state.config.movesLimit;
  const cappedCommits = movesLimit != null ? Math.min(movesLimit, commits) : commits;
  const movesPts = cappedCommits * MOVE_SCORE_PER_COMMIT;

  if (kind === 'moves') {
    return {
      extra: movesPts,
      extraDetail: { commits: cappedCommits, movesPts },
    };
  }

  if (kind === 'moves+time') {
    const timeLimit = state.config.timeLimit;
    const cappedMs = timeLimit != null ? Math.min(timeLimit, elapsedMs) : elapsedMs;
    const elapsedSec = Math.floor(cappedMs / 1000);
    const timePts = Math.floor(cappedMs / 5000) * TIME_SCORE_PER_5_SECONDS;
    return {
      extra: movesPts + timePts,
      extraDetail: { commits: cappedCommits, movesPts, elapsedSec, timePts },
    };
  }

  return { extra: 0, extraDetail: {} };
}

// 전체 점수 — state 단일 인자.
export function computeFullScore(state) {
  const breakdown = computeBaseBreakdown(state);
  const { extra, extraDetail } = computeExtra(state);
  return {
    breakdown,
    extra,
    extraDetail,
    base: breakdown.base,
    total: breakdown.base + extra,
  };
}

// 결과 패널용 라인 배열. scoreItems / selectedClasses 에 포함된 항목만 노출.
export function buildBreakdownLines(state) {
  const score = state.score;
  const b = score.breakdown;
  const items = state.config.scoreItems;
  const lines = [];

  if (items.includes('mean')) {
    lines.push({
      label: '평균',
      value: `오차 ${formatNumber(b.meanDiff, 2)}`,
      points: b.meanPts,
    });
  }
  if (items.includes('stdev')) {
    lines.push({
      label: '표준편차',
      value: `오차 ${formatNumber(b.stdevDiff, 2)}`,
      points: b.stdevPts,
    });
  }
  if (items.includes('sc') && b.scDetails && b.scDetails.length > 0) {
    const scText = b.scDetails
      .map((d, i) => `SC${i + 1}(${d.idx + 1}구간) ${d.diff}개 차이`)
      .join(', ');
    lines.push({
      label: 'Selected class',
      value: scText,
      points: b.scPts,
    });
  }
  if (items.includes('median')) {
    lines.push({
      label: '중앙값',
      value: b.medianPts === 0 ? '일치' : '불일치',
      points: b.medianPts,
    });
  }
  if (items.includes('mode')) {
    lines.push({
      label: '최빈값',
      value: b.modePts === 0 ? '일치' : '불일치',
      points: b.modePts,
    });
  }

  // 추가점 라인
  if (score.extraDetail && score.extraDetail.commits !== undefined) {
    lines.push({
      label: '확정 횟수',
      value: `${score.extraDetail.commits}회`,
      points: score.extraDetail.movesPts ?? score.extra,
    });
  }
  if (score.extraDetail && score.extraDetail.elapsedSec !== undefined) {
    lines.push({
      label: '소요 시간',
      value: `${score.extraDetail.elapsedSec}초`,
      points: score.extraDetail.timePts ?? 0,
    });
  }

  return lines;
}
