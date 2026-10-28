// Single place that knows about every MCC: curated bonus categories (MCC_DATABASE),
// the full reference list (MCC_NAMES), and the generated fallbacks for everything else.
import { MCC_DATABASE, ALL_MASTER_CARDS } from "./config.js";
import { MCC_NAMES, COMMONLY_EXCLUDED_MCCS } from "./mcc-names.js";
import { normalizeText } from "./retailers.js";

export function shortCategory(name = "") {
  return name.replace(/\s*\(.*?\)\s*/g, " ").replace(/\s+/g, " ").trim();
}

export function isKnownMcc(code) {
  return Object.prototype.hasOwnProperty.call(MCC_DATABASE, code) || Object.prototype.hasOwnProperty.call(MCC_NAMES, code);
}

export function mccName(code) {
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

// The recommender's view of a category: curated rules if we have them, otherwise a generated
// "base rate" or "commonly excluded" entry. Returns null for unknown codes.
export function getMccEntry(code) {
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
    notes: `ℹ️ No bonus category is set up for MCC ${code}. Showing your best everyday-spend cards at their base rate. Banks sometimes exclude or boost specific merchants, so check your card's T&Cs.`,
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
  const curated = Object.keys(MCC_DATABASE).sort();
  const others = Object.keys(MCC_NAMES).filter(c => !MCC_DATABASE[c]).sort();
  return `<optgroup label="Your card-rule categories">${curated.map(opt).join("")}</optgroup>` +
         `<optgroup label="Other categories (base rate)">${others.map(opt).join("")}</optgroup>`;
}
