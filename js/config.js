export const APP_VERSION = "v1.9.3";

export const PRIMARY_EMAILS = [
  "zjunyuan@gmail.com",
  "eunice.er.yc@gmail.com"
];
export const SISTER_EMAILS = [
  "minsyyy@gmail.com"
];

export const firebaseConfig = {
  apiKey: "AIzaSyDrxlcwVdrBIPvvgJHLi2wOAfkEI1DsbAk",
  authDomain: "milestracker-sg.firebaseapp.com",
  projectId: "milestracker-sg",
  storageBucket: "milestracker-sg.firebasestorage.app",
  messagingSenderId: "523584797300",
  appId: "1:523584797300:web:1faed7ab60e72ae96b6fb7"
};

export const DEFAULT_PRESETS = [
  { id: 'p_fairprice', label: 'FairPrice App', icon: '🛒', cardId: 'uob-ppv-online', desc: 'NTUC FairPrice [App]' },
  { id: 'p_mcd', label: "McDonald's", icon: '🍔', cardId: 'uob-ppv-contactless', desc: "McDonald's" },
  { id: 'p_shell', label: 'Shell (14% off)', icon: '⛽', cardId: 'uob-ppv-contactless', desc: 'Shell Service Station (14% off)' },
  { id: 'p_dining', label: 'Restaurant', icon: '🍽️', cardId: 'uob-vs-contactless', desc: 'Restaurant Dining' },
  { id: 'p_yuu_cs', label: 'Cold Storage', icon: '🥩', cardId: 'dbs-yuu', desc: 'Cold Storage' },
  { id: 'p_yuu_guardian', label: 'Guardian', icon: '💊', cardId: 'dbs-yuu', desc: 'Guardian' },
  { id: 'p_yuu_fp', label: 'foodpanda', icon: '🐼', cardId: 'dbs-yuu', desc: 'foodpanda' },
  { id: 'p_shopee', label: 'Shopee / Online', icon: '📦', cardId: 'dbs-wwmc', desc: 'Shopee Singapore' },
  { id: 'p_sia', label: 'SIA Flights', icon: '✈️', cardId: 'dbs-wwmc', desc: 'Singapore Airlines' },
  { id: 'p_simplygo', label: 'SimplyGo', icon: '🚆', cardId: 'uob-ppv-contactless', desc: 'SimplyGo Bus/MRT' }
];

export const CATEGORY_POOLS = [
  { id: "dining", name: "Dining & Food Places", icon: "🍽️", cardIds: ["uob-vs-contactless", "uob-ppv-contactless", "mb-world-mc"], notes: "Restaurants, cafes, eateries, fast food. Contactless tap applies in-person; online slots apply in-app." },
  { id: "groceries", name: "Supermarkets & Groceries", icon: "🛒", cardIds: ["dbs-yuu", "uob-ppv-contactless", "uob-ppv-online"], notes: "yuu partners (Cold Storage/Giant), FairPrice App, & general supermarkets." },
  { id: "shopping", name: "Online Shopping & Fashion", icon: "🛍️", cardIds: ["uob-ladys-solitaire", "dbs-wwmc", "citi-rewards", "ocbc-rewards", "hsbc-rev"], notes: "OCBC 6 mpd promo, Shopee, Lazada, Uniqlo, fashion boutiques." },
  { id: "travel", name: "Travel, Flights & Hotels", icon: "✈️", cardIds: ["uob-vs-fcy", "uob-vs-contactless", "mb-world-mc", "mb-horizon-vs"], notes: "SIA, Scoot, Agoda, Klook, OTA hotels, Local and FCY spend." },
  { id: "transport", name: "Transport & SimplyGo", icon: "🚕", cardIds: ["uob-ppv-contactless", "dbs-wwmc"], notes: "SimplyGo bus/train, Grab, Gojek ride-hailing." },
  { id: "petrol", name: "Petrol / Fuel (Shell)", icon: "⛽", cardIds: ["uob-ppv-contactless", "uob-vs-contactless"], notes: "Instant 14% pump discount + 4.0 mpd on UOB PPV/VS (Mobile Tap, min S$1k/mo on UOB VS)." }
];

export const KRISFLYER_4PAX_TIERS = [
  { dest: "BKK / KUL / PEN", zone: "Zone 1-2 (Southeast Asia)", milesPerPax: 48000, totalMiles: 192000, name: "Bangkok / KL / Penang" },
  { dest: "HKG / TPE / CAN", zone: "Zone 4 (Hong Kong / Taiwan)", milesPerPax: 73000, totalMiles: 292000, name: "Hong Kong / Taipei (Zone 4)" },
  { dest: "PER / DRW", zone: "Zone 8 (Perth / Darwin)", milesPerPax: 85000, totalMiles: 340000, name: "Perth / Darwin (Zone 8)" },
  { dest: "TYO / OSA / ICN", zone: "Zone 7 (Japan / Korea)", milesPerPax: 108000, totalMiles: 432000, name: "Tokyo / Osaka / Seoul (Zone 7)" },
  { dest: "SYD / MEL / BNE / AKL", zone: "Zone 9 (Sydney / Melbourne / Auckland)", milesPerPax: 137000, totalMiles: 548000, name: "Sydney / Melbourne / Auckland (Zone 9)" },
  { dest: "LHR / CDG / FRA / ZRH", zone: "Zone 11 (Europe)", milesPerPax: 215000, totalMiles: 860000, name: "London / Paris / Zurich (Zone 11)" },
  { dest: "JFK / SFO / LAX", zone: "Zone 12-13 (USA West & East Coast)", milesPerPax: 228000, totalMiles: 912000, name: "USA West & East Coast (Zone 12-13)" }
];

export const DEFAULT_VAULT = {
  uob_uni: { name: 'UOB UNI$', points: 0, ratio: 2.0, unit: 'pts', rule: 'Never Expire (non-expiring)' },
  citi_typ: { name: 'Citi ThankYou Points', points: 0, ratio: 0.4, unit: 'pts', rule: 'Fixed 5 yrs from card open/renewal date' },
  citi_miles: { name: 'Citi Miles (PremierMiles)', points: 0, ratio: 1.0, unit: 'miles', rule: 'Never expire (non-expiring)' },
  dbs_pts: { name: 'DBS Points', points: 0, ratio: 2.0, unit: 'pts', rule: '1 yr from month earned' },
  yuu_pts: { name: 'yuu Points', points: 0, ratio: 0.278, unit: 'pts', rule: '2 yrs from month earned' },
  ocbc_pts: { name: 'OCBC$ Points', points: 0, ratio: 0.4, unit: 'pts', rule: '2 yrs from month earned' },
  hsbc_pts: { name: 'HSBC Reward Points', points: 0, ratio: 0.4, unit: 'pts', rule: '37 months from earned' },
  mb_treats: { name: 'Maybank TREATS Points', points: 0, ratio: 0.4, unit: 'pts', rule: '1-3 yrs validity' },
  kf_direct: { name: 'KrisFlyer Miles (Direct)', points: 0, ratio: 1.0, unit: 'miles', rule: '3 yrs in KrisFlyer' }
};

export const ALL_MASTER_CARDS = [
  {
    id: 'dbs-yuu',
    name: 'DBS yuu Card (10 mpd)',
    bank: 'DBS',
    image: 'assets/cards/dbs-yuu.png',
    vaultKey: 'yuu_pts',
    monthlyCap: 622.88,
    minSpend: 800,
    bonusMpd: 10.0,
    baseMpd: 0.14,
    engine: 'yuu-10',
    cycleType: 'calendar',
    strategyType: 'whitelist',
    badgeClass: 'badge-gold',
    hint: 'Cold Storage, Giant, 7-11, foodpanda, Gojek, SimplyGo, CHAGEE. Req: S$800 min spend + 4 distinct merchants.',
    isContactlessOnly: false,
    channelMode: 'both',
    themeClass: 'thumb-dbs'
  },
  {
    id: 'uob-ppv-contactless',
    name: 'UOB Preferred Visa [Mobile Tap]',
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
    hint: 'Physical in-store contactless mobile payment (Apple/Google Pay) only. S$5 block rounding. Excludes SMART$ & Shopee.',
    isContactlessOnly: true,
    channelMode: 'inperson',
    themeClass: 'thumb-uob'
  },
  {
    id: 'uob-ppv-online',
    name: 'UOB Preferred Visa [Online]',
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
    hint: 'Supermarkets, Food Delivery, Fast Food & Entertainment online. Excludes Shopee & SMART$. S$5 block rounding.',
    isContactlessOnly: false,
    channelMode: 'online',
    themeClass: 'thumb-uob'
  },
  {
    id: 'uob-vs-contactless',
    name: 'UOB Visa Signature [Contactless / Petrol]',
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
    hint: 'Physical NFC terminal tap required (min S$1k/cycle). 14% instant off Shell.',
    isContactlessOnly: true,
    channelMode: 'inperson',
    themeClass: 'thumb-uob'
  },
  {
    id: 'uob-vs-fcy',
    name: 'UOB Visa Signature [FCY Overseas]',
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
    name: 'Citi Rewards Card',
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
    hint: 'Online shopping & in-app mobile wallets (excl fx). In-person offline strictly bags & shoes only.',
    isContactlessOnly: false,
    channelMode: 'both',
    themeClass: 'thumb-citi'
  },
  {
    id: 'ocbc-rewards',
    name: 'OCBC Rewards (Shopee/Watsons Promo)',
    bank: 'OCBC',
    image: 'assets/cards/ocbc-rewards.png',
    vaultKey: 'ocbc_pts',
    monthlyCap: 1000,
    minSpend: 0,
    bonusMpd: 6.0,
    baseMpd: 0.4,
    engine: 'ocbc-5',
    cycleType: 'calendar',
    strategyType: 'whitelist',
    badgeClass: 'badge-purple',
    hint: '6.0 mpd on Watsons, Shopee, Lazada, Taobao & TikTok Shop (1 Jul 2026 - 31 Mar 2027) up to S$1k. S$5 blocks.',
    isContactlessOnly: false,
    channelMode: 'both',
    themeClass: 'thumb-ocbc'
  },
  {
    id: 'uob-ladys-solitaire',
    name: "UOB Lady's Solitaire (Dining/Travel)",
    bank: 'UOB',
    image: 'assets/cards/uobladysolitaire.png',
    vaultKey: 'uob_uni',
    monthlyCap: 2000,
    minSpend: 0,
    bonusMpd: 4.0,
    baseMpd: 0.4,
    engine: 'uob-5',
    cycleType: 'calendar',
    strategyType: 'whitelist',
    badgeClass: '',
    hint: "Dining & Travel. S$5 block rounding. Excludes Kris+ app.",
    isContactlessOnly: false,
    channelMode: 'both',
    themeClass: 'thumb-uob'
  },
  {
    id: 'dbs-wwmc',
    name: "DBS Woman's World Card",
    bank: 'DBS',
    image: 'assets/cards/dbs-wwmc.png',
    vaultKey: 'dbs_pts',
    monthlyCap: 1000,
    minSpend: 0,
    bonusMpd: 4.0,
    baseMpd: 0.4,
    engine: 'dbs-1',
    cycleType: 'calendar',
    strategyType: 'blacklist',
    badgeClass: '',
    hint: 'Online shopping & in-app mobile wallets (SIA, Kris+, Grab, e-tailers). Excl travel MCCs.',
    isContactlessOnly: false,
    channelMode: 'online',
    themeClass: 'thumb-dbs'
  },
  {
    id: 'hsbc-rev',
    name: 'HSBC Revolution Card',
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
    hint: 'Dining, Food Delivery, Travel & Shopping. Contactless & Online.',
    isContactlessOnly: false,
    channelMode: 'both',
    themeClass: 'thumb-hsbc'
  },
  {
    id: 'kf-uob',
    name: 'KrisFlyer UOB Credit Card',
    bank: 'UOB',
    image: 'assets/cards/kf-uob.png',
    vaultKey: 'kf_direct',
    monthlyCap: 999999,
    minSpend: 0,
    bonusMpd: 3.0,
    baseMpd: 1.2,
    engine: 'uob-1',
    cycleType: 'uncapped',
    strategyType: 'whitelist',
    badgeClass: '',
    hint: 'Uncapped 3.0 mpd on SIA & Kris+ merchants directly! 1.2 mpd uncapped general spend.',
    isContactlessOnly: false,
    channelMode: 'both',
    themeClass: 'thumb-uob'
  },
  {
    id: 'mb-world-mc',
    name: 'Maybank World Mastercard',
    bank: 'Maybank',
    image: 'assets/cards/maybank-world.png',
    vaultKey: 'mb_treats',
    monthlyCap: 999999,
    minSpend: 800,
    bonusMpd: 3.2,
    baseMpd: 0.4,
    engine: 'citi-1',
    cycleType: 'calendar',
    strategyType: 'whitelist',
    badgeClass: '',
    hint: '4.0 mpd on Petrol & Dining; FCY: 3.2 mpd (min S$4,000 spend) or 2.8 mpd (min S$800 spend). S$800 min spend required.',
    isContactlessOnly: false,
    channelMode: 'both',
    themeClass: 'thumb-maybank'
  },
  {
    id: 'mb-horizon-vs',
    name: 'Maybank Horizon Visa Signature',
    bank: 'Maybank',
    image: 'assets/cards/maybank-horizon.png',
    vaultKey: 'mb_treats',
    monthlyCap: 10000,
    minSpend: 800,
    bonusMpd: 2.8,
    baseMpd: 0.24,
    engine: 'citi-1',
    cycleType: 'calendar',
    strategyType: 'whitelist',
    badgeClass: '',
    hint: '2.8 mpd on all FCY spend (min S$800 spend). S$10k cap.',
    isContactlessOnly: false,
    channelMode: 'both',
    themeClass: 'thumb-maybank'
  },
  {
    id: 'dbs-vantage',
    name: 'DBS Vantage Card',
    bank: 'DBS',
    image: 'assets/cards/dbs-vantage.png',
    vaultKey: 'dbs_pts',
    monthlyCap: 999999,
    minSpend: 0,
    bonusMpd: 1.5,
    baseMpd: 1.5,
    engine: 'dbs-1',
    cycleType: 'uncapped',
    strategyType: 'blacklist',
    badgeClass: '',
    hint: 'Uncapped 1.5 mpd local / 2.2 mpd FCY. S$5 block rounding.',
    isContactlessOnly: false,
    channelMode: 'both',
    themeClass: 'thumb-dbs'
  },
  {
    id: 'uob-prvi',
    name: 'UOB PRVI Miles (Visa/MC)',
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
    hint: '1.4 mpd local / 2.4 mpd FCY. S$5 block rounding.',
    isContactlessOnly: false,
    channelMode: 'both',
    themeClass: 'thumb-uob'
  },
  {
    id: 'dbs-altitude',
    name: 'DBS Altitude Card',
    bank: 'DBS',
    image: 'assets/cards/dbs-altitude.png',
    vaultKey: 'dbs_pts',
    monthlyCap: 999999,
    minSpend: 0,
    bonusMpd: 1.3,
    baseMpd: 1.3,
    engine: 'dbs-1',
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
    name: 'Citi PremierMiles Card',
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
    hint: '1.2 mpd local / 2.0 mpd FCY. Non-expiring Citi Miles.',
    isContactlessOnly: false,
    channelMode: 'both',
    themeClass: 'thumb-citi'
  }
];

export const MCC_DATABASE = {
  "5541": {
    name: "Petrol Service Stations (Shell, SPC, Esso, Caltex)",
    notes: "Exclusive: Pay with UOB PPV (Mobile Tap, S$600 cap) or UOB VS for an instant 14% discount (10% Shell GO+ & 4% UOB) + 4.0 mpd! Maybank World MC earns 4.0 mpd uncapped (10% off). Pro-tip: Buy Shell Vouchers on HeyMax under MCC 5311 for 4 mpd on OCBC/Citi Rewards.",
    candidatesLocal: [
      { id: "uob-ppv-contactless", baseRate: 4.0 },
      { id: "uob-vs-contactless", baseRate: 4.0 },
      { id: "mb-world-mc", baseRate: 4.0 },
      { id: "kf-uob", baseRate: 1.2 }
    ],
    candidatesOverseas: [
      { id: "uob-vs-fcy", baseRate: 4.0 },
      { id: "mb-world-mc", baseRate: 3.2 },
      { id: "mb-horizon-vs", baseRate: 2.8 }
    ]
  },
  "5812": {
    name: "Restaurants & Dining Places",
    notes: "Sit-down restaurants, cafes. All dining and contactless cards eligible.",
    candidatesLocal: [
      { id: "uob-ladys-solitaire", baseRate: 4.0 },
      { id: "hsbc-rev", baseRate: 4.0 },
      { id: "uob-vs-contactless", baseRate: 4.0 },
      { id: "uob-ppv-contactless", baseRate: 4.0 },
      { id: "mb-world-mc", baseRate: 4.0 }
    ],
    candidatesOverseas: [
      { id: "uob-ladys-solitaire", baseRate: 4.0 },
      { id: "uob-vs-fcy", baseRate: 4.0 },
      { id: "mb-world-mc", baseRate: 3.2 },
      { id: "mb-horizon-vs", baseRate: 2.8 }
    ]
  },
  "5814": {
    name: "Fast Food & Quick Service (McD, KFC, Starbucks, GrabFood)",
    notes: "Contactless tap in-person; PPV Online applies in-app. In-store Citi Rewards gives 0.4 mpd.",
    candidatesLocal: [
      { id: "uob-ppv-contactless", baseRate: 4.0 },
      { id: "uob-ppv-online", baseRate: 4.0 },
      { id: "hsbc-rev", baseRate: 4.0 },
      { id: "uob-ladys-solitaire", baseRate: 4.0 },
      { id: "uob-vs-contactless", baseRate: 4.0 }
    ],
    candidatesOverseas: [
      { id: "uob-vs-fcy", baseRate: 4.0 },
      { id: "uob-ladys-solitaire", baseRate: 4.0 },
      { id: "mb-world-mc", baseRate: 3.2 }
    ]
  },
  "5813": {
    name: "Bars, Taverns, Lounges & Nightclubs",
    notes: "Pubs and bars. EXCLUDED on UOB Lady's Dining (requires Entertainment category!). Use HSBC Rev, KF UOB, or Mobile Tap.",
    candidatesLocal: [
      { id: "hsbc-rev", baseRate: 4.0 },
      { id: "uob-ppv-contactless", baseRate: 4.0 },
      { id: "uob-vs-contactless", baseRate: 4.0 }
    ],
    candidatesOverseas: [
      { id: "uob-vs-fcy", baseRate: 4.0 },
      { id: "mb-world-mc", baseRate: 3.2 }
    ]
  },
  "5811": {
    name: "Catering Services",
    notes: "Catering by DBS Lady's (Dining) & HSBC Rev. EXCLUDED on Krisflyer UOB.",
    candidatesLocal: [
      { id: "uob-ladys-solitaire", baseRate: 4.0 },
      { id: "hsbc-rev", baseRate: 4.0 },
      { id: "uob-vs-contactless", baseRate: 4.0 }
    ],
    candidatesOverseas: [{ id: "uob-vs-fcy", baseRate: 4.0 }]
  },
  "5411": {
    name: "Supermarkets & Groceries (FairPrice, Cold Storage, Sheng Siong)",
    notes: "DBS yuu earns 10.0 mpd on Cold Storage & Giant (min S$800). FairPrice App: use UOB PPV Online (4.0 mpd). Sheng Siong / in-store: use UOB PPV Contactless (4.0 mpd).",
    candidatesLocal: [
      { id: "dbs-yuu", baseRate: 10.0 },
      { id: "uob-ppv-online", baseRate: 4.0 },
      { id: "uob-ppv-contactless", baseRate: 4.0 },
      { id: "hsbc-rev", baseRate: 4.0 }
    ],
    candidatesOverseas: [
      { id: "uob-vs-fcy", baseRate: 4.0 },
      { id: "mb-world-mc", baseRate: 3.2 }
    ]
  },
  "5462": {
    name: "Bakeries & Cake Shops (Cedele, Chateraise, Bengawan Solo)",
    notes: "Bread and pastries. EXCLUDED on UOB Lady's Dining & KF UOB! Use HSBC Rev or Mobile Tap (PPV/VS).",
    candidatesLocal: [
      { id: "hsbc-rev", baseRate: 4.0 },
      { id: "uob-ppv-contactless", baseRate: 4.0 },
      { id: "uob-vs-contactless", baseRate: 4.0 }
    ],
    candidatesOverseas: [{ id: "uob-vs-fcy", baseRate: 4.0 }]
  },
  "5441": {
    name: "Candy, Nut & Confectionery Stores",
    notes: "Sweet shops, candy stores. EXCLUDED on UOB Lady's Dining & KF UOB! Use HSBC Rev or Mobile Tap (PPV/VS).",
    candidatesLocal: [
      { id: "hsbc-rev", baseRate: 4.0 },
      { id: "uob-ppv-contactless", baseRate: 4.0 },
      { id: "uob-vs-contactless", baseRate: 4.0 }
    ],
    candidatesOverseas: [{ id: "uob-vs-fcy", baseRate: 4.0 }]
  },
  "5499": {
    name: "Misc Food Stores & Specialty Food",
    notes: "Specialty food stores, GrabFood direct merchant, 7-Eleven. NOT covered by UOB Lady's Dining. Use PPV, VS or yuu (if 7-Eleven).",
    candidatesLocal: [
      { id: "dbs-yuu", baseRate: 10.0 },
      { id: "uob-ppv-contactless", baseRate: 4.0 },
      { id: "uob-ppv-online", baseRate: 4.0 },
      { id: "uob-vs-contactless", baseRate: 4.0 }
    ],
    candidatesOverseas: [{ id: "uob-vs-fcy", baseRate: 4.0 }]
  },
  "5912": {
    name: "Pharmacies & Personal Care (Guardian, Watsons, Unity)",
    notes: "Guardian gives 10 mpd on DBS yuu! Watsons gives 6.0 mpd on OCBC Rewards promo! Unity / general: PPV or HSBC Rev.",
    candidatesLocal: [
      { id: "dbs-yuu", baseRate: 10.0 },
      { id: "ocbc-rewards", baseRate: 6.0 },
      { id: "uob-ppv-contactless", baseRate: 4.0 },
      { id: "hsbc-rev", baseRate: 4.0 },
      { id: "uob-vs-contactless", baseRate: 4.0 }
    ],
    candidatesOverseas: [
      { id: "uob-vs-fcy", baseRate: 4.0 },
      { id: "mb-world-mc", baseRate: 3.2 }
    ]
  },
  "5977": {
    name: "Cosmetic & Beauty Stores (Sephora, Innisfree, Bath & Body Works)",
    notes: "Cosmetic & fragrance retail. Whitelisted on OCBC Rewards, Citi Rewards (online/in-store), and HSBC Rev. PPV / VS contactless in-person.",
    candidatesLocal: [
      { id: "ocbc-rewards", baseRate: 4.0 },
      { id: "citi-rewards", baseRate: 4.0 },
      { id: "hsbc-rev", baseRate: 4.0 },
      { id: "uob-ppv-contactless", baseRate: 4.0 },
      { id: "uob-vs-contactless", baseRate: 4.0 },
      { id: "dbs-wwmc", baseRate: 4.0 }
    ],
    candidatesOverseas: [
      { id: "ocbc-rewards", baseRate: 4.0 },
      { id: "uob-vs-fcy", baseRate: 4.0 },
      { id: "mb-world-mc", baseRate: 3.2 },
      { id: "mb-horizon-vs", baseRate: 2.8 }
    ]
  },
  "5311": {
    name: "Department Stores (Takashimaya, Tangs, BHG, Metro, Isetan)",
    notes: "Department stores qualify on UOB Lady's (Fashion), OCBC Rewards, Citi Rewards (in-store tap & online), and HSBC Rev.",
    candidatesLocal: [
      { id: "uob-ladys-solitaire", baseRate: 4.0 },
      { id: "ocbc-rewards", baseRate: 4.0 },
      { id: "citi-rewards", baseRate: 4.0 },
      { id: "hsbc-rev", baseRate: 4.0 },
      { id: "uob-ppv-contactless", baseRate: 4.0 },
      { id: "uob-vs-contactless", baseRate: 4.0 }
    ],
    candidatesOverseas: [
      { id: "uob-ladys-solitaire", baseRate: 4.0 },
      { id: "ocbc-rewards", baseRate: 4.0 },
      { id: "uob-vs-fcy", baseRate: 4.0 },
      { id: "mb-world-mc", baseRate: 3.2 }
    ]
  },
  "5309": {
    name: "Duty Free Stores (Changi Airport Shilla, Lotte, KrisShop)",
    notes: "Duty-free airport retail. Covered under general online blacklist (DBS WWMC / Citi Rewards) or mobile contactless in-person (PPV / VS).",
    candidatesLocal: [
      { id: "uob-ppv-contactless", baseRate: 4.0 },
      { id: "uob-vs-contactless", baseRate: 4.0 },
      { id: "dbs-wwmc", baseRate: 4.0 },
      { id: "citi-rewards", baseRate: 4.0 }
    ],
    candidatesOverseas: [
      { id: "uob-vs-fcy", baseRate: 4.0 },
      { id: "mb-world-mc", baseRate: 3.2 }
    ]
  },
  "5651": {
    name: "Family Clothing Stores (Uniqlo, Zara, Cotton On)",
    notes: "Whitelisted on UOB Lady's (Fashion), OCBC Rewards, Citi Rewards (in-store tap & online), and HSBC Rev.",
    candidatesLocal: [
      { id: "uob-ladys-solitaire", baseRate: 4.0 },
      { id: "ocbc-rewards", baseRate: 4.0 },
      { id: "citi-rewards", baseRate: 4.0 },
      { id: "hsbc-rev", baseRate: 4.0 },
      { id: "uob-ppv-contactless", baseRate: 4.0 },
      { id: "uob-vs-contactless", baseRate: 4.0 }
    ],
    candidatesOverseas: [
      { id: "uob-ladys-solitaire", baseRate: 4.0 },
      { id: "ocbc-rewards", baseRate: 4.0 },
      { id: "uob-vs-fcy", baseRate: 4.0 },
      { id: "mb-world-mc", baseRate: 3.2 }
    ]
  },
  "5691": {
    name: "Men's & Women's Clothing Stores (H&M, Massimo Dutti, G2000)",
    notes: "Apparel & fashion retail. Whitelisted on UOB Lady's (Fashion), OCBC Rewards, Citi Rewards (in-store & online), and HSBC Rev. PPV / VS earn via contactless tap.",
    candidatesLocal: [
      { id: "uob-ladys-solitaire", baseRate: 4.0 },
      { id: "ocbc-rewards", baseRate: 4.0 },
      { id: "citi-rewards", baseRate: 4.0 },
      { id: "hsbc-rev", baseRate: 4.0 },
      { id: "uob-ppv-contactless", baseRate: 4.0 },
      { id: "uob-vs-contactless", baseRate: 4.0 },
      { id: "dbs-wwmc", baseRate: 4.0 }
    ],
    candidatesOverseas: [
      { id: "uob-ladys-solitaire", baseRate: 4.0 },
      { id: "ocbc-rewards", baseRate: 4.0 },
      { id: "uob-vs-fcy", baseRate: 4.0 },
      { id: "mb-world-mc", baseRate: 3.2 }
    ]
  },
  "5621": {
    name: "Women's Ready-to-Wear (Love Bonito, Mango)",
    notes: "Whitelisted on UOB Lady's (Fashion), OCBC Rewards, Citi Rewards (in-store & online), and HSBC Rev.",
    candidatesLocal: [
      { id: "uob-ladys-solitaire", baseRate: 4.0 },
      { id: "ocbc-rewards", baseRate: 4.0 },
      { id: "citi-rewards", baseRate: 4.0 },
      { id: "hsbc-rev", baseRate: 4.0 },
      { id: "uob-ppv-contactless", baseRate: 4.0 },
      { id: "uob-vs-contactless", baseRate: 4.0 }
    ],
    candidatesOverseas: [
      { id: "uob-ladys-solitaire", baseRate: 4.0 },
      { id: "ocbc-rewards", baseRate: 4.0 },
      { id: "uob-vs-fcy", baseRate: 4.0 },
      { id: "mb-world-mc", baseRate: 3.2 }
    ]
  },
  "5631": {
    name: "Women's Accessory & Specialty Shops (Charles & Keith, Lovisa)",
    notes: "Bags, scarves, hair accessories, specialty fashion. Whitelisted on UOB Lady's (Fashion), OCBC Rewards, Citi Rewards (in-store & online), and HSBC Rev.",
    candidatesLocal: [
      { id: "uob-ladys-solitaire", baseRate: 4.0 },
      { id: "ocbc-rewards", baseRate: 4.0 },
      { id: "citi-rewards", baseRate: 4.0 },
      { id: "hsbc-rev", baseRate: 4.0 },
      { id: "uob-ppv-contactless", baseRate: 4.0 },
      { id: "uob-vs-contactless", baseRate: 4.0 },
      { id: "dbs-wwmc", baseRate: 4.0 }
    ],
    candidatesOverseas: [
      { id: "uob-ladys-solitaire", baseRate: 4.0 },
      { id: "ocbc-rewards", baseRate: 4.0 },
      { id: "uob-vs-fcy", baseRate: 4.0 },
      { id: "mb-world-mc", baseRate: 3.2 }
    ]
  },
  "5661": {
    name: "Shoe Stores (Foot Locker, Skechers, Bata, Crocs)",
    notes: "Footwear retail. Explicitly whitelisted on UOB Lady's (Fashion), OCBC Rewards, Citi Rewards (in-store tap & online), and HSBC Rev.",
    candidatesLocal: [
      { id: "uob-ladys-solitaire", baseRate: 4.0 },
      { id: "ocbc-rewards", baseRate: 4.0 },
      { id: "citi-rewards", baseRate: 4.0 },
      { id: "hsbc-rev", baseRate: 4.0 },
      { id: "uob-ppv-contactless", baseRate: 4.0 },
      { id: "uob-vs-contactless", baseRate: 4.0 },
      { id: "dbs-wwmc", baseRate: 4.0 }
    ],
    candidatesOverseas: [
      { id: "uob-ladys-solitaire", baseRate: 4.0 },
      { id: "ocbc-rewards", baseRate: 4.0 },
      { id: "uob-vs-fcy", baseRate: 4.0 },
      { id: "mb-world-mc", baseRate: 3.2 }
    ]
  },
  "5941": {
    name: "Sporting Goods Stores (Decathlon, RSH, JD Sports)",
    notes: "Sporting goods, golf equipment, running gear, Decathlon. ⚠️ Excluded on UOB Lady's (Fashion). In-person: PPV / VS / HSBC Rev (Apple/Google Pay). Online: DBS WWMC / Citi Rewards / HSBC Rev.",
    candidatesLocal: [
      { id: "uob-ppv-contactless", baseRate: 4.0 },
      { id: "uob-vs-contactless", baseRate: 4.0 },
      { id: "hsbc-rev", baseRate: 4.0 },
      { id: "dbs-wwmc", baseRate: 4.0 },
      { id: "citi-rewards", baseRate: 4.0 }
    ],
    candidatesOverseas: [
      { id: "uob-vs-fcy", baseRate: 4.0 },
      { id: "mb-world-mc", baseRate: 3.2 },
      { id: "mb-horizon-vs", baseRate: 2.8 },
      { id: "uob-prvi", baseRate: 2.4 }
    ]
  },
  "5944": {
    name: "Jewelry, Watch, Clock & Silverware Stores",
    notes: "Watch boutiques & jewelers (The Hour Glass, Cortina, Tiffany, Cartier, Rolex). ⚠️ Excluded on UOB Lady's and OCBC Rewards. Use mobile contactless (PPV / VS / HSBC Rev) in-person, or DBS WWMC / Citi Rewards online.",
    candidatesLocal: [
      { id: "uob-ppv-contactless", baseRate: 4.0 },
      { id: "uob-vs-contactless", baseRate: 4.0 },
      { id: "hsbc-rev", baseRate: 4.0 },
      { id: "dbs-wwmc", baseRate: 4.0 },
      { id: "citi-rewards", baseRate: 4.0 }
    ],
    candidatesOverseas: [
      { id: "uob-vs-fcy", baseRate: 4.0 },
      { id: "mb-world-mc", baseRate: 3.2 },
      { id: "mb-horizon-vs", baseRate: 2.8 },
      { id: "uob-prvi", baseRate: 2.4 }
    ]
  },
  "5732": {
    name: "Electronics & Gadget Stores (Challenger, Courts, Best Denki, Apple)",
    notes: "Computers, TVs, home appliances, Apple retail. ⚠️ STRICTLY EXCLUDED on HSBC Rev, OCBC Rewards & UOB Lady's. In-person: UOB PPV / VS contactless only. Online: DBS WWMC / Citi Rewards.",
    candidatesLocal: [
      { id: "uob-ppv-contactless", baseRate: 4.0 },
      { id: "uob-vs-contactless", baseRate: 4.0 },
      { id: "dbs-wwmc", baseRate: 4.0 },
      { id: "citi-rewards", baseRate: 4.0 }
    ],
    candidatesOverseas: [
      { id: "uob-vs-fcy", baseRate: 4.0 },
      { id: "mb-world-mc", baseRate: 3.2 },
      { id: "mb-horizon-vs", baseRate: 2.8 },
      { id: "uob-prvi", baseRate: 2.4 }
    ]
  },
  "7999": {
    name: "Recreation & Attractions (Zoo, USS, Playgrounds, Klook)",
    notes: "Theme parks, zoo admissions, recreation bookings, escape rooms. ⚠️ Excluded on UOB Lady's (Entertainment) and HSBC Rev. In-person: UOB PPV / VS contactless. Online: DBS WWMC / Citi Rewards.",
    candidatesLocal: [
      { id: "uob-ppv-contactless", baseRate: 4.0 },
      { id: "uob-vs-contactless", baseRate: 4.0 },
      { id: "dbs-wwmc", baseRate: 4.0 },
      { id: "citi-rewards", baseRate: 4.0 }
    ],
    candidatesOverseas: [
      { id: "uob-vs-fcy", baseRate: 4.0 },
      { id: "mb-world-mc", baseRate: 3.2 },
      { id: "mb-horizon-vs", baseRate: 2.8 },
      { id: "uob-prvi", baseRate: 2.4 }
    ]
  },
  "7832": {
    name: "Motion Picture Theatres (Golden Village, Shaw, Cathay)",
    notes: "Cinemas. Whitelisted under UOB Lady's (Entertainment) and HSBC Rev. PPV/VS earn via contactless tap.",
    candidatesLocal: [
      { id: "uob-ladys-solitaire", baseRate: 4.0 },
      { id: "hsbc-rev", baseRate: 4.0 },
      { id: "uob-ppv-contactless", baseRate: 4.0 },
      { id: "uob-vs-contactless", baseRate: 4.0 }
    ],
    candidatesOverseas: [{ id: "uob-vs-fcy", baseRate: 4.0 }]
  },
  "4511": {
    name: "Airlines & Air Carriers (SIA, Scoot, EVA Air)",
    notes: "Direct booking with airlines. Krisflyer UOB gives 3.0 mpd uncapped. DBS WWMC / Citi Rewards online. HSBC Rev gives 4.0 mpd.",
    candidatesLocal: [
      { id: "kf-uob", baseRate: 3.0 },
      { id: "hsbc-rev", baseRate: 4.0 },
      { id: "dbs-wwmc", baseRate: 4.0 },
      { id: "citi-rewards", baseRate: 4.0 }
    ],
    candidatesOverseas: [
      { id: "kf-uob", baseRate: 3.0 },
      { id: "uob-vs-fcy", baseRate: 4.0 },
      { id: "mb-world-mc", baseRate: 3.2 }
    ]
  },
  "4722": {
    name: "Travel Agencies & OTAs (Agoda, Klook, Trip.com, Expedia)",
    notes: "OTAs & travel bookings. UOB Lady's (Travel) & HSBC Rev give 4.0 mpd. ⚠️ Citi Rewards strictly excludes travel agencies!",
    candidatesLocal: [
      { id: "uob-ladys-solitaire", baseRate: 4.0 },
      { id: "hsbc-rev", baseRate: 4.0 },
      { id: "dbs-wwmc", baseRate: 4.0 },
      { id: "uob-vs-contactless", baseRate: 4.0 }
    ],
    candidatesOverseas: [
      { id: "uob-ladys-solitaire", baseRate: 4.0 },
      { id: "uob-vs-fcy", baseRate: 4.0 },
      { id: "mb-world-mc", baseRate: 3.2 }
    ]
  },
  "7011": {
    name: "Hotels & Resorts (Direct & Booking.com)",
    notes: "Direct hotel booking. UOB Lady's (Travel) & HSBC Rev give 4.0 mpd. UOB VS gives 4.0 mpd in FCY.",
    candidatesLocal: [
      { id: "uob-ladys-solitaire", baseRate: 4.0 },
      { id: "hsbc-rev", baseRate: 4.0 },
      { id: "uob-vs-contactless", baseRate: 4.0 }
    ],
    candidatesOverseas: [
      { id: "uob-ladys-solitaire", baseRate: 4.0 },
      { id: "uob-vs-fcy", baseRate: 4.0 },
      { id: "mb-world-mc", baseRate: 3.2 }
    ]
  },
  "4111": {
    name: "Commuter Transport / SimplyGo (Bus & MRT Direct Tap)",
    notes: "Direct contactless tap at MRT gantries / buses. DBS yuu gives 10.0 mpd (min S$800). PPV Contactless gives 4.0 mpd.",
    candidatesLocal: [
      { id: "dbs-yuu", baseRate: 10.0 },
      { id: "uob-ppv-contactless", baseRate: 4.0 }
    ],
    candidatesOverseas: [{ id: "uob-vs-fcy", baseRate: 4.0 }]
  },
  "4121": {
    name: "Taxis & Ride-Hailing (Grab, Gojek, CDG Zig, TADA)",
    notes: "Gojek earns 10.0 mpd on DBS yuu! Grab/Zig in-app: DBS WWMC (4.0 mpd). UOB Lady's (Transport) gives 4.0 mpd.",
    candidatesLocal: [
      { id: "dbs-yuu", baseRate: 10.0 },
      { id: "dbs-wwmc", baseRate: 4.0 },
      { id: "uob-ladys-solitaire", baseRate: 4.0 },
      { id: "hsbc-rev", baseRate: 4.0 }
    ],
    candidatesOverseas: [
      { id: "uob-vs-fcy", baseRate: 4.0 },
      { id: "mb-world-mc", baseRate: 3.2 }
    ]
  },
  "7512": {
    name: "Car Rental Agencies (Hertz, Avis, Toyota Rent-A-Car)",
    notes: "Car rental for road trips. UOB Lady's (Travel) gives 4.0 mpd. UOB VS gives 4.0 mpd in FCY.",
    candidatesLocal: [
      { id: "uob-ladys-solitaire", baseRate: 4.0 },
      { id: "uob-vs-contactless", baseRate: 4.0 }
    ],
    candidatesOverseas: [
      { id: "uob-ladys-solitaire", baseRate: 4.0 },
      { id: "uob-vs-fcy", baseRate: 4.0 },
      { id: "mb-world-mc", baseRate: 3.2 }
    ]
  },
  "5999": {
    name: "General Retail & Souvenirs",
    notes: "Miscellaneous retail. In-person: Mobile tap (PPV/VS). Online: DBS WWMC or Citi Rewards.",
    candidatesLocal: [
      { id: "uob-ppv-contactless", baseRate: 4.0 },
      { id: "uob-vs-contactless", baseRate: 4.0 },
      { id: "dbs-wwmc", baseRate: 4.0 },
      { id: "citi-rewards", baseRate: 4.0 }
    ],
    candidatesOverseas: [
      { id: "uob-vs-fcy", baseRate: 4.0 },
      { id: "mb-world-mc", baseRate: 3.2 }
    ]
  },
  "8011": {
    name: "Doctors & Outpatient Clinics",
    notes: "Medical clinics. In-person mobile tap on PPV / VS gives 4.0 mpd. Online tele-consults on DBS WWMC.",
    candidatesLocal: [
      { id: "uob-ppv-contactless", baseRate: 4.0 },
      { id: "uob-vs-contactless", baseRate: 4.0 },
      { id: "dbs-wwmc", baseRate: 4.0 }
    ],
    candidatesOverseas: [{ id: "uob-vs-fcy", baseRate: 4.0 }]
  },
  "8021": {
    name: "Dentists & Orthodontists",
    notes: "Dental treatments. In-person mobile tap on PPV / VS gives 4.0 mpd. S$5 block rounding applies.",
    candidatesLocal: [
      { id: "uob-ppv-contactless", baseRate: 4.0 },
      { id: "uob-vs-contactless", baseRate: 4.0 }
    ],
    candidatesOverseas: [{ id: "uob-vs-fcy", baseRate: 4.0 }]
  },
  "8062": {
    name: "Hospitals & Inpatient Healthcare",
    notes: "Hospitals are strictly excluded by all 4.0 mpd cards. Use uncapped general spend cards: Vantage (1.5), PRVI (1.4), Altitude (1.3), Citi PM (1.2).",
    candidatesLocal: [],
    candidatesOverseas: []
  },
  "8211": {
    name: "Schools & Tuition Centres",
    notes: "Educational institutions are excluded from 4.0 mpd bonus categories. Base spend cards only.",
    candidatesLocal: [],
    candidatesOverseas: []
  },
  "8351": {
    name: "Child Care & Nursery Services",
    notes: "Childcare. If terminal supports mobile contactless, UOB PPV / VS awards 4.0 mpd! Verify merchant description.",
    candidatesLocal: [
      { id: "uob-ppv-contactless", baseRate: 4.0 },
      { id: "uob-vs-contactless", baseRate: 4.0 }
    ],
    candidatesOverseas: [{ id: "uob-vs-fcy", baseRate: 4.0 }]
  },
  "4900": {
    name: "Utilities (SP Group, Senoko, Geneco)",
    notes: "Utilities are globally excluded from 4 mpd. Use uncapped cards or payment facilities (CardUp / ipaymy).",
    candidatesLocal: [],
    candidatesOverseas: []
  },
  "6300": {
    name: "Insurance Premiums",
    notes: "Insurance premiums earn 0 miles on almost all cards. Base spend cards only.",
    candidatesLocal: [],
    candidatesOverseas: []
  },
  "6540": {
    name: "Stored Value & Wallet Top-Ups (GrabPay, Revolut)",
    notes: "Prepaid wallet top-ups are strictly excluded across all bank loyalty programs.",
    candidatesLocal: [],
    candidatesOverseas: []
  },
  "8398": {
    name: "Charities & Non-Profit Donations",
    notes: "Donations are universally excluded from points accrual.",
    candidatesLocal: [],
    candidatesOverseas: []
  },
  "9399": {
    name: "Government Services & Taxes (IRAS, LTA)",
    notes: "Government fees and taxes earn 0 miles. Use CardUp or DBS Vantage tax facilities.",
    candidatesLocal: [],
    candidatesOverseas: []
  }
};

export const MERCHANT_DIRECTORY = [
  // Supermarkets & Groceries
  { name: "NTUC FairPrice / FairPrice Finest / Xtra", mcc: "5411", tags: ["fairprice", "ntuc", "finest", "xtra", "warehouse club"] },
  { name: "Cold Storage / CS Fresh", mcc: "5411", tags: ["cold storage", "cs fresh", "jasons"] },
  { name: "Sheng Siong Supermarket", mcc: "5411", tags: ["sheng siong"] },
  { name: "Giant Hypermarket", mcc: "5411", tags: ["giant"] },
  { name: "Don Don Donki", mcc: "5411", tags: ["donki", "don don donki"] },
  { name: "Meidi-Ya Supermarket", mcc: "5411", tags: ["meidiya", "meidi-ya"] },
  { name: "RedMart (Online)", mcc: "5411", tags: ["redmart"] },
  { name: "Isetan Supermarket", mcc: "5411", tags: ["isetan supermarket"] },
  { name: "HAOmart / Eccellente", mcc: "5411", tags: ["haomart", "hao mart", "eccellente"] },
  { name: "Prime Supermarket", mcc: "5411", tags: ["prime"] },
  { name: "Little Farms", mcc: "5411", tags: ["little farms"] },
  { name: "Scoop Wholefoods", mcc: "5411", tags: ["scoop wholefoods", "scoop"] },

  // Fast Food & Coffee
  { name: "McDonald's", mcc: "5814", tags: ["mcdonalds", "mcd", "mccafe"] },
  { name: "KFC", mcc: "5814", tags: ["kfc", "kentucky"] },
  { name: "Subway", mcc: "5814", tags: ["subway"] },
  { name: "Burger King", mcc: "5814", tags: ["burger king", "bk"] },
  { name: "Starbucks Coffee", mcc: "5814", tags: ["starbucks", "sbux"] },
  { name: "The Coffee Bean & Tea Leaf", mcc: "5814", tags: ["coffee bean", "cbtl"] },
  { name: "Old Chang Kee", mcc: "5814", tags: ["old chang kee", "ock"] },
  { name: "MOS Burger", mcc: "5814", tags: ["mos burger"] },
  { name: "Shake Shack", mcc: "5814", tags: ["shake shack"] },
  { name: "Jollibee", mcc: "5814", tags: ["jollibee"] },
  { name: "Ya Kun Kaya Toast", mcc: "5814", tags: ["ya kun", "yakun"] },
  { name: "Toast Box", mcc: "5814", tags: ["toast box"] },
  { name: "Stuff'd", mcc: "5814", tags: ["stuffd", "stuff'd"] },
  { name: "Mr Bean", mcc: "5814", tags: ["mr bean"] },
  { name: "Fun Toast", mcc: "5814", tags: ["fun toast"] },
  { name: "Gong Cha", mcc: "5814", tags: ["gong cha"] },
  { name: "KOI Thé", mcc: "5814", tags: ["koi", "koi the"] },
  { name: "CHAGEE", mcc: "5814", tags: ["chagee"] },
  { name: "LiHO Tea", mcc: "5814", tags: ["liho"] },
  { name: "Luckin Coffee", mcc: "5814", tags: ["luckin", "luckin coffee"] },

  // Dining & Restaurants
  { name: "Haidilao Hot Pot", mcc: "5812", tags: ["haidilao", "hdl"] },
  { name: "Din Tai Fung", mcc: "5812", tags: ["din tai fung", "dtf"] },
  { name: "Genki Sushi", mcc: "5812", tags: ["genki sushi", "genki"] },
  { name: "Sushiro", mcc: "5812", tags: ["sushiro"] },
  { name: "Sushi Tei", mcc: "5812", tags: ["sushi tei"] },
  { name: "Paradise Dynasty / Paradise Group", mcc: "5812", tags: ["paradise dynasty", "paradise group", "beauty in the pot", "bitp"] },
  { name: "Crystal Jade", mcc: "5812", tags: ["crystal jade"] },
  { name: "Soup Restaurant", mcc: "5812", tags: ["soup restaurant"] },
  { name: "Dian Xiao Er", mcc: "5812", tags: ["dian xiao er", "dxe"] },
  { name: "Putien", mcc: "5812", tags: ["putien"] },
  { name: "Tim Ho Wan", mcc: "5812", tags: ["tim ho wan", "thw"] },
  { name: "Ichiban Boshi / Sushi", mcc: "5812", tags: ["ichiban boshi", "ichiban sushi"] },
  { name: "Saizeriya", mcc: "5812", tags: ["saizeriya"] },
  { name: "Swensen's", mcc: "5812", tags: ["swensens", "swensen's"] },
  { name: "Astons Specialities", mcc: "5812", tags: ["astons"] },
  { name: "Collin's Grille", mcc: "5812", tags: ["collins", "collin's"] },
  { name: "Song Fa Bak Kut Teh", mcc: "5812", tags: ["song fa"] },
  { name: "Poulet", mcc: "5812", tags: ["poulet"] },
  { name: "Nando's", mcc: "5812", tags: ["nandos", "nando's"] },
  { name: "Pepper Lunch", mcc: "5812", tags: ["pepper lunch"] },
  { name: "TamJai SamGor Mixian", mcc: "5812", tags: ["tamjai", "samgor"] },
  { name: "Ippudo Ramen", mcc: "5812", tags: ["ippudo"] },

  // Bakeries & Desserts
  { name: "BreadTalk", mcc: "5462", tags: ["breadtalk"] },
  { name: "Châteraisé", mcc: "5462", tags: ["chateraise"] },
  { name: "Cedele", mcc: "5462", tags: ["cedele"] },
  { name: "Four Leaves", mcc: "5462", tags: ["four leaves"] },
  { name: "Bengawan Solo", mcc: "5462", tags: ["bengawan solo"] },
  { name: "Swee Heng 1989 Bakery", mcc: "5462", tags: ["swee heng"] },
  { name: "Paris Baguette", mcc: "5462", tags: ["paris baguette"] },
  { name: "Tiong Bahru Bakery", mcc: "5462", tags: ["tbb", "tiong bahru bakery"] },
  { name: "Polar Puffs & Cakes", mcc: "5462", tags: ["polar puffs", "polar"] },
  { name: "PrimaDéli", mcc: "5462", tags: ["primadeli", "prima deli"] },
  { name: "Royce' Chocolate", mcc: "5441", tags: ["royce", "royce chocolate"] },
  { name: "Godiva Chocolatier", mcc: "5441", tags: ["godiva"] },

  // Food Delivery & Convenience
  { name: "GrabFood", mcc: "5499", tags: ["grabfood"] },
  { name: "foodpanda", mcc: "5499", tags: ["foodpanda", "pandamart"] },
  { name: "Deliveroo", mcc: "5499", tags: ["deliveroo"] },
  { name: "7-Eleven", mcc: "5499", tags: ["7-eleven", "7-11", "seven eleven"] },
  { name: "Cheers Convenience Store", mcc: "5499", tags: ["cheers"] },

  // Fashion & Apparel
  { name: "Uniqlo", mcc: "5651", tags: ["uniqlo"] },
  { name: "Zara", mcc: "5651", tags: ["zara"] },
  { name: "H&M", mcc: "5691", tags: ["h&m", "hm"] },
  { name: "Cotton On", mcc: "5691", tags: ["cotton on"] },
  { name: "Love, Bonito", mcc: "5621", tags: ["love bonito", "love, bonito", "lb"] },
  { name: "Massimo Dutti", mcc: "5691", tags: ["massimo dutti"] },
  { name: "Marks & Spencer (Clothing)", mcc: "5651", tags: ["marks & spencer", "m&s"] },
  { name: "Mango", mcc: "5621", tags: ["mango"] },
  { name: "G2000", mcc: "5691", tags: ["g2000"] },
  { name: "Pull & Bear", mcc: "5691", tags: ["pull & bear", "pull and bear"] },
  { name: "Bershka", mcc: "5691", tags: ["bershka"] },
  { name: "MUJI (Apparel/Retail)", mcc: "5311", tags: ["muji"] },

  // Shoes & Accessories
  { name: "Charles & Keith", mcc: "5631", tags: ["charles and keith", "cnk", "charles & keith"] },
  { name: "Pedro", mcc: "5661", tags: ["pedro"] },
  { name: "Lovisa", mcc: "5631", tags: ["lovisa"] },
  { name: "Foot Locker", mcc: "5661", tags: ["foot locker"] },
  { name: "Skechers", mcc: "5661", tags: ["skechers"] },
  { name: "Bata", mcc: "5661", tags: ["bata"] },
  { name: "Crocs", mcc: "5661", tags: ["crocs"] },

  // Sporting Goods
  { name: "Decathlon", mcc: "5941", tags: ["decathlon"] },
  { name: "Royal Sporting House", mcc: "5941", tags: ["royal sporting house", "rsh"] },
  { name: "JD Sports", mcc: "5941", tags: ["jd sports", "jd"] },
  { name: "Lululemon (Standalone Store)", mcc: "5941", tags: ["lululemon"] },
  { name: "Nike Store (Retail)", mcc: "5941", tags: ["nike"] },
  { name: "Adidas Store (Retail)", mcc: "5941", tags: ["adidas"] },
  { name: "Under Armour", mcc: "5941", tags: ["under armour"] },

  // Department Stores & Platforms
  { name: "Takashimaya Department Store", mcc: "5311", tags: ["takashimaya", "taka"] },
  { name: "Tangs Department Store", mcc: "5311", tags: ["tangs"] },
  { name: "Isetan Department Store", mcc: "5311", tags: ["isetan"] },
  { name: "BHG Department Store", mcc: "5311", tags: ["bhg"] },
  { name: "Metro Department Store", mcc: "5311", tags: ["metro"] },
  { name: "Daiso", mcc: "5311", tags: ["daiso"] },
  { name: "Lazada", mcc: "5311", tags: ["lazada"] },
  { name: "Taobao App", mcc: "5311", tags: ["taobao"] },
  { name: "Shopee Singapore", mcc: "5399", tags: ["shopee"] },
  { name: "Amazon Singapore", mcc: "5999", tags: ["amazon", "amazon sg"] },

  // Electronics & Gadgets
  { name: "Challenger", mcc: "5732", tags: ["challenger"] },
  { name: "Courts", mcc: "5732", tags: ["courts"] },
  { name: "Best Denki", mcc: "5732", tags: ["best denki"] },
  { name: "Gain City", mcc: "5732", tags: ["gain city"] },
  { name: "Harvey Norman", mcc: "5732", tags: ["harvey norman"] },
  { name: "Apple Store (Orchard / Jewel / MBS)", mcc: "5732", tags: ["apple", "apple store"] },
  { name: "Sony Store", mcc: "5732", tags: ["sony", "sony store"] },
  { name: "KrisShop (Inflight / Online)", mcc: "5309", tags: ["krisshop"] },

  // Watches & Luxury Jewelry
  { name: "The Hour Glass", mcc: "5944", tags: ["the hour glass", "hour glass", "thg"] },
  { name: "Cortina Watch", mcc: "5944", tags: ["cortina watch", "cortina"] },
  { name: "Watches of Switzerland", mcc: "5944", tags: ["watches of switzerland", "wos"] },
  { name: "Tiffany & Co.", mcc: "5944", tags: ["tiffany", "tiffany & co"] },
  { name: "Cartier", mcc: "5944", tags: ["cartier"] },
  { name: "Rolex Boutique", mcc: "5944", tags: ["rolex"] },
  { name: "Chow Tai Fook", mcc: "5944", tags: ["chow tai fook"] },
  { name: "SK Jewellery", mcc: "5944", tags: ["sk jewellery"] },
  { name: "Goldheart Jewelry", mcc: "5944", tags: ["goldheart"] },
  { name: "Lee Hwa Jewellery", mcc: "5944", tags: ["lee hwa"] },
  { name: "Poh Heng Jewellery", mcc: "5944", tags: ["poh heng"] },

  // Pharmacies & Beauty
  { name: "Guardian Pharmacy", mcc: "5912", tags: ["guardian"] },
  { name: "Watsons Personal Care", mcc: "5912", tags: ["watsons"] },
  { name: "Unity Pharmacy", mcc: "5912", tags: ["unity"] },
  { name: "Sephora", mcc: "5977", tags: ["sephora"] },
  { name: "Bath & Body Works", mcc: "5977", tags: ["bath and body works", "bbw"] },
  { name: "Innisfree", mcc: "5977", tags: ["innisfree"] },

  // Petrol
  { name: "Shell Service Station", mcc: "5541", tags: ["shell"] },
  { name: "SPC Petrol Station", mcc: "5541", tags: ["spc"] },
  { name: "Esso Service Station", mcc: "5541", tags: ["esso", "mobil"] },
  { name: "Caltex Service Station", mcc: "5541", tags: ["caltex"] },
  { name: "Sinopec", mcc: "5541", tags: ["sinopec"] },

  // Transport & Commuter
  { name: "SimplyGo (MRT / Bus Transit)", mcc: "4111", tags: ["simplygo", "transitlink", "mrt", "bus", "smrt", "sbstransit"] },
  { name: "Grab Rides", mcc: "4121", tags: ["grab", "grab ride", "grabtaxi"] },
  { name: "Gojek", mcc: "4121", tags: ["gojek", "go-jek"] },
  { name: "ComfortDelGro Taxi (CDG Zig)", mcc: "4121", tags: ["cdg", "zig", "comfortdelgro", "comfort taxi"] },
  { name: "TADA Mobility", mcc: "4121", tags: ["tada"] },
  { name: "Ryde", mcc: "4121", tags: ["ryde"] },
  { name: "Charge+ (EV Charging)", mcc: "5552", tags: ["charge+", "charge plus"] },
  { name: "Anywheel (Bike Sharing)", mcc: "7999", tags: ["anywheel"] },

  // Travel & Attractions
  { name: "Singapore Airlines (SIA)", mcc: "4511", tags: ["singapore airlines", "sia", "sq"] },
  { name: "Scoot", mcc: "4511", tags: ["scoot", "flyscoot"] },
  { name: "Klook Travel", mcc: "4722", tags: ["klook"] },
  { name: "Agoda", mcc: "4722", tags: ["agoda"] },
  { name: "Trip.com", mcc: "4722", tags: ["trip.com", "tripcom"] },
  { name: "Mandai Wildlife Reserve (Zoo / Bird Paradise)", mcc: "7999", tags: ["zoo", "mandai", "night safari", "river wonders", "bird paradise"] },
  { name: "Universal Studios Singapore (USS)", mcc: "7999", tags: ["uss", "universal studios", "rws"] },
  { name: "Golden Village Cinemas", mcc: "7832", tags: ["golden village", "gv"] },
  { name: "Shaw Theatres", mcc: "7832", tags: ["shaw theatres", "shaw"] },
  { name: "Cathay Cineplexes", mcc: "7832", tags: ["cathay"] },

  // Healthcare & Clinics
  { name: "Raffles Medical Group", mcc: "8011", tags: ["raffles medical", "raffles clinic"] },
  { name: "SingHealth Polyclinics", mcc: "8011", tags: ["polyclinic", "singhealth"] },
  { name: "National Healthcare Group (NHG)", mcc: "8011", tags: ["nhg polyclinic"] },
  { name: "Q&M Dental Surgery", mcc: "8021", tags: ["q&m", "q and m", "qm dental"] },
  { name: "Minmed Clinic", mcc: "8011", tags: ["minmed"] },
  { name: "Parkway Shenton", mcc: "8011", tags: ["parkway", "parkway shenton"] }
];

export function detectYuuMerchant(desc = "") {
  const clean = (desc || "").toLowerCase();
  if (clean.includes("cold storage") || clean.includes("cs fresh") || clean.includes("jasons deli")) return "Cold Storage";
  if (clean.includes("giant")) return "Giant";
  if (clean.includes("guardian")) return "Guardian";
  if (clean.includes("7-eleven") || clean.includes("7-11")) return "7-Eleven";
  if (clean.includes("foodpanda") || clean.includes("pandamart")) return "foodpanda";
  if (clean.includes("simplygo")) return "SimplyGo";
  if (clean.includes("gojek")) return "Gojek";
  if (clean.includes("chagee")) return "CHAGEE";
  if (clean.includes("singtel")) return "Singtel";
  if (clean.includes("charge+")) return "Charge+";
  if (clean.includes("anywheel")) return "Anywheel";
  return null;
}
