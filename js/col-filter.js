// History column filters: Merchant (text), Card (several cards, grouped by bank) and Category (several). The same state and
// checkbox lists serve the desktop header popover and the phone filter sheet. state.txView holds: merchant, cards[], cats[].
import { state } from "./state.js";
import { cardShort } from "./config.js";
import { escapeHtml } from "./retailers.js";
import { categoryOptions, NO_CATEGORY } from "./history-table.js";

const BANK_ORDER = ["UOB", "DBS", "Citi", "OCBC", "HSBC", "Maybank", "Trust"];
export const bankOf = (c) => (c.bank === "yuu" ? "DBS" : (c.bank || "Other"));   // yuu is a DBS card

let periodRows = [];
export function setFilterRows(rows) { periodRows = rows || []; }

export function cardGroups() {
  const by = {};
  state.cards.forEach(c => { (by[bankOf(c)] = by[bankOf(c)] || []).push(c); });
  return Object.keys(by).sort((a, b) => (BANK_ORDER.indexOf(a) + 100) % 100 - (BANK_ORDER.indexOf(b) + 100) % 100 || a.localeCompare(b)).map(bank => ({ bank, cards: by[bank] }));
}

const flip = (arr, v) => { const i = arr.indexOf(v); if (i < 0) arr.push(v); else arr.splice(i, 1); };
export function toggleFilter(kind, value) {
  const v = state.txView;
  if (kind === "card") flip(v.cards, value);
  else if (kind === "cat") flip(v.cats, value);
  else if (kind === "bank") {
    const ids = (cardGroups().find(g => g.bank === value)?.cards || []).map(c => c.id);
    const all = ids.length && ids.every(id => v.cards.includes(id));
    v.cards = all ? v.cards.filter(id => !ids.includes(id)) : [...new Set([...v.cards, ...ids])];
  }
}

export function cardFilterLabel(v = state.txView) {
  if (!v.cards.length) return "";
  if (v.cards.length === 1) { const c = state.cards.find(x => x.id === v.cards[0]); return c ? cardShort(c) : "1 card"; }
  for (const g of cardGroups()) if (g.cards.length === v.cards.length && g.cards.every(c => v.cards.includes(c.id))) return `All ${g.bank}`;
  return `${v.cards.length} cards`;
}
export function catFilterLabel(v = state.txView) {
  if (!v.cats.length) return "";
  if (v.cats.length === 1) return v.cats[0] === NO_CATEGORY ? "Unrecognised" : v.cats[0];
  return `${v.cats.length} categories`;
}

const box = (kind, value, label, extra = "") => `<label class="cf-row ${extra}"><input type="checkbox" data-f="${kind}" data-v="${escapeHtml(value)}"> <span>${escapeHtml(label)}</span></label>`;

export function cardsHtml() {
  return cardGroups().map(g => `<div class="cf-group">${box("bank", g.bank, `All ${g.bank}`, "cf-bank")}${g.cards.map(c => box("card", c.id, cardShort(c), "cf-sub")).join("")}</div>`).join("");
}
export function catsHtml(q = "") {
  const { names, none } = categoryOptions(periodRows);
  const extra = state.txView.cats.filter(n => n !== NO_CATEGORY && !names.includes(n));   // picked earlier, none in this period
  const all = [...names, ...extra].sort();
  const needle = q.trim().toLowerCase();
  const list = all.filter(n => !needle || n.toLowerCase().includes(needle));
  const rows = list.map(n => box("cat", n, n)).join("") + (none && (!needle || "unrecognised".includes(needle)) ? box("cat", NO_CATEGORY, "Unrecognised") : "");
  return rows || `<div class="cf-empty">No categories match.</div>`;
}

// Sets every box from state (and the half-ticked look for a bank with only some of its cards chosen).
export function paintFilters(root) {
  const v = state.txView;
  root.querySelectorAll("input[data-f]").forEach(el => {
    const f = el.dataset.f, val = el.dataset.v;
    if (f === "card") el.checked = v.cards.includes(val);
    else if (f === "cat") el.checked = v.cats.includes(val);
    else if (f === "bank") {
      const ids = (cardGroups().find(g => g.bank === val)?.cards || []).map(c => c.id);
      const n = ids.filter(id => v.cards.includes(id)).length;
      el.checked = ids.length > 0 && n === ids.length; el.indeterminate = n > 0 && n < ids.length;
    }
  });
}

// ---- Desktop: a popover under the column header's filter icon ----
let pop = null, popKey = "", rerender = () => {};
const closePop = () => { if (pop) { pop.remove(); pop = null; popKey = ""; } };

function openPop(key, anchor) {
  if (pop && popKey === key) return closePop();
  closePop();
  const v = state.txView;
  pop = document.createElement("div"); pop.id = "txColPop"; pop.className = "cf-pop"; popKey = key;
  if (key === "merchant") pop.innerHTML = `<div class="cf-title">Merchant contains</div><input type="text" class="form-control" id="cfMerchant" placeholder="e.g. grab" value="${escapeHtml(v.merchant)}"><div class="cf-foot"><button type="button" class="btn-backup" data-cf="clear">Clear</button></div>`;
  else if (key === "card") pop.innerHTML = `<div class="cf-title">Cards</div><div class="cf-list">${cardsHtml()}</div><div class="cf-foot"><button type="button" class="btn-backup" data-cf="clear">Clear</button></div>`;
  else pop.innerHTML = `<div class="cf-title">Categories</div><input type="text" class="form-control" id="cfCatSearch" placeholder="Search categories"><div class="cf-list" id="cfCatList">${catsHtml()}</div><div class="cf-foot"><button type="button" class="btn-backup" data-cf="clear">Clear</button></div>`;
  document.body.appendChild(pop);
  const r = anchor.getBoundingClientRect();
  pop.style.top = `${Math.round(r.bottom + 6)}px`;
  pop.style.left = `${Math.round(Math.max(8, Math.min(r.left, window.innerWidth - pop.offsetWidth - 8)))}px`;
  paintFilters(pop);
  pop.querySelector("input[type=text]")?.focus();
}

export function initColFilters(renderFn) {
  rerender = renderFn;
  document.getElementById("txList")?.addEventListener("click", (e) => {
    const f = e.target.closest(".th-filter");
    if (!f) return;
    e.stopPropagation();
    openPop(f.dataset.filter, f);
  }, true);                                                    // capture: the header sort handler must not see this click
  document.addEventListener("click", (e) => { if (pop && !e.target.closest("#txColPop") && !e.target.closest(".th-filter")) closePop(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePop(); });
  document.addEventListener("change", (e) => {
    const el = e.target.closest?.("#txColPop input[data-f]");
    if (!el) return;
    toggleFilter(el.dataset.f, el.dataset.v);
    paintFilters(pop); rerender();
  });
  document.addEventListener("input", (e) => {
    if (e.target.id === "cfMerchant") { state.txView.merchant = e.target.value; rerender(); }
    else if (e.target.id === "cfCatSearch") { const l = document.getElementById("cfCatList"); l.innerHTML = catsHtml(e.target.value); paintFilters(l); }
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest('#txColPop [data-cf="clear"]')) return;
    if (popKey === "merchant") { state.txView.merchant = ""; pop.querySelector("#cfMerchant").value = ""; }
    else if (popKey === "card") state.txView.cards = [];
    else state.txView.cats = [];
    paintFilters(pop); rerender();
  });
}
