// DBS yuu miles follow the conditions met in the calendar month:
//   S$800 spend AND 4 different partner merchants met -> partner spend earns 10 mpd (up to the S$822.86 cap)
//   conditions not met                                 -> partner spend earns about 2.78 mpd (card.lockedMpd)
//   non-partner spend, or partner spend over the cap   -> 0.14 mpd (card.baseMpd)
// Pure functions plus one writer (applyYuuRecalc). Nothing here runs on its own: the card sheet offers the recalculation.
import { state } from "./state.js";
import { detectYuuMerchant } from "./config.js";
import { saveTxToFirestore, updateVaultDoc } from "./firebase.js";

export function yuuPlan(card, txns) {
  const sorted = [...txns].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  const spend = sorted.reduce((s, t) => s + (Number(t.amt) || 0), 0);
  const partners = new Set(sorted.map(t => detectYuuMerchant(t.desc)).filter(Boolean));
  const need = Number(card.minSpend) || 800;
  const met = spend >= need && partners.size >= 4;
  const top = met ? card.bonusMpd : (card.lockedMpd ?? card.baseMpd);
  let partnerSpend = 0;
  const plan = new Map();
  for (const t of sorted) {
    const amt = Number(t.amt) || 0;
    if (!detectYuuMerchant(t.desc) || amt <= 0) { plan.set(t.id, { partner: false, miles: Math.round(amt * card.baseMpd) }); continue; }
    const room = Math.max(0, card.monthlyCap - partnerSpend);
    const inCap = Math.min(amt, room);
    partnerSpend += amt;
    plan.set(t.id, { partner: true, miles: Math.round(inCap * top) + Math.round((amt - inCap) * card.baseMpd) });
  }
  return { met, spend, partners, topMpd: top, plan };
}

// What the cycle should have earned vs what is logged.
export function yuuExpected(card, txns) {
  const p = yuuPlan(card, txns);
  let expected = 0, logged = 0, changes = 0;
  for (const t of txns) {
    const e = p.plan.get(t.id); if (!e) continue;
    expected += e.miles; logged += Number(t.miles) || 0;
    if (e.miles !== (Number(t.miles) || 0)) changes++;
  }
  return { ...p, expected, logged, diff: expected - logged, changes };
}

// Miles for one new entry, counted with the entries already in its month.
export function yuuMilesForNew(card, monthTxns, entry) {
  const p = yuuPlan(card, [...monthTxns, { ...entry, id: "__new" }]);
  const e = p.plan.get("__new");
  return { miles: e.miles, partner: e.partner, met: p.met };
}

// Rewrites miles (and the vault's raw points) on the cycle's entries so they match the conditions. Entries imported from a statement
// without being added to the vault keep the vault untouched. Rolls the in-memory vault back if a write fails.
export async function applyYuuRecalc(card, txns) {
  const p = yuuPlan(card, txns);
  const ratio = state.myVault[card.vaultKey]?.ratio || 1;
  const vaultBefore = JSON.stringify(state.myVault);
  let dPts = 0;
  const writes = [];
  for (const t of txns) {
    const e = p.plan.get(t.id);
    if (!e || e.miles === (Number(t.miles) || 0)) continue;
    const newRaw = Math.round(e.miles / ratio);
    const oldRaw = Number(t.earnedRawPoints) || Math.round((Number(t.miles) || 0) / ratio);
    const inVault = t.source !== "statement" || t.vaultCounted;
    if (inVault) dPts += newRaw - oldRaw;
    const rec = { ...t, miles: e.miles, earnedRawPoints: newRaw, bonusCategory: e.partner ? "bonus" : "base", estimatedMiles: true };
    delete rec.firestoreId;
    writes.push(rec);
  }
  if (!writes.length) return { changed: 0, dPts: 0 };
  try {
    if (dPts && state.myVault[card.vaultKey]) {
      state.myVault[card.vaultKey].points = Math.max(0, (Number(state.myVault[card.vaultKey].points) || 0) + dPts);
      await updateVaultDoc(state.myVaultKey, state.myVault);
    }
    for (const rec of writes) await saveTxToFirestore(rec.id, rec);
  } catch (err) {
    try { state.myVault = JSON.parse(vaultBefore); } catch (e) { /* keep as is */ }
    throw err;
  }
  return { changed: writes.length, dPts };
}
