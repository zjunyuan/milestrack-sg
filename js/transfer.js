// What can actually be moved to KrisFlyer today, and what is left over ("orphaned") because the bank converts in blocks.
// Rules: {pts, miles} blocks, optional step (HSBC), or {pts, miles, min} for single-step conversion above a minimum (yuu).
// Pure; a tile's points are treated as one pooled balance. Currencies with no `transfer` rule return null.
export function transferPlan(item) {
  const r = rawPlan(item); if (!r) return null;
  const t = item.transfer, size = r.firstBlock ? (t.min || t.pts) : (t.step ? t.step.pts : t.pts);
  const have = r.firstBlock ? Math.max(0, Math.floor(Number(item.points) || 0)) : r.orphanPts;
  r.pct = (r.continuous && !r.firstBlock) ? 0 : Math.min(100, Math.round(have / size * 100)); // progress toward the next block, for the tile's bar
  return r;
}

function rawPlan(item) {
  const t = item && item.transfer; if (!t) return null;
  const pts = Math.max(0, Math.floor(Number(item.points) || 0));
  let used = 0, miles = 0, nextIn = 0;
  if (t.min) { // converts in single-mile steps once the minimum is reached (yuu: 3.6 pts = 1 mile, minimum 200 pts)
    if (pts >= t.min) { miles = Math.floor(pts / t.pts * t.miles); used = Math.round(miles * t.pts / t.miles); }
    else nextIn = t.min - pts;
    const orphan = pts - used;
    return { miles, usedPts: used, orphanPts: orphan, orphanMiles: Math.floor(orphan * t.miles / t.pts), nextIn, firstBlock: pts < t.min, continuous: true };
  }
  if (pts >= t.pts) {
    if (t.step) {
      const n = Math.floor((pts - t.pts) / t.step.pts);
      used = t.pts + n * t.step.pts; miles = t.miles + n * t.step.miles;
      nextIn = t.step.pts - (pts - used);
    } else {
      const n = Math.floor(pts / t.pts);
      used = n * t.pts; miles = n * t.miles;
      nextIn = t.pts - (pts - used);
    }
  } else nextIn = t.pts - pts;
  const orphan = pts - used;
  return { miles, usedPts: used, orphanPts: orphan, orphanMiles: Math.floor(orphan * t.miles / t.pts), nextIn, firstBlock: pts < t.pts };
}
