// What can actually be moved to KrisFlyer today, and what is left over ("orphaned") because the bank converts in blocks.
// Pure; a tile's points are treated as one pooled balance. Currencies with no `transfer` rule return null.
export function transferPlan(item) {
  const t = item && item.transfer; if (!t) return null;
  const pts = Math.max(0, Math.floor(Number(item.points) || 0));
  let used = 0, miles = 0, nextIn = 0;
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
