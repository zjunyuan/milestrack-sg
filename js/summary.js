// Monthly summary for the History tab: month-over-month deltas, unused bonus room, cap use,
// miles by category, and small leaks (S$5 rounding, minimum-spend checks).
// Calculated from logged transactions and card settings only; nothing is stored.
import { state } from "./state.js";
import { cardShort } from "./config.js";
import { findRetailerForInput, escapeHtml } from "./retailers.js";
import { getMccEntry, shortCategory } from "./mcc.js";
import { fmtNum } from "./format.js";

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const inMonth = (tx, y, m) => {
  if (!tx.timestamp) return false;
  const d = new Date(tx.timestamp);
  return d.getFullYear() === y && d.getMonth() + 1 === m;
};
const prevOf = (y, m) => (m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 });
const totals = (txns) => {
  const spent = txns.reduce((s, t) => s + (Number(t.amt) || 0), 0);
  const miles = txns.reduce((s, t) => s + (Number(t.miles) || 0), 0);
  return { spent, miles, mpd: spent > 0 ? miles / spent : 0, n: txns.length };
};
const pct = (now, before) => (before > 0 ? ((now - before) / before) * 100 : null);

/** Deltas vs the previous month, for the stat boxes. */
export function monthDeltas(y, m) {
  const cur = totals(state.transactions.filter(t => inMonth(t, y, m)));
  const p = prevOf(y, m);
  const prev = totals(state.transactions.filter(t => inMonth(t, p.y, p.m)));
  return { cur, prev, prevLabel: MON[p.m - 1], hasPrev: prev.n > 0,
    spentPct: pct(cur.spent, prev.spent), milesPct: pct(cur.miles, prev.miles), mpdDiff: cur.mpd - prev.mpd };
}
const arrow = (v, unit) => (v === null || !isFinite(v) ? '' : `${v >= 0 ? '▲' : '▼'} ${Math.abs(v).toFixed(unit === 'x' ? 2 : 0)}${unit === '%' ? '%' : ''}`);
export function deltaText(d) {
  if (!d.hasPrev) return { spent: '', miles: '', mpd: '' };
  return {
    spent: arrow(d.spentPct, '%') && `${arrow(d.spentPct, '%')} vs ${d.prevLabel}`,
    miles: arrow(d.milesPct, '%') && `${arrow(d.milesPct, '%')} vs ${d.prevLabel}`,
    mpd: `${arrow(d.mpdDiff, 'x')} vs ${d.prevLabel}`
  };
}

const categoryCache = new Map();
function categoryOf(desc) {
  const key = String(desc || '').toLowerCase();
  if (categoryCache.has(key)) return categoryCache.get(key);
  let cat = null;
  try {
    const r = findRetailerForInput(desc, state.merchantOverrides);
    const e = r && r.mcc ? getMccEntry(r.mcc) : null;
    if (e && e.name) cat = shortCategory(e.name);
  } catch (_) { /* unknown merchant */ }
  categoryCache.set(key, cat);
  return cat;
}

// One row per card entry: channel entries (e.g. UOB PPV Tap / Online) each have their own cap.
function capFamilies(stmtSpent, y, m, txns) {
  const rows = [];
  for (const card of state.cards) {
    // yuu's 10 mpd is gated by a minimum spend and merchant count, so it has its own check below.
    if (card.id === 'dbs-yuu' || card.monthlyCap >= 999999 || !(card.bonusMpd > card.baseMpd)) continue;
    const own = txns.filter(t => t.cardId === card.id);
    const spent = card.cycleType === 'statement'
      ? stmtSpent(card, y, m)
      : own.reduce((s, t) => s + (Number(t.amt) || 0), 0);
    if (spent <= 0) continue;
    let cappedOn = null;
    if (spent >= card.monthlyCap && card.cycleType !== 'statement' && own.length) {
      let run = 0;
      for (const t of own.slice().sort((a, b) => a.timestamp - b.timestamp)) {
        run += Number(t.amt) || 0;
        if (run >= card.monthlyCap) { cappedOn = new Date(t.timestamp); break; }
      }
    }
    const unused = Math.max(0, card.monthlyCap - spent);
    rows.push({ name: cardShort(card), cap: card.monthlyCap, spent, unused,
      upTo: Math.round(unused * (card.bonusMpd - card.baseMpd)), cappedOn, mpd: card.bonusMpd });
  }
  return rows.sort((a, b) => b.unused - a.unused);
}

function leaks(txns, stmtSpent, y, m) {
  let lost = 0, count = 0;
  for (const t of txns) {
    const c = state.cards.find(x => x.id === t.cardId);
    if (!c || (c.engine !== 'uob-5' && c.engine !== 'ocbc-5')) continue;
    const rem = (Number(t.amt) || 0) % 5;
    if (rem <= 0.01) continue;
    lost += Math.round(rem * (t.bonusCategory === 'base' ? c.baseMpd : c.bonusMpd));
    count++;
  }
  const checks = [];
  const vs = state.cards.find(c => c.id.startsWith('uob-vs') && c.cycleType === 'statement');
  if (vs) {
    const sp = state.cards.filter(c => c.id.startsWith('uob-vs')).reduce((s, c) => s + stmtSpent(c, y, m), 0);
    if (sp > 0) checks.push({ label: 'UOB VS S$1,000 minimum', ok: sp >= 1000, text: sp >= 1000 ? 'Met ✓' : `Missed · S$${fmtNum(sp, 0)}` });
  }
  const yuu = state.cards.find(c => c.id === 'dbs-yuu');
  if (yuu) {
    const ys = txns.filter(t => t.cardId === 'dbs-yuu');
    const spent = ys.reduce((s, t) => s + (Number(t.amt) || 0), 0);
    if (spent > 0) {
      const merchants = new Set(ys.map(t => String(t.desc || '').toLowerCase())).size;
      const ok = spent >= 800 && merchants >= 4;
      checks.push({ label: 'DBS yuu: S$800 + 4 merchants', ok, text: ok ? 'Met ✓' : `S$${fmtNum(spent, 0)} · ${merchants}/4 merchants` });
    }
  }
  return { lost, count, checks };
}

/** HTML for the summary of one calendar month. `stmtSpent(card, y, m)` gives a statement-cycle spend. */
export function monthlySummaryHtml(y, m, stmtSpent, now = new Date()) {
  const txns = state.transactions.filter(t => inMonth(t, y, m));
  if (!txns.length) return '';
  const soFar = now.getFullYear() === y && now.getMonth() + 1 === m;
  const fams = capFamilies(stmtSpent, y, m, txns);
  const unusedTotal = fams.reduce((s, f) => s + f.unused, 0);
  const upToTotal = fams.reduce((s, f) => s + f.upTo, 0);
  const unusedCards = fams.filter(f => f.unused > 0).length;

  const cats = new Map();
  let totalMiles = 0;
  for (const t of txns) {
    const mi = Number(t.miles) || 0;
    totalMiles += mi;
    const k = categoryOf(t.desc) || 'Everything else';
    cats.set(k, (cats.get(k) || 0) + mi);
  }
  const catRows = [...cats.entries()].filter(([k]) => k !== 'Everything else').sort((a, b) => b[1] - a[1]).slice(0, 3);
  const shown = catRows.reduce((s, [, v]) => s + v, 0);
  if (totalMiles - shown > 0) catRows.push(['Everything else', totalMiles - shown]);
  const catMax = Math.max(1, ...catRows.map(r => r[1]));

  const lk = leaks(txns, stmtSpent, y, m);

  const room = unusedCards ? `<div class="ms-note">⏳ <b>S$${fmtNum(unusedTotal, 0)} of bonus room ${soFar ? 'is still unused' : 'went unused'}</b> across ${unusedCards} card${unusedCards > 1 ? 's' : ''}${upToTotal ? `. Worth up to ~${fmtNum(upToTotal, 0)} mi if spent there. <span class="ms-dim">(an upper bound: not all spend can move)</span>` : '.'}</div>` : '';

  const capRows = fams.map(f => {
    const full = f.spent >= f.cap;
    const sub = full
      ? `Capped${f.cappedOn ? ` on ${f.cappedOn.getDate()} ${MON[f.cappedOn.getMonth()]}` : ''}`
      : `<span class="ms-bad">S$${fmtNum(f.unused, 0)} unused</span>${f.upTo ? ` · up to ${fmtNum(f.upTo, 0)} mi` : ''}`;
    return `<div class="ms-row"><div class="ms-line"><span>${escapeHtml(f.name)}</span><span><b>S$${fmtNum(f.spent, 0)}</b> / ${fmtNum(f.cap, 0)}</span></div>
      <div class="ms-bar${full ? ' full' : ''}"><i style="width:${Math.min(100, (f.spent / f.cap) * 100).toFixed(0)}%"></i></div><div class="ms-sub">${sub}</div></div>`;
  }).join('');

  const catHtml = catRows.map(([k, v]) => `<div class="ms-row"><div class="ms-line"><span>${escapeHtml(k)}</span><span><b>${fmtNum(v, 0)} mi</b></span></div>
      <div class="ms-bar mile"><i style="width:${((v / catMax) * 100).toFixed(0)}%"></i></div></div>`).join('');

  const leakRows = [];
  if (lk.count > 0) leakRows.push(`<div class="ms-row"><div class="ms-line"><span>S$5 rounding</span><span class="ms-bad">−${fmtNum(lk.lost, 0)} mi</span></div><div class="ms-sub">${lk.count} transaction${lk.count > 1 ? 's' : ''} had a remainder under S$5 that earned nothing</div></div>`);
  lk.checks.forEach(c => leakRows.push(`<div class="ms-row"><div class="ms-line"><span>${escapeHtml(c.label)}</span><span class="${c.ok ? 'ms-ok' : 'ms-bad'}">${escapeHtml(c.text)}</span></div></div>`));

  return `<details class="ms-wrap" open><summary>${MON[m - 1]} ${y} summary${soFar ? ' · so far' : ''}</summary><div class="ms">
    ${room}
    ${capRows ? `<div class="ms-card"><h3>Cap use by card</h3>${capRows}</div>` : ''}
    ${catHtml ? `<div class="ms-card"><h3>Where the miles came from</h3>${catHtml}</div>` : ''}
    ${leakRows.length ? `<div class="ms-card"><h3>Small leaks &amp; checks</h3>${leakRows.join('')}</div>` : ''}
  </div></details>`;
}
