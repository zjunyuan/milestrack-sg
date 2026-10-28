// Single place that knows about every MCC: curated bonus categories (MCC_DATABASE),
// the full reference list (MCC_NAMES), and the generated fallbacks for everything else.
import { MCC_DATABASE, ALL_MASTER_CARDS } from "./config.js";
import { MCC_NAMES, COMMONLY_EXCLUDED_MCCS } from "./mcc-names.js";
import { normalizeText, escapeHtml } from "./retailers.js";
import { state } from "./state.js";
import { applyCardRules } from "./cardrules.js";

export function shortCategory(name = "") {
  return name.replace(/\s*\(.*?\)\s*/g, " ").replace(/\s+/g, " ").trim();
}

// Airline MCCs 3000-3299 are one block with one code per carrier. They are recognised as a range so the
// reference list and pickers are not filled with 300 near-identical rows; each follows the Airlines (4511) rules.
export function isAirlineRangeMcc(code) {
  return /^3\d{3}$/.test(String(code)) && Number(code) >= 3000 && Number(code) <= 3299;
}

export function isKnownMcc(code) {
  if (isAirlineRangeMcc(code)) return true;
  return Object.prototype.hasOwnProperty.call(MCC_DATABASE, code) || Object.prototype.hasOwnProperty.call(MCC_NAMES, code);
}

export function mccName(code) {
  if (isAirlineRangeMcc(code)) return `Airlines (MCC ${code})`;
  if (MCC_DATABASE[code]) return shortCategory(MCC_DATABASE[code].name);
  return MCC_NAMES[code] || code;
}

// Everyday-spend cards: uncapped and earning >= 1 mpd on ordinary local spend.
function generalLocalCandidates() {
  return ALL_MASTER_CARDS
    .filter(c => c.monthlyCap >= 999999 && Number(c.baseMpd) >= 1)
    .map(c => ({ id: c.id, baseRate: c.baseMpd }));
}

// Same overseas picks the app already uses for "any merchant, foreign currency" (see FCY-GEN in recommender.js).
const GENERAL_OVERSEAS_CANDIDATES = [
  { id: "uob-vs-fcy", baseRate: 4.0 },
  { id: "mb-world-mc", baseRate: 3.2 },
  { id: "mb-horizon-vs", baseRate: 2.8 },
  { id: "uob-prvi", baseRate: 2.4 }
];

// ---- Household rules (set by the admin, stored in Firestore milestrack_mccRules) -------------------
// A rule REPLACES the built-in entry for its category (both local and overseas lists) until it expires.

const todayStr = () => new Date().toLocaleDateString("en-CA");   // YYYY-MM-DD in the device's time zone

export function ruleIsActive(rule, today = todayStr()) {
  return !!rule && (!rule.expires || today <= rule.expires);
}

function fmtDate(ymd) {
  const [y, m, d] = String(ymd).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// Cleans a raw Firestore doc (or an optimistic payload). Returns null if it isn't usable.
export function normalizeRule(data) {
  if (!data || typeof data.mcc !== "string" || !isKnownMcc(data.mcc)) return null;
  const clean = (list) => {
    const seen = new Set();
    const out = [];
    for (const c of Array.isArray(list) ? list : []) {
      if (!c || seen.has(c.id) || !ALL_MASTER_CARDS.some(m => m.id === c.id)) continue;
      const rate = Math.round(Number(c.rate) * 100) / 100;
      if (!(rate > 0 && rate <= 10)) continue;
      seen.add(c.id);
      out.push({ id: c.id, rate });
    }
    return out;
  };
  return {
    mcc: data.mcc,
    local: clean(data.local),
    overseas: clean(data.overseas),
    note: typeof data.note === "string" ? data.note.slice(0, 200) : "",
    expires: typeof data.expires === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.expires) ? data.expires : "",
    updatedBy: typeof data.updatedBy === "string" ? data.updatedBy : "",
    updatedAt: Number(data.updatedAt) || 0
  };
}

function applyRule(base, rule) {
  const when = rule.updatedAt ? ` · set ${new Date(rule.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : "";
  const until = rule.expires ? ` · valid until ${fmtDate(rule.expires)}` : "";
  const empty = !rule.local.length && !rule.overseas.length ? "<br>❌ Your household marked this category as earning no bonus." : "";
  return {
    ...base,
    generated: undefined,
    notes: `🏠 <b>Household rule</b>${when}${until}${rule.note ? "<br>" + escapeHtml(rule.note) : ""}${empty}`,
    candidatesLocal: rule.local.map(c => ({ id: c.id, baseRate: c.rate })),
    candidatesOverseas: rule.overseas.map(c => ({ id: c.id, baseRate: c.rate })),
    householdRule: rule
  };
}

// The recommender's view of a category: an active household rule, else the built-in entry.
export function getMccEntry(code) {
  const base = getBuiltinMccEntry(code);
  if (!base) return null;
  const rule = state.mccRules && state.mccRules[code];
  return ruleIsActive(rule) ? applyRule(base, rule) : base;
}

// Built-in view of a category: curated rules if we have them, otherwise a generated
// "base rate" or "commonly excluded" entry. Returns null for unknown codes.
export function getBuiltinMccEntry(code) {
  return applyCardRules(rawBuiltinEntry(code));
}

function rawBuiltinEntry(code) {
  if (isAirlineRangeMcc(code)) {
    const air = MCC_DATABASE["4511"];
    return { code, ...air, name: `Airlines (MCC ${code}; the airline block is 3000-3299, one code per carrier)`,
             notes: air.notes + "<br>ℹ️ Airline codes 3000-3299 follow the same rules as MCC 4511." };
  }
  if (MCC_DATABASE[code]) return { code, ...MCC_DATABASE[code] };
  const name = MCC_NAMES[code];
  if (!name) return null;

  if (COMMONLY_EXCLUDED_MCCS.has(code)) {
    return {
      code, name, generated: "excluded",
      notes: "❌ Commonly excluded from rewards by Singapore banks (cash, gambling, tax, rent, government and similar). It usually earns nothing, so confirm with your card's T&Cs.",
      candidatesLocal: [],
      candidatesOverseas: []
    };
  }
  return {
    code, name, generated: "baseline",
    notes: `ℹ️ No hand-written rules for MCC ${code}. Showing cards whose published terms cover it, plus your best everyday cards at their base rate. Banks sometimes exclude or boost specific merchants, so check your card's T&Cs.`,
    candidatesLocal: generalLocalCandidates(),
    candidatesOverseas: GENERAL_OVERSEAS_CANDIDATES
  };
}

// Search categories by code prefix or name. Curated categories come first.
export function searchMccs(query, limit = 3) {
  const q = normalizeText(query);
  if (q.length < 2) return [];
  const all = [
    ...Object.keys(MCC_DATABASE),
    ...Object.keys(MCC_NAMES).filter(code => !MCC_DATABASE[code])
  ];
  const hits = [];
  if (/^\d{2,4}$/.test(q)) {
    for (let n = 3000; n <= 3299; n++) {
      const code = String(n);
      if (code.startsWith(q) && !all.includes(code)) all.push(code);
    }
  }
  for (const code of all) {
    const name = mccName(code);
    const n = normalizeText(name);
    let score = 0;
    if (code === q) score = 100;
    else if (/^\d+$/.test(q)) score = code.startsWith(q) ? 80 : 0;
    else if (n.startsWith(q)) score = 70;
    else if (q.length >= 3 && n.split(" ").some(w => w.startsWith(q))) score = 60;
    else if (q.length >= 4 && n.includes(q)) score = 50;
    if (score) hits.push({ code, name, score, curated: !!MCC_DATABASE[code] });
  }
  return hits
    .sort((a, b) => b.score - a.score || (b.curated - a.curated) || a.code.localeCompare(b.code))
    .slice(0, limit);
}

// Closest known codes to a typed 4-digit code that we have no entry for, nearest first.
export function nearestMccs(code, limit = 6) {
  const n = Number(code);
  if (!/^\d{4}$/.test(String(code))) return [];
  const all = new Set([...Object.keys(MCC_DATABASE), ...Object.keys(MCC_NAMES)]);
  return [...all]
    .map(c => ({ code: c, name: mccName(c), d: Math.abs(Number(c) - n) }))
    .sort((a, b) => a.d - b.d || a.code.localeCompare(b.code))
    .slice(0, limit);
}

// A category only auto-resolves from a typed name when exactly one category matches it.
export function findMccByName(query) {
  const q = normalizeText(query);
  if (q.length < 4) return null;
  const hits = searchMccs(q, 3).filter(h => h.score >= 50);
  return hits.length === 1 ? hits[0].code : null;
}

// <option> list for pickers: your curated categories first, then the full reference list.
export function mccOptionsHtml(selected, escape = s => s) {
  const opt = code => `<option value="${code}" ${code === selected ? "selected" : ""}>${code} · ${escape(mccName(code))}</option>`;
  const ruled = new Set([...Object.keys(MCC_DATABASE), ...Object.keys(state.mccRules || {})]);
  const curated = [...ruled].filter(isKnownMcc).sort();
  const others = Object.keys(MCC_NAMES).filter(c => !ruled.has(c)).sort();
  return `<optgroup label="Your card-rule categories">${curated.map(opt).join("")}</optgroup>` +
         `<optgroup label="Other categories (base rate)">${others.map(opt).join("")}</optgroup>`;
}
