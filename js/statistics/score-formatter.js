// Pure score breakdown helpers. No DOM, no Firebase.

import { roundToThird, modesEqual } from './stats-core.js';

export function formatNumber(x, decimals = 2) {
  if (!isFinite(x)) return '-';
  return x.toFixed(decimals);
}

export function formatModeText(modeValue) {
  if (!modeValue || modeValue.type === 'none') return '없음';
  return modeValue.values.join(', ');
}

// Compute base score parts. State must contain goalStats, currentStats, selectedClasses, scOriginalCounts.
//   goalStats / currentStats: { mean, median, mode, stdev, classFreq }
//   selectedClasses: [scIdx1, scIdx2]
//   scOriginalCounts: [count1, count2]  (goal frequencies for those classes; matches goalStats.classFreq[scIdxN])
export function computeBaseBreakdown(state) {
  const g = state.goalStats;
  const c = state.currentStats;

  const meanDiff = Math.abs(roundToThird(g.mean) - roundToThird(c.mean));
  const meanPts = meanDiff * 1000;

  const medianPts = Math.abs(g.median - c.median) < 1e-9 ? 0 : 100;

  const modePts = modesEqual(g.mode, c.mode) ? 0 : 100;

  const stdevDiff = Math.abs(roundToThird(g.stdev) - roundToThird(c.stdev));
  const stdevPts = stdevDiff * 100;

  const [sc1, sc2] = state.selectedClasses;
  const sc1Diff = Math.abs(c.classFreq[sc1] - g.classFreq[sc1]);
  const sc2Diff = Math.abs(c.classFreq[sc2] - g.classFreq[sc2]);
  const scPts = (sc1Diff + sc2Diff) * 20;

  return {
    meanDiff,
    meanPts,
    medianPts,
    modePts,
    stdevDiff,
    stdevPts,
    scDetails: { sc1, sc2, sc1Diff, sc2Diff },
    scPts,
    base: meanPts + medianPts + modePts + stdevPts + scPts,
  };
}

// Compute extra score by mode.
//   mode === 'time':     elapsedMs/1000 floored, capped 0..300
//   mode === 'moves':    commits * 10, capped 0..1000
//   mode === 'practice': always 0 (no time/move limit, learning mode)
export function computeExtra(mode, { elapsedMs = 0, commits = 0 } = {}) {
  if (mode === 'time') {
    const sec = Math.max(0, Math.min(300, Math.floor(elapsedMs / 1000)));
    return { extra: sec, extraDetail: { elapsedSec: sec } };
  }
  if (mode === 'moves') {
    const c = Math.max(0, Math.min(100, commits));
    return { extra: c * 10, extraDetail: { commits: c } };
  }
  // practice or unknown -> no extra
  return { extra: 0, extraDetail: {} };
}

// Top-level: produce full score object. Used both for live display and final result.
export function computeFullScore(state, modeContext) {
  const breakdown = computeBaseBreakdown(state);
  const { extra, extraDetail } = computeExtra(state.mode, modeContext);
  return {
    breakdown,
    extra,
    extraDetail,
    base: breakdown.base,
    total: breakdown.base + extra,
  };
}

// Render-friendly line list for a result panel.
export function buildBreakdownLines(score) {
  const b = score.breakdown;
  const sc = b.scDetails;
  const lines = [
    {
      label: '평균',
      value: `오차 ${formatNumber(b.meanDiff, 2)}`,
      points: b.meanPts,
    },
    {
      label: '중앙값',
      value: b.medianPts === 0 ? '일치' : '불일치',
      points: b.medianPts,
    },
    {
      label: '최빈값',
      value: b.modePts === 0 ? '일치' : '불일치',
      points: b.modePts,
    },
    {
      label: 'Selected class',
      value: `SC${sc.sc1 + 1} ${sc.sc1Diff}개 차이, SC${sc.sc2 + 1} ${sc.sc2Diff}개 차이`,
      points: b.scPts,
    },
    {
      label: '표준편차',
      value: `오차 ${formatNumber(b.stdevDiff, 2)}`,
      points: b.stdevPts,
    },
  ];
  if (score.extraDetail.elapsedSec !== undefined) {
    lines.push({ label: '소요 시간', value: `${score.extraDetail.elapsedSec}초`, points: score.extra });
  } else if (score.extraDetail.commits !== undefined) {
    lines.push({ label: '확정 횟수', value: `${score.extraDetail.commits}회`, points: score.extra });
  }
  return lines;
}
