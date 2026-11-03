// Points check sheet (v1.59.0): opened from the Vault (a tile, or "Check points with the banks"). Shows, per currency, each statement /
// balance checkpoint against what the app expected, the entries most likely to have missed a bonus, the big entries to look up in a
// bank app, and forms to log a balance you looked up or a transfer / redemption. The maths is in reconcile.js.
import { state } from "./state.js";
import { DEFAULT_VAULT, ALL_MASTER_CARDS } from "./config.js";
import { escapeHtml } from "./retailers.js";
import { fmtNum } from "./format.js";
import { mergeSettingsDoc } from "./firebase.js";
import { bankHowtoHtml } from "./bank-howto.js";
import { MONTHLY_BONUS } from "./config.js";
import { monthlyRows, monthLabel, monthIso } from "./monthly-bonus.js";
import { statementPeriods } from "./stmt-filter.js";
import { reconcile, reconcileLedgers, ledgersOf, worstRow, suspects, bigChecks, checkedShort, balanceFromBank, checkpointsFor, outflowsFor, saveBalance, saveOutflow, deleteOutflow,
  setVaultFromBank, saveBankCheck, currencyName, unitName, cardName, fmtDate, BANK_LABEL } from "./reconcile.js";

const $ = (id) => document.getElementById(id);
let current = "";
const STATUS = {
  ok: ["✓ Matches", "pc-ok"], pending: ["⏳ Bonus still due", "pc-wait"], short: ["⚠️ Short", "pc-bad"], over: ["➕ More than expected", "pc-over"], baseline: ["Starting balance", "pc-wait"]
};
const n = (x) => fmtNum(Math.round(Number(x) || 0));
const todayStr = () => new Date().toLocaleDateString("en-CA");
const parseDay = (s) => { const d = new Date(`${s}T12:00:00`); return isNaN(d) ? null : d.getTime(); };

// Short status for a Vault tile: { cls, text } or null when the currency has no checkpoint.
export function tileStatus(vk) {
  if (!checkpointsFor(vk).length) return null;
  const r = worstRow(vk);
  if (!r || r.status === "baseline") return { cls: "pc-wait", text: "Bank balance noted" };
  // A small surplus is not worth flagging on the tile (v1.63.39): under 500 miles, or under 2% of the bank's balance, shows as
  // "About right". The Check with banks sheet still shows the exact figure.
  if (r.status === "over") {
    const ratio = Number((state.myVault && state.myVault[vk] && state.myVault[vk].ratio) || (DEFAULT_VAULT[vk] || {}).ratio || 1);
    const bal = Number(r.rec.closing) || 0;
    if (r.gap * ratio < 500 || (bal > 0 && r.gap < bal * 0.02)) return { cls: "pc-ok", text: `✓ About right · ${fmtDate(r.rec.ts)}` };
  }
  const [label, cls] = STATUS[r.status];
  return { cls, text: `${label}${r.status === "short" || r.status === "over" ? ` ${n(r.gap)}` : ""} · ${fmtDate(r.rec.ts)}` };
}

const currencies = () => {
  const keys = Object.keys(state.myVault || DEFAULT_VAULT).filter(k => k !== "kf_direct");
  const has = (k) => checkpointsFor(k).length || outflowsFor(k).length;
  return keys.sort((a, b) => (has(b) ? 1 : 0) - (has(a) ? 1 : 0));
};

export function openPointsCheck(vk) {
  current = vk && vk !== "kf_direct" ? vk : (current || currencies()[0]);
  $("ptsOverlay")?.classList.add("open");
  render();
}
export function closePointsCheck() { $("ptsOverlay")?.classList.remove("open"); }

function render() {
  const box = $("ptsBody"); if (!box || !$("ptsOverlay")?.classList.contains("open")) return;
  // Data can change while the sheet is open (a save, a sync): keep open sections, typed values and focus across the re-render.
  const open = new Set([...box.querySelectorAll("details[data-sec]")].map(d => d.open ? d.dataset.sec : null).filter(Boolean));
  const vals = {}; box.querySelectorAll("input[id], select[id]").forEach(i => { if (i.id !== "ptsCur" && i.id !== "ptsBig") vals[i.id] = i.value; });
  const bigVals = {}; box.querySelectorAll(".pc-big").forEach(el => { const v = el.querySelector(".pc-bigin")?.value; if (v) bigVals[el.dataset.id] = v; });
  const focus = document.activeElement && box.contains(document.activeElement) ? document.activeElement.id : "";
  const hadBox = !!box.firstChild;
  const unit = unitName(current);
  const opts = currencies().map(k => `<option value="${k}" ${k === current ? "selected" : ""}>${escapeHtml(currencyName(k))}${checkpointsFor(k).length ? "" : " (no statement yet)"}</option>`).join("");
  box.innerHTML = `${bigHtml()}
    <label class="st-col"><span>Currency</span><select class="form-control" id="ptsCur">${opts}</select></label>
    ${balanceHtml(current, unit)}
    ${rowsHtml(current, unit)}
    ${cardRowsHtml(current, unit)}
    ${monthlyHtml(current, unit)}
    ${formsHtml(current, unit)}
    ${bankHowtoHtml((ALL_MASTER_CARDS.find(c => c.vaultKey === current) || {}).bank || "")}
    <label class="hm-note pc-thr">Put entries of S$ <input type="number" id="ptsBig" class="form-control" min="1" step="1" value="${Number(state.bigCheck) || 250}"> and more on the "check in the bank app" list (DBS, UOB PPV and HSBC show points per transaction).</label>`;
  if (hadBox) {
    box.querySelectorAll("details[data-sec]").forEach(d => { if (open.has(d.dataset.sec)) d.open = true; });
    for (const [id, v] of Object.entries(vals)) { const el = $(id); if (el && v !== "" && !el.dataset.fresh) el.value = v; }
    box.querySelectorAll(".pc-big").forEach(el => { if (bigVals[el.dataset.id]) el.querySelector(".pc-bigin").value = bigVals[el.dataset.id]; });
    if (focus && $(focus)) $(focus).focus();
  }
  wire(box);
}
// After a successful save the form starts empty again.
function clearForm(ids) { for (const id of ids) { const el = $(id); if (el) { el.value = ""; el.dataset.fresh = ""; } } }

function bigHtml() {
  const todo = bigChecks(), bad = checkedShort();
  if (!todo.length && !bad.length) return "";
  const item = (b) => `<div class="pc-big" data-id="${escapeHtml(b.tx.firestoreId || b.tx.id)}">
      <div><b>${escapeHtml(String(b.tx.desc || "").slice(0, 40))}</b> · S$${fmtNum(Number(b.tx.amt) || 0, 2)} · ${escapeHtml(cardName(b.card.id))} · ${fmtDate(b.tx.timestamp)}</div>
      <div class="hm-note">The app should show <b>${n(b.expect)} ${escapeHtml(unitName(b.card.vaultKey))}</b>${b.note ? ` (${escapeHtml(b.note)})` : ""}.</div>
      <div class="pc-row"><input type="number" class="form-control pc-bigin" placeholder="Points the bank shows" min="0"><button type="button" class="btn-backup pc-bigsave">Save</button><button type="button" class="btn-backup pc-bigok" data-v="${b.expect}">✓ Matches</button></div>
    </div>`;
  return `<details class="pc-sec" open><summary>📱 Check in the bank app (${todo.length})</summary>
    ${todo.slice(0, 12).map(item).join("")}${todo.length > 12 ? `<div class="hm-note">and ${todo.length - 12} more.</div>` : ""}
    ${bad.length ? `<div class="pc-bad-list"><b>⚠️ Checked and short:</b>${bad.map(b => `<div>${escapeHtml(String(b.tx.desc || "").slice(0, 32))} S$${fmtNum(Number(b.tx.amt) || 0, 2)} · bank ${n(b.got)} vs ${n(b.expect)} expected · ${escapeHtml(cardName(b.card.id))}</div>`).join("")}<div class="hm-note">Ask the bank to check these, or fix the entry's category if it really earns base only.</div></div>` : ""}
  </details>`;
}

function balanceHtml(vk, unit) {
  const b = balanceFromBank(vk), have = Number(state.myVault?.[vk]?.points) || 0;
  if (!b) return `<div class="hm-note">No statement or balance for ${escapeHtml(currencyName(vk))} yet. Import a statement (its points summary is read automatically: DBS, OCBC, Maybank, UOB, HSBC via the script), or add a balance you looked up below.</div>`;
  const diff = b.points - have;
  return `<div class="pc-bal">
    <div>Bank balance on ${fmtDate(b.asOf)}: <b>${n(b.bank)} ${escapeHtml(unit)}</b>${b.since ? ` · expected since: +${n(b.since)}` : ""}${b.out ? ` · moved out since: −${n(b.out)}` : ""}</div>
    <div>Vault now: <b>${n(have)}</b>${Math.abs(diff) > 0 ? ` · from the bank: <b>${n(b.points)}</b> (${diff > 0 ? "+" : "−"}${n(Math.abs(diff))})` : " · same as the bank"}</div>
    ${b.partial ? `<div class="hm-note st-warn">This bank keeps a separate balance for each card, and ${b.missing && b.missing.length ? b.missing.map(id => escapeHtml(cardName(id))).join(", ") : "a card"} has no statement yet, so the total can't be compared. Import its statement first.</div>`
      : Math.abs(diff) > 0 ? `<button type="button" class="btn-backup" id="ptsUseBank">Use the bank's figure (${n(b.points)})</button>` : ""}
  </div>`;
}

function rowHtml(r, unit, withSuspects = true, ctx = null) {
  const rec = r.rec, [label, cls] = STATUS[r.status];
  const src = rec.kind === "statement" ? `${BANK_LABEL[rec.bank] || ""} statement` : "Balance you added";
  const link = (ctx && rec.kind === "statement" ? `<button type="button" class="pc-link" data-stmt-vk="${escapeHtml(ctx.vk)}" data-stmt-card="${escapeHtml(ctx.cardId || "")}" data-stmt-to="${r.to}">Show these entries →</button>` : "")
    + (rec.kind === "statement" ? ` <button type="button" class="pc-link dim" data-pts-del="${escapeHtml(rec.id)}">Delete</button>` : "");
  if (r.baseline) return `<div class="pc-cp"><div class="pc-head"><b>${fmtDate(r.rec.ts)}</b> · ${escapeHtml(src)} <span class="pc-chip ${cls}">${label}</span></div><div class="hm-note">${rec.kind === "statement"
    ? `Your earliest statement, so it is the starting point and not checked: it includes the bonus for spend before your first entries. Balance ${n(rec.closing)} ${escapeHtml(unit)}; later statements are checked from here.`
    : `Balance ${n(rec.closing)} ${escapeHtml(unit)}. The next balance you add is checked against this one.`}</div>${link}</div>`;
  const extra = (rec.items || []).length ? `<div class="hm-note">${rec.items.map(i => `${escapeHtml(i.what)} ${i.pts > 0 ? "+" : "−"}${n(Math.abs(i.pts))}`).join(" · ")}${rec.bank === "uob" && rec.items.some(i => i.pts > 0) ? " (added back, not counted as earned)" : ""}</div>` : "";
  const chain = r.chainGap ? `<div class="hm-note st-warn">Opening balance ${n(rec.opening)} is ${r.chainGap > 0 ? "more" : "less"} than the last closing balance by ${n(Math.abs(r.chainGap))}: a statement may be missing in between, or the bank adjusted something.</div>` : "";
  const unver = rec.verified === false ? `<div class="hm-note st-warn">Read by text recognition and the figures don't add up, so a number may be misread. Check it against the statement.</div>` : "";
  const sus = withSuspects && r.status === "short" ? suspectHtml(r) : "";
  const why = r.status === "over" ? `<div class="hm-note">Usually spend that isn't logged in the app, a bonus for a month before your first entries, or a promotion.</div>`
    : r.status === "pending" ? `<div class="hm-note">Up to ${n(r.due)} more is due (a bonus the bank credits after the cycle ends). Checked again at the next statement.</div>`
    : r.maybe ? `<div class="hm-note">Includes a bonus the bank paid within its window.</div>` : "";
  return `<div class="pc-cp">
    <div class="pc-head"><b>${fmtDate(r.rec.ts)}</b> · ${escapeHtml(src)} <span class="pc-chip ${cls}">${label}${r.status === "short" || r.status === "over" ? ` ${n(r.gap)}` : ""}</span></div>
    <div class="pc-nums"><span>This period: bank <b>${n(r.periodBank)}</b></span><span>expected <b>${n(r.periodSure)}</b>${r.periodMaybe ? ` + up to ${n(r.periodMaybe)}` : ""}</span></div>
    <div class="pc-nums hm-note"><span>Since ${fmtDate(r.start)}: bank ${n(r.bank)}</span><span>expected ${n(r.sure)}${r.maybe ? ` + up to ${n(r.maybe)}` : ""}</span><span>allowance ±${n(r.tol)}</span></div>
    ${extra}${chain}${unver}${why}${sus}
    ${link}
  </div>`;
}
function rowsHtml(vk, unit) {
  const led = reconcileLedgers(vk);
  if (led.length) {                                               // this bank keeps a balance for each card: one check per card
    return `<div class="pc-sec"><b>Statements, card by card</b>${led.map(l => `<div class="pc-cardrow"><b>${escapeHtml(l.cardId ? cardName(l.cardId) : "Card ending " + l.ledger)}</b>${
      l.rows.length ? l.rows.slice(0, 12).map(r => rowHtml(r, unit, true, { vk, cardId: l.cardId })).join("") : `<div class="hm-note">${l.cardId ? "No check yet." : "Import this statement once with the card chosen so it can be matched to your entries."}</div>`}</div>`).join("")}</div>`;
  }
  const rows = reconcile(vk);
  if (!rows.length) return "";
  return `<div class="pc-sec"><b>Statements and balances</b>${rows.slice(0, 12).map(r => rowHtml(r, unit, true, { vk, cardId: null })).join("")}</div>`;
}
// Banks that print each card's points (DBS, OCBC): the same check per card, so a shortfall points at one card.
function cardRowsHtml(vk, unit) {
  if (Object.keys(ledgersOf(vk)).length) return "";
  const ids = new Set();
  for (const r of checkpointsFor(vk)) for (const c of r.byCard || []) if (c.cardId) ids.add(c.cardId);
  if (ids.size < 2) return "";
  return `<details class="pc-sec" data-sec="cards"><summary>By card</summary>${[...ids].map(id => {
    const r = reconcile(vk, id)[0];
    return r ? `<div class="pc-cardrow"><b>${escapeHtml(cardName(id))}</b>${rowHtml(r, unit, true, { vk, cardId: id })}</div>` : "";
  }).join("")}</details>`;
}
// Bonus by month (v1.63.49): cards whose bank pays a calendar month's bonus on the next statement (MONTHLY_BONUS), one row per month,
// so a month whose bonus fell short shows on one screen instead of across two statements.
const MB_STATUS = { ok: ["✓", "pc-ok"], short: ["⚠️ Short", "pc-bad"], over: ["➕ More", "pc-over"], due: ["⏳ Not paid yet", "pc-wait"], first: ["Earliest statement", "pc-wait"], gap: ["Statement missing", "pc-wait"] };
function monthlyHtml(vk, unit) {
  const ids = Object.keys(MONTHLY_BONUS).filter(id => (ALL_MASTER_CARDS.find(c => c.id === id) || {}).vaultKey === vk);
  const blocks = ids.map(id => {
    const wide = MONTHLY_BONUS[id].vaultWide;
    const perCard = wide || (state.pointsLog || []).some(r => r.kind === "statement" && (r.byCard || []).some(c => c.cardId === id));
    if (!perCard) return "";
    const rows = monthlyRows(id, statementPeriods(vk, wide ? null : id));
    if (!rows.length) return "";
    const tr = (r) => {
      const [label, cls] = MB_STATUS[r.status];
      const name = r.months.map(m => monthLabel(m.key)).join(" + ");
      const spend = r.months.reduce((a, m) => a + m.spend, 0), capped = r.months.some(m => m.spend > m.capped);
      const tierTxt = MONTHLY_BONUS[id].kind === "fcyTier" ? ` <span class="dim">(${r.months.map(m => `${m.mult}X on S$${fmtNum(m.fcy, 2)} foreign`).join(", ")})</span>` : "";
      const paid = r.period ? (r.baseMaybe ? `${n(r.paidLo)}–${n(r.paidHi)}` : n(r.paidHi)) : "—";
      const chip = `<span class="pc-chip ${cls}">${label}${r.status === "short" || r.status === "over" ? ` ${n(Math.abs(r.diff))}` : ""}</span>`;
      const links = `<button type="button" class="pc-link" data-mb-card="${escapeHtml(id)}" data-mb-month="${monthIso(r.months[0].key)}">Entries →</button>`
        + (r.period ? ` <button type="button" class="pc-link" data-stmt-vk="${escapeHtml(vk)}" data-stmt-card="${wide ? "" : escapeHtml(id)}" data-stmt-to="${r.period.to}">Statement →</button>` : "");
      return `<tr><td>${escapeHtml(name)}</td><td class="num">S$${fmtNum(spend, 2)}${capped ? ` <span class="dim">(cap)</span>` : ""}${tierTxt}</td><td class="num">${n(r.expected)}</td><td>${r.period ? fmtDate(r.period.recDate) : "—"}</td><td class="num">${paid}</td><td>${chip}</td><td>${links}</td></tr>`;
    };
    return `<div class="pc-cardrow"><b>${escapeHtml(cardName(id))}</b>
      <div class="stmt-scroll"><table class="stmt-tbl pc-mb"><thead><tr><th>Month</th><th class="num">Bonus spend</th><th class="num">Expected</th><th>Paid on</th><th class="num">Paid</th><th></th><th></th></tr></thead><tbody>${rows.slice(0, 12).map(tr).join("")}</tbody></table></div>
      <div class="hm-note">${escapeHtml(MONTHLY_BONUS[id].source)}: ${MONTHLY_BONUS[id].kind === "fcyTier" ? `1X when each line posts; the foreign-spend tier (${MONTHLY_BONUS[id].steps.map(st => `${st.mult}X from S$${fmtNum(st.at)}`).join(", ")} of retail spend in the month) is paid on that month's foreign lines on the next statement.` : `${MONTHLY_BONUS[id].rate} ${escapeHtml(unit)} per S$${MONTHLY_BONUS[id].per} on the month's bonus spend (by transaction date), the first S$${fmtNum(MONTHLY_BONUS[id].cap)}, paid on the next statement.`} Paid = what the bank credited less the base for that statement's own lines (a range when lines post near the cut-off). Open the statement on a short month to see which entries would explain it.</div></div>`;
  }).filter(Boolean);
  return blocks.length ? `<details class="pc-sec" data-sec="monthly" open><summary>📅 Bonus by month</summary>${blocks.join("")}</details>` : "";
}
function suspectHtml(r) {
  const list = suspects(r);
  if (!list.length) return `<div class="hm-note">No single entry explains the gap. Check that every transaction in the period is logged (import the statement), and ask the bank for a breakdown if it persists.</div>`;
  return `<div class="pc-sus"><b>Most likely to have missed the bonus:</b>${list.map(s => `<div class="pc-susrow"><div>${escapeHtml(String(s.tx.desc || "").slice(0, 36))} · S$${fmtNum(Number(s.tx.amt) || 0, 2)} · ${escapeHtml(cardName(s.card.id))} · ${fmtDate(s.tx.timestamp)} · bonus ${n(s.bonus)}</div><div class="hm-note">${s.why.map(escapeHtml).join("; ")}</div></div>`).join("")}
    <div class="hm-note">If one of these really earned base only, edit it (Rate to use: Base) and correct the merchant's category so the recommender learns.</div></div>`;
}

function formsHtml(vk, unit) {
  const outs = outflowsFor(vk).slice(-8).reverse();
  return `<details class="pc-sec" data-sec="bal"><summary>➕ Add a balance you looked up</summary>
      <div class="pc-row"><input type="date" class="form-control" id="ptsBalDate" value="${todayStr()}"><input type="number" class="form-control" id="ptsBalPts" placeholder="Balance in ${escapeHtml(unit)}" min="0"></div>
      <input type="text" class="form-control" id="ptsBalNote" placeholder="Where you saw it (optional)" maxlength="100">
      <button type="button" class="btn-backup" id="ptsBalSave">Save balance</button>
      <div class="hm-note">For banks whose statement has no points summary you can read (Citi, Trust, yuu), or a check between statements.</div>
    </details>
    <details class="pc-sec" data-sec="out"><summary>✈ Log a transfer or redemption</summary>
      <div class="pc-row"><select class="form-control" id="ptsOutWhat"><option value="transfer">Transfer to KrisFlyer</option><option value="redeem">Redemption (vouchers, fee waiver…)</option><option value="other">Other / expired</option></select><input type="date" class="form-control" id="ptsOutDate" value="${todayStr()}"></div>
      <div class="pc-row"><input type="number" class="form-control" id="ptsOutPts" placeholder="${escapeHtml(unit)} used" min="1"><input type="number" class="form-control" id="ptsOutMiles" placeholder="KrisFlyer miles received" min="0"></div>
      <input type="text" class="form-control" id="ptsOutNote" placeholder="Note (optional)" maxlength="100">
      <button type="button" class="btn-backup" id="ptsOutSave">Log it</button>
      <div class="hm-note">Takes the points off this tile now (and adds the miles to KrisFlyer). DBS, OCBC, Maybank, UOB and HSBC statements print redemptions too, so their check uses the statement's own figure.</div>
      ${outs.length ? `<div class="pc-outs">${outs.map(o => `<div class="pc-row"><span>${fmtDate(o.ts)} · ${o.what === "transfer" ? "Transfer" : o.what === "redeem" ? "Redemption" : "Other"} −${n(o.pts)}${o.miles ? ` → ${n(o.miles)} mi` : ""}${o.note ? ` · ${escapeHtml(o.note)}` : ""}</span><button type="button" class="btn-backup pc-outdel" data-id="${escapeHtml(o.id)}">Undo</button></div>`).join("")}</div>` : ""}
    </details>`;
}

function wire(box) {
  $("ptsCur")?.addEventListener("change", (e) => { current = e.target.value; render(); });
  $("ptsBig")?.addEventListener("change", async (e) => {
    const v = Math.max(1, Math.round(Number(e.target.value) || 250));
    state.bigCheck = v;
    try { await mergeSettingsDoc(state.myVaultKey, { bigCheck: v }); } catch (err) { console.error(err); }
    render();
  });
  $("ptsUseBank")?.addEventListener("click", async (e) => {
    e.target.disabled = true;
    try { await setVaultFromBank(current); } catch (err) { alert("Could not update the Vault: " + err.message); }
    render();
  });
  $("ptsBalSave")?.addEventListener("click", async () => {
    const ts = parseDay($("ptsBalDate").value), pts = Number($("ptsBalPts").value);
    if (!ts || !(pts >= 0) || $("ptsBalPts").value === "") return alert("Enter the date and the balance.");
    const note = $("ptsBalNote").value; clearForm(["ptsBalPts", "ptsBalNote"]);
    try { await saveBalance(current, ts, pts, note); } catch (err) { alert("Could not save: " + err.message); }
  });
  $("ptsOutSave")?.addEventListener("click", async () => {
    const ts = parseDay($("ptsOutDate").value), pts = Number($("ptsOutPts").value), what = $("ptsOutWhat").value, miles = Number($("ptsOutMiles").value) || 0;
    if (!ts || !(pts > 0)) return alert("Enter the date and the points used.");
    const note = $("ptsOutNote").value; clearForm(["ptsOutPts", "ptsOutMiles", "ptsOutNote"]);
    try { await saveOutflow(current, ts, pts, what, miles, note); } catch (err) { alert("Could not log it: " + err.message); }
  });
  box.querySelectorAll(".pc-outdel").forEach(b => b.addEventListener("click", async () => {
    const rec = (state.pointsLog || []).find(r => r.id === b.dataset.id); if (!rec) return;
    b.disabled = true;
    try { await deleteOutflow(rec); } catch (err) { alert("Could not undo: " + err.message); }
  }));
  box.querySelectorAll(".pc-big").forEach(el => {
    const tx = (state.transactions || []).find(t => (t.firestoreId || t.id) === el.dataset.id); if (!tx) return;
    const save = async (v) => { if (!(v >= 0)) return alert("Enter the points the bank shows for this transaction."); try { await saveBankCheck(tx, v); } catch (err) { alert("Could not save: " + err.message); } };
    el.querySelector(".pc-bigsave").addEventListener("click", () => { const i = el.querySelector(".pc-bigin"); save(i.value === "" ? NaN : Number(i.value)); });
    el.querySelector(".pc-bigok").addEventListener("click", (e) => save(Number(e.target.dataset.v)));
  });
}

export function initPointsCheck() {
  $("btnClosePts")?.addEventListener("click", closePointsCheck);
  $("ptsOverlay")?.addEventListener("click", (e) => { if (e.target.id === "ptsOverlay") closePointsCheck(); });
  // "Show these entries" on a statement check: History filtered to that card and statement (v1.63.20).
  // Capture phase: the sheet stops click bubbling (onclick="event.stopPropagation()"), so a bubbling listener never hears it.
  document.addEventListener("click", async (e) => {
    const del = e.target.closest && e.target.closest("#ptsOverlay [data-pts-del]");
    if (del) { const { deleteStatementRecord } = await import("./ui.js"); await deleteStatementRecord(del.dataset.ptsDel); render(); return; }
    const mb = e.target.closest && e.target.closest("#ptsOverlay [data-mb-month]");
    if (mb) {
      // A month's entries: History on that card and calendar month.
      const { switchTab, renderTransactions, renderArchiveData } = await import("./ui.js");
      const { familyIds } = await import("./reconcile.js");
      Object.assign(state.txView, { merchant: "", cats: [], rate: "", stmt: null, amtMin: "", amtMax: "", transFrom: "", transTo: "", postFrom: "", postTo: "" });
      state.txView.cards = familyIds(mb.dataset.mbCard);
      closePointsCheck();
      if (!document.body.classList.contains("show-history")) switchTab("history");
      const sel = document.getElementById("archiveMonthSelect");
      if (sel) { if (![...sel.options].some(o => o.value === mb.dataset.mbMonth)) sel.add(new Option(mb.dataset.mbMonth, mb.dataset.mbMonth)); sel.value = mb.dataset.mbMonth; }
      renderArchiveData();
      renderTransactions();
      document.getElementById("txList")?.scrollIntoView({ block: "start" });
      return;
    }
    const b = e.target.closest && e.target.closest("#ptsOverlay [data-stmt-to]"); if (!b) return;
    const { statementPeriods, openStatementView } = await import("./stmt-filter.js");
    const p = statementPeriods(b.dataset.stmtVk, b.dataset.stmtCard || null).find(x => String(x.to) === b.dataset.stmtTo);
    if (!p) return;
    closePointsCheck();
    openStatementView(p);
  }, true);
  for (const ev of ["points-updated", "txns-updated", "vault-updated", "settings-updated"]) window.addEventListener(ev, render);
}
