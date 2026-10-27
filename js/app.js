import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, setDoc, deleteDoc, onSnapshot, query, where, limit } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  APP_VERSION,
  PRIMARY_EMAILS,
  SISTER_EMAILS,
  firebaseConfig,
  DEFAULT_PRESETS,
  CATEGORY_POOLS,
  KRISFLYER_4PAX_TIERS,
  DEFAULT_VAULT,
  ALL_MASTER_CARDS,
  MCC_DATABASE,
  detectYuuMerchant
} from "./config.js";

let app, auth, db, googleProvider;
let currentUser = null;
let myVaultKey = "primary";
let peerVaultKey = "sister";

let currentChannel = "inperson";
let isKrisPlusMode = false;
let isOverseasMode = false;

let enabledCardIds = ALL_MASTER_CARDS.map(c => c.id);
let cards = ALL_MASTER_CARDS;
let transactions = [];
let myVault = DEFAULT_VAULT;
let peerVault = DEFAULT_VAULT;
let citiApprovalDate = '2023-01';
let uobRenewals = { solitaire: '2023-11', visaSig: '2024-03', ppv: '2024-05', prvi: '2024-07' };

// Initialize Version Tags
const authVer = document.getElementById("authVersionTag");
const headerVer = document.getElementById("headerVersionTag");
if (authVer) authVer.innerText = APP_VERSION;
if (headerVer) headerVer.innerText = APP_VERSION;

function resolveVaultKey(email = "") {
  const clean = email.toLowerCase().trim();
  if (PRIMARY_EMAILS.includes(clean)) return "primary";
  if (SISTER_EMAILS.includes(clean)) return "sister";
  return clean.replace(/[^a-zA-Z0-9]/g, "_");
}

app = initializeApp(firebaseConfig);
auth = getAuth(app);
db = getFirestore(app);
googleProvider = new GoogleAuthProvider();

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    const resolvedKey = resolveVaultKey(user.email);
    myVaultKey = resolvedKey;
    peerVaultKey = (resolvedKey === "sister") ? "primary" : "sister";

    document.getElementById('authOverlay').style.display = 'none';
    document.getElementById('mainApp').style.display = 'flex';
    document.getElementById('fabButton').style.display = 'flex';
    document.getElementById('syncStatusIndicator').innerText = "● Cloud Connected";
    document.getElementById('signedInUserDisplay').innerText = `Signed in: ${user.email} (${myVaultKey === 'primary' ? 'Household' : 'Sister'})`;

    if (myVaultKey === "sister") {
      document.getElementById('peerCardTitle').innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">family_restroom</span> Household Vault (Brother)';
      document.getElementById('peerModalTitle').innerText = "Household Points Vault (Brother)";
      document.getElementById('warChestTitle').innerText = "My Personal Mileage War Chest";
      document.getElementById('cardBonusTitle').innerText = "My Monthly Bonus Caps";
      document.getElementById('vaultSectionTitle').innerText = "My Bank Points Vault";
    } else {
      document.getElementById('peerCardTitle').innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">family_restroom</span> Sister\'s Vault (Separate)';
      document.getElementById('peerModalTitle').innerText = "Sister's Points Vault (Separate)";
      document.getElementById('warChestTitle').innerText = "Household Mileage War Chest";
      document.getElementById('cardBonusTitle').innerText = "Household Monthly Bonus Caps";
      document.getElementById('vaultSectionTitle').innerText = "Household Bank Points Vault";
    }

    renderPresets();
    renderCards();
    renderVault();
    renderCategoryTracker();

    await checkAndMigrateSharedVault();
    subscribeToCloudData();
  } else {
    currentUser = null;
    document.getElementById('authOverlay').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('fabButton').style.display = 'none';
  }
});

async function checkAndMigrateSharedVault() {
  if (myVaultKey !== "primary") return;
  try {
    const primDocRef = doc(db, "milestrack_vaults", "primary");
    const primDocSnap = await getDoc(primDocRef);

    let myPointsSum = 0;
    if (primDocSnap.exists()) {
      const data = primDocSnap.data();
      for (const k in data) myPointsSum += (data[k]?.points || 0);
    }

    if (!primDocSnap.exists() || myPointsSum === 0) {
      const sharedDocRef = doc(db, "milestrack_shared", "vault");
      const sharedSnap = await getDoc(sharedDocRef);
      if (sharedSnap.exists()) {
        myVault = { ...DEFAULT_VAULT, ...sharedSnap.data() };
        await setDoc(primDocRef, myVault);
        renderVault();
      }
    }
  } catch (e) {
    console.warn("Migration notice:", e);
  }
}

function subscribeToCloudData() {
  onSnapshot(doc(db, "milestrack_vaults", myVaultKey), (docSnap) => {
    if (docSnap.exists()) {
      myVault = { ...DEFAULT_VAULT, ...docSnap.data() };
      renderVault();
    } else {
      setDoc(doc(db, "milestrack_vaults", myVaultKey), DEFAULT_VAULT);
    }
  }, (err) => console.error("My vault error:", err));

  onSnapshot(doc(db, "milestrack_vaults", peerVaultKey), (docSnap) => {
    if (docSnap.exists()) {
      peerVault = { ...DEFAULT_VAULT, ...docSnap.data() };
      renderSisterVaultModal();
    }
  }, (err) => console.error("Peer vault error:", err));

  onSnapshot(doc(db, "milestrack_settings", myVaultKey), (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.citiApprovalDate) citiApprovalDate = data.citiApprovalDate;
      if (data.uobRenewals) uobRenewals = { ...uobRenewals, ...data.uobRenewals };
      if (data.enabledCards && Array.isArray(data.enabledCards)) {
        enabledCardIds = data.enabledCards;
      }
      if (data.cutoffDays) {
        ALL_MASTER_CARDS.forEach(c => {
          if (c.id.startsWith('uob-vs')) c.cutoffDay = data.cutoffDays.uobVs || 18;
          if (c.id === 'citi-rewards') c.cutoffDay = data.cutoffDays.citi || 15;
        });
      }
      cards = ALL_MASTER_CARDS.filter(c => enabledCardIds.includes(c.id));
      renderCards();
      renderCategoryTracker();
      renderExpiryRadar();
      checkUobFeeDefense();
    }
  });

  const txQuery = query(
    collection(db, "milestrack_txns"), 
    where("owner", "==", myVaultKey),
    limit(200)
  );
  
  onSnapshot(txQuery, (querySnapshot) => {
    transactions = [];
    querySnapshot.forEach((d) => {
      transactions.push({ ...d.data(), firestoreId: d.id });
    });
    transactions.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    renderCards();
    renderCategoryTracker();
    renderTransactions();
  }, (err) => {
    console.error("Transactions snapshot listener error:", err);
  });
}

// Helpers
function isTxInActiveCycle(txTimestamp, card) {
  const txDate = new Date(txTimestamp);
  const now = new Date();

  if (card.cycleType === 'uncapped') return txDate.getFullYear() === now.getFullYear();
  if (card.cycleType === 'calendar') return txDate.getFullYear() === now.getFullYear() && txDate.getMonth() === now.getMonth();
  if (card.cycleType === 'statement') {
    const cutoff = card.cutoffDay || 15;
    let cycleStart, cycleEnd;
    if (now.getDate() >= cutoff) {
      cycleStart = new Date(now.getFullYear(), now.getMonth(), cutoff, 0, 0, 0);
      cycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, cutoff, 0, 0, 0);
    } else {
      cycleStart = new Date(now.getFullYear(), now.getMonth() - 1, cutoff, 0, 0, 0);
      cycleEnd = new Date(now.getFullYear(), now.getMonth(), cutoff, 0, 0, 0);
    }
    return txDate >= cycleStart && txDate < cycleEnd;
  }
  return true;
}

function getDaysUntilCycleEnd(card) {
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

function getCycleLabel(card) {
  if (card.cycleType === 'uncapped') return 'No Monthly Cap';
  if (card.cycleType === 'calendar') return 'Calendar Month (1st - End)';
  return `Statement Month (Resets on ${card.cutoffDay}th)`;
}

function getYuuMerchantProgress(card) {
  const activeTxns = transactions.filter(tx => tx.cardId === card.id && isTxInActiveCycle(tx.timestamp, card));
  const uniqueMerchants = new Set();
  
  activeTxns.forEach(tx => {
    const brand = detectYuuMerchant(tx.desc);
    if (brand) uniqueMerchants.add(brand);
  });

  return {
    count: uniqueMerchants.size,
    merchants: Array.from(uniqueMerchants),
    isEligible: uniqueMerchants.size >= 4
  };
}

function calcEarnedMiles(card, amount, rate) {
  if (card.engine === 'yuu-10') return Math.round(amount * rate);
  if (card.engine === 'uob-5' || card.engine === 'ocbc-5') {
    const blocks = Math.floor(amount / 5);
    return Math.round(blocks * 5 * rate);
  }
  return Math.round(Math.floor(amount) * rate);
}

function checkOcbc6MpdPromo(input) {
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

function resolveMccEntry(input) {
  const clean = (input || '').trim().toLowerCase();
  if (!clean) return null;

  const promo = checkOcbc6MpdPromo(clean);
  if (promo) return promo;

  const codeMatch = clean.match(/\b\d{4}\b/);
  if (codeMatch && MCC_DATABASE[codeMatch[0]]) {
    return { code: codeMatch[0], ...MCC_DATABASE[codeMatch[0]] };
  }

  for (const [code, item] of Object.entries(MCC_DATABASE)) {
    if (item.name.toLowerCase().includes(clean) || item.notes.toLowerCase().includes(clean)) {
      return { code, ...item };
    }
  }

  if (isOverseasMode) {
    return {
      code: "FCY-GEN",
      name: "General Overseas Spend (Any MCC)",
      notes: "In Overseas Mode, ANY retail spend in foreign currency earns 4.0 mpd on UOB VS (S$1.2k cap), 3.2 mpd on Maybank World MC (min S$4,000 spend, uncapped), 2.8 mpd on Maybank Horizon (min S$800 spend), or 2.4 mpd on UOB PRVI.",
      candidatesOverseas: [{ id: "uob-vs-fcy", baseRate: 4.0 }]
    };
  }

  if (isKrisPlusMode) {
    return {
      code: "KRISPLUS-PARTNER",
      name: "Kris+ Partner Merchant (Uncategorized)",
      notes: "🛍️ <b>Kris+ In-App Payment:</b> Processed as online spend. DBS WWMC earns 4.0 mpd (online blacklist). KF UOB earns 3.0 mpd uncapped. ⚠️ Citi Rewards & UOB VS are strictly excluded from 4.0 mpd.",
      candidatesLocal: [{ id: "dbs-wwmc", baseRate: 4.0 }]
    };
  }

  return null;
}

// Global Recommendation Engine
function runRecommendation() {
  const inputVal = document.getElementById('mccInput').value;
  const rawAmt = (document.getElementById('recAmount').value || '').replace(/,/g, '');
  const amt = parseFloat(rawAmt) || 100;
  const allowContactless = (currentChannel === 'inperson') && !isKrisPlusMode && document.getElementById('contactlessSwitch').checked;
  const resultArea = document.getElementById('recResultArea');

  const mccData = resolveMccEntry(inputVal);

  if (!mccData) {
    resultArea.innerHTML = `
      <div style="font-size:0.8rem; color:#94a3b8; line-height:1.4;">
        ${isKrisPlusMode
          ? '🛍️ <b>Kris+ Mode Active:</b> Paying via in-app Apple/Google Pay. DBS WWMC earns 4.0 mpd on almost all merchants. KF UOB earns 3.0 mpd uncapped. Type merchant or MCC.'
          : (isOverseasMode 
            ? '✈️ <b>Overseas Mode Active:</b> Type any store, merchant or MCC to get the best FCY card recommendation.' 
            : 'Type a 4-digit MCC (e.g. <b>5541</b>, <b>5812</b>, <b>5912</b>), retailer, or promo (e.g. <b>Shopee</b>, <b>Shell</b>).')}
      </div>
    `;
    return;
  }

  let candidateList = isOverseasMode ? (mccData.candidatesOverseas || []) : (mccData.candidatesLocal || []);
  if (isKrisPlusMode && !candidateList.some(c => c.id === 'dbs-wwmc')) {
    candidateList = [{ id: 'dbs-wwmc', baseRate: 4.0 }, ...candidateList];
  }

  const myOwnedCandidates = candidateList.filter(c => {
    if (!enabledCardIds.includes(c.id)) return false;
    const cardObj = ALL_MASTER_CARDS.find(card => card.id === c.id);
    if (!cardObj) return false;

    if (isKrisPlusMode) {
      if (cardObj.id === 'citi-rewards') return false;
      if (cardObj.id === 'uob-vs-contactless') return false;
      if (cardObj.id === 'uob-ppv-contactless') return false;
    }

    if (currentChannel === 'online' && cardObj.channelMode === 'inperson') return false;
    if (currentChannel === 'inperson' && cardObj.channelMode === 'online') return false;
    if (currentChannel === 'inperson' && !allowContactless && cardObj.isContactlessOnly) return false;

    if (currentChannel === 'inperson' && cardObj.id === 'citi-rewards') {
      const eligibleInStoreMccs = ["5311", "5651", "5621", "OCBC-6MPD"];
      if (!eligibleInStoreMccs.includes(mccData.code)) return false;
    }

    return true;
  });

  if (myOwnedCandidates.length === 0) {
    resultArea.innerHTML = `
      <div class="mcc-tag-box" style="border-left-color:var(--danger);">
        <b>${mccData.code ? `MCC ${mccData.code} - ` : ''}${mccData.name}</b><br>
        <span style="color:var(--danger);">${isKrisPlusMode ? "No eligible cards available for this Kris+ transaction." : ((currentChannel === 'inperson' && !allowContactless) ? "No non-contactless cards earn bonus on this category. Consider turning on contactless tap." : mccData.notes)}</span>
      </div>
    `;
    return;
  }

  const scoredCandidates = myOwnedCandidates.map(cand => {
    const card = cards.find(c => c.id === cand.id);
    if (!card) return null;
    const currentSpend = Number(card.currentSpend) || 0;
    const isUncapped = card.monthlyCap >= 999999;
    
    let remainingCap = isUncapped ? 999999 : Math.max(0, card.monthlyCap - currentSpend);
    if (cand.id === 'ocbc-rewards' && cand.baseRate === 6.0) {
      remainingCap = Math.max(0, 1000 - currentSpend);
    }

    let evaluatedRate = cand.baseRate;
    if (isKrisPlusMode && cand.id === 'kf-uob') evaluatedRate = 3.0;

    if (cand.id === 'mb-world-mc' && isOverseasMode) {
      const totalProjectedSpend = currentSpend + amt;
      if (totalProjectedSpend >= 4000) evaluatedRate = 3.2;
      else if (totalProjectedSpend >= 800) evaluatedRate = 2.8;
      else evaluatedRate = 0.4;
    }

    const daysLeft = getDaysUntilCycleEnd(card);
    return { card, rate: evaluatedRate, remainingCap, isUncapped, daysLeft };
  }).filter(Boolean).sort((a, b) => {
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
      if (candidate.card.id === 'mb-world-mc' && isOverseasMode) {
        const cardCurrent = Number(candidate.card.currentSpend) || 0;
        const stepTotal = cardCurrent + takeAmt;
        if (stepTotal >= 4000) finalStepRate = 3.2;
        else if (stepTotal >= 800) finalStepRate = 2.8;
        else finalStepRate = 0.4;
      }

      const earnedMiles = calcEarnedMiles(candidate.card, takeAmt, finalStepRate);
      allocationSteps.push({
        card: candidate.card,
        amount: takeAmt,
        rate: finalStepRate,
        miles: earnedMiles,
        isBase: false
      });

      unallocatedAmt -= takeAmt;
    }

    if (unallocatedAmt > 0) {
      let fallback = scoredCandidates.find(c => c.isUncapped);

      if (!fallback) {
        const isGloballyExcluded = mccData.candidatesLocal && mccData.candidatesLocal.length === 0;

        if (!isGloballyExcluded) {
          const eligibleGeneralCards = cards
            .filter(c => enabledCardIds.includes(c.id) && c.monthlyCap >= 999999)
            .map(c => {
              let rate = c.baseMpd;
              if (isKrisPlusMode && c.id === 'kf-uob') rate = 3.0;
              else if (isOverseasMode) {
                if (c.id === 'mb-world-mc') rate = 3.2;
                else if (c.id === 'mb-horizon-vs') rate = 2.8;
                else if (c.id === 'uob-prvi') rate = 2.4;
                else if (c.id === 'dbs-vantage') rate = 2.2;
                else if (c.id === 'dbs-altitude') rate = 2.2;
              }
              return { card: c, rate, isUncapped: true };
            })
            .sort((a, b) => b.rate - a.rate);

          if (eligibleGeneralCards.length > 0) {
            fallback = eligibleGeneralCards[0];
          }
        }
      }

      if (!fallback) fallback = scoredCandidates[scoredCandidates.length - 1];

      const fallbackRate = (isKrisPlusMode && fallback.card.id === 'kf-uob') ? 3.0 : (fallback.rate || fallback.card.baseMpd);
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
      let stepsHtml = '';
      let buttonsHtml = '';
      const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣'];

      allocationSteps.forEach((step, idx) => {
        const icon = numberEmojis[idx] || `${idx + 1}️⃣`;
        stepsHtml += `
          <div class="cascade-step">
            <div>
              ${icon} <b>${step.card.name}</b>: Charge <b>$${step.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
              <div style="font-size:0.72rem; color:#94a3b8;">${step.isBase ? `General Fallback (${step.rate} mpd)` : `${step.rate} mpd bonus tier`}</div>
            </div>
            <span style="color:var(--accent); font-weight:700;">+${Math.round(step.miles).toLocaleString()} mi</span>
          </div>
        `;

        buttonsHtml += `
          <button class="btn-apply-rec" style="${idx > 0 ? 'background:var(--surface-variant); color:#fff; border:1px solid var(--outline);' : ''}" data-cardid="${step.card.id}" data-amount="${step.amount}" data-desc="${isKrisPlusMode ? 'Kris+ ' : ''}${mccData.name} (Part ${idx + 1})">
            Log Part ${idx + 1} ($${step.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
          </button>
        `;
      });

      resultArea.innerHTML = `
        <div class="mcc-tag-box" style="${isKrisPlusMode ? 'border-left-color:var(--kris-cyan);' : (isOverseasMode ? 'border-left-color:var(--fcy-cyan);' : '')}">
          <b>${isKrisPlusMode ? '🛍️ Kris+ ' : (isOverseasMode ? '✈️ FCY: ' : '')}${mccData.name}</b> [${currentChannel === 'online' ? '🌐 Online / In-App' : '🏪 In-Person'}]<br>
          ${mccData.notes}
        </div>
        ${isKrisPlusMode ? `<div class="kris-stacked-badge">💡 <b>Kris+ Double-Dip:</b> Stacks with instant Kris+ partner miles. Transfer within 21 days!</div>` : ''}
        <div class="cascade-split-card">
          <div class="cascade-header">
            <span class="material-symbols-outlined" style="font-size:16px;">call_split</span>
            Smart Waterfall Split: Earn ${Math.round(totalCombinedMiles).toLocaleString()} miles across ${allocationSteps.length} cards
          </div>
          ${stepsHtml}
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          ${buttonsHtml}
        </div>
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
      roundingWarning = `S$5 rounding drop: S$${remainder.toFixed(2)} gets 0 pts (Real: ${trueMpd} mpd)`;
    }
  }

  const runnerUp = scoredCandidates[1];
  const isShellFuel = mccData.code === "5541" && (singleCard.card.bank === 'UOB' || singleCard.card.bank === 'Maybank');

  resultArea.innerHTML = `
    <div class="mcc-tag-box" style="${isKrisPlusMode ? 'border-left-color:var(--kris-cyan);' : (isOverseasMode ? 'border-left-color:var(--fcy-cyan);' : '')}">
      <b>${isKrisPlusMode ? '🛍️ Kris+ ' : (isOverseasMode ? '✈️ FCY: ' : '')}${mccData.name}</b> [${currentChannel === 'online' ? '🌐 Online / In-App' : '🏪 In-Person'}]<br>
      ${mccData.notes}
    </div>
    ${isShellFuel ? `<div class="kris-stacked-badge" style="background:rgba(251, 191, 36, 0.12); color:var(--gold); border-color:rgba(251, 191, 36, 0.3);">⛽ <b>Shell Fuel Stacking:</b> ${singleCard.card.bank === 'UOB' ? '14% instant discount + 4.0 mpd!' : '10% Shell Go+ + 4.0 mpd.'}</div>` : ''}
    <div class="rec-winner-title">
      <span>⭐ <b>${singleCard.card.name}</b></span>
      <span style="color:var(--accent); font-weight:700;">${effectiveMpd} mpd (+${Math.round(calculatedMiles).toLocaleString()} mi)</span>
    </div>
    <div class="rec-winner-meta">
      ${singleCard.isUncapped ? 'Uncapped capacity' : `Space Left: <b>$${singleCard.remainingCap.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b> / $${singleCard.card.monthlyCap}`} • Resets in ${singleCard.daysLeft}d
    </div>
    ${roundingWarning ? `<div class="uob-rounding-notice">⚠️ <b>Warning:</b> ${roundingWarning}</div>` : ''}
    ${runnerUp ? `<div style="font-size:0.75rem; color:#94a3b8; margin-top:2px;">🥈 Alternative: ${runnerUp.card.name} (${runnerUp.rate} mpd)</div>` : ''}
    <button class="btn-apply-rec" id="btnApplySingleRec">Log $${amt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} with This Card</button>
  `;

  document.getElementById('btnApplySingleRec')?.addEventListener('click', () => {
    applyRecommendation(singleCard.card.id, amt, `${isKrisPlusMode ? 'Kris+ ' : (isOverseasMode ? '[FCY] ' : '')}${mccData.name}`);
  });
}

function applyRecommendation(cardId, amt, desc) {
  document.getElementById('cardSelect').value = cardId;
  document.getElementById('amtInput').value = amt;
  document.getElementById('descInput').value = desc || '';
  document.getElementById('bonusCategory').value = 'bonus';
  document.getElementById('txDateInput').value = new Date().toLocaleDateString('en-CA');
  onCardSelectChange();
  checkShellMerchantTrigger();
  openModal();
}

// UI Renderers
function renderPresets() {
  const container = document.getElementById('presetsBar');
  if (!container) return;
  container.innerHTML = '';

  DEFAULT_PRESETS.forEach(preset => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'preset-chip';
    chip.innerHTML = `<span class="preset-icon">${preset.icon}</span><span>${preset.label}</span>`;
    chip.addEventListener('click', () => quickLogPreset(preset.id));
    container.appendChild(chip);
  });
}

function quickLogPreset(presetId) {
  const preset = DEFAULT_PRESETS.find(p => p.id === presetId);
  if (!preset) return;

  document.getElementById('editTxId').value = '';
  document.getElementById('cardSelect').value = preset.cardId;
  onCardSelectChange();

  document.getElementById('txDateInput').value = new Date().toLocaleDateString('en-CA');

  if (preset.cardId === 'dbs-yuu') {
    const yuuSelect = document.getElementById('yuuMerchantSelect');
    yuuSelect.value = preset.desc;
    onYuuMerchantChange();
  } else {
    document.getElementById('descInput').value = preset.desc;
  }

  document.getElementById('bonusCategory').value = 'bonus';
  document.getElementById('amtInput').value = '';
  document.getElementById('modalFormTitle').innerText = `Log: ${preset.label}`;
  document.getElementById('btnSaveLedger').innerText = "Save to Ledger";

  checkShellMerchantTrigger();
  openModal();
}

function renderCards() {
  const container = document.getElementById('cardsContainer');
  const select = document.getElementById('cardSelect');
  if (!container || !select) return;

  container.innerHTML = '';
  select.innerHTML = '';

  cards.forEach(card => {
    const activeTxns = transactions.filter(tx => tx.cardId === card.id && isTxInActiveCycle(tx.timestamp, card));
    const currentSpend = activeTxns.reduce((sum, tx) => sum + (Number(tx.amt) || 0), 0);
    card.currentSpend = currentSpend;

    const isUncapped = card.monthlyCap >= 999999;
    const isStatement = card.cycleType === 'statement';
    const daysLeft = getDaysUntilCycleEnd(card);

    let pct = isUncapped ? 100 : Math.min(100, (currentSpend / card.monthlyCap) * 100).toFixed(0);
    let barColor = 'var(--primary)';
    let statusNotice = '';
    let markerHtml = '';

    if (card.id.startsWith('uob-vs')) {
      const minDeficit = Math.max(0, 1000 - currentSpend);
      const minSpendPct = (1000 / card.monthlyCap) * 100;
      markerHtml = `<div class="min-spend-marker" style="left: ${minSpendPct}%;"></div>`;
      barColor = currentSpend < 1000 ? 'var(--warning)' : 'var(--accent)';
      statusNotice = currentSpend < 1000 ? `<span style="color:var(--warning); font-weight:700;">⚠️ $${minDeficit.toFixed(0)} to unlock 4 mpd (${daysLeft}d left)</span>` : `<span style="color:var(--accent); font-weight:700;">✅ S$1k Met!</span>`;
    } else if (card.id === 'dbs-yuu') {
      const yuuProgress = getYuuMerchantProgress(card);
      barColor = (currentSpend >= 800 && yuuProgress.isEligible) ? 'var(--accent)' : 'var(--warning)';
      statusNotice = `${yuuProgress.isEligible ? '✅ 4/4 Merchants' : `⚠️ ${yuuProgress.count}/4 Merchants`} • $${Math.max(0, 800 - currentSpend).toFixed(0)} min left`;
    }

    const thumbHtml = card.image
      ? `<img src="${card.image}" class="card-thumb" style="object-fit:cover; padding:0;" alt="${card.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
         <div class="card-thumb ${card.themeClass || 'thumb-uob'}" style="display:none;"><div class="thumb-chip"></div><div class="thumb-bank">${card.bank}</div></div>`
      : `<div class="card-thumb ${card.themeClass || 'thumb-uob'}"><div class="thumb-chip"></div><div class="thumb-bank">${card.bank}</div></div>`;

    const cardEl = document.createElement('div');
    cardEl.className = `credit-card ${isStatement ? 'statement-cycle' : ''}`;
    cardEl.style.cursor = 'pointer';
    cardEl.innerHTML = `
      <div class="card-header">
        <div class="card-header-left">
          ${thumbHtml}
          <div>
            <div class="card-name">${card.name}</div>
            <div class="cycle-pill ${isStatement ? 'statement-pill' : ''}">${getCycleLabel(card)}</div>
          </div>
        </div>
        <span class="card-badge ${card.badgeClass || ''}">${card.bonusMpd} mpd</span>
      </div>
      <div class="progress-bar-container">
        ${markerHtml}
        <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${pct}%; background:${barColor};"></div></div>
      </div>
      <div class="card-stats">
        <span>$${currentSpend.toFixed(2)} spent</span>
        <span>${statusNotice || (isUncapped ? 'Uncapped' : `Cap: $${card.monthlyCap} (${pct}%)`)}</span>
      </div>
    `;
    cardEl.addEventListener('click', () => openCardDetailModal(card.id));
    container.appendChild(cardEl);

    select.innerHTML += `<option value="${card.id}">${card.name}</option>`;
  });

  onCardSelectChange();
  runRecommendation();
}

function openCardDetailModal(cardId) {
  const card = cards.find(c => c.id === cardId) || ALL_MASTER_CARDS.find(c => c.id === cardId);
  if (!card) return;

  const activeTxns = transactions.filter(tx => tx.cardId === card.id && isTxInActiveCycle(tx.timestamp, card));
  const currentSpend = activeTxns.reduce((sum, tx) => sum + (Number(tx.amt) || 0), 0);
  const isUncapped = card.monthlyCap >= 999999;
  const remaining = isUncapped ? 999999 : Math.max(0, card.monthlyCap - currentSpend);
  const daysLeft = getDaysUntilCycleEnd(card);
  const pct = isUncapped ? 100 : Math.min(100, (currentSpend / card.monthlyCap) * 100);

  const thumbEl = document.getElementById('modalCardThumb');
  if (card.image) {
    thumbEl.className = 'card-thumb card-detail-thumb';
    thumbEl.style.padding = '0';
    thumbEl.innerHTML = `<img src="${card.image}" style="width:100%; height:100%; object-fit:cover; border-radius:5px;" alt="${card.name}">`;
  } else {
    thumbEl.className = `card-thumb card-detail-thumb ${card.themeClass || 'thumb-uob'}`;
    thumbEl.innerHTML = `<div class="thumb-chip"></div><div class="thumb-bank">${card.bank}</div>`;
  }

  document.getElementById('modalCardName').innerText = card.name;
  document.getElementById('modalCardCycle').innerText = `${getCycleLabel(card)} • ${card.bonusMpd} mpd tier`;
  document.getElementById('modalCardSpent').innerText = `$${currentSpend.toFixed(2)}`;
  document.getElementById('modalCardSpentSub').innerText = isUncapped ? 'Uncapped capacity' : `${pct.toFixed(0)}% of $${card.monthlyCap}`;
  document.getElementById('modalCardRemaining').innerText = isUncapped ? 'Unlimited' : `$${remaining.toFixed(2)}`;
  document.getElementById('modalCardDaysLeft').innerText = `Cycle resets in ${daysLeft} days`;

  const progressFill = document.getElementById('modalCardProgressFill');
  progressFill.style.width = `${pct}%`;
  progressFill.style.background = isUncapped ? 'var(--primary)' : (pct >= 100 ? 'var(--danger)' : 'var(--primary)');

  const txListEl = document.getElementById('modalCardTxList');
  let cycleMilesSum = 0;
  txListEl.innerHTML = '';

  if (activeTxns.length === 0) {
    txListEl.innerHTML = `<div class="detail-tx-empty">No transactions logged on this card for the current billing cycle.</div>`;
  } else {
    activeTxns.slice().reverse().forEach(tx => {
      cycleMilesSum += (Number(tx.miles) || 0);
      txListEl.innerHTML += `
        <div class="tx-item" style="padding:8px 12px; margin-bottom:0; background:rgba(0,0,0,0.25);">
          <div><div class="tx-desc" style="font-size:0.85rem;">${tx.desc}</div><div class="tx-meta" style="font-size:0.7rem;">${tx.date}</div></div>
          <div><div class="tx-miles" style="font-size:0.85rem;">+${tx.miles} mi</div><div class="tx-amt" style="font-size:0.7rem;">$${Number(tx.amt || 0).toFixed(2)}</div></div>
        </div>
      `;
    });
  }
  document.getElementById('modalCardTxTotalMiles').innerText = `+${cycleMilesSum.toLocaleString()} miles earned`;

  const btnLog = document.getElementById('btnQuickLogCard');
  btnLog.onclick = () => {
    closeCardDetailModal();
    document.getElementById('cardSelect').value = card.id;
    onCardSelectChange();
    openModal();
  };

  document.getElementById('cardDetailOverlay').classList.add('open');
}

function renderVault() {
  const container = document.getElementById('vaultContainer');
  if (!container) return;
  container.innerHTML = '';
  let myGrandTotalMiles = 0;

  for (const [key, item] of Object.entries(myVault)) {
    const equivMiles = Math.floor((item.points || 0) * (item.ratio || 1));
    myGrandTotalMiles += equivMiles;

    container.innerHTML += `
      <div class="vault-item">
        <span class="vault-label">${item.name}</span>
        <div class="vault-miles-big">${equivMiles.toLocaleString()} <span class="vault-miles-unit">miles</span></div>
        <span class="vault-raw-pts">${Number(item.points || 0).toLocaleString()} ${item.unit}</span>
      </div>
    `;
  }

  document.getElementById('myTotalVaultMiles').innerText = `${myGrandTotalMiles.toLocaleString()} mi`;
  renderExpiryRadar();
  checkUobFeeDefense();
  updateTravelGoal(myGrandTotalMiles);
}

function updateTravelGoal(personalTotalMiles) {
  let unlockedTier = null;
  let nextTier = null;

  for (let i = 0; i < KRISFLYER_4PAX_TIERS.length; i++) {
    if (personalTotalMiles >= KRISFLYER_4PAX_TIERS[i].totalMiles) {
      unlockedTier = KRISFLYER_4PAX_TIERS[i];
    } else {
      nextTier = KRISFLYER_4PAX_TIERS[i];
      break;
    }
  }

  const destEl = document.getElementById('travelGoalDest');
  const progEl = document.getElementById('travelGoalProgress');

  if (!unlockedTier) {
    const firstTier = KRISFLYER_4PAX_TIERS[0];
    destEl.innerHTML = `Starting accumulation`;
    progEl.innerHTML = `Need <b>${(firstTier.totalMiles - personalTotalMiles).toLocaleString()}</b> more miles for 4x Return to <b>${firstTier.name}</b>`;
  } else {
    destEl.innerHTML = `🎉 Unlocked: <b>${unlockedTier.name}</b>`;
    progEl.innerHTML = nextTier ? `Need <b>${(nextTier.totalMiles - personalTotalMiles).toLocaleString()}</b> more miles for <b>${nextTier.name}</b>` : `🌟 Top tier reached!`;
  }
}

function renderTransactions() {
  const list = document.getElementById('txList');
  const badge = document.getElementById('txCountBadge');
  if (!list) return;
  list.innerHTML = '';
  if (badge) badge.innerText = `${transactions.length} recorded`;

  if (transactions.length === 0) {
    list.innerHTML = `<div style="text-align:center; padding:16px; font-size:0.8rem; color:#94a3b8;">No transactions logged yet.</div>`;
    return;
  }

  transactions.slice().reverse().forEach(tx => {
    const card = ALL_MASTER_CARDS.find(c => c.id === tx.cardId) || { name: 'Card' };
    const row = document.createElement('div');
    row.className = 'tx-item';
    row.innerHTML = `
      <div style="flex:1; min-width:0; padding-right:8px;">
        <div class="tx-desc" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${tx.desc}</div>
        <div class="tx-meta">${card.name} • ${tx.date}</div>
      </div>
      <div>
        <div class="tx-miles">+${tx.miles} mi</div>
        <div class="tx-amt">$${Number(tx.amt || 0).toFixed(2)}</div>
      </div>
      <div class="tx-actions">
        <button class="btn-tx-action btn-edit" title="Edit entry"><span class="material-symbols-outlined" style="font-size:18px;">edit</span></button>
        <button class="btn-tx-action btn-delete" title="Delete entry"><span class="material-symbols-outlined" style="font-size:18px;">delete</span></button>
      </div>
    `;
    row.querySelector('.btn-edit').addEventListener('click', () => openEditModal(tx.id));
    row.querySelector('.btn-delete').addEventListener('click', () => deleteTransaction(tx.id));
    list.appendChild(row);
  });
}

function renderCategoryTracker() {
  const desktopContainer = document.getElementById('categoryCardsDesktop');
  const mobileContainer = document.getElementById('categoryCardsMobile');
  let html = '';

  CATEGORY_POOLS.forEach(cat => {
    const activeCards = cards.filter(c => cat.cardIds.includes(c.id));
    if (activeCards.length === 0) return;

    let catTotalCap = 0;
    let catTotalSpent = 0;
    const chips = [];

    activeCards.forEach(c => {
      const isUncapped = c.monthlyCap >= 999999;
      const cap = isUncapped ? 0 : c.monthlyCap;
      const spent = Number(c.currentSpend) || 0;
      if (!isUncapped) catTotalCap += cap;
      catTotalSpent += spent;
      chips.push(`<span class="category-chip">${c.bank} ${c.name.split(' ')[1] || ''}: <b>$${spent.toFixed(0)}</b>/${isUncapped ? '∞' : '$' + cap}</span>`);
    });

    const catRemaining = Math.max(0, catTotalCap - catTotalSpent);
    const pct = catTotalCap > 0 ? Math.min(100, (catTotalSpent / catTotalCap) * 100).toFixed(0) : 0;
    const barColor = pct >= 90 ? "var(--danger)" : (pct >= 70 ? "var(--warning)" : "var(--primary)");

    html += `
      <div class="category-card">
        <div class="category-header">
          <div class="category-title"><span>${cat.icon}</span><span>${cat.name}</span></div>
          <span style="font-size:0.8rem; font-weight:700; color:${pct >= 90 ? 'var(--danger)' : 'var(--accent)'};">$${catRemaining.toFixed(0)} left</span>
        </div>
        <div class="progress-bar-bg" style="height:7px;"><div class="progress-bar-fill" style="width:${pct}%; background:${barColor};"></div></div>
        <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:#94a3b8;">
          <span>$${catTotalSpent.toFixed(2)} spent of $${catTotalCap.toLocaleString()}</span>
          <span>${pct}% pooled cap used</span>
        </div>
        <div class="category-chip-container">${chips.join('')}</div>
      </div>
    `;
  });

  if (desktopContainer) desktopContainer.innerHTML = html;
  if (mobileContainer) mobileContainer.innerHTML = html;
}

function renderSisterVaultModal() {
  const container = document.getElementById('sisterVaultContainer');
  let peerGrandTotal = 0;
  if (container) container.innerHTML = '';

  for (const [key, item] of Object.entries(peerVault)) {
    const equivMiles = Math.floor((item.points || 0) * (item.ratio || 1));
    peerGrandTotal += equivMiles;
    if (container) {
      container.innerHTML += `
        <div class="vault-item" style="border-color: rgba(192, 132, 252, 0.2);">
          <span class="vault-label" style="color:var(--purple);">${item.name}</span>
          <div class="vault-miles-big">${equivMiles.toLocaleString()} <span class="vault-miles-unit" style="color:var(--purple);">miles</span></div>
          <span class="vault-raw-pts">${Number(item.points || 0).toLocaleString()} ${item.unit}</span>
        </div>
      `;
    }
  }
  const disp = document.getElementById('sisterMilesDisplay');
  if (disp) disp.innerText = `${peerGrandTotal.toLocaleString()} miles`;
}

function checkUobFeeDefense() {
  const container = document.getElementById('uobFeeAlertContainer');
  if (!container) return;
  container.innerHTML = '';
  const now = new Date();
  const currentYear = now.getFullYear();

  const uobTargets = [
    { name: "UOB Lady's Solitaire", key: 'solitaire', pts: 10000, fee: '$414.20', miles: '20,000' },
    { name: "UOB Visa Signature", key: 'visaSig', pts: 6500, fee: '$218.00', miles: '13,000' },
    { name: "UOB Preferred Visa", key: 'ppv', pts: 6500, fee: '$196.20', miles: '13,000' },
    { name: "UOB PRVI Miles", key: 'prvi', pts: 6500, fee: '$261.60', miles: '13,000' }
  ];

  uobTargets.forEach(card => {
    const dateVal = uobRenewals[card.key];
    if (!dateVal) return;
    const renewalMonth = parseInt(dateVal.split('-')[1], 10) - 1;
    let nextRenewal = new Date(currentYear, renewalMonth, 1);
    if (nextRenewal < now) nextRenewal = new Date(currentYear + 1, renewalMonth, 1);
    const diffDays = Math.ceil((nextRenewal - now) / (1000 * 60 * 60 * 24));

    if (diffDays <= 45 && diffDays >= 0) {
      container.innerHTML += `
        <div class="fee-alert-card">
          <div class="fee-alert-title"><span class="material-symbols-outlined" style="font-size:20px;">warning</span> UOB Auto-Deduction Alert: ${card.name}</div>
          <div class="fee-alert-desc">Renewal in <b>${diffDays} days</b>. UOB will automatically deduct <b>${card.pts.toLocaleString()} UNI$ (${card.miles} miles)</b> for ${card.fee} fee!</div>
        </div>
      `;
    }
  });
}

function renderExpiryRadar() {
  const container = document.getElementById('radarContainer');
  if (!container) return;
  container.innerHTML = '';
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const expiries = [
    { key: 'dbs_pts', name: 'DBS Points', expiry: new Date(currentYear + 1, Math.floor(currentMonth / 3) * 3 + 3, 0), pts: myVault.dbs_pts?.points || 0 },
    { key: 'uob_uni', name: 'UOB UNI$', expiry: new Date(currentYear + 2, Math.floor(currentMonth / 3) * 3 + 3, 0), pts: myVault.uob_uni?.points || 0 },
    { key: 'yuu_pts', name: 'yuu Points', expiry: new Date(currentYear + 2, currentMonth + 1, 0), pts: myVault.yuu_pts?.points || 0 }
  ];

  expiries.forEach(item => {
    const diffDays = Math.max(0, Math.ceil((item.expiry - now) / (1000 * 60 * 60 * 24)));
    container.innerHTML += `
      <div class="radar-item">
        <div><div style="font-size:0.85rem; font-weight:600;">${item.name}</div><div style="font-size:0.75rem; color:#94a3b8;">${Number(item.pts).toLocaleString()} pts</div></div>
        <span class="radar-badge ${diffDays <= 90 ? 'badge-crit' : 'badge-safe'}">${diffDays}d left</span>
      </div>
    `;
  });
}

// Shell Helper
function checkShellMerchantTrigger() {
  const descVal = (document.getElementById('descInput').value || '').toLowerCase();
  const cardId = document.getElementById('cardSelect').value;
  const isShell = descVal.includes('shell') || descVal.includes('petrol') || descVal.includes('fuel');
  const isUobFuelCard = cardId === 'uob-ppv-contactless' || cardId === 'uob-vs-contactless' || cardId === 'mb-world-mc';
  const calcArea = document.getElementById('shellDiscountCalcArea');
  if (calcArea) calcArea.style.display = (isShell || (descVal && isUobFuelCard)) ? 'block' : 'none';
}

function updateShellNettCalc() {
  const gross = parseFloat(document.getElementById('shellGrossInput').value) || 0;
  const btn = document.getElementById('btnApplyShellDiscount');
  const status = document.getElementById('shellDiscountStatusText');
  if (gross > 0) {
    const nett = (gross * 0.86).toFixed(2);
    btn.innerText = `Apply 14% (Net $${nett})`;
    status.innerHTML = `Gross $${gross.toFixed(2)} - 14% = <b>Net $${nett}</b> charged`;
  } else {
    btn.innerText = `Apply 14% Off`;
    status.innerText = `Enter gross pump price from meter to compute nett S$ amount charged.`;
  }
}

function onCardSelectChange() {
  const cardId = document.getElementById('cardSelect').value;
  const normalGroup = document.getElementById('merchantInputGroup');
  const yuuGroup = document.getElementById('yuuMerchantGroup');

  if (cardId === 'dbs-yuu') {
    normalGroup.style.display = 'none';
    yuuGroup.style.display = 'flex';
  } else {
    normalGroup.style.display = 'flex';
    yuuGroup.style.display = 'none';
  }
  checkShellMerchantTrigger();
}

function onYuuMerchantChange() {
  const selected = document.getElementById('yuuMerchantSelect').value;
  document.getElementById('bonusCategory').value = (selected === 'Other / Non-Partner') ? 'base' : 'bonus';
}

// Modals open / close
function openModal() {
  document.getElementById('editTxId').value = '';
  document.getElementById('descInput').value = '';
  document.getElementById('amtInput').value = '';
  document.getElementById('txDateInput').value = new Date().toLocaleDateString('en-CA');
  document.getElementById('modalFormTitle').innerText = "Log Transaction";
  document.getElementById('btnSaveLedger').innerText = "Save to Ledger";
  onCardSelectChange();
  document.getElementById('modalOverlay').classList.add('open');
}

function closeModal() { document.getElementById('modalOverlay').classList.remove('open'); }
function closeCardDetailModal() { document.getElementById('cardDetailOverlay').classList.remove('open'); }
function openSisterVaultModal() { renderSisterVaultModal(); document.getElementById('sisterVaultOverlay').classList.add('open'); }
function closeSisterVaultModal() { document.getElementById('sisterVaultOverlay').classList.remove('open'); }

function openEditModal(txId) {
  const tx = transactions.find(t => t.id === txId);
  if (!tx) return;

  document.getElementById('editTxId').value = tx.id;
  document.getElementById('cardSelect').value = tx.cardId;
  onCardSelectChange();

  if (tx.timestamp) {
    document.getElementById('txDateInput').value = new Date(tx.timestamp).toLocaleDateString('en-CA');
  }

  if (tx.cardId === 'dbs-yuu') {
    document.getElementById('yuuMerchantSelect').value = tx.desc;
  } else {
    document.getElementById('descInput').value = tx.desc;
  }

  document.getElementById('amtInput').value = tx.amt;
  document.getElementById('bonusCategory').value = tx.bonusCategory || 'bonus';
  document.getElementById('modalFormTitle').innerText = "Edit Transaction";
  document.getElementById('btnSaveLedger').innerText = "Update Transaction";

  checkShellMerchantTrigger();
  document.getElementById('modalOverlay').classList.add('open');
}

async function deleteTransaction(txId) {
  const tx = transactions.find(t => t.id === txId);
  if (!tx || !confirm(`Delete "${tx.desc}" ($${Number(tx.amt || 0).toFixed(2)})?`)) return;

  const card = ALL_MASTER_CARDS.find(c => c.id === tx.cardId);
  if (card && myVault[card.vaultKey]) {
    const rawPts = Number(tx.earnedRawPoints) || Math.round((Number(tx.miles) || 0) / (myVault[card.vaultKey]?.ratio || 1));
    myVault[card.vaultKey].points = Math.max(0, (Number(myVault[card.vaultKey].points) || 0) - rawPts);
    await setDoc(doc(db, "milestrack_vaults", myVaultKey), myVault);
  }

  await deleteDoc(doc(db, "milestrack_txns", tx.firestoreId || tx.id));
}

async function saveTransaction() {
  const editId = document.getElementById('editTxId').value;
  const cardId = document.getElementById('cardSelect').value;
  const amt = parseFloat(document.getElementById('amtInput').value);
  const isBonus = document.getElementById('bonusCategory').value === 'bonus';
  const rawDateVal = document.getElementById('txDateInput').value;

  const desc = (cardId === 'dbs-yuu') ? document.getElementById('yuuMerchantSelect').value : (document.getElementById('descInput').value.trim() || 'General Expense');
  if (isNaN(amt) || amt <= 0) return alert('Enter valid amount');

  const card = ALL_MASTER_CARDS.find(c => c.id === cardId);
  let txTimestamp = Date.now();
  let displayDateStr = new Date().toLocaleDateString('en-SG', { month: 'short', day: 'numeric' });

  if (rawDateVal) {
    const parts = rawDateVal.split('-').map(Number);
    const chosen = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
    txTimestamp = chosen.getTime();
    displayDateStr = chosen.toLocaleDateString('en-SG', { month: 'short', day: 'numeric' });
  }

  if (editId) {
    const oldTx = transactions.find(t => t.id === editId);
    if (oldTx) {
      const oldCard = ALL_MASTER_CARDS.find(c => c.id === oldTx.cardId);
      if (oldCard && myVault[oldCard.vaultKey]) {
        const oldPts = Number(oldTx.earnedRawPoints) || 0;
        myVault[oldCard.vaultKey].points = Math.max(0, (Number(myVault[oldCard.vaultKey].points) || 0) - oldPts);
      }
    }
  }

  const isEligible = isBonus && ((Number(card.currentSpend) || 0) < card.monthlyCap);
  let earnedMiles = calcEarnedMiles(card, amt, isEligible ? card.bonusMpd : card.baseMpd);
  let earnedRawPoints = Math.round(earnedMiles / (myVault[card.vaultKey]?.ratio || 1));

  if (myVault[card.vaultKey]) {
    myVault[card.vaultKey].points = (Number(myVault[card.vaultKey].points) || 0) + earnedRawPoints;
    await setDoc(doc(db, "milestrack_vaults", myVaultKey), myVault);
  }

  const txRecordId = editId || String(Date.now());
  await setDoc(doc(db, "milestrack_txns", txRecordId), {
    id: txRecordId,
    owner: myVaultKey,
    timestamp: txTimestamp,
    desc,
    amt,
    cardId,
    bonusCategory: isBonus ? 'bonus' : 'base',
    miles: earnedMiles,
    earnedRawPoints,
    date: displayDateStr
  });

  closeModal();
}

// Navigation Tabs
function switchTab(tabName) {
  if (window.innerWidth >= 900) return;
  const cardsTab = document.getElementById('tabContentCards');
  const categoryTab = document.getElementById('tabContentCategory');
  const vaultTab = document.getElementById('tabContentVault');

  const btnCards = document.getElementById('btnTabCards');
  const btnCategory = document.getElementById('btnTabCategory');
  const btnVault = document.getElementById('btnTabVault');

  cardsTab.style.display = 'none';
  categoryTab.style.display = 'none';
  vaultTab.style.display = 'none';

  btnCards.classList.remove('active');
  btnCategory.classList.remove('active');
  btnVault.classList.remove('active');

  if (tabName === 'cards') {
    cardsTab.style.display = 'flex';
    btnCards.classList.add('active');
  } else if (tabName === 'category') {
    categoryTab.style.display = 'flex';
    btnCategory.classList.add('active');
  } else {
    vaultTab.style.display = 'flex';
    btnVault.classList.add('active');
  }
}

// Event Listeners Wiring
document.getElementById('btnLoginGoogle')?.addEventListener('click', async () => {
  try { await signInWithPopup(auth, googleProvider); } catch (e) { alert(e.message); }
});

document.getElementById('btnHeaderLogout')?.addEventListener('click', async () => {
  if (confirm("Sign out?")) await signOut(auth);
});

document.getElementById('btnHeaderVault')?.addEventListener('click', () => {
  document.getElementById('v_uob_uni').value = myVault.uob_uni?.points || 0;
  document.getElementById('v_citi_typ').value = myVault.citi_typ?.points || 0;
  document.getElementById('v_citi_miles').value = myVault.citi_miles?.points || 0;
  document.getElementById('v_dbs_pts').value = myVault.dbs_pts?.points || 0;
  document.getElementById('v_yuu_pts').value = myVault.yuu_pts?.points || 0;
  document.getElementById('v_ocbc_pts').value = myVault.ocbc_pts?.points || 0;
  document.getElementById('v_hsbc_pts').value = myVault.hsbc_pts?.points || 0;
  document.getElementById('v_mb_treats').value = myVault.mb_treats?.points || 0;
  document.getElementById('v_kf_miles').value = myVault.kf_direct?.points || 0;
  document.getElementById('vaultOverlay').classList.add('open');
});

document.getElementById('btnSaveVaultBalances')?.addEventListener('click', async () => {
  myVault.uob_uni.points = parseFloat(document.getElementById('v_uob_uni').value) || 0;
  myVault.citi_typ.points = parseFloat(document.getElementById('v_citi_typ').value) || 0;
  myVault.citi_miles.points = parseFloat(document.getElementById('v_citi_miles').value) || 0;
  myVault.dbs_pts.points = parseFloat(document.getElementById('v_dbs_pts').value) || 0;
  myVault.yuu_pts.points = parseFloat(document.getElementById('v_yuu_pts').value) || 0;
  myVault.ocbc_pts.points = parseFloat(document.getElementById('v_ocbc_pts').value) || 0;
  myVault.hsbc_pts.points = parseFloat(document.getElementById('v_hsbc_pts').value) || 0;
  myVault.mb_treats.points = parseFloat(document.getElementById('v_mb_treats').value) || 0;
  myVault.kf_direct.points = parseFloat(document.getElementById('v_kf_miles').value) || 0;
  await setDoc(doc(db, "milestrack_vaults", myVaultKey), myVault);
  document.getElementById('vaultOverlay').classList.remove('open');
});

document.getElementById('btnOpenPeerVault')?.addEventListener('click', openSisterVaultModal);
document.getElementById('btnOpenVaultBalances')?.addEventListener('click', () => document.getElementById('btnHeaderVault').click());
document.getElementById('btnSummaryUpdateVault')?.addEventListener('click', () => document.getElementById('btnHeaderVault').click());

document.getElementById('btnTabCards')?.addEventListener('click', () => switchTab('cards'));
document.getElementById('btnTabCategory')?.addEventListener('click', () => switchTab('category'));
document.getElementById('btnTabVault')?.addEventListener('click', () => switchTab('vault'));

document.getElementById('fabButton')?.addEventListener('click', openModal);
document.getElementById('btnCloseModal')?.addEventListener('click', closeModal);
document.getElementById('btnCloseCardDetail')?.addEventListener('click', closeCardDetailModal);
document.getElementById('btnCloseSisterVault')?.addEventListener('click', closeSisterVaultModal);
document.getElementById('btnCloseVault')?.addEventListener('click', () => document.getElementById('vaultOverlay').classList.remove('open'));
document.getElementById('btnCloseSettings')?.addEventListener('click', () => document.getElementById('settingsOverlay').classList.remove('open'));

document.getElementById('btnSaveLedger')?.addEventListener('click', saveTransaction);

document.getElementById('overseasSwitch')?.addEventListener('change', (e) => {
  isOverseasMode = e.target.checked;
  const bar = document.getElementById('overseasBar');
  const text = document.getElementById('overseasText');
  if (isOverseasMode) {
    bar.classList.add('active');
    text.innerHTML = '<span style="color:var(--fcy-cyan);">✈️ Mode: Overseas Travel (FCY Spend)</span>';
  } else {
    bar.classList.remove('active');
    text.innerText = 'Mode: Singapore (Local SGD)';
  }
  runRecommendation();
});

document.getElementById('krisPlusSwitch')?.addEventListener('change', (e) => {
  isKrisPlusMode = e.target.checked;
  currentChannel = isKrisPlusMode ? 'online' : 'inperson';
  document.getElementById('btnChannelOnline').classList.toggle('active', isKrisPlusMode);
  document.getElementById('btnChannelInPerson').classList.toggle('active', !isKrisPlusMode);
  document.getElementById('contactlessPrefRow').style.display = isKrisPlusMode ? 'none' : 'flex';
  runRecommendation();
});

document.getElementById('btnChannelInPerson')?.addEventListener('click', () => {
  currentChannel = 'inperson';
  document.getElementById('btnChannelInPerson').classList.add('active');
  document.getElementById('btnChannelOnline').classList.remove('active');
  if (!isKrisPlusMode) document.getElementById('contactlessPrefRow').style.display = 'flex';
  runRecommendation();
});

document.getElementById('btnChannelOnline')?.addEventListener('click', () => {
  currentChannel = 'online';
  document.getElementById('btnChannelOnline').classList.add('active');
  document.getElementById('btnChannelInPerson').classList.remove('active');
  document.getElementById('contactlessPrefRow').style.display = 'none';
  runRecommendation();
});

document.getElementById('mccInput')?.addEventListener('input', (e) => {
  document.getElementById('btnClearMcc').style.display = e.target.value.trim() ? 'flex' : 'none';
  runRecommendation();
});

document.getElementById('btnClearMcc')?.addEventListener('click', () => {
  const input = document.getElementById('mccInput');
  input.value = '';
  document.getElementById('btnClearMcc').style.display = 'none';
  input.focus();
  runRecommendation();
});

document.getElementById('recAmount')?.addEventListener('input', runRecommendation);
document.getElementById('contactlessSwitch')?.addEventListener('change', runRecommendation);
document.getElementById('cardSelect')?.addEventListener('change', onCardSelectChange);
document.getElementById('yuuMerchantSelect')?.addEventListener('change', onYuuMerchantChange);
document.getElementById('descInput')?.addEventListener('input', checkShellMerchantTrigger);
document.getElementById('shellGrossInput')?.addEventListener('input', updateShellNettCalc);

document.getElementById('btnApplyShellDiscount')?.addEventListener('click', () => {
  const gross = parseFloat(document.getElementById('shellGrossInput').value) || 0;
  if (gross > 0) document.getElementById('amtInput').value = (gross * 0.86).toFixed(2);
});

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register(`./sw.js?v=${APP_VERSION}`);
      if (reg.waiting && navigator.serviceWorker.controller) showUpdateToast(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) showUpdateToast(newWorker);
        });
      });
    } catch (e) {
      console.error(e);
    }
  });

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}

function showUpdateToast(worker) {
  const toast = document.getElementById('updateToast');
  const btn = document.getElementById('btnReloadApp');
  if (!toast || !btn) return;
  toast.classList.add('visible');
  btn.onclick = () => {
    btn.disabled = true;
    btn.innerText = 'Reloading...';
    worker.postMessage({ type: 'SKIP_WAITING' });
  };
}
