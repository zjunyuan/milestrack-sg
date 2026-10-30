// Expiry of miles that expire per earn date, worked out from the logged entries (the vault balance has no dates).
// Trust Miles: end of the 3rd year after the year they were earned (earned in 2026 -> 31 Dec 2029). Source: MileLion; Trust's own T&Cs do not state it.
// Entries are logged earnings only: miles transferred out or earned before the app tracked them are not known here.
import { countsTs } from "./posting.js";
import { DEFAULT_VAULT } from "./config.js";

export const TRUST_EXPIRY_YEARS = 3;

// Returns the soonest-expiring batch {year, miles, expiry: Date} and all batches, or null when nothing is logged.
export function trustExpiry(txns, cards, now = new Date()) {
  const ids = new Set(cards.filter(c => c.vaultKey === "trust_miles").map(c => c.id));
  const byYear = new Map();
  for (const t of txns) {
    if (!ids.has(t.cardId)) continue;
    const card = cards.find(c => c.id === t.cardId);
    const y = new Date(countsTs(t, card)).getFullYear();
    byYear.set(y, (byYear.get(y) || 0) + (Number(t.miles) || 0));
  }
  const batches = [...byYear.entries()].sort((a, b) => a[0] - b[0])
    .map(([year, miles]) => ({ year, miles, expiry: new Date(year + TRUST_EXPIRY_YEARS, 11, 31) }))
    .filter(b => b.expiry >= new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  return batches.length ? { next: batches[0], batches } : null;
}

// ---- DBS Points, UOB UNI$, yuu points: expiry batches from the logged entries (v1.59.5) ----
// DBS Points: one year after the end of the quarter they were earned (DBS's own expiry page, checked 31 Oct 2026). Exceptions per MileLion
//   (secondary): DBS Vantage points last three years, DBS Altitude points do not expire. Which DBS cards have no expiry is not on DBS's page: check your card.
// UOB UNI$: two years after the end of the quarter earned (MileLion and MoneySmart; UOB's FAQ page does not show the answer).
// yuu points: two years from the date awarded (MoneySmart; check the yuu app's Points Balance section). Expires on the same day, not a quarter end.
// Entries are logged earnings only. Points redeemed, transferred out or expired are not entries, so the part of the logged total that the
// current balance no longer holds is taken off the OLDEST batches first (the usual way points are used). Points the balance holds beyond the
// logged entries (earned before the app) have no date and are reported as "untracked".
const quarterEnd = (d, years) => new Date(d.getFullYear() + years, Math.floor(d.getMonth() / 3) * 3 + 3, 0);
export const POINTS_EXPIRY = {
  dbs_pts: { name: "DBS Points", expiry: (d, card) => card && card.id === "dbs-altitude" ? null : quarterEnd(d, card && card.id === "dbs-vantage" ? 3 : 1), basis: "quarter" },
  uob_uni: { name: "UOB UNI$", expiry: d => quarterEnd(d, 2), basis: "quarter" },
  yuu_pts: { name: "yuu Points", expiry: d => new Date(d.getFullYear() + 2, d.getMonth(), d.getDate()), basis: "day" }
};

// Returns { name, batches: [{expiry, pts}], next, tracked, untracked } or null for a currency without a rule.
export function pointsExpiry(vaultKey, txns, cards, balance, now = new Date()) {
  const rule = POINTS_EXPIRY[vaultKey];
  if (!rule) return null;
  const ratio = (DEFAULT_VAULT[vaultKey] || {}).ratio || 1;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const byDay = new Map();
  for (const t of txns) {
    const card = cards.find(c => c.id === t.cardId);
    if (!card || card.vaultKey !== vaultKey) continue;
    const raw = Number(t.earnedRawPoints);
    const pts = Number.isFinite(raw) && raw !== 0 ? raw : Math.round((Number(t.miles) || 0) / ratio);
    if (!pts) continue;
    const exp = rule.expiry(new Date(countsTs(t, card)), card);
    if (!exp) continue;                                   // this card's points do not expire
    const k = exp.getTime();
    byDay.set(k, (byDay.get(k) || 0) + pts);
  }
  let batches = [...byDay.entries()].sort((a, b) => a[0] - b[0]).map(([k, pts]) => ({ expiry: new Date(k), pts }))
    .filter(b => b.expiry >= today);                      // an expired batch is already out of the balance
  let excess = batches.reduce((s, b) => s + b.pts, 0) - (Number(balance) || 0);
  if (balance != null) for (const b of batches) {          // redeemed / transferred points leave the oldest batches first
    if (excess <= 0) break;
    const cut = Math.min(b.pts, excess); b.pts -= cut; excess -= cut;
  }
  batches = batches.filter(b => b.pts > 0);
  const tracked = batches.reduce((s, b) => s + b.pts, 0);
  const untracked = balance == null ? 0 : Math.max(0, (Number(balance) || 0) - tracked);
  return { name: rule.name, batches, next: batches[0] || null, tracked, untracked };
}
