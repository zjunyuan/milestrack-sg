// Statement view in History (v1.63.20): the entries one bank statement covers, next to what the bank says it credited.
// Opened from a check in "Check with banks" (each check's "Show these entries") or picked from History's Statement filter.
// A statement covers the entries that POSTED after the previous checkpoint and on or before its date, the way the points check
// counts them (posting date, else the transaction date). state.txView.stmt = { vk, cardId, from, to, label, bank, sure, maybe, status }.
import { state } from "./state.js";
import { ALL_MASTER_CARDS, DEFAULT_VAULT } from "./config.js";
import { reconcile, reconcileLedgers, familyIds, fmtDate, BANK_LABEL, cardName, expectedCredits } from "./reconcile.js";
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

// Box above the list (v1.63.22): everything in POINTS (the bank's unit), with miles beside it, split into what the bank credited,
// what the app is sure of, the bonus that could land in this statement, and the gap. Base points post with each entry; a bonus the bank
// credits after the cycle (HSBC: on the next statement) falls in a window, so it counts as "could land here" until it is past.
export function stmtBannerHtml(s, rows) {
  if (!s) return "";
  const unit = (DEFAULT_VAULT[s.vk] || {}).unit || "pts";
  const ratio = Number((state.myVault && state.myVault[s.vk] && state.myVault[s.vk].ratio) || (DEFAULT_VAULT[s.vk] || {}).ratio || 1);
  const mi = (p) => fmtNum(Math.round((Number(p) || 0) * ratio));
  const credits = expectedCredits(s.vk, cardsOf(s));
  const inside = (c) => c.lo > s.from && c.hi <= s.to, overlaps = (c) => c.hi > s.from && c.lo <= s.to && !inside(c);
  const postedHere = (c) => { const d = Number(c.tx.postTs) || Number(c.tx.timestamp) || 0; return d > s.from && d <= s.to; };
  const add = (list) => list.reduce((a, c) => a + c.pts, 0);
  const sureBase = add(credits.filter(c => inside(c) && c.kind !== "bonus")), sureBonus = add(credits.filter(c => inside(c) && c.kind === "bonus"));
  const maybeEarlier = add(credits.filter(c => overlaps(c) && c.kind === "bonus" && !postedHere(c)));
  const maybeThese = add(credits.filter(c => overlaps(c) && c.kind === "bonus" && postedHere(c)));
  const maybeOther = add(credits.filter(c => overlaps(c) && c.kind !== "bonus"));
  const sure = sureBase + sureBonus, maybe = maybeEarlier + maybeThese + maybeOther, bank = Number(s.bank) || 0;
  const spent = rows.reduce((a, t) => a + (Number(t.amt) || 0), 0), miles = rows.reduce((a, t) => a + (Number(t.miles) || 0), 0);
  const row = (label, p, cls = "") => `<tr class="${cls}"><td>${label}</td><td class="num">${n(p)}</td><td class="num dim">${mi(p)}</td></tr>`;
  let verdict;
  if (s.status === "baseline") verdict = `<div class="hm-note">Your earliest statement, so it is the starting point and not checked: it includes the bonus for spend before your first entries.</div>`;
  else if (bank < sure - 5) verdict = `<div class="stmt-verdict bad">⚠️ Short: the bank credited ${n(sure - bank)} ${escapeHtml(unit)} (≈ ${mi(sure - bank)} mi) less than the app is sure of.</div>`;
  else if (bank > sure + maybe + 5) verdict = `<div class="stmt-verdict over">➕ ${n(bank - sure - maybe)} ${escapeHtml(unit)} (≈ ${mi(bank - sure - maybe)} mi) more than the app can explain: usually entries on Base that the bank paid a bonus on, or spend not logged.</div>`;
  else verdict = `<div class="stmt-verdict ok">✓ In range: the bank's ${n(bank)} is between ${n(sure)} (sure) and ${n(sure + maybe)} (if every bonus that could land here did).</div>`;
  return `<div class="stmt-banner">
    <div><b>📄 ${escapeHtml(s.label)}</b> <button type="button" class="stmt-x" data-stmt-clear title="Show all entries again">✕</button></div>
    <table class="stmt-tbl"><thead><tr><th></th><th class="num">${escapeHtml(unit)}</th><th class="num">≈ miles</th></tr></thead><tbody>
      ${row("<b>Bank credited</b> on this statement", bank, "strong")}
      ${s.status === "baseline" ? "" : `${row("App is sure of: base points on the entries below", sureBase)}
      ${sureBonus ? row("App is sure of: bonus already due", sureBonus) : ""}
      ${maybeEarlier ? row("Could land here: bonus for the previous statement's entries", maybeEarlier, "dim") : ""}
      ${maybeThese ? row("Could land here: bonus for the entries below (usually next statement)", maybeThese, "dim") : ""}
      ${maybeOther ? row("Could land here: entries posting near the cut-off", maybeOther, "dim") : ""}`}
    </tbody></table>
    ${verdict}
    <div class="hm-note">The ${rows.length} entr${rows.length === 1 ? "y" : "ies"} below: S$${fmtNum(spent, 2)} · ${fmtNum(Math.round(miles))} mi in the app, base and bonus together (the bonus part usually arrives on the next statement).</div>
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
