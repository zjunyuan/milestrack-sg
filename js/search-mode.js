// Retailer / MCC search switch for the recommender box.
// "Retailer" searches brand names (curated retailers and Kris+ merchants); "MCC" searches category codes and names.
// It filters what the dropdown suggests and sets the placeholder. The recommender itself still understands both kinds of text, so
// anything pasted or set by other screens keeps working, and those screens switch the mode to match.
import { state } from "./state.js";

const KEY = "milestrack_search_mode";
const PLACEHOLDER = {
  retailer: "Search a retailer or brand, e.g. Starbucks",
  mcc: "Type an MCC code or category, e.g. 5411, grocery"
};

export function getSearchMode() { return state.searchMode === "mcc" ? "mcc" : "retailer"; }

// Sets the mode. Clears the box only when `clear` is true (the person tapped the switch), not when another screen fills the box.
export function setSearchMode(mode, { clear = false } = {}) {
  mode = mode === "mcc" ? "mcc" : "retailer";
  const changed = state.searchMode !== mode;
  state.searchMode = mode;
  try { localStorage.setItem(KEY, mode); } catch (e) { /* private mode: fine */ }
  document.querySelectorAll("#searchModeToggle [data-mode]").forEach(b => {
    const on = b.dataset.mode === mode;
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", on ? "true" : "false");
  });
  const input = document.getElementById("mccInput");
  if (input) input.placeholder = PLACEHOLDER[mode];
  if (clear && changed && input) {
    input.value = "";
    delete input.dataset.committed;
    input.closest(".mcc-input-wrapper")?.classList.remove("has-selection");
    const x = document.getElementById("btnClearMcc"); if (x) x.style.display = "none";
    state.selectedRetailer = null;
    input.focus();
    input.dispatchEvent(new Event("input", { bubbles: true }));   // re-runs the recommender and closes the dropdown
  }
  return changed;
}

export function initSearchMode() {
  let saved = "retailer";
  try { saved = localStorage.getItem(KEY) || "retailer"; } catch (e) { /* ignore */ }
  setSearchMode(saved);
  document.getElementById("searchModeToggle")?.addEventListener("click", e => {
    const b = e.target.closest("[data-mode]");
    if (b) setSearchMode(b.dataset.mode, { clear: true });
  });
}
