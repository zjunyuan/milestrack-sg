// Browse and search every Kris+ earning merchant from the recommender. Tapping one fills the recommender with it.
import { setSearchMode } from "./search-mode.js";
import { KRISPLUS_MERCHANTS, KRISPLUS_META } from "./krisplus-merchants.js";
import { normalizeText, escapeHtml } from "./retailers.js";

const CATS = ["All", "Dining", "Retail", "Activities", "Services", "Wellness"];
const K = { cat: "All", q: "", sort: "rate" };
const $ = (id) => document.getElementById(id);

function render() {
  const q = normalizeText(K.q);
  let list = KRISPLUS_MERCHANTS.filter(m => (K.cat === "All" || m.category === K.cat) && (!q || m.full.includes(q) || m.base.includes(q)));
  list = list.slice().sort(K.sort === "rate" ? (a, b) => b.mpd - a.mpd || a.name.localeCompare(b.name) : (a, b) => a.name.localeCompare(b.name));
  $("kpCount").textContent = `${list.length} of ${KRISPLUS_MERCHANTS.length} merchants`;
  $("kpChips").innerHTML = CATS.map(c => `<button type="button" class="kp-chip ${K.cat === c ? "on" : ""}" data-cat="${c}">${c}</button>`).join("")
    + `<button type="button" class="kp-chip ${K.sort === "az" ? "on" : ""}" data-sort="1">${K.sort === "rate" ? "Sorted: highest rate" : "Sorted: A to Z"}</button>`;
  $("kpList").innerHTML = list.length ? list.map((m, i) => `<button type="button" class="hm-row kp-row" data-name="${escapeHtml(m.name)}">
      <div class="hm-row-main"><b>${escapeHtml(m.name)}</b><div class="st-sub">${escapeHtml(m.category)}</div></div>
      <div class="kp-rate">${m.mpd} mpd</div></button>`).join("") : `<div class="hm-note">No Kris+ merchant matches. Not on the list does not mean it is not on Kris+: the list can be out of date.</div>`;
}

export function openKrisPlusBrowser() {
  $("kpIntro").innerHTML = `${KRISPLUS_MERCHANTS.length} Singapore merchants that earn Kris+ miles, as listed by ${escapeHtml(KRISPLUS_META.source)} on ${escapeHtml(KRISPLUS_META.asOf)} (<a href="${KRISPLUS_META.url}" target="_blank" rel="noopener" style="color:var(--kris-cyan);">source</a>). Rates change often: check the Kris+ app. Tap a merchant to see the best card for it.`;
  render();
  $("kpOverlay")?.classList.add("open");
}
export function closeKrisPlusBrowser() { $("kpOverlay")?.classList.remove("open"); }

export function initKrisPlusBrowser() {
  $("btnKpBrowse")?.addEventListener("click", openKrisPlusBrowser);
  $("btnCloseKp")?.addEventListener("click", closeKrisPlusBrowser);
  $("kpOverlay")?.addEventListener("click", e => { if (e.target.id === "kpOverlay") closeKrisPlusBrowser(); });
  $("kpSearch")?.addEventListener("input", e => { K.q = e.target.value; render(); });
  $("kpChips")?.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.sort) K.sort = K.sort === "rate" ? "az" : "rate"; else if (b.dataset.cat) K.cat = b.dataset.cat;
    render();
  });
  $("kpList")?.addEventListener("click", e => {
    const row = e.target.closest(".kp-row"); if (!row) return;
    const input = $("mccInput");
    if (input) { setSearchMode("retailer"); input.value = row.dataset.name; input.dispatchEvent(new Event("input", { bubbles: true })); input.scrollIntoView({ block: "center", behavior: "smooth" }); }
    closeKrisPlusBrowser();
  });
}
