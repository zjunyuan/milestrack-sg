# ✈️ MilesTrack SG

**Version:** v1.9.0  
**Stack:** Vanilla JavaScript (ES Modules), HTML5, CSS3, Firebase SDK v8 (Firestore & Auth), Service Worker (PWA).

MilesTrack SG is a responsive Progressive Web Application designed for Singapore credit card rewards optimization, KrisFlyer miles accrual tracking, monthly bonus spend cap management, and multi-vault balance tallying.

---

## 🚀 Key Features

* **Real-Time All-Vaults Tally:** Automatically listens to all family and member vault documents simultaneously and displays individual balances alongside an aggregated grand total.
* **Smart MCC & Card Recommender:**
  * Analyzes merchant categories (MCC), transaction channels (In-Person / Tap vs. Online), and Kris+ stackability.
  * Smart Waterfall Split calculation: Intelligently allocates large purchases across multiple cards to maximize 4.0 / 10.0 mpd earnings within monthly caps before overflowing to base rates.
  * Single-card evaluation mode with UOB/OCBC S$5 rounding-drop notices.
  * Instant Shell 14% nett pump discount calculator.
* **Spend Cap Tracking:** Real-time progress bars for statement-month and calendar-month credit cards (DBS yuu, UOB PPV, UOB Visa Signature, Citi Rewards, OCBC Rewards, DBS WWMC, and UOB Lady's Solitaire).
* **Multi-Vault & Role Scoping:**
  * **Primary (Admin):** Full visibility into all vaults (`household`, `sister`, `ellice`, `eugene`, `test`) with live aggregated balances.
  * **Member / Test Accounts:** Scoped exclusively to their respective vault document.
* **PWA Offline Support:** Service Worker cache management with automatic localhost bypass for rapid local development.

---

## 👥 Access Control & Role Scoping

User roles are automatically resolved upon Google Sign-In based on authorized access lists:

| Role | Access Level | Firestore Scopes |
| :--- | :--- | :--- |
| **PRIMARY** | Full Family Admin | Reads all vaults (`household`, `sister`, `ellice`, `eugene`, `test`); logs transactions to `household` / `primary` |
| **SISTER** | Member Vault | Locked to `sister` vault document and transactions |
| **ELLICE** | Member Vault | Locked to `ellice` vault document and transactions |
| **EUGENE** | Member Vault | Locked to `eugene` vault document and transactions |
| **TEST** | Isolated Sandbox | Locked to `test` vault document and transactions |

*(Note: Actual user emails are managed securely inside environment configuration and access rules).*

---

## 🧮 Miles Conversion Formulas

The application computes miles across bank reward currencies using the following ratios:

| Currency | Bank | Ratio | Converted Miles Formula |
| :--- | :--- | :--- | :--- |
| **UNI$** \vert{} UOB \vert{} 1 UNI$ = 2.0 mi | `points * 2.0` |
| **Citi TYP** | Citi | 1 TYP = 0.4 mi | `points * 0.4` |
| **Citi Miles** | Citi | 1 Citi Mile = 1.0 mi | `points * 1.0` |
| **DBS Points** | DBS | 1 pt = 2.0 mi | `points * 2.0` |
| **yuu Points** | DBS | 36 pts = 10 mi | `round(points * (10 / 36) * 0.4)` |
| **OCBC$** \vert{} OCBC \vert{} 1 OCBC$ = 0.4 mi | `points * 0.4` |
| **HSBC Points** | HSBC | 1 pt = 0.4 mi | `points * 0.4` |
| **Maybank TREATS** | Maybank | 1 pt = 0.4 mi | `points * 0.4` |
| **KrisFlyer** | SIA | 1 mi = 1.0 mi | `points * 1.0` |

---

## 📁 Repository Structure

```text
├── index.html              # Main single-page application and modal containers
├── manifest.json           # PWA web app manifest
├── sw.js                   # Service worker cache strategy (bypasses localhost)
├── css/
│   └── style.css           # Modern dark-mode UI theme and responsive grid
└── js/
    ├── config.js           # Card definitions, MCC database, and tiers
    ├── state.js            # Central reactive application state
    ├── firebase.js         # Firebase Auth, Firestore multi-doc listeners, CRUD
    ├── recommender.js      # Card recommendation waterfall and Shell calculator
    └── ui.js               # Core UI rendering pipeline, modals, and controllers
