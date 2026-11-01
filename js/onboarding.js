// First-run checklist (v1.63.0). A small card at the top of the home screen for someone who has not logged anything yet.
// Three steps tick themselves off from what the app already knows:
//   1. Choose your cards and statement dates: Settings has been saved (state.setup.saved, set from the Firestore settings document).
//   2. Try the recommender: a retailer or MCC and an amount were typed (one localStorage flag, wrapped in try/catch).
//   3. Log your first spend: state.transactions is no longer empty.
// It only shows while the vault has no entries, so anyone who already uses the app never sees it. Closing it hides it for this visit;
// "Hide for good" (or finishing the last step) stores one localStorage flag. Nothing is written to Firestore.
import { state } from "./state.js";
import { openSettingsModal } from "./ui.js";
import { showSettingsTab } from "./settings-ui.js";

const HIDE_KEY = "milestrack_onboarding";      // "1" = never show again
const REC_KEY = "milestrack_onb_rec";          // "1" = the recommender has been tried
const get = (k) => { try { return localStorage.getItem(k) === "1"; } catch (_) { return false; } };
const set = (k) => { try { localStorage.setItem(k, "1"); } catch (_) { /* optional */ } };

let closedThisVisit = false;
let sawChecklist = false;      // true once the checklist has been on screen in this visit, so finishing shows a short "all set"
let timer = 0;

const isDemo = () => new URLSearchParams(location.search).has("demo");
const forced = () => new URLSearchParams(location.search).has("onboarding");   // ?onboarding previews it on any account

export function onboardingSteps() {
  return [
    { id: "setup", title: "Choose your cards and statement dates", note: "Only enabled cards are ranked. Dates decide each card's billing cycle.", done: !!(state.setup && state.setup.saved), cta: "Open Settings", act: "settings" },
    { id: "rec", title: "Try the recommender", note: "Type a shop (try Starbucks) and an amount to see which card to swipe.", done: get(REC_KEY), cta: "Try it", act: "rec" },
    { id: "log", title: "Log your first spend", note: "Tap Log on a result, or the + button. Caps, History and the Vault fill from here.", done: state.transactions.length > 0, cta: "Log a spend", act: "log" }
  ];
}

// Visible while nothing is logged; after the first entry it stays for one "all set" view in the same visit.
export function shouldShowOnboarding() {
  if (isDemo() || closedThisVisit || get(HIDE_KEY)) return false;
  if (state.userRole === "GUEST") return false;
  if (forced()) return true;
  if (!state.txLoaded) return false;                       // wait until the entries have arrived, so nobody sees a flash
  if (state.transactions.length > 0) return sawChecklist;   // already a user: never show; just finished: show the all-set view
  return true;
}

function html(steps) {
  const doneCount = steps.filter(s => s.done).length;
  const all = doneCount === steps.length;
  if (all) {
    return `<div class="onb-card onb-done" role="region" aria-label="Getting started">
      <button class="onb-x" id="onbX" aria-label="Close">&times;</button>
      <div class="onb-title">You're all set 🎉</div>
      <div class="onb-note">Your caps, History and Vault now fill as you log spend. Import a bank statement any time to check it against your entries.</div>
      <button class="onb-link" id="onbGotIt">Got it</button>
    </div>`;
  }
  const next = steps.find(s => !s.done);
  return `<div class="onb-card" role="region" aria-label="Getting started">
    <button class="onb-x" id="onbX" aria-label="Close">&times;</button>
    <div class="onb-title">Get started <span class="onb-count">${doneCount} of ${steps.length}</span></div>
    <ol class="onb-steps">${steps.map(s => `
      <li class="onb-step${s.done ? " is-done" : ""}${s === next ? " is-next" : ""}">
        <span class="onb-tick" aria-hidden="true">${s.done ? "✓" : ""}</span>
        <div class="onb-body">
          <div class="onb-st">${s.title}</div>
          ${s === next ? `<div class="onb-note">${s.note}</div><button type="button" class="onb-cta" data-act="${s.act}">${s.cta}</button>` : ""}
        </div>
      </li>`).join("")}
    </ol>
    <button class="onb-link" id="onbHide">Hide for good</button>
  </div>`;
}

export function renderOnboarding() {
  const host = document.getElementById("onboardCard");
  if (!host) return;
  if (!shouldShowOnboarding()) { host.innerHTML = ""; return; }
  sawChecklist = true;
  host.innerHTML = html(onboardingSteps());
}

function act(name) {
  if (name === "settings") { openSettingsModal(); showSettingsTab("cards"); return; }
  if (name === "rec") {
    const box = document.getElementById("mccInput");
    box?.scrollIntoView({ behavior: "smooth", block: "center" });
    box?.focus({ preventScroll: true });
    return;
  }
  if (name === "log") document.getElementById("fabButton")?.click();
}

const schedule = () => { clearTimeout(timer); timer = setTimeout(renderOnboarding, 900); };   // settle: the settings and entries snapshots arrive separately

export function initOnboarding() {
  const host = document.getElementById("onboardCard");
  if (!host) return;
  host.addEventListener("click", (e) => {
    const cta = e.target.closest(".onb-cta");
    if (cta) { act(cta.dataset.act); return; }
    if (e.target.closest("#onbX")) { closedThisVisit = true; renderOnboarding(); return; }
    if (e.target.closest("#onbHide") || e.target.closest("#onbGotIt")) { set(HIDE_KEY); closedThisVisit = true; renderOnboarding(); }
  });
  // Step 2 ticks once both the search box and the amount have something in them.
  const tried = () => {
    const q = (document.getElementById("mccInput")?.value || "").trim();
    const a = parseFloat((document.getElementById("recAmount")?.value || "").replace(/,/g, ""));
    if (q && a > 0 && !get(REC_KEY)) { set(REC_KEY); renderOnboarding(); }
  };
  document.getElementById("mccInput")?.addEventListener("input", tried);
  document.getElementById("recAmount")?.addEventListener("input", tried);
  for (const ev of ["settings-updated", "txns-updated", "vault-updated"]) window.addEventListener(ev, schedule);
  schedule();
}
