// PDF statements: pdf.js (loaded on demand from a CDN, the file itself never leaves the device) turns each page into text
// lines, then pdfTextToRows() recognises "DDMON DDMON DESCRIPTION 1,234.56[CR]" lines (Maybank) and similar layouts and returns
// table rows in the same shape the CSV import uses. Only text-based PDFs work; a scanned image has no text to read.

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

export async function readPdfLines(file, askPassword) {
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
  const rows = pdfTextToRows(lines);
  if (rows.length < 2) throw new Error("No transaction lines found in this PDF. It may be a scanned image, or a layout I don't know yet.");
  return rows;
}

const MON = { JAN: "Jan", FEB: "Feb", MAR: "Mar", APR: "Apr", MAY: "May", JUN: "Jun", JUL: "Jul", AUG: "Aug", SEP: "Sep", SEPT: "Sep", OCT: "Oct", NOV: "Nov", DEC: "Dec" };
const MONTH_NO = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };

// lines: array of text lines. Returns rows: preamble rows for card detection, a header row, then one row per transaction.
export function pdfTextToRows(lines) {
  const text = lines.join("\n");
  // statement date, e.g. "25/10/2026": year for lines that print only "23SEP"
  const sd = /\b(\d{2})\/(\d{2})\/(\d{4})\b/.exec(text);
  const stYear = sd ? +sd[3] : new Date().getFullYear(), stMonth = sd ? +sd[2] : 12;
  const yearFor = (mon) => (MONTH_NO[mon] > stMonth ? stYear - 1 : stYear);        // a December line on a January statement
  const card = /\b\d{4}-\d{4}-\d{4}-(\d{4})\b/.exec(text) || /\b(?:\d{4}\s){3}(\d{4})\b/.exec(text);
  const title = lines.map(l => /([A-Z][A-Z .&'-]{2,40}?)\s+STATEMENT OF ACCOUNT/.exec(l)).find(Boolean);
  const bank = /MAYBANK/i.test(text) ? "Maybank " : /\bDBS\b/.test(text) ? "DBS " : /\bUOB\b|UNITED OVERSEAS/i.test(text) ? "UOB " : /CITIBANK|\bCITI\b/i.test(text) ? "Citi " : /HSBC/i.test(text) ? "HSBC " : /OCBC/i.test(text) ? "OCBC " : "";
  const rows = [];
  if (title || bank) rows.push(["Account Type:", (bank + (title ? title[1].trim() : "")).trim()]);
  if (card) rows.push(["Card Number:", "•••• " + card[1]]);
  rows.push(["Transaction Date", "Posting Date", "Description", "Amount"]);

  const DATE = String.raw`(\d{1,2})\s?([A-Za-z]{3,4})(?:\s?(\d{2,4}))?`;
  const txRe = new RegExp(String.raw`^\s*${DATE}\s+(?:${DATE}\s+)?(.+?)\s{1,}(-?[\d,]+\.\d{2})\s*(CR|DR)?\s*$`, "i");
  let last = null;
  for (const raw of lines) {
    const m = txRe.exec(raw);
    if (m) {
      const mon1 = m[2].toUpperCase(), mon2 = (m[5] || "").toUpperCase();
      if (!MON[mon1]) { last = null; continue; }
      const fmt = (d, mon, y) => `${String(d).padStart(2, "0")} ${MON[mon]} ${y ? (y.length === 2 ? "20" + y : y) : yearFor(mon)}`;
      const post = MON[mon2] ? fmt(m[4], mon2, m[6]) : "";
      let amt = m[8].replace(/,/g, "");
      if (/CR/i.test(m[9] || "")) amt = "-" + amt.replace(/^-/, "");
      const desc = m[7].replace(/\s{2,}/g, " ").trim();
      last = [fmt(m[1], mon1, m[3]), post, desc, amt];
      rows.push(last);
      continue;
    }
    // "JPY260,480.00" under a line: the original foreign amount
    const fx = /^\s*([A-Z]{3})\s?([\d,]+\.\d{2})\s*$/.exec(raw);
    if (fx && last && fx[1] !== "SGD") { last[2] += ` ${fx[1]} ${fx[2]}`; last = null; continue; }
    if (raw.trim()) last = null;
  }
  return rows;
}
