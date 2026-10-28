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

---

## 👥 Vaults & Roles (v1.9.0)

Roles resolve on Google Sign-In from the email lists in `js/config.js`. Each role is scoped to one vault document in `milestrack_vaults`.

| Role | Vault doc | Access |
| :--- | :--- | :--- |
| PRIMARY | `primary` (shown as "Household") | Own vault + live **All Vault Balances** tally of every vault |
| SISTER | `sister` | Own vault; read-only view of the household vault |
| ELLICE | `ellice` | Own vault only |
| EUGENE | `eugene` | Own vault only |
| TEST | `test` | Own vault only (sandbox) |

> ⚠️ The role check in the client is for UX only. Actual access control must be enforced by your Firestore security rules (each member may read/write only their own `milestrack_vaults`, `milestrack_settings` and `milestrack_txns` documents; PRIMARY may read all vaults).

## 🧮 Miles Conversion

Ratios are stored per currency in `DEFAULT_VAULT` (`js/config.js`) and miles = `floor(points × ratio)`.

| Currency | Ratio |
| :--- | :--- |
| UNI$ (UOB) | 1 = 2.0 mi |
| Citi TYP | 1 = 0.4 mi |
| Citi Miles | 1 = 1.0 mi |
| DBS Points | 1 = 2.0 mi |
| yuu Points | 36 pts = 10 mi (ratio 0.28) |
| OCBC$ | 1 = 0.4 mi |
| HSBC Points | 1 = 0.4 mi |
| Maybank TREATS | 1 = 0.4 mi |
| KrisFlyer | 1 = 1.0 mi |

## 🔎 Retailer Lookup & MCC Coverage (v1.11.0)

Type a store name instead of an MCC. The recommender suggests matching retailers as you type (tolerates typos and shortcuts like "mcd", "sbux", "7-11"), then resolves the brand to its MCC and recommends a card.

- **Curated list:** `js/retailers.js` maps ~300 Singapore brands to MCCs. Each entry has a confidence flag: **high** (reliable), **medium** (can vary by outlet/app, shown with a note), **low** (true MCC probably isn't one of our categories; shown with a warning).
- **Household corrections:** tap **✎ Wrong category?** to correct a brand, or **＋ Add this retailer** for one that isn't listed. Corrections are saved in Firestore (`milestrack_merchants`) and shared with everyone in the household. **Reset to default** undoes a correction.
- **Alternatives:** brands that are coded differently depending on the purchase (e.g. Grab vs GrabFood) show one-tap alternative categories.
- **Rules:** publish `docs/firestore.rules` so the new `milestrack_merchants` collection is readable/writable by household members only.
- **Any MCC is recognised:** `js/mcc-names.js` holds ~230 standard MCC codes and names, so typing a code like `5732` or a name like "cinema" works even though it isn't one of the hand-written categories.
- **Two kinds of category:** categories in `MCC_DATABASE` (`js/config.js`) have hand-written card rules and are unchanged. Every other code gets a generated result: your best everyday-spend cards (uncapped cards earning 1+ mpd) at their base rate, with a note that no bonus rule is set up; or, for categories banks commonly exclude (cash, gambling, tax, rent, government), a "commonly excluded, check your T&Cs" result.
- **Adding bonus rules for a new category:** add an entry to `MCC_DATABASE` with its `candidatesLocal` / `candidatesOverseas` cards. It then overrides the generated fallback automatically.


## 🏠 Household Card Rules (v1.12.0)

The household admin (primary role) can set which cards earn a bonus on any category from inside the app, without editing code.

- **Where:** look up a category or retailer, then tap **＋ Set household card rules** (or **⚙ Edit household card rules**) under the result. Only the primary role sees these buttons.
- **What you set:** tick the cards that earn a bonus and give each a rate in miles per dollar, separately for **Local** and **Overseas**. Add an optional note and an optional **valid until** date.
- **Replaces, not adds:** a household rule replaces the built-in entry for that category (both lists) while it is active. The editor starts from the built-in rules, so you only change what differs. After the valid-until date passes, the built-in rules apply again and the admin sees an "expired" prompt to renew or remove it.
- **Everyone benefits:** rules are stored in Firestore (`milestrack_mccRules`, one document per MCC) and every member's recommender uses them. Results show a **🏠 Household rule** line with the date set and the expiry.
- **Remove:** **↺ Remove rule (use built-in)** deletes the document.
- **Still in code:** the Citi Rewards in-person category whitelist, Maybank World overseas spend tiers, and the OCBC 6 mpd S$1,000 cap.
- **Firestore:** publish the updated `docs/firestore.rules`. Everyone signed in as a household member can read `milestrack_mccRules`; only the primary role can write it.


## 📜 Bank-Rule Candidates (v1.13.0)

Eight cards no longer rely on hand-written category lists. `js/cardrules.js` holds each bank's published exclusion or eligibility list and generates that card's candidates for **any** MCC.

- **Cards covered:** UOB Visa Signature (contactless and FCY), UOB Preferred Platinum Visa, OCBC Rewards, Citi Rewards, HSBC Revolution, DBS Woman's World, and Maybank Horizon air tickets.
- **Blacklist cards now count:** UOB VS and PPV earn 4 mpd on contactless spend at any MCC outside the UOB exclusion list, so they appear for things like sporting goods (5941) when contactless is on. Turning contactless off hides them.
- **HSBC Revolution** only earns online or contactless, so it is hidden for in-person spend with contactless off.
- **Dated rates:** `rateSchedule` on a card switches its rate on a date. DBS Vantage drops from 1.5 to 1.4 mpd local on 2 Nov 2026.
- **Household rules still win:** an active household rule replaces these generated candidates for its category.
- **Maintenance:** sources and retrieval dates are in the header of `js/cardrules.js`. Update the sets there when a bank changes its terms.
- **Not modelled yet:** KrisFlyer UOB 2.4 mpd (needs S$1,000 SIA Group spend per membership year), UOB PRVI 3.0 mpd on IDR/MYR/THB/VND, UOB Lady's other categories.
- Firestore rules are unchanged.
