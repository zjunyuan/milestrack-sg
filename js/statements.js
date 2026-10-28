// Statement import: CSV parsing, column detection and matching against the logged transactions.
// Pure functions (no DOM, no Firebase) so they can be tested on their own. The review screen lives in statement-import.js.

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };
const DAY_MS = 86400000;

// ---------- CSV ----------
export function parseCsv(text) {
  let s = String(text || "").replace(/^﻿/, "");
  const firstLines = s.split(/\r?\n/).slice(0, 15).join("\n");
  const counts = { ",": 0, ";": 0, "\t": 0 };
  for (const ch of firstLines.replace(/"[^"]*"/g, "")) if (ch in counts) counts[ch]++;
  const delim = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  const rows = [];
  let row = [], cell = "", inQ = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQ) {
      if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else inQ = false; }
      else cell += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === delim) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some(c => c.trim() !== "")) rows.push(row.map(c => c.trim()));
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some(c => c.trim() !== "")) rows.push(row.map(c => c.trim()));
  return rows;
}

// ---------- dates and amounts ----------
// order: "dmy" (Singapore default) or "mdy". Returns a timestamp at 12:00 local (like the app's own entries) or null.
export function parseDateStr(str, order = "dmy", now = new Date()) {
  const t = String(str || "").trim();
  if (!t) return null;
  let d, m, y;
  let r;
  if ((r = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(t))) { y = +r[1]; m = +r[2] - 1; d = +r[3]; }
  else if ((r = /^(\d{1,2})[\s\-/.]([A-Za-z]{3,4})[a-z]*[\s\-/.,]*(\d{2,4})?/.exec(t)) && MONTHS[r[2].toLowerCase()] !== undefined) {
    d = +r[1]; m = MONTHS[r[2].toLowerCase()]; y = r[3] ? +r[3] : null;
  } else if ((r = /^(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2,4}))?/.exec(t))) {
    const a = +r[1], b = +r[2];
    if (order === "mdy") { m = a - 1; d = b; } else { d = a; m = b - 1; }
    y = r[3] ? +r[3] : null;
  } else return null;
  if (y === null) {            // no year on the statement line: use the latest date that is not in the future
    y = now.getFullYear();
    if (new Date(y, m, d, 12) > new Date(now.getTime() + 7 * DAY_MS)) y -= 1;
  } else if (y < 100) y += 2000;
  const dt = new Date(y, m, d, 12, 0, 0);
  if (dt.getMonth() !== m || dt.getDate() !== d) return null;   // 31 Feb and the like
  return dt.getTime();
}

// Spend is positive, a credit/refund/payment is negative. Returns null when there is no number.
export function parseAmountStr(str) {
  let t = String(str ?? "").trim();
  if (!t) return null;
  let neg = false;
  if (/^\(.*\)$/.test(t)) { neg = true; t = t.slice(1, -1); }
  if (/\bCR\b\s*$/i.test(t)) { neg = !neg; t = t.replace(/\s*CR\s*$/i, ""); }
  t = t.replace(/\s*DR\s*$/i, "");
  if (/^-/.test(t)) { neg = !neg; t = t.slice(1); }
  t = t.replace(/(S\$|SGD|\$|USD)/gi, "").replace(/[,\s]/g, "");
  if (!/^\d*\.?\d+$/.test(t)) return null;
  const n = parseFloat(t);
  return neg ? -n : n;
}

// ---------- layout detection ----------
const isDateHdr = h => /date/i.test(h);
const isDescHdr = h => /desc|particular|detail|merchant|narrat|payee|transaction$|^transaction\s*(info|name)/i.test(h);
const isAmtHdr = h => /amount|amt|spend|charge|sgd|s\$|local/i.test(h);

// Looks for a header row in the first 40 rows and guesses columns. Returns { headerRow, cols } or null.
export function detectLayout(rows) {
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const hdr = rows[i];
    const hasDate = hdr.some(isDateHdr);
    const hasAmt = hdr.some(h => isAmtHdr(h) || /debit|credit|withdraw|deposit/i.test(h));
    if (!(hasDate && hasAmt)) continue;
    const idx = (test, prefer = []) => {
      const all = hdr.map((h, k) => [h, k]).filter(([h]) => test(h));
      for (const p of prefer) { const hit = all.find(([h]) => p.test(h)); if (hit) return hit[1]; }
      return all.length ? all[0][1] : -1;
    };
    const date = idx(isDateHdr, [/trans/i, /^date$/i]);                        // transaction date beats posting date
    const desc = idx(isDescHdr, [/desc/i, /merchant/i]);
    const debit = idx(h => /debit|withdraw/i.test(h));
    const credit = idx(h => /credit|deposit/i.test(h) && !/card/i.test(h));
    const amount = idx(h => isAmtHdr(h) && !/foreign|fcy|original/i.test(h), [/local|sgd|s\$/i, /^amount$/i]);
    return { headerRow: i, cols: { date, desc, amount: debit >= 0 && amount < 0 ? -1 : amount, debit, credit } };
  }
  return null;
}

// Guess columns from the content when there is no usable header row.
export function guessLayoutByContent(rows) {
  const sample = rows.slice(0, 30);
  const width = Math.max(0, ...sample.map(r => r.length));
  let date = -1, amount = -1, desc = -1, best = { d: 0, a: 0, t: 0 };
  for (let c = 0; c < width; c++) {
    const vals = sample.map(r => r[c]).filter(v => v !== undefined && v !== "");
    if (!vals.length) continue;
    const dScore = vals.filter(v => parseDateStr(v) !== null).length / vals.length;
    const aScore = vals.filter(v => parseAmountStr(v) !== null && !/^\d{1,2}[-/]/.test(v)).length / vals.length;
    const tScore = vals.filter(v => /[A-Za-z]{3}/.test(v) && parseDateStr(v) === null).length / vals.length;
    if (dScore > best.d && dScore > 0.6) { best.d = dScore; date = c; }
    if (aScore >= best.a && aScore > 0.6 && c !== date) { best.a = aScore; amount = c; }
    if (tScore > best.t && tScore > 0.6) { best.t = tScore; desc = c; }
  }
  return { headerRow: -1, cols: { date, desc, amount, debit: -1, credit: -1 } };
}

// Turns the rows below the header into statement lines. cols are column indexes (-1 = not used).
export function buildLines(rows, headerRow, cols, { order = "dmy", now = new Date() } = {}) {
  const lines = [];
  for (let i = headerRow + 1; i < rows.length; i++) {
    const r = rows[i];
    const ts = cols.date >= 0 ? parseDateStr(r[cols.date], order, now) : null;
    if (ts === null) continue;                                   // totals, balance rows, notes
    let amt = null;
    if (cols.debit >= 0 || cols.credit >= 0) {
      const dr = cols.debit >= 0 ? parseAmountStr(r[cols.debit]) : null;
      const cr = cols.credit >= 0 ? parseAmountStr(r[cols.credit]) : null;
      if (dr !== null || cr !== null) amt = (dr || 0) - (cr || 0);
    } else if (cols.amount >= 0) amt = parseAmountStr(r[cols.amount]);
    if (amt === null || amt === 0) continue;
    const desc = (cols.desc >= 0 ? r[cols.desc] : "").replace(/\s+/g, " ").trim() || "Statement line";
    lines.push({ ts, desc, amt: Math.round(amt * 100) / 100, row: i });
  }
  return lines;
}

// ---------- matching ----------
const NOISE = new Set(["sgd", "singapore", "sg", "pte", "ltd", "the", "and", "pos", "purchase", "card", "txn", "payment", "visa", "mastercard", "local", "debit"]);
export function descTokens(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/)
    .filter(t => t && !NOISE.has(t) && !/^\d{5,}$/.test(t) && t.length > 1);
}
// 0..1. Token overlap, with credit when one description is contained in the other ("GRAB* A-123" vs "Grab").
export function descSimilarity(a, b) {
  const A = descTokens(a), B = descTokens(b);
  if (!A.length || !B.length) return 0;
  const sa = new Set(A), sb = new Set(B);
  const inter = [...sa].filter(t => sb.has(t)).length;
  const jaccard = inter / (sa.size + sb.size - inter);
  const contain = inter / Math.min(sa.size, sb.size);
  // prefix match on a token ("starbucks" vs "starbuck")
  const pref = [...sa].some(x => [...sb].some(y => x.length >= 4 && y.length >= 4 && (x.startsWith(y) || y.startsWith(x)))) ? 0.5 : 0;
  return Math.max(jaccard, contain * 0.9, pref);
}

export function dayKey(ts) { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function hash(str) { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
// Stable fingerprint of a statement line, so importing the same file twice recognises its own lines.
export function lineKey(cardId, line, occurrence = 1) {
  return hash([cardId, dayKey(line.ts), line.amt.toFixed(2), descTokens(line.desc).join(" "), occurrence].join("|"));
}

// lines: from buildLines. existing: the logged transactions of the SAME card. Statuses:
//   matched  same amount and a date within `windowDays` (or the same stmtKey from an earlier import): nothing to do
//   differs  looks like the same purchase but the amount (or date) disagrees: the user decides
//   new      not in the list yet
//   credit   a refund or payment (negative): skipped by default, the app only tracks spend
// Returns { results, missing } where missing = logged transactions in the statement's date range that the statement does not show.
export function matchLines(lines, existing, { cardId = "", windowDays = 3, looseDays = 5 } = {}) {
  const used = new Set();
  const results = lines.map((line, i) => ({ line, idx: i, status: line.amt < 0 ? "credit" : "new", existing: null, reason: "", key: "", repeat: 1 }));

  // fingerprints with an occurrence counter, so two identical coffees on one day stay two lines
  const seen = {};
  for (const r of results) {
    const base = lineKey(cardId, r.line, 0);
    seen[base] = (seen[base] || 0) + 1;
    r.repeat = seen[base];
    r.key = lineKey(cardId, r.line, r.repeat);
  }
  for (const r of results) { const base = lineKey(cardId, r.line, 0); r.repeatTotal = seen[base]; }

  const spend = results.filter(r => r.status !== "credit");
  const pool = existing.map((tx, k) => ({ tx, k }));
  const days = (a, b) => Math.abs(Math.round((a - b) / DAY_MS));

  // 0. same fingerprint as an earlier import
  for (const r of spend) {
    const hit = pool.find(p => !used.has(p.k) && p.tx.stmtKey === r.key);
    if (hit) { used.add(hit.k); r.status = "matched"; r.existing = hit.tx; r.reason = "Imported earlier"; r.settled = true; }
  }
  // 1. same amount, close date: best description and nearest day first
  const exact = [];
  for (const r of spend) {
    if (r.settled) continue;
    for (const p of pool) {
      if (used.has(p.k)) continue;
      if (Math.abs((Number(p.tx.amt) || 0) - r.line.amt) >= 0.005) continue;
      const dd = days(p.tx.timestamp || 0, r.line.ts);
      if (dd > windowDays) continue;
      exact.push({ r, p, score: descSimilarity(r.line.desc, p.tx.desc) * 2 - dd * 0.1 });
    }
  }
  exact.sort((a, b) => b.score - a.score);
  for (const c of exact) {
    if (c.r.settled || used.has(c.p.k)) continue;
    used.add(c.p.k); c.r.settled = true; c.r.status = "matched"; c.r.existing = c.p.tx;
    c.r.reason = "Same amount and date";
  }
  // 2. looks like the same purchase, amount or date off
  const loose = [];
  for (const r of spend) {
    if (r.settled) continue;
    for (const p of pool) {
      if (used.has(p.k)) continue;
      const amtTx = Number(p.tx.amt) || 0;
      const dd = days(p.tx.timestamp || 0, r.line.ts);
      const sim = descSimilarity(r.line.desc, p.tx.desc);
      const rel = Math.abs(amtTx - r.line.amt) / Math.max(amtTx, r.line.amt, 1);
      const sameAmt = Math.abs(amtTx - r.line.amt) < 0.005;
      const ok = (dd <= looseDays && (sim >= 0.34 || rel <= 0.1)) || (sameAmt && dd <= 10 && sim >= 0.34);
      if (!ok) continue;
      loose.push({ r, p, score: sim * 2 + (1 - rel) - dd * 0.05 });
    }
  }
  loose.sort((a, b) => b.score - a.score);
  for (const c of loose) {
    if (c.r.settled || used.has(c.p.k)) continue;
    used.add(c.p.k); c.r.settled = true; c.r.existing = c.p.tx;
    const amtTx = Number(c.p.tx.amt) || 0;
    const sameAmt = Math.abs(amtTx - c.r.line.amt) < 0.005;
    if (sameAmt) { c.r.status = "matched"; c.r.reason = `Same amount, date differs by ${days(c.p.tx.timestamp || 0, c.r.line.ts)} days`; }
    else {
      c.r.status = "differs";
      c.r.delta = Math.round((c.r.line.amt - amtTx) * 100) / 100;
      c.r.reason = `You logged S$${amtTx.toFixed(2)}, the statement says S$${c.r.line.amt.toFixed(2)}`;
    }
  }

  // logged but not on the statement, within the statement's date range
  let missing = [];
  if (lines.length) {
    const lo = Math.min(...lines.map(l => l.ts)) - DAY_MS * 0.5, hi = Math.max(...lines.map(l => l.ts)) + DAY_MS * 0.5;
    missing = pool.filter(p => !used.has(p.k) && (p.tx.timestamp || 0) >= lo && (p.tx.timestamp || 0) <= hi).map(p => p.tx);
  }
  return { results, missing };
}

export function summarize(results) {
  const n = { matched: 0, differs: 0, new: 0, credit: 0, repeatsInStatement: 0 };
  for (const r of results) { n[r.status]++; if (r.repeatTotal > 1 && r.repeat === 1) n.repeatsInStatement++; }
  return n;
}
