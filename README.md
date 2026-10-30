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
- **Independent Billing Windows:** Supports **Calendar Month** (1st to end-of-month) and custom **Statement Month** cutoffs (e.g., UOB VS 18th–17th, Citi Rewards Mastercard 15th–14th, Citi Rewards Visa 29th–28th).
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
- **Check points with the banks (Vault):** importing a statement also reads its points summary (DBS, OCBC, Maybank, UOB; HSBC through the PDF-to-CSV script) and checks it against what your entries should have earned, allowing for bonuses that banks credit a month later. Each Vault tile shows ✓ Matches, ⏳ Bonus still due, ⚠️ Short or ➕ More than expected; a shortfall lists the entries most likely to have missed their bonus. Big entries (S$250 and up, adjustable) on DBS, UOB PPV and HSBC go on a list to look up in the bank's app. You can add a balance you looked up, log transfers and redemptions, and set a tile to the bank's figure.
- **Citi Rewards Visa:** a separate card from the Citi Rewards Mastercard (same 4 mpd rules and S$1,000 cap, its own statement cycle from the 29th, points share the `citi_typ` vault). Switch it on in Settings > Cards; on the first statement import pick the card once so its last 4 digits are remembered.
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

Statements often come out before the month ends. "Import a bank statement" (above the ledger, and in Settings) loads a CSV, Excel .xls or PDF statement in your browser (it is not uploaded), asks which card it belongs to, finds the Date, Description and Amount columns itself (you can change them, including separate Debit/Credit columns and day/month vs month/day dates), then shows every line before anything is saved:

- **New**: not in your list yet. Ticked by default, untick to skip.
- **Already in your list**: same card, same amount and a date within 3 days. Left alone. One logged purchase can only match one statement line, so two identical coffees stay two lines.
- **Amount differs**: looks like the same purchase (close date and similar name, or close amount) but the amount disagrees. You choose: use the statement amount (your original is kept as `amtOriginal`), keep yours, or add it as a separate purchase.
- **Refunds and payments**: skipped, the app tracks spend.
- **Logged but not on this statement**: shown for information and left untouched (it may not have posted yet, or be on the wrong card).

Importing the same file twice does nothing, because imported lines carry a fingerprint. Miles on imported lines are estimates from the card's rules and the merchant name (marked `estimatedMiles`); bank points balances are only changed if you tick the box. No Firestore rules changed. The recent-transactions query now loads up to 1,000 rows (was 200) so big imports stay visible.

DBS card CSVs (Transaction Date, Description, Debit Amount, Credit Amount, Transaction Status) are recognised as they come: the card is picked from the line at the top of the file (and remembered by its last four digits on this device), "Pending" lines are flagged because their amounts can still change, foreign-currency lines show the original amount, and merchant text like "SHENGSIONG@TAMPCTRL506 SINGAPORE SGP" is cleaned and matched to a known brand ("Sheng Siong") so it lines up with what you log by hand. The original statement text is kept on each imported transaction.

**More formats**
- **UOB `.xls`** (the "CC_TXN_History" download) is read directly. The card is detected from the account type and number, pending lines and foreign amounts are flagged, and the bank reference number is used so re-importing never duplicates. Visa Signature foreign-currency lines go to the FCY earning entry. UOB PPV / Lady's Solitaire have separate entries per channel or category, which a statement can't tell apart, so choose the entry you want and all lines go to it. Newer `.xlsx` files: save as CSV first.
- **PDF** text statements (e.g. Maybank World Mastercard) are read in the browser with pdf.js, loaded from a CDN the first time (so it needs a connection). Password-protected PDFs ask for the password. Scanned images are not supported.
- **Files with no header row**, or where spend is negative, are handled: columns are guessed from the content and signs are flipped automatically (there is a checkbox to override).
- Fees (annual, late, currency conversion) are listed but skipped by default, since they earn no miles and don't count toward minimum spend. A "Only lines from" date lets you skip what you already logged.
- OCBC (`TransactionHistory…csv`) and Citi (`ACCT_…csv`) exports carry no card name, so the bank is guessed from the default file name (OCBC Rewards / Citi Rewards) and the last four digits are remembered after you confirm. When judging whether spend is negative, payments and transfers are ignored.

## ↩️ Undo an import (v1.20.1)

Every import is tagged. Open "Import a bank statement" and, if there is a previous import, a note at the top shows what it did with an **Undo last import** button: the lines it added are deleted, and lines it changed (amount replaced, or "keep mine" notes) are put back as they were. Points balances only move for lines that were counted into them, i.e. if you ticked "add to my bank points balances". Tap it again to step back through earlier imports. You can still delete a single line with the bin icon in Recent Transactions; deleting an imported line no longer takes points off your balance if the import never added them. No Firestore rules changed. Imports made on v1.20.0 carry no tag and can only be deleted line by line.

**Statement cycle day:** the setting is the day a cycle *starts*, i.e. the day after your statement date (statement date 28th means enter 29). If it is set to your statement date, the last day of the cycle already counts as the next cycle and spend can look like it vanished. The settings labels now say this.

**Online vs tap (v1.20.1):** a statement doesn't say whether a UOB Preferred Visa purchase was online or by mobile tap (and Lady's Solitaire doesn't say dining vs travel). Choosing UOB Preferred Visa now shows a "Count as" dropdown on every new line, pre-set by a guess from the merchant name (web/app payments like Grab, Google, Shopee, anything with .com or a `*` prefix start as Online, the rest as Mobile Tap), plus a "Set all new lines to…" control at the top. Each line is saved to the entry you choose, so the right cap bar fills. Duplicate checks still look across all entries of the card.

## 🛠️ Blank screen after an update (v1.20.2)

The service worker used to trust the browser's HTTP cache when it downloaded a new version, and always served cached app files first. After an update on a phone that could mix old and new script files, which leaves a blank page. Now the new version is fetched fresh (bypassing the HTTP cache), the app's own files are loaded network-first (cache only when offline), and the new worker takes over straight away. If a phone is already stuck on a blank screen, clear the site's data once (Chrome menu, Settings, Site settings, the site, Clear & reset), or open the site in an Incognito tab.

## 🩹 Self-healing updates (v1.20.3)

A phone left with a blank screen by a half-applied update no longer needs its site data cleared by hand. Two safety nets: (1) when a new service worker takes over it reloads every open page onto the fresh files; (2) `index.html` runs a small watchdog, and if the app has not started after 6 seconds it deletes the cached app files, unregisters the service worker and reloads, once per tab session, so it cannot loop. Your data is in Firebase and is not affected. A device that is blank today fixes itself the next time it opens the site with a connection (it may take a few seconds and one automatic reload).

## 🧯 On-screen error panel (v1.20.4)

If the app cannot start, you now see a panel instead of a blank page: the app version, whether you are online, the service worker state, the browser, and the errors the page captured, with **Reset app files and reload** (clears cached app files only, never your data) and **Copy details**. It appears after the automatic recovery from v1.20.3 has already been tried once. Add `?debug` to the address (for example `https://your-site/?debug`) to open the same panel on a working app.

## 🍎 Safari-safe service worker (v1.20.5)

The v1.20.2 network-first service worker rebuilt navigation requests, which iPhone Safari can reject, leaving the page loading forever. Navigations are now fetched as they are, other app files use a no-cache request, a slow network (8s) falls back to the cached copy, and any failure ends in a plain fetch so a page is never left without a response.

## 🛍️ Kris+ merchants in the recommender (v1.21.0)

When the merchant you type in the recommender is on the Kris+ earning list, a cyan note appears under the result: the merchant's Kris+ earn rate, the extra Kris+ miles on your amount (for example Krispy Kreme, 3 mpd, S$50 = about +150 mi, on top of the card's own miles), and a button to see the cards in Kris+ mode. If several outlets match (Paradise, TungLok, JUMBO) the best is shown with the others listed.

**Data source:** `js/krisplus-merchants.js` holds 631 Singapore merchants (Dining 344, Retail 182, Activities 22, Services 50, Wellness 33) copied from Mainly Miles' "Complete list of all Kris+ earning merchants", Sep 2026 edition, published 24 Sep 2026: https://mainlymiles.com/2026/09/24/latest-kris-plus-earn-merchants-sep-2026/. That is a third-party list (Mainly Miles updates it at least monthly), not an official Kris+ list, and rates change often, so the note shows the source and date and tells you to check the app. Pelago was 7 mpd until 30 Sep 2026 and is stored at its normal 3 mpd. To refresh, paste the newest edition's tables into `KRISPLUS_RAW` and update `KRISPLUS_META`. No Firestore rules changed.

## 🛡️ Balance safety (v1.21.1)

Found after the main vault read 0 in Firestore: when the app's first read of your vault said "no document", it created a blank vault (all zeros). If that read was cache-only or offline (a stale or slow connection), the blank write could later reach the server and wipe real balances. Now a vault is only created when the server itself confirms there is none, and the app refuses to write the whole vault until it has been loaded from the cloud (you get a "balances have not finished loading" message instead). A new guard (`js/vault-guard.js`) also remembers, on each device, the last balances it saw that were not all zero; if the cloud ever shows all zeros again, a banner offers to restore them with one tap (nothing is written unless you tap Restore). No Firestore rules changed.

## 🔎 Browse all Kris+ merchants (v1.22.0)

In the recommender, **Browse all Kris+ merchants** (under the Kris+ switch) opens the full list of 631 merchants with a search box, category chips (Dining, Retail, Activities, Services, Wellness) and a sort toggle (highest rate first, or A to Z). Tapping a merchant fills the recommender with it, so you see the best card and the Kris+ earn note. The list, its source (Mainly Miles, Sep 2026 edition) and its "as of" date are shown in the sheet; rates change often, so check the Kris+ app. No Firestore rules changed.

## 🧭 Kris+ merchants get card rankings too (v1.22.1)

Typing or picking a Kris+ merchant that is not in the retailer list (for example "LeNu") used to say it "isn't in the retailer list yet" and rank nothing. Now the recommender ranks the cards on an assumed MCC taken from the merchant's Kris+ category (Dining 5812, Retail 5999, Activities 7999, Services 7299, Wellness 7298), with a few exceptions (petrol, taxis, fast food, cinemas, electronics, travel agents, car rental, supermarkets), shows the usual Kris+ earn note, and adds a line saying the MCC was assumed and may differ. Add the retailer to set the exact MCC. Curated retailers and typed MCC codes or category names are matched first, so they behave as before.

## 🔤 Kris+ merchants in the search dropdown (v1.22.2)

Typing in the recommender now suggests Kris+ merchants as well as the curated retailers, so "lenu" offers LeNu Chef Wai's Noodle Bar just like "paris" offers Paris Baguette. Kris+ suggestions show their usual category and a cyan "Kris+ N mpd" tag; picking one fills the box and ranks cards on the assumed category MCC (see v1.22.1). Merchants already in the retailer list are not shown twice. No Firestore rules changed.

## 🚫 DBS yuu only for yuu partner brands (v1.22.3)

Picking a specific merchant such as Sheng Siong used to rank the DBS yuu card first at 10 mpd, because the category rules (supermarkets, pharmacies, transit, taxis) list yuu for the whole MCC. Now, when you pick a named merchant that is not a yuu partner (Cold Storage, Giant, Guardian, 7-Eleven, foodpanda, Gojek, SimplyGo, CHAGEE, Singtel, Charge+), yuu is left out and a note explains why. Typing just a category or MCC code still lists yuu as before. No Firestore rules changed.

## 🟡 yuu partners always offered yuu (v1.22.4)

7-Eleven (which codes as MCC 5499), Singtel (4814), CHAGEE (5814) and other yuu partner brands did not list DBS yuu in their category rules, so yuu was never suggested for them. Picking a yuu partner brand now adds DBS yuu at 10 mpd (Singapore spend) with a note about the S$800 + 4 merchants condition. Together with v1.22.3, yuu appears for partner brands and not for other merchants. No Firestore rules changed.

## 🍵 CHAGEE counts for yuu in-app only (v1.22.5)

CHAGEE only counts as a DBS yuu merchant when you pay in its app. In the recommender, CHAGEE now gets DBS yuu only on **Online / In-App**; on In-Person yuu is left out with a note saying so. The yuu card hint and the CHAGEE retailer note say the same. No Firestore rules changed.

## 🗓️ Transaction date vs posting date (v1.23.0)

Banks count your spend toward a cap or minimum by either the **transaction date** (the day you paid) or the **posting date** (the day the bank posts it, usually 1 to 3 days later). Near the end of a cycle that decides which cycle a purchase lands in. Source: The MileLion, "Which cards track spending by transaction date vs posting date?", 30 Jul 2026: https://milelion.com/2026/07/30/which-cards-track-spending-by-transaction-date-vs-posting-date/ (a third-party summary, not bank T&Cs; rules live in `js/posting.js`).

- **By posting date:** Citi Rewards, HSBC Revolution, OCBC Rewards, and the UOB cards (Preferred Visa, Visa Signature, Lady's). **By transaction date:** DBS (yuu, WWMC), though DBS may use the merchant's timezone, so avoid the last day and the 1st. **Maybank** (World Mastercard, Horizon): counts to the month you spent in if it posts by the 7th (Horizon: 6th) of the next month. Cards with no cap or minimum spend are not affected.
- **Card tiles** show a "Posting date" / "Transaction date" label (tap it for the full table).
- **Banner:** in the last 3 days of a cycle (and the first 3 days of the next), a banner lists the posting-date cards whose cycle is ending and which days are at risk. Tap it for dates and the full table. Cycles follow each card's own end (calendar month or statement cutoff).
- **Recommender:** on the last days of a cycle, a result that uses a posting-date card says when a charge made today would probably post and whether it would count to the next cycle.
- **Logging:** on a posting-date card the log form shows a warning for that date and an optional **Posting date** field. A spend with a posting date counts to the cycle of that date in the card's cap and minimum-spend tracking, archives and reconcile view.
- **Statements:** when the file has a posting date column (UOB .xls and some CSVs), posting-date cards store it and use it for the cycle. Lines posted in a later cycle than the purchase are flagged; for lines already in your list you can tick "Record the posting date on my entry" (undo restores it). Files with no posting date flag purchases made in the last 2 days of a cycle as possibly counting to the next one.

Posting usually takes 1 to 3 days, longer over weekends and public holidays (the app skips weekends but does not know public holidays). No Firestore rules changed: the optional `postTs` field on a transaction needs no rule.

## 🧮 Cards with no cap room no longer win (v1.23.1)

A capped card whose monthly cap was already used up (for example DBS yuu at S$824 of S$822.86) was still shown as the winner at its base rate (0.14 mpd) when only one other card had room, because the single-card result fell back to the top-ranked card. Cards with no bonus room now rank behind cards that still have room, so the result is the best card that can still earn its bonus. If every card is full, the best of them is still shown at its base rate. No Firestore rules changed.

## 🧹 Cleaner Settings (v1.24.0)

Settings & Card Wallet is now three icon tabs with a Save button that stays in view:
- **Cards:** one row per physical card, grouped by bank (UOB, DBS, Citi, OCBC, HSBC, Maybank), with the card art and an on/off switch. The UOB Preferred Visa, Visa Signature and Lady's Solitaire are one row each instead of two; their channels (tap / online, contactless / overseas, dining / travel) sit under the arrow, so you can still keep just one on. Tap a card for its own settings: annual fee renewal month, KrisFlyer UOB membership year, Citi approval month, and the statement start day for Visa Signature and Citi Rewards. The renewal and start-day boxes that used to sit below the wallet are now inside those cards, and small chips show what is set.
- **Dates:** an overview of every renewal (soonest first, "next month", "in 5 mo") and statement start day. Tap one to edit it on its card. Renewal months repeat every year, so only the month matters.
- **Data:** JSON backup, Ledger CSV, Restore and Import statement as icon tiles, the "Transaction date vs posting date" guide, and the app version.

Nothing about how settings are stored changed: the same fields are saved, and no Firestore rules changed.

## 🔢 No default amount (v1.24.1)

The recommender's amount box starts empty (placeholder "Amt (S$)") instead of 100. Until you type an amount the result is still worked out on S$100 so you can see the ranking, and a small note says so. No Firestore rules changed.

## 🌿 Gentler annual fee alert (v1.25.1)

The UOB auto-deduction alert is no longer bright red. It is a soft coral card with a calendar icon and no exclamation mark, and it warms up slightly only when the renewal is within 14 days. No Firestore rules changed.

## 🏬 Kris+ browse button tucked into the Kris+ row (v1.24.2)

The full-width "Browse all Kris+ merchants" button is gone. A small storefront icon now sits beside the Kris+ switch and opens the same list (hover or long-press shows its name). The recommender has one row less. No Firestore rules changed.

## 🔎 Retailer and MCC search are separate (v1.25.0)

The recommender's search box has a two-way switch above it: **Retailer** (brand names, including every Kris+ merchant) and **MCC** (4-digit codes and category names such as "grocery"). Each mode only suggests its own kind of result, so a code never gets mixed in with brands. Tapping the switch clears the box.
- Typing a 4-digit code in Retailer mode switches to MCC for you.
- If nothing matches in the current mode but the text fits the other one, the dropdown offers a "search it as a retailer / MCC category instead" row.
- Picking a Kris+ merchant, a retailer or an alt-category chip switches to Retailer; the HeyMax voucher plan switches to MCC.
- Your last mode is remembered on this device. Older text such as a pasted code or label still works in either mode. No Firestore rules changed.

## 🔀 Release roll-up (v1.25.2)

Combines the Kris+ browse button move (v1.24.2), separate Retailer and MCC search (v1.25.0) and the gentler fee alert (v1.25.1). No new features and no Firestore rules changes.

## 📱 Cleaner recommender on phones (v1.26.0)

On touch devices the keyboard closes after you pick a retailer or MCC and the result scrolls into view, and the floating + hides while you type. The split headline is shorter ("Split across 2 cards · 326 miles", with the minimum-spend extra underneath). The month-end posting warning is a one-line tap-to-expand chip, and the long "no hand-written rules" paragraph sits behind "ℹ️ How this was chosen". No Firestore rules changed.

## 📐 Phone layout report (v1.26.1)

Open the app with `?layout` on the end of the address to get a small 📐 button at the top left. After reproducing a layout problem (for example the keyboard covering the result), tap it and paste what it copies. It records screen and visible-area size, whether the keyboard is open, where the result and the + button sit, and the last focus and resize events. Nothing is sent anywhere, and no spend data is included. Use `?layout=0` to turn it off. No Firestore rules changed.
