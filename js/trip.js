// Trip setting for Overseas mode (v1.63.88). One answer to "where are you?" drives everything that used to ask separately:
// the UOB PRVI promotion's region, the Maybank Horizon 8X currency question and the log form's "Where was it charged?".
// Kept on the device (localStorage `milestrack_trip`: { on, place, until }), not in Firestore: the phone that is abroad is the one that
// needs it, it works in ?demo, and no rules change. The mode now survives a reload and switches itself off after the "back on" date.
import { state } from "./state.js";
import { escapeHtml } from "./retailers.js";

const KEY = "milestrack_trip";

// cur "" = not said: the promotion callouts then ask their own question, as before.
export const TRIP_PLACES = [
  { id: "JP", name: "Japan", cur: "JPY" },
  { id: "KR", name: "South Korea", cur: "KRW" },
  { id: "TW", name: "Taiwan", cur: "TWD" },
  { id: "HK", name: "Hong Kong", cur: "HKD" },
  { id: "CN", name: "China", cur: "CNY" },
  { id: "TH", name: "Thailand", cur: "THB" },
  { id: "MY", name: "Malaysia", cur: "MYR" },
  { id: "ID", name: "Indonesia", cur: "IDR" },
  { id: "VN", name: "Vietnam", cur: "VND" },
  { id: "PH", name: "Philippines", cur: "PHP" },
  { id: "AU", name: "Australia", cur: "AUD" },
  { id: "NZ", name: "New Zealand", cur: "NZD" },
  { id: "EU", name: "Europe (euro)", cur: "EUR" },
  { id: "GB", name: "United Kingdom", cur: "GBP" },
  { id: "US", name: "United States", cur: "USD" },
  { id: "", name: "Somewhere else", cur: "" }
];

// Quick categories for shops the retailer list will never know. Each is one representative MCC, so the usual rules pick the card.
export const TRIP_CATEGORIES = [
  { label: "Dining", icon: "🍜", mcc: "5812" },
  { label: "Shops", icon: "🛍️", mcc: "5311" },
  { label: "Minimart", icon: "🏪", mcc: "5499" },
  { label: "Hotel", icon: "🏨", mcc: "7011" },
  { label: "Trains", icon: "🚆", mcc: "4111" },
  { label: "Taxi", icon: "🚕", mcc: "4121" },
  { label: "Sights", icon: "🎡", mcc: "7991" },
  { label: "Other", icon: "💳", mcc: "" }
];

const today = () => new Date().toLocaleDateString("en-CA");                    // YYYY-MM-DD, device time zone
const fmtDay = (ymd) => { const [y, m, d] = ymd.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short" }); };
const placeOf = (id) => TRIP_PLACES.find(p => p.id === id) || TRIP_PLACES[TRIP_PLACES.length - 1];

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!v || typeof v !== "object") return { on: false, place: "", until: "" };
    return { on: !!v.on, place: TRIP_PLACES.some(p => p.id === v.place) ? v.place : "", until: /^\d{4}-\d{2}-\d{2}$/.test(v.until || "") ? v.until : "" };
  } catch (e) { return { on: false, place: "", until: "" }; }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ on: !!state.isOverseasMode, place: state.trip.place, until: state.trip.until })); } catch (e) { /* private mode: the mode just won't stick */ }
}

// The trip's currency while Overseas mode is on ("" when off or not said). promos.js reads this through state.trip.
export const tripCur = () => (state.isOverseasMode && state.trip && placeOf(state.trip.place).cur) || "";
export const tripPlaceName = () => (state.trip && state.trip.place ? placeOf(state.trip.place).name : "");

function paint() {
  const on = !!state.isOverseasMode;
  const bar = document.getElementById("overseasBar"), text = document.getElementById("overseasText");
  const sw = document.getElementById("overseasSwitch"), row = document.getElementById("tripRow");
  const place = placeOf(state.trip.place), cur = place.cur;
  if (sw) sw.checked = on;
  bar?.classList.toggle("active", on);
  document.body.classList.toggle("overseas-on", on);
  if (text) {
    if (!on) text.textContent = "Mode: Singapore (Local SGD)";
    else text.innerHTML = `<span style="color:var(--fcy-cyan);">Overseas${state.trip.place ? `: ${escapeHtml(place.name)}${cur ? ` (${cur})` : ""}` : " (FCY spend)"}${state.trip.until ? ` · till ${fmtDay(state.trip.until)}` : ""}</span>`;
  }
  if (row) row.hidden = !on;
  const sel = document.getElementById("tripPlace"), until = document.getElementById("tripUntil"), tip = document.getElementById("tripTip");
  if (sel) sel.value = state.trip.place;
  if (until) { until.value = state.trip.until; until.min = today(); }
  if (tip) tip.innerHTML = `💱 <b>Always pay in ${cur || "the local currency"}, never SGD.</b> Choosing SGD at the terminal costs more and the overseas rates and promos don't apply.`
    + (state.trip.until ? "" : ` <span class="trip-tip-soft">Set "Back on" and this mode switches itself off after that day.</span>`);
  const cats = document.getElementById("fcyCats");
  if (cats) cats.hidden = !on || state.isKrisPlusMode;
}

// Past the "back on" date: back to Singapore, and the date is cleared so the next trip starts clean.
function expireIfOver() {
  if (!state.isOverseasMode || !state.trip.until || today() <= state.trip.until) return false;
  state.isOverseasMode = false;
  state.trip.until = "";
  save();
  return true;
}

// rerun() re-runs the recommender; pickCategory(label, mcc) selects a category in its search box ("" = general spend abroad).
export function initTrip({ rerun, pickCategory }) {
  const saved = load();
  state.trip = { place: saved.place, until: saved.until };
  state.isOverseasMode = saved.on;
  expireIfOver();

  const sel = document.getElementById("tripPlace");
  if (sel) sel.innerHTML = `<option value="">Choose a country…</option>` + TRIP_PLACES.filter(p => p.id).map(p => `<option value="${p.id}">${escapeHtml(p.name)} · ${p.cur}</option>`).join("") + `<option value="">Somewhere else</option>`;
  const cats = document.getElementById("fcyCats");
  if (cats) {
    cats.innerHTML = TRIP_CATEGORIES.map(c => `<button type="button" class="fcy-cat" data-mcc="${c.mcc}" data-label="${escapeHtml(c.label)}">${c.icon} ${escapeHtml(c.label)}</button>`).join("");
    cats.addEventListener("click", (e) => {
      const b = e.target.closest(".fcy-cat");
      if (!b) return;
      pickCategory(b.dataset.label, b.dataset.mcc);
    });
  }

  const changed = () => { save(); paint(); window.dispatchEvent(new Event("trip-updated")); rerun(); };
  document.getElementById("overseasSwitch")?.addEventListener("change", (e) => { state.isOverseasMode = e.target.checked; changed(); });
  sel?.addEventListener("change", () => { state.trip.place = sel.value; changed(); });
  document.getElementById("tripUntil")?.addEventListener("change", (e) => { state.trip.until = e.target.value || ""; changed(); });
  // An app left open over the end of the trip (or reopened from the background) checks again.
  document.addEventListener("visibilitychange", () => { if (!document.hidden && expireIfOver()) { paint(); rerun(); } });

  paint();
  if (state.isOverseasMode) rerun();
}

// Marks the chip matching what the search box holds (called after every recommender run).
export function markTripCategory(mcc, general) {
  document.querySelectorAll("#fcyCats .fcy-cat").forEach(b => b.classList.toggle("on", general ? b.dataset.mcc === "" : (!!mcc && b.dataset.mcc === mcc)));
  const cats = document.getElementById("fcyCats");
  if (cats) cats.hidden = !state.isOverseasMode || state.isKrisPlusMode;
}
