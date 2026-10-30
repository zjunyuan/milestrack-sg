// Statement coverage grid: which card and month have had a statement imported. Used in the Upload statement sheet and at the top of History.
// A month counts as covered when an import recorded it (state.stmtCoverage), or when the ledger already has a statement-confirmed entry in it.
import { state } from "./state.js";
import { ALL_MASTER_CARDS, cardShort } from "./config.js";
import { familyOf, dayKey } from "./statements.js";
import { escapeHtml } from "./retailers.js";

const MO = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

export function isStatementEntry(t) { return !!(t && (t.stmtKey || t.stmtConfirmed || t.source === "statement")); }

export function coverageData(year, now = new Date()) {
  const nowM = now.getFullYear() === year ? now.getMonth() : (year < now.getFullYear() ? 12 : -1);   // months before this index are "due"
  const cov = {};
  for (const [k, ms] of Object.entries(state.stmtCoverage || {})) for (const m of Object.keys(ms || {})) (cov[k] = cov[k] || new Set()).add(m);
  for (const t of state.transactions) if (isStatementEntry(t)) { const k = familyOf(t.cardId)[0]; (cov[k] = cov[k] || new Set()).add(dayKey(t.timestamp || 0).slice(0, 7)); }
  const keys = [...new Set(ALL_MASTER_CARDS.filter(c => state.enabledCardIds.includes(c.id)).map(c => familyOf(c.id)[0]))];
  const label = k => { const first = ALL_MASTER_CARDS.find(c => c.id === k); const multi = familyOf(k).length > 1; return first ? (multi ? cardShort(first).replace(/\.[^.]*$/, "") : cardShort(first)) : k; };
  let due = 0, got = 0;
  const rows = keys.map(k => {
    const cells = MO.map((_, m) => {
      const ym = `${year}-${String(m + 1).padStart(2, "0")}`;
      const future = nowM >= 0 && nowM < 12 ? m > nowM : nowM < 0;
      const current = nowM >= 0 && nowM < 12 && m === nowM;
      const has = !!(cov[k] && cov[k].has(ym));
      if (!future && !current) { due++; if (has) got++; }
      return { ym, has, future, current };
    });
    return { key: k, label: label(k), cells };
  });
  return { year, rows, due, got };
}

// clickable: cells with a statement become buttons (data-card = the card's first entry id, data-ym = "YYYY-MM") so History can jump to them.
export function coverageTableHtml(data, { clickable = false } = {}) {
  const body = data.rows.map(r => `<tr><th>${escapeHtml(r.label)}</th>${r.cells.map(c => {
    if (c.future) return `<td class="cv-future"></td>`;
    const cls = c.has ? "cv-yes" : (c.current ? "cv-now" : "cv-no");
    const txt = c.has ? "✓" : (c.current ? "" : "·");
    const attrs = clickable ? ` data-cv-card="${escapeHtml(r.key)}" data-cv-ym="${c.ym}" role="button" tabindex="0"` : "";
    return `<td class="${cls}${clickable ? " cv-click" : ""}" title="${c.ym}"${attrs}>${txt}</td>`;
  }).join("")}</tr>`).join("");
  return `<div class="cv-wrap"><table class="cv-table"><thead><tr><th></th>${MO.map(m => `<th>${m}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div>`;
}

export function coverageSummaryText(data) { return `📅 Statements imported in ${data.year}: ${data.got} of ${data.due} card-months`; }
