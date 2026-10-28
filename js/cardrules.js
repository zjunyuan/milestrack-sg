// Per-card eligibility rules, taken from each bank's published terms and conditions.
// For these cards the recommender works out eligibility for ANY MCC from the rules below, instead of
// relying on hand-written per-category lists. Cards not listed here keep their lists in MCC_DATABASE.
//
// Sources (retrieved 28 Oct 2026). If a bank changes its terms, update the sets here and the date in `source`.
//   UOB Visa Signature T&C v2.1 (28 Oct 2025), UOB Preferred Visa T&C v3.0 (10 Mar 2026)
//   OCBC Rewards T&C (updated 5 Oct 2026), HSBC Revolution T&C (effective 1 Apr 2026)
//   DBS Woman's Card T&C (27 Jul 2026), DBS Rewards Programme T&C (Sep 2026)
//   Citi Rewards 10X T&C (effective 1 Apr 2024) + MileLion review (27 Feb 2026) for the MCC ranges
//   Maybank Horizon Visa Signature T&C (1 Dec 2025)

// ---- helpers -------------------------------------------------------------------------------------

// "3000-3350" style ranges or single codes -> predicate
function mccMatcher(items) {
  const singles = new Set();
  const ranges = [];
  for (const it of items) {
    if (typeof it === "string" && it.includes("-")) {
      const [a, b] = it.split("-").map(Number);
      ranges.push([a, b]);
    } else singles.add(String(it));
  }
  return (code) => {
    const n = Number(code);
    return singles.has(String(code)) || ranges.some(([a, b]) => n >= a && n <= b);
  };
}

const set = (...codes) => new Set(codes.flat().map(String));

// ---- exclusion lists -----------------------------------------------------------------------------

// UOB (Visa Signature, Preferred Visa, Lady's, PRVI, KrisFlyer all share this list)
export const UOB_EXCLUDED = set(
  "4829", "4900", "5199", "5960", "5965", "5993", "6012", "6050", "6051", "6211", "6300", "6513",
  "6529", "6530", "6534", "6540", "7349", "7511", "7523", "7995", "8062", "8211", "8220", "8241",
  "8244", "8249", "8299", "8398", "8651", "8661", "8699", "8999", "9211", "9222", "9223", "9311",
  "9399", "9402", "9405"
);

// DBS Woman's World: MCCs that earn no online bonus (Table 1 of the Woman's Card T&C)
export const DBS_ONLINE_EXCLUDED = set(
  "0763", "4784", "4829", "4900", "5047", "5199", "5960", "5993", "6010", "6011", "6012", "6050",
  "6051", "6211", "6300", "6381", "6399", "6513", "6529", "6530", "6534", "6540", "7261", "7276",
  "7311", "7322", "7339", "7349", "7372", "7375", "7393", "7399", "7511", "7523", "7995", "8062",
  "8111", "8211", "8220", "8241", "8244", "8249", "8299", "8398", "8651", "8661", "8699", "8911",
  "8931", "8999", "9211", "9222", "9223", "9311", "9399", "9402", "9405"
);

// Citi Rewards: travel MCCs earn no bonus, plus the general no-points categories
const citiExcluded = mccMatcher([
  "3000-3999", "4111", "4112", "4411", "4511", "4722", "4723", "4789", "5962", "7011", "7012", "7512",   // travel
  "8211-8299", "8398", "9000-9999", "6300", "8651-8661", "6529-6540", "6513", "4900",                    // general
  "6010", "6011", "6012", "6050", "6051", "6211", "4829", "7995",                                         // cash / gambling / brokerage
  "8062"                                                                                                   // hospitals: assumed excluded (not confirmed for Citi Rewards)
]);

// ---- whitelists ----------------------------------------------------------------------------------

// Citi Rewards: in-store MCCs that earn 4 mpd (online spend is covered by the exclusions above)
export const CITI_INSTORE_MCCS = set("5311", "5611", "5621", "5631", "5641", "5651", "5655", "5661", "5691", "5699", "5948");

// OCBC Rewards: 4 mpd MCCs. 5912 is kept because Watsons / Guardian / NTUC Unity are whitelisted by merchant name.
const OCBC_MCCS = set("5309", "5311", "5611", "5621", "5631", "5641", "5651", "5655", "5661", "5691", "5699", "5941", "5948", "5912");

// HSBC Revolution: 4 mpd MCCs (online or contactless only)
const hsbcEligible = mccMatcher([
  "3000-3350", "4511", "3351-3500", "3501-3999", "7011", "4411",
  "4816", "5045", "5262", "5309", "5310", "5311", "5331", "5399", "5611", "5621", "5631", "5641",
  "5651", "5655", "5661", "5691", "5699", "5732", "5733", "5734", "5735", "5912", "5942", "5944",
  "5945", "5946", "5947", "5948", "5949", "5964", "5965", "5966", "5967", "5968", "5969", "5970",
  "5992", "5999", "5441", "5462", "5811", "5812", "5813", "4121", "7997"
]);

// Maybank Horizon: local air tickets earn 2.8 mpd (3X + 4X bonus) once S$800 is spent in the month, capped at S$10,000
// of air-ticket spend. Other local categories earn only 1.2 mpd, below the everyday cards, so they are not listed.
const horizonAirTickets = mccMatcher(["4511", "3000-3350"]);

// ---- rule table ----------------------------------------------------------------------------------
// local / overseas: returns the bonus rate for that MCC, or 0 when not eligible.

export const CARD_RULES = {
  "uob-vs-contactless": { local: (c) => (UOB_EXCLUDED.has(c) ? 0 : 4.0), overseas: () => 0,
    source: "UOB Visa Signature T&C v2.1, 28 Oct 2025" },
  "uob-ppv-contactless": { local: (c) => (UOB_EXCLUDED.has(c) ? 0 : 4.0), overseas: (c) => (UOB_EXCLUDED.has(c) ? 0 : 4.0),
    source: "UOB Preferred Visa T&C v3.0, 10 Mar 2026" },
  "uob-vs-fcy": { local: () => 0, overseas: (c) => (UOB_EXCLUDED.has(c) ? 0 : 4.0),
    source: "UOB Visa Signature T&C v2.1, 28 Oct 2025" },
  "ocbc-rewards": { local: (c) => (OCBC_MCCS.has(c) ? 4.0 : 0), overseas: (c) => (OCBC_MCCS.has(c) ? 4.0 : 0),
    source: "OCBC Rewards T&C, updated 5 Oct 2026" },
  "citi-rewards": { local: (c) => (citiExcluded(c) ? 0 : 4.0), overseas: (c) => (citiExcluded(c) ? 0 : 4.0),
    source: "Citi Rewards 10X T&C (1 Apr 2024); in-store list in CITI_INSTORE_MCCS" },
  "hsbc-rev": { local: (c) => (hsbcEligible(c) ? 4.0 : 0), overseas: (c) => (hsbcEligible(c) ? 4.0 : 0),
    source: "HSBC Revolution T&C, effective 1 Apr 2026" },
  "dbs-wwmc": { local: (c) => (DBS_ONLINE_EXCLUDED.has(c) ? 0 : 4.0), overseas: (c) => (DBS_ONLINE_EXCLUDED.has(c) ? 0 : 4.0),
    source: "DBS Woman's Card T&C, 27 Jul 2026" },
  "mb-horizon-vs": { local: (c) => (horizonAirTickets(c) ? 2.8 : 0), overseas: null,   // overseas list stays hand-written
    source: "Maybank Horizon T&C, 1 Dec 2025" }
};

export const RULE_DRIVEN_IDS = Object.keys(CARD_RULES);

// Rewrites an entry's candidate lists so the rule-driven cards follow their published rules.
// Cards not in CARD_RULES are left exactly as the entry has them.
export function applyCardRules(entry) {
  if (!entry || entry.generated === "excluded") return entry;
  const code = entry.code;
  const rewrite = (list, key) => {
    const kept = (list || []).filter((c) => !(c.id in CARD_RULES && CARD_RULES[c.id][key]));
    for (const [id, rule] of Object.entries(CARD_RULES)) {
      if (!rule[key]) continue;
      const rate = rule[key](code);
      if (rate > 0) kept.push({ id, baseRate: rate });
    }
    return kept;
  };
  return {
    ...entry,
    candidatesLocal: rewrite(entry.candidatesLocal, "local"),
    candidatesOverseas: rewrite(entry.candidatesOverseas, "overseas")
  };
}
