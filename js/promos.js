// Time-limited card promotions (v1.63.80). Pure helpers, no DOM: the recommender, the cap bars and the log form read these.
//
// UOB PRVI Miles "Up to 5 miles per S$1" overseas dining & shopping campaign, 18 Nov - 31 Dec 2026.
// Source: UOB's own T&C (uob.com.sg .../prvi-miles-card/prvi-miles-card-fx-tnc-cmpg.pdf, read 20 Nov 2026) and the promotion page
// (forms.uob.com.sg .../promotions/cards/prvi-miles.html); MileLion 18 Nov 2026 for the posting deadline and the cost per mile.
//  - Bonus per S$5 of in-person spend, rounded down per transaction, on top of the card's own overseas rate:
//      Regional (IDR / MYR / THB / VND, processed in that country): base UNI$7.5 + bonus UNI$5   = 3 + 2   = 5 mpd
//      Other foreign currency (processed outside Singapore):          base UNI$6   + bonus UNI$6.5 = 2.4 + 2.6 = 5 mpd
//  - Needs S$1,500 of eligible regional / overseas spend in the period (one total for every PRVI card of one person, supplementary
//    spend counts toward the principal's). Below that, no bonus at all.
//  - Bonus capped at UNI$4,000 (8,000 miles) for the whole period, regional and overseas together.
//  - Dining MCCs and shopping MCCs below only; online transactions, hotel / country-club F&B, grocery stores and supermarkets, DCC
//    (paying in SGD abroad), fees and reversals do not count.
//  - Registration by 31 Dec 2026 (UOB TMRW > Rewards+, or the promotion page); spend before registering counts.
//  - Base UNI$ post with each charge; the bonus is credited within two months after the period (by 28 Feb 2027), on a statement.
// The app keeps entries at the card's own overseas rate (what UOB posts) and shows the bonus as a promotion total; when UOB pays it,
// "🎁 Add a one-off bonus" on that statement's banner records it (it suggests this figure).
import { ALL_MASTER_CARDS, DEFAULT_VAULT } from "./config.js";
import { state } from "./state.js";
import { PRVI_REGIONAL, fxCurrency, isPrviForeign } from "./cardrules.js";

const set = (...a) => new Set(a.map(String));

// Each promotion has a `kind` (v1.63.83): "bonus" = a separate capped bonus the bank pays later, tracked until it lands (PRVI);
// "rate" = the card simply earns a higher rate on qualifying charges while it runs (Maybank Horizon 8X), with no bar, no registration
// and no one-off bonus entry.
export const PROMOS = [{
  id: "prvi-fcy-2026-11",
  kind: "bonus",
  cardId: "uob-prvi",
  title: "UOB PRVI overseas dining & shopping",
  short: "PRVI 5 mpd promo",
  from: "2026-11-18", to: "2026-12-31", registerBy: "2026-12-31", bonusBy: "2027-02-28",
  minSpend: 1500,
  capPts: 4000,                                               // bonus UNI$ for the whole period (= 8,000 miles)
  per5: { regional: { base: 7.5, bonus: 5 }, other: { base: 6, bonus: 6.5 } },   // UNI$ per S$5
  inPersonOnly: true,
  dining: set(5441, 5451, 5462, 5499, 5812, 5813, 5814, 5912, 5921),
  shopping: set(5309, 5310, 5311, 5331, 5399, 5611, 5621, 5631, 5641, 5651, 5655, 5661, 5681, 5691, 5697, 5698, 5699, 5732, 5733, 5735,
    5941, 5942, 5943, 5944, 5945, 5946, 5947, 5948, 5949, 5950, 5970, 5971, 5977, 5993, 5994, 5999),
  excluded: "online payments (QR ordering, Alipay / WeChat Pay, Kris+, ride-hailing, food delivery), hotel and country-club F&B, supermarkets, paying in SGD (DCC)",
  register: "UOB TMRW app > Rewards+, or UOB's PRVI Miles promotion page",
  url: "https://forms.uob.com.sg/eservices/personal/promotions/cards/prvi-miles.html"
}, {
  // Maybank Horizon Visa Signature "8X TREATS Points" on spend in eight Asian currencies, 1 Nov 2026 - 31 Jan 2027 (both inclusive).
  // Source: Maybank's own T&C (maybank2u.com.sg .../promos/tp-8-asian-currencies-tnc.pdf) and the card page, read 20 Nov 2026.
  //  - 8X = 3X base + 4X foreign-currency bonus (needs the S$800 monthly minimum spend) + 1X promo extra = 3.2 mpd.
  //  - Counted by the currency the charge POSTS in (online included), not where the merchant is.
  //  - Horizon only (not Maybank World). No cap and no registration stated. Points per S$5 block per transaction, rounded down.
  //  - Open point: below S$800 only the 4X is clearly lost; the app treats the whole 8X as needing S$800, like Horizon's own tier.
  // Rebuilt in v1.63.83 from the notes of the v1.63.81 patch, which never reached the repo.
  id: "horizon-asia8-2026-11",
  kind: "rate",
  cardId: "mb-horizon-vs",
  title: "Maybank Horizon 8X in Asian currencies",
  short: "Horizon 8X Asia promo",
  from: "2026-11-01", to: "2027-01-31", bonusBy: "2027-01-31",
  mpd: 3.2,
  minSpend: 800,                                               // per calendar month, Horizon's own tier
  currencies: set("MYR", "IDR", "THB", "HKD", "TWD", "RMB", "CNY", "KRW", "JPY"),
  label: "JPY, KRW, CNY, HKD, TWD, THB, MYR or IDR",
  url: "https://www.maybank2u.com.sg/iwov-resources/sg/pdf/promos/tp-8-asian-currencies-tnc.pdf"
}];

export const ASIA8 = "ASIA8";                                  // "one of the eight currencies", chosen by hand on the log form
export const isBonusPromo = (p) => !!p && p.kind !== "rate";
export const isRatePromo = (p) => !!p && p.kind === "rate";

const DAY = 86400000;
export const dayStr = (ts) => new Date(ts).toLocaleDateString("en-CA");          // YYYY-MM-DD, device time zone
const todayStr = () => dayStr(Date.now());
const dayEnd = (ymd) => { const [y, m, d] = ymd.split("-").map(Number); return new Date(y, m - 1, d, 23, 59, 59, 999).getTime(); };
export const fmtDay = (ymd) => { const [y, m, d] = ymd.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short" }); };

// Running now (spend counts) / still relevant (running, or its bonus not yet due).
export const activePromo = (cardId, today = todayStr()) => PROMOS.find(p => p.cardId === cardId && p.from <= today && today <= p.to) || null;
export const livePromo = (cardId, today = todayStr()) => PROMOS.find(p => p.cardId === cardId && p.from <= today && today <= p.bonusBy) || null;
export const daysLeft = (p, now = Date.now()) => Math.max(0, Math.ceil((dayEnd(p.to) - now) / DAY));

// What the user told the app about a promotion (settings doc `promos`, per vault): registered, region ("other" | "regional"),
// skip (won't reach the minimum, so do not plan around it).
export function promoPrefs(p) {
  const v = (state.promos && state.promos[p.id]) || {};
  if (isRatePromo(p)) return { region: v.region === "asia" ? "asia" : "other" };   // "asia" = paying in one of the promo's currencies
  return { registered: !!v.registered, region: v.region === "regional" ? "regional" : "other", skip: !!v.skip };
}

// A rate promotion's mpd for a charge on `cardId` in currency `cur` (ISO code, or ASIA8 chosen by hand) on day `ts`; 0 = not covered.
export function promoRateFor(cardId, cur, ts = Date.now()) {
  const c = String(cur || "").toUpperCase(), d = dayStr(Number(ts) || Date.now());
  const p = PROMOS.find(x => isRatePromo(x) && x.cardId === cardId && x.from <= d && d <= x.to);
  return p && (c === ASIA8 || p.currencies.has(c)) ? p.mpd : 0;
}

export const promoMccOk = (p, mcc) => !!mcc && (p.dining.has(String(mcc)) || p.shopping.has(String(mcc)));
export const promoKind = (p, mcc) => (p.dining.has(String(mcc)) ? "dining" : p.shopping.has(String(mcc)) ? "shopping" : "");
export const regionOfCur = (cur) => { const c = String(cur || "").toUpperCase(); return PRVI_REGIONAL.has(c) || c === "REGIONAL" ? "regional" : "other"; };
export const mpdOf = (per5, ratio = 2) => Math.round(per5 * ratio / 5 * 100) / 100;   // UNI$ per S$5 -> miles per S$1
export const ratioOf = (p) => {
  const card = ALL_MASTER_CARDS.find(c => c.id === p.cardId);
  const vk = card && card.vaultKey;
  return Number(state.myVault && state.myVault[vk] && state.myVault[vk].ratio) || Number(DEFAULT_VAULT[vk] && DEFAULT_VAULT[vk].ratio) || 1;
};
// Bonus UNI$ for one charge: per S$5, rounded down per transaction (T&C).
export const bonusPtsFor = (p, amt, region) => Math.floor(Math.floor((Number(amt) || 0) / 5) * p.per5[region].bonus);

// Does a logged entry count toward the promotion? mccOfEntry(tx) gives its MCC (the entry's own, else from the merchant name).
// Online-only exclusions cannot be seen on an entry, so every foreign charge with an eligible MCC is counted.
export function promoEligible(p, tx, mccOfEntry) {
  if (!tx || tx.cardId !== p.cardId) return false;
  if (tx.refunded || tx.noPoints || tx.promoBonus || tx.feeBonus || !(Number(tx.amt) > 0)) return false;
  if (!isPrviForeign(tx.cardId, tx)) return false;
  const d = dayStr(Number(tx.timestamp) || 0);
  if (d < p.from || d > p.to) return false;
  if (tx.postTs && dayStr(tx.postTs) > p.to) return false;                // must post by the end of the period
  return promoMccOk(p, mccOfEntry(tx));
}

// The promotion so far: eligible spend, bonus UNI$ (capped), minimum met, room left, and the entries counted.
export function promoProgress(p, txns, mccOfEntry) {
  const rows = (txns || []).filter(t => promoEligible(p, t, mccOfEntry)).map(t => {
    const region = regionOfCur(fxCurrency(t));
    return { tx: t, region, pts: bonusPtsFor(p, t.amt, region) };
  });
  const spend = rows.reduce((s, r) => s + (Number(r.tx.amt) || 0), 0);
  const raw = rows.reduce((s, r) => s + r.pts, 0);
  const pts = Math.min(p.capPts, raw);
  const ratio = ratioOf(p);
  const met = spend >= p.minSpend;
  return {
    rows, spend, rawPts: raw, pts, miles: pts * ratio, capMiles: p.capPts * ratio,
    capLeftPts: Math.max(0, p.capPts - raw), met, needMore: Math.max(0, p.minSpend - spend),
    earned: met ? pts : 0                                                   // what UOB pays if nothing else is spent
  };
}

// S$ of foreign spend (before the FX fee) that still earns the bonus, given the bonus UNI$ left and the billed-amount factor.
export function roomSpend(p, capLeftPts, region, billedFactor = 1) {
  const per5 = p.per5[region].bonus;
  if (!(capLeftPts > 0)) return 0;
  return Math.ceil((capLeftPts / per5) * 5 / billedFactor);
}
