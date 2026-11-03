// Duplicate statement lines (v1.63.58). Until this version the app loaded at most 1,000 entries, an arbitrary 1,000 of them, so an
// import could not see the rest and added the same statement lines again. Every imported line carries its statement key (`stmtKey`:
// card, date, amount, words and which repeat on the statement it is), so two entries with the same key on the same card are one line
// saved twice. The latest import of each line is kept: it was estimated with the newest rules.
import { state } from "./state.js";
import { familyOf } from "./statements.js";
import { escapeHtml } from "./retailers.js";
import { fmtNum } from "./format.js";

export function duplicateExtras(txs = state.transactions || []) {
  const groups = new Map();
  for (const t of txs) {
    if (!t.stmtKey) continue;
    const k = `${familyOf(t.cardId)[0]}|${t.stmtKey}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(t);
  }
  const extras = [];
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    g.sort((a, b) => (Number(b.importedAt) || 0) - (Number(a.importedAt) || 0) || String(b.id).localeCompare(String(a.id)));
    extras.push(...g.slice(1));
  }
  return extras;
}

export function dupesHtml(extras) {
  if (!extras.length) return "";
  const amt = extras.reduce((a, t) => a + (Number(t.amt) || 0), 0);
  return `<div class="stmt-fix dupes-box">⚠️ <b>${extras.length} entr${extras.length === 1 ? "y is a copy" : "ies are copies"} of a statement line already in the app</b> (S$${fmtNum(amt, 2)}): the same line was imported twice. <button type="button" class="btn-backup" data-dupes-del>Remove the copies</button>
    <div class="hm-note">Keeps the latest import of each line. The Vault drops by the copies' points where it counted them. Copies: ${extras.slice(0, 6).map(t => escapeHtml(String(t.desc || "").slice(0, 24))).join(", ")}${extras.length > 6 ? ` and ${extras.length - 6} more` : ""}.</div></div>`;
}
