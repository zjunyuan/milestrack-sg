export const APP_VERSION = "v1.46.0";

export const PRIMARY_EMAILS = [
  "zjunyuan@gmail.com",
  "eunice.er.yc@gmail.com"
];

export const SISTER_EMAILS = [
  "minsyyy@gmail.com"
];

export const ELLICE_EMAILS = ["ellicee@gmail.com"];
export const EUGENE_EMAILS = ["geneer@gmail.com"];
export const TEST_EMAILS = ["junyuanxeunice@gmail.com"];

// Firestore vault doc IDs. "primary" is the household vault (kept as-is so existing data keeps working).
// What one mile is worth, in cents. Used only for the overseas "after fees" comparison (js/fcy.js).
export const FCY_MILE_VALUE_CENTS = 1.3;
// Banks award miles on the billed amount, which includes the FX fee (S$100 abroad bills S$103.25 at 3.25%). A card can override with fcyEarnsOnFee: false.
export const FCY_EARN_ON_FEE = true;

export const ALL_VAULT_KEYS = ["primary", "sister", "ellice", "eugene", "test"];
export const VAULT_LABELS = {
  primary: "Zhangs",
  sister: "Minsi",
  ellice: "Ellice",
  eugene: "Eugene",
  test: "Test"
};

export const firebaseConfig = {
  apiKey: "AIzaSyDnx1mvY8dRPsvtgHLjZvoAFkE1JmAbACk",
  authDomain: "milestracker-sg.firebaseapp.com",
  projectId: "milestracker-sg",
  storageBucket: "milestracker-sg.firebasestorage.app",
  messagingSenderId: "323564797306",
  appId: "1:323564797306:web:f0e41ab676ae207d62aac3"
};

export const DEFAULT_PRESETS = [
  { id: 'p_fp', label: 'foodpanda', icon: '🐼', cardId: 'dbs-yuu', desc: 'foodpanda' },
  { id: 'p_cs', label: 'Cold Storage', icon: '🛒', cardId: 'dbs-yuu', desc: 'Cold Storage' },
  { id: 'p_fairprice_app', label: 'FairPrice App', icon: '🍎', cardId: 'uob-ppv-online', desc: 'NTUC FairPrice (App)' },
  { id: 'p_mcd_online', label: "McDonald's (Online)", icon: '🍔', cardId: 'uob-ls-dining', desc: "McDonald's" },
  { id: 'p_shell', label: "Shell (14% off)", icon: '⛽', cardId: 'uob-ppv-contactless', desc: "Shell Service Station (14% off)" },
  { id: 'p_dine', label: 'Restaurant', icon: '🍽️', cardId: 'uob-ls-dining', desc: 'Restaurant Dining' }
];

export const CATEGORY_POOLS = [
  {
    id: "dining",
    name: "Dining & Food Places",
    icon: "🍽️",
    cardIds: ["uob-ls-dining", "hsbc-rev", "uob-ppv-contactless", "uob-ppv-online", "uob-vs-contactless"],
    notes: "Restaurants, cafes, caterers, fast food. Contactless tap applies in-person; online slots apply in-app."
  },
  {
    id: "groceries",
    name: "Supermarkets & Groceries",
    icon: "🛒",
    cardIds: ["dbs-yuu", "uob-ppv-contactless", "uob-ppv-online", "hsbc-rev"],
    notes: "yuu stores (Cold Storage/Giant), FairPrice App & general supermarkets."
  },
  {
    id: "shopping",
    name: "Online Shopping & Fashion",
    icon: "🛍️",
    cardIds: ["ocbc-rewards", "dbs-wwmc", "citi-rewards", "uob-ppv-online"],
    notes: "OCBC 6 mpd promo, Shopee, Lazada, Taobao, Uniqlo, fashion whitelists."
  },
  {
    id: "travel",
    name: "Travel, Flights & Hotels",
    icon: "✈️",
    cardIds: ["dbs-wwmc", "uob-ls-travel"],
    notes: "SIA, Scoot, Agoda, Klook, OTA hotels. Citi & HSBC strictly excluded."
  },
  {
    id: "transport",
    name: "Transport & SimplyGo",
    icon: "🚇",
    cardIds: ["dbs-yuu", "uob-ppv-contactless", "dbs-wwmc"],
    notes: "SimplyGo bus/train, Grab, Gojek ride hailing."
  },
  {
    id: "petrol",
    name: "Petrol / Fuel (Shell)",
    icon: "⛽",
    cardIds: ["uob-ppv-contactless", "uob-vs-contactless"],
    notes: "Shell: UOB PPV (Mobile Tap, 14% off, S$600 cap) or UOB VS (14% off, min S$1k). Maybank World MC earns 4 mpd uncapped."
  }
];

export const KRISFLYER_4PAX_TIERS = [
  { name: "Bali / KL / Surabaya (Zone 2)", oneWay: 22000, totalMiles: 176000 },
  { name: "Bangkok / Phuket / Vietnam (Zone 3)", oneWay: 25000, totalMiles: 200000 },
  { name: "Hong Kong / Taipei (Zone 4)", oneWay: 36500, totalMiles: 292000 },
  { name: "Perth / Darwin (Zone 8)", oneWay: 42500, totalMiles: 340000 },
  { name: "Tokyo / Osaka / Seoul (Zone 7)", oneWay: 54500, totalMiles: 436000 },
  { name: "Sydney / Melbourne / Auckland (Zone 9)", oneWay: 72000, totalMiles: 576000 },
  { name: "London / Paris / Zurich (Zone 11)", oneWay: 108500, totalMiles: 868000 },
  { name: "USA West / East Coast (Zone 12/13)", oneWay: 112500, totalMiles: 900000 }
];

export const YUU_PARTNER_BRANDS = [
  "cold storage", "cs fresh", "jasons", "giant", 
  "guardian", "7-eleven", "7-11", "foodpanda", 
  "gojek", "simplygo", "chagee", "singtel", "charge+", "anywheel"
];

export function detectYuuMerchant(desc = "") {
  const clean = (desc || "").toLowerCase();
  if (clean.includes("on the go") || clean.includes("onthego")) {
    return null;
  }
  for (const brand of YUU_PARTNER_BRANDS) {
    if (clean.includes(brand)) {
      if (brand.includes("cold") || brand.includes("cs fresh") || brand.includes("jasons")) return "Cold Storage";
      if (brand.includes("giant")) return "Giant";
      if (brand.includes("guardian")) return "Guardian";
      if (brand.includes("7-eleven") || brand.includes("7-11")) return "7-Eleven";
      if (brand.includes("foodpanda")) return "foodpanda";
      if (brand.includes("gojek")) return "Gojek";
      if (brand.includes("simplygo")) return "SimplyGo";
      if (brand.includes("chagee")) return "CHAGEE";
      if (brand.includes("singtel")) return "Singtel";
      if (brand.includes("charge+")) return "Charge+";
      if (brand.includes("anywheel")) return "Anywheel";
    }
  }
  return null;
}

export const DEFAULT_VAULT = {
  uob_uni: { name: 'UOB UNI$', points: 0, ratio: 2.0, unit: 'UNI$', rule: '2 yrs from quarter end' },
  citi_typ: { name: 'Citi TYP', points: 0, ratio: 0.4, unit: 'TYP', rule: '5 yrs from card approval' },
  citi_miles: { name: 'Citi Miles', points: 0, ratio: 1.0, unit: 'miles', rule: 'Never Expire (Non-pooling)' },
  dbs_pts: { name: 'DBS Points', points: 0, ratio: 2.0, unit: 'pts', rule: '1-3 yrs / Altitude never expires' },
  yuu_pts: { name: 'yuu Points', points: 0, ratio: 0.28, unit: 'pts', rule: '2 yrs from month earned' },
  ocbc_pts: { name: 'OCBC$', points: 0, ratio: 0.4, unit: 'pts', rule: '2 yrs from month earned' },
  hsbc_pts: { name: 'HSBC Points', points: 0, ratio: 0.4, unit: 'pts', rule: '37 months from month earned' },
  mb_treats: { name: 'Maybank TREATS', points: 0, ratio: 0.4, unit: 'pts', rule: '1-3 yrs validity' },
  kf_direct: { name: 'KrisFlyer Miles', points: 0, ratio: 1.0, unit: 'miles', rule: '3 yrs in KrisFlyer' },
  trust_miles: { name: 'Trust Miles', points: 0, ratio: 1.0, unit: 'miles', rule: 'End of 3rd year after earned (per MileLion, not in Trust T&Cs)' }
};

// Builds a complete vault from a stored Firestore doc. The app owns each currency's name, ratio, unit and rule;
// the doc only supplies the points. A doc with partial entries (for example just {points: 0}) therefore can no
// longer show "undefined" or use the wrong ratio. Extra currencies that carry their own name and unit are kept.
export function normalizeVault(data) {
  const src = data && typeof data === "object" ? data : {};
  const out = {};
  for (const [key, def] of Object.entries(DEFAULT_VAULT)) {
    const stored = src[key] && typeof src[key] === "object" ? src[key] : {};
    const pts = Number(stored.points);
    out[key] = { ...def, points: Number.isFinite(pts) ? pts : 0 };
  }
  for (const [key, item] of Object.entries(src)) {
    if (key in DEFAULT_VAULT || !item || typeof item !== "object") continue;
    if (item.name && item.unit) out[key] = { ratio: 1, points: 0, ...item };
  }
  return out;
}

export const ALL_MASTER_CARDS = [
  { 
    id: 'dbs-yuu', 
    fcyFee: 3.25,   // % charged on foreign-currency spend (incl. the 1% Visa/Mastercard fee); not used by the recommender yet
    fcyFeeSource: 'DBS fee page (official): 1% network + 2.25% bank, checked 29 Oct 2026. Paying in SGD abroad (DCC) is 1%.',
    annualFee: 'waived',   // 'waived' = auto-waived, 'none' = no fee: no fee alert for this card
    shortName: 'DBS yuu',
    name: 'DBS yuu Card (10 mpd)', 
    bank: 'yuu', 
    image: 'assets/cards/dbs-yuu.png',
    vaultKey: 'yuu_pts', 
    monthlyCap: 822.86, 
    minSpend: 800, 
    bonusMpd: 10.0, 
    baseMpd: 0.14, 
    engine: 'yuu-10', 
    cycleType: 'calendar', 
    strategyType: 'whitelist',
    badgeClass: 'badge-gold', 
    hint: 'Cold Storage, Giant, Guardian, 7-11, foodpanda, Gojek, SimplyGo, CHAGEE, Singtel, Charge+. CHAGEE counts only when paid in its app. Req: S$800 min spend + 4 distinct merchants.', 
    isContactlessOnly: false,
    channelMode: 'both',
    themeClass: 'thumb-yuu'
  },
  { 
    id: 'uob-ppv-contactless', 
    fcyFee: 3.25,   // % charged on foreign-currency spend (incl. the 1% Visa/Mastercard fee); not used by the recommender yet
    fcyFeeSource: "UOB fee-revision notice (official, uob.com.sg .../news-announcements/revision-fees-charge.pdf): foreign exchange administrative fee 3.25% on the converted amount, all UOB personal credit cards, from 9 Mar 2020. Notice is from 2020 and gives no GST or DCC wording; MileLion's 25 May 2026 table still shows 3.25%. Checked 29 Oct 2026.",
    shortName: 'UOB PPV.Tap',
    name: 'UOB Preferred Visa (Mobile Tap)', 
    bank: 'UOB', 
    image: 'assets/cards/uob-ppv.png',
    vaultKey: 'uob_uni', 
    monthlyCap: 600, 
    minSpend: 0, 
    bonusMpd: 4.0, 
    baseMpd: 0.4, 
    engine: 'uob-5', 
    cycleType: 'calendar', 
    strategyType: 'blacklist',
    badgeClass: '', 
    hint: 'Apple/Google Pay tap & SimplyGo only. Disqualified on in-app Kris+.', 
    isContactlessOnly: true,
    channelMode: 'inperson',
    themeClass: 'thumb-uob'
  },
  { 
    id: 'uob-ppv-online', 
    fcyFee: 3.25,   // % charged on foreign-currency spend (incl. the 1% Visa/Mastercard fee); not used by the recommender yet
    fcyFeeSource: "UOB fee-revision notice (official, uob.com.sg .../news-announcements/revision-fees-charge.pdf): foreign exchange administrative fee 3.25% on the converted amount, all UOB personal credit cards, from 9 Mar 2020. Notice is from 2020 and gives no GST or DCC wording; MileLion's 25 May 2026 table still shows 3.25%. Checked 29 Oct 2026.",
    shortName: 'UOB PPV.Online',
    name: 'UOB Preferred Visa (Online)', 
    bank: 'UOB', 
    image: 'assets/cards/uob-ppv.png',
    vaultKey: 'uob_uni', 
    monthlyCap: 600, 
    minSpend: 0, 
    bonusMpd: 4.0, 
    baseMpd: 0.4, 
    engine: 'uob-5', 
    cycleType: 'calendar', 
    strategyType: 'whitelist',
    badgeClass: '', 
    hint: '4 mpd on online retail purchases at whitelisted MCCs (department and retail, supermarkets, dining and food delivery, entertainment). S$600/month sub-cap. Not air tickets, and not sporting goods (5941) or sports apparel (5655).', 
    isContactlessOnly: false,
    channelMode: 'online',
    themeClass: 'thumb-uob'
  },
  { 
    id: 'uob-vs-contactless', 
    fcyFee: 3.25,   // % charged on foreign-currency spend (incl. the 1% Visa/Mastercard fee); not used by the recommender yet
    fcyFeeSource: "UOB fee-revision notice (official, uob.com.sg .../news-announcements/revision-fees-charge.pdf): foreign exchange administrative fee 3.25% on the converted amount, all UOB personal credit cards, from 9 Mar 2020. Notice is from 2020 and gives no GST or DCC wording; MileLion's 25 May 2026 table still shows 3.25%. Checked 29 Oct 2026.",
    shortName: 'UOB VS.Tap',
    name: 'UOB Visa Signature (Contactless / Petrol)', 
    bank: 'UOB', 
    image: 'assets/cards/uob-vs.png',
    vaultKey: 'uob_uni', 
    monthlyCap: 1200, 
    minSpend: 1000, 
    bonusMpd: 4.0, 
    baseMpd: 0.4, 
    engine: 'uob-5', 
    cycleType: 'statement', 
    cutoffDay: 18, 
    strategyType: 'blacklist',
    badgeClass: '', 
    hint: 'Physical NFC terminal tap required (min S$1k/cycle). 14% instant off at Shell.', 
    isContactlessOnly: true,
    channelMode: 'inperson',
    themeClass: 'thumb-uob'
  },
  { 
    id: 'uob-vs-fcy', 
    fcyFee: 3.25,   // % charged on foreign-currency spend (incl. the 1% Visa/Mastercard fee); not used by the recommender yet
    fcyFeeSource: "UOB fee-revision notice (official, uob.com.sg .../news-announcements/revision-fees-charge.pdf): foreign exchange administrative fee 3.25% on the converted amount, all UOB personal credit cards, from 9 Mar 2020. Notice is from 2020 and gives no GST or DCC wording; MileLion's 25 May 2026 table still shows 3.25%. Checked 29 Oct 2026.",
    shortName: 'UOB VS.FCY',
    name: 'UOB Visa Signature (FCY Overseas)', 
    bank: 'UOB', 
    image: 'assets/cards/uob-vs.png',
    vaultKey: 'uob_uni', 
    monthlyCap: 1200, 
    minSpend: 1000, 
    bonusMpd: 4.0, 
    baseMpd: 0.4, 
    engine: 'uob-5', 
    cycleType: 'statement', 
    cutoffDay: 18, 
    strategyType: 'blacklist',
    badgeClass: '', 
    hint: '4.0 mpd on ANY MCC in FCY! Min S$1,000 FCY in statement cycle.', 
    isContactlessOnly: false,
    channelMode: 'both',
    themeClass: 'thumb-uob'
  },
  { 
    id: 'citi-rewards', 
    fcyFee: 3.25,   // % charged on foreign-currency spend (incl. the 1% Visa/Mastercard fee); not used by the recommender yet
    fcyFeeSource: 'Citi PremierMiles Cardmembers Agreement cl. 6.9 (official, docs/bank-tnc): up to 3.25% on the converted SGD amount. DCC 1%. SGD spend with overseas merchants 1%. GST not mentioned. Checked 29 Oct 2026.',
    shortName: 'Citi Rewards',
    name: 'Citi Rewards', 
    bank: 'Citi', 
    image: 'assets/cards/citi-rewards.png',
    vaultKey: 'citi_typ', 
    monthlyCap: 1000, 
    minSpend: 0, 
    bonusMpd: 4.0, 
    baseMpd: 0.4, 
    engine: 'citi-1', 
    cycleType: 'statement', 
    cutoffDay: 15, 
    strategyType: 'blacklist',
    badgeClass: '', 
    hint: 'Online shopping & in-store fashion. ⚠️ Excludes in-app mobile wallets (Kris+)!', 
    isContactlessOnly: false,
    channelMode: 'both',
    themeClass: 'thumb-citi'
  },
  { 
    id: 'ocbc-rewards', 
    fcyFee: 3.25,   // % charged on foreign-currency spend (incl. the 1% Visa/Mastercard fee); not used by the recommender yet
    fcyFeeSource: "OCBC Fees and Charges (official, ocbc.com/assets/pdf/fees_charges.pdf, version 1 Oct 2025): 3.25% of the foreign amount (1% network + 2.25% bank) since 3 Dec 2019. Extra 1% on SGD spend processed overseas (DCC, overseas websites billed in SGD). GST not mentioned. Checked 29 Oct 2026.",
    shortName: 'OCBC Rewards',
    name: 'OCBC Rewards / Titanium', 
    bank: 'OCBC', 
    image: 'assets/cards/ocbc-rewards.png',
    vaultKey: 'ocbc_pts', 
    monthlyCap: 1110, 
    minSpend: 0, 
    bonusMpd: 4.0, 
    baseMpd: 0.4, 
    engine: 'ocbc-5', 
    cycleType: 'calendar', 
    strategyType: 'whitelist',
    badgeClass: '', 
    hint: 'Department stores, fashion whitelist, Watsons, Shopee, Lazada & HeyMax Shell vouchers (S$1,110 cap).', 
    isContactlessOnly: false,
    channelMode: 'both',
    themeClass: 'thumb-ocbc'
  },
  { 
    id: 'dbs-wwmc', 
    fcyFee: 3.25,   // % charged on foreign-currency spend (incl. the 1% Visa/Mastercard fee); not used by the recommender yet
    fcyFeeSource: 'DBS fee page (official): 1% network + 2.25% bank, checked 29 Oct 2026. Paying in SGD abroad (DCC) is 1%.',
    annualFee: 'waived',   // 'waived' = auto-waived, 'none' = no fee: no fee alert for this card
    shortName: 'DBS WWMC',
    name: "DBS Woman's World Card", 
    bank: 'DBS', 
    image: 'assets/cards/dbs-wwmc.png',
    vaultKey: 'dbs_pts', 
    monthlyCap: 1000, 
    minSpend: 0, 
    bonusMpd: 4.0, 
    baseMpd: 0.4, 
    engine: 'dbs-5', 
    cycleType: 'calendar', 
    strategyType: 'blacklist',
    badgeClass: '', 
    hint: 'Online blacklist winner: 4.0 mpd on all online spend & all Kris+ merchants.', 
    isContactlessOnly: false,
    channelMode: 'online',
    themeClass: 'thumb-dbs'
  },
  { 
    id: 'uob-ls-dining', 
    fcyFee: 3.25,   // % charged on foreign-currency spend (incl. the 1% Visa/Mastercard fee); not used by the recommender yet
    fcyFeeSource: "UOB fee-revision notice (official, uob.com.sg .../news-announcements/revision-fees-charge.pdf): foreign exchange administrative fee 3.25% on the converted amount, all UOB personal credit cards, from 9 Mar 2020. Notice is from 2020 and gives no GST or DCC wording; MileLion's 25 May 2026 table still shows 3.25%. Checked 29 Oct 2026.",
    shortName: 'UOB LS.Dining',
    name: "UOB Lady's Solitaire (Dining)", 
    bank: 'UOB', 
    image: 'assets/cards/uobladysolitaire.png',
    vaultKey: 'uob_uni', 
    monthlyCap: 750, 
    minSpend: 0, 
    bonusMpd: 4.0, 
    baseMpd: 0.4, 
    engine: 'uob-5', 
    cycleType: 'calendar', 
    strategyType: 'whitelist',
    badgeClass: '', 
    hint: 'Restaurants, cafes, bars. Works on Kris+ for dining merchants.', 
    isContactlessOnly: false,
    channelMode: 'both',
    themeClass: 'thumb-uob'
  },
  { 
    id: 'uob-ls-travel', 
    fcyFee: 3.25,   // % charged on foreign-currency spend (incl. the 1% Visa/Mastercard fee); not used by the recommender yet
    fcyFeeSource: "UOB fee-revision notice (official, uob.com.sg .../news-announcements/revision-fees-charge.pdf): foreign exchange administrative fee 3.25% on the converted amount, all UOB personal credit cards, from 9 Mar 2020. Notice is from 2020 and gives no GST or DCC wording; MileLion's 25 May 2026 table still shows 3.25%. Checked 29 Oct 2026.",
    shortName: 'UOB LS.Travel',
    name: "UOB Lady's Solitaire (Travel)", 
    bank: 'UOB', 
    image: 'assets/cards/uobladysolitaire.png',
    vaultKey: 'uob_uni', 
    monthlyCap: 750, 
    minSpend: 0, 
    bonusMpd: 4.0, 
    baseMpd: 0.4, 
    engine: 'uob-5', 
    cycleType: 'calendar', 
    strategyType: 'whitelist',
    badgeClass: '', 
    hint: 'Airlines, hotels, OTA bookings. Local and overseas.', 
    isContactlessOnly: false,
    channelMode: 'both',
    themeClass: 'thumb-uob'
  },
  { 
    id: 'hsbc-rev', 
    fcyFee: 3.25,   // % charged on foreign-currency spend (incl. the 1% Visa/Mastercard fee); not used by the recommender yet
    fcyFeeSource: "HSBC credit cards FAQ (official, hsbc.com.sg/credit-cards/faq): 2.25% bank fee + 1% Visa/Mastercard fee = 3.25% on foreign-currency transactions (worked example). Extra 1% on DCC and on SGD transactions processed overseas. GST not mentioned; the FAQ is undated and the Fees and Charges PDF was not read. MileLion dates the 3.25% from 4 Jan 2023. Checked 29 Oct 2026.",
    annualFee: 'none',   // 'waived' = auto-waived, 'none' = no fee: no fee alert for this card
    shortName: 'HSBC Revo',
    name: 'HSBC Revolution', 
    bank: 'HSBC', 
    image: 'assets/cards/hsbc-rev.png',
    vaultKey: 'hsbc_pts', 
    monthlyCap: 1000, 
    minSpend: 0, 
    bonusMpd: 4.0, 
    baseMpd: 0.4, 
    engine: 'citi-1', 
    cycleType: 'calendar', 
    strategyType: 'whitelist',
    badgeClass: '', 
    hint: '4 mpd on online or contactless spend at whitelisted MCCs only (T&C 1 Apr 2026). Not eligible: groceries, restaurants-excluded MCCs, petrol, transport. Works on Kris+ (excl. 5814).', 
    inPersonNeedsContactless: true,
    isContactlessOnly: false,
    channelMode: 'both',
    themeClass: 'thumb-hsbc'
  },
  { 
    id: 'kf-uob', 
    fcyFee: 3.25,   // % charged on foreign-currency spend (incl. the 1% Visa/Mastercard fee); not used by the recommender yet
    fcyMpd: 1.2,   // mpd on ordinary foreign-currency spend at the top tier (uncapped everyday cards); read by recommender + js/fcy.js
    fcyFeeSource: "UOB fee-revision notice (official, uob.com.sg .../news-announcements/revision-fees-charge.pdf): foreign exchange administrative fee 3.25% on the converted amount, all UOB personal credit cards, from 9 Mar 2020. Notice is from 2020 and gives no GST or DCC wording; MileLion's 25 May 2026 table still shows 3.25%. Checked 29 Oct 2026.",
    shortName: 'KrisFlyer UOB',
    name: 'KrisFlyer UOB Credit Card', 
    bank: 'UOB', 
    image: 'assets/cards/kf-uob.png',
    vaultKey: 'kf_direct', 
    monthlyCap: 999999, 
    minSpend: 0, 
    bonusMpd: 2.4, 
    baseMpd: 1.2, 
    tierRule: { kind: 'annual-sia', at: 1000, mpd: 2.4 },
    engine: 'uob-5', 
    cycleType: 'uncapped', 
    strategyType: 'whitelist',
    badgeClass: '', 
    hint: '3 mpd on SIA, Scoot, KrisShop, Kris+ and Pelago. 2.4 mpd on dining/transport/travel needs S$1,000 SIA Group spend in the membership year and is paid after the year ends.', 
    isContactlessOnly: false,
    channelMode: 'both',
    themeClass: 'thumb-uob'
  },
  { 
    id: 'mb-world-mc', 
    fcyFee: 3.25,   // % charged on foreign-currency spend (incl. the 1% Visa/Mastercard fee); not used by the recommender yet
    fcyMpd: 3.2,   // mpd on ordinary foreign-currency spend at the top tier (uncapped everyday cards); read by recommender + js/fcy.js
    fcyFeeSource: "Maybank important notice (official, maybank2u.com.sg, notice 24 Sep 2021): bank administrative fee 2.25% plus 1% Visa/Mastercard conversion charge = 3.25%, from 1 Nov 2021, all foreign-currency card transactions. GST not mentioned. 2021 notice; MileLion's 25 May 2026 table still shows 3.25%. Checked 29 Oct 2026.",
    shortName: 'Maybank World',
    name: 'Maybank World Mastercard', 
    bank: 'Maybank', 
    image: 'assets/cards/maybank-world.png',
    vaultKey: 'mb_treats', 
    monthlyCap: 999999, 
    minSpend: 800, 
    bonusMpd: 3.2, 
    baseMpd: 0.4, 
    tierRule: { kind: 'monthly', scope: 'Foreign-currency spend:', steps: [{ at: 800, mpd: 2.8 }, { at: 4000, mpd: 3.2 }] },
    engine: 'citi-1', 
    cycleType: 'calendar', 
    strategyType: 'whitelist',
    badgeClass: '', 
    hint: '4.0 mpd on offline Shell Petrol! FCY: 3.2 mpd (min S$4k/mo), 2.8 mpd (min S$800/mo), uncapped.', 
    isContactlessOnly: false,
    channelMode: 'both',
    themeClass: 'thumb-maybank'
  },
  { 
    id: 'mb-horizon-vs', 
    fcyFee: 3.25,   // % charged on foreign-currency spend (incl. the 1% Visa/Mastercard fee); not used by the recommender yet
    fcyMpd: 2.8,   // mpd on ordinary foreign-currency spend at the top tier (uncapped everyday cards); read by recommender + js/fcy.js
    fcyFeeSource: "Maybank important notice (official, maybank2u.com.sg, notice 24 Sep 2021): bank administrative fee 2.25% plus 1% Visa/Mastercard conversion charge = 3.25%, from 1 Nov 2021, all foreign-currency card transactions. GST not mentioned. 2021 notice; MileLion's 25 May 2026 table still shows 3.25%. Checked 29 Oct 2026.",
    shortName: 'Maybank Horizon',
    name: 'Maybank Horizon Visa Signature', 
    bank: 'Maybank', 
    image: 'assets/cards/maybank-horizon.png',
    vaultKey: 'mb_treats', 
    monthlyCap: 10000, 
    minSpend: 800, 
    bonusMpd: 2.8, 
    baseMpd: 0.4, 
    tierRule: { kind: 'monthly', scope: 'Foreign-currency and air-ticket spend:', steps: [{ at: 800, mpd: 2.8 }] },
    engine: 'citi-1', 
    cycleType: 'calendar', 
    strategyType: 'whitelist',
    badgeClass: '', 
    hint: '2.8 mpd on FCY spend (any MCC) and on air tickets once S$800 is spent in the month. Air tickets capped at S$10k/month.', 
    isContactlessOnly: false,
    channelMode: 'both',
    themeClass: 'thumb-maybank'
  },
  { 
    id: 'dbs-vantage', 
    fcyFee: 3.25,   // % charged on foreign-currency spend (incl. the 1% Visa/Mastercard fee); not used by the recommender yet
    fcyMpd: 2.2,   // mpd on ordinary foreign-currency spend at the top tier (uncapped everyday cards); read by recommender + js/fcy.js
    fcyFeeSource: 'DBS fee page (official): 1% network + 2.25% bank, checked 29 Oct 2026. Paying in SGD abroad (DCC) is 1%.',
    shortName: 'DBS Vantage',
    name: 'DBS Vantage Card', 
    bank: 'DBS', 
    image: 'assets/cards/dbs-vantage.png',
    vaultKey: 'dbs_pts', 
    monthlyCap: 999999, 
    minSpend: 0, 
    bonusMpd: 1.5, 
    baseMpd: 1.5, 
    rateSchedule: [{ from: '2026-11-02', baseMpd: 1.4, bonusMpd: 1.4 }],
    engine: 'dbs-5', 
    cycleType: 'uncapped', 
    strategyType: 'blacklist',
    badgeClass: '', 
    hint: '1.5 mpd local until 1 Nov 2026, then 1.4 mpd from 2 Nov 2026. 2.2 mpd FCY. Uncapped general spending.', 
    isContactlessOnly: false,
    channelMode: 'both',
    themeClass: 'thumb-dbs'
  },
  { 
    id: 'uob-prvi', 
    fcyFee: 3.25,   // % charged on foreign-currency spend (incl. the 1% Visa/Mastercard fee); not used by the recommender yet
    fcyMpd: 2.4,   // mpd on ordinary foreign-currency spend at the top tier (uncapped everyday cards); read by recommender + js/fcy.js
    fcyFeeSource: "UOB fee-revision notice (official, uob.com.sg .../news-announcements/revision-fees-charge.pdf): foreign exchange administrative fee 3.25% on the converted amount, all UOB personal credit cards, from 9 Mar 2020. Notice is from 2020 and gives no GST or DCC wording; MileLion's 25 May 2026 table still shows 3.25%. Checked 29 Oct 2026.",
    shortName: 'UOB PRVI',
    name: 'UOB PRVI Miles', 
    bank: 'UOB', 
    image: 'assets/cards/uob-prvi.png',
    vaultKey: 'uob_uni', 
    monthlyCap: 999999, 
    minSpend: 0, 
    bonusMpd: 1.4, 
    baseMpd: 1.4, 
    engine: 'uob-5', 
    cycleType: 'uncapped', 
    strategyType: 'blacklist',
    badgeClass: '', 
    hint: '1.4 mpd local / 2.4 mpd FCY. 3.0 mpd on IDR, MYR, THB and VND spend. Uncapped.', 
    isContactlessOnly: false,
    channelMode: 'both',
    themeClass: 'thumb-uob'
  },
  { 
    id: 'dbs-altitude', 
    fcyFee: 3.25,   // % charged on foreign-currency spend (incl. the 1% Visa/Mastercard fee); not used by the recommender yet
    fcyMpd: 2.2,   // mpd on ordinary foreign-currency spend at the top tier (uncapped everyday cards); read by recommender + js/fcy.js
    fcyFeeSource: 'DBS fee page (official): 1% network + 2.25% bank, checked 29 Oct 2026. Paying in SGD abroad (DCC) is 1%.',
    annualFee: 'waived',   // 'waived' = auto-waived, 'none' = no fee: no fee alert for this card
    shortName: 'DBS Altitude',
    name: 'DBS Altitude Card', 
    bank: 'DBS', 
    image: 'assets/cards/dbs-altitude.png',
    vaultKey: 'dbs_pts', 
    monthlyCap: 999999, 
    minSpend: 0, 
    bonusMpd: 1.3, 
    baseMpd: 1.3, 
    engine: 'dbs-5', 
    cycleType: 'uncapped', 
    strategyType: 'blacklist',
    badgeClass: '', 
    hint: '1.3 mpd local / 2.2 mpd FCY. Non-expiring DBS Points.', 
    isContactlessOnly: false,
    channelMode: 'both',
    themeClass: 'thumb-dbs'
  },
  { 
    id: 'citi-pm', 
    fcyFee: 3.25,   // % charged on foreign-currency spend (incl. the 1% Visa/Mastercard fee); not used by the recommender yet
    fcyMpd: 2.2,   // mpd on ordinary foreign-currency spend at the top tier (uncapped everyday cards); read by recommender + js/fcy.js
    fcyFeeSource: 'Citi PremierMiles Cardmembers Agreement cl. 6.9 (official, docs/bank-tnc): up to 3.25% on the converted SGD amount. DCC 1%. SGD spend with overseas merchants 1%. GST not mentioned. Checked 29 Oct 2026.',
    shortName: 'Citi PremierMiles',
    name: 'Citi PremierMiles', 
    bank: 'Citi', 
    image: 'assets/cards/citi-pm.png',
    vaultKey: 'citi_miles', 
    monthlyCap: 999999, 
    minSpend: 0, 
    bonusMpd: 1.2, 
    baseMpd: 1.2, 
    engine: 'citi-1', 
    cycleType: 'uncapped', 
    strategyType: 'blacklist',
    badgeClass: '', 
    hint: '1.2 mpd local / 2.2 mpd FCY (per MileLion; no bank T&C checked). Non-expiring Citi Miles.', 
    isContactlessOnly: false,
    channelMode: 'both',
    themeClass: 'thumb-citi'
  },
  { 
    id: 'trust-freedom', 
    fcyFee: 0,   // % charged on foreign-currency spend (incl. the 1% Visa/Mastercard fee); not used by the recommender yet
    fcyMpd: 1.3,   // mpd on ordinary foreign-currency spend at the top tier (uncapped everyday cards); read by recommender + js/fcy.js
    fcyFeeSource: 'Trust Freedom key facts sheet (official): no fee, Visa rate. Checked 29 Oct 2026.',
    annualFee: 'none',
    shortName: 'Trust Freedom',
    name: 'Trust Freedom (Miles mode)', 
    bank: 'Trust', 
    image: 'assets/cards/trust-freedom.png',
    vaultKey: 'trust_miles', 
    monthlyCap: 999999, 
    minSpend: 0, 
    bonusMpd: 1.3, 
    baseMpd: 1.3, 
    engine: 'uob-5', 
    cycleType: 'uncapped', 
    strategyType: 'blacklist',
    badgeClass: '', 
    hint: '1.3 mpd local and overseas in Miles mode, 0% FX fee (Visa rate). Earned per S$5 per transaction, so under S$5 earns nothing. No cap, no annual fee. Excluded: utilities, rent, education, insurance, government, charity, quasi-cash (4900, 6513, 8211, 6300, 9311, 8398, 6010 etc). Miles transfer to KrisFlyer costs S$27.25 each time.', 
    isContactlessOnly: false,
    channelMode: 'both',
    themeClass: 'thumb-trust'
  }
];

export const MCC_DATABASE = {
  "5541": {
    name: "Petrol Service Stations (Shell, SPC, Esso, Caltex)",
    notes: "⛽ <b>Shell Exclusive:</b> Pay with UOB PPV (Mobile Tap) or UOB VS for an <b>instant 14% discount</b> (10% Shell GO+ & 4% UOB) + <b>4.0 mpd</b>! Maybank World MC earns 4 mpd uncapped (10% off). Pro-tip: Buy Shell vouchers on HeyMax under MCC 5311 for 4 mpd on OCBC/Citi Rewards.",
    candidatesLocal: [
      { id: "uob-ppv-contactless", baseRate: 4.0 },
      { id: "uob-vs-contactless", baseRate: 4.0 },
      { id: "mb-world-mc", baseRate: 4.0 }
    ],
    candidatesOverseas: [
      { id: "uob-vs-fcy", baseRate: 4.0 },
      { id: "mb-world-mc", baseRate: 3.2 },
      { id: "mb-horizon-vs", baseRate: 2.8 }
    ]
  },
  "5811": {
    name: "Catering Services",
    notes: "Neo Garden, Stamford Catering. Covered by UOB Lady's (Dining) & HSBC Rev. ⚠️ EXCLUDED on KrisFlyer UOB.",
    candidatesLocal: [
      { id: "uob-ls-dining", baseRate: 4.0 },
      { id: "hsbc-rev", baseRate: 4.0 },
      { id: "uob-ppv-contactless", baseRate: 4.0 },
      { id: "uob-vs-contactless", baseRate: 4.0 }
    ],
    candidatesOverseas: [
      { id: "uob-ls-dining", baseRate: 4.0 },
      { id: "uob-vs-fcy", baseRate: 4.0 },
      { id: "hsbc-rev", baseRate: 4.0 }
    ]
  },
  "5812": {
    name: "Restaurants & Dining Places",
    notes: "Sit-down restaurants, cafes. All dining and contactless cards eligible.",
    candidatesLocal: [
      { id: "uob-ls-dining", baseRate: 4.0 },
      { id: "hsbc-rev", baseRate: 4.0 },
      { id: "uob-ppv-contactless", baseRate: 4.0 },
      { id: "uob-ppv-online", baseRate: 4.0 },
      { id: "uob-vs-contactless", baseRate: 4.0 },
      { id: "kf-uob", baseRate: 2.4 }
    ],
    candidatesOverseas: [
      { id: "uob-ls-dining", baseRate: 4.0 },
      { id: "uob-vs-fcy", baseRate: 4.0 },
      { id: "hsbc-rev", baseRate: 4.0 },
      { id: "kf-uob", baseRate: 2.4 }
    ]
  },
  "5813": {
    name: "Bars, Taverns, Lounges & Nightclubs",
    notes: "Pubs and bars. ⚠️ EXCLUDED on UOB Lady's Dining (requires Entertainment category!). Use HSBC Rev, KF UOB, or Mobile Tap.",
    candidatesLocal: [
      { id: "hsbc-rev", baseRate: 4.0 },
      { id: "uob-ppv-contactless", baseRate: 4.0 },
      { id: "uob-vs-contactless", baseRate: 4.0 },
      { id: "kf-uob", baseRate: 2.4 }
    ],
    candidatesOverseas: [
      { id: "uob-vs-fcy", baseRate: 4.0 },
      { id: "hsbc-rev", baseRate: 4.0 },
      { id: "kf-uob", baseRate: 2.4 }
    ]
  },
  "5814": {
    name: "Fast Food & Quick Service (McD, KFC, Starbucks, GrabFood)",
    notes: "⚠️ HSBC Revolution strictly EXCLUDES 5814! Online: UOB PPV Online / Lady's. In-person: PPV Contactless Tap.",
    candidatesLocal: [
      { id: "uob-ls-dining", baseRate: 4.0 },
      { id: "uob-ppv-online", baseRate: 4.0 },
      { id: "uob-ppv-contactless", baseRate: 4.0 },
      { id: "kf-uob", baseRate: 2.4 }
    ],
    candidatesOverseas: [
      { id: "uob-vs-fcy", baseRate: 4.0 },
      { id: "uob-ls-dining", baseRate: 4.0 }
    ]
  },
  "5441": {
    name: "Candy, Nut & Confectionery Stores",
    notes: "Sweet shops, candy stores. ⚠️ EXCLUDED on UOB Lady's Dining & KF UOB! Use HSBC Rev or Mobile Tap (PPV/VS).",
    candidatesLocal: [
      { id: "hsbc-rev", baseRate: 4.0 },
      { id: "uob-ppv-contactless", baseRate: 4.0 },
      { id: "uob-ppv-online", baseRate: 4.0 },
      { id: "uob-vs-contactless", baseRate: 4.0 }
    ],
    candidatesOverseas: [
      { id: "uob-vs-fcy", baseRate: 4.0 },
      { id: "hsbc-rev", baseRate: 4.0 }
    ]
  },
  "5462": {
    name: "Bakeries & Cake Shops (Cedele, Chateraise, Bengawan Solo)",
    notes: "Bread and pastries. ⚠️ EXCLUDED on UOB Lady's Dining & KF UOB! Use HSBC Rev or Mobile Tap (PPV/VS).",
    candidatesLocal: [
      { id: "hsbc-rev", baseRate: 4.0 },
      { id: "uob-ppv-contactless", baseRate: 4.0 },
      { id: "uob-ppv-online", baseRate: 4.0 },
      { id: "uob-vs-contactless", baseRate: 4.0 }
    ],
    candidatesOverseas: [
      { id: "uob-vs-fcy", baseRate: 4.0 },
      { id: "hsbc-rev", baseRate: 4.0 }
    ]
  },
  "5499": {
    name: "Miscellaneous Food Stores & Specialty Food",
    notes: "Specialty food marts, GrabFood/FoodPanda. ⚠️ EXCLUDED on HSBC Rev & KF UOB! Covered by UOB Lady's Dining & PPV.",
    candidatesLocal: [
      { id: "uob-ls-dining", baseRate: 4.0 },
      { id: "uob-ppv-online", baseRate: 4.0 },
      { id: "uob-ppv-contactless", baseRate: 4.0 },
      { id: "uob-vs-contactless", baseRate: 4.0 },
      { id: "dbs-wwmc", baseRate: 4.0 }
    ],
    candidatesOverseas: [
      { id: "uob-ls-dining", baseRate: 4.0 },
      { id: "uob-vs-fcy", baseRate: 4.0 },
      { id: "dbs-wwmc", baseRate: 4.0 }
    ]
  },
  "5411": {
    name: "Grocery Stores & Supermarkets",
    notes: "yuu Outlets earn 10.0 mpd on DBS yuu in SG (requires S$800 spend + 4 merchants). General supermarkets: UOB PPV or HSBC Rev.",
    candidatesLocal: [
      { id: "dbs-yuu", baseRate: 10.0 },
      { id: "uob-ppv-contactless", baseRate: 4.0 },
      { id: "uob-ppv-online", baseRate: 4.0 },
      { id: "hsbc-rev", baseRate: 4.0 }
    ],
    candidatesOverseas: [
      { id: "uob-vs-fcy", baseRate: 4.0 }
    ]
  },
  "5912": {
    name: "Pharmacies & Personal Care (Guardian, Watsons, Unity)",
    notes: "Guardian: DBS yuu (10 mpd). Watsons: OCBC Rewards (6 mpd promo). UOB PPV & HSBC Rev earn 4 mpd. ⚠️ Guardian/Watsons in-app checkout codes as MCC 5499!",
    candidatesLocal: [
      { id: "dbs-yuu", baseRate: 10.0 },
      { id: "ocbc-rewards", baseRate: 6.0 },
      { id: "hsbc-rev", baseRate: 4.0 },
      { id: "uob-ppv-contactless", baseRate: 4.0 },
      { id: "uob-ppv-online", baseRate: 4.0 },
      { id: "dbs-wwmc", baseRate: 4.0 }
    ],
    candidatesOverseas: [
      { id: "uob-vs-fcy", baseRate: 4.0 },
      { id: "ocbc-rewards", baseRate: 6.0 }
    ]
  },
  "8351": {
    name: "Child Care & Nursery Services",
    notes: "Childcare is education-adjacent! Eligible for 4.0 mpd on DBS WWMC (Online) & Mobile Tap (UOB PPV / VS). ⚠️ Excluded on HSBC Rev.",
    candidatesLocal: [
      { id: "dbs-wwmc", baseRate: 4.0 },
      { id: "uob-ppv-contactless", baseRate: 4.0 },
      { id: "uob-vs-contactless", baseRate: 4.0 }
    ],
    candidatesOverseas: [
      { id: "uob-vs-fcy", baseRate: 4.0 }
    ]
  },
  "8011": {
    name: "Doctors & Outpatient Clinics",
    notes: "Private clinic consultations. Earns 4.0 mpd on UOB PPV (Mobile Tap), UOB VS Tap, and DBS WWMC (teleconsults). ⚠️ Excluded on Lady's, HSBC Rev & Citi in-store.",
    candidatesLocal: [
      { id: "uob-ppv-contactless", baseRate: 4.0 },
      { id: "uob-vs-contactless", baseRate: 4.0 },
      { id: "dbs-wwmc", baseRate: 4.0 }
    ],
    candidatesOverseas: [
      { id: "uob-vs-fcy", baseRate: 4.0 }
    ]
  },
  "8021": {
    name: "Dentists & Orthodontists",
    notes: "Dental checkups & scaling. Earns 4.0 mpd via Mobile Tap (UOB PPV / UOB VS). ⚠️ Excluded on Lady's, HSBC Rev & Citi in-store.",
    candidatesLocal: [
      { id: "uob-ppv-contactless", baseRate: 4.0 },
      { id: "uob-vs-contactless", baseRate: 4.0 }
    ],
    candidatesOverseas: [
      { id: "uob-vs-fcy", baseRate: 4.0 }
    ]
  },
  "7512": {
    name: "Car Rental Agencies (Hertz, Avis, Klook Car Rental)",
    notes: "⚠️ Citi Rewards strictly EXCLUDES car rentals! Covered by DBS WWMC (online) and HSBC Revolution.",
    candidatesLocal: [
      { id: "dbs-wwmc", baseRate: 4.0 },
      { id: "hsbc-rev", baseRate: 4.0 },
      { id: "uob-ppv-contactless", baseRate: 4.0 },
      { id: "uob-vs-contactless", baseRate: 4.0 }
    ],
    candidatesOverseas: [
      { id: "dbs-wwmc", baseRate: 4.0 },
      { id: "uob-vs-fcy", baseRate: 4.0 },
      { id: "hsbc-rev", baseRate: 4.0 }
    ]
  },
  "5311": {
    name: "Department Stores (Takashimaya, Tangs, Isetan)",
    notes: "Department store shopping. OCBC Rewards & Citi Rewards eligible.",
    candidatesLocal: [
      { id: "ocbc-rewards", baseRate: 4.0 },
      { id: "citi-rewards", baseRate: 4.0 },
      { id: "hsbc-rev", baseRate: 4.0 },
      { id: "uob-ppv-contactless", baseRate: 4.0 },
      { id: "uob-ppv-online", baseRate: 4.0 }
    ],
    candidatesOverseas: [
      { id: "uob-vs-fcy", baseRate: 4.0 },
      { id: "ocbc-rewards", baseRate: 4.0 },
      { id: "citi-rewards", baseRate: 4.0 }
    ]
  },
  "5651": {
    name: "Family Clothing & Fashion (Uniqlo, Zara)",
    notes: "Apparel bonus eligible across Citi, OCBC Rewards, and HSBC.",
    candidatesLocal: [
      { id: "citi-rewards", baseRate: 4.0 },
      { id: "ocbc-rewards", baseRate: 4.0 },
      { id: "hsbc-rev", baseRate: 4.0 },
      { id: "uob-ppv-contactless", baseRate: 4.0 },
      { id: "uob-ppv-online", baseRate: 4.0 }
    ],
    candidatesOverseas: [
      { id: "citi-rewards", baseRate: 4.0 },
      { id: "uob-vs-fcy", baseRate: 4.0 },
      { id: "ocbc-rewards", baseRate: 4.0 }
    ]
  },
  "5621": {
    name: "Women's Ready-to-Wear Stores",
    notes: "Fashion apparel bonus eligible across Citi & OCBC Rewards.",
    candidatesLocal: [
      { id: "citi-rewards", baseRate: 4.0 },
      { id: "ocbc-rewards", baseRate: 4.0 },
      { id: "hsbc-rev", baseRate: 4.0 },
      { id: "uob-ppv-contactless", baseRate: 4.0 },
      { id: "uob-ppv-online", baseRate: 4.0 }
    ],
    candidatesOverseas: [
      { id: "citi-rewards", baseRate: 4.0 },
      { id: "uob-vs-fcy", baseRate: 4.0 },
      { id: "ocbc-rewards", baseRate: 4.0 }
    ]
  },
  "4511": {
    name: "Airlines & Air Carriers (Singapore Airlines, Scoot)",
    notes: "⚠️ Citi Rewards strictly EXCLUDES airfares! Use DBS WWMC, Solitaire, Maybank Horizon, or PRVI Miles.",
    candidatesLocal: [
      { id: "dbs-wwmc", baseRate: 4.0 },
      { id: "uob-ls-travel", baseRate: 4.0 },
      { id: "kf-uob", baseRate: 3.0 },
      { id: "mb-horizon-vs", baseRate: 3.24 }
    ],
    candidatesOverseas: [
      { id: "dbs-wwmc", baseRate: 4.0 },
      { id: "uob-ls-travel", baseRate: 4.0 },
      { id: "kf-uob", baseRate: 3.0 },
      { id: "mb-horizon-vs", baseRate: 3.24 },
      { id: "uob-vs-fcy", baseRate: 4.0 }
    ]
  },
  "4722": {
    name: "Travel Agencies & OTAs (Agoda, Klook, Trip.com, Expedia)",
    notes: "⚠️ EXCLUDED on Citi Rewards AND HSBC Rev! Use DBS WWMC or Solitaire (Travel).",
    candidatesLocal: [
      { id: "dbs-wwmc", baseRate: 4.0 },
      { id: "uob-ls-travel", baseRate: 4.0 },
      { id: "kf-uob", baseRate: 2.4 }
    ],
    candidatesOverseas: [
      { id: "dbs-wwmc", baseRate: 4.0 },
      { id: "uob-ls-travel", baseRate: 4.0 },
      { id: "uob-vs-fcy", baseRate: 4.0 },
      { id: "kf-uob", baseRate: 2.4 }
    ]
  },
  "7011": {
    name: "Hotels, Motels & Resorts",
    notes: "⚠️ Citi Rewards strictly EXCLUDES hotels! Use DBS WWMC, Solitaire (Travel), or Maybank Horizon.",
    candidatesLocal: [
      { id: "dbs-wwmc", baseRate: 4.0 },
      { id: "uob-ls-travel", baseRate: 4.0 },
      { id: "mb-horizon-vs", baseRate: 3.24 }
    ],
    candidatesOverseas: [
      { id: "uob-vs-fcy", baseRate: 4.0 },
      { id: "uob-ls-travel", baseRate: 4.0 }
    ]
  },
  "4111": {
    name: "Commuter Transport / Transit",
    notes: "Local SimplyGo earns 10 mpd on yuu (counts toward 4-merchant rule). Overseas transit: use UOB VS (4 mpd) or Maybank Horizon (2.8 mpd).",
    candidatesLocal: [
      { id: "dbs-yuu", baseRate: 10.0 },
      { id: "uob-ppv-contactless", baseRate: 4.0 },
      { id: "kf-uob", baseRate: 2.4 }
    ],
    candidatesOverseas: [
      { id: "uob-vs-fcy", baseRate: 4.0 }
    ]
  },
  "4121": {
    name: "Taxis & Ride-Hailing (Grab, Gojek, Uber)",
    notes: "Ride hailing and taxis. Gojek counts toward DBS yuu 4-merchant quota.",
    candidatesLocal: [
      { id: "dbs-yuu", baseRate: 10.0 },
      { id: "uob-ppv-contactless", baseRate: 4.0 },
      { id: "kf-uob", baseRate: 2.4 },
      { id: "dbs-wwmc", baseRate: 4.0 }
    ],
    candidatesOverseas: [
      { id: "uob-vs-fcy", baseRate: 4.0 },
      { id: "dbs-wwmc", baseRate: 4.0 }
    ]
  },
  "5999": {
    name: "General Retail, Souvenirs & Specialty Stores",
    notes: "All general retail and souvenir spending.",
    candidatesLocal: [
      { id: "citi-rewards", baseRate: 4.0 },
      { id: "dbs-wwmc", baseRate: 4.0 },
      { id: "uob-ppv-online", baseRate: 4.0 },
      { id: "hsbc-rev", baseRate: 4.0 }
    ],
    candidatesOverseas: [
      { id: "uob-vs-fcy", baseRate: 4.0 }
    ]
  },
  "8062": { 
    name: "Hospitals & Inpatient Care", 
    notes: "❌ Excluded from rewards by all major Singapore banks. Only Maybank Horizon (0.16 mpd local / 2.8 mpd FCY) awards points.", 
    candidatesLocal: [], 
    candidatesOverseas: [
      { id: "mb-world-mc", baseRate: 3.2 },
      { id: "mb-horizon-vs", baseRate: 2.8 }
    ] 
  },
  "8211": { 
    name: "Schools & Primary / Secondary Education", 
    notes: "❌ Excluded from rewards across all major credit cards. (Only Maybank 0.16 mpd or CardUp payment facility applies).", 
    candidatesLocal: [], 
    candidatesOverseas: [
      { id: "mb-world-mc", baseRate: 3.2 },
      { id: "mb-horizon-vs", baseRate: 2.8 }
    ] 
  },
  "8220": { 
    name: "Colleges & Universities (NUS, NTU, SMU)", 
    notes: "❌ Excluded from rewards across all major credit cards. NUS now codes under MCC 9399 / 8220.", 
    candidatesLocal: [], 
    candidatesOverseas: [
      { id: "mb-world-mc", baseRate: 3.2 },
      { id: "mb-horizon-vs", baseRate: 2.8 }
    ] 
  },
  "8398": { 
    name: "Charities & Social Service Organizations (Donations)", 
    notes: "❌ Excluded from rewards across all major credit cards.", 
    candidatesLocal: [], 
    candidatesOverseas: [] 
  },
  "4900": { name: "Utilities", notes: "❌ Excluded from rewards across all cards.", candidatesLocal: [], candidatesOverseas: [] },
  "6300": { name: "Insurance", notes: "❌ Excluded from rewards across all cards.", candidatesLocal: [], candidatesOverseas: [] },
  "9399": { name: "Government / Taxes", notes: "❌ Excluded from rewards across all cards.", candidatesLocal: [], candidatesOverseas: [] },
  "6540": { name: "Stored Value Card / Wallet Top-Ups", notes: "❌ Excluded from rewards across all cards.", candidatesLocal: [], candidatesOverseas: [] }
};


// ---- Dated rate changes -----------------------------------------------------------------------------
// A card with rateSchedule: [{from:'YYYY-MM-DD', baseMpd, bonusMpd}] switches to the latest entry whose date has
// arrived, and reverts to its original rate before that. Call at startup and before each recommendation.
const ORIGINAL_RATES = new Map(ALL_MASTER_CARDS.map(c => [c.id, { baseMpd: c.baseMpd, bonusMpd: c.bonusMpd }]));

export function applyRateSchedule(today = new Date().toLocaleDateString("en-CA")) {
  for (const c of ALL_MASTER_CARDS) {
    if (!Array.isArray(c.rateSchedule)) continue;
    const orig = ORIGINAL_RATES.get(c.id);
    const hit = c.rateSchedule.filter(r => r.from <= today).sort((a, b) => a.from.localeCompare(b.from)).pop();
    c.baseMpd = hit && hit.baseMpd != null ? hit.baseMpd : orig.baseMpd;
    c.bonusMpd = hit && hit.bonusMpd != null ? hit.bonusMpd : orig.bonusMpd;
  }
}

/** Short label for lists, pills and filters; falls back to the full name. */
export function cardShort(card) {
  return (card && (card.shortName || card.name)) || 'Card';
}
