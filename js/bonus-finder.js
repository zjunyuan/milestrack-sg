// Bonus finder (v1.63.35): when a statement's bonus does not match, which entries' Bonus / Base setting would explain the gap?
// The bank never says which charges earned its bonus, but the bonus it paid is a sum of per-charge bonuses, so trying every
// combination of the entries in that window finds the sets that add up. Entries logged as Base can move up (+ their bonus),
// entries logged as Bonus can move down (− their bonus). An entry whose MCC is known and not on the card's bonus list is left out
// of the "move up" side. A match is evidence, not proof: the more candidates, the more sets fit by chance, so every set that fits is
// shown and a single fit is only called a match when no other comes close.
import { state } from "./state.js";
import { ALL_MASTER_CARDS } from "./config.js";
import { calcEarnedMiles } from "./recommender.js";
import { getMccEntry } from "./mcc.js";
import { mccOf } from "./summary.js";
import { ocbcMerchantRate, wwmcOnlineRate } from "./cardrules.js";

const cardById = (id) => ALL_MASTER_CARDS.find(c => c.id === id);
const ratioOf = (vk) => Number((state.myVault && state.myVault[vk] && state.myVault[vk].ratio) || 1);
const ptsAt = (card, amt, rate) => Math.round(calcEarnedMiles(card, amt, rate) / ratioOf(card.vaultKey));

// The bonus rate this card would earn on this entry, or null when its MCC is known and not a bonus category for the card.
function bonusRateFor(tx, card) {
  const code = mccOf(tx.desc, tx.mcc);
  if (card.id === "dbs-wwmc") return wwmcOnlineRate(`${tx.desc || ""} ${tx.stmtDesc || ""}`, code || "") || null;
  if (card.id === "ocbc-rewards") { const r = ocbcMerchantRate(`${tx.desc || ""} ${tx.stmtDesc || ""}`, Number(tx.timestamp), code || ""); if (r) return r; }
  if (!code) return Number(card.bonusMpd) || null;                   // unknown MCC: could be either
  const e = getMccEntry(code);
  const c = e && [...(e.candidatesLocal || []), ...(e.candidatesOverseas || [])].find(x => x.id === card.id);
  return c && c.baseRate > card.baseMpd ? c.baseRate : null;
}

// One candidate per entry: how many points switching it would add (up) or take off (down).
export function candidatesFor(txs) {
  const out = [];
  for (const tx of txs) {
    const card = cardById(tx.cardId);
    const amt = Number(tx.amt) || 0;
    if (!card || amt <= 0 || tx.refunded || tx.yuuBonus || card.engine === "yuu-10") continue;
    if (!(Number(card.bonusMpd) > Number(card.baseMpd))) continue;
    const basePts = ptsAt(card, amt, card.baseMpd);
    if (tx.bonusCategory === "base") {
      const rate = bonusRateFor(tx, card); if (!rate) continue;
      const v = ptsAt(card, amt, rate) - basePts;
      if (v > 0) out.push({ tx, card, dir: "up", rate, value: v });
    } else {
      const v = (Number(tx.earnedRawPoints) || 0) - basePts;
      if (v > 0) out.push({ tx, card, dir: "down", rate: card.baseMpd, value: -v });
    }
  }
  return out;
}

// Every set of candidates whose values add up to the gap (within tol), fewest changes and closest first. Capped so a long list
// of entries cannot freeze the page: past ~22 candidates only the largest are tried and `partial` says so.
export function findFixes(cands, gap, tol) {
  const MAX = 22;
  let list = [...cands].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  const partial = list.length > MAX;
  if (partial) list = list.slice(0, MAX);
  const n = list.length, sets = [];
  // remaining positive / negative sums from i on, to cut branches that can no longer reach the gap
  const posRest = new Array(n + 1).fill(0), negRest = new Array(n + 1).fill(0);
  for (let i = n - 1; i >= 0; i--) { posRest[i] = posRest[i + 1] + Math.max(0, list[i].value); negRest[i] = negRest[i + 1] + Math.min(0, list[i].value); }
  let nodes = 0;
  const pick = [];
  (function walk(i, sum, added) {
    if (++nodes > 3e6 || sets.length > 50) return;
    if (added && Math.abs(sum - gap) <= tol) sets.push({ items: pick.map(k => list[k]), total: sum, diff: sum - gap });   // once per set
    if (i >= n) return;
    if (sum + posRest[i] < gap - tol || sum + negRest[i] > gap + tol) return;
    pick.push(i); walk(i + 1, sum + list[i].value, true); pick.pop();
    walk(i + 1, sum, false);
  })(0, 0, false);
  sets.sort((a, b) => Math.abs(a.diff) - Math.abs(b.diff) || a.items.length - b.items.length);
  return { sets: sets.slice(0, 3), count: sets.length, candidates: cands.length, partial };
}

// Switch the entries of one set to Bonus / Base: points and miles recomputed at the new rate, the Vault moved by the difference
// for entries that count towards it. Returns the number of entries changed.
export async function applyFix(set) {
  const { saveTxToFirestore, updateVaultDoc } = await import("./firebase.js");
  const deltas = {};
  for (const it of set.items) {
    const cur = state.transactions.find(t => t.id === it.tx.id) || it.tx;
    const rec = { ...cur }; delete rec.firestoreId;
    const amt = Number(rec.amt) || 0, card = it.card;
    const miles = calcEarnedMiles(card, amt, it.rate), pts = Math.round(miles / ratioOf(card.vaultKey));
    const d = pts - (Number(rec.earnedRawPoints) || 0);
    Object.assign(rec, { bonusCategory: it.dir === "up" ? "bonus" : "base", miles, earnedRawPoints: pts, rateSetBy: "bonus-finder" });
    await saveTxToFirestore(rec.id, rec);
    if (rec.vaultCounted || rec.source !== "statement") deltas[card.vaultKey] = (deltas[card.vaultKey] || 0) + d;
  }
  let moved = false;
  for (const [vk, d] of Object.entries(deltas)) if (d && state.myVault[vk]) { state.myVault[vk].points = Math.max(0, (Number(state.myVault[vk].points) || 0) + d); moved = true; }
  if (moved) await updateVaultDoc(state.myVaultKey, state.myVault);
  return set.items.length;
}
