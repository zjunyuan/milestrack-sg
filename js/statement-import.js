// Statement import (CSV): pick a card, load the file in the browser, confirm the columns, review each line, then save.
// Nothing leaves the device except the transactions the user chooses to import.
import { state } from "./state.js";
import { ALL_MASTER_CARDS } from "./config.js";
import { saveTxToFirestore, updateVaultDoc } from "./firebase.js";
import { calcEarnedMiles } from "./recommender.js";
import { getMccEntry } from "./mcc.js";
import { findRetailerForInput, buildRetailerList, normalizeText, escapeHtml } from "./retailers.js";
import { fmtNum } from "./format.js";
import { parseCsv, detectLayout, guessLayoutByContent, buildLines, matchLines, summarize, dayKey, detectCardHint, suggestCardId, familyOf, FX_SIBLING, parseDateStr } from "./statements.js";
import { readXls } from "./xls.js";

const REMEMBER_KEY = "milestrack_stmt_cards";   // last four digits -> card id, this device only
const loadRemembered = () => { try { return JSON.parse(localStorage.getItem(REMEMBER_KEY) || "{}"); } catch { return {}; } };
const saveRemembered = (m) => { try { localStorage.setItem(REMEMBER_KEY, JSON.stringify(m)); } catch { /* storage unavailable */ } };
const titleCase = t => t.toLowerCase().replace(/(^|[\s\-\/(])([a-z])/g, (m, a, b) => a + b.toUpperCase());
// Name shown in the ledger: the known brand if we recognise it, else the cleaned merchant text.
// Statement text runs words together ("SHENGSIONG", "GOPAY-GOJEK"), which the typeahead matcher misses, so also look for a
// known brand name or alias (5+ letters, spaces removed) inside the merchant text. The longest hit wins.
const compact = t => String(t || "").toLowerCase().replace(/[^a-z0-9]/g, "");
function lookupBrand(merchant) {
  const direct = findRetailerForInput(merchant, state.merchantOverrides);
  if (direct) return direct;
  const m = compact(merchant);
  let best = null, bestLen = 0;
  for (const r of buildRetailerList(state.merchantOverrides)) {
    for (const n of [r.name, ...(r.aliases || [])]) {
      const c = compact(n);
      if (c.length >= 5 && c.length > bestLen && m.includes(c)) { best = r; bestLen = c.length; }
    }
  }
  return best;
}
const friendlyName = line => { const r = lookupBrand(line.merchant); return r ? r.name : titleCase(line.merchant); };

const S = { flip: false, since: "", hint: null, card: null, rows: [], headerRow: -1, cols: {}, order: "dmy", results: [], missing: [], choice: {}, fileName: "" };

const $ = id => document.getElementById(id);
const money = n => "S$" + fmtNum(n, 2);
const dateLabel = ts => new Date(ts).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });

function cycleBucket(card, ts) {
  const d = new Date(ts);
  if (card.cycleType === "uncapped") return String(d.getFullYear());
  if (card.cycleType === "statement") {
    const cut = card.cutoffDay || 15;
    const m = d.getDate() >= cut ? d.getMonth() : d.getMonth() - 1;
    return new Date(d.getFullYear(), m, 1).toISOString().slice(0, 7);
  }
  return dayKey(ts).slice(0, 7);
}

// Miles for an imported line are an estimate: bonus rate when the brand's MCC lists this card and the cycle's cap has room, else base.
function estimateTx(card, line, spentInBucket) {
  let rate = card.baseMpd, bonus = false;
  const retailer = lookupBrand(line.merchant || line.desc);
  const entry = retailer && getMccEntry(retailer.mcc);
  const cand = entry && (entry.candidatesLocal || []).find(c => c.id === card.id);
  const room = card.monthlyCap >= 999999 || spentInBucket + line.amt <= card.monthlyCap;
  if (cand && room) { rate = cand.baseRate; bonus = true; }
  const miles = calcEarnedMiles(card, line.amt, rate);
  const ratio = state.myVault[card.vaultKey]?.ratio || 1;
  return { miles, earnedRawPoints: Math.round(miles / ratio), bonusCategory: bonus ? "bonus" : "base" };
}

function colSelect(id, label, value, allowNone = true) {
  const width = Math.max(0, ...S.rows.slice(0, 40).map(r => r.length));
  const hdr = S.headerRow >= 0 ? S.rows[S.headerRow] : [];
  const opts = [];
  if (allowNone) opts.push(`<option value="-1" ${value < 0 ? "selected" : ""}>(none)</option>`);
  for (let c = 0; c < width; c++) opts.push(`<option value="${c}" ${value === c ? "selected" : ""}>${escapeHtml(hdr[c] || "Column " + (c + 1))}</option>`);
  return `<label class="st-col"><span>${label}</span><select id="${id}" class="form-control">${opts.join("")}</select></label>`;
}

function renderMapping() {
  $("stmtMapping").innerHTML = `
    <div class="st-grid">
      ${colSelect("stColDate", "Date", S.cols.date, false)}
      ${colSelect("stColDesc", "Description", S.cols.desc)}
      ${colSelect("stColAmt", "Amount", S.cols.amount)}
      ${colSelect("stColDebit", "Debit (if separate)", S.cols.debit)}
      ${colSelect("stColCredit", "Credit (if separate)", S.cols.credit)}
      <label class="st-col"><span>Dates are</span><select id="stOrder" class="form-control">
        <option value="dmy" ${S.order === "dmy" ? "selected" : ""}>Day / Month</option><option value="mdy" ${S.order === "mdy" ? "selected" : ""}>Month / Day</option></select></label>
      <label class="st-col"><span>Only lines on or after</span><input type="date" id="stSince" class="form-control" value="${S.since}"></label>
    </div>
    <label class="hm-note" style="display:flex; gap:6px; align-items:center; margin-top:6px;"><input type="checkbox" id="stFlip" ${S.flip ? "checked" : ""}> Spend is shown as negative numbers in this file (flip the signs)</label>`;
  for (const id of ["stColDate", "stColDesc", "stColAmt", "stColDebit", "stColCredit", "stOrder", "stSince", "stFlip"]) $(id).addEventListener("change", () => { readMapping(); recompute(); });
}

function readMapping() {
  const v = id => parseInt($(id).value, 10);
  S.cols = { ...S.cols, date: v("stColDate"), desc: v("stColDesc"), amount: v("stColAmt"), debit: v("stColDebit"), credit: v("stColCredit") };
  S.order = $("stOrder").value;
  S.since = $("stSince").value;
  S.flip = $("stFlip").checked;
}

function keyCardId() { return familyOf(S.card.id)[0]; }   // one key per physical card, whichever entry the lines go to
function recompute() {
  let lines = buildLines(S.rows, S.headerRow, S.cols, { order: S.order, flip: S.flip });
  if (S.since) { const t = parseDateStr(S.since, "ymd"); if (t) lines = lines.filter(l => l.ts >= t - 43200000); }
  const fam = familyOf(S.card.id);
  const existing = state.transactions.filter(t => fam.includes(t.cardId));
  const m = matchLines(lines, existing, { cardId: keyCardId() });
  S.results = m.results; S.missing = m.missing; S.choice = {};
  m.results.forEach((r, i) => { S.choice[i] = r.status === "new" ? (r.line.fee ? "skip" : "add") : r.status === "differs" ? "statement" : "skip"; });
  renderReview();
}
// Foreign-currency lines on a card with a separate FCY entry go to that entry.
function targetCard(line) {
  const sib = FX_SIBLING[S.card.id];
  return line.fx && sib && state.enabledCardIds.includes(sib) ? ALL_MASTER_CARDS.find(c => c.id === sib) : S.card;
}

function rowHtml(r, i) {
  const l = r.line;
  const head = `<div class="st-line-main"><b>${escapeHtml(friendlyName(l))}</b><span class="st-amt">${money(Math.abs(l.amt))}${l.amt < 0 ? " CR" : ""}</span></div>
    <div class="st-sub">${dateLabel(l.ts)}${l.pending ? " · ⏳ pending, the amount may still change" : ""}${l.fx ? ` · 🌏 foreign: ${escapeHtml(l.fx.cur)} ${fmtNum(l.fx.amount, 2)}` : ""} · <span title="${escapeHtml(l.desc)}">${escapeHtml(l.desc.length > 38 ? l.desc.slice(0, 36) + "…" : l.desc)}</span>${r.repeatTotal > 1 ? ` · appears ${r.repeatTotal}× on the statement (each kept as its own purchase)` : ""}</div>`;
  if (r.status === "differs") {
    return `<div class="st-line st-differs">${head}
      <div class="st-sub st-warn">⚠️ ${escapeHtml(r.reason)} ("${escapeHtml(r.existing.desc)}", ${dateLabel(r.existing.timestamp)})</div>
      <select class="form-control st-choice" data-i="${i}">
        <option value="statement">Use the statement amount (${money(l.amt)})</option>
        <option value="keep">Keep my amount (${money(Number(r.existing.amt))})</option>
        <option value="new">Add as a separate purchase</option>
      </select></div>`;
  }
  if (r.status === "new") {
    return `<div class="st-line st-new">${head}
      ${l.fee ? `<div class="st-sub st-warn">Fee or charge, not spend: left out by default (no miles)</div>` : ""}
      ${targetCard(l).id !== S.card.id ? `<div class="st-sub">→ goes to ${escapeHtml(targetCard(l).name)}</div>` : ""}
      <label class="st-sub"><input type="checkbox" class="st-add" data-i="${i}" ${S.choice[i] === "add" ? "checked" : ""}> Add to my list</label></div>`;
  }
  return `<div class="st-line">${head}<div class="st-sub">${r.status === "credit" ? "Refund or payment: not tracked" : "✅ " + escapeHtml(r.reason) + (r.existing ? ` ("${escapeHtml(r.existing.desc)}")` : "")}</div></div>`;
}

function renderReview() {
  const box = $("stmtReview");
  const n = summarize(S.results);
  if (!S.results.length) {
    box.innerHTML = `<p class="hm-note">No transactions found with these columns. Check the Date and Amount columns above, or the date order.</p>`;
    $("btnStmtApply").disabled = true; return;
  }
  const group = (status, title, open = false) => {
    const items = S.results.map((r, i) => r.status === status ? rowHtml(r, i) : "").join("");
    return items ? `<details class="st-group" ${open ? "open" : ""}><summary>${title}</summary>${items}</details>` : "";
  };
  box.innerHTML = `
    <div class="st-summary">
      <span><b>${n.new}</b> new</span><span><b>${n.differs}</b> differ</span><span><b>${n.matched}</b> already logged</span><span><b>${n.credit}</b> credits skipped</span>
    </div>
    ${group("differs", "⚠️ Amount differs: you decide", true)}
    ${group("new", "➕ New: not in your list yet", true)}
    ${group("matched", "✅ Already in your list")}
    ${group("credit", "↩️ Refunds and payments (skipped)")}
    ${S.missing.length ? `<details class="st-group"><summary>🕓 Logged by you, not on this statement (${S.missing.length})</summary>
      ${S.missing.map(t => `<div class="st-line"><div class="st-line-main"><b>${escapeHtml(t.desc)}</b><span class="st-amt">${money(Number(t.amt))}</span></div><div class="st-sub">${dateLabel(t.timestamp)}. Possibly not posted yet, or logged on the wrong card. Left untouched.</div></div>`).join("")}</details>` : ""}`;
  box.querySelectorAll(".st-add").forEach(el => el.addEventListener("change", () => { S.choice[el.dataset.i] = el.checked ? "add" : "skip"; updateApplyLabel(); }));
  box.querySelectorAll(".st-choice").forEach(el => el.addEventListener("change", () => { S.choice[el.dataset.i] = el.value; updateApplyLabel(); }));
  updateApplyLabel();
}

function plan() {
  let add = 0, update = 0;
  S.results.forEach((r, i) => {
    const c = S.choice[i];
    if (r.status === "new" && c === "add") add++;
    if (r.status === "differs") { if (c === "statement") update++; else if (c === "new") add++; }
  });
  return { add, update };
}
function updateApplyLabel() {
  const p = plan();
  const btn = $("btnStmtApply");
  btn.disabled = p.add + p.update === 0;
  btn.textContent = p.add + p.update === 0 ? "Nothing to import" : `Import: add ${p.add}, update ${p.update}`;
}

async function applyImport() {
  const card = S.card, btn = $("btnStmtApply");
  const addVault = $("stAddVault").checked;
  const p = plan();
  if (!confirm(`Add ${p.add} and update ${p.update} transaction${p.add + p.update === 1 ? "" : "s"} on ${card.name}?`)) return;
  btn.disabled = true;
  const bucketSpend = {};
  for (const t of state.transactions) { const tc = ALL_MASTER_CARDS.find(c => c.id === t.cardId); if (!tc) continue; const b = tc.id + cycleBucket(tc, t.timestamp); bucketSpend[b] = (bucketSpend[b] || 0) + (Number(t.amt) || 0); }
  let done = 0, rawDelta = 0, seq = 0;
  const base = Date.now();
  try {
    const order = S.results.map((r, i) => i).sort((a, b) => S.results[a].line.ts - S.results[b].line.ts);
    for (const i of order) {
      const r = S.results[i], c = S.choice[i], l = r.line;
      const makeNew = (r.status === "new" && c === "add") || (r.status === "differs" && c === "new");
      if (makeNew) {
        const tCard = targetCard(l);
        const bucket = tCard.id + cycleBucket(tCard, l.ts);
        const est = l.fee ? { miles: 0, earnedRawPoints: 0, bonusCategory: "base" } : estimateTx(tCard, l, bucketSpend[bucket] || 0);
        bucketSpend[bucket] = (bucketSpend[bucket] || 0) + l.amt;
        const id = String(base + (seq++));
        await saveTxToFirestore(id, {
          id, owner: state.myVaultKey, timestamp: l.ts, desc: friendlyName(l), stmtDesc: l.desc, amt: l.amt, cardId: tCard.id,
          bonusCategory: est.bonusCategory, miles: est.miles, earnedRawPoints: est.earnedRawPoints,
          date: new Date(l.ts).toLocaleDateString("en-SG", { month: "short", day: "numeric" }),
          source: "statement", estimatedMiles: true, stmtKey: r.key, ...(l.pending ? { pending: true } : {}), ...(l.fee ? { fee: true } : {}), ...(l.ref ? { stmtRef: l.ref } : {}), ...(l.fx ? { fx: `${l.fx.cur} ${l.fx.amount}` } : {})
        });
        rawDelta += est.earnedRawPoints; done++;
      } else if (r.status === "differs" && (c === "statement" || c === "keep")) {
        const old = { ...r.existing }; delete old.firestoreId;
        if (c === "keep") { await saveTxToFirestore(old.id, { ...old, stmtKey: r.key, stmtNote: `Statement said S$${l.amt.toFixed(2)}` }); continue; }
        const oc = ALL_MASTER_CARDS.find(c => c.id === old.cardId) || card;
        const rate = old.bonusCategory === "bonus" ? oc.bonusMpd : oc.baseMpd;
        const miles = calcEarnedMiles(oc, l.amt, rate);
        const ratio = state.myVault[oc.vaultKey]?.ratio || 1;
        const raw = Math.round(miles / ratio);
        rawDelta += raw - (Number(old.earnedRawPoints) || 0);
        await saveTxToFirestore(old.id, { ...old, amt: l.amt, amtOriginal: old.amtOriginal ?? old.amt, miles, earnedRawPoints: raw, stmtKey: r.key, reconciled: true, estimatedMiles: true });
        done++;
      }
    }
    if (addVault && rawDelta && state.myVault[card.vaultKey]) {
      state.myVault[card.vaultKey].points = Math.max(0, (Number(state.myVault[card.vaultKey].points) || 0) + rawDelta);
      await updateVaultDoc(state.myVaultKey, state.myVault);
    }
    if (S.hint && S.hint.last4) { const m = loadRemembered(); m[S.hint.last4] = card.id; saveRemembered(m); }
    closeStatementSheet();
    alert(`Imported ${done} transaction${done === 1 ? "" : "s"}.${addVault ? "" : " Your bank points balances were not changed."}`);
  } catch (err) {
    console.error("Statement import failed", err);
    alert(`Import stopped after ${done} of ${p.add + p.update}: ${err?.message || err}. Re-run the same file: lines already imported are recognised and skipped.`);
    btn.disabled = false;
  }
}

// Exports with no card name in them: the bank's default file name gives it away (OCBC "TransactionHistory…", Citi "ACCT_…").
function nameFromFile(fn) {
  if (/^ACCT_\d+/i.test(fn)) return "Citi Rewards";
  if (/^TransactionHistory/i.test(fn)) return "OCBC Rewards";
  return "";
}
function afterRows(rows, fileName = "") {
  S.rows = rows;
  S.hint = detectCardHint(S.rows);
  const fn = nameFromFile(fileName);
  if (fn && (!S.hint || !S.hint.name)) S.hint = { name: fn, last4: S.hint ? S.hint.last4 : "" };
  const guess = suggestCardId(S.hint, state.enabledCardIds, loadRemembered());
  if (guess) { $("stCard").value = guess; S.card = ALL_MASTER_CARDS.find(c => c.id === guess); }
  const fam = familyOf(S.card.id);
  const famNote = fam.length > 1 ? ` This card has separate entries in the app (${fam.map(id => ALL_MASTER_CARDS.find(c => c.id === id)?.name).filter(Boolean).join(" / ")}). Lines go to the one selected above${FX_SIBLING[S.card.id] ? ", foreign-currency lines to the FCY entry" : ""}; duplicates are checked across all of them.` : "";
  $("stCardHint").textContent = (S.hint
    ? (guess ? `Detected "${S.hint.name || "card"}"${S.hint.last4 ? " ending " + S.hint.last4 : ""}, so I picked ${S.card.name}. Change it if that's wrong.` : `The file says "${S.hint.name || "a card"}"${S.hint.last4 ? " ending " + S.hint.last4 : ""}. Please pick the matching card above.`)
    : "") + famNote;
  const found = detectLayout(S.rows) || guessLayoutByContent(S.rows);
  S.headerRow = found.headerRow; S.cols = found.cols; S.order = "dmy"; S.since = ""; S.flip = false;
  const probe = buildLines(S.rows, S.headerRow, S.cols, { order: S.order });
  // Payments, transfers and fees sit on the opposite side of spend, so leave them out when judging which sign means spend.
  const spendish = probe.filter(l => !l.fee && !/visa direct|payment|giro|fund transfer|moneysend|refund|rebate|cashback/i.test(l.desc));
  S.flip = spendish.length >= 1 && spendish.filter(l => l.amt < 0).length > spendish.length * 0.6;   // spend shown as negative numbers
  renderMapping(); recompute();
}

async function onFile(file) {
  if (!file) return;
  S.fileName = file.name;
  $("stmtMapping").innerHTML = ""; $("stmtReview").innerHTML = ""; $("stmtFileNote").style.display = "none";
  try {
    if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") {
      const { readPdfLines } = await import("./pdf-statement.js");
      return afterRows(await readPdfLines(file, () => prompt("This PDF is password protected. Enter the password (it is only used on this device):")));
    }
    if (/\.xlsx$/i.test(file.name)) throw new Error("This is an .xlsx file. Save it as CSV (or .xls) from Excel and try again.");
    if (/\.xls$/i.test(file.name)) return afterRows(readXls(await file.arrayBuffer()));
    afterRows(parseCsv(await file.text()), file.name);
  } catch (err) {
    console.error("Statement read failed", err);
    $("stmtFileNote").style.display = "block";
    $("stmtFileNote").textContent = "Couldn't read that file: " + (err && err.message ? err.message : err);
    $("btnStmtApply").disabled = true;
  }
}

export function openStatementSheet() {
  const sel = $("stCard");
  const cards = ALL_MASTER_CARDS.filter(c => state.enabledCardIds.includes(c.id));
  sel.innerHTML = cards.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
  S.card = cards[0] || null;
  $("stFile").value = ""; $("stCardHint").textContent = ""; $("stmtMapping").innerHTML = ""; $("stmtReview").innerHTML = ""; $("stmtFileNote").style.display = "none";
  $("btnStmtApply").disabled = true; $("btnStmtApply").textContent = "Choose a file";
  $("stmtOverlay")?.classList.add("open");
}
export function closeStatementSheet() { $("stmtOverlay")?.classList.remove("open"); }

export function initStatementImport() {
  for (const id of ["btnOpenStatementImport", "btnOpenStatementImport2"]) {
    $(id)?.addEventListener("click", () => { $("settingsOverlay")?.classList.remove("open"); openStatementSheet(); });
  }
  $("btnCloseStatement")?.addEventListener("click", closeStatementSheet);
  $("stmtOverlay")?.addEventListener("click", e => { if (e.target.id === "stmtOverlay") closeStatementSheet(); });
  $("stCard")?.addEventListener("change", e => { S.card = ALL_MASTER_CARDS.find(c => c.id === e.target.value); if (S.rows.length) recompute(); });
  $("stFile")?.addEventListener("change", e => onFile(e.target.files[0]));
  $("btnStmtApply")?.addEventListener("click", applyImport);
}
