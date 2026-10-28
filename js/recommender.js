import { fmtNum, fmtAuto } from "./format.js";
import { MCC_DATABASE, ALL_MASTER_CARDS, applyRateSchedule, detectYuuMerchant } from "./config.js";
import { state } from "./state.js";
import { openModal, onCardSelectChange, checkShellMerchantTrigger, cardThumbHtml } from "./ui.js";
import {
  buildRetailerList,
  findRetailerForInput,
  searchRetailers,
  normalizeText,
  slugify,
  escapeHtml
} from "./retailers.js";
import { saveMerchantOverride, deleteMerchantOverride, saveMccRule, deleteMccRule } from "./firebase.js";
import { CITI_INSTORE_MCCS } from "./cardrules.js";
import { findKrisPlusMerchants, krisPlusMcc, KRISPLUS_META } from "./krisplus-merchants.js";
import { tierStatus, lockedWarning, minSpendGate, cycleEndLabel } from "./tiers.js";
import { slipLine, slipRisk, SLIP_ALERT_MIN } from "./posting.js";
import { setSearchMode } from "./search-mode.js";
import { getMccEntry, getBuiltinMccEntry, normalizeRule, ruleIsActive, isKnownMcc, mccName, findMccByName, mccOptionsHtml, shortCategory } from "./mcc.js";

export function calcEarnedMiles(card, amount, rate) {
  if (card.engine === 'yuu-10') return Math.round(amount * rate);
  if (card.engine === 'uob-5' || card.engine === 'ocbc-5') {
    const blocks = Math.floor(amount / 5);
    return Math.round(blocks * 5 * rate);
  }
  return Math.round(Math.floor(amount) * rate);
}

export function checkOcbc6MpdPromo(input) {
  const clean = (input || "").toLowerCase().trim();
  const promoMerchants = [
    { key: "shopee", label: "Shopee (OCBC 6 mpd Promo)" },
    { key: "lazada", label: "Lazada (OCBC 6 mpd Promo)" },
    { key: "taobao", label: "Taobao (OCBC 6 mpd Promo)" },
    { key: "tiktok shop", label: "TikTok Shop (OCBC 6 mpd Promo)" },
    { key: "tiktok", label: "TikTok Shop (OCBC 6 mpd Promo)" },
    { key: "watsons", label: "Watsons (OCBC 6 mpd Promo)" }
  ];

  const match = promoMerchants.find(m => clean.includes(m.key));
  if (!match) return null;

  return {
    code: "OCBC-6MPD",
    name: match.label,
    notes: "🎉 <b>OCBC Rewards 6.0 mpd Promo:</b> 15 OCBC$ per S$1 on Watsons, Shopee, Lazada, Taobao & TikTok Shop (1 Jul 2026 - 31 Mar 2027). Capped at S$1,000/mo, then 4.0 mpd up to S$1,110. Excludes RedMart/Shopee Supermarket (MCC 5411) and ShopeePay top-ups.",
    candidatesLocal: [
      { id: "ocbc-rewards", baseRate: 6.0 },
      { id: "citi-rewards", baseRate: 4.0 },
      { id: "dbs-wwmc", baseRate: 4.0 },
      { id: "uob-ppv-online", baseRate: 4.0 }
    ],
    candidatesOverseas: [
      { id: "ocbc-rewards", baseRate: 6.0 },
      { id: "uob-vs-fcy", baseRate: 4.0 },
      { id: "citi-rewards", baseRate: 4.0 }
    ]
  };
}

/* ==========================================================================
   RETAILER LOOKUP (brand name -> MCC)
   ========================================================================== */

// Returns the retailer for typed text, honouring a typeahead pick / alt-category chip.
function resolveRetailer(input) {
  const sel = state.selectedRetailer;
  if (sel && (normalizeText(input) === normalizeText(sel.name) || (sel.label && normalizeText(input) === normalizeText(sel.label)))) {
    const entry = buildRetailerList(state.merchantOverrides).find(r => normalizeText(r.name) === normalizeText(sel.name));
    if (entry) return { ...entry, defaultMcc: entry.mcc, mcc: sel.mcc };
  }
  const found = findRetailerForInput(input, state.merchantOverrides);
  return found ? { ...found, defaultMcc: found.mcc } : null;
}

// Called by the typeahead when the user picks a suggestion.
// yuu partner brands that only qualify for 10 mpd when paid in their own app.
const YUU_IN_APP_ONLY = /chagee/i;

export function selectRetailer(retailer) {
  applyRetailerSelection(retailer.name, retailer.mcc);
  const clearBtn = document.getElementById('btnClearMcc');
  if (clearBtn) clearBtn.style.display = 'flex';
  runRecommendation();
}

// Selects a brand with a given MCC and fills the box with the full text ("Starbucks · 5814 · Fast Food Restaurants"),
// so the person can see exactly which category is in use. The caller re-runs the recommender.
export function applyRetailerSelection(name, mcc) {
  const label = `${name} · ${mcc} · ${mccName(mcc)}`;
  state.selectedRetailer = { name, mcc, label };
  setSearchMode('retailer');
  const input = document.getElementById('mccInput');
  if (input) {
    input.value = label;
    input.dataset.committed = label;
    input.closest('.mcc-input-wrapper')?.classList.add('has-selection');
  }
  return label;
}

export function resolveMccEntry(input) {
  const clean = (input || '').trim().toLowerCase();
  if (!clean) return null;

  const promo = checkOcbc6MpdPromo(clean);
  if (promo) return promo;

  // A brand picked from the list: its box text contains the MCC, so resolve it as the brand, not as a bare code.
  const picked = state.selectedRetailer;
  if (picked && picked.label && normalizeText(clean) === normalizeText(picked.label)) {
    const retailer = resolveRetailer(clean);
    const entry = retailer && getMccEntry(retailer.mcc);
    if (entry) return { ...entry, retailer };
  }

  const codeMatch = clean.match(/\b\d{4}\b/);
  if (codeMatch) {
    const byCode = getMccEntry(codeMatch[0]);   // curated rules, or a generated base-rate / excluded entry
    if (byCode) return byCode;
  }

  const retailer = resolveRetailer(clean);
  const retailerEntry = retailer && getMccEntry(retailer.mcc);
  if (retailerEntry) return { ...retailerEntry, retailer };

  for (const [code, item] of Object.entries(MCC_DATABASE)) {
    if (item.name.toLowerCase().includes(clean) || item.notes.toLowerCase().includes(clean)) {
      return getMccEntry(code);   // applies an active household rule, like the other lookups
    }
  }

  // Typed category name ("cinema", "electronics"): resolve only when exactly one category matches.
  const byName = findMccByName(clean);
  if (byName) return getMccEntry(byName);

  // A Kris+ merchant with no curated MCC: rank the cards on the category's usual MCC and say so.
  const kp = findKrisPlusMerchants(clean)[0];
  const kpEntry = kp && getMccEntry(krisPlusMcc(kp));
  if (kpEntry) return { ...kpEntry, krisMerchant: kp.name, notes: `${kpEntry.notes}<br>ℹ️ <b>MCC assumed:</b> ${kp.name} is on the Kris+ list but not in the retailer list, so cards are ranked on MCC ${krisPlusMcc(kp)} (${kp.category}). Its real MCC may differ; add the retailer to set it exactly.` };

  if (state.isOverseasMode) {
    return {
      code: "FCY-GEN",
      name: "General Overseas Spend (Any MCC)",
      notes: "In Overseas Mode, ANY retail spend in foreign currency earns 4.0 mpd on UOB VS (S$1.2k cap), 3.2 mpd on Maybank World MC (min S$4,000 spend, uncapped), 2.8 mpd on Maybank Horizon (min S$800 spend), or 2.4 mpd on UOB PRVI.",
      candidatesOverseas: [{ id: "uob-vs-fcy", baseRate: 4.0 }]
    };
  }

  if (state.isKrisPlusMode) {
    return {
      code: "KRISPLUS-PARTNER",
      name: "Kris+ Partner Merchant (Uncategorized)",
      notes: "🛍️ <b>Kris+ In-App Payment:</b> Processed as online spend. DBS WWMC earns 4.0 mpd (online blacklist). KF UOB earns 3.0 mpd uncapped. ⚠️ Citi Rewards & UOB VS are strictly excluded from 4.0 mpd.",
      candidatesLocal: [{ id: "dbs-wwmc", baseRate: 4.0 }]
    };
  }

  return null;
}


// Rate an uncapped everyday card earns on spend with no bonus category, for the current mode.
const OVERSEAS_GENERAL_MPD = { 'mb-world-mc': 3.2, 'mb-horizon-vs': 2.8, 'uob-prvi': 2.4, 'dbs-vantage': 2.2, 'dbs-altitude': 2.2, 'citi-pm': 2.2 };
function generalRate(card) {
  if (state.isKrisPlusMode && card.id === 'kf-uob') return 3.0;
  if (state.isOverseasMode) return OVERSEAS_GENERAL_MPD[card.id] ?? card.baseMpd;
  return card.baseMpd;   // local: the card's current base rate (dated changes are applied by applyRateSchedule)
}

export function getDaysUntilCycleEnd(card) {
  const now = new Date();
  if (card.cycleType === 'calendar') {
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return Math.max(0, endOfMonth.getDate() - now.getDate());
  }
  if (card.cycleType === 'statement') {
    const cutoff = card.cutoffDay || 15;
    const today = now.getDate();
    if (today < cutoff) {
      return cutoff - today;
    } else {
      const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      return (endOfCurrentMonth - today) + cutoff;
    }
  }
  return 999;
}

// Kris+ earn note: when the typed merchant is on the Kris+ earning list, say how many extra Kris+ miles paying through the app would add.
function appendKrisPlusNote() {
  const area = document.getElementById('recResultArea'); if (!area) return;
  area.querySelector('.kp-note')?.remove();
  const input = document.getElementById('mccInput')?.value || '';
  let hits = findKrisPlusMerchants(input);
  if (!hits.length) { const r = resolveMccEntry(input); if (r && r.retailer) hits = findKrisPlusMerchants(r.retailer.name); }
  if (!hits.length || !area.innerHTML.trim()) return;
  const amt = parseFloat((document.getElementById('recAmount')?.value || '').replace(/,/g, '')) || 100;
  const m = hits[0], extra = Math.round(amt * m.mpd);
  const also = hits.length > 1 ? ` Also on Kris+: ${hits.slice(1).map(h => `${escapeHtml(h.name)} (${h.mpd} mpd)`).join(', ')}.` : '';
  const div = document.createElement('div');
  div.className = 'kp-note';
  div.innerHTML = `🛍️ <b>Kris+ merchant:</b> ${escapeHtml(m.name)} earns <b>${m.mpd} mpd</b> in Kris+ miles when you pay in the Kris+ app, about <b>+${fmtNum(extra)} mi</b> on S$${fmtAuto(amt)}, ${state.isKrisPlusMode ? 'on top of the card miles shown above.' : 'on top of your card\'s own miles.'}${also}
    ${state.isKrisPlusMode ? '' : `<div class="kp-sub">Paying in the app counts as an in-app wallet payment, so some cards' bonus does not apply (Citi and UOB bonus cards are the usual casualties). <button type="button" class="btn-backup kp-btn">Show cards in Kris+ mode</button></div>`}
    <div class="kp-sub">Rates from ${escapeHtml(KRISPLUS_META.source)}, as of ${escapeHtml(KRISPLUS_META.asOf)}. They change often, so check the Kris+ app before you rely on one.</div>`;
  area.appendChild(div);
  div.querySelector('.kp-btn')?.addEventListener('click', () => { const sw = document.getElementById('krisPlusSwitch'); if (sw) { sw.checked = true; sw.dispatchEvent(new Event('change', { bubbles: true })); } });
}

function renderRecommendation() {
  renderRecommendationCore();
  appendKrisPlusNote();
  // No amount typed yet: the result is worked out on S$100 as an example. Say so at the top, dim the amounts and hide the Log buttons,
  // so S$83.96 is not mistaken for what to charge.
  const area = document.getElementById('recResultArea');
  const typed = (document.getElementById('recAmount')?.value || '').trim();
  const isExample = !!area && !typed && !!area.querySelector('.card-tile');
  area?.classList.toggle('rec-example', isExample);
  if (isExample) {
    const note = document.createElement('div');
    note.className = 'rec-eg-note';
    note.innerHTML = '📝 <b>Example for S$100.</b> Enter your amount above to see what to charge on each card.';
    const ctx = area.querySelector('.rec-context');
    if (ctx) ctx.after(note); else area.prepend(note);
  }
}

function renderRecommendationCore() {
  const inputVal = document.getElementById('mccInput')?.value;
  const rawAmt = (document.getElementById('recAmount')?.value || '').replace(/,/g, '');
  const amt = parseFloat(rawAmt) || 100;
  const allowContactless = (state.currentChannel === 'inperson') && !state.isKrisPlusMode && document.getElementById('contactlessSwitch')?.checked;
  const resultArea = document.getElementById('recResultArea');
  if (!resultArea) return;

  const effectiveChannel = state.isKrisPlusMode ? 'online' : state.currentChannel;
  const resolvedMcc = resolveMccEntry(inputVal);
  // For a known brand, label the result "Brand · Category" but log just the brand name.
  const mccData = resolvedMcc && resolvedMcc.retailer
    ? { ...resolvedMcc, name: `${escapeHtml(resolvedMcc.retailer.name)} · ${shortCategory(resolvedMcc.name)}` }
    : (resolvedMcc && resolvedMcc.krisMerchant ? { ...resolvedMcc, name: `${escapeHtml(resolvedMcc.krisMerchant)} · ${shortCategory(resolvedMcc.name)}` } : resolvedMcc);
  const descName = resolvedMcc && resolvedMcc.retailer ? resolvedMcc.retailer.name : ((resolvedMcc && resolvedMcc.krisMerchant) || (mccData && mccData.name));

  if (!mccData) {
    resultArea.innerHTML = `
      <div style="font-size:0.8rem; color:#94a3b8; line-height:1.4;">
        ${state.isKrisPlusMode
          ? '🛍️ <b>Kris+ Mode Active:</b> Paying via in-app Apple/Google Pay. DBS WWMC earns 4.0 mpd on almost all merchants. KF UOB earns 3.0 mpd uncapped. Type merchant or MCC.'
          : (state.isOverseasMode 
            ? '✈️ <b>Overseas Mode Active:</b> Type any store, merchant or MCC to get the best FCY card recommendation.' 
            : (/^\d{4}$/.test(inputVal.trim()) ? `MCC <b>${escapeHtml(inputVal.trim())}</b> isn't in our list yet, so there are no card rules for it. Pick one of the closest codes above, or ask to have it added.` : 'Type a 4-digit MCC (e.g. <b>5541</b>, <b>5812</b>, <b>5912</b>), retailer, or promo (e.g. <b>Shopee</b>, <b>Shell</b>).'))}
      </div>
    `;
    return;
  }

  let candidateList = state.isOverseasMode ? (mccData.candidatesOverseas || []) : (mccData.candidatesLocal || []);

  // DBS yuu's 10 mpd is for yuu partner brands only, but the category rules list it for the whole MCC (supermarkets, pharmacies, transit, taxis).
  // When a specific merchant is picked and it is not a yuu partner, leave yuu out so it is not recommended at 10 mpd.
  const namedMerchant = (resolvedMcc && resolvedMcc.retailer && resolvedMcc.retailer.name) || (resolvedMcc && resolvedMcc.krisMerchant) || '';
  if (namedMerchant && candidateList.some(c => c.id === 'dbs-yuu') && !detectYuuMerchant(namedMerchant)) {
    candidateList = candidateList.filter(c => c.id !== 'dbs-yuu');
    mccData.notes = `${String(mccData.notes || '').replace(/yuu Outlets earn.*?merchants\)\.\s*/i, '')}<br>ℹ️ <b>DBS yuu not suggested:</b> ${escapeHtml(namedMerchant)} is not a yuu partner brand (Cold Storage, Giant, Guardian, 7-Eleven, foodpanda, Gojek, SimplyGo, CHAGEE, Singtel, Charge+, Anywheel). Type just the MCC to see yuu in the general category list.`;
  }
  else if (namedMerchant && !state.isOverseasMode && detectYuuMerchant(namedMerchant) && !candidateList.some(c => c.id === 'dbs-yuu')) {
    // A yuu partner whose MCC rules don't list yuu (7-Eleven codes as 5499, Singtel as 4814, CHAGEE as 5814): add it at the partner rate.
    candidateList = [{ id: 'dbs-yuu', baseRate: 10.0 }, ...candidateList];
    mccData.notes = `${String(mccData.notes || '')}<br>🟡 <b>DBS yuu partner:</b> ${escapeHtml(namedMerchant)} earns 10 mpd on DBS yuu (needs S$800 spend + 4 yuu merchants in the month).`;
  }

  // Some yuu partners only qualify when paid in their own app (CHAGEE). In person, yuu is not offered.
  if (namedMerchant && YUU_IN_APP_ONLY.test(namedMerchant) && effectiveChannel !== 'online' && candidateList.some(c => c.id === 'dbs-yuu')) {
    candidateList = candidateList.filter(c => c.id !== 'dbs-yuu');
    mccData.notes = `${String(mccData.notes || '').replace(/<br>🟡 <b>DBS yuu partner:<\/b>.*$/, '')}<br>ℹ️ <b>DBS yuu not suggested:</b> ${escapeHtml(namedMerchant)} only counts as a yuu merchant when you pay in its app. Switch to <b>Online / In-App</b> to see yuu.`;
  }

  if (state.isKrisPlusMode && !candidateList.some(c => c.id === 'dbs-wwmc')) {
    candidateList = [{ id: 'dbs-wwmc', baseRate: 4.0 }, ...candidateList];
  }

  const myOwnedCandidates = candidateList.filter(c => {
    if (!state.enabledCardIds.includes(c.id)) return false;
    const cardObj = ALL_MASTER_CARDS.find(card => card.id === c.id);
    if (!cardObj) return false;

    if (state.isKrisPlusMode) {
      if (cardObj.id === 'citi-rewards') return false;
      if (cardObj.id === 'uob-vs-contactless') return false;
      if (cardObj.id === 'uob-ppv-contactless') return false;
    }

    if (effectiveChannel === 'online' && cardObj.channelMode === 'inperson') return false;
    if (effectiveChannel === 'inperson' && cardObj.channelMode === 'online') return false;
    if (effectiveChannel === 'inperson' && !allowContactless && (cardObj.isContactlessOnly || cardObj.inPersonNeedsContactless)) return false;

    if (effectiveChannel === 'inperson' && cardObj.id === 'citi-rewards') {
      if (!CITI_INSTORE_MCCS.has(mccData.code) && mccData.code !== "OCBC-6MPD") return false;
    }

    return true;
  });

  if (myOwnedCandidates.length === 0) {
    resultArea.innerHTML = `
      <div class="mcc-tag-box" style="border-left-color:var(--danger);">
        <b>${mccData.code ? `MCC ${mccData.code} - ` : ''}${mccData.name}</b><br>
        <span style="color:var(--danger);">${state.isKrisPlusMode ? "No eligible cards available for this Kris+ transaction. Note that Citi Rewards and UOB contactless cards are excluded on Kris+." : ((effectiveChannel === 'inperson' && !allowContactless) ? "No non-contactless cards earn bonus on this category. Consider turning on contactless tap." : (mccData.generated === 'baseline' ? `No everyday-spend card (Citi PremierMiles, DBS Vantage / Altitude, UOB PRVI, KrisFlyer UOB) is enabled in your card wallet, so there is no base-rate recommendation for MCC ${mccData.code}. Turn one on under Settings.` : mccData.notes))}</span>
      </div>
    `;
    return;
  }

  // Branch 1: Single Card Swipe Mode
  if (state.isSingleSwipeMode) {
    const allEligibleCardsMap = new Map();
    myOwnedCandidates.forEach(cand => {
      const card = state.cards.find(c => c.id === cand.id);
      if (card) allEligibleCardsMap.set(card.id, { card, rate: cand.baseRate });
    });

    state.cards.filter(c => state.enabledCardIds.includes(c.id) && c.monthlyCap >= 999999).forEach(card => {
      if (!allEligibleCardsMap.has(card.id)) {
        const genRate = generalRate(card);
        allEligibleCardsMap.set(card.id, { card, rate: genRate });
      }
    });

    const singleCardScores = Array.from(allEligibleCardsMap.values()).map(({ card, rate }) => {
      const currentSpend = Number(card.currentSpend) || 0;
      const isUncapped = card.monthlyCap >= 999999;
      const availableCap = isUncapped ? amt : Math.max(0, card.monthlyCap - currentSpend);

      let effectiveBonusRate = rate;
      if (state.isKrisPlusMode && card.id === 'kf-uob') effectiveBonusRate = 3.0;

      let totalEarnedMiles = 0;
      let breakdownDesc = '';

      if (isUncapped || availableCap >= amt) {
        totalEarnedMiles = calcEarnedMiles(card, amt, effectiveBonusRate);
        breakdownDesc = `${effectiveBonusRate} mpd on full $${fmtAuto(amt)}`;
      } else {
        const bonusPart = availableCap;
        const overflowPart = amt - bonusPart;

        const bonusMiles = calcEarnedMiles(card, bonusPart, effectiveBonusRate);
        const baseMiles = calcEarnedMiles(card, overflowPart, card.baseMpd);
        totalEarnedMiles = bonusMiles + baseMiles;
        
        const blendedMpd = (totalEarnedMiles / amt).toFixed(2);
        breakdownDesc = `$${fmtNum(bonusPart, 0)} @ ${effectiveBonusRate} mpd + $${fmtNum(overflowPart, 0)} @ ${card.baseMpd} mpd (${blendedMpd} blended mpd)`;
      }

      return {
        card,
        bonusRate: effectiveBonusRate,
        totalMiles: totalEarnedMiles,
        effectiveRate: (totalEarnedMiles / amt).toFixed(2),
        breakdownDesc,
        isUncapped
      };
    }).sort((a, b) => b.totalMiles - a.totalMiles);

    const winner = singleCardScores[0];
    const runnerUp = singleCardScores[1];

    resultArea.innerHTML = `
      <div class="mcc-tag-box" style="${state.isKrisPlusMode ? 'border-left-color:var(--kris-cyan);' : (state.isOverseasMode ? 'border-left-color:var(--fcy-cyan);' : '')}">
        <b>${state.isKrisPlusMode ? '🛍️ Kris+ ' : (state.isOverseasMode ? '✈️ FCY: ' : '')}${mccData.name}</b> [💳 Single Card Swipe Mode]<br>
        Evaluating best single card for full payment of <b>$${fmtAuto(amt)}</b> without splitting.
      </div>

      ${cardTileHtml({ card: winner.card, amount: amt, miles: winner.totalMiles, rate: winner.effectiveRate, label: 'Best single card', btn: 'id="btnApplySingleSwipeRec"' })}
      <div class="rec-winner-meta">
        ${winner.breakdownDesc}
        ${winner.isUncapped ? ' • <span style="color:var(--primary);">Uncapped general spend card</span>' : ' • <span style="color:var(--warning);">Capped card with base overflow</span>'}
      </div>
      ${singleGateHtml(winner.card, amt, parseFloat(winner.effectiveRate) > winner.card.baseMpd ? winner.bonusRate : winner.card.baseMpd, getDaysUntilCycleEnd(winner.card))}

      ${runnerUp ? `
        <div style="font-size:0.75rem; color:#94a3b8; margin-top:4px;">
          🥈 Alternative: <b>${runnerUp.card.name}</b> (+${fmtNum(Math.round(runnerUp.totalMiles))} mi • ${runnerUp.effectiveRate} mpd)
        </div>
      ` : ''}

    `;

    document.getElementById('btnApplySingleSwipeRec')?.addEventListener('click', () => {
      applyRecommendation(winner.card.id, amt, `${state.isKrisPlusMode ? 'Kris+ ' : (state.isOverseasMode ? '[FCY] ' : '')}${descName}`);
    });

    return;
  }

  // Branch 2: Smart Waterfall Split Mode
  const scoredCandidates = myOwnedCandidates.map(cand => {
    const card = state.cards.find(c => c.id === cand.id);
    if (!card) return null;
    const currentSpend = Number(card.currentSpend) || 0;
    const isUncapped = card.monthlyCap >= 999999;
    
    let remainingCap = isUncapped ? 999999 : Math.max(0, card.monthlyCap - currentSpend);
    if (cand.id === 'ocbc-rewards' && cand.baseRate === 6.0) {
      remainingCap = Math.max(0, 1000 - currentSpend);
    }

    let evaluatedRate = cand.baseRate;
    if (state.isKrisPlusMode && cand.id === 'kf-uob') evaluatedRate = 3.0;

    if (cand.id === 'mb-world-mc' && state.isOverseasMode) {
      const totalProjectedSpend = currentSpend + amt;
      if (totalProjectedSpend >= 4000) evaluatedRate = 3.2;
      else if (totalProjectedSpend >= 800) evaluatedRate = 2.8;
      else evaluatedRate = 0.4;
    }

    const daysLeft = getDaysUntilCycleEnd(card);
    return { card, rate: evaluatedRate, remainingCap, isUncapped, daysLeft };
  }).filter(Boolean).sort((a, b) => {
    // A capped card with no room left only earns its base rate, so it ranks behind cards that still have bonus room.
    const aFull = !a.isUncapped && a.remainingCap <= 0, bFull = !b.isUncapped && b.remainingCap <= 0;
    if (aFull !== bFull) return aFull ? 1 : -1;
    if (b.rate !== a.rate) return b.rate - a.rate;
    if (a.card.strategyType === 'whitelist' && b.card.strategyType === 'blacklist') return -1;
    if (a.card.strategyType === 'blacklist' && b.card.strategyType === 'whitelist') return 1;
    return a.card.monthlyCap - b.card.monthlyCap;
  });

  const primary = scoredCandidates[0];
  const requiresSplit = !primary.isUncapped && primary.remainingCap < amt;

  if (requiresSplit) {
    let unallocatedAmt = amt;
    const allocationSteps = [];

    for (const candidate of scoredCandidates) {
      if (unallocatedAmt <= 0) break;
      const takeAmt = candidate.isUncapped ? unallocatedAmt : Math.min(candidate.remainingCap, unallocatedAmt);
      if (takeAmt <= 0) continue;

      let finalStepRate = candidate.rate;
      if (candidate.card.id === 'mb-world-mc' && state.isOverseasMode) {
        const cardCurrent = Number(candidate.card.currentSpend) || 0;
        const stepTotal = cardCurrent + takeAmt;
        if (stepTotal >= 4000) finalStepRate = 3.2;
        else if (stepTotal >= 800) finalStepRate = 2.8;
        else finalStepRate = 0.4;
      }

      const gate = minSpendGate(candidate.card, { cardSpend: Number(candidate.card.currentSpend) || 0, amount: takeAmt, rate: finalStepRate, overseas: state.isOverseasMode });
      const fullMiles = calcEarnedMiles(candidate.card, takeAmt, gate ? gate.unlockMpd : finalStepRate);
      const nowRate = gate && gate.locked ? candidate.card.baseMpd : (gate ? gate.unlockMpd : finalStepRate);
      const earnedMiles = calcEarnedMiles(candidate.card, takeAmt, nowRate);
      allocationSteps.push({
        card: candidate.card,
        amount: takeAmt,
        rate: gate ? gate.unlockMpd : finalStepRate,
        miles: earnedMiles,
        pendingMiles: gate && gate.locked ? Math.max(0, fullMiles - earnedMiles) : 0,
        gate,
        daysLeft: candidate.daysLeft,
        isBase: false
      });

      unallocatedAmt -= takeAmt;
    }

    if (unallocatedAmt > 0) {
      let fallback = scoredCandidates.find(c => c.isUncapped);

      if (!fallback) {
        const isGloballyExcluded = mccData.candidatesLocal && mccData.candidatesLocal.length === 0;

        if (!isGloballyExcluded) {
          const eligibleGeneralCards = state.cards
            .filter(c => state.enabledCardIds.includes(c.id) && c.monthlyCap >= 999999)
            .map(c => {
              const rate = generalRate(c);
              return { card: c, rate, isUncapped: true };
            })
            .sort((a, b) => b.rate - a.rate);

          if (eligibleGeneralCards.length > 0) fallback = eligibleGeneralCards[0];
        }
      }

      if (!fallback) fallback = scoredCandidates[scoredCandidates.length - 1];

      const fallbackRate = (state.isKrisPlusMode && fallback.card.id === 'kf-uob') 
        ? 3.0 
        : (fallback.rate || fallback.card.baseMpd);

      const earnedMiles = calcEarnedMiles(fallback.card, unallocatedAmt, fallbackRate);
      allocationSteps.push({
        card: fallback.card,
        amount: unallocatedAmt,
        rate: fallbackRate,
        miles: earnedMiles,
        isBase: true
      });
    }

    if (allocationSteps.length > 1) {
      const totalCombinedMiles = allocationSteps.reduce((sum, s) => sum + s.miles, 0);
      const totalPending = allocationSteps.reduce((sum, s) => sum + (s.pendingMiles || 0), 0);
      let stepsHtml = '';

      allocationSteps.forEach((step, idx) => {
        const nowRate = step.gate && step.gate.locked ? step.card.baseMpd : step.rate;
        stepsHtml += cardTileHtml({
          card: step.card,
          amount: step.amount,
          miles: step.miles,
          rate: nowRate,
          rateNote: step.gate && step.gate.locked ? ' now' : (step.isBase ? ' general' : ''),
          rank: idx + 1,
          btn: `data-cardid="${step.card.id}" data-amount="${step.amount}" data-desc="${state.isKrisPlusMode ? 'Kris+ ' : ''}${escapeHtml(descName)} (Part ${idx + 1})"`,
          chips: stepChipsHtml(step)
        });
      });

      resultArea.innerHTML = `
        ${contextLineHtml(mccData, effectiveChannel)}
        <div class="cascade-split-card">
          <div class="cascade-header">
            <span class="material-symbols-outlined" style="font-size:16px;">call_split</span>
            Use ${allocationSteps.length} cards · S$${fmtNum(amt, 2)} · ${fmtNum(Math.round(totalCombinedMiles))} miles
          </div>
          ${totalPending ? `<div class="cascade-sub">+${fmtNum(Math.round(totalPending))} more once the minimum spend is reached</div>` : ''}
          ${stepsHtml}
        </div>
        ${state.isKrisPlusMode ? `<div class="kris-stacked-badge">💡 <b>Kris+ Double-Dip:</b> Stacks with instant Kris+ partner miles. Transfer within 21 days!</div>` : ''}
        ${moreHtml(mccData, effectiveChannel, '')}
      `;

      resultArea.querySelectorAll('.btn-apply-rec').forEach(btn => {
        btn.addEventListener('click', () => {
          applyRecommendation(btn.dataset.cardid, parseFloat(btn.dataset.amount), btn.dataset.desc);
        });
      });
      return;
    }
  }

  const singleCard = primary;
  let effectiveMpd = singleCard.rate;
  if (!singleCard.isUncapped && singleCard.remainingCap <= 0) {
    effectiveMpd = singleCard.card.baseMpd;
  }

  const calculatedMiles = calcEarnedMiles(singleCard.card, amt, effectiveMpd);
  let roundingWarning = '';
  if (singleCard.card.engine === 'uob-5' || singleCard.card.engine === 'ocbc-5') {
    const remainder = amt % 5;
    if (remainder > 0.01) {
      const trueMpd = (calculatedMiles / amt).toFixed(2);
      roundingWarning = `S$5 rounding drop: S$${fmtNum(remainder, 2)} gets 0 pts (Real: ${trueMpd} mpd)`;
    }
  }

  const runnerUp = scoredCandidates[1];
  const isShellFuel = mccData.code === "5541" && (singleCard.card.bank === 'UOB' || singleCard.card.bank === 'Maybank');

  const shellHtml = isShellFuel ? `<div class="kris-stacked-badge" style="background:rgba(251, 191, 36, 0.12); color:var(--gold); border-color:rgba(251, 191, 36, 0.3);">⛽ <b>Shell Fuel Stacking:</b> ${singleCard.card.bank === 'UOB' ? '14% instant discount + 4.0 mpd!' : '10% Shell Go+ + 4.0 mpd.'}</div>` : '';
  const spaceLine = `${singleCard.isUncapped ? 'Uncapped' : `Space left <b>$${fmtNum(singleCard.remainingCap, 2)}</b> / $${fmtAuto(singleCard.card.monthlyCap)}`} • resets in ${singleCard.daysLeft}d`;
  resultArea.innerHTML = `
    ${contextLineHtml(mccData, effectiveChannel)}
    ${cardTileHtml({ card: singleCard.card, amount: amt, miles: calculatedMiles, rate: effectiveMpd, label: 'Use this card', btn: 'id="btnApplySingleRec"' })}
    <div class="rec-winner-meta">${spaceLine}</div>
    ${singleGateHtml(singleCard.card, amt, effectiveMpd, singleCard.daysLeft)}
    ${roundingWarning ? `<div class="uob-rounding-notice">⚠️ <b>Warning:</b> ${roundingWarning}</div>` : ''}
    ${shellHtml}
    ${moreHtml(mccData, effectiveChannel, runnerUp ? `<div class="rec-alt">🥈 Alternative: ${runnerUp.card.name} (${runnerUp.rate} mpd)</div>` : '')}
  `;

  document.getElementById('btnApplySingleRec')?.addEventListener('click', () => {
    applyRecommendation(singleCard.card.id, amt, `${state.isKrisPlusMode ? 'Kris+ ' : (state.isOverseasMode ? '[FCY] ' : '')}${descName}`);
  });
}

// ---- card tiles (v1.29.0): the card image and the amount to charge lead, miles are secondary ----------------------------------
// "UOB Visa Signature (Contactless / Petrol)" -> name "UOB Visa Signature", tag "Contactless / Petrol".
function tileNameParts(name) {
  const m = /^(.*?)\s*\((.*)\)\s*$/.exec(String(name || ''));
  return m ? { main: m[1], tag: m[2] } : { main: String(name || ''), tag: '' };
}

// One tile per card. `btn` is the attribute string for its Log button, `chips` is extra HTML shown under the tile.
function cardTileHtml({ card, amount, miles, rate, rank, label, btn, chips, rateNote }) {
  const { main, tag } = tileNameParts(card.name);
  const rateText = rate === undefined || rate === null || rate === '' ? '' : ` · ${rate} mpd${rateNote || ''}`;
  return `
    <div class="card-tile${rank ? '' : ' card-tile-solo'}">
      <div class="ct-row">
        <div class="ct-img">${cardThumbHtml(card, 'card-thumb-tile')}${rank ? `<span class="ct-rank">${rank}</span>` : ''}</div>
        <div class="ct-info">
          ${label ? `<div class="ct-label">${label}</div>` : ''}
          <div class="ct-name">${escapeHtml(main)}</div>
          ${tag ? `<div class="ct-tag">${escapeHtml(tag)}</div>` : ''}
          <div class="ct-amt-row">
            <span class="ct-amt">S$${fmtNum(amount, 2)}</span>
            <button type="button" class="btn-apply-rec ct-log" ${btn}>Log</button>
          </div>
          <div class="ct-miles">+${fmtNum(Math.round(miles))} mi${rateText}</div>
        </div>
      </div>
      ${chips || ''}
    </div>`;
}

// Chips under a split tile: month-end timing, and whether the minimum spend is unlocked.
function stepChipsHtml(step) {
  let out = postNoteHtml(step.card, step.amount);
  if (step.gate && step.gate.locked) {
    out += `<div class="ct-chip ct-chip-lock">🔒 Charge <b>S$${fmtNum(step.gate.needMore, 2)} more</b> by <b>${cycleEndLabel(step.daysLeft)}</b> (${step.daysLeft}d) to unlock ${step.gate.unlockMpd} mpd${step.pendingMiles ? ` · +${fmtNum(Math.round(step.pendingMiles))} mi` : ''}</div>`;
  } else if (step.gate) {
    out += `<div class="ct-chip ct-chip-ok">✅ S$${fmtNum(step.gate.min)} minimum met with this charge</div>`;
  }
  return out;
}

// One line saying what the result is for ("🏪 Sephora · Cosmetic Stores"). The full rules sit under "Details" at the bottom of the result.
function contextLineHtml(mccData, effectiveChannel) {
  const pre = state.isKrisPlusMode ? '🛍️ Kris+ ' : (state.isOverseasMode ? '✈️ FCY: ' : '');
  return `<div class="rec-context">${pre}<b>${mccData.name}</b> · ${effectiveChannel === 'online' ? '🌐 Online / In-App' : '🏪 In-Person'}</div>`;
}

// Rules, promos and alternatives, folded away so the answer stays on screen. Stays open when the rules contain a warning or an exclusion.
function moreHtml(mccData, effectiveChannel, extraHtml) {
  const notes = String(mccData.notes || '');
  const important = /⚠️|❌/.test(notes) && !/No hand-written rules/i.test(notes);
  const pre = state.isKrisPlusMode ? '🛍️ Kris+ ' : (state.isOverseasMode ? '✈️ FCY: ' : '');
  const border = state.isKrisPlusMode ? 'border-left-color:var(--kris-cyan);' : (state.isOverseasMode ? 'border-left-color:var(--fcy-cyan);' : '');
  return `<details class="rec-more"${important ? ' open' : ''}><summary>Details &amp; alternatives</summary>
    ${extraHtml || ''}
    <div class="mcc-tag-box" style="${border}"><b>${pre}${mccData.name}</b> [${effectiveChannel === 'online' ? '🌐 Online / In-App' : '🏪 In-Person'}]<br>${notesHtml(mccData.notes)}</div>
  </details>`;
}

// Short text for the Options row: only what differs from the defaults, so a closed row still says if something is switched.
function updateOptionsBadge() {
  const el = document.getElementById('recOptionsBadge');
  if (!el) return;
  const on = id => !!document.getElementById(id)?.checked;
  const parts = [];
  if (on('krisPlusSwitch')) parts.push('Kris+');
  if (document.getElementById('contactlessSwitch') && !on('contactlessSwitch')) parts.push('no tap');
  if (on('singleSwipeSwitch')) parts.push('one card');
  el.textContent = parts.length ? parts.join(' · ') : 'defaults';
  el.classList.toggle('is-set', parts.length > 0);
}

// Month-end warning for cards that count spend by posting date ("" when it is not near the end of the cycle).
function postNoteHtml(card, amount) {
  if (!(Number(amount) >= SLIP_ALERT_MIN)) return '';   // small spend: it would not change what you do
  const line = slipLine(card, new Date());
  if (!line) return '';
  const r = slipRisk(card, new Date());
  const label = r.level === 'likely' ? '⏳ Last day of cycle: may count to next month'
    : r.level === 'maybe' ? '⏳ Cycle ends soon: may count to next month'
    : r.level === 'grace' ? '🗓️ Maybank posting grace applies' : '🛒 Month-end timing: tap for detail';
  return `<details class="post-note"><summary>${label}</summary><div class="post-note-body">${line}</div></details>`;
}

// The long "no hand-written rules" paragraph goes behind a tap; hand-written notes (promos, exclusions) stay visible.
function notesHtml(notes, lead) {
  const t = String(notes || '');
  if (/No hand-written rules/i.test(t)) return `<details class="rec-notes"><summary>ℹ️ How this was chosen</summary><div>${t}</div></details>`;
  return (lead ? '<br>' : '') + t;
}

// One-line "spend X more to unlock" note for a single-card result.
function singleGateHtml(card, amt, rate, daysLeft) {
  const gate = minSpendGate(card, { cardSpend: Number(card.currentSpend) || 0, amount: amt, rate, overseas: state.isOverseasMode });
  const post = postNoteHtml(card, amt);
  if (!gate || !gate.locked) return post;
  const extra = Math.max(0, calcEarnedMiles(card, amt, gate.unlockMpd) - calcEarnedMiles(card, amt, card.baseMpd));
  return post + `<div class="unlock-note">⚠️ ${gate.unlockMpd} mpd needs S$${fmtNum(gate.min)} spend on this card this cycle: charge <b>S$${fmtNum(gate.needMore, 2)} more</b> by <b>${cycleEndLabel(daysLeft)}</b> (${daysLeft}d left). Until then this earns ${card.baseMpd} mpd; <b>+${fmtNum(Math.round(extra))} mi</b> is pending the unlock.</div>`;
}

// Adds a warning under the result when it names a card whose bonus tier is not unlocked yet.
function decorateTierCallouts() {
  const box = document.getElementById('recResultArea');
  if (!box) return;
  box.querySelectorAll('.tier-callout').forEach(n => n.remove());
  const text = box.textContent || '';
  const lines = [];
  for (const card of state.cards) {
    if (!card.tierRule || !text.includes(card.name)) continue;
    if (card.id === 'kf-uob' && state.isKrisPlusMode) continue;   // Kris+ is the 3 mpd rate, no SIA spend needed
    const w = lockedWarning(card, tierStatus(card, { spend: card.currentSpend || 0, txns: state.transactions, renewalYm: state.uobRenewals.kf }));
    if (w) lines.push(w);
  }
  if (lines.length) {
    const div = document.createElement('div');
    div.className = 'tier-callout';
    div.innerHTML = lines.map(l => '⚠️ ' + l.replace(/&/g, '&amp;').replace(/</g, '&lt;')).join('<br>');
    box.appendChild(div);
  }
}

export function runRecommendation() {
  updateOptionsBadge();
  applyRateSchedule();
  renderRecommendation();
  decorateTierCallouts();
  decorateRetailerTools();
  decorateRuleTools();
}

/* ==========================================================================
   RETAILER TOOLS: confidence note, alternative categories, household fixes
   ========================================================================== */

function prettyName(text) {
  return text === text.toLowerCase()
    ? text.replace(/(^|[\s-])([a-z])/g, (m, sep, ch) => sep + ch.toUpperCase())
    : text;
}

async function saveMerchantFix({ name, mcc, aliases = [] }) {
  const cleanName = (name || '').trim().slice(0, 60);
  const slug = slugify(cleanName);
  if (!cleanName || !slug) return alert('Please enter a retailer name.');
  if (!isKnownMcc(mcc)) return alert('Please choose a category.');

  const previous = state.merchantOverrides;
  const merged = [...new Set(aliases.map(a => a.trim().slice(0, 60)).filter(a => a && normalizeText(a) !== normalizeText(cleanName)))].slice(0, 10);
  // Optimistic: show the fix immediately; the Firestore listener confirms it.
  state.merchantOverrides = { ...previous, [slug]: { name: cleanName, mcc, aliases: merged } };
  applyRetailerSelection(cleanName, mcc);
  runRecommendation();

  try {
    await saveMerchantOverride(slug, { name: cleanName, mcc, aliases: merged, updatedBy: state.myVaultKey, updatedAt: Date.now() });
  } catch (e) {
    console.error('Saving merchant fix failed:', e);
    state.merchantOverrides = previous;
    runRecommendation();
    alert('Could not save this correction: ' + e.message);
  }
}

async function removeMerchantFix(slug) {
  const previous = state.merchantOverrides;
  const next = { ...previous };
  delete next[slug];
  state.merchantOverrides = next;
  const prevSel = state.selectedRetailer;
  // Back to the built-in category: re-select the brand so the box shows its default MCC.
  const base = buildRetailerList(next).find(r => r.slug === slug);
  if (base) applyRetailerSelection(base.name, base.mcc); else state.selectedRetailer = null;
  runRecommendation();
  try {
    await deleteMerchantOverride(slug);
  } catch (e) {
    console.error('Removing merchant fix failed:', e);
    state.merchantOverrides = previous;
    if (prevSel) applyRetailerSelection(prevSel.name, prevSel.mcc);
    runRecommendation();
    alert('Could not remove this correction: ' + e.message);
  }
}

function decorateRetailerTools() {
  const resultArea = document.getElementById('recResultArea');
  if (!resultArea) return;
  resultArea.querySelector('#retailerTools')?.remove();

  const input = (document.getElementById('mccInput')?.value || '').trim();
  if (!input || /^\d{4}$/.test(input)) return;

  const resolved = resolveMccEntry(input);
  const retailer = resolved && resolved.retailer;
  const isGenericFallback = resolved && (resolved.code === 'FCY-GEN' || resolved.code === 'KRISPLUS-PARTNER');
  const isPromo = resolved && resolved.code === 'OCBC-6MPD';
  if (isPromo) return;
  if (!retailer && resolved && !isGenericFallback) return;   // matched a plain category name; nothing to correct
  if (!retailer && input.length < 2) return;

  const parts = [];
  let panel = '';
  let pickList = [];

  if (retailer) {
    const catShort = escapeHtml(shortCategory(resolved.name));
    const note = retailer.note ? escapeHtml(retailer.note) : '';
    if (retailer.source === 'household') {
      parts.push(`<div class="rt-line rt-ok">✅ Confirmed by your household as MCC ${resolved.code}.</div>`);
    } else if (retailer.conf === 'low') {
      parts.push(`<div class="rt-line rt-warn">⚠️ <b>Unsure.</b> ${note ? note + ' ' : ''}Treated as ${catShort} (MCC ${resolved.code}). Check your statement after the first charge.</div>`);
    } else if (retailer.conf === 'medium') {
      parts.push(`<div class="rt-line rt-info">ℹ️ Usually MCC ${resolved.code}; can vary by outlet or app. ${note}</div>`);
    } else if (note) {
      parts.push(`<div class="rt-line rt-info">ℹ️ ${note}</div>`);
    }

    const options = [...new Set([retailer.defaultMcc, ...(retailer.alt || [])])]
      .filter(code => code !== resolved.code && isKnownMcc(code));
    if (options.length) {
      parts.push(`<div class="rt-chips"><span>Not this one?</span>${options.map(code =>
        `<button type="button" class="rt-chip" data-alt="${code}">${code} · ${escapeHtml(mccName(code))}</button>`).join('')}</div>`);
    }

    const slug = retailer.slug || slugify(retailer.name);
    const hasOverride = !!state.merchantOverrides[slug];
    parts.push(`<div class="rt-actions">
      <button type="button" class="rt-link" id="btnRtFix">✎ Wrong category?</button>
      ${hasOverride ? `<button type="button" class="rt-link rt-danger" id="btnRtReset">${retailer.builtin ? '↺ Reset to default' : '🗑 Remove retailer'}</button>` : ''}
    </div>`);
    panel = `<div class="rt-panel" id="rtPanel" hidden>
      <label>Correct category for <b>${escapeHtml(retailer.name)}</b></label>
      <select id="rtMccSelect" class="form-control">${mccOptionsHtml(resolved.code, escapeHtml)}</select>
      <button type="button" class="btn-apply-rec" id="btnRtSave">Save for everyone in household</button>
    </div>`;
  } else {
    const suggestions = searchRetailers(input, state.merchantOverrides, 3);
    parts.push(`<div class="rt-line rt-info">🔎 “${escapeHtml(input)}” isn't in the retailer list yet.</div>`);
    if (suggestions.length) {
      parts.push(`<div class="rt-chips"><span>Did you mean?</span>${suggestions.map((s, i) =>
        `<button type="button" class="rt-chip" data-pick="${i}">${escapeHtml(s.retailer.name)}</button>`).join('')}</div>`);
    }
    parts.push(`<div class="rt-actions"><button type="button" class="rt-link" id="btnRtFix">＋ Add this retailer</button></div>`);
    panel = `<div class="rt-panel" id="rtPanel" hidden>
      <label>Retailer name</label>
      <input type="text" id="rtNameInput" class="form-control" maxlength="60" value="${escapeHtml(prettyName(input))}">
      <label>Category</label>
      <select id="rtMccSelect" class="form-control">${mccOptionsHtml('5812', escapeHtml)}</select>
      <button type="button" class="btn-apply-rec" id="btnRtSave">Save for everyone in household</button>
    </div>`;
    pickList = suggestions;
  }

  const box = document.createElement('div');
  box.id = 'retailerTools';
  box.className = 'retailer-tools';
  box.innerHTML = parts.join('') + panel;
  resultArea.appendChild(box);

  box.querySelectorAll('[data-alt]').forEach(btn => btn.addEventListener('click', () => {
    applyRetailerSelection(retailer.name, btn.dataset.alt);
    runRecommendation();
  }));
  box.querySelectorAll('[data-pick]').forEach(btn => btn.addEventListener('click', () => {
    selectRetailer(pickList[Number(btn.dataset.pick)].retailer);
  }));
  box.querySelector('#btnRtFix')?.addEventListener('click', () => {
    const panelEl = box.querySelector('#rtPanel');
    panelEl.hidden = !panelEl.hidden;
    if (!panelEl.hidden) panelEl.querySelector('input, select')?.focus();
  });
  box.querySelector('#btnRtReset')?.addEventListener('click', () => removeMerchantFix(retailer.slug || slugify(retailer.name)));
  box.querySelector('#btnRtSave')?.addEventListener('click', () => {
    const mcc = box.querySelector('#rtMccSelect').value;
    if (retailer) {
      const existing = state.merchantOverrides[retailer.slug || slugify(retailer.name)];
      saveMerchantFix({ name: retailer.name, mcc, aliases: existing?.aliases || [] });
    } else {
      const name = box.querySelector('#rtNameInput').value;
      saveMerchantFix({ name, mcc, aliases: [input] });   // remember what was typed so it matches next time
    }
  });
}

/* ==========================================================================
   HOUSEHOLD CARD RULES (admin only): which cards earn a bonus on a category
   ========================================================================== */

// Draft of the open editor. Kept outside the DOM so a re-render (typing an amount, a sync) doesn't lose edits.
// { code, tab: 'local'|'overseas', local: {cardId: rate}, overseas: {cardId: rate}, note, expires }
let ruleDraft = null;

function defaultRate(card) {
  return Number(card.bonusMpd) || Number(card.baseMpd) || 1;
}

function newRuleDraft(code) {
  const rule = state.mccRules[code];
  const toMap = (list, key) => Object.fromEntries((list || []).map(c => [c.id, c[key]]));
  if (rule) {
    return { code, tab: 'local', local: toMap(rule.local, 'rate'), overseas: toMap(rule.overseas, 'rate'), note: rule.note, expires: rule.expires };
  }
  // No rule yet: start from the built-in entry so nothing is lost by accident.
  const base = getBuiltinMccEntry(code) || {};
  return { code, tab: 'local', local: toMap(base.candidatesLocal, 'baseRate'), overseas: toMap(base.candidatesOverseas, 'baseRate'), note: '', expires: '' };
}

function ruleEditorHtml() {
  const d = ruleDraft;
  const rows = ALL_MASTER_CARDS.map(card => {
    const on = Object.prototype.hasOwnProperty.call(d[d.tab], card.id);
    const rate = on ? d[d.tab][card.id] : defaultRate(card);
    return `<div class="rule-row">
      <input type="checkbox" id="rc_${card.id}" data-card="${card.id}" ${on ? 'checked' : ''}>
      <label for="rc_${card.id}" class="rule-name">${escapeHtml(card.name)}</label>
      <input type="number" class="form-control rule-rate" data-rate="${card.id}" min="0.1" max="10" step="0.1" value="${rate}" ${on ? '' : 'disabled'} aria-label="Miles per dollar for ${escapeHtml(card.name)}">
      <span class="rule-unit">mpd</span>
    </div>`;
  }).join('');
  return `
    <label>Cards that earn a bonus on <b>MCC ${d.code} · ${escapeHtml(mccName(d.code))}</b>. This <b>replaces</b> the built-in rules for the whole household.</label>
    <div class="rule-tabs">
      <button type="button" class="rule-tab ${d.tab === 'local' ? 'active' : ''}" data-tab="local">🇸🇬 Local</button>
      <button type="button" class="rule-tab ${d.tab === 'overseas' ? 'active' : ''}" data-tab="overseas">✈️ Overseas</button>
    </div>
    <div class="rule-cards">${rows}</div>
    <label for="ruleNote">Note (optional, shown on the result)</label>
    <input type="text" id="ruleNote" class="form-control" maxlength="200" placeholder="e.g. UOB T&C Oct 2026, excludes in-app" value="${escapeHtml(d.note)}">
    <label for="ruleExpires">Valid until (optional; the built-in rules return after this date)</label>
    <input type="date" id="ruleExpires" class="form-control" value="${escapeHtml(d.expires)}">
    <div class="rule-hint">Still built into the app and not editable here: Citi Rewards in-person only counts on department stores, clothing and shoes; Maybank World overseas spend tiers; the OCBC 6 mpd S$1,000 cap.</div>
    <div class="rt-actions">
      <button type="button" class="btn-apply-rec" id="btnRuleSave">Save for household</button>
      <button type="button" class="rt-link" id="btnRuleCancel">Cancel</button>
    </div>`;
}

async function saveRuleFromDraft() {
  const d = ruleDraft;
  const payloadLists = {};
  for (const tab of ['local', 'overseas']) {
    payloadLists[tab] = [];
    for (const [id, rate] of Object.entries(d[tab])) {
      const card = ALL_MASTER_CARDS.find(c => c.id === id);
      const n = Number(rate);
      if (!card || !(n > 0 && n <= 10)) {
        return alert(`Enter a rate between 0.1 and 10 for ${card ? card.name : id} (${tab === 'local' ? 'Local' : 'Overseas'}).`);
      }
      payloadLists[tab].push({ id, rate: Math.round(n * 100) / 100 });
    }
  }
  if (d.expires && d.expires < new Date().toLocaleDateString('en-CA')) {
    return alert('That "valid until" date has already passed. Pick a future date or clear it.');
  }
  if (!payloadLists.local.length && !payloadLists.overseas.length &&
      !confirm('No card is ticked, so this category will show as earning no bonus. Save it anyway?')) return;

  const code = d.code;
  const payload = { mcc: code, local: payloadLists.local, overseas: payloadLists.overseas, note: (d.note || '').trim().slice(0, 200), expires: d.expires || '', updatedBy: state.myVaultKey, updatedAt: Date.now() };
  const previous = state.mccRules;
  state.mccRules = { ...previous, [code]: normalizeRule(payload) };   // optimistic; the listener confirms
  ruleDraft = null;
  runRecommendation();
  try {
    await saveMccRule(code, payload);
  } catch (e) {
    console.error('Saving card rule failed:', e);
    state.mccRules = previous;
    runRecommendation();
    alert('Could not save this rule: ' + e.message);
  }
}

async function removeRule(code) {
  if (!confirm(`Remove the household rule for MCC ${code} and go back to the built-in rules?`)) return;
  const previous = state.mccRules;
  const next = { ...previous };
  delete next[code];
  state.mccRules = next;
  ruleDraft = null;
  runRecommendation();
  try {
    await deleteMccRule(code);
  } catch (e) {
    console.error('Removing card rule failed:', e);
    state.mccRules = previous;
    runRecommendation();
    alert('Could not remove this rule: ' + e.message);
  }
}

function decorateRuleTools() {
  const resultArea = document.getElementById('recResultArea');
  if (!resultArea) return;
  resultArea.querySelector('#ruleTools')?.remove();
  if (state.userRole !== 'PRIMARY') return;   // client-side convenience only; Firestore rules enforce it

  const input = (document.getElementById('mccInput')?.value || '').trim();
  const resolved = input ? resolveMccEntry(input) : null;
  const code = resolved && resolved.code;
  if (!code || !/^\d{4}$/.test(code)) return;   // skips the OCBC promo and the Kris+ / overseas catch-alls
  if (ruleDraft && ruleDraft.code !== code) ruleDraft = null;

  const rule = state.mccRules[code];
  const parts = [];
  if (rule && !ruleIsActive(rule)) {
    parts.push(`<div class="rt-line rt-warn">⌛ Your household rule for MCC ${code} expired, so the built-in rules apply. Edit it to renew, or remove it.</div>`);
  }
  parts.push(`<div class="rt-actions">
    <button type="button" class="rt-link" id="btnRuleEdit">${rule ? '⚙ Edit household card rules' : '＋ Set household card rules'}</button>
    ${rule ? '<button type="button" class="rt-link rt-danger" id="btnRuleReset">↺ Remove rule (use built-in)</button>' : ''}
  </div>`);

  const box = document.createElement('div');
  box.id = 'ruleTools';
  box.className = 'retailer-tools';
  box.innerHTML = parts.join('') + `<div class="rt-panel rule-editor" id="ruleEditor" ${ruleDraft ? '' : 'hidden'}>${ruleDraft ? ruleEditorHtml() : ''}</div>`;
  resultArea.appendChild(box);

  const panel = box.querySelector('#ruleEditor');
  const rerenderPanel = () => { panel.innerHTML = ruleEditorHtml(); wirePanel(); };

  function wirePanel() {
    panel.querySelectorAll('[data-tab]').forEach(btn => btn.addEventListener('click', () => {
      ruleDraft.tab = btn.dataset.tab;
      rerenderPanel();
    }));
    panel.querySelectorAll('[data-card]').forEach(cb => cb.addEventListener('change', () => {
      const id = cb.dataset.card;
      const rateEl = panel.querySelector(`[data-rate="${id}"]`);
      if (cb.checked) {
        ruleDraft[ruleDraft.tab][id] = parseFloat(rateEl.value) || defaultRate(ALL_MASTER_CARDS.find(c => c.id === id));
        rateEl.disabled = false;
        rateEl.focus();
      } else {
        delete ruleDraft[ruleDraft.tab][id];
        rateEl.disabled = true;
      }
    }));
    panel.querySelectorAll('[data-rate]').forEach(el => el.addEventListener('input', () => {
      ruleDraft[ruleDraft.tab][el.dataset.rate] = el.value === '' ? NaN : parseFloat(el.value);
    }));
    panel.querySelector('#ruleNote')?.addEventListener('input', e => { ruleDraft.note = e.target.value; });
    panel.querySelector('#ruleExpires')?.addEventListener('input', e => { ruleDraft.expires = e.target.value; });
    panel.querySelector('#btnRuleSave')?.addEventListener('click', saveRuleFromDraft);
    panel.querySelector('#btnRuleCancel')?.addEventListener('click', () => { ruleDraft = null; decorateRuleTools(); });
  }

  if (ruleDraft) wirePanel();
  box.querySelector('#btnRuleEdit')?.addEventListener('click', () => {
    if (ruleDraft) { ruleDraft = null; decorateRuleTools(); return; }
    ruleDraft = newRuleDraft(code);
    decorateRuleTools();
    document.getElementById('ruleEditor')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  box.querySelector('#btnRuleReset')?.addEventListener('click', () => removeRule(code));
}

export function applyRecommendation(cardId, amt, desc) {
  // Open (and reset) the modal FIRST: openModal() clears the fields, so filling them before it wiped them.
  openModal();

  const cardSelect = document.getElementById('cardSelect');
  const amtInput = document.getElementById('amtInput');
  const descInput = document.getElementById('descInput');
  const bonusCategory = document.getElementById('bonusCategory');
  const txDateInput = document.getElementById('txDateInput');

  if (cardSelect) cardSelect.value = cardId;
  if (amtInput) amtInput.value = amt;
  if (descInput) descInput.value = desc || '';
  if (bonusCategory) bonusCategory.value = 'bonus';
  if (txDateInput) txDateInput.value = new Date().toLocaleDateString('en-CA');

  onCardSelectChange();
  checkShellMerchantTrigger();
}

export function updateShellNettCalc() {
  const gross = parseFloat(document.getElementById('shellGrossInput')?.value) || 0;
  const btn = document.getElementById('btnApplyShellDiscount');
  const status = document.getElementById('shellDiscountStatusText');
  if (!btn || !status) return;

  if (gross > 0) {
    const nett = (gross * 0.86).toFixed(2);
    btn.innerText = `Apply 14% (Net $${nett})`;
    status.innerHTML = `Gross $${fmtNum(gross, 2)} - 14% = <b>Net $${nett}</b> charged`;
  } else {
    btn.innerText = `Apply 14% Off`;
    status.innerText = `Enter gross pump price from meter to compute nett S$ amount charged.`;
  }
}
