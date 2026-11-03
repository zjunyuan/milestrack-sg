// Bonus by month (v1.63.49): for cards whose bank pays each calendar month's bonus as one credit on the next statement
// (MONTHLY_BONUS in config.js; DBS Woman's World first), the check is done per month instead of per statement:
//   expected = the month's bonus spend (by transaction date, up to the cap) ÷ S$5 × rate, rounded down once, as the T&C does;
//   paid     = what the bank credited on the statement after the month ends, less the base points for that statement's own lines.
// Before this the bonus was only "could land here", so a statement whose range ran from the base up to base + every bonus looked
// "in range" even when hundreds of points were missing, and finding which month fell short meant reading two statements side by side.
// Pure except for reading state; the statement list is passed in (stmt-filter.js builds it) so this module imports no UI.
import { state } from "./state.js";
import { MONTHLY_BONUS } from "./config.js";
import { familyIds, expectedCredits } from "./reconcile.js";

export const monthlyRule = (cardId) => MONTHLY_BONUS[cardId] || null;
const DAY = 86400000;
const keyOf = (ts) => { const d = new Date(ts); return d.getFullYear() * 100 + d.getMonth() + 1; };
export const monthEnd = (key) => new Date(Math.floor(key / 100), key % 100, 0, 23, 59, 59, 999).getTime();
export const monthStart = (key) => new Date(Math.floor(key / 100), key % 100 - 1, 1).getTime();
export const monthLabel = (key) => new Date(monthStart(key)).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
export const monthIso = (key) => `${Math.floor(key / 100)}-${String(key % 100).padStart(2, "0")}`;

// The card's entries grouped by calendar month: { key, txs (every entry), spend (bonus spend), capped, expected }.
export function monthSpend(cardId) {
  const rule = monthlyRule(cardId); if (!rule) return [];
  const fam = familyIds(cardId);
  const months = new Map();
  const txs = (state.transactions || []).filter(t => fam.includes(t.cardId) && Number(t.timestamp)).sort((a, b) => a.timestamp - b.timestamp);
  for (const t of txs) {
    const k = keyOf(t.timestamp);
    if (!months.has(k)) months.set(k, { key: k, txs: [], spend: 0 });
    const m = months.get(k); m.txs.push(t);
    const amt = Number(t.amt) || 0;
    if (amt > 0 && !t.refunded && !t.yuuBonus && t.bonusCategory !== "base") m.spend += amt;
  }
  for (const m of months.values()) {
    m.spend = Math.round(m.spend * 100) / 100;
    m.capped = Math.min(m.spend, rule.cap);
    m.expected = Math.floor(m.capped / rule.per * rule.rate + 1e-9);
  }
  return [...months.values()].sort((a, b) => a.key - b.key);
}

// Base points a statement holds for its own lines: sure (posted inside it) and up to `maybe` more (lines posting near the cut-off).
export function baseOn(p, credits) {
  const inside = (c) => c.lo > p.from && c.hi <= p.to, overlaps = (c) => c.hi > p.from && c.lo <= p.to && !inside(c);
  const add = (l) => l.reduce((a, c) => a + c.pts, 0);
  const base = credits.filter(c => c.kind !== "bonus");
  return { sure: add(base.filter(inside)), maybe: add(base.filter(overlaps)) };
}

// One row per statement that pays a bonus (newest first). periods = statementPeriods(vk, cardId), the card's own statement rows.
// [{ months: [month...], expected, period, paidHi, paidLo, status: ok|short|over|due|first|gap, diff, txs }]
export function monthlyRows(cardId, periods) {
  const rule = monthlyRule(cardId); if (!rule) return [];
  const months = monthSpend(cardId); if (!months.length) return [];
  const vk = periods[0]?.vk;
  const credits = vk ? expectedCredits(vk, familyIds(cardId)) : [];
  const asc = [...periods].sort((a, b) => a.recDate - b.recDate);
  const groups = new Map();                                          // landing statement id → row
  const out = [];
  for (const m of months) {
    // Paid by the end of the next calendar month: on the first statement dated after the month ends.
    const p = asc.find(x => x.recDate > monthEnd(m.key) && x.recDate <= monthEnd(m.key) + 62 * DAY);
    if (!p) {
      // Not paid yet, or no statement imported for it: only worth a row while the month could still be paid.
      const lastDate = asc.length ? asc[asc.length - 1].recDate : 0;
      if (monthEnd(m.key) >= lastDate) out.push({ months: [m], expected: m.expected, period: null, status: "due", diff: 0, txs: m.txs.slice() });
      continue;
    }
    if (!groups.has(p.recId)) groups.set(p.recId, { months: [], expected: 0, period: p, txs: [] });
    const g = groups.get(p.recId); g.months.push(m); g.expected += m.expected; g.txs.push(...m.txs);
  }
  for (const g of groups.values()) {
    const p = g.period, b = baseOn(p, credits), bank = Number(p.bank) || 0;
    g.base = b.sure; g.baseMaybe = b.maybe;
    g.paidHi = bank - b.sure; g.paidLo = g.paidHi - b.maybe;
    const tol = 5;
    if (p.gap) { g.status = "gap"; g.diff = 0; }
    else if (g.expected > g.paidHi + tol) { g.status = "short"; g.diff = g.paidHi - g.expected; }
    else if (g.expected < g.paidLo - tol) { g.status = p.status === "baseline" ? "first" : "over"; g.diff = g.paidLo - g.expected; }
    else { g.status = "ok"; g.diff = 0; }
    out.push(g);
  }
  return out.sort((a, b) => b.months[0].key - a.months[0].key);
}

// The row a statement view is about (the bonus this statement pays), or null.
export const rowForStatement = (cardId, periods, recId) => monthlyRows(cardId, periods).find(r => r.period && r.period.recId === recId) || null;
