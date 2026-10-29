// Phone filters for the History list: a row of chips (Card, Category, Amount, Dates, Sort), each opening a small bottom sheet.
// Desktop uses the filter row and the sortable table instead (see history-table.js); the chip row is hidden there by CSS.
import { cardFilterLabel, catFilterLabel, cardsHtml, catsHtml, paintFilters, toggleFilter } from "./col-filter.js";
import { state } from "./state.js";
import { ALL_MASTER_CARDS, cardShort } from "./config.js";
import { escapeHtml } from "./retailers.js";
import { categoryOptions, NO_CATEGORY } from "./history-table.js";

let rerender = () => {};
let periodRows = [];

const SORTS = [
  { label: 'Newest first', key: 'date', dir: 'desc' },
  { label: 'Oldest first', key: 'date', dir: 'asc' },
  { label: 'Amount: high to low', key: 'amount', dir: 'desc' },
  { label: 'Amount: low to high', key: 'amount', dir: 'asc' },
  { label: 'Miles: high to low', key: 'miles', dir: 'desc' },
  { label: 'mpd: lowest first', key: 'mpd', dir: 'asc' },
  { label: 'Merchant A to Z', key: 'merchant', dir: 'asc' }
];
const sortLabel = (v) => (SORTS.find(s => s.key === v.sortKey && s.dir === v.sortDir) || SORTS[0]).label;
const money = (n) => `S$${Number(n).toLocaleString('en-SG', { maximumFractionDigits: 2 })}`;

function amountLabel(v) {
  const lo = v.amtMin !== '', hi = v.amtMax !== '';
  if (lo && hi) return `${money(v.amtMin)} to ${money(v.amtMax)}`;
  if (lo) return `${money(v.amtMin)} and over`;
  if (hi) return `Up to ${money(v.amtMax)}`;
  return '';
}
const datesCount = (v) => [v.transFrom || v.transTo, v.postFrom || v.postTo].filter(Boolean).length;

export function renderTxChips(rows) {
  periodRows = rows || periodRows;
  const el = document.getElementById('txChips');
  if (!el) return;
  const v = state.txView;
  const card = cardFilterLabel(v);
  const cat = catFilterLabel(v);
  const chip = (kind, text, on) => `<button type="button" class="tx-chip${on ? ' on' : ''}" data-chip="${kind}">${escapeHtml(text)} ▾</button>`;
  const anyOn = !!(card || cat || amountLabel(v) || datesCount(v));
  el.innerHTML =
    chip('card', card || 'Card', !!card) +
    chip('category', cat || 'Category', !!cat) +
    chip('amount', amountLabel(v) || 'Amount', !!amountLabel(v)) +
    chip('dates', datesCount(v) ? `Dates (${datesCount(v)})` : 'Dates', !!datesCount(v)) +
    chip('sort', sortLabel(v), v.sortKey !== 'date' || v.sortDir !== 'desc') +
    (anyOn ? `<button type="button" class="tx-chip clear" data-chip="clear">Clear all</button>` : '');
}

const sheet = () => document.getElementById('txSheet');
const overlay = () => document.getElementById('txSheetOverlay');
const close = () => overlay()?.classList.remove('open');
const apply = () => { close(); rerender(); };

function options(items, current, kind) {
  return items.map((it, i) => `<button type="button" class="tx-opt${it.value === current ? ' on' : ''}" data-kind="${kind}" data-i="${i}">${escapeHtml(it.label)}${it.value === current ? ' ✓' : ''}</button>`).join('');
}

function openSheet(kind) {
  const v = state.txView;
  let title = '', body = '', items = [];
  if (kind === 'card') {
    title = 'Cards';
    body = `<div class="cf-list cf-sheet">${cardsHtml()}</div><div class="tx-sheet-btns"><button type="button" class="btn-backup" data-act="reset-cf">Clear</button><button type="button" class="btn-submit" data-act="close">Done</button></div>`;
  } else if (kind === 'category') {
    title = 'Categories';
    body = `<div class="cf-list cf-sheet">${catsHtml()}</div><div class="tx-sheet-btns"><button type="button" class="btn-backup" data-act="reset-cf">Clear</button><button type="button" class="btn-submit" data-act="close">Done</button></div>`;
  } else if (kind === 'sort') {
    title = 'Sort by';
    items = SORTS.map(s => ({ label: s.label, value: s.label }));
    body = options(items, sortLabel(v), 'sort');
  } else if (kind === 'amount') {
    title = 'Amount (S$)';
    body = `<div class="tx-sheet-row"><input type="number" id="txSheetMin" class="form-control" placeholder="min" min="0" step="any" value="${escapeHtml(v.amtMin)}"><span>to</span><input type="number" id="txSheetMax" class="form-control" placeholder="max" min="0" step="any" value="${escapeHtml(v.amtMax)}"></div>
      <div class="tx-sheet-btns"><button type="button" class="btn-backup" data-act="reset-amount">Clear</button><button type="button" class="btn-submit" data-act="apply-amount">Apply</button></div>`;
  } else if (kind === 'dates') {
    title = 'Dates';
    body = `<div class="tx-sheet-lbl">Transaction date</div>
      <div class="tx-sheet-row"><input type="date" id="txSheetTF" class="form-control" value="${escapeHtml(v.transFrom)}"><span>to</span><input type="date" id="txSheetTT" class="form-control" value="${escapeHtml(v.transTo)}"></div>
      <div class="tx-sheet-lbl">Posted date <small>(rows without a post date are hidden)</small></div>
      <div class="tx-sheet-row"><input type="date" id="txSheetPF" class="form-control" value="${escapeHtml(v.postFrom)}"><span>to</span><input type="date" id="txSheetPT" class="form-control" value="${escapeHtml(v.postTo)}"></div>
      <div class="tx-sheet-btns"><button type="button" class="btn-backup" data-act="reset-dates">Clear</button><button type="button" class="btn-submit" data-act="apply-dates">Apply</button></div>`;
  } else return;
  sheet().innerHTML = `<div class="tx-sheet-head"><b>${title}</b><span class="tx-sheet-x" data-act="close">✕</span></div><div class="tx-sheet-body">${body}</div>`;
  sheet().dataset.items = JSON.stringify(items.map(i => i.value));
  sheet().dataset.kind = kind;
  paintFilters(sheet());
  overlay().classList.add('open');
}

export function initHistoryChips(renderFn) {
  rerender = renderFn;
  document.getElementById('txChips')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-chip]');
    if (!b) return;
    if (b.dataset.chip === 'clear') {
      Object.assign(state.txView, { merchant: '', cards: [], cats: [], amtMin: '', amtMax: '', transFrom: '', transTo: '', postFrom: '', postTo: '' });
      rerender();
    } else openSheet(b.dataset.chip);
  });
  overlay()?.addEventListener('click', (e) => { if (e.target === overlay()) close(); });
  sheet()?.addEventListener('change', (e) => {          // several cards or categories can be ticked; the list behind updates as you go
    const el = e.target.closest('input[data-f]'); if (!el) return;
    toggleFilter(el.dataset.f, el.dataset.v); paintFilters(sheet()); rerender();
  });
  sheet()?.addEventListener('click', (e) => {
    const v = state.txView;
    const opt = e.target.closest('.tx-opt');
    if (opt) {
      const vals = JSON.parse(sheet().dataset.items || '[]');
      const val = vals[Number(opt.dataset.i)];
      if (opt.dataset.kind === 'sort') { const s = SORTS.find(x => x.label === val) || SORTS[0]; v.sortKey = s.key; v.sortDir = s.dir; }
      return apply();
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    if (act === 'close') close();
    else if (act === 'reset-cf') { if (sheet().dataset.kind === 'card') v.cards = []; else v.cats = []; paintFilters(sheet()); rerender(); }
    else if (act === 'apply-amount') { v.amtMin = document.getElementById('txSheetMin').value; v.amtMax = document.getElementById('txSheetMax').value; apply(); }
    else if (act === 'reset-amount') { v.amtMin = ''; v.amtMax = ''; apply(); }
    else if (act === 'apply-dates') {
      v.transFrom = document.getElementById('txSheetTF').value; v.transTo = document.getElementById('txSheetTT').value;
      v.postFrom = document.getElementById('txSheetPF').value; v.postTo = document.getElementById('txSheetPT').value; apply();
    } else if (act === 'reset-dates') { Object.assign(v, { transFrom: '', transTo: '', postFrom: '', postTo: '' }); apply(); }
  });
}
