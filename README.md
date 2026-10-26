# MilesTrack SG

**MilesTrack SG** is a client-side progressive web application (PWA) designed to track credit card bonus caps, manage Singapore bank rewards points, and optimize mile-earning strategies. It features a multi-tiered smart recommender engine, live cloud sync via Google Firebase, and offline PWA support.

---

## Features

- **Smart MCC & Card Recommender**: 
  - Dynamic waterfall routing across Singapore 4.0 mpd cards.
  - Channel-aware filtering (`In-Person / Terminal Tap` vs `Online / In-App`).
  - Contactless payment logic interlocking (Apple/Google Pay tap vs physical/in-app).
  - Promo-aware routing (e.g., OCBC Rewards 6.0 mpd promotional whitelist).
  - Dynamic overseas Foreign Currency (FCY) tier evaluation (e.g., Maybank World Mastercard S$4,000 / 3.2 mpd step-up).
- **Comprehensive Dining MCC Matrix**: Separate rules for Restaurants (5812), Fast Food (5814), Bars & Pubs (5813), Caterers (5811), Bakeries (5462), Confectionery (5441), and Food Delivery (5499).
- **Category Cap Tracker**: Consolidated view showing pooled 4.0 mpd capacity across core categories (Dining, Groceries, Shopping, Travel, Transport, and Fuel).
- **Bank Points Vault & Expiry Radar**: Conversion rates for UOB UNI$, Citi TYP, Citi Miles, DBS Points, yuu Points, OCBC$, HSBC Points, Maybank TREATS, and KrisFlyer Miles, with cliff-date tracking and UOB fee auto-deduction defense.
- **Quick-Log Presets**: 1-tap logging shortcuts for frequent daily transactions (e.g., foodpanda, Cold Storage, FairPrice App Scan & Pay, McDonald's Online).
- **Zero-Dependency Architecture**: Built with vanilla HTML5, CSS3, and modern ES modules. Requires no compilation, bundlers, or server-side runtimes.

---

## File Structure

```text
milestrack-sg/
├── index.html        # Core application markup, styling, and logic
├── manifest.json     # PWA web app manifest
├── sw.js             # Service Worker for offline caching
└── README.md         # Deployment and configuration guide
