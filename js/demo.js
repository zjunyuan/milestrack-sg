// Demo mode: open the app with `?demo` to run it on made-up data. Nothing is read from or written to Firebase,
// nothing is saved, and a reload starts the demo again. All of it lives here plus a one-line guard at the top of each
// exported function in firebase.js, so the rest of the app runs unchanged.
//
// Keep it current: if you add a Firestore collection, a transaction field or a setting that a screen depends on,
// give this file matching sample data or a matching `demo*` handler (unknown writes are harmless no-ops).
import { state } from "./state.js";
import { ALL_MASTER_CARDS, ALL_VAULT_KEYS, VAULT_LABELS, DEFAULT_VAULT, normalizeVault } from "./config.js";

export const isDemo = () => {
  try { return new URLSearchParams(location.search).has("demo"); } catch (e) { return false; }
};

// Made-up names so no real household member shows up.
const DEMO_LABELS = { primary: "Demo Household", sister: "Sam", ellice: "Jordan", eugene: "Riley", test: "Test" };

// Points per vault (raw points, converted to miles by each currency's ratio).
const DEMO_POINTS = {
  primary: { uob_uni: 118000, citi_typ: 61000, citi_miles: 24500, dbs_pts: 76000, yuu_pts: 84000, ocbc_pts: 52000, hsbc_pts: 31000, mb_treats: 18000, kf_direct: 41200 },
  sister: { uob_uni: 24000, kf_direct: 9800 },
  ellice: { kf_direct: 12400, dbs_pts: 8000 },
  eugene: {},
  test: { uob_uni: 11000 }
};

// [description, cardId, min S$, max S$, weight]
const TEMPLATES = [
  ["Cold Storage", "uob-ppv-contactless", 20, 140, 5],
  ["FairPrice", "uob-ppv-contactless", 15, 120, 5],
  ["Starbucks", "uob-ppv-contactless", 6, 22, 5],
  ["McDonald's", "uob-ls-dining", 8, 30, 3],
  ["Grab", "dbs-wwmc", 8, 35, 6],
  ["Gojek", "dbs-wwmc", 8, 28, 3],
  ["Shopee", "uob-ppv-online", 15, 160, 4],
  ["Lazada", "uob-ppv-online", 20, 220, 3],
  ["foodpanda", "dbs-yuu", 18, 75, 5],
  ["SimplyGo", "dbs-yuu", 5, 30, 4],
  ["7-Eleven", "dbs-yuu", 3, 18, 3],
  ["Heymax", "hsbc-rev", 10, 80, 2],
  ["Netflix", "hsbc-rev", 15, 22, 1],
  ["Uniqlo", "citi-rewards", 40, 240, 2],
  ["Zara", "citi-rewards", 60, 260, 1],
  ["Scoot", "kf-uob", 120, 640, 1],
  ["Shell", "uob-vs-contactless", 40, 90, 2],
  ["Klook", "uob-vs-fcy", 60, 300, 1],
  ["Sephora", "ocbc-rewards", 30, 190, 2]
];

// Same rounding as recommender.js calcEarnedMiles (kept here so this file needs no import from the recommender).
function milesFor(card, amt, rate) {
  if (card.engine === "yuu-10") return Math.round(amt * rate);
  if (card.engine === "uob-5" || card.engine === "ocbc-5") return Math.round(Math.floor(amt / 5) * 5 * rate);
  return Math.round(Math.floor(amt) * rate);
}

function makeTransactions(now = new Date()) {
  let seed = 20260101;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const total = TEMPLATES.reduce((s, t) => s + t[4], 0);
  const pick = () => { let r = rnd() * total; for (const t of TEMPLATES) { r -= t[4]; if (r <= 0) return t; } return TEMPLATES[0]; };
  const out = [];
  let n = 0;
  for (let back = 2; back >= 0; back--) {
    const first = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const days = back === 0 ? now.getDate() : new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const count = back === 0 ? Math.max(8, Math.round(days * 1.6)) : 46;
    const spentOn = {};
    const items = [];
    for (let i = 0; i < count; i++) {
      const [desc, cardId, lo, hi] = pick();
      const day = 1 + Math.floor(rnd() * days);
      const amt = Math.round((lo + rnd() * (hi - lo)) * 100) / 100;
      items.push({ desc, cardId, amt, day });
    }
    items.sort((a, b) => a.day - b.day).forEach(({ desc, cardId, amt, day }) => {
      const card = ALL_MASTER_CARDS.find(c => c.id === cardId);
      if (!card) return;
      const before = spentOn[cardId] || 0;
      const bonus = before < card.monthlyCap;
      spentOn[cardId] = before + amt;
      const miles = milesFor(card, amt, bonus ? card.bonusMpd : card.baseMpd);
      const ratio = DEFAULT_VAULT[card.vaultKey]?.ratio || 1;
      const d = new Date(first.getFullYear(), first.getMonth(), day, 12, 0, 0);
      const id = `demo-${++n}`;
      const tx = {
        id, firestoreId: id, owner: "primary", timestamp: d.getTime(), desc, amt, cardId,
        bonusCategory: bonus ? "bonus" : "base", miles, earnedRawPoints: Math.round(miles / ratio),
        date: d.toLocaleDateString("en-GB")
      };
      if (card.id.startsWith("uob") && rnd() < 0.5) tx.postTs = d.getTime() + (1 + Math.floor(rnd() * 2)) * 86400000;
      out.push(tx);
    });
  }
  return out.sort((a, b) => a.timestamp - b.timestamp);
}

const vaultFrom = (points) => {
  const v = normalizeVault({});
  Object.entries(points).forEach(([k, p]) => { if (v[k]) v[k].points = p; });
  return v;
};
const fire = (name) => window.dispatchEvent(new CustomEvent(name));

export function startDemo(onAuthSuccess) {
  Object.assign(VAULT_LABELS, DEMO_LABELS);
  state.demo = true;
  state.currentUser = { email: "Demo visitor" };
  state.myVaultKey = "primary";
  state.userRole = "PRIMARY";
  state.myVault = vaultFrom(DEMO_POINTS.primary);
  ALL_VAULT_KEYS.forEach(k => { state.allVaultsData[k] = vaultFrom(DEMO_POINTS[k] || {}); });
  state.vaultLoaded = true;
  state.transactions = makeTransactions();
  state.uobRenewals = { solitaire: "2023-11", visaSig: "2024-03", ppv: "2024-05", prvi: "2024-07", kf: "" };
  state.cards = ALL_MASTER_CARDS.filter(c => state.enabledCardIds.includes(c.id));

  const bar = document.createElement("div");
  bar.id = "demoBar";
  bar.innerHTML = `🧪 Demo: sample data, nothing saved <a href="${location.pathname}">Exit demo</a>`;
  document.body.appendChild(bar);
  const sync = document.getElementById("syncStatusIndicator");
  if (sync) setTimeout(() => { sync.innerText = "● Demo data"; }, 0);

  onAuthSuccess(state.currentUser);
  fire("vault-updated"); fire("all-vaults-updated"); fire("settings-updated"); fire("merchants-updated"); fire("rules-updated"); fire("txns-updated");
}

// In-memory stand-ins for the Firestore writes in firebase.js.
export function demoSaveTx(id, payload) {
  const i = state.transactions.findIndex(t => t.id === id);
  const rec = { ...payload, firestoreId: id };
  if (i >= 0) state.transactions[i] = rec; else state.transactions.push(rec);
  state.transactions.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  fire("txns-updated");
}
export function demoDeleteTx(id) {
  state.transactions = state.transactions.filter(t => t.id !== id);
  fire("txns-updated");
}
export function demoUpdateVault(key, payload) {
  state.allVaultsData[key] = payload;
  if (key === state.myVaultKey) state.myVault = payload;
  fire("vault-updated"); fire("all-vaults-updated");
}
export function demoSettings(key, partial) {
  if (partial.uobRenewals) state.uobRenewals = { ...state.uobRenewals, ...partial.uobRenewals };
  if (Number.isFinite(Number(partial.uobStatementDay))) state.uobStatementDay = Number(partial.uobStatementDay);
  if (partial.feeCards && typeof partial.feeCards === "object") state.feeCards = { ...partial.feeCards };
  if (partial.feeAlerts && typeof partial.feeAlerts === "object") state.feeAlerts = { ...state.feeAlerts, ...partial.feeAlerts };
  if (Array.isArray(partial.enabledCards)) {
    state.enabledCardIds = partial.enabledCards;
    state.cards = ALL_MASTER_CARDS.filter(c => state.enabledCardIds.includes(c.id));
  }
  if (partial.citiApprovalDate) state.citiApprovalDate = partial.citiApprovalDate;
  fire("settings-updated");
}
export function demoMerchant(slug, data) {
  const next = { ...state.merchantOverrides };
  if (data) next[slug] = data; else delete next[slug];
  state.merchantOverrides = next;
  fire("merchants-updated");
}
export function demoRule(code, data) {
  const next = { ...state.mccRules };
  if (data) next[code] = data; else delete next[code];
  state.mccRules = next;
  fire("rules-updated");
}
