# MilesTrack SG ✈️

> Independent credit card reward optimization, automated bonus cap tracking, and KrisFlyer mileage war chest management tailored specifically for the Singapore credit card landscape.

MilesTrack SG is a responsive, installable Progressive Web App (PWA) built with vanilla ES modules, Tailwind CSS, and Firebase Firestore. It eliminates mental math at checkout by dynamically calculating the highest-yielding card across MCCs, detecting merchant brand names, managing S$5 block rounding drop-offs, solving multi-card waterfall splits for big-ticket purchases, and auditing bank statements against billing cycles.

---

## 🚀 Key Features

### 1. Smart MCC & Retailer Recommender
- **Brand Name Directory (150+ SG Merchants):** Type everyday retailer names directly (*Decathlon, The Hour Glass, Courts, FairPrice, Sushiro, Haidilao, Uniqlo*) to resolve the exact MCC without knowing numeric codes.
- **Single Swipe vs. Waterfall Split Engine:**
  - **Single Card Mode:** Compares single-swipe net yields, factoring in base-rate overflow on capped cards vs. uncapped general spend cards.
  - **Waterfall Split Mode:** Calculates split payment steps across multiple cards to harvest 4.0 / 6.0 mpd bonus tiers without spilling into base rates.
- **Context-Aware Toggles:**
  - **In-Person vs. Online:** Filters out physical cards that require online gateways (e.g. DBS WWMC) or in-store contactless mobile tap (UOB PPV).
  - **Kris+ Mode:** Identifies Apple/Google Pay in-app routing (DBS WWMC 4.0 mpd, KF UOB 3.0 mpd) and enforces strict exclusions (Citi Rewards, UOB contactless).
  - **Overseas FCY Mode:** Prioritizes foreign currency multipliers (UOB VS 4.0 mpd, Maybank World MC 3.2 mpd, Maybank Horizon 2.8 mpd).
- **Specialty Stacking Calculations:**
  - **Shell Fuel 14% Instant Discount:** Computes gross-to-nett 14% pump savings (10% Shell GO+ + 4% UOB) + 4.0 mpd.
  - **OCBC Rewards 6.0 mpd Promo:** Dynamic cap tracking across Shopee, Lazada, Taobao, TikTok Shop, and Watsons.
  - **DBS yuu 10 mpd Tracker:** Tracks the S$800 monthly threshold and 4-distinct-merchant qualification requirement.

### 2. Multi-Card Cap & Billing Cycle Engine
- **Independent Billing Windows:** Supports **Calendar Month** (1st to end-of-month) and custom **Statement Month** cutoffs (e.g., UOB VS 18th–17th, Citi Rewards 15th–14th).
- **Category Cap Pooling:** Groups pooled capacities across dining, supermarkets, shopping, transport, and travel.
- **UOB S$5 Rounding Protection:** Flags transaction amounts that lose miles due to integer-divided S$5 UNI$ blocks.
- **UOB Annual Fee Defense:** Scans card renewal dates to issue warnings 45 days before automatic UNI$ point deductions.

### 3. Mileage War Chest & Multi-Account Vaults
- **Household & Separate Family Vaults:** Dedicated storage for Household miles vs. independent sister/family vaults, connected in real-time via Firestore snapshot listeners.
- **KrisFlyer 4-Pax Target Radar:** Real-time progress bar toward 4-passenger Business Class Saver redemption targets across KrisFlyer Zones 1 through 13.
- **Points Expiry Radar:** Expiry monitoring across bank points currencies (UNI$, DBS Points, yuu Points, Citi TYP, OCBC$, HSBC Rewards, TREATS).

### 4. Statement Audit & Full-Year Archives
- **Monthly Statement Reconcile:** Audit physical bank statement totals against app-logged charges within exact statement cycle windows to identify unrecorded spend or over-logging.
- **Multi-Year & Annual Rollups:** Select any calendar month or full year (e.g., `🗓️ Full Year 2026`) to inspect blended mpd yields, transaction logs, and cumulative spend per card.
- **Data Portability:** 1-click JSON backup and CSV ledger exports.

---

## 🛠️ Architecture & Tech Stack

The application uses native ES modules without requiring node build tools or bundlers:

```text
milestrack-sg/
├── index.html              # Core app shell, viewports, datalists, and modal sheets
├── manifest.json           # PWA configuration, theme colors, and icons
├── sw.js                   # Service Worker cache management & offline PWA runtime
├── css/
│   └── style.css           # Custom dark UI styling, responsive typography, variables
├── js/
│   ├── config.js           # Card definitions, MCC database, 150+ merchant directory, tiers
│   ├── state.js            # Central reactive state singleton
│   ├── firebase.js         # Firebase Auth, Firestore snapshot listeners, and CRUD operations
│   ├── recommender.js      # Waterfall solver, single-swipe scorer, MCC resolver
│   ├── ui.js               # DOM manipulators, modals, audit sheets, cap rendering
│   └── app.js              # Application bootstrapper, DOM event wiring, SW updater
└── assets/
    └── cards/              # Card artwork & high-res assets
