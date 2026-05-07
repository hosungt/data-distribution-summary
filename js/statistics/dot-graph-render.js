// Canvas renderer for the dot graph + histogram. Receives canvas and state as args.
// React port: keep the imperative draw API; call from useEffect.

export const RENDER = {
  LEFT_PAD: 32,
  RIGHT_PAD: 32,
  TOP_PAD: 16,
  BOTTOM_PAD: 32,
  DOT_R: 6,
  HIT_R: 14,
  CLASS_BOUNDS: [0, 5, 10, 15, 20, 25],
};

export function setupDotGraphCanvas(canvas) {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width));
  const h = Math.max(1, Math.floor(rect.height));
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h, dpr };
}

export function columnX(v, w) {
  const { LEFT_PAD, RIGHT_PAD } = RENDER;
  const plotW = w - LEFT_PAD - RIGHT_PAD;
  return LEFT_PAD + (v / 25) * plotW;
}

export function baselineY(h) {
  return h - RENDER.BOTTOM_PAD;
}

export function stackCenterY(stackIdx, h) {
  const r = RENDER.DOT_R;
  return baselineY(h) - r - 2 * r * stackIdx;
}

export function columnFromPx(px, w) {
  const { LEFT_PAD, RIGHT_PAD } = RENDER;
  const plotW = w - LEFT_PAD - RIGHT_PAD;
  if (plotW <= 0) return 0;
  const t = (px - LEFT_PAD) / plotW;
  let v = Math.round(t * 25);
  if (v < 0) v = 0;
  if (v > 25) v = 25;
  return v;
}

// Build positions array from the *preview-applied* values.
// Each entry: { valueIdx, column, stackPos, isPreview }
export function buildDotPositions(state) {
  const byColumn = new Map();
  const result = [];
  for (let i = 0; i < state.values.length; i++) {
    const isPreview = state.preview && state.preview.pointIdx === i;
    const v = isPreview ? state.preview.toX : state.values[i];
    if (!byColumn.has(v)) byColumn.set(v, []);
    byColumn.get(v).push(i);
  }
  for (const [col, indices] of byColumn.entries()) {
    indices.forEach((valueIdx, stackPos) => {
      result.push({
        valueIdx,
        column: col,
        stackPos,
        isPreview: state.preview && state.preview.pointIdx === valueIdx,
      });
    });
  }
  return result;
}

// Hit test: returns valueIdx of topmost dot within HIT_R. Prefers higher stack position.
export function hitTestDot(positions, geometry, px, py) {
  const { w, h } = geometry;
  const r2 = RENDER.HIT_R * RENDER.HIT_R;
  let best = null;
  for (const p of positions) {
    const x = columnX(p.column, w);
    const y = stackCenterY(p.stackPos, h);
    const dx = px - x, dy = py - y;
    const d2 = dx * dx + dy * dy;
    if (d2 > r2) continue;
    if (!best || p.stackPos > best.stackPos || (p.stackPos === best.stackPos && d2 < best.d2)) {
      best = { valueIdx: p.valueIdx, stackPos: p.stackPos, d2 };
    }
  }
  return best ? best.valueIdx : null;
}

export function drawScene(canvas, state, geometry) {
  const { ctx, w, h } = geometry;
  ctx.clearRect(0, 0, w, h);

  const baseY = baselineY(h);
  const r = RENDER.DOT_R;
  const sc = new Set(state.selectedClasses);

  // 1. Histogram (uses display stats)
  const displayStats = state.preview ? state.preview.previewStats : state.currentStats;
  const freq = displayStats.classFreq;
  for (let i = 0; i < 5; i++) {
    const xL = columnX(RENDER.CLASS_BOUNDS[i], w);
    const xR = columnX(RENDER.CLASS_BOUNDS[i + 1], w);
    const barH = freq[i] * r;
    if (barH > 0) {
      ctx.fillStyle = sc.has(i) ? 'rgba(239,68,68,0.18)' : 'rgba(29,78,216,0.18)';
      ctx.fillRect(xL, baseY - barH, xR - xL, barH);
    }
  }

  // 2. Vertical integer grid (skip 5-unit lines, drawn in step 4)
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  for (let v = 0; v <= 25; v++) {
    if (v % 5 === 0) continue;
    const x = Math.round(columnX(v, w)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, RENDER.TOP_PAD);
    ctx.lineTo(x, baseY);
    ctx.stroke();
  }

  // 3. Horizontal axis (segments by class; SC bars in red)
  for (let i = 0; i < 5; i++) {
    const xL = columnX(RENDER.CLASS_BOUNDS[i], w);
    const xR = columnX(RENDER.CLASS_BOUNDS[i + 1], w);
    ctx.strokeStyle = sc.has(i) ? '#ef4444' : '#111827';
    ctx.lineWidth = sc.has(i) ? 2 : 1.5;
    ctx.beginPath();
    ctx.moveTo(xL, Math.round(baseY) + 0.5);
    ctx.lineTo(xR, Math.round(baseY) + 0.5);
    ctx.stroke();
  }

  // 4. Big tick marks + labels at 0,5,...,25
  ctx.font = '12px "Pretendard","Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let v = 0; v <= 25; v += 5) {
    const x = Math.round(columnX(v, w)) + 0.5;
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.lineTo(x, baseY + 6);
    ctx.stroke();
    ctx.fillStyle = '#374151';
    ctx.fillText(String(v), x, baseY + 9);
  }

  // 5. Dots
  const positions = buildDotPositions(state);
  // First draw the original/dim ghost for the moving point (so user sees where it came from).
  if (state.preview) {
    const fromX = state.preview.fromX;
    let cstack = 0;
    for (let i = 0; i < state.preview.pointIdx; i++) {
      if (state.values[i] === fromX) cstack++;
    }
    const xC = columnX(fromX, w);
    const yC = stackCenterY(cstack, h);
    ctx.fillStyle = 'rgba(156,163,175,0.55)';
    ctx.beginPath();
    ctx.arc(xC, yC, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(107,114,128,0.6)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.arc(xC, yC, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Draw committed dots (skip the previewing one — we render that on top below).
  for (const p of positions) {
    if (p.isPreview) continue;
    const x = columnX(p.column, w);
    const y = stackCenterY(p.stackPos, h);
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Selection highlight (when no preview)
  if (state.selectedPointIdx != null && !state.preview) {
    const sel = positions.find((p) => p.valueIdx === state.selectedPointIdx);
    if (sel) {
      const x = columnX(sel.column, w);
      const y = stackCenterY(sel.stackPos, h);
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, r + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Preview dot on top
  if (state.preview) {
    const p = positions.find((pp) => pp.isPreview);
    if (p) {
      const x = columnX(p.column, w);
      const y = stackCenterY(p.stackPos, h);
      ctx.fillStyle = 'rgba(37,99,235,0.55)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(x, y, r + 1, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}
