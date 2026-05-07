// Generate Goal Data and Start Data for the statistics game.
// No DOM, no Firebase.
//
// Distribution types A/B/C/D define [min%, max%) ranges per class (5 classes).
// Picking probability: A 40%, B 20%, C 20%, D 20%.

import { CLASS_BOUNDS } from './stats-core.js';

// Each row: [minPct, maxPct] inclusive-exclusive percentages.
// Note: maxPct is non-inclusive in spec ("0% 이상 15% 미만").
export const TYPE_RANGES = {
  A: [[ 0, 15], [10, 25], [20, 40], [10, 25], [ 0, 15]],
  B: [[ 0, 15], [10, 25], [ 0, 15], [25, 40], [20, 40]],
  C: [[ 0, 15], [ 0, 25], [10, 30], [25, 40], [10, 30]],
  D: [[10, 30], [25, 40], [10, 30], [ 0, 25], [ 0, 15]],
};

const TYPE_PICK_WEIGHTS = [['A', 0.4], ['B', 0.2], ['C', 0.2], ['D', 0.2]];

export function pickDistributionType(rand = Math.random) {
  const r = rand();
  let acc = 0;
  for (const [type, w] of TYPE_PICK_WEIGHTS) {
    acc += w;
    if (r < acc) return type;
  }
  return 'D';
}

// Convert percent ranges to integer count ranges for given n.
// minCount = ceil(n * minPct/100), maxCount = ceil(n * maxPct/100) - 1 (since maxPct is exclusive).
// Edge case: if maxPct is 100, cap at n.
function pctRangeToCountRange(pctRange, n) {
  const [lo, hi] = pctRange;
  const minCount = Math.ceil((n * lo) / 100);
  const maxExclusive = Math.ceil((n * hi) / 100);
  // hi is exclusive: count must be < n*hi/100. Largest int satisfying that is ceil(n*hi/100)-1.
  const maxCount = Math.max(minCount, maxExclusive - 1);
  return [minCount, maxCount];
}

// Sum-preserving frequency vector sampler.
// Returns array of 5 integers in their respective ranges, summing to n.
export function sampleFrequencyVector(type, n, rand = Math.random) {
  const ranges = TYPE_RANGES[type].map((r) => pctRangeToCountRange(r, n));
  // Start at midpoints.
  const freq = ranges.map(([lo, hi]) => Math.floor((lo + hi) / 2));
  let diff = n - freq.reduce((a, b) => a + b, 0);
  let safety = 5000;
  while (diff !== 0 && safety-- > 0) {
    const sign = diff > 0 ? 1 : -1;
    const candidates = [];
    for (let i = 0; i < freq.length; i++) {
      const [lo, hi] = ranges[i];
      if (sign > 0 && freq[i] + 1 <= hi) candidates.push(i);
      if (sign < 0 && freq[i] - 1 >= lo) candidates.push(i);
    }
    if (!candidates.length) break;
    const pick = candidates[Math.floor(rand() * candidates.length)];
    freq[pick] += sign;
    diff -= sign;
  }
  if (diff !== 0) {
    // Should never happen for valid type ranges + n=100. Throw for visibility.
    throw new Error(`sampleFrequencyVector failed to converge for type=${type} n=${n}`);
  }
  return freq;
}

// Given a frequency vector, fill n integer values by picking uniformly within each class.
// Class i covers integers [bound.min .. bound.max - (inclusiveMax ? 0 : 1)].
function classIntegerCandidates(idx) {
  const c = CLASS_BOUNDS[idx];
  const out = [];
  const maxInt = c.inclusiveMax ? c.max : c.max - 1;
  for (let v = c.min; v <= maxInt; v++) out.push(v);
  return out;
}

function pickRandomInt(arr, rand = Math.random) {
  return arr[Math.floor(rand() * arr.length)];
}

export function valuesFromFrequencyVector(freq, rand = Math.random) {
  const values = [];
  for (let i = 0; i < freq.length; i++) {
    const cands = classIntegerCandidates(i);
    for (let k = 0; k < freq[i]; k++) {
      values.push(pickRandomInt(cands, rand));
    }
  }
  return values;
}

// Returns goal data: type, frequency vector, integer values.
export function sampleGoalData({ n = 100, type = null, rand = Math.random } = {}) {
  const t = type || pickDistributionType(rand);
  const freq = sampleFrequencyVector(t, n, rand);
  const values = valuesFromFrequencyVector(freq, rand);
  return { type: t, frequencies: freq, values };
}

// Pick 2 distinct class indices (0..4) uniformly at random.
export function pickSelectedClasses(rand = Math.random) {
  const a = Math.floor(rand() * 5);
  let b = Math.floor(rand() * 4);
  if (b >= a) b += 1;
  return a < b ? [a, b] : [b, a];
}

// Build Start Data:
// - SC1, SC2 values: copied from goal as-is.
// - Other 3 classes: re-shuffle each value to a uniformly random integer within its same class.
//   Net effect: per-class frequencies match goal exactly, but specific integers may differ.
export function rearrangeToStartData(goalValues, selectedClasses, rand = Math.random) {
  const sc = new Set(selectedClasses);
  const out = goalValues.slice();
  for (let i = 0; i < out.length; i++) {
    // Determine class index for this value
    let classIdx = -1;
    for (let c = 0; c < CLASS_BOUNDS.length; c++) {
      const cb = CLASS_BOUNDS[c];
      const inLow = out[i] >= cb.min;
      const inHigh = cb.inclusiveMax ? out[i] <= cb.max : out[i] < cb.max;
      if (inLow && inHigh) { classIdx = c; break; }
    }
    if (classIdx < 0 || sc.has(classIdx)) continue;
    const cands = classIntegerCandidates(classIdx);
    out[i] = pickRandomInt(cands, rand);
  }
  return out;
}
