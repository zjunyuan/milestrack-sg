// Points summaries printed on bank statements (v1.59.0). Pure: takes the PDF's text lines (pdf-statement.js itemsToLines) and returns
// what the bank says about the points balance for that statement, or null. Layouts seen on real statements (2026):
//   OCBC    "Your Consolidated Rewards/Rebates for the Period 26 Jul 2026 to 25 Aug 2026", then
//           "87,820  930  -  -  88,750  -  -" (opening, earned, redeemed, adjusted, available, expiring next two months),
//           the currency ("OCBC$") and one "5400-…-2619  930" line per card with its earned points. Earned is base points only:
//           the bonus comes in a later statement.
//   DBS     "DBS POINTS SUMMARY (AS OF THIS STATEMENT)", one row per card: "4119 1100 6216 7736  14,222  2,063  0  16,285  0"
//           (last balance, earned/adjusted, redeemed/expired, balance, expiring at the month end or "No Expiry"), then TOTAL.
//   Maybank "TREATS POINTS REWARDS SUMMARY AS AT 23 SEP 2026", then "293,827  110  0  0  293,937  293,937"
//           (opening, earned, redeemed, adjusted, closing, expiring). Points for spend in the last 2 business days show next month.
//   UOB     "Rewards Summary", "UNI$  -  62,101.00  3,520.00  6,500.00  0.00  59,121.00  0.00  31/12/2026" (previous, earned, used,
//           adjustment, current, expiring, expiry date): one row for every UOB card together. Redemptions are listed above it
//           ("30 SEP 2026 Card Fee Waiver UNI$6500" used, "ADD UNI$ - MEMBERSHIP FEE REV UNI$10000" added) and kept as items. KF UOB rows (miles already with KrisFlyer) are ignored.
//   HSBC    no text layer, read by text recognition (in the app, or by hsbc_pdf_to_csv.py which writes the same lines into its CSV):
//           "REWARDS SUMMARY", "Points Carried Forward 57,180", "Points Earned (+) 56", "Bonus Points (+) 0", "Points Redeemed 0",
//           "Points Expired 0", "Points Adjusted (+) 99", "Total Points Available 57,335". The "(+)" marks are often misread
//           ("+)", "C+)", "#", even "0"), so each figure is the last number on its line. Several readings can be passed together:
//           the figures are only trusted when one combination adds up. Revolution's bonus for the month before shows as "Points Adjusted".
// Only the last four digits of a card number are kept.

const MON = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, SEPT: 8, OCT: 9, NOV: 10, DEC: 11 };
const ts = (d, mon, y) => { const m = MON[String(mon).toUpperCase()]; return m === undefined ? null : new Date(+y < 100 ? 2000 + +y : +y, m, +d, 12).getTime(); };
const numTok = t => /^-?[\d,]+(\.\d+)?$/.test(t) || t === "-";
const num = t => (t === "-" || t == null ? 0 : Number(String(t).replace(/,/g, "")) || 0);
const toks = l => String(l).trim().split(/\s+/).filter(Boolean);
const numericRow = (l, min) => { const t = toks(l); return t.length >= min && t.every(numTok) ? t.map(num) : null; };
const dateIn = (s) => { const m = /(\d{1,2})\s+([A-Za-z]{3,4})\w*\s+(\d{2,4})/.exec(s || ""); return m ? ts(m[1], m[2], m[3]) : null; };

function ocbc(lines) {
  const i = lines.findIndex(l => /Consolidated Rewards\/Rebates for the Period/i.test(l));
  if (i < 0) return null;
  const per = /Period\s+(.+?)\s+to\s+(.+)$/i.exec(lines[i]);
  const from = per ? dateIn(per[1]) : null, asOf = per ? dateIn(per[2]) : null;
  const out = [];
  let cur = null;
  for (let j = i + 1; j < Math.min(lines.length, i + 30); j++) {
    const l = lines[j];
    if (/annual fee|^\s*Please\b/i.test(l)) break;
    const r = numericRow(l, 5);
    if (r) { cur = { opening: r[0], earned: r[1], redeemed: r[2], adjusted: r[3], closing: r[4], expiring: r.slice(5).reduce((a, b) => a + b, 0), currency: "", byCard: [] }; out.push(cur); continue; }
    const c = /^\s*(\d{4})-(\d{4})-(\d{4})-(\d{4})\s+([\d,]+)\s*$/.exec(l);
    if (c && cur) { cur.byCard.push({ last4: c[4], earned: num(c[5]) }); continue; }
    if (cur && !cur.currency && /^\s*(OCBC\$|90°N|VOYAGE|[A-Z$°]{3,12})\s*$/i.test(l)) cur.currency = l.trim();
  }
  return out.map(o => ({ bank: "ocbc", vaultKey: /OCBC\$/i.test(o.currency) ? "ocbc_pts" : "", from, asOf, ...o }));
}

function dbs(lines) {
  const i = lines.findIndex(l => /DBS POINTS SUMMARY/i.test(l));
  if (i < 0) return null;
  const printed = lines.map(l => /STATEMENT PRINTED ON\s+(.+)$/i.exec(l)).find(Boolean);
  let asOf = printed ? dateIn(printed[1]) : null;
  const exp = dateIn(lines.slice(i + 1, i + 3).join(" ").replace(/.*EXPIRED?/i, ""));
  const byCard = [];
  let total = null;
  for (let j = i + 1; j < Math.min(lines.length, i + 25); j++) {
    const l = lines[j];
    const c = /^\s*\d{4}\s\d{4}\s\d{4}\s(\d{4})\s+(.+)$/.exec(l);
    if (c) {
      const noExp = /No Expiry/i.test(c[2]);
      const t = toks(c[2].replace(/No Expiry/i, "")).filter(numTok).map(num);
      if (t.length >= 4) byCard.push({ last4: c[1], opening: t[0], earned: t[1], redeemed: t[2], closing: t[3], expiring: noExp ? 0 : (t[4] || 0), noExpiry: noExp });
      continue;
    }
    const tt = /^\s*TOTAL\s+(.+)$/i.exec(l);
    if (tt) { const t = toks(tt[1]).filter(numTok).map(num); if (t.length >= 4) total = t; break; }
  }
  if (!byCard.length) return null;
  const sum = k => byCard.reduce((s, c) => s + (c[k] || 0), 0);
  return [{ bank: "dbs", vaultKey: "dbs_pts", currency: "DBS Points", asOf, from: null,
    opening: total ? total[0] : sum("opening"), earned: total ? total[1] : sum("earned"), redeemed: total ? total[2] : sum("redeemed"), adjusted: 0,
    closing: total ? total[3] : sum("closing"), expiring: total ? (total[4] || 0) : sum("expiring"), expiryDate: exp, byCard }];
}

function maybank(lines) {
  const i = lines.findIndex(l => /TREATS Points Summary/i.test(l) && !/AS AT/i.test(l));
  const head = lines.find(l => /TREATS POINTS REWARDS SUMMARY AS AT/i.test(l));
  const k = i >= 0 ? i : lines.findIndex(l => /TREATS POINTS REWARDS SUMMARY/i.test(l));
  if (k < 0) return null;
  for (let j = k + 1; j < Math.min(lines.length, k + 8); j++) {
    const r = numericRow(lines[j], 5);
    if (r) return [{ bank: "maybank", vaultKey: "mb_treats", currency: "TREATS Points", asOf: head ? dateIn(head.replace(/.*AS AT/i, "")) : null, from: null,
      opening: r[0], earned: r[1], redeemed: r[2], adjusted: r[3], closing: r[4], expiring: r[5] || 0, byCard: [] }];
  }
  return null;
}

function uob(lines) {
  const i = lines.findIndex(l => /^\s*Rewards Summary\s*$/i.test(l));
  if (i < 0) return null;
  const sd = lines.map(l => /Statement Date\s+(\d{1,2})\s+([A-Za-z]{3})\w*\s+(\d{4})/i.exec(l)).find(Boolean);
  const asOf = sd ? ts(sd[1], sd[2], sd[3]) : null;
  const items = [];
  for (let j = i + 1; j < Math.min(lines.length, i + 30); j++) {
    const l = lines[j];
    const u = /^\s*(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s+(.+?)\s+UNI\$\s?([\d,]+)\s*$/i.exec(l);
    if (u) { const add = /^ADD\b/i.test(u[2].trim()); items.push({ ts: dateIn(u[1]), what: u[2].trim().replace(/^ADD\s+UNI\$\s*-?\s*/i, ""), pts: add ? num(u[3]) : -num(u[3]) }); continue; }
    const r = /^\s*UNI\$\s+(.+)$/.exec(l);
    if (r) {
      const d = /(\d{2})\/(\d{2})\/(\d{4})/.exec(r[1]);
      const t = toks(r[1].replace(/\d{2}\/\d{2}\/\d{4}/, "")).filter(numTok);
      const n = (t[0] === "-" ? t.slice(1) : t).map(num);
      if (n.length < 5) return null;
      return [{ bank: "uob", vaultKey: "uob_uni", currency: "UNI$", asOf, from: null,
        opening: n[0], earned: n[1], redeemed: n[2], adjusted: n[3], closing: n[4], expiring: n[5] || 0,
        expiryDate: d ? new Date(+d[3], +d[2] - 1, +d[1], 12).getTime() : null, items, byCard: [] }];
    }
  }
  return null;
}

const HSBC_FIELDS = [["opening", /Points\s+Carried\s+Forward/i], ["earned", /Points\s+Ea\w*ed/i], ["bonus", /Bonus\s+Points/i],
  ["redeemed", /Points\s+Redeemed/i], ["expired", /Points\s+Expired/i], ["adjusted", /Points\s+Adjusted/i], ["closing", /Total\s+Points\s+Available/i]];
function hsbc(lines) {
  if (!lines.some(l => /Total\s+Points\s+Available|Points\s+Carried\s+Forward/i.test(l))) return null;
  const cand = {};
  for (const [k, re] of HSBC_FIELDS) {
    const vals = [];
    for (const l of lines) {
      const i = l.search(re); if (i < 0) continue;
      const m = /([\d,]*\d)\s*$/.exec(l.slice(i).replace(re, "")); if (m && /^\d{1,3}(,\d{3})*$|^\d+$/.test(m[1])) vals.push(num(m[1]));
    }
    cand[k] = [...new Set(vals)];
  }
  const per = lines.map(l => /From\s+(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s+to\s+(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})/i.exec(l)).find(Boolean);
  const pick = (k) => cand[k].length ? cand[k] : [null];
  let best = null;
  for (const o of pick("opening")) for (const e of pick("earned")) for (const b of pick("bonus")) for (const r of pick("redeemed"))
    for (const x of pick("expired")) for (const a of pick("adjusted")) for (const c of pick("closing")) {
      const f = { opening: o, earned: e, bonus: b ?? 0, redeemed: r ?? 0, expired: x ?? 0, adjusted: a ?? 0, closing: c };
      const moves = (e ?? 0) + f.bonus - f.redeemed - f.expired + f.adjusted;          // one figure missing from every reading: work it out, unverified
      if (o === null && c !== null) f.opening = c - moves;
      if (c === null && o !== null) f.closing = o + moves;
      const ok = o !== null && e !== null && c !== null && o + e + f.bonus - f.redeemed - f.expired + f.adjusted === c;
      if (ok) { best = { ...f, verified: true }; break; }
      if (!best) best = { ...f, verified: false };
    }
  if (!best || best.closing === null || best.opening === null) return null;
  const last4 = (lines.map(l => /\b\d{4}-[\dXx*•]{4}-[\dXx*•]{4}-(\d{4})\b/.exec(l)).find(Boolean) || [])[1] || "";
  return [{ bank: "hsbc", vaultKey: "hsbc_pts", currency: "HSBC Points", from: per ? dateIn(per[1]) : null, asOf: per ? dateIn(per[2]) : null,
    opening: best.opening, earned: (best.earned ?? 0) + best.bonus, redeemed: best.redeemed + best.expired, adjusted: best.adjusted, closing: best.closing,
    expiring: 0, bonus: best.bonus, expired: best.expired, verified: best.verified, byCard: last4 ? [{ last4, earned: (best.earned ?? 0) + best.bonus }] : [] }];
}

// Returns [{ bank, vaultKey, currency, asOf, from, opening, earned, redeemed, adjusted, closing, expiring, expiryDate?, byCard[], items? }].
export function readPointsSummary(lines) {
  if (!Array.isArray(lines) || !lines.length) return [];
  for (const f of [ocbc, dbs, uob, maybank, hsbc]) {
    try { const r = f(lines); if (r && r.length) return r.filter(x => x.asOf); }
    catch (e) { console.warn("Points summary not read", e); }
  }
  return [];
}

// The balances should chain: this statement's opening = the last closing (else a statement is missing or the bank adjusted something).
// Rows of a CSV (the HSBC script puts the statement period and rewards summary above the header row) as text lines.
export const rowsToLines = rows => (rows || []).map(r => (Array.isArray(r) ? r : [r]).filter(x => x !== "" && x != null).join("  "));
export const balanceAddsUp = s => Math.abs(s.opening + s.earned - s.redeemed + s.adjusted - s.closing) <= 1;
