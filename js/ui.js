import { state } from "./state.js";
import { 
  ALL_MASTER_CARDS, 
  DEFAULT_VAULT, 
  DEFAULT_PRESETS, 
  CATEGORY_POOLS, 
  KRISFLYER_4PAX_TIERS, 
  VAULT_REGISTRY 
} from "./config.js";
import { calcEarnedMiles, runRecommendation, getDaysUntilCycleEnd } from "./recommender.js";
import { 
  addTransaction, 
  updateTransaction, 
  deleteTransaction, 
  saveVaultBalances, 
  saveAppSettings 
} from "./firebase.js";

// --- Tab Switcher ---
export function switchTab(tabId) {
  state.currentTab = tabId;
  const tabs = ['cards', 'category', 'vault'];
  tabs.forEach(t => {
    const content = document.getElementById(`tabContent${t.charAt(0).toUpperCase() + t.slice(1)}`);
    const btn = document.getElementById(`btnTab${t.charAt(0).toUpperCase() + t.slice(1)}`);
    if (content) content.style.display = (t === tabId) ? 'block' : 'none';
    if (btn) btn.classList.toggle('active', t === tabId);
  });
}

// --- Card Cap Tracker Rendering ---
export function renderCards() {
  const container = document.getElementById('cardsContainer');
  if (!container) return;
  container.innerHTML = '';

  const activeCards = state.cards.filter(c => state.enabledCardIds.includes(c.id));

  activeCards.forEach(card => {
    const isUncapped = card.monthlyCap >= 999999;
    const spent = card.currentSpend || 0;
    const cap = card.monthlyCap;
    const pct = isUncapped ? 0 : Math.min(100, (spent / cap) * 100);
    const daysLeft = getDaysUntilCycleEnd(card);

    let progressColor = 'var(--primary)';
    if (pct > 90) progressColor = 'var(--danger)';
    else if (pct > 75) progressColor = 'var(--warning)';

    let minSpendMarkerHtml = '';
    if (card.minSpend && card.minSpend > 0 && !isUncapped) {
      const minMarkerPct = Math.min(100, (card.minSpend / cap) * 100);
      minSpendMarkerHtml = `
        <div class="min-spend-flag" style="left:${minMarkerPct}%;" title="Min Spend: S$${card.minSpend}">
          <span>Min $${card.minSpend}</span>
        </div>
      `;
    }

    const cardDiv = document.createElement('div');
    cardDiv.className = 'card-item';
    cardDiv.onclick = () => openCardDetailModal(card.id);

    cardDiv.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div style="display:flex; gap:10px; align-items:center;">
          <div class="card-thumb ${card.themeClass || ''}">
            ${card.image ? `<img src="${card.image}" alt="${card.name}">` : ''}
          </div>
          <div>
            <div style="font-weight:700; font-size:0.92rem; color:#fff;">${card.name}</div>
            <div style="font-size:0.75rem; color:#94a3b8;">
              ${card.cycleType === 'statement' ? `Statement: Cutoff ${card.cutoffDay || 18}th` : 'Calendar Month'} • ${card.bonusMpd} mpd
            </div>
          </div>
        </div>
        ${card.badgeClass ? `<span class="badge ${card.badgeClass}">PROMO</span>` : ''}
      </div>

      <div class="progress-bar-container">
        ${minSpendMarkerHtml}
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width:${isUncapped ? 100 : pct}%; background:${isUncapped ? 'var(--primary)' : progressColor};"></div>
        </div>
      </div>

      <div class="card-meta">
        <div>
          ${isUncapped 
            ? `<span>Spent: <b>$${spent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b> (Uncapped)</span>`
            : `<span>Spent: <b>$${spent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b> / $${cap}</span>`}
        </div>
        <div>
          ${isUncapped ? '<span>Direct Miles</span>' : `<span>Left: <b>$${Math.max(0, cap - spent).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b> • ${daysLeft}d</span>`}
        </div>
      </div>
    `;

    container.appendChild(cardDiv);
  });
}

// --- Quick Presets Bar ---
export function renderPresets() {
  const container = document.getElementById('presetsBar');
  if (!container) return;
  container.innerHTML = '';

  DEFAULT_PRESETS.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'preset-btn';
    btn.type = 'button';
    btn.innerHTML = `<span>${p.icon}</span> <span>${p.label}</span>`;
    btn.onclick = () => {
      const cardSelect = document.getElementById('cardSelect');
      const descInput = document.getElementById('descInput');
      if (cardSelect) cardSelect.value = p.cardId;
      if (descInput) descInput.value = p.desc;
      onCardSelectChange();
      checkShellMerchantTrigger();
      openModal();
    };
    container.appendChild(btn);
  });
}

// --- Category Cap Tracker Tab ---
export function renderCategoryTracker() {
  const container = document.getElementById('categoryCardsMobile');
  if (!container) return;
  container.innerHTML = '';

  CATEGORY_POOLS.forEach(pool => {
    const poolCards = state.cards.filter(c => pool.cardIds.includes(c.id));
    const totalSpent = poolCards.reduce((acc, c) => acc + (c.currentSpend || 0), 0);
    const totalCap = poolCards.reduce((acc, c) => acc + (c.monthlyCap >= 999999 ? 0 : c.monthlyCap), 0);
    const pct = totalCap > 0 ? Math.min(100, (totalSpent / totalCap) * 100) : 0;

    const div = document.createElement('div');
    div.className = 'card-item';
    div.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span style="font-weight:700; color:#fff;">${pool.icon} ${pool.name}</span>
        <span style="font-size:0.8rem; color:#94a3b8;">$${totalSpent.toFixed(2)} / $${totalCap}</span>
      </div>
      <div class="progress-bar-container" style="margin:6px 0;">
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width:${pct}%; background:var(--primary);"></div>
        </div>
      </div>
      <div style="font-size:0.72rem; color:#94a3b8;">${pool.notes}</div>
    `;
    container.appendChild(div);
  });
}

// --- Transaction Ledger Rendering ---
export function renderTransactions() {
  const list = document.getElementById('txList');
  const badge = document.getElementById('txCountBadge');
  if (!list) return;

  const searchVal = (state.txSearchQuery || document.getElementById('txSearchInput')?.value || '').toLowerCase().trim();
  const filterCard = state.txCardFilter || document.getElementById('txFilterCardSelect')?.value || 'ALL';

  const filtered = state.transactions.filter(t => {
    if (filterCard !== 'ALL' && t.cardId !== filterCard) return false;
    if (searchVal) {
      const matchDesc = (t.desc || '').toLowerCase().includes(searchVal);
      const matchCard = (t.cardName || '').toLowerCase().includes(searchVal);
      return matchDesc || matchCard;
    }
    return true;
  });

  if (badge) badge.innerText = `${filtered.length} shown`;

  if (filtered.length === 0) {
    list.innerHTML = `<div style="font-size:0.8rem; color:#94a3b8; padding:12px; text-align:center;">No matching transactions found.</div>`;
    return;
  }

  list.innerHTML = '';
  filtered.slice(0, 50).forEach(t => {
    const card = ALL_MASTER_CARDS.find(c => c.id === t.cardId);
    const item = document.createElement('div');
    item.className = 'tx-item';

    item.innerHTML = `
      <div class="tx-info">
        <span class="tx-desc">${t.desc || 'General Spend'}</span>
        <span class="tx-meta">${t.date} • ${card ? card.name : t.cardId} ${t.category === 'base' ? '(Base rate)' : ''}</span>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <div class="tx-amount">
          <div>$${parseFloat(t.amount).toFixed(2)}</div>
          <div class="tx-miles">+${Math.round(t.miles || 0)} mi</div>
        </div>
        <button class="btn-clear-mcc" onclick="window.editTx('${t.id}')" title="Edit">✏️</button>
        <button class="btn-clear-mcc" onclick="window.deleteTx('${t.id}')" title="Delete">🗑️</button>
      </div>
    `;
    list.appendChild(item);
  });
}

// --- Bank Points Vault Rendering ---
export function renderVault() {
  renderVaultBalances();
}

export function renderVaultBalances() {
  const container = document.getElementById('vaultContainer');
  if (!container) return;
  container.innerHTML = '';

  let totalMiles = 0;
  const vaultSource = state.myVault || state.vault || DEFAULT_VAULT;

  Object.entries(DEFAULT_VAULT).forEach(([k, def]) => {
    const pts = Number(vaultSource[k]?.points ?? vaultSource[k] ?? 0);
    const miles = Math.round(pts * def.ratio);
    totalMiles += miles;

    const box = document.createElement('div');
    box.className = 'vault-item';
    box.innerHTML = `
      <div class="vault-name">${def.name}</div>
      <div class="vault-points">${pts.toLocaleString()} ${def.unit}</div>
      <div class="vault-miles">=${miles.toLocaleString()} mi</div>
    `;
    container.appendChild(box);
  });

  const totalEl = document.getElementById('myTotalVaultMiles');
  if (totalEl) totalEl.innerText = `${totalMiles.toLocaleString()} mi`;
  renderTravelGoalBanner();
}

export function renderExpiryRadar() {
  const container = document.getElementById('radarContainer');
  if (!container) return;
  container.innerHTML = '';

  const items = [
    { name: 'Citi ThankYou Points', desc: 'Expires 5 yrs from opening month', badge: 'Warning' },
    { name: 'DBS Points', desc: 'Expires 1 year from month earned', badge: '1 Yr' },
    { name: 'yuu Points', desc: 'Expires 2 years from month earned', badge: '2 Yrs' },
    { name: 'OCBC$', desc: 'Expires 2 years from month earned', badge: '2 Yrs' },
    { name: 'HSBC Rewards', desc: 'Expires 37 months from earning', badge: '3 Yrs' },
    { name: 'KrisFlyer Direct', desc: 'Expires 3 years in SQ account', badge: '3 Yrs' },
    { name: 'UOB UNI$', desc: 'Non-expiring (except PRVI promo)', badge: 'Permanent' }
  ];

  items.forEach(it => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding: 4px 0; border-bottom:1px solid rgba(255,255,255,0.05); font-size:0.75rem;';
    row.innerHTML = `
      <div>
        <span style="font-weight:600; color:#fff;">${it.name}</span>
        <div style="font-size:0.7rem; color:#94a3b8;">${it.desc}</div>
      </div>
      <span class="badge" style="background:rgba(255,255,255,0.08); font-size:0.65rem;">${it.badge}</span>
    `;
    container.appendChild(row);
  });
}

export function renderTravelGoalBanner() {
  let totalMiles = 0;
  const vaultSource = state.myVault || state.vault || DEFAULT_VAULT;
  Object.entries(DEFAULT_VAULT).forEach(([k, def]) => {
    const pts = Number(vaultSource[k]?.points ?? vaultSource[k] ?? 0);
    totalMiles += Math.round(pts * def.ratio);
  });

  const nextTier = KRISFLYER_4PAX_TIERS.find(t => totalMiles < t.totalMiles) || KRISFLYER_4PAX_TIERS[KRISFLYER_4PAX_TIERS.length - 1];
  const destEl = document.getElementById('travelGoalDest');
  const progEl = document.getElementById('travelGoalProgress');

  if (destEl) destEl.innerText = `Target: ${nextTier.name} (4 Pax Business)`;
  if (progEl) {
    const pct = Math.min(100, Math.round((totalMiles / nextTier.totalMiles) * 100));
    progEl.innerHTML = `
      <div style="display:flex; justify-content:space-between; font-size:0.72rem; color:#cbd5e1; margin-bottom:3px;">
        <span>Progress: ${pct}%</span>
        <span>${totalMiles.toLocaleString()} / ${nextTier.totalMiles.toLocaleString()} mi</span>
      </div>
      <div class="progress-bar-bg" style="height:6px;">
        <div class="progress-bar-fill" style="width:${pct}%; background:var(--accent);"></div>
      </div>
    `;
  }
}

// --- Extended Family & Sister Vault Modals ---
export function openSisterVaultModal() {
  openFamilyMemberVaultModal('sister');
}

export function closeSisterVaultModal() {
  const overlay = document.getElementById('sisterVaultOverlay');
  if (overlay) overlay.style.display = 'none';
}

export function renderSisterVaultModal() {
  openFamilyMemberVaultModal('sister');
}

export function openFamilyMemberVaultModal(vaultKey = 'sister') {
  const conf = VAULT_REGISTRY[vaultKey] || { label: "Family Vault" };
  const modalTitle = document.getElementById('peerModalTitle');
  if (modalTitle) modalTitle.innerText = `${conf.label} (Read-Only)`;

  const container = document.getElementById('sisterVaultContainer');
  if (!container) return;
  container.innerHTML = '';

  const balances = (state.peerVaults && state.peerVaults[vaultKey]) || state.peerVault || {};

  Object.entries(DEFAULT_VAULT).forEach(([k, def]) => {
    const pts = Number(balances[k]?.points ?? balances[k] ?? 0);
    const miles = Math.round(pts * def.ratio);

    const box = document.createElement('div');
    box.className = 'vault-item';
    box.innerHTML = `
      <div class="vault-name">${def.name}</div>
      <div class="vault-points">${pts.toLocaleString()} ${def.unit}</div>
      <div class="vault-miles">=${miles.toLocaleString()} mi (${def.ratio}x)</div>
    `;
    container.appendChild(box);
  });

  const overlay = document.getElementById('sisterVaultOverlay');
  if (overlay) overlay.style.display = 'flex';
}

export function renderFamilyVaultsSection() {
  const sec = document.getElementById('familyVaultsSection');
  if (!sec) return;

  if (!state.isAdmin) {
    sec.style.display = 'none';
    return;
  }

  sec.style.display = 'block';
  const grid = document.getElementById('familyVaultsGrid');
  if (!grid) return;
  grid.innerHTML = '';

  const memberKeys = Object.keys(VAULT_REGISTRY).filter(k => k !== 'primary');

  memberKeys.forEach(k => {
    const conf = VAULT_REGISTRY[k];
    const peerBalances = (state.peerVaults && state.peerVaults[k]) || {};

    let totalPeerMiles = 0;
    Object.keys(DEFAULT_VAULT).forEach(key => {
      const pts = Number(peerBalances[key]?.points ?? peerBalances[key] ?? 0);
      const ratio = DEFAULT_VAULT[key].ratio;
      totalPeerMiles += Math.round(pts * ratio);
    });

    const card = document.createElement('div');
    card.className = 'sister-card';
    card.style.cursor = 'pointer';
    card.onclick = () => openFamilyMemberVaultModal(k);

    card.innerHTML = `
      <div class="sister-info">
        <span class="sister-title"><span class="material-symbols-outlined" style="font-size:16px;">account_balance</span> ${conf.label}</span>
        <div class="sister-miles">${totalPeerMiles.toLocaleString()} miles</div>
        <span style="font-size:0.75rem; color:#94a3b8;">${conf.emails[0]} • Tap to view breakdown</span>
      </div>
      <button class="btn-view-peer">Inspect ❯</button>
    `;

    grid.appendChild(card);
  });
}

// --- Reconciliation & Archive Views ---
export function renderReconcileView() {
  const cardSelect = document.getElementById('reconcileCardSelect');
  const cardId = cardSelect?.value || state.cards[0]?.id;
  const card = state.cards.find(c => c.id === cardId);
  const spendEl = document.getElementById('reconcileAppSpend');
  if (spendEl && card) {
    spendEl.innerText = `$${(card.currentSpend || 0).toFixed(2)}`;
  }
}

export function updateReconcileDelta(appSpend = 0) {
  const stmtInput = document.getElementById('reconcileStmtInput');
  const deltaEl = document.getElementById('reconcileDelta');
  if (!stmtInput || !deltaEl) return;
  const stmt = parseFloat(stmtInput.value) || 0;
  const delta = stmt - appSpend;
  deltaEl.innerText = `${delta >= 0 ? '+' : ''}$${delta.toFixed(2)}`;
  deltaEl.style.color = Math.abs(delta) < 0.01 ? '#34d399' : '#f87171';
}

export function openReconcileModal() {
  renderReconcileView();
  const overlay = document.getElementById('reconcileOverlay');
  if (overlay) overlay.style.display = 'flex';
}

export function closeReconcileModal() {
  const overlay = document.getElementById('reconcileOverlay');
  if (overlay) overlay.style.display = 'none';
}

export function renderArchiveData() {
  renderArchiveModal();
}

export function renderArchiveModal() {
  const container = document.getElementById('archiveMonthsContainer');
  if (!container) return;
  container.innerHTML = '';

  const monthsMap = {};
  state.transactions.forEach(t => {
    if (!t.date) return;
    const m = t.date.slice(0, 7);
    if (!monthsMap[m]) monthsMap[m] = { count: 0, totalAmt: 0, totalMiles: 0 };
    monthsMap[m].count++;
    monthsMap[m].totalAmt += (parseFloat(t.amount) || 0);
    monthsMap[m].totalMiles += (parseFloat(t.miles) || 0);
  });

  const sortedMonths = Object.keys(monthsMap).sort().reverse();
  if (!sortedMonths.length) {
    container.innerHTML = '<div style="font-size:0.8rem; color:#94a3b8; text-align:center; padding:12px;">No historical monthly data found.</div>';
    return;
  }

  sortedMonths.forEach(m => {
    const d = monthsMap[m];
    const row = document.createElement('div');
    row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.05); font-size:0.8rem;';
    row.innerHTML = `
      <div>
        <div style="font-weight:700; color:#fff;">${m}</div>
        <div style="font-size:0.7rem; color:#94a3b8;">${d.count} txns • $${d.totalAmt.toFixed(2)} • +${Math.round(d.totalMiles).toLocaleString()} mi</div>
      </div>
      <div style="display:flex; gap:6px;">
        <button class="btn-clear-mcc" onclick="window.exportArchiveCSV('${m}')" title="Export CSV">📥 CSV</button>
      </div>
    `;
    container.appendChild(row);
  });
}

export function openArchiveModal() {
  renderArchiveModal();
  const overlay = document.getElementById('archiveOverlay') || document.getElementById('archiveHistoryOverlay');
  if (overlay) overlay.style.display = 'flex';
}

export function closeArchiveModal() {
  const overlay = document.getElementById('archiveOverlay') || document.getElementById('archiveHistoryOverlay');
  if (overlay) overlay.style.display = 'none';
}

export function exportArchiveMonthCSV(monthStr) {
  const txns = state.transactions.filter(t => (t.date || '').startsWith(typeof monthStr === 'string' ? monthStr : ''));
  if (!txns.length) {
    alert("No transactions found for the selected period.");
    return;
  }

  const headers = ['Date', 'Card ID', 'Card Name', 'Description', 'Amount (SGD)', 'Miles Earned', 'Category', 'Owner'];
  const rows = txns.map(t => {
    const card = ALL_MASTER_CARDS.find(c => c.id === t.cardId);
    return [
      `"${t.date || ''}"`,
      `"${t.cardId || ''}"`,
      `"${card ? card.name : t.cardId || ''}"`,
      `"${(t.desc || '').replace(/"/g, '""')}"`,
      parseFloat(t.amount || 0).toFixed(2),
      Math.round(t.miles || 0),
      `"${t.category || 'bonus'}"`,
      `"${t.owner || state.myVaultKey}"`
    ].join(',');
  });

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `MilesTrackSG_Archive_${state.myVaultKey}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// --- UOB Defense Alerts ---
export function checkUobFeeDefense() {
  const container = document.getElementById('uobFeeAlertContainer');
  if (!container) return;
  container.innerHTML = '';

  const now = new Date();
  const alerts = state.settings?.uobFeeAlerts || {};
  
  Object.entries(alerts).forEach(([cardId, renewalMonthStr]) => {
    if (!renewalMonthStr) return;
    const [renYear, renMonth] = renewalMonthStr.split('-').map(Number);
    const renewalDate = new Date(renYear, renMonth - 1, 1);
    const diffDays = Math.ceil((renewalDate - now) / (1000 * 60 * 60 * 24));
    
    if (diffDays >= 0 && diffDays <= 45) {
      const card = ALL_MASTER_CARDS.find(c => c.id === cardId);
      const cardName = card ? card.name : cardId;
      
      const alertBox = document.createElement('div');
      alertBox.className = 'uob-rounding-notice';
      alertBox.style.cssText = 'background: rgba(239, 68, 68, 0.12); border-color: rgba(239, 68, 68, 0.4); color: #fca5a5; margin: 8px 0;';
      alertBox.innerHTML = `
        🛡️ <b>UOB Fee Defense Alert:</b> <b>${cardName}</b> renews in <b>${diffDays} days</b> (${renewalMonthStr}).
        Check for automatic UNI$ deduction and call UOB or request a fee waiver via the TMRW app.
      `;
      container.appendChild(alertBox);
    }
  });
}

// --- Card Detail & Form Modals ---
export function openModal() {
  const overlay = document.getElementById('modalOverlay');
  if (overlay) overlay.style.display = 'flex';
}

export function closeModal() {
  const overlay = document.getElementById('modalOverlay');
  if (overlay) overlay.style.display = 'none';
  const idInput = document.getElementById('editTxId');
  if (idInput) idInput.value = '';
}

export function closeCardDetailModal() {
  const overlay = document.getElementById('cardDetailOverlay');
  if (overlay) overlay.style.display = 'none';
}

export function openCardDetailModal(cardId) {
  const card = state.cards.find(c => c.id === cardId);
  if (!card) return;

  document.getElementById('modalCardName').innerText = card.name;
  document.getElementById('modalCardCycle').innerText = card.cycleType === 'statement' ? `Statement Cutoff: ${card.cutoffDay || 18}th` : 'Calendar Month Cycle';

  const isUncapped = card.monthlyCap >= 999999;
  const spent = card.currentSpend || 0;
  const cap = card.monthlyCap;
  const pct = isUncapped ? 100 : Math.min(100, (spent / cap) * 100);

  document.getElementById('modalCardSpent').innerText = `$${spent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById('modalCardSpentSub').innerText = isUncapped ? 'Uncapped capacity' : `${pct.toFixed(1)}% of $${cap} cap`;
  document.getElementById('modalCardRemaining').innerText = isUncapped ? 'Unlimited' : `$${Math.max(0, cap - spent).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById('modalCardDaysLeft').innerText = `Resets in ${getDaysUntilCycleEnd(card)} days`;

  const fill = document.getElementById('modalCardProgressFill');
  if (fill) fill.style.width = `${pct}%`;

  const rules = document.getElementById('modalCardRules');
  if (rules) {
    rules.innerHTML = `
      <span class="rule-pill">${card.bonusMpd} mpd bonus tier</span>
      <span class="rule-pill">${card.baseMpd} mpd base tier</span>
      <span class="rule-pill">${card.strategyType} rules</span>
      <span class="rule-pill">${card.channelMode} channel</span>
    `;
  }

  const txList = document.getElementById('modalCardTxList');
  if (txList) {
    const cycleTx = state.transactions.filter(t => t.cardId === card.id);
    txList.innerHTML = cycleTx.slice(0, 10).map(t => `
      <div style="display:flex; justify-content:space-between; padding:3px 0; font-size:0.75rem; border-bottom:1px solid rgba(255,255,255,0.05);">
        <span>${t.desc || 'Expense'}</span>
        <b>$${parseFloat(t.amount).toFixed(2)}</b>
      </div>
    `).join('') || '<div style="font-size:0.75rem; color:#94a3b8;">No transactions logged this cycle.</div>';
  }

  document.getElementById('cardDetailOverlay').style.display = 'flex';
}

// --- Form & Input Change Handlers ---
export function onCardSelectChange() {
  const select = document.getElementById('cardSelect');
  const cardId = select?.value;
  const card = ALL_MASTER_CARDS.find(c => c.id === cardId);
  const hint = document.getElementById('cardHint');
  const yuuGroup = document.getElementById('yuuMerchantGroup');
  const merchantGroup = document.getElementById('merchantInputGroup');

  if (card && hint) hint.innerText = card.hint || '';

  if (cardId === 'dbs-yuu') {
    if (yuuGroup) yuuGroup.style.display = 'block';
    if (merchantGroup) merchantGroup.style.display = 'none';
  } else {
    if (yuuGroup) yuuGroup.style.display = 'none';
    if (merchantGroup) merchantGroup.style.display = 'block';
  }
}

export function onYuuMerchantChange() {
  const yuuSelect = document.getElementById('yuuMerchantSelect');
  const descInput = document.getElementById('descInput');
  if (yuuSelect && descInput && yuuSelect.value) {
    descInput.value = yuuSelect.value;
  }
}

export function checkShellMerchantTrigger() {
  const desc = (document.getElementById('descInput')?.value || '').toLowerCase();
  const area = document.getElementById('shellDiscountCalcArea');
  if (!area) return;
  area.style.display = desc.includes('shell') ? 'block' : 'none';
}

export async function saveTransaction() {
  const editId = document.getElementById('editTxId')?.value;
  const date = document.getElementById('txDateInput')?.value || new Date().toISOString().slice(0, 10);
  const cardId = document.getElementById('cardSelect')?.value;
  const desc = document.getElementById('descInput')?.value || 'General Expense';
  const amount = parseFloat(document.getElementById('amtInput')?.value) || 0;
  const category = document.getElementById('bonusCategory')?.value || 'bonus';

  if (!cardId || amount <= 0) {
    alert("Please select a valid card and enter an amount.");
    return;
  }

  const card = ALL_MASTER_CARDS.find(c => c.id === cardId);
  const miles = calcEarnedMiles(card, amount, category === 'bonus' ? card.bonusMpd : card.baseMpd);

  const txn = {
    date,
    cardId,
    cardName: card?.name || cardId,
    desc,
    amount,
    miles,
    category
  };

  if (editId) {
    await updateTransaction(editId, txn);
  } else {
    await addTransaction(txn);
  }

  closeModal();
}

// --- Window Global Bindings ---
window.editTx = function(id) {
  const tx = state.transactions.find(t => t.id === id);
  if (!tx) return;
  
  document.getElementById('editTxId').value = tx.id;
  document.getElementById('txDateInput').value = tx.date || '';
  document.getElementById('cardSelect').value = tx.cardId || '';
  document.getElementById('descInput').value = tx.desc || '';
  document.getElementById('amtInput').value = tx.amount || '';
  document.getElementById('bonusCategory').value = tx.category || 'bonus';
  
  onCardSelectChange();
  checkShellMerchantTrigger();
  openModal();
};

window.deleteTx = async function(id) {
  if (confirm("Delete this transaction?")) {
    await deleteTransaction(id);
  }
};

window.exportArchiveCSV = function(monthStr) {
  exportArchiveMonthCSV(monthStr);
};