// Transaction date vs posting date: the "how each card counts" sheet (opened from the card chips, Settings and the statement import) and the hint on the log form.
// The rules and date logic are in posting.js.
import { state } from "./state.js";
import { ALL_MASTER_CARDS } from "./config.js";
import { escapeHtml } from "./retailers.js";
import { POSTING_RULES, POSTING_META, BASIS_LABEL, postingRule, bannerRows, slipLine, expectedPosting, SLIP_ALERT_MIN } from "./posting.js";

const $ = id => document.getElementById(id);
const fmtDay = d => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const enabledCards = () => ALL_MASTER_CARDS.filter(c => state.enabledCardIds.includes(c.id));

// Small label for a card tile: how this card counts spend.
export function postingChipHtml(card) {
  const rule = postingRule(card);
  if (!rule) return "";
  const b = BASIS_LABEL[rule.basis];
  return `<button type="button" class="post-chip post-${rule.basis}" title="${escapeHtml(b.long)}. Tap for details.">${b.icon} ${escapeHtml(b.short)}</button>`;
}

// One line for the card detail sheet.
export function postingDetailHtml(card) {
  const rule = postingRule(card);
  if (!rule) return "";
  const b = BASIS_LABEL[rule.basis];
  return `${b.icon} <b>${escapeHtml(b.short)}.</b> ${escapeHtml(rule.note)}`;
}

// ---- sheet ----------------------------------------------------------------------------------------------------------
export function openPostingSheet() {
  const body = $("postingBody");
  if (!body) return;
  const now = new Date();
  const rows = bannerRows(enabledCards(), now);
  const grouped = [];
  for (const r of rows) {
    const g = grouped.find(x => x.phase === r.phase && x.lastDay.getTime() === r.lastDay.getTime() && x.rule.basis === r.rule.basis && x.rule.note === r.rule.note);
    if (g) g.cards.push(r.card); else grouped.push({ ...r, cards: [r.card] });
  }
  const nowHtml = grouped.length ? `<h3 class="post-h">Right now</h3>` + grouped.map(r => {
    const when = r.phase === "ending"
      ? `Cycle ends <b>${fmtDay(r.lastDay)}</b>${r.daysToEnd === 0 ? " (today)" : ` (in ${r.daysToEnd} day${r.daysToEnd === 1 ? "" : "s"})`}.`
      : `New cycle started <b>${fmtDay(r.start)}</b>.`;
    const advice = r.rule.basis === "grace"
      ? r.rule.note
      : r.phase === "ending"
        ? `Anything you pay from about <b>${fmtDay(new Date(r.lastDay.getFullYear(), r.lastDay.getMonth(), r.lastDay.getDate() - 2))}</b> may post after the cycle ends. If you need it to count, pay earlier or accept it may land in the next cycle.`
        : `Purchases made in the last 2 to 3 days of the previous cycle may post now and count here.`;
    return `<div class="hm-row"><div class="hm-row-main"><b>${escapeHtml(r.cards.map(c => c.name.replace(/\s*\(.*\)$/, "")).filter((n, i, a) => a.indexOf(n) === i).join(", "))}</b><div class="hm-sub">${when} ${advice}</div></div></div>`;
  }).join("") : "";

  const groups = [["posting", "Counted by posting date"], ["grace", "Posting date, with a grace period (Maybank)"], ["transaction", "Counted by transaction date"]];
  const cards = ALL_MASTER_CARDS.filter(c => postingRule(c));
  const tableHtml = `<h3 class="post-h">How each card counts</h3>` + groups.map(([basis, title]) => {
    const list = cards.filter(c => POSTING_RULES[c.id].basis === basis);
    if (!list.length) return "";
    const rule = POSTING_RULES[list[0].id];
    return `<div class="post-group"><div class="post-group-title">${BASIS_LABEL[basis].icon} ${escapeHtml(title)}</div>
      <div class="hm-note">${escapeHtml(rule.note)}</div>
      <div class="post-cards">${list.map(c => `<span class="hm-chip ${state.enabledCardIds.includes(c.id) ? "" : "hm-out"}">${escapeHtml(c.name)}${basis === "grace" ? ` <small>by the ${POSTING_RULES[c.id].graceDay}th</small>` : ""}</span>`).join("")}</div></div>`;
  }).join("");

  const tips = `<h3 class="post-h">What the app does</h3>
    <ul class="post-list">
      <li><b>Logging:</b> spend counts to the date you enter. On a posting-date card you can also enter the date the bank posted it (the Posting date field), and it then counts to that date's cycle.</li>
      <li><b>Statements:</b> when an imported file has a posting date column, posting-date cards use it to decide which cycle a line counts to. Lines near the end of a cycle in a file with no posting date are flagged.</li>
      <li><b>Recommendations:</b> on the last days of a cycle the result tells you if a posting-date card may count the spend to the next cycle.</li>
      <li>Posting normally takes 1 to 3 days, longer over weekends and public holidays (the app skips weekends but does not know public holidays). Some merchants post the same day (readers report 7-Eleven, Cold Storage, Starbucks, Toast Box and a few others), but that is not guaranteed.</li>
    </ul>
    <p class="hm-note"><b>Source:</b> <a href="${escapeHtml(POSTING_META.url)}" target="_blank" rel="noopener">${escapeHtml(POSTING_META.source)}, ${escapeHtml(POSTING_META.asOf)}</a>. It is a third-party summary, not the banks' terms, and banks change how they track spend, so check your card's T&amp;Cs when a cap or minimum spend matters.</p>`;
  body.innerHTML = nowHtml + tableHtml + tips;
  $("postingOverlay")?.classList.add("open");
}
export function closePostingSheet() { $("postingOverlay")?.classList.remove("open"); }

// ---- log form -------------------------------------------------------------------------------------------------------
// Shows the posting-date field (and a warning near cycle end) for cards that count by posting date.
export function refreshLogHint() {
  const group = $("txPostGroup"), hint = $("txPostHint");
  if (!group || !hint) return;
  const card = ALL_MASTER_CARDS.find(c => c.id === $("cardSelect")?.value);
  const rule = postingRule(card);
  const show = !!rule && rule.basis !== "transaction";
  group.style.display = show ? "flex" : "none";
  const dv = $("txDateInput")?.value;
  const spend = dv ? new Date(...dv.split("-").map((n, i) => i === 1 ? n - 1 : Number(n)), 12) : new Date();
  const amount = Number($("amtInput")?.value) || 0;
  const line = card && rule && amount >= SLIP_ALERT_MIN ? slipLine(card, spend) : "";   // small spend: no warning
  const est = show && rule.basis === "posting" ? expectedPosting(spend) : null;
  hint.innerHTML = (line ? `<div class="post-note">${line}</div>` : "")
    + (show ? `<div class="hm-note">${est ? `A charge on this date usually posts ${fmtDay(est.from)} to ${fmtDay(est.to)}. ` : ""}Leave blank to count it on the date above; or enter the date the bank posted it once you know.</div>` : "");
  if (!show && $("txPostInput")) $("txPostInput").value = "";
}

export function initPostingUi() {
  window.addEventListener("open-posting-sheet", openPostingSheet);
  window.addEventListener("tx-form-changed", refreshLogHint);
  $("btnClosePosting")?.addEventListener("click", closePostingSheet);
  $("postingOverlay")?.addEventListener("click", e => { if (e.target.id === "postingOverlay") closePostingSheet(); });
  $("txDateInput")?.addEventListener("change", refreshLogHint);
  $("cardSelect")?.addEventListener("change", refreshLogHint);
  $("amtInput")?.addEventListener("input", refreshLogHint);
}
