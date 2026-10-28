import { 
  ALL_MASTER_CARDS, 
  DEFAULT_PRESETS, 
  CATEGORY_POOLS, 
  KRISFLYER_4PAX_TIERS, 
  detectYuuMerchant,
  ALL_VAULT_KEYS,
  VAULT_LABELS,
  APP_VERSION,
  DEFAULT_VAULT
} from "./config.js";
import { state } from "./state.js";
import { 
  saveTxToFirestore, 
  deleteTxFromFirestore, 
  updateVaultDoc, 
  updateSettingsDoc 
} from "./firebase.js";
import { 
  calcEarnedMiles, 
  runRecommendation, 
  getDaysUntilCycleEnd 
} from "./recommender.js";

export function isTxInActiveCycle(txTimestamp, card) {
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

export function getCycleLabel(card) {
  if (card.cycleType === 'uncapped') return 'No Monthly Cap';
  if (card.cycleType === 'calendar') return 'Calendar Month (1st - End)';
  return `Statement Month (Resets on ${card.cutoffDay}th)`;
}

export function getYuuMerchantProgress(card) {
  const activeTxns = state.transactions.filter(tx => tx.cardId === card.id && isTxInActiveCycle(tx.timestamp, card));
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

export function renderPresets() {
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

export function quickLogPreset(presetId) {
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

export function renderCards() {
  const container = document.getElementById('cardsContainer');
  const select = document.getElementById('cardSelect');
  const filterSelect = document.getElementById('txFilterCardSelect');
  if (!container || !select) return;

  container.innerHTML = '';
  select.innerHTML = '';

  if (filterSelect) {
    const currentFilter = filterSelect.value;
    filterSelect.innerHTML = '<option value="ALL">All Cards</option>';
    state.cards.forEach(c => {
      filterSelect.innerHTML += `<option value="${c.id}">${c.name.split(' ')[0]} ${c.name.split(' ')[1] || ''}</option>`;
    });
    filterSelect.value = currentFilter || 'ALL';
  }

  state.cards.forEach(card => {
    const activeTxns = state.transactions.filter(tx => tx.cardId === card.id && isTxInActiveCycle(tx.timestamp, card));
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

export function openCardDetailModal(cardId) {
  const card = state.cards.find(c => c.id === cardId) || ALL_MASTER_CARDS.find(c => c.id === cardId);
  if (!card) return;

  const activeTxns = state.transactions.filter(tx => tx.cardId === card.id && isTxInActiveCycle(tx.timestamp, card));
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

  document.getElementById('cardDetailOverlay')?.classList.add('open');
}

export function renderVault() {
  const container = document.getElementById('vaultContainer');
  if (!container) return;
  container.innerHTML = '';
  let myGrandTotalMiles = 0;

  for (const [key, item] of Object.entries(state.myVault)) {
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

export function updateTravelGoal(personalTotalMiles) {
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

export function renderTransactions() {
  const list = document.getElementById('txList');
  const badge = document.getElementById('txCountBadge');
  if (!list) return;
  list.innerHTML = '';

  const queryClean = state.txSearchQuery.toLowerCase().trim();

  const filteredTxns = state.transactions.filter(tx => {
    const card = ALL_MASTER_CARDS.find(c => c.id === tx.cardId) || { name: 'Card' };
    
    if (state.txCardFilter !== "ALL" && tx.cardId !== state.txCardFilter) {
      return false;
    }

    if (queryClean) {
      const matchDesc = (tx.desc || '').toLowerCase().includes(queryClean);
      const matchCard = card.name.toLowerCase().includes(queryClean);
      const matchDate = (tx.date || '').toLowerCase().includes(queryClean);
      const matchCategory = (tx.bonusCategory || '').toLowerCase().includes(queryClean);
      return matchDesc || matchCard || matchDate || matchCategory;
    }

    return true;
  });

  if (badge) {
    if (queryClean || state.txCardFilter !== "ALL") {
      badge.innerText = `${filteredTxns.length} of ${state.transactions.length} shown`;
    } else {
      badge.innerText = `${state.transactions.length} recorded`;
    }
  }

  if (filteredTxns.length === 0) {
    list.innerHTML = `<div style="text-align:center; padding:16px; font-size:0.8rem; color:#94a3b8;">No matching transactions found.</div>`;
    return;
  }

  filteredTxns.slice().reverse().forEach(tx => {
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

export function renderCategoryTracker() {
  const desktopContainer = document.getElementById('categoryCardsDesktop');
  const mobileContainer = document.getElementById('categoryCardsMobile');
  let html = '';

  CATEGORY_POOLS.forEach(cat => {
    const activeCards = state.cards.filter(c => cat.cardIds.includes(c.id));
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

export function renderAllVaultsTally() {
  const card = document.getElementById('allVaultsTallyCard');
  const container = document.getElementById('allVaultsList');
  const grandTotalEl = document.getElementById('allVaultsGrandTotal');
  if (!card || !container) return;

  // Only the household admin sees every vault.
  card.style.display = state.userRole === 'PRIMARY' ? 'flex' : 'none';
  if (state.userRole !== 'PRIMARY') return;

  let grandTotal = 0;
  container.innerHTML = ALL_VAULT_KEYS.map((key) => {
    const vault = state.allVaultsData[key] || {};
    const miles = Object.values(vault).reduce(
      (sum, item) => sum + Math.floor((Number(item?.points) || 0) * (Number(item?.ratio) || 1)), 0);
    grandTotal += miles;
    return `
      <div class="vault-tally-row">
        <div class="vault-row-info">
          <span class="vault-row-dot ${key === 'primary' ? 'household' : key}"></span>
          <div>
            <div class="vault-row-name">${VAULT_LABELS[key] || key}</div>
            <div class="vault-row-meta">Synced live</div>
          </div>
        </div>
        <div class="vault-row-miles">${miles.toLocaleString()} mi</div>
      </div>`;
  }).join('');
  if (grandTotalEl) grandTotalEl.textContent = `${grandTotal.toLocaleString()} mi`;
}

export function checkUobFeeDefense() {
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
    const dateVal = state.uobRenewals[card.key];
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

export function renderExpiryRadar() {
  const container = document.getElementById('radarContainer');
  if (!container) return;
  container.innerHTML = '';
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const expiries = [
    { key: 'dbs_pts', name: 'DBS Points', expiry: new Date(currentYear + 1, Math.floor(currentMonth / 3) * 3 + 3, 0), pts: state.myVault.dbs_pts?.points || 0 },
    { key: 'uob_uni', name: 'UOB UNI$', expiry: new Date(currentYear + 2, Math.floor(currentMonth / 3) * 3 + 3, 0), pts: state.myVault.uob_uni?.points || 0 },
    { key: 'yuu_pts', name: 'yuu Points', expiry: new Date(currentYear + 2, currentMonth + 1, 0), pts: state.myVault.yuu_pts?.points || 0 }
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

export function checkShellMerchantTrigger() {
  const descVal = (document.getElementById('descInput')?.value || '').toLowerCase();
  const cardId = document.getElementById('cardSelect')?.value;
  const isShell = descVal.includes('shell') || descVal.includes('petrol') || descVal.includes('fuel');
  const isUobFuelCard = cardId === 'uob-ppv-contactless' || cardId === 'uob-vs-contactless' || cardId === 'mb-world-mc';
  const calcArea = document.getElementById('shellDiscountCalcArea');
  if (calcArea) calcArea.style.display = (isShell || (descVal && isUobFuelCard)) ? 'block' : 'none';
}

export function onCardSelectChange() {
  const cardId = document.getElementById('cardSelect')?.value;
  const normalGroup = document.getElementById('merchantInputGroup');
  const yuuGroup = document.getElementById('yuuMerchantGroup');

  if (cardId === 'dbs-yuu') {
    if (normalGroup) normalGroup.style.display = 'none';
    if (yuuGroup) yuuGroup.style.display = 'flex';
  } else {
    if (normalGroup) normalGroup.style.display = 'flex';
    if (yuuGroup) yuuGroup.style.display = 'none';
  }
  checkShellMerchantTrigger();
}

export function onYuuMerchantChange() {
  const selected = document.getElementById('yuuMerchantSelect')?.value;
  const bonusCategory = document.getElementById('bonusCategory');
  if (bonusCategory) {
    bonusCategory.value = (selected === 'Other / Non-Partner') ? 'base' : 'bonus';
  }
}

export function openModal() {
  document.getElementById('editTxId').value = '';
  document.getElementById('descInput').value = '';
  document.getElementById('amtInput').value = '';
  document.getElementById('txDateInput').value = new Date().toLocaleDateString('en-CA');
  document.getElementById('modalFormTitle').innerText = "Log Transaction";
  document.getElementById('btnSaveLedger').innerText = "Save to Ledger";
  onCardSelectChange();
  document.getElementById('modalOverlay')?.classList.add('open');
}

export function closeModal() { 
  document.getElementById('modalOverlay')?.classList.remove('open'); 
}

export function closeCardDetailModal() { 
  document.getElementById('cardDetailOverlay')?.classList.remove('open'); 
}

export function openEditModal(txId) {
  const tx = state.transactions.find(t => t.id === txId);
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
  document.getElementById('modalOverlay')?.classList.add('open');
}

export async function deleteTransaction(txId) {
  const tx = state.transactions.find(t => t.id === txId);
  if (!tx || !confirm(`Delete "${tx.desc}" ($${Number(tx.amt || 0).toFixed(2)})?`)) return;

  const card = ALL_MASTER_CARDS.find(c => c.id === tx.cardId);
  if (card && state.myVault[card.vaultKey]) {
    const rawPts = Number(tx.earnedRawPoints) || Math.round((Number(tx.miles) || 0) / (state.myVault[card.vaultKey]?.ratio || 1));
    state.myVault[card.vaultKey].points = Math.max(0, (Number(state.myVault[card.vaultKey].points) || 0) - rawPts);
    await updateVaultDoc(state.myVaultKey, state.myVault);
  }

  await deleteTxFromFirestore(tx.firestoreId || tx.id);
}

export async function saveTransaction() {
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
    const oldTx = state.transactions.find(t => t.id === editId);
    if (oldTx) {
      const oldCard = ALL_MASTER_CARDS.find(c => c.id === oldTx.cardId);
      if (oldCard && state.myVault[oldCard.vaultKey]) {
        const oldPts = Number(oldTx.earnedRawPoints) || 0;
        state.myVault[oldCard.vaultKey].points = Math.max(0, (Number(state.myVault[oldCard.vaultKey].points) || 0) - oldPts);
      }
    }
  }

  const isEligible = isBonus && ((Number(card.currentSpend) || 0) < card.monthlyCap);
  let earnedMiles = calcEarnedMiles(card, amt, isEligible ? card.bonusMpd : card.baseMpd);
  let earnedRawPoints = Math.round(earnedMiles / (state.myVault[card.vaultKey]?.ratio || 1));

  if (state.myVault[card.vaultKey]) {
    state.myVault[card.vaultKey].points = (Number(state.myVault[card.vaultKey].points) || 0) + earnedRawPoints;
    await updateVaultDoc(state.myVaultKey, state.myVault);
  }

  const txRecordId = editId || String(Date.now());
  await saveTxToFirestore(txRecordId, {
    id: txRecordId,
    owner: state.myVaultKey,
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

// Monthly & Annual Archive Helpers
export function getStatementCycleForMonth(card, targetYear, targetMonth) {
  const cutoff = card.cutoffDay || 15;
  const windowEnd = new Date(targetYear, targetMonth - 1, cutoff - 1, 23, 59, 59, 999);
  const windowStart = new Date(targetYear, targetMonth - 2, cutoff, 0, 0, 0, 0);

  const cycleTxns = state.transactions.filter(tx => {
    if (tx.cardId !== card.id || !tx.timestamp) return false;
    const txDate = new Date(tx.timestamp);
    return txDate >= windowStart && txDate <= windowEnd;
  });

  const spent = cycleTxns.reduce((sum, tx) => sum + (Number(tx.amt) || 0), 0);
  const miles = cycleTxns.reduce((sum, tx) => sum + (Number(tx.miles) || 0), 0);

  return {
    label: `${windowStart.toLocaleDateString('en-SG', { month: 'short', day: 'numeric' })} – ${windowEnd.toLocaleDateString('en-SG', { month: 'short', day: 'numeric' })}`,
    spent,
    miles,
    txCount: cycleTxns.length
  };
}

export function getAvailableArchiveMonths() {
  const monthSet = new Set();
  const yearSet = new Set();
  const now = new Date();

  const currentYear = now.getFullYear();
  yearSet.add(currentYear);
  monthSet.add(`${currentYear}-${String(now.getMonth() + 1).padStart(2, '0')}`);

  state.transactions.forEach(tx => {
    if (tx.timestamp) {
      const d = new Date(tx.timestamp);
      const y = d.getFullYear();
      yearSet.add(y);
      monthSet.add(`${y}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
  });

  const sortedYears = Array.from(yearSet).sort((a, b) => b - a);
  const sortedMonths = Array.from(monthSet).sort().reverse();

  const options = [];
  sortedYears.forEach(y => {
    options.push({ value: `YEAR-${y}`, label: `🗓️ Full Year ${y} (All Cards)` });
    sortedMonths
      .filter(m => m.startsWith(`${y}-`))
      .forEach(mKey => {
        const [, month] = mKey.split('-').map(Number);
        const dateObj = new Date(y, month - 1, 1);
        options.push({
          value: mKey,
          label: `  • ${dateObj.toLocaleDateString('en-SG', { month: 'long', year: 'numeric' })}`
        });
      });
  });

  return options;
}

export function openArchiveModal() {
  const select = document.getElementById('archiveMonthSelect');
  if (!select) return;

  const cycleOptions = getAvailableArchiveMonths();
  select.innerHTML = '';

  cycleOptions.forEach(opt => {
    select.innerHTML += `<option value="${opt.value}">${opt.label}</option>`;
  });

  renderArchiveData();
  document.getElementById('archiveModalOverlay')?.classList.add('open');
}

export function closeArchiveModal() {
  document.getElementById('archiveModalOverlay')?.classList.remove('open');
}

export function renderArchiveData() {
  const selectedKey = document.getElementById('archiveMonthSelect')?.value;
  if (!selectedKey) return;

  const isFullYear = selectedKey.startsWith('YEAR-');
  let targetYear = 0;
  let targetMonth = 0;

  if (isFullYear) {
    targetYear = parseInt(selectedKey.replace('YEAR-', ''), 10);
  } else {
    const parts = selectedKey.split('-').map(Number);
    targetYear = parts[0];
    targetMonth = parts[1];
  }

  const scopedTxns = state.transactions.filter(tx => {
    if (!tx.timestamp) return false;
    const d = new Date(tx.timestamp);
    if (isFullYear) {
      return d.getFullYear() === targetYear;
    }
    return d.getFullYear() === targetYear && (d.getMonth() + 1) === targetMonth;
  });

  let totalSpent = 0;
  let totalMiles = 0;
  const cardAggregates = {};

  ALL_MASTER_CARDS.forEach(c => {
    cardAggregates[c.id] = {
      card: c,
      spent: 0,
      miles: 0,
      txCount: 0
    };
  });

  scopedTxns.forEach(tx => {
    const amt = Number(tx.amt) || 0;
    const miles = Number(tx.miles) || 0;
    totalSpent += amt;
    totalMiles += miles;

    if (cardAggregates[tx.cardId]) {
      cardAggregates[tx.cardId].spent += amt;
      cardAggregates[tx.cardId].miles += miles;
      cardAggregates[tx.cardId].txCount += 1;
    }
  });

  const blendedMpd = totalSpent > 0 ? (totalMiles / totalSpent).toFixed(2) : '0.00';

  document.getElementById('archiveTotalSpent').innerText = `$${totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById('archiveTxnCount').innerText = `${scopedTxns.length} transactions (${isFullYear ? `Year ${targetYear}` : '1 Month'})`;
  document.getElementById('archiveTotalMiles').innerText = `+${Math.round(totalMiles).toLocaleString()} mi`;
  document.getElementById('archiveBlendedMpd').innerText = `${blendedMpd} blended mpd`;

  const listEl = document.getElementById('archiveCardBreakdownList');
  if (!listEl) return;
  listEl.innerHTML = '';

  const activeUsedCards = Object.values(cardAggregates).filter(item => item.spent > 0);

  if (activeUsedCards.length === 0) {
    listEl.innerHTML = `<div class="detail-tx-empty">No transactions recorded for ${isFullYear ? `the year ${targetYear}` : 'this billing cycle'}.</div>`;
    return;
  }

  activeUsedCards.sort((a, b) => b.miles - a.miles);

  const now = new Date();
  const monthsInCycle = isFullYear
    ? (targetYear === now.getFullYear() ? (now.getMonth() + 1) : 12)
    : 1;

  activeUsedCards.forEach(item => {
    const card = item.card;
    const isUncapped = card.monthlyCap >= 999999;
    const cumulativeCap = isUncapped ? 999999 : (card.monthlyCap * monthsInCycle);
    const capPct = isUncapped ? 100 : Math.min(100, (item.spent / cumulativeCap) * 100).toFixed(0);
    const cardBlendedMpd = item.spent > 0 ? (item.miles / item.spent).toFixed(2) : '0.00';

    let statementAuditHtml = '';
    if (!isFullYear && card.cycleType === 'statement') {
      const stmt = getStatementCycleForMonth(card, targetYear, targetMonth);
      let statusBadge = '';
      if (card.id.startsWith('uob-vs')) {
        const isMet = stmt.spent >= 1000;
        statusBadge = isMet 
          ? `<span style="color:var(--accent); font-weight:700;">✅ S$1k Min Spend Met ($${stmt.spent.toFixed(0)})</span>` 
          : `<span style="color:var(--danger); font-weight:700;">⚠️ Min Spend Missed ($${stmt.spent.toFixed(0)} / $1,000)</span>`;
      } else {
        statusBadge = `<span>Bill Window: $${stmt.spent.toFixed(0)} / $${card.monthlyCap}</span>`;
      }

      statementAuditHtml = `
        <div style="margin-top:4px; padding:6px 8px; background:rgba(0,0,0,0.25); border-radius:8px; font-size:0.7rem; border-left:2px solid var(--primary);">
          <div style="display:flex; justify-content:space-between; color:#cbd5e1;">
            <span>Statement Cycle (${stmt.label}):</span>
            ${statusBadge}
          </div>
        </div>
      `;
    }

    listEl.innerHTML += `
      <div style="background:var(--surface-variant); padding:10px 12px; border-radius:12px; display:flex; flex-direction:column; gap:4px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:0.85rem; font-weight:700; color:#fff;">${card.name}</span>
          <span style="font-size:0.85rem; font-weight:700; color:var(--accent);">+${item.miles.toLocaleString()} mi</span>
        </div>
        <div class="progress-bar-bg" style="height:5px;">
          <div class="progress-bar-fill" style="width:${capPct}%; background:${capPct >= 100 && !isUncapped ? 'var(--danger)' : 'var(--primary)'};"></div>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:0.72rem; color:#94a3b8;">
          <span>Charged $${item.spent.toFixed(2)} ${isUncapped ? '(Uncapped)' : `(Cap: $${cumulativeCap.toLocaleString()} • ${capPct}%)`}</span>
          <span><b>${cardBlendedMpd} mpd</b> (${item.txCount} txns)</span>
        </div>
        ${statementAuditHtml}
      </div>
    `;
  });
}

export function exportArchiveMonthCSV() {
  const selectedKey = document.getElementById('archiveMonthSelect')?.value;
  if (!selectedKey) return;

  const isFullYear = selectedKey.startsWith('YEAR-');
  let exportTxns = [];
  let fileName = '';

  if (isFullYear) {
    const yearVal = parseInt(selectedKey.replace('YEAR-', ''), 10);
    fileName = `milestrack_full_year_${yearVal}.csv`;
    exportTxns = state.transactions.filter(tx => {
      if (!tx.timestamp) return false;
      return new Date(tx.timestamp).getFullYear() === yearVal;
    });
  } else {
    fileName = `milestrack_${selectedKey}.csv`;
    const [selYear, selMonth] = selectedKey.split('-').map(Number);
    exportTxns = state.transactions.filter(tx => {
      if (!tx.timestamp) return false;
      const d = new Date(tx.timestamp);
      return d.getFullYear() === selYear && (d.getMonth() + 1) === selMonth;
    });
  }

  if (exportTxns.length === 0) return alert("No transactions found for this period.");

  const headers = ["Date", "Description", "Card Slot", "Amount (SGD)", "Earned Miles", "Category"];
  const rows = exportTxns.map(t => {
    const card = ALL_MASTER_CARDS.find(c => c.id === t.cardId) || { name: t.cardId };
    return [
      t.date,
      `"${(t.desc || '').replace(/"/g, '""')}"`,
      `"${card.name}"`,
      Number(t.amt || 0).toFixed(2),
      t.miles,
      t.bonusCategory || 'bonus'
    ];
  });

  const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/* ==========================================================================
   SETTINGS & BACKUP
   ========================================================================== */

function downloadFile(fileName, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function openSettingsModal() {
  // Card wallet checklist
  const list = document.getElementById('cardChecklistContainer');
  if (list) {
    list.innerHTML = ALL_MASTER_CARDS.map(c => `
      <label class="checklist-item">
        <input type="checkbox" class="card-wallet-check" value="${c.id}" ${state.enabledCardIds.includes(c.id) ? 'checked' : ''}>
        <span>${c.name}</span>
      </label>
    `).join('');
  }

  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };
  setVal('uobLsRenewalInput', state.uobRenewals.solitaire);
  setVal('uobVsRenewalInput', state.uobRenewals.visaSig);
  setVal('uobPpvRenewalInput', state.uobRenewals.ppv);
  setVal('uobPrviRenewalInput', state.uobRenewals.prvi);
  setVal('citiApprovalInput', state.citiApprovalDate);
  const vs = ALL_MASTER_CARDS.find(c => c.id.startsWith('uob-vs'));
  const citi = ALL_MASTER_CARDS.find(c => c.id === 'citi-rewards');
  setVal('uobVsCutoff', vs?.cutoffDay ?? 18);
  setVal('citiCutoff', citi?.cutoffDay ?? 15);

  document.getElementById('settingsOverlay')?.classList.add('open');
}

export function closeSettingsModal() {
  document.getElementById('settingsOverlay')?.classList.remove('open');
}

export async function saveSettings() {
  const val = (id) => document.getElementById(id)?.value || '';
  const clampDay = (v, fallback) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? Math.min(31, Math.max(1, n)) : fallback;
  };

  const enabledCards = [...document.querySelectorAll('.card-wallet-check:checked')].map(el => el.value);
  if (enabledCards.length === 0) return alert('Keep at least one card enabled.');

  const payload = {
    enabledCards,
    citiApprovalDate: val('citiApprovalInput') || state.citiApprovalDate,
    uobRenewals: {
      solitaire: val('uobLsRenewalInput') || state.uobRenewals.solitaire,
      visaSig: val('uobVsRenewalInput') || state.uobRenewals.visaSig,
      ppv: val('uobPpvRenewalInput') || state.uobRenewals.ppv,
      prvi: val('uobPrviRenewalInput') || state.uobRenewals.prvi
    },
    cutoffDays: {
      uobVs: clampDay(val('uobVsCutoff'), 18),
      citi: clampDay(val('citiCutoff'), 15)
    }
  };

  const btn = document.getElementById('btnSaveSettings');
  if (btn) { btn.disabled = true; btn.innerText = 'Saving...'; }
  try {
    // The Firestore settings listener applies these values and re-renders.
    await updateSettingsDoc(state.myVaultKey, payload);
    closeSettingsModal();
  } catch (e) {
    console.error('Save settings failed:', e);
    alert('Could not save settings: ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.innerText = 'Save Settings'; }
  }
}

export function exportJSONBackup() {
  const backup = {
    app: 'MilesTrack SG',
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    vault: state.myVaultKey,
    balances: state.myVault,
    settings: {
      enabledCards: state.enabledCardIds,
      citiApprovalDate: state.citiApprovalDate,
      uobRenewals: state.uobRenewals,
      cutoffDays: {
        uobVs: ALL_MASTER_CARDS.find(c => c.id.startsWith('uob-vs'))?.cutoffDay ?? 18,
        citi: ALL_MASTER_CARDS.find(c => c.id === 'citi-rewards')?.cutoffDay ?? 15
      }
    },
    transactions: state.transactions
  };
  const stamp = new Date().toLocaleDateString('en-CA');
  downloadFile(`milestrack_backup_${state.myVaultKey}_${stamp}.json`, JSON.stringify(backup, null, 2), 'application/json');
}

// Validates a parsed backup file. Returns { error } or { balances, settings, txns, skipped }.
function parseBackup(data) {
  if (!data || typeof data !== 'object' || data.app !== 'MilesTrack SG') {
    return { error: 'This is not a MilesTrack SG backup file.' };
  }
  const knownCards = new Set(ALL_MASTER_CARDS.map(c => c.id));
  const balances = {};
  for (const [key, item] of Object.entries(data.balances || {})) {
    if (!(key in DEFAULT_VAULT)) continue;                    // ignore unknown currencies
    const pts = Number(item?.points);
    if (!Number.isFinite(pts) || pts < 0) continue;
    balances[key] = { ...DEFAULT_VAULT[key], points: pts };  // keep ratio/rule/unit from the app
  }

  const txns = [];
  let skipped = 0;
  for (const t of Array.isArray(data.transactions) ? data.transactions : []) {
    const id = String(t?.id ?? t?.firestoreId ?? '');
    if (!id || !/^[\w-]+$/.test(id) || !knownCards.has(t.cardId) || !Number.isFinite(Number(t.amt))) {
      skipped++;
      continue;
    }
    const { firestoreId, ...rest } = t;
    txns.push({ ...rest, id, owner: state.myVaultKey });
  }

  const s = data.settings || {};
  const settings = {
    enabledCards: Array.isArray(s.enabledCards) ? s.enabledCards.filter(id => knownCards.has(id)) : null,
    citiApprovalDate: /^\d{4}-\d{2}$/.test(s.citiApprovalDate || '') ? s.citiApprovalDate : null,
    uobRenewals: s.uobRenewals && typeof s.uobRenewals === 'object' ? s.uobRenewals : null,
    cutoffDays: s.cutoffDays && typeof s.cutoffDays === 'object' ? s.cutoffDays : null
  };
  return { balances, settings, txns, skipped };
}

export async function importJSONBackup(file) {
  if (!file) return;
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    return alert('That file is not valid JSON.');
  }
  const parsed = parseBackup(data);
  if (parsed.error) return alert(parsed.error);

  const { balances, settings, txns, skipped } = parsed;
  const ownerNote = data.vault && data.vault !== state.myVaultKey
    ? `\n\n⚠️ This backup came from the "${data.vault}" vault. It will be restored into YOUR vault ("${state.myVaultKey}").`
    : '';
  const ok = confirm(
    `Restore backup from ${data.exportedAt ? new Date(data.exportedAt).toLocaleString() : 'unknown date'}?\n\n` +
    `• ${Object.keys(balances).length} point balances (replaces current balances)\n` +
    `• ${txns.length} transactions (added or overwritten by ID, nothing is deleted)\n` +
    `• Card wallet & settings` +
    (skipped ? `\n• ${skipped} invalid transactions will be skipped` : '') +
    ownerNote
  );
  if (!ok) return;

  const btn = document.getElementById('btnImportJSON');
  if (btn) btn.disabled = true;
  try {
    if (Object.keys(balances).length) {
      state.myVault = { ...DEFAULT_VAULT, ...balances };
      await updateVaultDoc(state.myVaultKey, state.myVault);
    }
    const payload = {
      enabledCards: settings.enabledCards?.length ? settings.enabledCards : state.enabledCardIds,
      citiApprovalDate: settings.citiApprovalDate || state.citiApprovalDate,
      uobRenewals: { ...state.uobRenewals, ...(settings.uobRenewals || {}) },
      cutoffDays: {
        uobVs: Number(settings.cutoffDays?.uobVs) || 18,
        citi: Number(settings.cutoffDays?.citi) || 15
      }
    };
    await updateSettingsDoc(state.myVaultKey, payload);

    for (let i = 0; i < txns.length; i += 25) {
      await Promise.all(txns.slice(i, i + 25).map(t => saveTxToFirestore(t.id, t)));
    }
    closeSettingsModal();
    alert(`Restore complete: ${txns.length} transactions restored.`);
  } catch (e) {
    console.error('Import failed:', e);
    alert('Restore failed part-way: ' + e.message + '\nYour backup file is unchanged; you can retry.');
  } finally {
    if (btn) btn.disabled = false;
    const input = document.getElementById('importFileInput');
    if (input) input.value = '';
  }
}

export function exportLedgerCSV() {
  if (!state.transactions.length) return alert('No transactions to export yet.');
  const headers = ["Date", "Description", "Card Slot", "Amount (SGD)", "Earned Miles", "Category"];
  const rows = state.transactions.map(t => {
    const card = ALL_MASTER_CARDS.find(c => c.id === t.cardId) || { name: t.cardId };
    return [
      `"${t.date ?? ''}"`,
      `"${(t.desc || '').replace(/"/g, '""')}"`,
      `"${card.name}"`,
      Number(t.amt || 0).toFixed(2),
      t.miles,
      t.bonusCategory || 'bonus'
    ].join(',');
  });
  const stamp = new Date().toLocaleDateString('en-CA');
  downloadFile(`milestrack_ledger_${state.myVaultKey}_${stamp}.csv`, [headers.join(','), ...rows].join('\n'), 'text/csv;charset=utf-8;');
}

// Monthly Statement Reconciliation Engine
export function populateReconcileSelectors() {
  const cardSelect = document.getElementById('reconcileCardSelect');
  const cycleSelect = document.getElementById('reconcileCycleSelect');
  if (!cardSelect || !cycleSelect) return;

  const prevCard = cardSelect.value;
  cardSelect.innerHTML = '';
  state.cards.forEach(c => {
    cardSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
  });
  cardSelect.value = prevCard || state.cards[0]?.id || '';

  const now = new Date();
  const cycles = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-SG', { month: 'long', year: 'numeric' });
    cycles.push({ val, label });
  }

  cycleSelect.innerHTML = '';
  cycles.forEach(cyc => {
    cycleSelect.innerHTML += `<option value="${cyc.val}">${cyc.label}</option>`;
  });
}

export function openReconcileModal() {
  populateReconcileSelectors();
  document.getElementById('reconcileStmtInput').value = '';
  renderReconcileView();
  document.getElementById('reconcileModalOverlay')?.classList.add('open');
}

export function closeReconcileModal() {
  document.getElementById('reconcileModalOverlay')?.classList.remove('open');
}

export function getReconcileCycleWindow(card, targetYear, targetMonth) {
  let windowStart, windowEnd, label;

  if (card.cycleType === 'statement') {
    const cutoff = card.cutoffDay || 15;
    windowEnd = new Date(targetYear, targetMonth - 1, cutoff - 1, 23, 59, 59, 999);
    windowStart = new Date(targetYear, targetMonth - 2, cutoff, 0, 0, 0, 0);
    label = `Statement Window: ${windowStart.toLocaleDateString('en-SG', { month: 'short', day: 'numeric' })} – ${windowEnd.toLocaleDateString('en-SG', { month: 'short', day: 'numeric' })} (Cutoff ${cutoff}th)`;
  } else {
    windowStart = new Date(targetYear, targetMonth - 1, 1, 0, 0, 0, 0);
    windowEnd = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);
    label = `Calendar Month: 1st – ${windowEnd.getDate()} ${windowEnd.toLocaleDateString('en-SG', { month: 'short' })}`;
  }

  return { windowStart, windowEnd, label };
}

export function renderReconcileView() {
  const cardId = document.getElementById('reconcileCardSelect')?.value;
  const cycleVal = document.getElementById('reconcileCycleSelect')?.value;
  if (!cardId || !cycleVal) return;

  const card = ALL_MASTER_CARDS.find(c => c.id === cardId);
  if (!card) return;

  const [selYear, selMonth] = cycleVal.split('-').map(Number);
  const cycleInfo = getReconcileCycleWindow(card, selYear, selMonth);

  document.getElementById('reconcileCycleWindowNote').innerText = `📅 ${cycleInfo.label}`;

  const activeTxns = state.transactions.filter(tx => {
    if (tx.cardId !== card.id || !tx.timestamp) return false;
    const txDate = new Date(tx.timestamp);
    return txDate >= cycleInfo.windowStart && txDate <= cycleInfo.windowEnd;
  });

  const loggedSpend = activeTxns.reduce((sum, t) => sum + (Number(t.amt) || 0), 0);
  document.getElementById('reconcileAppSpend').innerText = `$${loggedSpend.toFixed(2)}`;
  document.getElementById('reconcileTxnCount').innerText = `${activeTxns.length} txns logged`;

  updateReconcileDelta(loggedSpend);

  const listEl = document.getElementById('reconcileTxnList');
  if (!listEl) return;
  listEl.innerHTML = '';

  if (activeTxns.length === 0) {
    listEl.innerHTML = `<div class="detail-tx-empty" style="padding:10px;">No charges logged on ${card.name} for this billing window.</div>`;
  } else {
    activeTxns.slice().reverse().forEach(tx => {
      listEl.innerHTML += `
        <div class="tx-item" style="padding:6px 10px; background:rgba(0,0,0,0.25); font-size:0.75rem;">
          <div style="flex:1; min-width:0; padding-right:6px;">
            <div class="tx-desc" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${tx.desc}</div>
            <div class="tx-meta" style="font-size:0.68rem;">${tx.date}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-weight:700;">$${Number(tx.amt || 0).toFixed(2)}</div>
            <div style="color:var(--accent); font-size:0.68rem;">+${tx.miles} mi</div>
          </div>
        </div>
      `;
    });
  }

  const vaultObj = state.myVault[card.vaultKey];
  document.getElementById('reconcileVaultLabel').innerText = `${vaultObj?.name || 'Points'} Balance`;
  document.getElementById('reconcileVaultPtsDisplay').innerText = `${Number(vaultObj?.points || 0).toLocaleString()} ${vaultObj?.unit || 'pts'}`;
}

export function updateReconcileDelta(appSpend) {
  const inputEl = document.getElementById('reconcileStmtInput');
  const deltaBadge = document.getElementById('reconcileDeltaBadge');
  if (!inputEl || !deltaBadge) return;
  const stmtVal = parseFloat(inputEl.value);

  if (isNaN(stmtVal)) {
    deltaBadge.innerText = 'Enter bill total';
    deltaBadge.style.color = '#94a3b8';
    return;
  }

  const diff = appSpend - stmtVal;
  if (Math.abs(diff) < 0.05) {
    deltaBadge.innerText = `✅ Matched ($0.00 difference)`;
    deltaBadge.style.color = 'var(--accent)';
  } else if (diff < 0) {
    deltaBadge.innerText = `⚠️ -$${Math.abs(diff).toFixed(2)} (Missing from app)`;
    deltaBadge.style.color = 'var(--danger)';
  } else {
    deltaBadge.innerText = `⚠️ +$${diff.toFixed(2)} (Over-logged in app)`;
    deltaBadge.style.color = 'var(--warning)';
  }
}

export function switchTab(tabName) {
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

  btnCards?.classList.remove('active');
  btnCategory?.classList.remove('active');
  btnVault?.classList.remove('active');

  if (tabName === 'cards') {
    cardsTab.style.display = 'flex';
    btnCards?.classList.add('active');
  } else if (tabName === 'category') {
    categoryTab.style.display = 'flex';
    btnCategory?.classList.add('active');
  } else {
    vaultTab.style.display = 'flex';
    btnVault?.classList.add('active');
  }
}
