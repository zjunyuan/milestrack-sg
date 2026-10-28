// Typeahead dropdown for the MCC / retailer input.
import { state } from "./state.js";
import { searchRetailers, normalizeText, escapeHtml } from "./retailers.js";
import { runRecommendation, selectRetailer } from "./recommender.js";
import { searchMccs, mccName } from "./mcc.js";

const CONF_LABEL = { high: "", medium: "varies", low: "unsure" };

function categoryMatches(q) {
  return searchMccs(q, 3).map(h => ({ type: "category", code: h.code, label: `${h.code} · ${h.name}` }));
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

  function hide() { box.hidden = true; active = -1; }

  function highlight() {
    box.querySelectorAll(".rs-item").forEach((el, i) => el.classList.toggle("active", i === active));
    box.querySelector(".rs-item.active")?.scrollIntoView({ block: "nearest" });
  }

  function choose(i) {
    const item = items[i];
    if (!item) return;
    hide();
    if (item.type === "retailer") {
      selectRetailer(item.retailer);
    } else {
      state.selectedRetailer = null;
      input.value = item.code;
      document.getElementById("btnClearMcc") && (document.getElementById("btnClearMcc").style.display = "flex");
      runRecommendation();
    }
  }

  function refresh() {
    const q = input.value.trim();
    if (!q || /^\d{4}$/.test(q)) return hide();
    items = [
      ...searchRetailers(q, state.merchantOverrides, 6).map(({ retailer }) => ({ type: "retailer", retailer })),
      ...categoryMatches(q)
    ];
    if (!items.length) return hide();
    active = -1;
    box.innerHTML = items.map((item, i) => {
      if (item.type === "category") {
        return `<div class="rs-item" role="option" data-i="${i}"><span class="rs-name">${escapeHtml(item.label)}</span><span class="rs-tag">category</span></div>`;
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
  input.addEventListener("focus", refresh);
  input.addEventListener("blur", () => setTimeout(hide, 120));
  input.addEventListener("keydown", (e) => {
    if (box.hidden) return;
    if (e.key === "ArrowDown") { e.preventDefault(); active = (active + 1) % items.length; highlight(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); active = (active - 1 + items.length) % items.length; highlight(); }
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); choose(active); }
    else if (e.key === "Escape") { hide(); }
  });
  document.getElementById("btnClearMcc")?.addEventListener("click", hide);
}
