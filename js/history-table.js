// History transaction table: filters, sorting, totals. Pure helpers plus the desktop table markup.
import { state } from "./state.js";
import { cardShort } from "./config.js";
import { escapeHtml } from "./retailers.js";
import { fmtNum } from "./format.js";
import { categoryOf, mccOf } from "./summary.js";

export const NO_CATEGORY = '__none';
export const TX_COLUMNS = [
  { key: 'date', label: 'Trans date' },
  { key: 'post', label: 'Post date' },
  { key: 'merchant', label: 'Merchant' },
  { key: 'card', label: 'Card' },
  { key: 'category', label: 'Category' },
  { key: 'amount', label: 'Amount', num: true },
  { key: 'miles', label: 'Miles', num: true },
  { key: 'mpd', label: 'mpd', num: true }
];
const DESC_FIRST = new Set(['date', 'post', 'amount', 'miles', 'mpd']);

export function defaultView() {
  return { sortKey: 'date', sortDir: 'desc', merchant: '', cards: [], cats: [], amtMin: '', amtMax: '', transFrom: '', transTo: '', postFrom: '', postTo: '' };
}
export function viewIsFiltered(v) {
  return !!v.merchant || v.cards.length > 0 || v.cats.length > 0 || v.amtMin !== '' || v.amtMax !== '' || v.transFrom || v.transTo || v.postFrom || v.postTo;
}

const dayStart = (s) => (s ? new Date(`${s}T00:00:00`).getTime() : null);
const dayEnd = (s) => (s ? new Date(`${s}T23:59:59.999`).getTime() : null);
const num = (s) => (s === '' || s === null || s === undefined || isNaN(Number(s)) ? null : Number(s));

export function mccChip(tx) {
  const m = mccOf(tx.desc);
  return m ? ` <span class="tx-mcc" title="MCC the merchant name resolves to">${m}</span>` : '';
}
export function txCategory(tx) { return categoryOf(tx.desc); }
export function txMpd(tx) { const a = Number(tx.amt) || 0; return a > 0 ? (Number(tx.miles) || 0) / a : 0; }

/** Rows that pass the advanced filters (card, merchant text and period are handled by the caller). */
export function passesView(tx, v) {
  const amt = Number(tx.amt) || 0;
  const lo = num(v.amtMin), hi = num(v.amtMax);
  if (lo !== null && amt < lo) return false;
  if (hi !== null && amt > hi) return false;
  if (v.merchant && !String(tx.desc || '').toLowerCase().includes(v.merchant.toLowerCase().trim())) return false;
  if (v.cards.length && !v.cards.includes(tx.cardId)) return false;
  if (v.cats.length && !v.cats.includes(txCategory(tx) || NO_CATEGORY)) return false;
  const tf = dayStart(v.transFrom), tt = dayEnd(v.transTo);
  if (tf !== null && !(tx.timestamp >= tf)) return false;
  if (tt !== null && !(tx.timestamp <= tt)) return false;
  const pf = dayStart(v.postFrom), pt = dayEnd(v.postTo);
  if (pf !== null || pt !== null) {
    if (!tx.postTs) return false;
    if (pf !== null && tx.postTs < pf) return false;
    if (pt !== null && tx.postTs > pt) return false;
  }
  return true;
}

export function sortTxns(rows, v, cardOf) {
  const dir = v.sortDir === 'asc' ? 1 : -1;
  const val = {
    date: t => t.timestamp || 0,
    post: t => t.postTs || null,
    merchant: t => String(t.desc || '').toLowerCase(),
    card: t => cardShort(cardOf(t)).toLowerCase(),
    category: t => (txCategory(t) || '').toLowerCase(),
    amount: t => Number(t.amt) || 0,
    miles: t => Number(t.miles) || 0,
    mpd: t => txMpd(t)
  }[v.sortKey] || (t => t.timestamp || 0);
  return rows.map((t, i) => ({ t, i, k: val(t) })).sort((a, b) => {
    if (a.k === null && b.k !== null) return 1;      // blanks last whichever way it sorts
    if (b.k === null && a.k !== null) return -1;
    if (a.k < b.k) return -dir;
    if (a.k > b.k) return dir;
    return b.i - a.i;
  }).map(x => x.t);
}

export function toggleSort(v, key) {
  if (v.sortKey === key) v.sortDir = v.sortDir === 'asc' ? 'desc' : 'asc';
  else { v.sortKey = key; v.sortDir = DESC_FIRST.has(key) ? 'desc' : 'asc'; }
}

export function categoryOptions(rows) {
  const set = new Set();
  let none = false;
  rows.forEach(t => { const c = txCategory(t); if (c) set.add(c); else none = true; });
  return { names: [...set].sort(), none };
}

export function totalsHtml(rows, view) {
  const spent = rows.reduce((s, t) => s + (Number(t.amt) || 0), 0);
  const miles = rows.reduce((s, t) => s + (Number(t.miles) || 0), 0);
  const mpd = spent > 0 ? (miles / spent).toFixed(2) : '0.00';
  const postNote = (view.postFrom || view.postTo)
    ? ` · ${state.transactions.filter(t => !t.postTs).length} transactions have no post date and are hidden` : '';
  return `<div class="tx-totals"><b>${rows.length}</b> transaction${rows.length === 1 ? '' : 's'} · <b>S$${fmtNum(spent, 2)}</b> · <b>${fmtNum(miles, 0)} mi</b> · ${mpd} mpd${postNote}</div>`;
}

const fmtDay = (ms) => {
  if (!ms) return '—';
  const d = new Date(ms);
  const o = { day: 'numeric', month: 'short' };
  if (d.getFullYear() !== new Date().getFullYear()) o.year = '2-digit';
  return d.toLocaleDateString('en-SG', o);
};

export function tableHtml(rows, view, cardOf, select = null) {
  const head = TX_COLUMNS.map(c => {
    const on = view.sortKey === c.key;
    const act = c.key === 'merchant' ? !!view.merchant : c.key === 'card' ? view.cards.length > 0 : c.key === 'category' ? view.cats.length > 0 : false;
    const filt = ['merchant', 'card', 'category'].includes(c.key) ? ` <span class="th-filter material-symbols-outlined${act ? ' on' : ''}" data-filter="${c.key}" title="Filter ${c.label.toLowerCase()}">filter_alt</span>` : '';
    return `<th class="${c.num ? 'num ' : ''}${on ? 'sorted' : ''}" data-sort="${c.key}">${c.label}${on ? (view.sortDir === 'asc' ? ' ▲' : ' ▼') : ''}${filt}</th>`;
  }).join('') + '<th></th>';
  const selHead = select ? `<th class="sel"><input type="checkbox" data-sel="all-toggle" ${rows.length && rows.every(t => select.ids.has(String(t.id))) ? 'checked' : ''} aria-label="Select all shown"></th>` : '';
  const body = rows.map(t => {
    const mpd = txMpd(t);
    return `<tr data-id="${escapeHtml(String(t.id))}"${select && select.ids.has(String(t.id)) ? ' class="selected"' : ''}>
      ${select ? `<td class="sel"><input type="checkbox" class="tx-sel" ${select.ids.has(String(t.id)) ? 'checked' : ''} aria-label="Select"></td>` : ''}
      <td>${fmtDay(t.timestamp)}</td>
      <td class="${t.postTs ? '' : 'dim'}">${fmtDay(t.postTs)}</td>
      <td class="merch" title="${escapeHtml(t.desc || '')}">${escapeHtml(t.desc || '')}${mccChip(t)}${(t.stmtKey || t.stmtConfirmed || t.source === 'statement') ? ' <span class="tx-stmt" title="Confirmed by a bank statement">✓</span>' : ''}</td>
      <td>${escapeHtml(cardShort(cardOf(t)))}</td>
      <td class="cat ${txCategory(t) ? '' : 'dim'}">${escapeHtml(txCategory(t) || '—')}</td>
      <td class="num">${fmtNum(Number(t.amt) || 0, 2)}</td>
      <td class="num miles">+${fmtNum(Number(t.miles) || 0, 0)}</td>
      <td class="num${mpd > 0 && mpd < 1 ? ' dim' : ''}">${mpd.toFixed(2)}</td>
      <td class="acts">${select ? '' : `<button class="btn-tx-action btn-edit" data-act="edit" title="Edit entry"><span class="material-symbols-outlined" style="font-size:18px;">edit</span></button><button class="btn-tx-action btn-delete" data-act="delete" title="Delete entry"><span class="material-symbols-outlined" style="font-size:18px;">delete</span></button>`}</td>
    </tr>`;
  }).join('');
  return `<table class="tx-table"><thead><tr>${selHead}${head}</tr></thead><tbody>${body}</tbody></table>`;
}
