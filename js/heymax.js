// "Use it or lose it": unspent 4 mpd headroom, and HeyMax gift vouchers as a way to fill it before the cycle ends.
// HeyMax gift card purchases code as MCC 5311 (Department Stores), which most bonus cards whitelist.
// Source for the MCC: The Milelion, 28 May 2025. Voucher list and Max Miles rates: HeyMax explore page, 28 Oct 2026.
import { state } from "./state.js";
import { getMccEntry } from "./mcc.js";
import { calcEarnedMiles, getDaysUntilCycleEnd, runRecommendation } from "./recommender.js";
import { minSpendGate, cycleEndLabel } from "./tiers.js";
import { cardThumbHtml } from "./ui.js";
import { escapeHtml } from "./retailers.js";
import { fmtNum } from "./format.js";

export const HEYMAX_MCC = "5311";
export const HEYMAX_VERIFIED = "Milelion May 2025 (MCC); HeyMax list 28 Oct 2026";
export const URGENT_DAYS = 7;       // show the banner when a cycle has this many days or fewer left
export const MIN_HEADROOM = 100;    // ...and at least this much bonus room is unspent

// Cards reported as no longer working on HeyMax. Still listed, with a warning.
export const UNVERIFIED_CARDS = { "dbs-wwmc": "A 2026 reader comment says DBS Woman's World no longer works on HeyMax. Check before relying on it." };

// [name, Max Miles per S$1, tags]. "≤" = "up to". `store` = HeyMax marks it in-store only.
export const HEYMAX_VOUCHERS = [
  ["Pelago by Singapore Airlines", 15], ["Airalo", 10], ["Cakeinspiration", 9], ["Natureland Spa", 5.5], ["Carousel", 5.2],
  ["Earle Swensen's", 5.2], ["Swensen's", 5.2], ["PastaMania", 5.2], ["HelloRide", 4.8], ["Airalo eSIM (Asia, Europe, Japan, Korea, Taiwan, Thailand, Vietnam, HK, Indonesia, Malaysia, Philippines)", 4.25],
  ["Ryde", 4], ["DMK", 4], ["GetGo", 3.7], ["Zalora", 3.2], ["Coca Restaurants", 3.2], ["Creative Eateries", 3.2], ["Dunkin' Donuts", 3.2],
  ["Fragrance Bak Kwa", 3.2], ["LAC", 3.2], ["Oddle Eats", 3.2], ["OSIM", 3.2], ["Pizzamaru", 3.2], ["Seoul Garden", 3.2], ["Seoul Yummy", 3.2],
  ["TukTuk Cha", 3.2], ["Under Armour", 3.2], ["Sephora", 3.2, "upto"], ["iShopChangi", 3], ["Flower Chimp", 3], ["Pupsik Studio", 2.75],
  ["TADA", 2.7], ["Old Chang Kee", 2.5], ["Grab", 2.2], ["Jack's Place", 2.2], ["% Arabica", 2.2], ["iJOOZ", 2.2], ["Lao Beijing", 2.2],
  ["LingZhi Vegetarian", 2.2], ["Monster Curry", 2.2], ["Qin Restaurant & Bar", 2.2], ["SaladStop", 2.2], ["TAMAGO-EN", 2.2],
  ["The Planet Traveller", 2], ["The Wallet Shop", 2], ["Paris Baguette", 1.8], ["RentacarGift", 1.8], ["Marche Movenpick", 1.75], ["Orchid Bowl", 1.75],
  ["Amazon.sg", 1.4], ["MINISO", 1.4], ["Nong Geng Ji", 1.4], ["Robinsons", 1.4], ["TANYU", 1.4], ["Wine Connection", 1.4],
  ["Klook", 1.25, "upto"], ["FlystayGift", 1.25], ["ToursGift", 1.25], ["Pet Lovers Centre", 1.2], ["PUMA", 1.2], ["IKEA", 1],
  ["foodpanda", 0.6], ["Courts", 0.5], ["Best Denki", 0.25], ["Lazada", 0.2], ["7-Eleven", 0.2], ["TANGS", 0.2], ["Razer Gold", 0.2],
  ["Imperial Treasure", 0.2], ["Isetan", 0.2], ["NTUC FairPrice", 0.1, "store"], ["Sheng Siong", 0.1], ["PlayMade", 0],
  ["A Lil Thyme", 5, "upto"], ["SHEIN", 6, "upto"]
].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

// Pure. cards: state.cards (with currentSpend), candidates: the 5311 candidate list, now: Date.
// Returns rows for cards that still have bonus room, most urgent first.
export function headroomRows({ cards, candidates, enabledIds, now = new Date(), daysLeftFn = getDaysUntilCycleEnd }) {
  const rows = [];
  const seen = new Set();
  for (const cand of candidates || []) {
    const card = cards.find(c => c.id === cand.id);
    if (!card || seen.has(card.id) || !enabledIds.includes(card.id)) continue;
    if (card.channelMode === "inperson") continue;             // a voucher is bought online / in-app
    if (card.monthlyCap >= 999999) continue;                   // uncapped cards have no headroom to lose
    if (!(cand.baseRate >= 3) || !(cand.baseRate > card.baseMpd)) continue;
    seen.add(card.id);
    const spend = Number(card.currentSpend) || 0;
    const remaining = Math.max(0, card.monthlyCap - spend);
    if (remaining <= 0) continue;
    const daysLeft = daysLeftFn(card);
    const bonusMiles = calcEarnedMiles(card, remaining, cand.baseRate);
    const baseMiles = calcEarnedMiles(card, remaining, card.baseMpd);
    const gate = minSpendGate(card, { cardSpend: spend, amount: remaining, rate: cand.baseRate });
    // Filling the room also lifts earlier spend from base to bonus when the minimum was not yet met (bank credits it on the whole cycle).
    const lift = gate && !gate.locked && spend > 0 && spend < gate.min
      ? Math.max(0, calcEarnedMiles(card, spend, cand.baseRate) - calcEarnedMiles(card, spend, card.baseMpd)) : 0;
    rows.push({
      card, rate: cand.baseRate, spend, remaining, daysLeft, endLabel: cycleEndLabel(daysLeft, now),
      miles: bonusMiles, extraMiles: Math.max(0, bonusMiles - baseMiles) + lift, lift,
      urgent: daysLeft <= URGENT_DAYS, unverified: !!UNVERIFIED_CARDS[card.id], belowMin: !!(gate && spend < gate.min),
      warn: UNVERIFIED_CARDS[card.id] || (card.id.startsWith("uob-ls") ? "Needs Fashion chosen as your Lady's bonus category." : "")
    });
  }
  return rows.sort((a, b) => a.daysLeft - b.daysLeft || b.remaining - a.remaining);
}

export function urgentSummary(rows) {
  const u = rows.filter(r => r.urgent && !r.unverified && r.remaining >= MIN_HEADROOM);
  return { rows: u, amount: u.reduce((s, r) => s + r.remaining, 0), miles: u.reduce((s, r) => s + r.miles, 0), days: u.length ? Math.min(...u.map(r => r.daysLeft)) : null };
}

function currentRows() {
  const entry = getMccEntry(HEYMAX_MCC);
  return headroomRows({ cards: state.cards, candidates: entry && entry.candidatesLocal, enabledIds: state.enabledCardIds });
}

function voucherChips(filter = "") {
  const q = filter.trim().toLowerCase();
  const list = HEYMAX_VOUCHERS.filter(v => !q || v[0].toLowerCase().includes(q));
  if (!list.length) return `<span style="font-size:0.75rem; color:#94a3b8;">No match. The list changes; check HeyMax.</span>`;
  return list.map(([name, rate, tag]) =>
    `<span class="hm-chip">${escapeHtml(name)} <small>${tag === "upto" ? "up to " : ""}${rate} Max Miles/$${tag === "store" ? " · in-store" : ""}</small></span>`).join("");
}

export function renderHeymaxBanner() {
  const box = document.getElementById("heymaxBannerContainer");
  if (!box) return;
  const sum = urgentSummary(currentRows());
  if (!sum.rows.length) { box.innerHTML = ""; return; }
  box.innerHTML = `
    <button type="button" class="hm-banner" id="btnHeymaxBanner">
      <span class="hm-banner-icon">⏳</span>
      <span class="hm-banner-text">
        <b>S$${fmtNum(sum.amount)} of 4 mpd room expires in ${sum.days} day${sum.days === 1 ? "" : "s"}</b>
        <small>Worth up to ${fmtNum(Math.round(sum.miles))} miles across ${sum.rows.length} card${sum.rows.length === 1 ? "" : "s"}. Tap to fill it with a HeyMax voucher.</small>
      </span>
    </button>`;
  document.getElementById("btnHeymaxBanner")?.addEventListener("click", openHeymaxSheet);
}

export function openHeymaxSheet() {
  const rows = currentRows();
  const sum = urgentSummary(rows);
  const plan = sum.rows.length ? sum.rows : rows.filter(r => !r.unverified);
  const planAmt = plan.reduce((s, r) => s + r.remaining, 0);
  const body = document.getElementById("heymaxBody");
  if (!body) return;
  body.innerHTML = rows.length ? `
    <div class="hm-rows">
      ${rows.map(r => `
        <div class="hm-row ${r.urgent ? "hm-urgent" : ""}">
          ${cardThumbHtml(r.card, "card-thumb-sm")}
          <div class="hm-row-main">
            <b>${escapeHtml(r.card.name)}</b>
            <div class="hm-sub">S$${fmtNum(r.remaining, 2)} of ${r.rate} mpd room left (S$${fmtNum(r.spend, 2)} of S$${fmtNum(r.card.monthlyCap)} used)</div>
            <div class="hm-sub ${r.urgent ? "hm-warn" : ""}">${r.urgent ? "⏳ " : ""}Cycle ends ${r.endLabel} (${r.daysLeft}d left)</div>
            ${r.belowMin ? `<div class="hm-sub hm-warn">Also reaches the S$${fmtNum(minSpendGate(r.card, { amount: r.remaining, rate: r.rate }).min)} minimum${r.lift ? `, lifting your earlier S$${fmtNum(r.spend, 2)} to ${r.rate} mpd (+${fmtNum(Math.round(r.lift))} mi)` : ""}.</div>` : ""}
            ${r.warn ? `<div class="hm-sub hm-warn">⚠️ ${escapeHtml(r.warn)}${r.unverified ? " Not counted in the plan." : ""}</div>` : ""}
          </div>
          <div class="hm-miles">+${fmtNum(Math.round(r.miles))} mi</div>
        </div>`).join("")}
    </div>
    <button class="btn-submit" id="btnHeymaxPlan">Plan S$${fmtNum(planAmt, 2)} with the recommender</button>
    <div class="hm-note">The plan fills the recommender with MCC ${HEYMAX_MCC} (online) for ${sum.rows.length ? "the cards expiring within " + URGENT_DAYS + " days" : "every card above"}, so it splits across them in order (it may also use another card that still has room).</div>
    <div class="section-title" style="margin-top:6px;"><span style="font-size:0.9rem;">HeyMax vouchers (all code as MCC ${HEYMAX_MCC})</span></div>
    <input type="text" id="heymaxSearch" class="form-control" placeholder="Search brands, e.g. FairPrice, Grab" autocomplete="off">
    <div class="hm-chips" id="heymaxChips">${voucherChips()}</div>
    <div class="hm-note">⚠️ Only worth it if you'll really spend at these brands. Check each voucher's expiry, fees and any refund rules. HeyMax adds its own Max Miles on top of your card miles. MCC coding and the brand list can change. Last verified: ${HEYMAX_VERIFIED}.</div>`
    : `<p style="font-size:0.85rem; color:#94a3b8;">No bonus room left on any card that takes MCC ${HEYMAX_MCC} this cycle. Nothing to top up.</p>`;

  document.getElementById("heymaxSearch")?.addEventListener("input", e => {
    document.getElementById("heymaxChips").innerHTML = voucherChips(e.target.value);
  });
  document.getElementById("btnHeymaxPlan")?.addEventListener("click", () => {
    document.getElementById("btnChannelOnline")?.click();
    const amt = document.getElementById("recAmount");
    if (amt) amt.value = String(Math.round(planAmt * 100) / 100);
    const mcc = document.getElementById("mccInput");
    if (mcc) { mcc.value = HEYMAX_MCC; mcc.dispatchEvent(new Event("input", { bubbles: true })); }
    runRecommendation();
    closeHeymaxSheet();
    mcc?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  document.getElementById("heymaxOverlay")?.classList.add("open");
}

export function closeHeymaxSheet() {
  document.getElementById("heymaxOverlay")?.classList.remove("open");
}

export function initHeymax() {
  document.getElementById("btnOpenHeymax")?.addEventListener("click", openHeymaxSheet);
  document.getElementById("btnCloseHeymax")?.addEventListener("click", closeHeymaxSheet);
  document.getElementById("heymaxOverlay")?.addEventListener("click", e => { if (e.target.id === "heymaxOverlay") closeHeymaxSheet(); });
  window.addEventListener("cards-rendered", renderHeymaxBanner);
}
