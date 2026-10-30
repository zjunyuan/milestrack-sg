// PDF statements: pdf.js (loaded on demand from a CDN, the file itself never leaves the device) turns each page into text
// lines, then pdfTextToRows() recognises "DDMON DDMON DESCRIPTION 1,234.56[CR]" lines (Maybank) and similar layouts and returns
// table rows in the same shape the CSV import uses. A PDF with no text layer (HSBC draws its letters as shapes, and scans are pictures)
// is read by text recognition (Tesseract.js, loaded on demand and run on this device), and its lines are only accepted when they add up
// to the statement's own balances (verifyBalance), because a misread amount would otherwise overwrite a correct entry.

import { readPointsSummary } from "./points-summary.js";

const PDFJS_VERSION = "6.2.108";
const BASE = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/`;
let lib = null;

async function loadPdfJs() {
  if (lib) return lib;
  const mod = await import(/* @vite-ignore */ BASE + "pdf.min.mjs");
  // A worker from another origin cannot be started directly, so hand pdf.js a same-origin blob copy of it.
  const code = await (await fetch(BASE + "pdf.worker.min.mjs")).text();
  mod.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
  return (lib = mod);
}

// Groups pdf.js text items into visual lines: same baseline (±3 units), left to right.
export function itemsToLines(items) {
  const rows = [];
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const x = it.transform[4], y = it.transform[5];
    let row = rows.find(r => Math.abs(r.y - y) <= 3);
    if (!row) { row = { y, parts: [] }; rows.push(row); }
    row.parts.push({ x, str: it.str, w: it.width || 0 });
  }
  rows.sort((a, b) => b.y - a.y);                                  // PDF y grows upwards
  return rows.map(r => {
    r.parts.sort((a, b) => a.x - b.x);
    let line = "", end = null;
    for (const p of r.parts) {
      if (end !== null && p.x - end > 1.5) line += "  ";            // a visible gap is a column break
      else if (end !== null && !/\s$/.test(line) && !/^\s/.test(p.str)) line += " ";
      line += p.str; end = p.x + p.w;
    }
    return line.replace(/\s+$/, "");
  });
}

async function readAllLines(file, askPassword, progress) {
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data });
  task.onPassword = (update, reason) => {
    const pw = askPassword ? askPassword(reason) : null;
    if (pw === null || pw === undefined || pw === "") { task.destroy(); return; }
    update(pw);
  };
  let pdf;
  try { pdf = await task.promise; }
  catch (e) { if (e && (e.name === "PasswordException" || /password/i.test(e.message || ""))) throw new Error("The PDF is password protected and the password wasn't accepted."); throw e; }
  const lines = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    lines.push(...itemsToLines((await page.getTextContent()).items));
  }
  if (lines.join("").replace(/\s/g, "").length >= 200) return { lines, ocr: false, pdf };
  return { lines: [], ocr: true, pdf };                               // no text layer: the caller reads the pictures of the pages
}

// ---- Text recognition for PDFs without a text layer ----
const TESS_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
function loadTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  return new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = TESS_URL; el.onload = () => resolve(window.Tesseract); el.onerror = () => reject(new Error("Couldn't load the text recognition tool. Check your internet connection and try again."));
    document.head.appendChild(el);
  });
}
async function ocrPdfLines(pdf, progress, psm = "4", attempt = 1) {
  progress && progress("This PDF has no text, so I'm reading it as a picture. Loading the text recognition tool (first time only)…");
  const T = await loadTesseract();
  const n = pdf.numPages;
  const cores = Math.max(1, (navigator.hardwareConcurrency || 2) - 1);
  const size = Math.max(1, Math.min(n, 3, cores, (navigator.deviceMemory || 4) <= 2 ? 1 : 3));   // several pages at once; capped so a phone does not run out of memory
  const workers = await Promise.all(Array.from({ length: size }, async () => {
    const w = await T.createWorker("eng");
    await w.setParameters({ tessedit_pageseg_mode: psm });             // 4 = one column of text, 6 = one block, 11 = sparse; each misses different lines
    return w;
  }));
  const pages = new Array(n);
  let next = 0, done = 0;
  const tell = () => progress && progress(`Reading page ${Math.min(done + 1, n)} of ${n} by text recognition${attempt > 1 ? ` (second look, ${attempt} of up to 3)` : ""}${size > 1 ? `, ${size} pages at a time` : ""}, about 10 to 20 seconds a page…`);
  tell();
  try {
    await Promise.all(workers.map(async (worker) => {
      while (next < n) {
        const p = ++next;
        const page = await pdf.getPage(p);
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(5.5, 4200 / Math.max(base.width, base.height));    // about 400 dpi; a lower resolution misreads amounts
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, canvas, viewport }).promise;
        const { data } = await worker.recognize(canvas);
        const fromBoxes = psm === "11" ? linesFromWords(wordsOf(data)) : [];     // sparse reading: use the boxes, the text splits side-by-side words
        pages[p - 1] = fromBoxes.length ? fromBoxes : String(data.text || "").split("\n").map(l => l.replace(/\s+$/, ""));
        canvas.width = canvas.height = 0;
        done++; tell();
      }
    }));
  } finally { await Promise.all(workers.map(w => w.terminate())); }
  return pages.flat();
}

// Rebuilds text lines from word boxes: words whose vertical centres match are one line, left to right. Sparse recognition (psm 11) can put a
// description and its amount on separate lines of text although they sit side by side on the page; the boxes put them back together.
export function linesFromWords(words) {
  const ws = words.filter(w => String(w.text).trim() && Number.isFinite(w.y0));
  if (!ws.length) return [];
  const hs = ws.map(w => w.y1 - w.y0).sort((a, b) => a - b);
  const tol = Math.max(4, hs[hs.length >> 1] * 0.6);
  ws.sort((a, b) => (a.y0 + a.y1) - (b.y0 + b.y1));
  const rows = [];
  for (const w of ws) {
    const yc = (w.y0 + w.y1) / 2, r = rows[rows.length - 1];
    if (r && Math.abs(yc - r.yc) <= tol) { r.w.push(w); r.yc = (r.yc * (r.w.length - 1) + yc) / r.w.length; }
    else rows.push({ yc, w: [w] });
  }
  return rows.map(r => r.w.sort((a, b) => a.x0 - b.x0).map(w => String(w.text).trim()).join(" "));
}
function wordsOf(data) {
  if (typeof data.tsv === "string" && data.tsv) {
    return data.tsv.split("\n").slice(1).map(l => l.split("\t")).filter(c => c[0] === "5" && c.length >= 12)
      .map(c => ({ x0: +c[6], y0: +c[7], x1: +c[6] + +c[8], y1: +c[7] + +c[9], text: c.slice(11).join("\t") }));
  }
  if (Array.isArray(data.words)) return data.words.map(w => ({ x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1, text: w.text }));
  return [];
}

const NO_LINES = "No transaction lines found in this PDF. It may be a scanned image, or a layout I don't know yet.";

export async function readPdfLines(file, askPassword) {
  const r = await readAllLines(file, askPassword);
  if (r.ocr) throw new Error(NO_LINES);
  const rows = pdfTextToRows(r.lines);
  if (rows.length < 2) throw new Error(NO_LINES);
  return rows;
}

// One PDF can hold several cards (UOB prints one section per card). Returns [{ name, last4, rows }]: one entry per card section,
// or a single entry with no name when the PDF has one card only. Only the last four digits of a card number are ever kept.
// Each part also carries `points`: the statement's points summary (points-summary.js), the same list on every part of one file.
export async function readPdfParts(file, askPassword, progress) {
  const { lines, ocr, pdf } = await readAllLines(file, askPassword, progress);
  if (ocr) { const p = await readByOcr(pdf, progress); return [{ ...p, points: readPointsSummary(p.lines || []) }]; }
  const points = readPointsSummary(lines);
  const sections = splitCardSections(lines);
  if (sections) return sections.map(s => ({ ...s, points }));
  const rows = pdfTextToRows(lines);
  if (rows.length < 2) throw new Error(NO_LINES);
  return [{ name: "", last4: "", rows, verify: null, points }];
}

// Text recognition drops or garbles a line now and then, and different settings miss different lines. So: read with one setting, check the
// lines add up to the statement's balances, and if not read again with another and combine what the readings found (up to three).
async function readByOcr(pdf, progress) {
  const passes = [];
  let out = null;
  for (const psm of ["4", "6", "11"]) {
    passes.push(await ocrPdfLines(pdf, progress, psm, passes.length + 1));
    for (const repair of [false, true]) {                              // second try: an amount whose decimal point was lost ("6296" for 62.96)
      const c = combineOcr(passes, repair);
      const v = verifyBalance(c.lines, c.rows);
      out = { c, v };
      if (v.ok) break;
    }
    if (out.v.ok) break;
  }
  if (out.c.rows.length < 2) throw new Error(NO_LINES);
  if (!out.v.ok) {                                                   // last try: the statement's own summary figures (majority of the readings)
    const fig = summaryVote(passes);
    const fixed = repairWithSummary(out.c.rows, fig);
    const v = verifyBalance(out.c.lines, fixed, fig);
    if (v.ok) return { name: "", last4: "", rows: fixed, verify: v, lines: passes.flat() };
  }
  return { name: "", last4: "", rows: out.c.rows, verify: out.v, lines: passes.flat() };
}

// "Payments & Credits 35.19CR" and "Purchases & Debits 4.99" as read by most of the readings (one reading may misread a figure).
export function summaryVote(passes) {
  const MONEY = /(-?[\d,]+\.\d{2})/;
  const pick = (re) => {
    const votes = passes.map(lines => { for (const l of lines) { const i = l.search(re); if (i >= 0) { const m = MONEY.exec(l.slice(i).replace(re, "")); if (m) return Math.abs(parseFloat(m[1].replace(/,/g, ""))); } } return null; }).filter(v => v !== null);
    if (!votes.length) return null;
    const top = [...new Set(votes)].sort((a, b) => votes.filter(x => x === b).length - votes.filter(x => x === a).length)[0];
    return votes.filter(x => x === top).length > votes.length / 2 || votes.length === 1 ? top : null;
  };
  return { credits: pick(/Payments\s*&\s*Credits/i), debits: pick(/Purchases\s*&\s*Debits/i) };
}
// Identical lines are easy to lose (nine refunds of 0.91 in a row) and a lost "CR" turns a credit into a debit. When the statement's own totals are
// off by an amount that exactly one explanation covers, apply it; anything ambiguous is left alone and the usual error shows.
export function repairWithSummary(rows, fig) {
  if (fig.credits == null || fig.debits == null) return rows;
  const out = rows.slice(), eps = 0.015, isTx = (r) => /^\d{2} \w{3} \d{4}$/.test(String(r[0])), amt = (r) => parseFloat(r[3]) || 0;
  const pos = out.map((r, i) => (isTx(r) && amt(r) > 0 ? i : -1)).filter(i => i >= 0);
  const excess = Math.round((pos.reduce((a, i) => a + amt(out[i]), 0) - fig.debits) * 100) / 100;
  if (excess > eps) {
    const sols = [];
    for (let a = 0; a < pos.length; a++) {
      if (Math.abs(amt(out[pos[a]]) - excess) < eps) sols.push([pos[a]]);
    }
    if (!sols.length) for (let a = 0; a < pos.length; a++) for (let b = a + 1; b < pos.length; b++) if (Math.abs(amt(out[pos[a]]) + amt(out[pos[b]]) - excess) < eps) sols.push([pos[a], pos[b]]);
    if (sols.length === 1) sols[0].sort((x, y) => y - x).forEach(i => out.splice(i, 1));
  }
  const credSum = out.filter(r => isTx(r) && amt(r) < 0).reduce((a, r) => a + amt(r), 0);
  const gap = Math.round((fig.credits + credSum) * 100) / 100;
  if (gap > eps) {
    const by = new Map();
    out.filter(r => isTx(r) && amt(r) < 0).forEach(r => { const k = (-amt(r)).toFixed(2); by.set(k, [...(by.get(k) || []), r]); });
    const fits = [];
    for (const [a, list] of by) for (const k of [1, 2, 3]) if (Math.abs(parseFloat(a) * k - gap) < eps && list.length >= 2) fits.push([a, k, list[0]]);
    if (fits.length === 1) for (let n = 0; n < fits[0][1]; n++) out.push(fits[0][2].slice());
  }
  return out;
}
const isTxRow = (r) => /^\d{2} \w{3} \d{4}$/.test(String(r[0]));
export function combineOcr(passes, repair) {
  const parsed = passes.map(lines => ({ lines, rows: pdfTextToRows(lines, { lenient: true, repair }) }));
  const head = (parsed.find(p => p.rows.some(r => r[0] === "Card Number:")) || parsed[0]).rows.filter(r => !isTxRow(r));
  const best = new Map();                                              // key -> longest run of identical lines seen in any one reading
  for (const p of parsed) {
    const seen = new Map();
    for (const r of p.rows.filter(isTxRow)) {
      const k = `${r[0]}|${r[1]}|${r[3]}`; const n = (seen.get(k) || 0) + 1; seen.set(k, n);
      const b = best.get(k) || [];
      if (n > b.length) { b.push(r); best.set(k, b); }
      else if (b[n - 1] && String(r[2]).length > String(b[n - 1][2]).length && !/\d{5,}/.test(String(r[2]))) b[n - 1] = r;   // keep the cleaner description
    }
  }
  const tx = [...best.values()].flat().sort((a, b) => Date.parse(a[0]) - Date.parse(b[0]) || Date.parse(a[1]) - Date.parse(b[1]));
  return { lines: parsed.flatMap(p => p.lines), rows: [...head, ...tx] };
}

// Read by text recognition, the lines must add up: previous balance + the lines (credits count negative) = the statement's total.
// Returns { ok, ... }; ok is false when a figure is missing or the totals differ, and the caller refuses the import.
export function verifyBalance(lines, rows, fig = {}) {
  const MONEY = /(-?[\d,]+\.\d{2})\s*(CR|DR)?\b/i;
  const val = (m) => parseFloat(m[1].replace(/,/g, "")) * (/CR/i.test(m[2] || "") ? -1 : 1);
  const firstAfter = (re) => { for (const l of lines) { const i = l.search(re); if (i >= 0) { const m = MONEY.exec(l.slice(i).replace(re, "")); if (m) return val(m); } } return null; };
  const lastAfter = (re) => { for (let k = lines.length - 1; k >= 0; k--) { const i = lines[k].search(re); if (i >= 0) { const m = MONEY.exec(lines[k].slice(i).replace(re, "")); if (m) return val(m); } } return null; };
  const prev = firstAfter(/Previous\s+(Statement\s+)?Balance/i);
  const total = lastAfter(/TOTAL\s+DUE|TOTAL\s+BALANCE|SUB\s*TOTAL/i);
  const sum = rows.filter(r => /^\d{2} \w{3} \d{4}$/.test(r[0])).reduce((a, r) => a + (parseFloat(r[3]) || 0), 0);
  // The statement's own summary ("Payments & Credits 35.19CR", "Purchases & Debits 4.99") is the sturdier check: it also holds when the account
  // ends in credit (then "Total Due" reads 0.00 and the real balance is printed as a credit elsewhere).
  const credits = fig.credits ?? firstAfter(/Payments\s*&\s*Credits/i), debits = fig.debits ?? firstAfter(/Purchases\s*&\s*Debits/i);
  const txs = rows.filter(r => /^\d{2} \w{3} \d{4}$/.test(r[0])).map(r => parseFloat(r[3]) || 0);
  const sumDeb = txs.filter(a => a > 0).reduce((a, b) => a + b, 0), sumCred = -txs.filter(a => a < 0).reduce((a, b) => a + b, 0);
  const summaryOk = credits !== null && debits !== null && Math.abs(sumDeb - debits) < 0.015 && Math.abs(sumCred - Math.abs(credits)) < 0.015;
  if (prev === null || total === null) return summaryOk ? { ok: true, prev, total, sum: Math.round(sum * 100) / 100, diff: 0 } : { ok: false, missing: true, sum };
  const diff = Math.round((prev + sum - total) * 100) / 100;
  return { ok: summaryOk || Math.abs(diff) < 0.015, prev, total, sum: Math.round(sum * 100) / 100, diff };
}

// A text PDF reads exactly, so a card section that does not add up (previous balance + lines = the section total) means a layout I misread.
function verifySection(sectionLines, rows, total) {
  let prev = null;
  for (const l of sectionLines) { const i = l.search(/PREVIOUS\s+BALANCE/i); if (i >= 0) { const m = MONEY_CR.exec(l.slice(i).replace(/PREVIOUS\s+BALANCE/i, "")); if (m) { prev = signed(m); break; } } }
  const sum = rows.filter(r => /^\d{2} \w{3} \d{4}$/.test(r[0])).reduce((a, r) => a + (parseFloat(r[3]) || 0), 0);
  if (prev === null) return { ok: false, missing: true, text: true, sum };
  const diff = Math.round((prev + sum - total) * 100) / 100;
  return { ok: Math.abs(diff) < 0.015, text: true, prev, total, sum: Math.round(sum * 100) / 100, diff };
}
const CARD_LINE = /^\s*[\dXx•*]{4}[- ][\dXx•*]{4}[- ][\dXx•*]{4}[- ](\d{4})\s+[A-Z]/;
// Splits statement text into per-card sections: a header line, then "XXXX-XXXX-XXXX-1234 NAME", then the lines, ending at "TOTAL BALANCE FOR".
// A section continued on a later page ("... (continued)") is joined to the first one. Returns null unless two or more cards are found.
// DBS consolidated statements: "DBS YUU VISA CARD NO.: 4119 1100 0419 0200", the lines, then "TOTAL: 823.31" (a late charge can follow SUB-TOTAL).
// Only the last four digits of the number are ever kept.
const DBS_CARD = /^\s*(DBS\s+[A-Z][A-Z' &.-]*?)\s+CARD\s+NO\.?:?\s*(?:\d{4}\s?){3}(\d{4})\b/i;
const MONEY_CR = /(-?[\d,]+\.\d{2})\s*(CR|DR)?\b/i;
const signed = (m) => parseFloat(m[1].replace(/,/g, "")) * (/CR/i.test(m[2] || "") ? -1 : 1);
export function splitCardSections(lines) {
  const order = [], by = {}, names = {}, totals = {};
  let cur = null, curKey = null;
  for (let i = 0; i < lines.length; i++) {
    const d = DBS_CARD.exec(lines[i]);
    if (d) {
      const last4 = d[2];
      names[last4] = d[1].replace(/\s+/g, " ").trim();
      if (!by[last4]) { by[last4] = []; order.push(last4); }
      cur = by[last4]; curKey = last4;
      continue;
    }
    if (cur && /^\s*TOTAL:/i.test(lines[i])) { const m = MONEY_CR.exec(lines[i]); if (m) totals[curKey] = signed(m); cur = null; continue; }
    if (/^\s*GRAND TOTAL\b/i.test(lines[i])) { cur = null; continue; }
    const m = CARD_LINE.exec(lines[i]);
    if (m) {
      const last4 = m[1];
      if (!/\(continued\)/i.test(lines[i])) {
        let j = i - 1; while (j >= 0 && !lines[j].trim()) j--;
        const head = j >= 0 ? lines[j].trim() : "";
        if (/^[A-Z][A-Z0-9 '&.\-]{2,60}$/.test(head)) names[last4] = head;
      }
      if (!by[last4]) { by[last4] = []; order.push(last4); }
      cur = by[last4];
      continue;
    }
    if (/^\s*TOTAL BALANCE FOR\b/i.test(lines[i])) { cur = null; continue; }
    if (cur) cur.push(lines[i]);
  }
  if (order.length < 2) return null;
  const full = lines.join("\n");
  const out = [];
  for (const last4 of order) {
    const rows = pdfTextToRows(by[last4], { dateText: full, name: names[last4] || "", last4 });
    if (rows.some(r => /^\d{2} \w{3} \d{4}$/.test(String(r[0])))) {      // a card with no lines this month (only a balance) is left out
      const part = { name: names[last4] || "", last4, rows };
      if (last4 in totals) part.verify = verifySection(by[last4], rows, totals[last4]);   // DBS prints each card's own total
      out.push(part);
    }
  }
  return out.length ? out : null;
}

const MON = { JAN: "Jan", FEB: "Feb", MAR: "Mar", APR: "Apr", MAY: "May", JUN: "Jun", JUL: "Jul", AUG: "Aug", SEP: "Sep", SEPT: "Sep", OCT: "Oct", NOV: "Nov", DEC: "Dec" };
const MONTH_NO = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };

// lines: array of text lines. Returns rows: preamble rows for card detection, a header row, then one row per transaction.
export function pdfTextToRows(lines, ctx = {}) {
  const text = lines.join("\n");
  const whole = ctx.dateText || text;
  // statement date, e.g. "25/10/2026": year for lines that print only "23SEP"
  const sd = /\b(\d{2})\/(\d{2})\/(\d{4})\b/.exec(whole);
  const sdw = /Statement Date\s+(\d{1,2})\s+([A-Za-z]{3})\w*\s+(\d{4})/i.exec(whole)    // UOB: "Statement Date 23 JAN 2026"
    || /STATEMENT PRINTED ON\s+(\d{1,2})\s+([A-Za-z]{3})\w*\s+(\d{4})/i.exec(whole)      // DBS: "STATEMENT PRINTED ON 30 Jan 2026"
    || /STATEMENT DATE[\s\S]{0,120}?(\d{1,2})\s+([A-Za-z]{3})\w*\s+(\d{4})/.exec(whole);   // DBS: the date sits under the heading
  const per = /(?:Statement\s+period|Statement\s+From)[\s\S]{0,60}?\bto\s+(\d{1,2})\s+([A-Za-z]{3})\w*\s+(\d{4})/i.exec(whole);   // HSBC: "From 02 DEC 2025 to 02 JAN 2026"
  const stYear = per ? +per[3] : sdw ? +sdw[3] : sd ? +sd[3] : new Date().getFullYear(), stMonth = per ? (MONTH_NO[per[2].toUpperCase()] || 12) : sdw ? (MONTH_NO[sdw[2].toUpperCase()] || 12) : sd ? +sd[2] : 12;
  const postFirst = /^\s*Post\s+Tran/im.test(whole);                                       // UOB and HSBC list the Post date before the Trans date
  const yearFor = (mon) => (MONTH_NO[mon] > stMonth ? stYear - 1 : stYear);        // a December line on a January statement
  const card = ctx.last4 ? [null, ctx.last4] : /\b\d{4}-\d{4}-\d{4}-(\d{4})\b/.exec(text) || /\b(?:\d{4}\s){3}(\d{4})\b/.exec(text);
  const title = lines.map(l => /([A-Z][A-Z .&'-]{2,40}?)\s+STATEMENT OF ACCOUNT/.exec(l)).find(Boolean);
  // The bank named most often: a UOB or HSBC statement also mentions "DBS Visa Direct" for the payment it received.
  const BANKS = [["Maybank ", /MAYBANK/gi], ["UOB ", /\bUOB\b|UNITED OVERSEAS/gi], ["DBS ", /\bDBS\b/g], ["Citi ", /CITIBANK|\bCITI\b/gi], ["HSBC ", /HSBC/gi], ["OCBC ", /OCBC/gi]];
  const bank = BANKS.map(([n, re]) => [n, (whole.match(re) || []).length]).sort((a, b) => b[1] - a[1]).filter(x => x[1] > 0)[0]?.[0] || "";
  const rows = [];
  const product = ctx.name ? "" : ((/HSBC\s+(?:VISA|MASTERCARD)(?:\s+[A-Z]{3,})?/.exec(text) || [])[0] || "").replace(/\s+/g, " ");
  if (ctx.name) rows.push(["Account Type:", ctx.name]);
  else if (product) rows.push(["Account Type:", product]);
  else if (title || bank) rows.push(["Account Type:", (bank + (title ? title[1].trim() : "")).trim()]);
  if (card) rows.push(["Card Number:", "•••• " + card[1]]);
  rows.push(["Transaction Date", "Posting Date", "Description", "Amount"]);

  const DATE = String.raw`(\d{1,2})\s?([A-Za-z]{3,4})(?:\s?(\d{2,4}))?`;
  const txRe = new RegExp(String.raw`^\s*${DATE}\s+(?:${DATE}\s+)?(.+?)\s{1,}(-?[\d,]+\.\d{2})\s*(CR|DR)?\s*$`, "i");
  // Text recognition also reads the side panel on the same visual line, so the amount is the first money value after the two dates.
  const lenRe = new RegExp(String.raw`^\s*${DATE}\s+${DATE}\s+(.+?)\s+(-?[\d,]+\.\d{2})(?:\s*(CR|DR)\b)?`, "i");
  const repRe = new RegExp(String.raw`^\s*${DATE}\s+${DATE}\s+(.+?)\s+(\d{3,6})(?:\s*(CR|DR)\b)?(?:\s|$)`, "i");
  let last = null;
  for (const raw of lines) {
    let m = ctx.lenient ? lenRe.exec(raw) : txRe.exec(raw);
    if (!m && ctx.repair) {                                           // "TAOBAO Singapore SG 6296": the decimal point was not read
      const n = repRe.exec(raw);
      if (n) m = [n[0], n[1], n[2], n[3], n[4], n[5], n[6], n[7], (parseInt(n[8], 10) / 100).toFixed(2), n[9]];
    }
    if (m) {
      const mon1 = m[2].toUpperCase(), mon2 = (m[5] || "").toUpperCase();
      if (!MON[mon1]) { last = null; continue; }
      const fmt = (d, mon, y) => `${String(d).padStart(2, "0")} ${MON[mon]} ${y ? (y.length === 2 ? "20" + y : y) : yearFor(mon)}`;
      let post = MON[mon2] ? fmt(m[4], mon2, m[6]) : "";
      let amt = m[8].replace(/,/g, "");
      if (/CR/i.test(m[9] || "")) amt = "-" + amt.replace(/^-/, "");
      const desc = m[7].replace(/\s{2,}/g, " ").trim();
      let tdate = fmt(m[1], mon1, m[3]);
      if (postFirst && post) [tdate, post] = [post, tdate];
      if (!(Math.abs(parseFloat(amt)) > 0)) { last = null; continue; }                    // "0.00" notes such as a points-paid card fee
      last = [tdate, post, desc, amt];
      rows.push(last);
      continue;
    }
    if (/^\s*Ref No\b/i.test(raw)) continue;                         // UOB prints a reference line between a purchase and its foreign amount
    // "JPY260,480.00" under a line: the original foreign amount
    const fx = /^\s*([A-Z]{3})\s?([\d,]+\.\d{2})\s*$/.exec(raw);
    if (fx && last && fx[1] !== "SGD") { last[2] += ` ${fx[1]} ${fx[2]}`; last = null; continue; }
    if (raw.trim()) last = null;
  }
  return rows;
}
