# CLAUDE.md

MilesTrack SG: a PWA that recommends which Singapore credit card to use per merchant category (MCC), tracks bonus caps per billing cycle, and keeps household miles vaults in Firebase Firestore. See README.md for user-facing features.

## Stack and running

- Vanilla ES modules, Tailwind (CDN), Firebase Auth (Google Sign-In) + Firestore. **No build step, no bundler, no package.json, no tests.**
- Run it by serving the repo root over HTTP (ES modules and the service worker won't load from `file://`), e.g. `python -m http.server 8000`, then open `http://localhost:8000`. Sign-in needs an email listed in `js/config.js`, and the origin must be an authorized domain in the Firebase project.
- The Firebase web config in `js/config.js` is a public client key, not a secret. Real access control lives in `docs/firestore.rules`.

## Layout

- `index.html`: app shell, views, datalists, modal sheets. Loads `js/app.js`.
- `js/config.js`: `APP_VERSION`, role email lists, vault keys/labels, Firebase config, `ALL_MASTER_CARDS`, `MCC_DATABASE`, `CATEGORY_POOLS`, `DEFAULT_VAULT` (points→miles ratios), KrisFlyer tiers, yuu partner brands.
- `js/state.js`: single mutable `state` object shared by every module.
- `js/firebase.js`: auth, role resolution (email → vault key), Firestore listeners and CRUD.
- `js/recommender.js`: miles calculation per engine, single-swipe scorer, waterfall split solver, household MCC rules (`state.mccRules`).
- `js/mcc.js`: the one place that knows about every MCC. It combines `MCC_DATABASE` (hand-written rules), `MCC_NAMES` (labels only), and generated fallbacks.
- `js/mcc-names.js`: ~230 ISO 18245 codes with names and no card rules, plus `COMMONLY_EXCLUDED_MCCS`.
- `js/posting.js` / `js/posting-ui.js`: per-card transaction-date vs posting-date rules (source and date in the header), cycle-end maths, `countsTs(tx, card)` (the date a spend counts to; use it for cycle/cap membership instead of `tx.timestamp`), the month-end banner and the log-form hint. A transaction's optional `postTs` is the bank's posting date.
- `js/summary.js`: monthly summary block at the top of History (cap use per card entry, where miles came from, deltas vs last month).
- `js/history-table.js`: desktop History table, filters (category, amount, trans/post dates), sort and totals; `state.txView` holds the view.
- `js/history-chips.js`: phone filter chips (Card, Category, Amount, Dates, Sort) and their bottom sheet; desktop hides them and uses the table filters.
- `js/col-filter.js`: History column filters. Merchant (text), Card (several cards, grouped by bank via `bankOf`, yuu counts as DBS) and Category (several) live in `state.txView` (`merchant`, `cards[]`, `cats[]`). Desktop opens a popover from the funnel icon in the table header; phone uses the same checkbox lists in the chip sheet.
- `js/log-feedback.js`: the log toast (Undo / error), the log-form context (single vs split part) and the split-payment checklist state. `saveTransaction()` in `ui.js` uses it; failures roll back the vault and keep the form open.
- `js/bulk-delete.js`: `deleteTransactionsBulk` / `restoreTransactions` (vault points adjusted in one write). Used by History Select mode and the statement import clean-up (which keeps the removed entries in localStorage `milestrack_last_removed` so Undo can restore them).
- Statement import (`statements.js` / `statement-import.js`): the statement wins over entries. `matchLines` matches on the chosen card's family, `matchOtherCards` finds entries logged on the wrong card, matched entries get `stmtConfirmed`, and unconfirmed entries in the statement's period (older than 7 days before its last line) are offered for removal. Several files can be picked at once (batch mode: `B.files`, per-file state `S` swapped with `withFile`, one shared `ctx` so overlapping files do not double up and one Undo reverses the lot). A PDF holding several cards (UOB prints one section per card) is split by `splitCardSections()` in `pdf-statement.js` (`readPdfParts`), and each section becomes its own batch entry matched by card name or remembered last 4 digits (every upload, even one card, is shown as that list: there is no top card dropdown, a row the app cannot match asks "Which card is this?"); UOB's first date column is the Post date. A PDF with no text layer (HSBC draws its letters as shapes) is read by text recognition: Tesseract.js is loaded from a CDN on demand, up to three readings with different settings are combined (`readByOcr` / `combineOcr`), and the result is only accepted if previous balance + lines = the statement total (`verifyBalance`), otherwise the row shows an error and nothing can be imported. A DBS consolidated PDF ("DBS YUU VISA CARD NO.: 4119 …", one section per card, one date per line, no year: it comes from "STATEMENT PRINTED ON") is split by the same function; each section's previous balance + lines must equal its printed `TOTAL:` (`verifySection`) or that card is shown as an error and not imported. A card with no lines is left out. OCBC files carry only the posting date: `POSTING_ONLY_CARDS` in `statements.js` makes `matchLines`/`matchOtherCards` accept a 0 to 3 day lag, keep the entry's own transaction date and record the file date as `postTs`. `state.stmtCoverage` (settings doc, merged) records card-months imported and feeds the coverage grid.
- `js/fcy.js`: overseas "after FX fees" maths, pure helpers: `billedAmount` (miles are earned on spend + FX fee), `fcyEconomics` (fee, cost per mile = fee ÷ miles, net at `FCY_MILE_VALUE_CENTS` = 1.3¢), `incremental` (cost per extra mile and gain vs a baseline) and `planOverseas`. In Overseas mode `recommender.js` builds one row per card (`fcyRow`), and the plan decides the result: the best uncapped card by net (Trust vs Maybank World) is the fallback, bonus cards stay in the split only if they beat it after fees (kept in the usual rate / whitelist-before-blacklist order), the rest are listed under "Not worth using abroad". A capped bonus card is judged on its own cap portion only (`min(amount, room)`, `portion` in `planOverseas`) against the baseline on that same portion, because the rest of the amount goes to the best uncapped card; judging it on the whole amount threw out every bonus card on a large spend. `decorateFcyFees()` shows the two uncapped options side by side plus the Now / At max rate toggle. Local mode is untouched.
- `js/retailers.js`: ~300 curated SG brand → MCC entries (`conf`, `aliases`, `alt`, `promo`), text normalisation helpers.
- `js/merchants.js`: typeahead for the recommender input. `js/search-mode.js` holds the Retailer / MCC switch (`state.searchMode`); it only filters suggestions, and the recommender still resolves both kinds of text.
- `js/settings-ui.js`: the Settings sheet (Cards / Dates / Data tabs, one row per physical card with its own inputs). The input ids are read by `saveSettings()` in `ui.js`, so keep them when changing the layout.
- `js/demo.js`: `?demo` runs the app on generated sample data with no Firebase (sign-in skipped, writes held in memory, a banner with an exit link). `firebase.js` hands off to it with a guard at the top of each exported function; `vault-guard.js` stays off in demo so demo balances never replace the remembered real ones. **If you add a Firestore collection, a transaction field or a setting that a screen depends on, update `demo.js` too** (unknown writes are harmless no-ops).
- `js/layout-report.js`: `?layout` shows a 📐 button that copies a phone layout report (viewport, keyboard, element positions, recent focus events) for pasting back; `?layout=0` turns it off.
- `js/ui.js`: DOM rendering, modals, audit sheets, cap bars. `js/app.js` is the bootstrapper, event wiring, and SW registration.
- `docs/bank-tnc/`: reference PDFs of bank T&Cs (not loaded by the app) with a README listing each document's date and whether it states an FX fee. Replace a PDF when the bank updates it.
- `sw.js`: service worker. `CORE_ASSETS` and `CARD_ASSETS` list every cached file.

## Domain model (config.js)

- **Card** (`ALL_MASTER_CARDS`): one physical card can appear as several entries, one per earning channel (e.g. `uob-ppv-contactless` / `uob-ppv-online`, `uob-vs-contactless` / `uob-vs-fcy`, `uob-ls-dining` / `uob-ls-travel`). Key fields:
  - `engine`: how miles round. `uob-5` / `ocbc-5` use S$5 blocks, `dbs-5` is DBS, `citi-1` is per dollar, `yuu-10` is special.
  - `cycleType`: `calendar` | `statement` (needs `cutoffDay`) | `uncapped`. `monthlyCap: 999999` means effectively uncapped.
  - `channelMode`: `inperson` | `online` | `both`. `isContactlessOnly`, `minSpend`, `bonusMpd`, `baseMpd`, `vaultKey` (→ `DEFAULT_VAULT`).
  - `fcyFee` (% on foreign-currency spend, including the 1% Visa/Mastercard fee) and `fcyFeeSource` (where it came from, official vs secondary, and the date checked). Used by `js/fcy.js` and the Overseas ranking. Also `fcyMpd` (top-tier overseas mpd on ordinary spend, used for uncapped fallback cards and "At max rate"), optional `fcyEarnsOnFee` (overrides `FCY_EARN_ON_FEE` in config.js, default true: miles accrue on the fee too) and `FCY_MILE_VALUE_CENTS`. To react to a bank changing its fee or rate, edit these in config.js only. Re-check against the bank's own pages when a bank changes its fee.
- **MCC rules** (`MCC_DATABASE`): `{ name, notes (HTML), candidatesLocal: [{id, baseRate}], candidatesOverseas: [...] }`. Empty lists mean excluded. Adding an entry overrides the generated fallback for that code. Every `id` must exist in `ALL_MASTER_CARDS`.
- **Precedence**: an active household rule (Firestore `milestrack_mccRules`, primary-only write, optional expiry) replaces the `MCC_DATABASE` entry. Next comes `MCC_DATABASE`, then the generated fallback from `mcc.js` (base-rate uncapped cards, or a "commonly excluded" result).
- **Bank-rule cards**: `js/cardrules.js` generates candidates for UOB VS/PPV (contactless and online), OCBC Rewards, Citi Rewards, HSBC Revolution, DBS WWMC and Maybank Horizon air tickets from each bank's exclusion/eligibility list, overriding their hand-written `MCC_DATABASE` entries. Sources and dates are in its header.
- **Dated rates**: a card's `rateSchedule` (applied by `applyRateSchedule()` in config.js) switches `baseMpd`/`bonusMpd` on a date (DBS Vantage 1.4 from 2 Nov 2026).
- **Spend tiers**: a card's `tierRule` (KrisFlyer UOB S$1,000 SIA Group, Maybank World/Horizon S$800/S$4,000) drives the progress display in `js/tiers.js`.
- Still hard-coded in recommender logic: the OCBC 6 mpd S$1,000 cap, the yuu S$800 + 4-merchant rule, and the Maybank World FCY tier thresholds (S$800 / S$4,000) in the recommender.
- Every `mcc` in `retailers.js` must be a known code (`MCC_DATABASE` or `MCC_NAMES`).

## Firestore

Collections: `milestrack_vaults` (doc per vault key), `milestrack_txns` (`owner` = vault key), `milestrack_settings` (doc per vault key), `milestrack_merchants` (shared brand corrections), `milestrack_mccRules` (shared per-MCC household rules).

- Vault key `primary` is shown as "Household". Keep the ID; existing data depends on it.
- Client-side role checks are UX only. Any new collection or field needs a matching change in `docs/firestore.rules`. Rules aren't deployed from the repo: the user pastes them into the Firebase console, so call that out when rules change.
- **Role email lists exist in two places**: `js/config.js` (`*_EMAILS`) and `docs/firestore.rules`. Keep them in sync. Adding a role also touches `ALL_VAULT_KEYS`, `VAULT_LABELS`, role resolution in `firebase.js`, `state.userRole` comments, and `canAccess()` in the rules.

## Releasing a version

Bump the version together in all of these, or clients keep serving stale cached files:

1. `js/config.js` → `APP_VERSION`
2. `sw.js` → `CACHE_NAME` (`milestrack-cache-vX.Y.Z`)
3. `index.html` → `js/app.js?v=X.Y.Z` and `css/style.css?v=X.Y.Z` (the stylesheet link has no other cache-buster, so a stale copy can survive an update)
4. `docs/firestore.rules` header comment (when the rules changed)

New JS modules or card images must also be added to `CORE_ASSETS` / `CARD_ASSETS` in `sw.js`.

Commit messages follow `vX.Y.Z: short summary`.

## Conventions

- Keep it buildless: plain ES module imports with relative `./x.js` paths, no npm dependencies.
- Shared state goes through `state` in `js/state.js`. Firestore writes update `state` optimistically and roll back on failure (see the `mccRules` save/remove in `recommender.js`).
- Escape user or Firestore-sourced strings with `escapeHtml` (from `retailers.js`) before putting them in `innerHTML`. `MCC_DATABASE.notes` is trusted HTML.
- UI copy is plain English with emoji markers (⚠️ exclusions, ❌ excluded, 🏠 household rule). Monetary values are S$.
- Card rates and bank T&Cs change often. When editing rates, update the card's `hint`, the relevant `MCC_DATABASE` notes, and the README together.
