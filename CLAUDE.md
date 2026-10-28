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
- `js/retailers.js`: ~300 curated SG brand → MCC entries (`conf`, `aliases`, `alt`, `promo`), text normalisation helpers.
- `js/merchants.js`: typeahead for the MCC/retailer input.
- `js/ui.js`: DOM rendering, modals, audit sheets, cap bars. `js/app.js` is the bootstrapper, event wiring, and SW registration.
- `sw.js`: service worker. `CORE_ASSETS` and `CARD_ASSETS` list every cached file.

## Domain model (config.js)

- **Card** (`ALL_MASTER_CARDS`): one physical card can appear as several entries, one per earning channel (e.g. `uob-ppv-contactless` / `uob-ppv-online`, `uob-vs-contactless` / `uob-vs-fcy`, `uob-ls-dining` / `uob-ls-travel`). Key fields:
  - `engine`: how miles round. `uob-5` / `ocbc-5` use S$5 blocks, `dbs-5` is DBS, `citi-1` is per dollar, `yuu-10` is special.
  - `cycleType`: `calendar` | `statement` (needs `cutoffDay`) | `uncapped`. `monthlyCap: 999999` means effectively uncapped.
  - `channelMode`: `inperson` | `online` | `both`. `isContactlessOnly`, `minSpend`, `bonusMpd`, `baseMpd`, `vaultKey` (→ `DEFAULT_VAULT`).
- **MCC rules** (`MCC_DATABASE`): `{ name, notes (HTML), candidatesLocal: [{id, baseRate}], candidatesOverseas: [...] }`. Empty lists mean excluded. Adding an entry overrides the generated fallback for that code. Every `id` must exist in `ALL_MASTER_CARDS`.
- **Precedence**: an active household rule (Firestore `milestrack_mccRules`, primary-only write, optional expiry) replaces the `MCC_DATABASE` entry. Next comes `MCC_DATABASE`, then the generated fallback from `mcc.js` (base-rate uncapped cards, or a "commonly excluded" result).
- **Bank-rule cards**: `js/cardrules.js` generates candidates for UOB VS/PPV, OCBC Rewards, Citi Rewards, HSBC Revolution, DBS WWMC and Maybank Horizon air tickets from each bank's exclusion/eligibility list, overriding their hand-written `MCC_DATABASE` entries. Sources and dates are in its header.
- **Dated rates**: a card's `rateSchedule` (applied by `applyRateSchedule()` in config.js) switches `baseMpd`/`bonusMpd` on a date (DBS Vantage 1.4 from 2 Nov 2026).
- **Spend tiers**: a card's `tierRule` (KrisFlyer UOB S$1,000 SIA Group, Maybank World/Horizon S$800/S$4,000) drives the progress display in `js/tiers.js`.
- Still hard-coded in recommender logic: the OCBC 6 mpd S$1,000 cap, the yuu S$800 + 4-merchant rule, and the Maybank World FCY tier rates in the recommender.
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
3. `index.html` → `js/app.js?v=X.Y.Z`
4. `docs/firestore.rules` header comment (when the rules changed)
5. README: add a `## … (vX.Y.Z)` section for user-visible features

New JS modules or card images must also be added to `CORE_ASSETS` / `CARD_ASSETS` in `sw.js`.

Commit messages follow `vX.Y.Z: short summary`.

## Conventions

- Keep it buildless: plain ES module imports with relative `./x.js` paths, no npm dependencies.
- Shared state goes through `state` in `js/state.js`. Firestore writes update `state` optimistically and roll back on failure (see the `mccRules` save/remove in `recommender.js`).
- Escape user or Firestore-sourced strings with `escapeHtml` (from `retailers.js`) before putting them in `innerHTML`. `MCC_DATABASE.notes` is trusted HTML.
- UI copy is plain English with emoji markers (⚠️ exclusions, ❌ excluded, 🏠 household rule). Monetary values are S$.
- Card rates and bank T&Cs change often. When editing rates, update the card's `hint`, the relevant `MCC_DATABASE` notes, and the README together.
