// Pure statistics functions. No DOM, no Firebase. Safe to copy 1:1 to React/Next port.

export const CLASS_BOUNDS = [
  { min: 0,  max: 5,  inclusiveMax: false },
  { min: 5,  max: 10, inclusiveMax: false },
  { min: 10, max: 15, inclusiveMax: false },
  { min: 15, max: 20, inclusiveMax: false },
  { min: 20, max: 25, inclusiveMax: true  },
];

export function mean(arr) {
  if (!arr.length) return 0;
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += arr[i];
  return s / arr.length;
}

export function median(arr) {
  if (!arr.length) return 0;
  const sorted = arr.slice().sort((a, b) => a - b);
  const n = sorted.length;
  const mid = Math.floor(n / 2);
  return n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function frequencyMap(arr) {
  const m = new Map();
  for (let i = 0; i < arr.length; i++) {
    m.set(arr[i], (m.get(arr[i]) || 0) + 1);
  }
  return m;
}

// Mode: returns { type: 'none' | 'set', values: number[] }
//   - none if max frequency is 1
//   - none if all distinct values share the same frequency
//   - else set of all values reaching the max frequency, sorted asc
export function mode(arr) {
  if (!arr.length) return { type: 'none', values: [] };
  const m = frequencyMap(arr);
  let maxF = 0;
  for (const f of m.values()) if (f > maxF) maxF = f;
  if (maxF <= 1) return { type: 'none', values: [] };
  const freqs = Array.from(m.values());
  const allEqual = freqs.every((f) => f === freqs[0]);
  if (allEqual) return { type: 'none', values: [] };
  const values = [];
  for (const [v, f] of m.entries()) if (f === maxF) values.push(v);
  values.sort((a, b) => a - b);
  return { type: 'set', values };
}

export function modesEqual(a, b) {
  if (a.type !== b.type) return false;
  if (a.type === 'none') return true;
  if (a.values.length !== b.values.length) return false;
  for (let i = 0; i < a.values.length; i++) {
    if (a.values[i] !== b.values[i]) return false;
  }
  return true;
}

// Population standard deviation. Middle-school definition.
export function populationStdev(arr) {
  if (!arr.length) return 0;
  const m = mean(arr);
  let s = 0;
  for (let i = 0; i < arr.length; i++) {
    const d = arr[i] - m;
    s += d * d;
  }
  return Math.sqrt(s / arr.length);
}

// "Round at the third decimal place" -> show two decimals.
// Per spec: 18.76, 8.31 (two-decimal display).
export function roundToThird(x) {
  return Math.round(x * 100) / 100;
}

// Class index 0..4 for a value in [0, 25]. 25 belongs to last class.
export function classIndexOf(value) {
  for (let i = 0; i < CLASS_BOUNDS.length; i++) {
    const c = CLASS_BOUNDS[i];
    const inLow = value >= c.min;
    const inHigh = c.inclusiveMax ? value <= c.max : value < c.max;
    if (inLow && inHigh) return i;
  }
  return -1;
}

// Returns array of length 5 with frequency per class.
export function frequencyByClass(arr) {
  const out = [0, 0, 0, 0, 0];
  for (let i = 0; i < arr.length; i++) {
    const idx = classIndexOf(arr[i]);
    if (idx >= 0) out[idx]++;
  }
  return out;
}

// Convenience: compute all stats used by the game in one pass.
export function computeStats(arr) {
  return {
    mean: mean(arr),
    median: median(arr),
    mode: mode(arr),
    stdev: populationStdev(arr),
    classFreq: frequencyByClass(arr),
  };
}
