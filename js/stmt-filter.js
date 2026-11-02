// Statement view in History (v1.63.20): the entries one bank statement covers, next to what the bank says it credited.
// Opened from a check in "Check with banks" (each check's "Show these entries") or picked from History's Statement filter.
// A statement covers the entries that POSTED after the previous checkpoint and on or before its date, the way the points check
// counts them (posting date, else the transaction date). state.txView.stmt = { vk, cardId, from, to, label, bank, sure, maybe, status }.
import { state } from "./state.js";
import { ALL_MASTER_CARDS } from "./config.js";
import { reconcile, reconcileLedgers, familyIds, fmtDate, BANK_LABEL, cardName } from "./reconcile.js";
import { escapeHtml } from "./retailers.js";
import { fmtNum } from "./format.js";

const n = (x) => fmtNum(Math.round(Number(x) || 0));

// Every statement checkpoint for a vault (one list per card when the bank keeps a balance per card), newest first.
export function statementPeriods(vk, cardId = null) {
  const pick = (rows, cid) => rows.filter(r => r.rec && r.rec.kind === "statement").map(r => ({
    vk, cardId: cid, from: r.from, to: r.to, bank: r.periodBank, sure: r.periodSure, maybe: r.periodMaybe, status: r.status,
    label: `${BANK_LABEL[r.rec.bank] || ""} statement ${fmtDate(r.from + 86400000)} – ${fmtDate(r.to)}${cid ? ` · ${cardName(cid)}` : ""}`
  }));
  const led = reconcileLedgers(vk);
  if (led.length) return led.filter(l => l.cardId && (!cardId || familyIds(cardId).includes(l.cardId))).flatMap(l => pick(l.rows, l.cardId));
  return cardId ? pick(reconcile(vk, cardId), cardId) : pick(reconcile(vk), null);
}

// The vault the History card filter points at, if all the chosen cards share one (else null: no Statement list).
export function vaultOfCardFilter(cards) {
  const vks = [...new Set((cards || []).map(id => (ALL_MASTER_CARDS.find(c => c.id === id) || {}).vaultKey).filter(Boolean))];
  return vks.length === 1 ? vks[0] : null;
}

const cardsOf = (s) => s.cardId ? familyIds(s.cardId) : ALL_MASTER_CARDS.filter(c => c.vaultKey === s.vk).map(c => c.id);
export function passesStmt(tx, s) {
  if (!s) return true;
  if (!cardsOf(s).includes(tx.cardId)) return false;
  const d = Number(tx.postTs) || Number(tx.timestamp) || 0;
  return d > s.from && d <= s.to;
}

// Line above the list: the bank's figure for that statement against what the app expects from these entries.
export function stmtBannerHtml(s, rows) {
  if (!s) return "";
  const spent = rows.reduce((a, t) => a + (Number(t.amt) || 0), 0), miles = rows.reduce((a, t) => a + (Number(t.miles) || 0), 0);
  const gap = s.status === "baseline" ? 0 : (Number(s.bank) || 0) - (Number(s.sure) || 0) - (Number(s.maybe) || 0);
  return `<div class="stmt-banner">
    <div><b>📄 ${escapeHtml(s.label)}</b> <button type="button" class="stmt-x" data-stmt-clear title="Show all entries again">✕</button></div>
    <div class="hm-note">${s.status === "baseline" ? `Bank credited <b>${n(s.bank)}</b> points · your earliest statement, the starting point: not checked, because it includes the bonus for the month before your first entries` : `Bank credited <b>${n(s.bank)}</b> points · the app expects <b>${n(s.sure)}</b>${s.maybe ? ` + up to ${n(s.maybe)}` : ""}`}${gap > 5 ? ` · <span class="st-warn">${n(gap)} the app can't explain: look for Base entries the bank paid a bonus on</span>` : ""}</div>
    <div class="hm-note">Entries that posted in this statement: ${rows.length} · S$${fmtNum(spent, 2)} · ${n(miles)} mi (by posting date, the way the bank counts them)</div>
  </div>`;
}

// From a check: open History on that card and statement.
export async function openStatementView(s) {
  const { switchTab, renderTransactions } = await import("./ui.js");
  Object.assign(state.txView, { merchant: "", cats: [], rate: "", amtMin: "", amtMax: "", transFrom: "", transTo: "", postFrom: "", postTo: "" });
  state.txView.cards = cardsOf(s);
  state.txView.stmt = s;
  if (!document.body.classList.contains("show-history")) switchTab("history");
  renderTransactions();
  document.getElementById("txList")?.scrollIntoView({ block: "start" });
}
