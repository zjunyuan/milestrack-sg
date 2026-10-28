// Typeahead dropdown for the MCC / retailer input.
import { state } from "./state.js";
import { searchRetailers, normalizeText, escapeHtml } from "./retailers.js";
import { runRecommendation, selectRetailer } from "./recommender.js";
import { searchKrisPlus, krisPlusMcc } from "./krisplus-merchants.js";
import { getSearchMode, setSearchMode } from "./search-mode.js";
import { searchMccs, mccName, isKnownMcc, nearestMccs } from "./mcc.js";

const CONF_LABEL = { high: "", medium: "varies", low: "unsure" };

function categoryMatches(q, textLimit = 3) {
  // Typing digits: show every code that starts with them (up to 8) so the right one can be picked.
  return searchMccs(q, /^\d+$/.test(q) ? 8 : textLimit).map(h => ({ type: "category", code: h.code, label: `${h.code} · ${h.name}` }));
}

export function initRetailerSuggest() {
  const input = document.getElementById("mccInput");
  const wrapper = input && input.closest(".mcc-input-wrapper");
  if (!input || !wrapper) return;

  const box = document.createElement("div");
  box.id = "retailerSuggest";
  box.className = "retailer-suggest";
  box.setAttribute("role", "listbox");
  box.hidden = true;
  wrapper.appendChild(box);

  let items = [];
  let active = -1;
  // Exact text of the current selection, kept on the input so other code (alt-category chips, "add retailer") can set it too.
  // While the box holds it, no suggestions are shown.
  const getCommitted = () => input.dataset.committed || "";
  const setCommitted = (v) => { if (v) input.dataset.committed = v; else delete input.dataset.committed; };

  function markSelected(on) { wrapper.classList.toggle("has-selection", !!on); }
  function showClear() { const b = document.getElementById("btnClearMcc"); if (b) b.style.display = "flex"; }

  // Fill the box with the full "5311 · Department Stores" text so it is obvious which category is selected.
  function commitCategory(code) {
    state.selectedRetailer = null;
    setSearchMode("mcc");
    const label = `${code} · ${mccName(code)}`;
    setCommitted(label);
    input.value = label;
    markSelected(true);
    showClear();
    hide();
    runRecommendation();
  }

  // On touch devices, close the on-screen keyboard after a pick so the result is not hidden behind it, then bring the result into view.
  function dropKeyboard() {
    if (!window.matchMedia || !matchMedia("(pointer: coarse)").matches) return;
    input.blur();
    setTimeout(() => document.getElementById("recResultArea")?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 150);
  }

  function hide() { box.hidden = true; active = -1; }

  function highlight() {
    box.querySelectorAll(".rs-item").forEach((el, i) => el.classList.toggle("active", i === active));
    box.querySelector(".rs-item.active")?.scrollIntoView({ block: "nearest" });
  }

  function choose(i) {
    const item = items[i];
    if (!item) return;
    hide();
    dropKeyboard();
    if (item.type === "switch") {
      setSearchMode(item.to);
      refresh();
    } else if (item.type === "retailer") {
      selectRetailer(item.retailer);
    } else if (item.type === "kris") {
      setSearchMode("retailer");
      // Not a curated retailer: fill in the plain name. The recommender recognises it as a Kris+ merchant and ranks cards on an assumed MCC.
      state.selectedRetailer = null;
      setCommitted(item.kris.name);
      input.value = item.kris.name;
      markSelected(true);
      showClear();
      runRecommendation();
    } else {
      commitCategory(item.code);
    }
  }

  function refresh() {
    if (getCommitted() && input.value === getCommitted()) return hide();
    if (getCommitted()) { setCommitted(""); markSelected(false); }   // the text was edited: it is a new search
    const q = input.value.trim();
    if (!q) return hide();
    // A full 4-digit code we know is applied straight away. An unknown one gets its nearest neighbours instead of nothing.
    if (/^\d{4}$/.test(q)) {
      if (isKnownMcc(q)) return commitCategory(q);
      setSearchMode("mcc");
      items = nearestMccs(q, 6).map(h => ({ type: "category", code: h.code, label: `${h.code} · ${h.name}` }));
      active = -1;
      box.innerHTML = `<div class="rs-note">MCC ${escapeHtml(q)} isn't in our list yet. Closest codes:</div>` +
        items.map((item, i) => `<div class="rs-item" role="option" data-i="${i}"><span class="rs-name">${escapeHtml(item.label)}</span><span class="rs-tag">category</span></div>`).join("");
      box.hidden = false;
      return;
    }
    const retailerHits = searchRetailers(q, state.merchantOverrides, 6).map(({ retailer }) => ({ type: "retailer", retailer }));
    if (getSearchMode() === "retailer") {
      const known = retailerHits.flatMap(h => [h.retailer.name, ...(h.retailer.aliases || [])]);
      items = [...retailerHits, ...searchKrisPlus(q, 4, known).map(kris => ({ type: "kris", kris }))];
      if (!items.length) {
        if (!categoryMatches(q).length) return hide();
        items = [{ type: "switch", to: "mcc", label: `No retailer matches "${q}". Search it as an MCC category instead` }];
      }
    } else {
      items = categoryMatches(q, 6);
      if (!items.length) {
        if (!retailerHits.length) return hide();
        items = [{ type: "switch", to: "retailer", label: `"${q}" looks like a retailer name. Search it as a retailer instead` }];
      }
    }
    active = -1;
    box.innerHTML = items.map((item, i) => {
      if (item.type === "switch") {
        return `<div class="rs-item rs-switch" role="option" data-i="${i}"><span class="material-symbols-outlined">swap_horiz</span><span class="rs-name">${escapeHtml(item.label)}</span></div>`;
      }
      if (item.type === "category") {
        return `<div class="rs-item" role="option" data-i="${i}"><span class="rs-name">${escapeHtml(item.label)}</span><span class="rs-tag">category</span></div>`;
      }
      if (item.type === "kris") {
        const k = item.kris;
        return `<div class="rs-item" role="option" data-i="${i}"><span class="rs-name">${escapeHtml(k.name)}</span><span class="rs-cat">${escapeHtml(mccName(krisPlusMcc(k)))}</span><span class="rs-tag rs-kris">Kris+ ${k.mpd} mpd</span></div>`;
      }
      const r = item.retailer;
      const tags = [
        r.source === "household" ? `<span class="rs-tag rs-ok">household</span>` : "",
        r.promo ? `<span class="rs-tag rs-promo">${escapeHtml(r.promo)}</span>` : "",
        CONF_LABEL[r.conf] && r.source !== "household" ? `<span class="rs-tag rs-${r.conf}">${CONF_LABEL[r.conf]}</span>` : ""
      ].join("");
      const cat = mccName(r.mcc);
      return `<div class="rs-item" role="option" data-i="${i}"><span class="rs-name">${escapeHtml(r.name)}</span><span class="rs-cat">${escapeHtml(cat)}</span>${tags}</div>`;
    }).join("");
    box.hidden = false;
  }

  // pointerdown + preventDefault keeps focus in the input so blur doesn't close the list first.
  box.addEventListener("pointerdown", (e) => {
    const el = e.target.closest(".rs-item");
    if (!el) return;
    e.preventDefault();
    choose(Number(el.dataset.i));
  });

  input.addEventListener("input", refresh);
  input.addEventListener("focus", () => {
    refresh();
    if (getCommitted() && input.value === getCommitted()) input.select();   // typing replaces the selection
  });
  input.addEventListener("blur", () => setTimeout(hide, 120));
  input.addEventListener("keydown", (e) => {
    if (box.hidden) return;
    if (e.key === "ArrowDown") { e.preventDefault(); active = (active + 1) % items.length; highlight(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); active = (active - 1 + items.length) % items.length; highlight(); }
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); choose(active); }
    else if (e.key === "Escape") { hide(); }
  });
  document.getElementById("btnClearMcc")?.addEventListener("click", () => { setCommitted(""); markSelected(false); hide(); });
}
