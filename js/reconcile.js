// Points check (v1.59.0): what the banks say about points (statement summaries, balances you typed, transfers/redemptions you logged,
// all in state.pointsLog from Firestore milestrack_points) against what the app expected from your entries. Mostly pure.
//
// The idea: banks rarely list points per transaction, update balances now and then, and credit bonus points weeks later as one lump.
// So the app never compares one entry with one credit. It turns every entry into dated credits (base points when the charge posts;
// the bonus once its cycle has ended, by the date in BONUS_SPLIT.timing), and at each statement date checks the running total:
//   sure   = credits that must have landed between the first checkpoint and this one
//   maybe  = credits that could have landed either side (a bonus still within its window, or one from before the first checkpoint)
//   bank   = what the bank says was earned over the same span
// short when bank < sure - tolerance; over when bank > sure + maybe + tolerance; else ok (or "bonus pending" while maybe > 0).
// Seen on real statements (2026): OCBC earned = base only, the bonus (incl. the 6 mpd promo) comes one statement later;
// HSBC Revolution's bonus shows as "Points Adjusted" a month later; DBS Vantage earns in the same statement, WWMC's bonus later;
// UOB prints one UNI$ total for every UOB card and lists fee reversals as adjustments.
import { state } from "./state.js";
import { ALL_MASTER_CARDS, BONUS_SPLIT, DEFAULT_VAULT, cardShort } from "./config.js";
import { countsTs, cycleBounds } from "./posting.js";
import { findRetailerForInput } from "./retailers.js";
import { fmtNum } from "./format.js";

const DAY = 86400000;
export const BANK_LABEL = { ocbc: "OCBC", dbs: "DBS", maybank: "Maybank", uob: "UOB", hsbc: "HSBC" };
// Cards whose bank app lists points per transaction (MileLion, Sep 2025): big entries go on the "check in the bank app" list.
const PER_TXN_APP = /^(dbs-(?!yuu)|uob-ppv-|hsbc-rev)/;
// What that app shows next to one transaction: base only where the bonus comes as a separate monthly line.
const APP_SHOWS_BASE = (id) => !!BONUS_SPLIT[id];

const ratioOf = (vk) => (state.myVault && state.myVault[vk] && Number(state.myVault[vk].ratio)) || (DEFAULT_VAULT[vk] && DEFAULT_VAULT[vk].ratio) || 1;
const unitOf = (vk) => (state.myVault && state.myVault[vk] && state.myVault[vk].unit) || (DEFAULT_VAULT[vk] && DEFAULT_VAULT[vk].unit) || "pts";
export const currencyName = (vk) => (state.myVault && state.myVault[vk] && state.myVault[vk].name) || (DEFAULT_VAULT[vk] && DEFAULT_VAULT[vk].name) || vk;
const cardById = (id) => ALL_MASTER_CARDS.find(c => c.id === id);
const ymd = (ts) => { const d = new Date(ts); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`; };
export const fmtDate = (ts) => new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

// ---------- what the app expects ----------

const pointsOf = (t, vk) => { const raw = Number(t.earnedRawPoints); return Number.isFinite(raw) && raw !== 0 ? raw : Math.round((Number(t.miles) || 0) / ratioOf(vk)); };
// Base points the bank credits with the charge itself (same rounding as bonus-split.js), for cards that credit the bonus separately.
function basePoints(card, t, vk) {
  const rule = BONUS_SPLIT[card.id]; const amt = Number(t.amt) || 0;
  if (!rule) return null;
  const counted = rule.baseRound === "dollar" ? Math.round(amt) : Math.floor(amt / rule.block) * rule.block;
  return Math.round(counted * card.baseMpd / ratioOf(vk));
}
const postedTs = (t) => t.postTs || ((t.timestamp || 0) + 2 * DAY);
// The bonus for a cycle arrives after the cycle ends; allow until the 7th of the month after the cycle's next start.
function bonusWindow(card, t) {
  const { next } = cycleBounds(card, new Date(countsTs(t, card) || t.timestamp || 0));
  return { lo: next.getTime(), hi: new Date(next.getFullYear(), next.getMonth() + 1, 7, 23, 59).getTime() };
}

// Every expected credit for one currency (optionally one card family): [{ lo, hi, pts, kind: "all"|"base"|"bonus", tx, card }].
export function expectedCredits(vk, cardIds = null) {
  const ids = new Set((cardIds || ALL_MASTER_CARDS.filter(c => c.vaultKey === vk).map(c => c.id)));
  const out = [];
  for (const t of state.transactions || []) {
    if (!ids.has(t.cardId)) continue;
    const card = cardById(t.cardId); if (!card) continue;
    const pts = pointsOf(t, vk); if (!pts) continue;
    const post = postedTs(t), slack = t.postTs ? 0 : 3 * DAY;
    const lag = card.bank === "Maybank" ? 3 * DAY : 0;               // Maybank: spend in the last 2 business days shows next month
    const base = basePoints(card, t, vk);
    if (base === null || pts <= base) { out.push({ lo: post, hi: post + slack + lag, pts, kind: "all", tx: t, card }); continue; }
    out.push({ lo: post, hi: post + slack, pts: base, kind: "base", tx: t, card });
    const w = bonusWindow(card, t);
    out.push({ lo: w.lo, hi: w.hi, pts: pts - base, kind: "bonus", tx: t, card });
  }
  return out;
}

// ---------- what the bank says ----------

export const checkpointsFor = (vk) => (state.pointsLog || []).filter(r => r.vaultKey === vk && (r.kind === "statement" || r.kind === "balance")).sort((a, b) => a.ts - b.ts);
export const outflowsFor = (vk) => (state.pointsLog || []).filter(r => r.vaultKey === vk && r.kind === "out").sort((a, b) => a.ts - b.ts);

// Points the bank credited for spend over the statement period. UOB lists fee reversals ("MEMBERSHIP FEE REV") as adjustments: not earned.
function bankEarned(r) {
  const extra = (r.items || []).filter(i => i.pts > 0).reduce((s, i) => s + i.pts, 0);
  return (Number(r.earned) || 0) + (Number(r.adjusted) || 0) - (r.bank === "uob" ? extra : 0);
}

// Runs the check for one currency, or one card within it (byCard rows). Returns rows newest first:
// [{ rec, from, to, bank, sure, maybe, periodSure, periodMaybe, periodBank, status, gap, tol, chainGap, credits }]
export function reconcile(vk, cardId = null) {
  const fam = cardId ? familyIds(cardId) : null;
  const credits = expectedCredits(vk, fam);
  const outs = outflowsFor(vk);
  const recs = checkpointsFor(vk).map(r => {
    if (!cardId) return { ...r, earnedSpan: r.kind === "statement" ? bankEarned(r) : null };
    const row = (r.byCard || []).find(c => c.cardId && fam.includes(c.cardId));
    return row ? { ...r, ...row, kind: r.kind, earnedSpan: Number(row.earned) || 0, items: [] } : null;
  }).filter(Boolean);
  if (!recs.length) return [];
  const start0 = recs[0].from || new Date(new Date(recs[0].ts).setMonth(new Date(recs[0].ts).getMonth() - 1)).getTime();
  const rows = [];
  let bankCum = 0, cumStart = null, prev = null;
  for (let k = 0; k < recs.length; k++) {
    const r = recs[k], to = r.ts, from = k ? recs[k - 1].ts : start0;
    let spanBank = r.earnedSpan;
    if (spanBank === null) {                                           // a balance you typed: the change since the last one, plus what you moved out
      spanBank = prev ? (Number(r.closing) || 0) - (Number(prev.closing) || 0) + outs.filter(o => o.ts > prev.ts && o.ts <= to).reduce((s, o) => s + (Number(o.pts) || 0), 0) : null;
    }
    const chainGap = prev && r.kind === "statement" && prev.kind === "statement" && Number.isFinite(r.opening) ? Math.round(r.opening - prev.closing) : 0;
    const inSpan = (c, a, b) => c.lo > a && c.hi <= b, overlaps = (c, a, b) => c.hi > a && c.lo <= b;
    if (spanBank === null) { rows.push({ rec: r, from, to, baseline: true, status: "baseline" }); prev = r; continue; }
    if (cumStart === null) cumStart = from;                            // the running check starts at the first checkpoint with a figure
    const base0 = cumStart;
    bankCum += spanBank;
    const sureC = credits.filter(c => inSpan(c, base0, to)), maybeC = credits.filter(c => overlaps(c, base0, to) && !inSpan(c, base0, to));
    const sure = sum(sureC), maybe = sum(maybeC);
    const pSure = sum(credits.filter(c => inSpan(c, from, to))), pMaybe = sum(credits.filter(c => overlaps(c, from, to) && !inSpan(c, from, to)));
    const tol = Math.max(5, sureC.length + maybeC.length);
    const short = sure - bankCum, over = bankCum - (sure + maybe);
    // A bonus still within its window that the bank has already paid is fine: "pending" only while some of it is still missing.
    const status = short > tol ? "short" : over > tol ? "over" : (sure + maybe - bankCum) > tol ? "pending" : "ok";
    rows.push({ rec: r, from, to, bank: bankCum, sure, maybe, periodBank: spanBank, periodSure: pSure, periodMaybe: pMaybe, status, gap: status === "short" ? short : status === "over" ? over : 0, due: Math.max(0, sure + maybe - bankCum), tol, chainGap, credits: sureC, start: base0 });
    prev = r;
  }
  return rows.reverse();
}
const sum = (list) => list.reduce((s, c) => s + c.pts, 0);
function familyIds(cardId) {
  const c = cardById(cardId); if (!c) return [cardId];
  // Channel entries of one physical card (uob-ppv-contactless / -online, ...) share the statement row.
  const stem = cardId.replace(/-(contactless|online|fcy|dining|travel)$/, "");
  return ALL_MASTER_CARDS.filter(x => x.vaultKey === c.vaultKey && (x.id === cardId || x.id.replace(/-(contactless|online|fcy|dining|travel)$/, "") === stem)).map(x => x.id);
}

// ---------- which entries to look at ----------

// For a short checkpoint: the entries most likely to have missed their bonus, best first. [{ tx, card, bonus, score, why[] }]
export function suspects(row, limit = 5) {
  if (!row || row.status !== "short") return [];
  const gap = row.gap, tol = row.tol;
  const byTx = new Map();
  for (const c of row.credits) {
    if (c.kind === "base") continue;
    if (c.tx.bonusCategory === "base") continue;
    const base = c.kind === "bonus" ? 0 : Math.round((Number(c.tx.amt) || 0) * c.card.baseMpd / ratioOf(c.card.vaultKey));
    const bonus = c.pts - base;
    if (bonus <= 0) continue;
    byTx.set(c.tx.id || c.tx.firestoreId, { tx: c.tx, card: c.card, bonus, score: 0, why: [] });
  }
  const list = [...byTx.values()];
  for (const s of list) {
    if (Math.abs(s.bonus - gap) <= tol) { s.score += 5; s.why.push(`its bonus (${fmtNum(s.bonus)} ${unitOf(s.card.vaultKey)}) matches what is missing`); }
    const r = safe(() => findRetailerForInput(String(s.tx.desc || ""), state.merchantOverrides || {}));
    if (!r) { s.score += 2; s.why.push("merchant not in the retailer list, so its category (MCC) is a guess"); }
    else if (r.conf && r.conf !== "high") { s.score += 2; s.why.push(`merchant category (MCC ${r.mcc}) is not certain`); }
    if (r && r.alt) { s.score += 2; s.why.push(`this merchant can also code as MCC ${[].concat(r.alt).join(" / ")}`); }
    if (/^(citi-rewards|uob-ppv-|uob-vs-contactless)/.test(s.card.id)) { s.score += 1; s.why.push("the bonus depends on paying online / by contactless"); }
    const { next } = cycleBounds(s.card, new Date(countsTs(s.tx, s.card) || s.tx.timestamp));
    if (next.getTime() - (s.tx.timestamp || 0) < 3 * DAY) { s.score += 1; s.why.push("spent at the end of a cycle: it may have counted to the next one"); }
    if ((Number(s.tx.amt) || 0) >= (state.bigCheck || 250)) { s.score += 1; s.why.push("a big entry"); }
  }
  // Two entries whose bonuses together match the gap.
  if (!list.some(s => s.score >= 5)) {
    for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) {
      if (Math.abs(list[a].bonus + list[b].bonus - gap) <= tol) {
        for (const s of [list[a], list[b]]) { s.score += 3; s.why.unshift(`with ${desc(s === list[a] ? list[b] : list[a])}, their bonuses match what is missing`); }
      }
    }
  }
  return list.filter(s => s.score > 0).sort((a, b) => b.score - a.score || b.bonus - a.bonus).slice(0, limit);
}
const safe = (f) => { try { return f(); } catch { return null; } };
const desc = (s) => `${String(s.tx.desc || "").slice(0, 24)} (S$${fmtNum(Number(s.tx.amt) || 0, 2)})`;

// Big entries on cards whose bank app lists points per transaction, not checked yet. [{ tx, card, expect, note }]
export function bigChecks(now = Date.now()) {
  const min = Number(state.bigCheck) || 250;
  const out = [];
  for (const t of state.transactions || []) {
    if (!PER_TXN_APP.test(t.cardId || "") || (Number(t.amt) || 0) < min || t.bankPts != null) continue;
    const card = cardById(t.cardId); if (!card) continue;
    const post = postedTs(t);
    if (now - post < 2 * DAY || now - (t.timestamp || 0) > 90 * DAY) continue;   // not posted yet / older than the app keeps (UOB TMRW: 3 months)
    out.push({ tx: t, card, ...shownInApp(t, card) });
  }
  return out.sort((a, b) => (b.tx.timestamp || 0) - (a.tx.timestamp || 0));
}
export function shownInApp(t, card) {
  const vk = card.vaultKey, pts = pointsOf(t, vk), base = basePoints(card, t, vk);
  if (APP_SHOWS_BASE(card.id) && base !== null && pts > base) return { expect: base, note: `base only; the bonus of about ${fmtNum(pts - base)} comes as one monthly line` };
  return { expect: pts, note: "" };
}
// Entries you checked whose bank figure is short of what the app expected.
export function checkedShort() {
  return (state.transactions || []).filter(t => t.bankPts != null).map(t => {
    const card = cardById(t.cardId); if (!card) return null;
    const { expect } = shownInApp(t, card);
    return Number(t.bankPts) < expect - 1 ? { tx: t, card, expect, got: Number(t.bankPts) } : null;
  }).filter(Boolean);
}

// ---------- the Vault from the last statement ----------

// Latest bank balance plus what the app expects since then, minus what you moved out since. Null when there is no checkpoint.
export function balanceFromBank(vk, now = Date.now()) {
  const cps = checkpointsFor(vk); if (!cps.length) return null;
  const last = cps[cps.length - 1];
  const since = expectedCredits(vk).filter(c => c.lo > last.ts && c.lo <= now + 60 * DAY).reduce((s, c) => s + c.pts, 0);
  const out = outflowsFor(vk).filter(o => o.ts > last.ts).reduce((s, o) => s + (Number(o.pts) || 0), 0);
  return { asOf: last.ts, bank: Number(last.closing) || 0, since, out, points: Math.max(0, Math.round((Number(last.closing) || 0) + since - out)) };
}

// ---------- saving ----------

export function pointsLine(p) {
  const v = p.verified === false ? " (not verified)" : "";
  return `${p.currency || currencyName(p.vaultKey)} +${fmtNum(Math.round(p.earned || 0))} earned, ${fmtNum(Math.round(p.closing || 0))} balance${v}`;
}
// Statement summaries from an import: one record per currency and statement date (re-importing overwrites the same record).
export async function saveStatementPoints(list, last4s = {}) {
  const { savePointsRecord } = await import("./firebase.js");
  const seen = new Set();
  for (const p of list) {
    if (!p.vaultKey || !p.asOf) continue;
    const id = `${state.myVaultKey}_${p.vaultKey}_${ymd(p.asOf)}`;
    if (seen.has(id)) continue; seen.add(id);
    const single = (p.byCard || []).length <= 1 && p.fileCard;
    const byCard = (p.byCard || []).map(c => ({ ...c, cardId: last4s[c.last4] || (single ? p.fileCard : "") || "" }));
    const rec = { kind: "statement", source: "statement", bank: p.bank, vaultKey: p.vaultKey, ts: p.asOf, from: p.from || null,
      opening: p.opening, earned: p.earned, redeemed: p.redeemed, adjusted: p.adjusted, closing: p.closing, expiring: p.expiring || 0,
      expiryDate: p.expiryDate || null, items: (p.items || []).map(i => ({ ts: i.ts || null, what: String(i.what || "").slice(0, 60), pts: i.pts })),
      byCard, verified: p.verified !== false, at: Date.now() };
    await savePointsRecord(id, rec);
  }
}
// A balance you looked up (bank app, website): { vaultKey, ts, closing, note }.
export async function saveBalance(vk, ts, closing, note = "") {
  const { savePointsRecord } = await import("./firebase.js");
  await savePointsRecord(`${state.myVaultKey}_${vk}_bal_${ymd(ts)}`, { kind: "balance", source: "manual", vaultKey: vk, ts, closing: Math.round(closing), note: String(note).slice(0, 100), at: Date.now() });
}
// A transfer or redemption: takes the points off the Vault tile now (and adds the miles to KrisFlyer for a transfer there).
export async function saveOutflow(vk, ts, pts, what, miles = 0, note = "") {
  const { savePointsRecord } = await import("./firebase.js");
  const id = `${state.myVaultKey}_${vk}_out_${Date.now()}`;
  await savePointsRecord(id, { kind: "out", source: "manual", vaultKey: vk, ts, pts: Math.round(pts), what, miles: Math.round(miles) || 0, note: String(note).slice(0, 100), at: Date.now() });
  await moveVault(vk, -pts, what === "transfer" ? miles : 0);
}
export async function deleteOutflow(rec) {
  const { deletePointsRecord } = await import("./firebase.js");
  await deletePointsRecord(rec.id);
  if (rec.kind === "out") await moveVault(rec.vaultKey, Number(rec.pts) || 0, rec.what === "transfer" ? -(Number(rec.miles) || 0) : 0);
}
async function moveVault(vk, dPts, dKf) {
  const v = JSON.parse(JSON.stringify(state.myVault || {}));
  if (v[vk]) v[vk].points = Math.max(0, (Number(v[vk].points) || 0) + dPts);
  if (dKf && v.kf_direct) v.kf_direct.points = Math.max(0, (Number(v.kf_direct.points) || 0) + dKf);
  await writeVault(v);
}
// Optimistic like the rest of the app: show the new balances now, put the old ones back if the write fails.
async function writeVault(v) {
  const { updateVaultDoc } = await import("./firebase.js");
  const before = state.myVault;
  state.myVault = v; window.dispatchEvent(new CustomEvent("vault-updated"));
  try { await updateVaultDoc(state.myVaultKey, v); }
  catch (e) { state.myVault = before; window.dispatchEvent(new CustomEvent("vault-updated")); throw e; }
}
// "Use the bank's balance": sets the Vault tile to the last statement balance plus what is expected since.
export async function setVaultFromBank(vk) {
  const b = balanceFromBank(vk); if (!b) return null;
  const v = JSON.parse(JSON.stringify(state.myVault || {}));
  if (!v[vk]) return null;
  v[vk].points = b.points;
  await writeVault(v);
  return b;
}
export async function saveBankCheck(t, pts) {
  const { saveTxToFirestore } = await import("./firebase.js");
  const { firestoreId, ...rest } = t;
  await saveTxToFirestore(firestoreId || t.id, { ...rest, bankPts: Math.round(pts), bankChecked: Date.now() });
}

export const unitName = unitOf;
export const cardName = (id) => { const c = cardById(id); return c ? cardShort(c) : id; };
