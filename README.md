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


## 🎚 Spend-Tier Cards (v1.14.0)

Cards whose bonus needs a minimum spend show progress to it instead of an "Uncapped" or "Cap" line.

- **KrisFlyer UOB:** 2.4 mpd needs S$1,000 of SIA Group spend (SIA, Scoot, KrisShop, Kris+, Pelago, matched on the transaction description) in the membership year. Set the membership-year start month in Settings; otherwise the calendar year is used. UOB credits the tier after the year ends, and the card says so.
- **Maybank World:** S$800/month unlocks 2.8 mpd, S$4,000/month unlocks 3.2 mpd. **Maybank Horizon:** S$800/month unlocks 2.8 mpd.
- The card badge reads "now → top rate", the bar shows progress with tier markers, and the card detail view explains the rule.
- A recommendation that names a card whose tier is not unlocked yet gets a warning line.
- Rules live in each card's `tierRule` in `js/config.js`; the logic is in `js/tiers.js`.
- Limit: spend is totalled from what you log on the card, so Maybank's foreign-currency and air-ticket conditions are not separated out.


## 👜 Luxury Brands (v1.14.1)

Added to the retailer lookup, all at medium confidence (MCCs are community-reported on CheckMCC, not bank-confirmed):

- **5631:** Celine, Louis Vuitton.
- **5691:** Chanel (fashion & bags), Dior (fashion & bags), Hermès, Gucci, Prada.
- **5944 (high confidence):** Cartier, Tiffany & Co, Van Cleef & Arpels, Bvlgari, Chaumet, Chopard.
- **5944 (medium):** Rolex, and Chanel Beauty (beauty counter).
- **5977:** Dior Beauty (beauty counter).
- Typing "chanel" or "dior" resolves to the fashion boutique; use "Chanel Beauty" / "Dior Beauty" for makeup and fragrance counters. Fix any wrong code with **✎ Wrong category?**; the real MCC on your card statement is the best source.
- **Household-set (medium):** Saint Laurent 5699, Bottega Veneta 5699, Balenciaga 5691, Givenchy 5631.
- **Low confidence (educated guesses, no source found; they show a warning):** fashion houses at 5691 (Burberry, Fendi, Loewe, Valentino, Versace, Dolce & Gabbana, Miu Miu, Balmain, Moncler, Max Mara, Armani, Lanvin, Alexander McQueen, Stella McCartney, Off-White, Golden Goose, Brunello Cucinelli, Berluti, Tom Ford, Ralph Lauren, Hugo Boss, Dunhill); bag labels at 5631 (Coach, Michael Kors, Kate Spade, Tory Burch, Longchamp, Furla, Mulberry, Delvaux); shoes at 5661 (Ferragamo, Jimmy Choo, Christian Louboutin); luggage and leather at 5948 (Goyard, Rimowa, Tumi, Montblanc); watches and jewellery at 5944 (Omega, Patek Philippe, Audemars Piguet, Richard Mille, TAG Heuer, Tudor, IWC, Breitling, Jaeger-LeCoultre, Vacheron Constantin, Longines, Seiko, Mikimoto, Boucheron, Graff, Harry Winston, Piaget); beauty at 5977 (La Mer, Aesop).


## 👟 Shoe Retailers (v1.14.2)

All medium confidence, set by the household (not bank-confirmed).

- **5655 (sports apparel and footwear):** Nike and Adidas (moved from 5651), Puma, New Balance, Asics, Under Armour, Reebok, Fila, Saucony, Hoka, On Running, Mizuno, Onitsuka Tiger, Salomon. 5661 and 5941 are offered as alternatives.
- **5661 (shoe stores):** Vincci, Bata, Hush Puppies, Skechers, Clarks, Crocs, Birkenstock, Dr. Martens, Havaianas, Ecco, Geox, Rockport, Camper, Aldo, Steve Madden, Call It Spring, Ugg, Timberland, Converse, Vans, Foot Locker, Sneakers Mania, Limited Edt, Allbirds, Bata Kids, Clarks Kids, Pazzion, plus Charles & Keith and Pedro from before.
- 5655 and 5661 earn the same on our modelled cards; 5941 (sporting goods) differs only for HSBC Revolution, which excludes it.


## 🛍 UOB Preferred Visa Online Rule (v1.14.3)

UOB Preferred Platinum Visa (Online) is now generated from UOB's own T&C list (v3.0, 10 Mar 2026) of eligible online MCCs, so it appears for every qualifying category instead of only the hand-written ones. That adds shoe stores (5661), men's and women's clothing (5691) and many other retail, dining and entertainment codes. It does **not** cover sports apparel (5655), sporting goods (5941) or air tickets. Online retail purchases only, not recurring payments, S$600/month sub-cap.


## ⌨️ MCC Typeahead Fix (v1.14.4)

- Typing the first digits of an MCC now lists up to 8 matching codes (it was 3), so the right one can be picked.
- Typing a full 4-digit code we don't have (for example 5094) no longer shows nothing: the list shows the closest known codes and the result says the code isn't in our list yet.


## ✈️ Airline and Watch MCCs (v1.14.5)

- **Airline codes 3000-3299** (one code per carrier) are now recognised. Each follows the Airlines (4511) rules, and typing a prefix like "30" lists matching codes.
- **5094 Precious Stones, Metals, Watches & Jewelry** is now a known category (Rolex offers it as an alternative to 5944).


## ✅ Clear MCC Selection (v1.15.0)

- Picking a category from the suggestions, or typing a complete known 4-digit code, now fills the box with the full text (for example **5311 · Department Stores**) and turns it green, so it is obvious which MCC is selected.
- Picking a retailer does the same: the box shows the brand with its MCC and category (for example **Starbucks · 5814 · Fast Food & Quick Service**). Choosing an alternative category chip updates the MCC in the box, and "Reset to default" puts the built-in one back.
- Tapping the box selects the whole text, so typing starts a new search. Any edit clears the green state. The ✕ button resets it.


## 🖼 Bigger Cards, Earning Profile, Names (v1.16.0)

- **Card artwork is larger** (real cards are 1.586:1): 96x61 in the card list (80x51 on small phones), 128x81 on the recommendation itself, 64x40 per step in a split, and 140x88 in the card detail sheet. The recommended card is now shown with its picture.
- **Earning profile & rules** in the card detail sheet is filled in: bonus and base mpd, any spend tiers or minimums, cap, channel (online, in-person, contactless only), whether the card is blacklist or whitelist, upcoming rate changes, the card's hint, and its bonus categories.
- **Renames:** the main total reads **Zhangs Total Miles**; the Household vault is labelled **Zhangs** and Sister is **Minsi**. Vault IDs are unchanged, so no data moves.


## 🔢 Thousands Separators (v1.17.0)

Dollar amounts and miles now show commas everywhere (for example $1,111.00 spent, Cap: $1,000, +5,358 mi), including caps, remaining space, progress notices, transactions, the archive, reconcile and the recommendation. CSV exports and amount inputs stay plain numbers. The formatting lives in `js/format.js`.


## 🩹 Vault Defaults Fix (v1.17.1)

A vault saved with partial entries (for example only the points for UOB UNI$) used to show "UNDEFINED" tiles and count miles at the wrong ratio. The app now takes each currency's name, unit and ratio from its own definitions and reads only the points from the saved vault, so the tiles always read correctly. The saved vault is tidied the next time you update points or log a transaction.

The Edit Points Balances sheet also failed to save on such a vault (nothing happened when you pressed Save) and kept a stuck "0" in each box. Save now works, empty balances show a faint 0 you can type over, tapping a box selects its value, and a failed save shows an error instead of failing silently.


## 🔓 Minimum-Spend Unlock Notes (v1.18.0)

When a recommended card's bonus rate only applies after a monthly minimum (UOB Visa Signature S$1,000, DBS yuu S$800, Maybank foreign-currency tiers), the recommendation no longer shows the full bonus as if it were already earned. Each affected row now says how much more to charge on that card before the cycle ends ("Charge S$267 more by 18 Nov (21d left)"), shows the miles you earn now at the base rate, and lists the extra miles that unlock once the minimum is met. The split header totals the miles now and the miles pending. Banks credit the bonus on the whole cycle's spend once the minimum is met, so a locked charge is pending, not lost. The note disappears once your logged spend plus the charge reaches the minimum.


## ⏳ Use Your Unspent 4 mpd (v1.19.0)

When a card's cycle has 7 days or fewer left and at least S$100 of bonus room is unspent, a banner at the top of the cards section says how much is about to expire and what it is worth in miles. Tapping it (or "💡 Use unspent 4 mpd" at any time) opens a sheet listing each card's remaining room, its cycle end date, the miles at stake, and whether filling it also reaches a minimum spend (UOB Visa Signature S$1,000). "Plan with the recommender" fills MCC 5311 (online) and the total so the waterfall split gives the Log Part buttons.

The idea: HeyMax gift vouchers code as MCC 5311 (Department Stores), which most bonus cards whitelist, so buying a voucher for a brand you really use is a way to spend the room before it resets. The sheet lists the HeyMax brands (about 80, Airalo eSIMs grouped) with their Max Miles per S$1, searchable, and tagged multi-use or single-use (multi-use vouchers can be spent down over several visits, so they suit an exact top-up amount; a "multi-use only" filter is included). The MCC claim comes from The Milelion (May 2025) and the brand list was read from HeyMax on 28 Oct 2026, so both can go stale. DBS Woman's World is counted but carries a warning, because readers report it no longer works on HeyMax.

HeyMax stock changes and a voucher can disappear from the site or app, so tap a brand in the list to mark it out of stock (dimmed, moved to the bottom, saved on this device; "Reset" clears it).


## 📥 Statement Import (v1.20.0)

Statements often come out before the month ends. "Import a bank statement (CSV)" (above the ledger, and in Settings) loads a CSV in your browser (it is not uploaded), asks which card it belongs to, finds the Date, Description and Amount columns itself (you can change them, including separate Debit/Credit columns and day/month vs month/day dates), then shows every line before anything is saved:

- **New**: not in your list yet. Ticked by default, untick to skip.
- **Already in your list**: same card, same amount and a date within 3 days. Left alone. One logged purchase can only match one statement line, so two identical coffees stay two lines.
- **Amount differs**: looks like the same purchase (close date and similar name, or close amount) but the amount disagrees. You choose: use the statement amount (your original is kept as `amtOriginal`), keep yours, or add it as a separate purchase.
- **Refunds and payments**: skipped, the app tracks spend.
- **Logged but not on this statement**: shown for information and left untouched (it may not have posted yet, or be on the wrong card).

Importing the same file twice does nothing, because imported lines carry a fingerprint. Miles on imported lines are estimates from the card's rules and the merchant name (marked `estimatedMiles`); bank points balances are only changed if you tick the box. PDF statements are not supported yet. No Firestore rules changed.
