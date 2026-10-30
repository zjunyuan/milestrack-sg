// Points check sheet (v1.59.0): opened from the Vault (a tile, or "Check points with the banks"). Shows, per currency, each statement /
// balance checkpoint against what the app expected, the entries most likely to have missed a bonus, the big entries to look up in a
// bank app, and forms to log a balance you looked up or a transfer / redemption. The maths is in reconcile.js.
import { state } from "./state.js";
import { DEFAULT_VAULT } from "./config.js";
import { escapeHtml } from "./retailers.js";
import { fmtNum } from "./format.js";
import { mergeSettingsDoc } from "./firebase.js";
import { reconcile, suspects, bigChecks, checkedShort, balanceFromBank, checkpointsFor, outflowsFor, saveBalance, saveOutflow, deleteOutflow,
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
  const r = reconcile(vk)[0];
  if (!r || r.status === "baseline") return { cls: "pc-wait", text: "Bank balance noted" };
  const [label, cls] = STATUS[r.status];
  return { cls, text: `${label}${r.status === "short" || r.status === "over" ? ` ${n(r.gap)}` : ""} · ${fmtDate(r.to)}` };
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
    ${formsHtml(current, unit)}
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
    ${Math.abs(diff) > 0 ? `<button type="button" class="btn-backup" id="ptsUseBank">Use the bank's figure (${n(b.points)})</button>` : ""}
  </div>`;
}

function rowHtml(r, unit, withSuspects = true) {
  const rec = r.rec, [label, cls] = STATUS[r.status];
  const src = rec.kind === "statement" ? `${BANK_LABEL[rec.bank] || ""} statement` : "Balance you added";
  if (r.baseline) return `<div class="pc-cp"><div class="pc-head"><b>${fmtDate(r.to)}</b> · ${escapeHtml(src)} <span class="pc-chip ${cls}">${label}</span></div><div class="hm-note">Balance ${n(rec.closing)} ${escapeHtml(unit)}. The next balance you add is checked against this one.</div></div>`;
  const extra = (rec.items || []).length ? `<div class="hm-note">${rec.items.map(i => `${escapeHtml(i.what)} ${i.pts > 0 ? "+" : "−"}${n(Math.abs(i.pts))}`).join(" · ")}${rec.bank === "uob" && rec.items.some(i => i.pts > 0) ? " (added back, not counted as earned)" : ""}</div>` : "";
  const chain = r.chainGap ? `<div class="hm-note st-warn">Opening balance ${n(rec.opening)} is ${r.chainGap > 0 ? "more" : "less"} than the last closing balance by ${n(Math.abs(r.chainGap))}: a statement may be missing in between, or the bank adjusted something.</div>` : "";
  const unver = rec.verified === false ? `<div class="hm-note st-warn">Read by text recognition and the figures don't add up, so a number may be misread. Check it against the statement.</div>` : "";
  const sus = withSuspects && r.status === "short" ? suspectHtml(r) : "";
  const why = r.status === "over" ? `<div class="hm-note">Usually spend that isn't logged in the app, a bonus for a month before your first entries, or a promotion.</div>`
    : r.status === "pending" ? `<div class="hm-note">Up to ${n(r.due)} more is due (a bonus the bank credits after the cycle ends). Checked again at the next statement.</div>`
    : r.maybe ? `<div class="hm-note">Includes a bonus the bank paid within its window.</div>` : "";
  return `<div class="pc-cp">
    <div class="pc-head"><b>${fmtDate(r.to)}</b> · ${escapeHtml(src)} <span class="pc-chip ${cls}">${label}${r.status === "short" || r.status === "over" ? ` ${n(r.gap)}` : ""}</span></div>
    <div class="pc-nums"><span>This period: bank <b>${n(r.periodBank)}</b></span><span>expected <b>${n(r.periodSure)}</b>${r.periodMaybe ? ` + up to ${n(r.periodMaybe)}` : ""}</span></div>
    <div class="pc-nums hm-note"><span>Since ${fmtDate(r.start)}: bank ${n(r.bank)}</span><span>expected ${n(r.sure)}${r.maybe ? ` + up to ${n(r.maybe)}` : ""}</span><span>allowance ±${n(r.tol)}</span></div>
    ${extra}${chain}${unver}${why}${sus}
  </div>`;
}
function rowsHtml(vk, unit) {
  const rows = reconcile(vk);
  if (!rows.length) return "";
  return `<div class="pc-sec"><b>Statements and balances</b>${rows.slice(0, 12).map(r => rowHtml(r, unit)).join("")}</div>`;
}
// Banks that print each card's points (DBS, OCBC): the same check per card, so a shortfall points at one card.
function cardRowsHtml(vk, unit) {
  const ids = new Set();
  for (const r of checkpointsFor(vk)) for (const c of r.byCard || []) if (c.cardId) ids.add(c.cardId);
  if (ids.size < 2) return "";
  return `<details class="pc-sec" data-sec="cards"><summary>By card</summary>${[...ids].map(id => {
    const r = reconcile(vk, id)[0];
    return r ? `<div class="pc-cardrow"><b>${escapeHtml(cardName(id))}</b>${rowHtml(r, unit)}</div>` : "";
  }).join("")}</details>`;
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
  for (const ev of ["points-updated", "txns-updated", "vault-updated", "settings-updated"]) window.addEventListener(ev, render);
}
