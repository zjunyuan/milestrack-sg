// Statement import (CSV): pick a card, load the file in the browser, confirm the columns, review each line, then save.
// Nothing leaves the device except the transactions the user chooses to import.
import { state } from "./state.js";
import { ALL_MASTER_CARDS, cardShort } from "./config.js";
import { saveTxToFirestore, updateVaultDoc, deleteTxFromFirestore, mergeSettingsDoc } from "./firebase.js";
import { calcEarnedMiles } from "./recommender.js";
import { getMccEntry } from "./mcc.js";
import { findRetailerForInput, buildRetailerList, normalizeText, escapeHtml } from "./retailers.js";
import { fmtNum } from "./format.js";
import { parseCsv, detectLayout, guessLayoutByContent, buildLines, matchLines, matchOtherCards, maskNumbers, summarize, dayKey, detectCardHint, suggestCardId, familyOf, FX_SIBLING, parseDateStr, isChannelSplit, looksOnline } from "./statements.js";
import { readXls } from "./xls.js";
import { deleteTransactionsBulk, restoreTransactions } from "./bulk-delete.js";
import { statementTiming, postingRule, countsTs } from "./posting.js";

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

const REMOVED_KEY = "milestrack_last_removed";   // entries the last import removed, kept on this device so Undo can put them back
const loadRemoved = () => { try { return JSON.parse(localStorage.getItem(REMOVED_KEY) || "null"); } catch { return null; } };
const saveRemoved = (v) => { try { if (v) localStorage.setItem(REMOVED_KEY, JSON.stringify(v)); else localStorage.removeItem(REMOVED_KEY); } catch { /* storage unavailable */ } };
const GRACE_DAYS = 7;   // entries this close to the end of a statement may simply post on the next one

const blankFile = () => ({ stale: [], recent: [], remove: {}, chan: {}, flip: false, since: "", hint: null, card: null, rows: [], headerRow: -1, cols: {}, order: "dmy", results: [], missing: [], choice: {}, post: {}, fileName: "", lo: 0, hi: 0 });
let S = blankFile();                       // the file being worked on (the only one in single mode, the open one in batch mode)
const B = { files: [], open: -1 };         // batch mode: several files in one go
const isBatch = () => B.files.length > 0;   // every upload is a list of cards, even when it holds just one
function withFile(F, fn) { const prev = S; S = F; try { return fn(); } finally { S = prev; } }

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

function renderMapping(box, after) {
  box.innerHTML = `
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
  for (const id of ["stColDate", "stColDesc", "stColAmt", "stColDebit", "stColCredit", "stOrder", "stSince", "stFlip"]) $(id).addEventListener("change", () => { readMapping(); after(); });
}

function readMapping() {
  const v = id => parseInt($(id).value, 10);
  S.cols = { ...S.cols, date: v("stColDate"), desc: v("stColDesc"), amount: v("stColAmt"), debit: v("stColDebit"), credit: v("stColCredit") };
  S.order = $("stOrder").value;
  S.since = $("stSince").value;
  S.flip = $("stFlip").checked;
}

// The posting date to store for a line: only for cards that count by posting date, and only when the file gave one.
function postFor(card, line) {
  const rule = postingRule(card);
  return rule && rule.basis !== "transaction" && line.postTs ? line.postTs : null;
}
function keyCardId() { return familyOf(S.card.id)[0]; }   // one key per physical card, whichever entry the lines go to
function computeCore() {
  let lines = buildLines(S.rows, S.headerRow, S.cols, { order: S.order, flip: S.flip });
  // A file whose only date column is a posting date: that date is the posting date.
  const dateHdr = S.headerRow >= 0 && S.cols.date >= 0 ? String(S.rows[S.headerRow][S.cols.date] || "") : "";
  if (/post/i.test(dateHdr)) lines.forEach(l => { if (l.postTs === undefined) l.postTs = l.ts; });
  if (S.since) { const t = parseDateStr(S.since, "ymd"); if (t) lines = lines.filter(l => l.ts >= t - 43200000); }
  const fam = familyOf(S.card.id);
  const existing = state.transactions.filter(t => fam.includes(t.cardId));
  const m = matchLines(lines, existing, { cardId: keyCardId() });
  // Bank statements win: a leftover line may be something logged on the wrong card (and not yet confirmed by any statement).
  const others = state.transactions.filter(t => !fam.includes(t.cardId) && !t.stmtConfirmed && !t.stmtKey && t.source !== "statement");
  matchOtherCards(m.results, others);
  S.results = m.results; S.missing = m.missing; S.choice = {}; S.chan = {}; S.post = {};
  // Entries of mine in the statement's period that it does not show (and no other statement has confirmed): the statement wins, so they go,
  // except the last GRACE_DAYS, which may post on the next statement.
  const hiTs = lines.length ? Math.max(...lines.map(l => l.ts)) : 0;
  const graceCut = hiTs - GRACE_DAYS * 86400000;
  S.stale = m.missing.filter(t => !t.stmtConfirmed && t.source !== "statement" && (t.timestamp || 0) <= graceCut);
  S.recent = m.missing.filter(t => !S.stale.includes(t));
  S.remove = {}; S.stale.forEach(t => { S.remove[t.id] = true; });
  if (isChannelSplit(S.card.id)) m.results.forEach((r, i) => { if (r.status === "new" || r.status === "differs" || r.status === "moved") S.chan[i] = guessEntry(r.line); });
  // What the statement changes on a matched entry: its date, and the "confirmed by a statement" mark.
  m.results.forEach(r => {
    if (!r.existing) return;
    r.dateChanged = dayKey(r.existing.timestamp || 0) !== dayKey(r.line.ts);
    r.unconfirmed = !r.existing.stmtConfirmed && r.existing.source !== "statement";
  });
  // Posting-date cards: which cycle each line counts to, and whether my entry needs its posting date recorded.
  m.results.forEach((r, i) => {
    const c = r.existing && r.status !== "moved" ? ALL_MASTER_CARDS.find(x => x.id === r.existing.cardId) || S.card : targetCard(r.line, i);
    r.timing = r.status === "credit" ? null : statementTiming(c, r.line);
    if (r.existing && r.timing && r.timing.status === "posted-later" && Number(r.existing.postTs) !== r.line.postTs) S.post[i] = true;
  });
  m.results.forEach((r, i) => { S.choice[i] = r.status === "new" ? (r.line.fee ? "skip" : "add") : (r.status === "differs" || r.status === "moved") ? "statement" : "skip"; });
  S.lo = lines.length ? Math.min(...lines.map(l => l.ts)) : 0; S.hi = hiTs;
}
// Online-vs-tap (PPV) or dining-vs-travel (Lady's) cannot be read from a statement: a per-line choice, guessed for PPV.
function entryLabel(id) { return ALL_MASTER_CARDS.find(c => c.id === id)?.name || id; }
function guessEntry(line) {
  const fam = familyOf(S.card.id).filter(id => state.enabledCardIds.includes(id));
  if (S.card.id.startsWith("uob-ppv")) { const want = looksOnline(line.desc) ? "uob-ppv-online" : "uob-ppv-contactless"; return fam.includes(want) ? want : S.card.id; }
  return S.card.id;
}
// Foreign-currency lines on a card with a separate FCY entry go to that entry; channel-split cards use the per-line choice.
function targetCard(line, i) {
  if (i !== undefined && S.chan[i]) { const c = ALL_MASTER_CARDS.find(x => x.id === S.chan[i]); if (c) return c; }
  const sib = FX_SIBLING[S.card.id];
  return line.fx && sib && state.enabledCardIds.includes(sib) ? ALL_MASTER_CARDS.find(c => c.id === sib) : S.card;
}

const dShort = ts => new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
function timingHtml(r, i) {
  const t = r.timing; if (!t) return "";
  if (t.status === "posted-later") {
    return `<div class="st-sub st-post">📅 Spent ${dShort(t.spent)}, posted ${dShort(t.posted)}: counts to the cycle starting ${dShort(t.nextStart)} on this card (posting-date card).</div>`
      + (r.status === "matched" && r.existing && S.post[i] !== undefined ? `<label class="st-sub"><input type="checkbox" class="st-postchk" data-i="${i}" ${S.post[i] ? "checked" : ""}> Record the posting date on my entry so it counts to that cycle</label>` : "");
  }
  return `<div class="st-sub st-post">⏳ This file has no posting date. Spent ${dShort(t.spent)}, near the end of the cycle: the bank may post it after ${dShort(new Date(t.nextStart.getTime() - 86400000))}, which would count it to the next cycle.</div>`;
}

function rowHtml(r, i) {
  const l = r.line;
  const head = `<div class="st-line-main"><b>${escapeHtml(friendlyName(l))}</b><span class="st-amt">${money(Math.abs(l.amt))}${l.amt < 0 ? " CR" : ""}</span></div>
    <div class="st-sub">${dateLabel(l.ts)}${l.pending ? " · ⏳ pending, the amount may still change" : ""}${l.fx ? ` · 🌏 foreign: ${escapeHtml(l.fx.cur)} ${fmtNum(l.fx.amount, 2)}` : ""} · <span title="${escapeHtml(l.desc)}">${escapeHtml(l.desc.length > 38 ? l.desc.slice(0, 36) + "…" : l.desc)}</span>${r.repeatTotal > 1 ? ` · appears ${r.repeatTotal}× on the statement (each kept as its own purchase)` : ""}</div>`;
  if (r.status === "differs") {
    return `<div class="st-line st-differs">${head}${timingHtml(r, i)}
      <div class="st-sub st-warn">⚠️ ${escapeHtml(r.reason)} ("${escapeHtml(r.existing.desc)}", ${dateLabel(r.existing.timestamp)})</div>
      <select class="form-control st-choice" data-i="${i}">
        <option value="statement">Update my entry from the statement (${money(l.amt)}${r.dateChanged ? ", " + dateLabel(l.ts) : ""})</option>
        <option value="new">Not the same purchase: add separately</option>
      </select></div>`;
  }
  if (r.status === "moved") {
    return `<div class="st-line st-differs">${head}${timingHtml(r, i)}
      <div class="st-sub st-warn">🔀 You logged this on ${escapeHtml(entryLabel(r.existing.cardId))} ("${escapeHtml(r.existing.desc)}", ${dateLabel(r.existing.timestamp)}). The statement says it was on this card.</div>
      ${isChannelSplit(S.card.id) ? `<select class="form-control st-chan" data-i="${i}">${familyOf(S.card.id).filter(id => state.enabledCardIds.includes(id)).map(id => `<option value="${id}" ${S.chan[i] === id ? "selected" : ""}>Count as: ${escapeHtml(entryLabel(id))}</option>`).join("")}</select>` : ""}
      <select class="form-control st-choice" data-i="${i}">
        <option value="statement">Move my entry to ${escapeHtml(targetCard(l, i).name)}</option>
        <option value="new">Not the same purchase: add separately</option>
      </select></div>`;
  }
  if (r.status === "new") {
    return `<div class="st-line st-new">${head}${timingHtml(r, i)}
      ${l.fee ? `<div class="st-sub st-warn">Fee or charge, not spend: left out by default (no miles)</div>` : ""}
      ${isChannelSplit(S.card.id) ? `<select class="form-control st-chan" data-i="${i}">${familyOf(S.card.id).filter(id => state.enabledCardIds.includes(id)).map(id => `<option value="${id}" ${S.chan[i] === id ? "selected" : ""}>Count as: ${escapeHtml(entryLabel(id))}</option>`).join("")}</select>` : (targetCard(l, i).id !== S.card.id ? `<div class="st-sub">→ goes to ${escapeHtml(targetCard(l, i).name)}</div>` : "")}
      <label class="st-sub"><input type="checkbox" class="st-add" data-i="${i}" ${S.choice[i] === "add" ? "checked" : ""}> Add to my list</label></div>`;
  }
  return `<div class="st-line">${head}${timingHtml(r, i)}<div class="st-sub">${r.status === "credit" ? "Refund or payment: not tracked" : "✅ " + escapeHtml(r.reason) + (r.existing ? ` ("${escapeHtml(r.existing.desc)}")` : "") + (r.existing && r.dateChanged ? ` · date set to ${dateLabel(r.line.ts)} from the statement` : "")}</div></div>`;
}

function timingSummary() {
  const later = S.results.filter(r => r.timing && r.timing.status === "posted-later").length;
  const slip = S.results.filter(r => r.timing && r.timing.status === "may-slip").length;
  if (!later && !slip) return "";
  return `<div class="hm-note st-post">🗓️ ${S.card.name.replace(/\s*\(.*\)$/, "")} counts spend by <b>posting date</b>.`
    + (later ? ` ${later} line${later === 1 ? "" : "s"} posted in a later cycle than the purchase and count there.` : "")
    + (slip ? ` ${slip} line${slip === 1 ? "" : "s"} were bought near the end of a cycle and this file has no posting date, so ${slip === 1 ? "it" : "they"} may count to the next cycle.` : "")
    + ` <a href="#" id="stPostInfo">How it works</a></div>`;
}

function renderReview(box = $("stmtReview")) {
  reviewBox = box;
  const n = summarize(S.results);
  if (!S.results.length) {
    box.innerHTML = `<p class="hm-note">No transactions found with these columns. Check the Date and Amount columns above, or the date order.</p>`;
    if (!isBatch()) $("btnStmtApply").disabled = true;
    return;
  }
  const group = (status, title, open = false) => {
    const items = S.results.map((r, i) => r.status === status ? rowHtml(r, i) : "").join("");
    return items ? `<details class="st-group" ${open ? "open" : ""}><summary>${title}</summary>${items}</details>` : "";
  };
  const ids = familyOf(S.card.id).filter(id => state.enabledCardIds.includes(id));
  const bulk = isChannelSplit(S.card.id) && ids.length > 1 ? `<div class="hm-note"><b>Which entry does this spend belong to?</b> The statement doesn't say whether a purchase was online or by tap, so I guessed from the merchant name. Check each line, or set them all:
      <select class="form-control" id="stBulk"><option value="">Set all new lines to…</option><option value="__guess">Guess from the merchant name</option>${ids.map(id => `<option value="${id}">${escapeHtml(entryLabel(id))}</option>`).join("")}</select></div>` : "";
  box.innerHTML = `${bulk}
    <div class="st-summary">
      <span><b>${n.new}</b> new</span><span><b>${n.differs}</b> differ</span>${n.moved ? `<span><b>${n.moved}</b> on another card</span>` : ""}<span><b>${n.matched}</b> already logged</span><span><b>${n.credit}</b> credits skipped</span>
    </div>
    ${timingSummary()}
    ${group("moved", "🔀 Logged on another card: moved here", true)}
    ${group("differs", "⚠️ Amount differs: the statement wins", true)}
    ${group("new", "➕ New: not in your list yet", true)}
    ${group("matched", "✅ Already in your list")}
    ${group("credit", "↩️ Refunds and payments (skipped)")}
    ${S.stale.length ? `<details class="st-group" open><summary>🗑️ Not on this statement: remove (${S.stale.length})</summary>
      <div class="hm-note">The statement is the record, so these entries of yours are marked for removal. Untick any you want to keep. Check first that the file is the complete statement for the period.</div>
      ${S.stale.map(t => `<label class="st-line st-remove"><div class="st-line-main"><span><input type="checkbox" class="st-rm" data-id="${escapeHtml(String(t.id))}" ${S.remove[t.id] ? "checked" : ""}> <b>${escapeHtml(t.desc)}</b></span><span class="st-amt">${money(Number(t.amt))}</span></div><div class="st-sub">${dateLabel(t.timestamp)} · ${escapeHtml(entryLabel(t.cardId))}</div></label>`).join("")}</details>` : ""}
    ${S.recent.length ? `<details class="st-group"><summary>🕓 Too recent to judge, left alone (${S.recent.length})</summary>
      ${S.recent.map(t => `<div class="st-line"><div class="st-line-main"><b>${escapeHtml(t.desc)}</b><span class="st-amt">${money(Number(t.amt))}</span></div><div class="st-sub">${dateLabel(t.timestamp)}. Within ${GRACE_DAYS} days of the end of this statement, so it may post on the next one.</div></div>`).join("")}</details>` : ""}`;
  box.querySelectorAll(".st-rm").forEach(el => el.addEventListener("change", () => { S.remove[el.dataset.id] = el.checked; updateApplyLabel(); }));
  box.querySelectorAll(".st-add").forEach(el => el.addEventListener("change", () => { S.choice[el.dataset.i] = el.checked ? "add" : "skip"; updateApplyLabel(); }));
  box.querySelectorAll(".st-chan").forEach(el => el.addEventListener("change", () => { S.chan[el.dataset.i] = el.value; }));
  $("stBulk")?.addEventListener("change", e => {
    const v = e.target.value; if (!v) return;
    S.results.forEach((r, i) => { if (r.status === "new") S.chan[i] = v === "__guess" ? guessEntry(r.line) : v; });
    renderReview(reviewBox);
  });
  box.querySelectorAll(".st-postchk").forEach(el => el.addEventListener("change", () => { S.post[el.dataset.i] = el.checked; updateApplyLabel(); }));
  box.querySelectorAll(".st-choice").forEach(el => el.addEventListener("change", () => { S.choice[el.dataset.i] = el.value; updateApplyLabel(); }));
  $("stPostInfo")?.addEventListener("click", e => { e.preventDefault(); window.dispatchEvent(new Event("open-posting-sheet")); });
  updateApplyLabel();
}

function plan() {
  let add = 0, update = 0, confirm = 0;
  const remove = S.stale.filter(t => S.remove[t.id]).length;
  S.results.forEach((r, i) => {
    const c = S.choice[i];
    if (r.status === "new" && c === "add") add++;
    if (r.status === "differs" || r.status === "moved") { if (c === "statement") update++; else if (c === "new") add++; }
    else if (r.status === "matched" && r.existing) { if (r.dateChanged || S.post[i]) update++; else if (r.unconfirmed) confirm++; }
  });
  return { add, update, confirm, remove };
}
function planText(p) {
  const any = p.add + p.update + p.confirm + p.remove;
  return any === 0 ? "Nothing to import" : `Import: add ${p.add}, update ${p.update}${p.confirm ? `, confirm ${p.confirm}` : ""}${p.remove ? `, remove ${p.remove}` : ""}`;
}
const sumPlans = ps => ps.reduce((a, p) => ({ add: a.add + p.add, update: a.update + p.update, confirm: a.confirm + p.confirm, remove: a.remove + p.remove }), { add: 0, update: 0, confirm: 0, remove: 0 });
const batchFiles = () => B.files.filter(F => F.card && F.results.length);
function updateApplyLabel() {
  const btn = $("btnStmtApply");
  const p = isBatch() ? sumPlans(batchFiles().map(F => withFile(F, plan))) : plan();
  const any = p.add + p.update + p.confirm + p.remove;
  btn.disabled = any === 0;
  btn.textContent = planText(p);
  if (isBatch()) renderBatchCounts();
}

// Fields an import can change on an existing transaction; undo puts them back.
const UNDO_FIELDS = ["postTs", "amt", "miles", "earnedRawPoints", "estimatedMiles", "reconciled", "amtOriginal", "stmtKey", "stmtNote", "timestamp", "date", "cardId", "bonusCategory", "stmtConfirmed", "stmtDesc"];

// The most recent import still in the list: lines it added, and lines it changed.
export function lastImport() {
  const tagged = state.transactions.filter(t => t.importId);
  const bk = loadRemoved();
  const removedTxs = bk && Array.isArray(bk.txs) ? bk.txs : [];
  if (!tagged.length) return removedTxs.length ? { id: bk.importId, at: bk.at || 0, added: [], updated: [], removed: removedTxs } : null;
  const latest = tagged.reduce((a, t) => ((t.importedAt || 0) > (a.importedAt || 0) ? t : a), tagged[0]);
  if (removedTxs.length && (bk.at || 0) > (latest.importedAt || 0)) return { id: bk.importId, at: bk.at || 0, added: [], updated: [], removed: removedTxs };
  const rows = tagged.filter(t => t.importId === latest.importId);
  return { id: latest.importId, at: latest.importedAt || 0, added: rows.filter(t => !t.importUpdated), updated: rows.filter(t => t.importUpdated), removed: bk && bk.importId === latest.importId ? removedTxs : [] };
}

function refreshUndo() {
  const box = $("stmtUndo"); if (!box) return;
  const li = lastImport();
  if (!li) { box.style.display = "none"; box.innerHTML = ""; return; }
  const when = new Date(li.at).toLocaleString("en-SG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  box.style.display = "";
  box.innerHTML = `<span>↩️ Last import (${escapeHtml(when)}): ${li.added.length} added${li.updated.length ? `, ${li.updated.length} changed` : ""}${li.removed && li.removed.length ? `, ${li.removed.length} removed` : ""}.</span> <button type="button" class="btn-backup" id="btnStmtUndo" style="margin-top:6px;">Undo last import</button>`;
  $("btnStmtUndo").addEventListener("click", undoLastImport);
}

// Deletes the lines the last import added and puts back what it changed. Points balances move only for lines that were counted into them.
async function undoLastImport() {
  const li = lastImport(); if (!li) return;
  if (!confirm(`Undo the last import? ${li.added.length} added line${li.added.length === 1 ? "" : "s"} will be deleted${li.updated.length ? `, ${li.updated.length} changed line${li.updated.length === 1 ? "" : "s"} put back as they were` : ""}${li.removed && li.removed.length ? ` and ${li.removed.length} removed entr${li.removed.length === 1 ? "y" : "ies"} restored` : ""}.`)) return;
  const btn = $("btnStmtUndo"); if (btn) btn.disabled = true;
  const vaultMinus = {};
  const take = (tx, raw) => { const c = ALL_MASTER_CARDS.find(x => x.id === tx.cardId); if (c && raw) vaultMinus[c.vaultKey] = (vaultMinus[c.vaultKey] || 0) + raw; };
  try {
    for (const t of li.updated) {
      const rec = { ...t }; delete rec.firestoreId;
      for (const f of [...UNDO_FIELDS, "importId", "importedAt", "importUpdated", "importPrev", "vaultDelta", "vaultAdj"]) delete rec[f];
      await saveTxToFirestore(t.id, { ...rec, ...(t.importPrev || {}) });
      if (t.vaultAdj && typeof t.vaultAdj === "object") { for (const [k, raw] of Object.entries(t.vaultAdj)) if (raw) vaultMinus[k] = (vaultMinus[k] || 0) + Number(raw); }
      else take(t, Number(t.vaultDelta) || 0);
    }
    for (const t of li.added) {
      await deleteTxFromFirestore(t.firestoreId || t.id);
      if (t.vaultCounted) take(t, Number(t.earnedRawPoints) || 0);
    }
    let touched = false;
    for (const [k, raw] of Object.entries(vaultMinus)) if (state.myVault[k]) { state.myVault[k].points = Math.max(0, (Number(state.myVault[k].points) || 0) - raw); touched = true; }
    if (touched) await updateVaultDoc(state.myVaultKey, state.myVault);
    if (li.removed && li.removed.length) { await restoreTransactions(li.removed); saveRemoved(null); }
    alert("Import undone.");
  } catch (err) {
    console.error("Undo import failed", err);
    alert(`Undo stopped part-way: ${err?.message || err}. Tap Undo last import again to finish.`);
  }
  refreshUndo();
}

function makeCtx() {
  const bucketSpend = {};
  for (const t of state.transactions) { const tc = ALL_MASTER_CARDS.find(c => c.id === t.cardId); if (!tc) continue; const b = tc.id + cycleBucket(tc, countsTs(t, tc)); bucketSpend[b] = (bucketSpend[b] || 0) + (Number(t.amt) || 0); }
  const base = Date.now();
  const importId = "imp" + base.toString(36);
  return { bucketSpend, vaultDeltas: {}, base, importId, stamp: { importId, importedAt: base }, seq: 0, done: 0, seenKeys: new Set(), touched: new Set(), masked: 0, addVault: $("stAddVault").checked };
}

// Applies the lines of the current file (S). Shared by single and batch imports; ctx carries the totals across files.
async function applyLines(ctx) {
  const { bucketSpend, vaultDeltas, stamp, base, addVault } = ctx;
  const card = S.card;
  const scrub = v => { const r = maskNumbers(v); ctx.masked += r.masked; return r.text; };   // card and account numbers never get saved in full
  const addDelta = (map, key, raw) => { if (key && raw) map[key] = (map[key] || 0) + raw; };
  const dateStr = ts => new Date(ts).toLocaleDateString("en-SG", { month: "short", day: "numeric" });
  const prevOf = old => { const prev = {}; for (const f of UNDO_FIELDS) if (old[f] !== undefined) prev[f] = old[f]; return prev; };
  const order = S.results.map((r, i) => i).sort((a, b) => S.results[a].line.ts - S.results[b].line.ts);
  for (const i of order) {
    const r = S.results[i], c = S.choice[i], l = r.line;
    // Overlapping files: a line or an entry already handled earlier in this import is not handled twice.
    if (r.existing && ctx.touched.has(r.existing.id)) continue;
    const makeNew = (r.status === "new" && c === "add") || ((r.status === "differs" || r.status === "moved") && c === "new");
    if (makeNew) {
      if (ctx.seenKeys.has(r.key)) continue;
      ctx.seenKeys.add(r.key);
      const tCard = targetCard(l, i);
      const postTs = postFor(tCard, l);
      const bucket = tCard.id + cycleBucket(tCard, postTs ? countsTs({ timestamp: l.ts, postTs }, tCard) : l.ts);
      const est = l.fee ? { miles: 0, earnedRawPoints: 0, bonusCategory: "base" } : estimateTx(tCard, l, bucketSpend[bucket] || 0);
      bucketSpend[bucket] = (bucketSpend[bucket] || 0) + l.amt;
      const id = String(base + (ctx.seq++));
      await saveTxToFirestore(id, {
        id, owner: state.myVaultKey, timestamp: l.ts, desc: scrub(friendlyName(l)), stmtDesc: scrub(l.desc), amt: l.amt, cardId: tCard.id,
        bonusCategory: est.bonusCategory, miles: est.miles, earnedRawPoints: est.earnedRawPoints,
        date: dateStr(l.ts),
        source: "statement", stmtConfirmed: true, estimatedMiles: true, ...(postTs ? { postTs } : {}), ...stamp, ...(addVault ? { vaultCounted: true } : {}), stmtKey: r.key, ...(l.pending ? { pending: true } : {}), ...(l.fee ? { fee: true } : {}), ...(l.ref ? { stmtRef: scrub(l.ref) } : {}), ...(l.fx ? { fx: `${l.fx.cur} ${l.fx.amount}` } : {})
      });
      addDelta(vaultDeltas, tCard.vaultKey, est.earnedRawPoints); ctx.done++;
    } else if (r.status === "matched" && r.existing && (r.dateChanged || r.unconfirmed || S.post[i])) {
      // The statement confirms this entry: mark it, take the statement's date, and record the posting date when it matters.
      ctx.touched.add(r.existing.id);
      const old = { ...r.existing }; delete old.firestoreId;
      const oc = ALL_MASTER_CARDS.find(x => x.id === old.cardId) || card;
      const pt = S.post[i] ? postFor(oc, l) : null;
      const patch = { stmtKey: r.key, stmtConfirmed: true, stmtDesc: scrub(l.desc), ...(r.dateChanged ? { timestamp: l.ts, date: dateStr(l.ts) } : {}), ...(pt ? { postTs: pt } : {}) };
      await saveTxToFirestore(old.id, { ...old, ...stamp, importUpdated: true, importPrev: prevOf(old), ...patch });
      ctx.done++;
    } else if ((r.status === "differs" || r.status === "moved") && c === "statement" && r.existing) {
      // The statement wins: its amount, date and card replace the entry's. The channel and the friendly name stay as the user set them.
      ctx.touched.add(r.existing.id);
      const old = { ...r.existing }; delete old.firestoreId;
      const oldCard = ALL_MASTER_CARDS.find(x => x.id === old.cardId) || card;
      const nc = r.status === "moved" ? targetCard(l, i) : oldCard;
      const pt = postFor(nc, l);
      let bonusCategory = old.bonusCategory, miles, raw;
      if (r.status === "moved") {
        const bucket = nc.id + cycleBucket(nc, pt ? countsTs({ timestamp: l.ts, postTs: pt }, nc) : l.ts);
        const est = estimateTx(nc, l, bucketSpend[bucket] || 0);
        bucketSpend[bucket] = (bucketSpend[bucket] || 0) + l.amt;
        bonusCategory = est.bonusCategory; miles = est.miles; raw = est.earnedRawPoints;
      } else {
        const rate = old.bonusCategory === "bonus" ? nc.bonusMpd : nc.baseMpd;
        miles = calcEarnedMiles(nc, l.amt, rate);
        raw = Math.round(miles / (state.myVault[nc.vaultKey]?.ratio || 1));
      }
      const adj = {};
      if (addVault) { addDelta(adj, oldCard.vaultKey, -(Number(old.earnedRawPoints) || 0)); addDelta(adj, nc.vaultKey, raw); for (const [k, v] of Object.entries(adj)) addDelta(vaultDeltas, k, v); }
      await saveTxToFirestore(old.id, {
        ...old, ...stamp, importUpdated: true, importPrev: prevOf(old),
        ...(addVault && Object.keys(adj).length ? { vaultAdj: adj } : {}),
        cardId: nc.id, bonusCategory, timestamp: r.dateChanged ? l.ts : old.timestamp, date: r.dateChanged ? dateStr(l.ts) : old.date,
        ...(pt ? { postTs: pt } : {}), amt: l.amt, amtOriginal: old.amtOriginal ?? old.amt, miles, earnedRawPoints: raw,
        stmtKey: r.key, stmtConfirmed: true, stmtDesc: scrub(l.desc), reconciled: true, estimatedMiles: true
      });
      ctx.done++;
    }
  }
}

// Statement coverage: which months of which cards a statement has been imported for. Kept in the settings document.
function coverageFor(F) {
  const months = {};
  if (!F.card || !F.results.length) return months;
  const lo = new Date(F.lo), hi = new Date(F.hi);
  for (let d = new Date(lo.getFullYear(), lo.getMonth(), 1); d <= hi; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) months[dayKey(d.getTime()).slice(0, 7)] = { n: 0 };
  for (const r of F.results) { if (r.status === "credit") continue; const m = dayKey(r.line.ts).slice(0, 7); if (months[m]) months[m].n++; }
  return months;
}

async function finishApply(ctx, files) {
  const toRemove = [];
  const seen = new Set();
  for (const F of files) for (const t of F.stale) if (F.remove[t.id] && !ctx.touched.has(t.id) && !seen.has(t.id)) { seen.add(t.id); toRemove.push(t); }
  if (toRemove.length) {
    const { deleted, failed } = await deleteTransactionsBulk(toRemove);
    if (deleted.length) { saveRemoved({ importId: ctx.importId, at: ctx.base, txs: deleted }); ctx.done += deleted.length; }
    if (failed.length) alert(`${failed.length} entr${failed.length === 1 ? "y" : "ies"} could not be removed. Re-run the import to try again.`);
  }
  if (ctx.addVault) {
    let touched = false;
    for (const [k, raw] of Object.entries(ctx.vaultDeltas)) if (raw && state.myVault[k]) { state.myVault[k].points = Math.max(0, (Number(state.myVault[k].points) || 0) + raw); touched = true; }
    if (touched) await updateVaultDoc(state.myVaultKey, state.myVault);
  }
  const cover = {};
  for (const F of files) {
    if (F.hint && F.hint.last4) { const m = loadRemembered(); m[F.hint.last4] = F.card.id; saveRemembered(m); }
    const key = familyOf(F.card.id)[0];
    for (const [m, v] of Object.entries(coverageFor(F))) { cover[key] = cover[key] || {}; cover[key][m] = { n: ((cover[key][m] || {}).n || 0) + v.n, at: ctx.base }; }
  }
  if (Object.keys(cover).length) {
    const prev = state.stmtCoverage || {};
    const next = { ...prev };
    for (const [k, ms] of Object.entries(cover)) next[k] = { ...(prev[k] || {}), ...ms };
    state.stmtCoverage = next;
    try { await mergeSettingsDoc(state.myVaultKey, { stmtCoverage: cover }); } catch (e) { console.error("Coverage save failed", e); }
  }
}

async function applyImport() {
  if (isBatch()) return applyBatch();
  const card = S.card, btn = $("btnStmtApply");
  const p = plan();
  const total = p.add + p.update + p.confirm + p.remove;
  if (!confirm(`Add ${p.add}, update ${p.update}${p.confirm ? `, confirm ${p.confirm}` : ""}${p.remove ? ` and REMOVE ${p.remove} entr${p.remove === 1 ? "y" : "ies"} that ${p.remove === 1 ? "is" : "are"} not on the statement` : ""} for ${card.name}? Where the statement disagrees with an entry of yours, the statement wins (you can undo the import).`)) return;
  btn.disabled = true;
  const ctx = makeCtx();
  try {
    await applyLines(ctx);
    await finishApply(ctx, [S]);
    closeStatementSheet();
    alert(`Imported ${ctx.done} transaction${ctx.done === 1 ? "" : "s"}.${ctx.addVault ? "" : " Your bank points balances were not changed."}${ctx.masked ? ` ${ctx.masked} card or account number${ctx.masked === 1 ? " was" : "s were"} masked to the last 4 digits before saving.` : ""} Changed your mind? Open Import a bank statement again and tap "Undo last import".`);
  } catch (err) {
    console.error("Statement import failed", err);
    alert(`Import stopped after ${ctx.done} of ${total}: ${err?.message || err}. Re-run the same file: lines already imported are recognised and skipped.`);
    btn.disabled = false;
  }
}

// Several files at once: oldest first, one confirmation, one Undo. Overlapping files do not double up (see applyLines).
async function applyBatch() {
  const files = batchFiles().slice().sort((a, b) => (a.lo || 0) - (b.lo || 0));
  const p = sumPlans(files.map(F => withFile(F, plan)));
  const skipped = B.files.length - files.length;
  if (!confirm(`Import ${files.length} file${files.length === 1 ? "" : "s"}: add ${p.add}, update ${p.update}${p.confirm ? `, confirm ${p.confirm}` : ""}${p.remove ? ` and REMOVE ${p.remove} entr${p.remove === 1 ? "y" : "ies"} that ${p.remove === 1 ? "is" : "are"} not on a statement` : ""}?${skipped ? `\n\n${skipped} file${skipped === 1 ? " has" : "s have"} no card chosen or no lines and will be skipped.` : ""}\n\nWhere a statement disagrees with an entry of yours, the statement wins. One Undo reverses the whole import.`)) return;
  const btn = $("btnStmtApply"); btn.disabled = true;
  const ctx = makeCtx();
  try {
    for (const F of files) { S = F; btn.textContent = `Importing ${F.fileName}…`; await applyLines(ctx); }
    await finishApply(ctx, files);
    closeStatementSheet();
    alert(`Imported ${ctx.done} transaction${ctx.done === 1 ? "" : "s"} from ${files.length} file${files.length === 1 ? "" : "s"}.${ctx.addVault ? "" : " Your bank points balances were not changed."}${ctx.masked ? ` ${ctx.masked} card or account number${ctx.masked === 1 ? " was" : "s were"} masked to the last 4 digits before saving.` : ""} Changed your mind? Open Import a bank statement again and tap "Undo last import".`);
  } catch (err) {
    console.error("Batch import failed", err);
    alert(`Import stopped after ${ctx.done} change${ctx.done === 1 ? "" : "s"}: ${err?.message || err}. Re-select the same files: lines already imported are recognised and skipped.`);
    btn.disabled = false; updateApplyLabel();
  }
}

// Exports with no card name in them: the bank's default file name gives it away (OCBC "TransactionHistory…", Citi "ACCT_…").
function nameFromFile(fn) {
  if (/^ACCT_\d+/i.test(fn)) return "Citi Rewards";
  if (/^TransactionHistory/i.test(fn)) return "OCBC Rewards";
  return "";
}
// Reads a file's rows and works out its card hint, layout and sign convention (no screen changes). Returns the guessed card id or "".
function prepareCore(rows, fileName = "") {
  S.rows = rows; S.fileName = fileName;
  S.hint = detectCardHint(S.rows);
  const fn = nameFromFile(fileName);
  if (fn && (!S.hint || !S.hint.name)) S.hint = { name: fn, last4: S.hint ? S.hint.last4 : "" };
  const guess = suggestCardId(S.hint, state.enabledCardIds, loadRemembered());
  if (guess) S.card = ALL_MASTER_CARDS.find(c => c.id === guess);
  const found = detectLayout(S.rows) || guessLayoutByContent(S.rows);
  S.headerRow = found.headerRow; S.cols = found.cols; S.order = "dmy"; S.since = ""; S.flip = false;
  const probe = buildLines(S.rows, S.headerRow, S.cols, { order: S.order });
  // Payments, transfers and fees sit on the opposite side of spend, so leave them out when judging which sign means spend.
  const spendish = probe.filter(l => !l.fee && !/visa direct|payment|giro|fund transfer|moneysend|refund|rebate|cashback/i.test(l.desc));
  S.flip = spendish.length >= 1 && spendish.filter(l => l.amt < 0).length > spendish.length * 0.6;   // spend shown as negative numbers
  return guess;
}
// A file may hold several cards (a combined UOB PDF): returns [{ label, rows, name, last4 }], one per card section, else one entry.
async function readParts(file) {
  if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") {
    const { readPdfParts } = await import("./pdf-statement.js");
    const parts = await readPdfParts(file, () => prompt(`This PDF (${file.name}) is password protected. Enter the password (it is only used on this device):`));
    return parts.length === 1 && !parts[0].last4 ? [{ label: file.name, rows: parts[0].rows }]
      : parts.map(p => ({ label: `${file.name} · ${p.name || "card"}${p.last4 ? " ····" + p.last4 : ""}`, rows: p.rows }));
  }
  return [{ label: file.name, rows: await readRows(file) }];
}

async function readRows(file) {
  if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") {
    const { readPdfLines } = await import("./pdf-statement.js");
    return readPdfLines(file, () => prompt(`This PDF (${file.name}) is password protected. Enter the password (it is only used on this device):`));
  }
  if (/\.xlsx$/i.test(file.name)) throw new Error("This is an .xlsx file. Save it as CSV (or .xls) from Excel and try again.");
  if (/\.xls$/i.test(file.name)) return readXls(await file.arrayBuffer());
  return parseCsv(await file.text());
}

// Several files at once (a whole year of statements, say): each file works out its own card, the review lists them with their counts.
async function onFiles(list) {
  const files = [...(list || [])];
  if (!files.length) return;
  const note = $("stmtFileNote");
  $("stmtReview").innerHTML = ""; $("stmtMapping").innerHTML = "";
  const parts = [];
  for (let k = 0; k < files.length; k++) {
    note.style.display = "block"; note.textContent = `Reading ${k + 1} of ${files.length}: ${files[k].name}`;
    try { parts.push(...await readParts(files[k])); }
    catch (err) { console.error("Statement read failed", files[k].name, err); parts.push({ label: files[k].name, error: err && err.message ? err.message : String(err) }); }
  }
  loadParts(parts);
}

// Each part (a file, or one card's section of a combined PDF) works out its own card; the review lists them with their counts.
function loadParts(parts) {
  const note = $("stmtFileNote");
  $("stmtReview").innerHTML = ""; $("stmtMapping").innerHTML = "";
  const loaded = [];
  for (const part of parts) {
    const F = blankFile(); F.fileName = part.label;
    if (part.error) F.error = part.error;
    else {
      try { S = F; prepareCore(part.rows, part.label); if (F.card) computeCore(); }
      catch (err) { console.error("Statement read failed", part.label, err); F.error = err && err.message ? err.message : String(err); }
    }
    loaded.push(F);
  }
  note.style.display = "none";
  S = blankFile();
  B.files = loaded.sort((a, b) => (a.lo || Infinity) - (b.lo || Infinity) || a.fileName.localeCompare(b.fileName));
  B.open = -1;
  renderBatch(); updateApplyLabel();
}

let reviewBox = null;
function renderBatch() {
  const box = $("stmtReview");
  const cards = ALL_MASTER_CARDS.filter(c => state.enabledCardIds.includes(c.id));
  box.innerHTML = `<div class="st-batch-head" id="stBatchHead"></div>` + B.files.map((F, k) => `
    <div class="st-file" data-k="${k}">
      <div class="st-file-head">
        <b class="st-file-name" title="${escapeHtml(F.fileName)}">${escapeHtml(F.fileName)}</b>
        ${F.error ? `<div class="st-sub st-warn">Couldn't read this file: ${escapeHtml(F.error)}</div>` : `
        <select class="form-control st-file-card" data-k="${k}"><option value="">Choose the card…</option>${cards.map(c => `<option value="${c.id}" ${F.card && F.card.id === c.id ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("")}</select>
        <div class="st-file-counts" data-k="${k}"></div>
        <button type="button" class="btn-backup st-file-toggle" data-k="${k}">Details</button>`}
      </div>
      <div class="st-file-body" data-k="${k}" hidden></div>
    </div>`).join("");
  box.querySelectorAll(".st-file-card").forEach(el => el.addEventListener("change", () => {
    const k = +el.dataset.k, F = B.files[k];
    F.card = ALL_MASTER_CARDS.find(c => c.id === el.value) || null;
    F.results = []; if (F.card) withFile(F, computeCore);
    if (B.open === k) openFileBody(k, true);
    updateApplyLabel();
  }));
  box.querySelectorAll(".st-file-toggle").forEach(el => el.addEventListener("click", () => openFileBody(+el.dataset.k)));
}
function openFileBody(k, force = false) {
  const box = $("stmtReview");
  const wasOpen = B.open === k && !force;
  box.querySelectorAll(".st-file-body").forEach(b => { b.hidden = true; b.innerHTML = ""; });
  B.open = wasOpen ? -1 : k;
  if (wasOpen) return;
  const F = B.files[k]; if (!F.card) return;
  S = F;
  const body = box.querySelector(`.st-file-body[data-k="${k}"]`);
  body.hidden = false;
  body.innerHTML = `<details class="st-group"><summary>File columns (only if lines look wrong)</summary><div class="st-map"></div></details><div class="st-rev"></div>`;
  renderMapping(body.querySelector(".st-map"), () => { computeCore(); renderReview(body.querySelector(".st-rev")); updateApplyLabel(); });
  renderReview(body.querySelector(".st-rev"));
}
function renderBatchCounts() {
  let tot = { add: 0, update: 0, confirm: 0, remove: 0 }, ready = 0, waiting = 0;
  B.files.forEach((F, k) => {
    const el = document.querySelector(`.st-file-counts[data-k="${k}"]`); if (!el) return;
    if (!F.card) { el.textContent = F.hint ? `Which card is this? The file says "${F.hint.name || "a card"}"${F.hint.last4 ? " ending " + F.hint.last4 : ""}.` : "Which card is this? Choose it from the list."; el.className = "st-file-counts st-warn"; waiting++; return; }
    const p = withFile(F, plan), n = summarize(F.results);
    tot = sumPlans([tot, p]); ready++;
    const check = n.differs + n.moved;
    el.className = "st-file-counts";
    el.textContent = F.results.length ? `add ${p.add} · update ${p.update} · confirm ${p.confirm}${p.remove ? ` · remove ${p.remove}` : ""}${check ? ` · ${check} to check` : ""}` : "No lines found";
  });
  const head = $("stBatchHead");
  if (head) head.innerHTML = `<b>${B.files.length} files</b> · add ${tot.add} · update ${tot.update} · confirm ${tot.confirm}${tot.remove ? ` · remove ${tot.remove}` : ""}${waiting ? ` · <span class="st-warn">${waiting} need a card</span>` : ""}<div class="hm-note">Tap Details on a file to review its lines. Files are imported oldest first; overlapping files are not counted twice.</div>`;
}

// A card-by-month grid of the statements imported so far this year. A month counts as covered when an import recorded it, or when
// the ledger already has a statement-confirmed entry in it (imports from before coverage was recorded).
function renderCoverage() {
  const box = $("stCoverage"); if (!box) return;
  const year = new Date().getFullYear(), nowM = new Date().getMonth();
  const cov = {};
  for (const [k, ms] of Object.entries(state.stmtCoverage || {})) for (const m of Object.keys(ms || {})) (cov[k] = cov[k] || new Set()).add(m);
  for (const t of state.transactions) if (t.stmtKey || t.stmtConfirmed || t.source === "statement") { const k = familyOf(t.cardId)[0]; (cov[k] = cov[k] || new Set()).add(dayKey(t.timestamp || 0).slice(0, 7)); }
  const keys = [...new Set(ALL_MASTER_CARDS.filter(c => state.enabledCardIds.includes(c.id)).map(c => familyOf(c.id)[0]))];
  const label = k => { const first = ALL_MASTER_CARDS.find(c => c.id === k); const multi = familyOf(k).length > 1; return first ? (multi ? cardShort(first).replace(/\.[^.]*$/, "") : cardShort(first)) : k; };
  let due = 0, got = 0;
  const mo = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
  const rows = keys.map(k => {
    const cells = mo.map((_, m) => {
      const ym = `${year}-${String(m + 1).padStart(2, "0")}`;
      if (m > nowM) return `<td class="cv-future"></td>`;
      const has = cov[k] && cov[k].has(ym);
      if (m < nowM) { due++; if (has) got++; }
      return `<td class="${has ? "cv-yes" : (m === nowM ? "cv-now" : "cv-no")}" title="${ym}">${has ? "✓" : (m === nowM ? "" : "·")}</td>`;
    }).join("");
    return `<tr><th>${escapeHtml(label(k))}</th>${cells}</tr>`;
  }).join("");
  box.innerHTML = `<summary>📅 Statements imported in ${year}: ${got} of ${due} card-months</summary>
    <div class="cv-wrap"><table class="cv-table"><thead><tr><th></th>${mo.map(m => `<th>${m}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>
    <div class="hm-note">✓ = a statement for that card and month has been imported. · = still to download and import. The current month is not counted until it ends.</div>`;
}

// One-off clean-up of text saved before masking existed: finds entries whose saved bank text still holds a long number and masks it.
const TEXT_FIELDS = ["desc", "stmtDesc", "stmtRef", "stmtNote", "fx"];
export async function scrubSavedText() {
  const hits = [];
  for (const t of state.transactions) {
    const patch = {}; let n = 0;
    for (const f of TEXT_FIELDS) if (typeof t[f] === "string") { const r = maskNumbers(t[f]); if (r.masked) { patch[f] = r.text; n += r.masked; } }
    if (n) hits.push({ t, patch, n });
  }
  if (!hits.length) { alert("Nothing to mask: no saved transaction text contains a card or account number."); return; }
  const total = hits.reduce((a, h) => a + h.n, 0);
  if (!confirm(`${total} card or account number${total === 1 ? "" : "s"} found in ${hits.length} saved transaction${hits.length === 1 ? "" : "s"}. Mask ${total === 1 ? "it" : "them"} to the last 4 digits? Amounts, dates and miles are not touched.`)) return;
  let done = 0;
  try {
    for (const { t, patch } of hits) { const rec = { ...t }; delete rec.firestoreId; await saveTxToFirestore(t.id, { ...rec, ...patch }); done++; }
    alert(`Masked ${total} number${total === 1 ? "" : "s"} in ${done} transaction${done === 1 ? "" : "s"}.`);
  } catch (err) {
    console.error("Masking failed", err);
    alert(`Stopped after ${done} of ${hits.length}: ${err?.message || err}. Run it again to finish.`);
  }
}

export function openStatementSheet() {
  B.files = []; B.open = -1; S = blankFile();
  $("stFile").value = ""; $("stmtMapping").innerHTML = ""; $("stmtReview").innerHTML = ""; $("stmtFileNote").style.display = "none";
  $("btnStmtApply").disabled = true; $("btnStmtApply").textContent = "Choose a file";
  refreshUndo(); renderCoverage();
  $("stmtOverlay")?.classList.add("open");
}
export function closeStatementSheet() { $("stmtOverlay")?.classList.remove("open"); }

export function initStatementImport() {
  for (const id of ["btnOpenStatementImport", "btnOpenStatementImport2"]) {
    $(id)?.addEventListener("click", () => { $("settingsOverlay")?.classList.remove("open"); openStatementSheet(); });
  }
  $("btnCloseStatement")?.addEventListener("click", closeStatementSheet);
  $("stmtOverlay")?.addEventListener("click", e => { if (e.target.id === "stmtOverlay") closeStatementSheet(); });
  $("stFile")?.addEventListener("change", e => onFiles(e.target.files));
  $("btnStmtApply")?.addEventListener("click", applyImport);
  $("btnScrubNumbers")?.addEventListener("click", scrubSavedText);
}
