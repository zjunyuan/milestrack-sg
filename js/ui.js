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

// --- Quick Presets Bar (Pill Buttons) ---
export function renderPresets() {
  const container = document.getElementById('presetsBar');
  if (!container) return;
  container.innerHTML = '';

  DEFAULT_PRESETS.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'preset-pill';
    btn.type = 'button';
    btn.innerHTML = `<span class="preset-icon">${p.icon}</span> <span class="preset-label">${p.label}</span>`;
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
    const pct = isUncapped ? 100 : Math.min(100, (spent / cap) * 100);
    const daysLeft = getDaysUntilCycleEnd(card);

    let progressColor = '#f97316'; // Orange accent
    if (card.engine === 'yuu-10') progressColor = '#ea580c';
    else if (card.bank === 'UOB') progressColor = '#0284c7';

    let minSpendBadge = '';
    if (card.minSpend && card.minSpend > 0) {
      const metMin = spent >= card.minSpend;
      minSpendBadge = `<span style="font-size:0.7rem; color:${metMin ? '#34d399' : '#94a3b8'};">Min $${card.minSpend}</span>`;
    }

    const cardDiv = document.createElement('div');
    cardDiv.className = 'card-item';
    cardDiv.onclick = () => openCardDetailModal(card.id);

    cardDiv.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <div style="display:flex; gap:10px; align-items:center;">
          <div class="card-thumb ${card.themeClass || ''}">
            ${card.image ? `<img src="${card.image}" alt="${card.name}">` : ''}
          </div>
          <div>
            <div style="font-weight:700; font-size:0.92rem; color:#fff;">${card.name}</div>
            <div style="font-size:0.75rem; color:#94a3b8;">
              ${card.cycleType === 'statement' ? `Statement Cutoff (${card.cutoffDay || 18}th)` : 'Calendar Month (1st - End)'}
            </div>
          </div>
        </div>
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:3px;">
          <span class="badge ${card.badgeClass || 'badge-gold'}" style="font-size:0.75rem; font-weight:700;">${card.bonusMpd} mpd</span>
          ${minSpendBadge}
        </div>
      </div>

      <div class="progress-bar-container" style="margin: 6px 0 8px;">
        <div class="progress-bar-bg" style="height:6px; background:rgba(255,255,255,0.08); border-radius:3px;">
          <div class="progress-bar-fill" style="width:${pct}%; background:${progressColor}; height:100%; border-radius:3px;"></div>
        </div>
      </div>

      <div class="card-meta" style="display:flex; justify-content:space-between; font-size:0.75rem; color:#94a3b8;">
        <div>
          ${isUncapped 
            ? `<span>$${spent.toFixed(2)} spent (Uncapped)</span>` 
            : `<span>$${spent.toFixed(2)} spent</span>`}
        </div>
        <div>
          ${isUncapped 
            ? `<span>Direct Miles</span>` 
            : `<span>Cap: $${cap} (${pct.toFixed(0)}%) • ${daysLeft}d left</span>`}
        </div>
      </div>
    `;

    container.appendChild(cardDiv);
  });
}

// --- Bank Points Vault Rendering (Miles on top, points below) ---
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
    box.className = 'vault-tile';
    box.style.cssText = 'background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:10px; display:flex; flex-direction:column; gap:2px;';
    
    box.innerHTML = `
      <div style="font-size:0.7rem; color:#94a3b8; font-weight:700; text-transform:uppercase;">${def.name}</div>
      <div style="font-size:1.15rem; font-weight:800; color:#fff;">${miles > 0 ? miles.toLocaleString() : '0'} <span style="font-size:0.75rem; font-weight:500; color:#94a3b8;">miles</span></div>
      <div style="font-size:0.72rem; color:#64748b;">${pts.toLocaleString()} ${def.unit}</div>
    `;
    container.appendChild(box);
  });

  const totalEl = document.getElementById('myTotalVaultMiles');
  if (totalEl) totalEl.innerText = `${totalMiles.toLocaleString()} mi`;
  renderTravelGoalBanner();
}

// --- Points Expiry Radar (Countdown Badges) ---
export function renderExpiryRadar() {
  const container = document.getElementById('radarContainer');
  if (!container) return;
  container.innerHTML = '';

  const items = [
    { name: 'DBS Points', days: '430d left', color: '#10b981' },
    { name: 'UOB UNI$', days: '796d left', color: '#10b981' },
    { name: 'yuu Points', days: '735d left', color: '#10b981' },
    { name: 'Citi ThankYou Points', days: '5 Yrs Fixed', color: '#f59e0b' },
    { name: 'OCBC$', days: '2 Yrs Cycle', color: '#10b981' },
    { name: 'HSBC Rewards', days: '37m Cycle', color: '#10b981' }
  ];

  items.forEach(it => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding: 6px 0; border-bottom:1px solid rgba(255,255,255,0.05); font-size:0.78rem;';
    row.innerHTML = `
      <span style="font-weight:600; color:#cbd5e1;">${it.name}</span>
      <span style="background:rgba(16, 185, 129, 0.15); color:${it.color}; padding:2px 8px; border-radius:12px; font-size:0.7rem; font-weight:700;">${it.days}</span>
    `;
    container.appendChild(row);
  });
}

// --- Category Cap Tracker (Desktop & Mobile) ---
export function renderCategoryTracker() {
  const containers = [
    document.getElementById('categoryCardsMobile'),
    document.getElementById('categoryCardsDesktop')
  ].filter(Boolean);

  if (!containers.length) return;

  const desktopSection = document.getElementById('desktopCategorySection');
  if (desktopSection) desktopSection.style.display = 'flex';

  containers.forEach(container => {
    container.innerHTML = '';

    CATEGORY_POOLS.forEach(pool => {
      const poolCards = state.cards.filter(c => pool.cardIds.includes(c.id));
      const totalSpent = poolCards.reduce((acc, c) => acc + (c.currentSpend || 0), 0);
      const totalCap = poolCards.reduce((acc, c) => acc + (c.monthlyCap >= 999999 ? 0 : c.monthlyCap), 0);
      const remaining = Math.max(0, totalCap - totalSpent);
      const pct = totalCap > 0 ? Math.min(100, (totalSpent / totalCap) * 100) : 0;

      const div = document.createElement('div');
      div.className = 'card-item';
      div.style.cssText = 'background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:12px; margin-bottom:8px;';

      const cardBreakdowns = poolCards.map(c => 
        `<span style="font-size:0.7rem; color:#94a3b8;">${c.name.split(' ')[0]}: $${(c.currentSpend || 0).toFixed(0)}/$${c.monthlyCap}</span>`
      ).join(' • ');

      div.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <span style="font-weight:700; color:#fff; font-size:0.85rem;">${pool.icon} ${pool.name}</span>
          <span style="background:rgba(16, 185, 129, 0.15); color:#34d399; padding:2px 8px; border-radius:10px; font-size:0.75rem; font-weight:700;">$${remaining.toLocaleString()} left</span>
        </div>
        <div style="font-size:0.72rem; color:#cbd5e1; margin-bottom:4px;">$${totalSpent.toFixed(2)} spent of $${totalCap.toLocaleString()} (${pct.toFixed(0)}% pooled cap used)</div>
        <div class="progress-bar-bg" style="height:6px; background:rgba(255,255,255,0.08); border-radius:3px; margin-bottom:6px;">
          <div class="progress-bar-fill" style="width:${pct}%; background:#34d399; height:100%; border-radius:3px;"></div>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:4px; line-height:1.2;">
          ${cardBreakdowns}
        </div>
      `;
      container.appendChild(div);
    });
  });
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
  const sisterMilesEl = document.getElementById('sisterMilesDisplay');
  const sisterBalances = (state.peerVaults && state.peerVaults['sister']) || state.peerVault || {};
  
  let totalSisterMiles = 0;
  Object.keys(DEFAULT_VAULT).forEach(key => {
    const pts = Number(sisterBalances[key]?.points ?? sisterBalances[key] ?? 0);
    const ratio = DEFAULT_VAULT[key].ratio;
    totalSisterMiles += Math.round(pts * ratio);
  });

  if (sisterMilesEl) {
    sisterMilesEl.innerText = `${totalSisterMiles.toLocaleString()} miles`;
  }
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
    box.className = 'vault-tile';
    box.style.cssText = 'background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:10px;';
    box.innerHTML = `
      <div style="font-size:0.7rem; color:#94a3b8; font-weight:700;">${def.name}</div>
      <div style="font-size:1.1rem; font-weight:800; color:#fff;">${miles.toLocaleString()} mi</div>
      <div style="font-size:0.72rem; color:#64748b;">${pts.toLocaleString()} ${def.unit} (${def.ratio}x)</div>
    `;
    container.appendChild(box);
  });

  const overlay = document.getElementById('sisterVaultOverlay');
  if (overlay) overlay.style.display = 'flex';
}

export function renderFamilyVaultsSection() {
  renderSisterVaultModal();
  const grid = document.getElementById('familyVaultsGrid');
  if (!grid) return;
  grid.innerHTML = '';

  if (!state.isAdmin) return;

  const otherMembers = ['ellice', 'eugene'];

  otherMembers.forEach(k => {
    const conf = VAULT_REGISTRY[k];
    if (!conf) return;
    const peerBalances = (state.peerVaults && state.peerVaults[k]) || {};

    let totalPeerMiles = 0;
    Object.keys(DEFAULT_VAULT).forEach(key => {
      const pts = Number(peerBalances[key]?.points ?? peerBalances[key] ?? 0);
      const ratio = DEFAULT_VAULT[key].ratio;
      totalPeerMiles += Math.round(pts * ratio);
    });

    const card = document.createElement('div');
    card.className = 'sister-card';
    card.style.cssText = 'margin-top:6px; cursor:pointer;';
    card.onclick = () => openFamilyMemberVaultModal(k);

    card.innerHTML = `
      <div class="sister-info">
        <span class="sister-title"><span class="material-symbols-outlined" style="font-size:16px;">family_restroom</span> ${conf.label}</span>
        <div class="sister-miles">${totalPeerMiles.toLocaleString()} miles</div>
        <span style="font-size:0.75rem; color:#94a3b8;">${conf.emails[0]} • Tap to inspect</span>
      </div>
      <button class="btn-view-peer">View Breakdown ❯</button>
    `;

    grid.appendChild(card);
  });
}

// --- Travel Goal Target Banner ---
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
      <div class="progress-bar-bg" style="height:6px; background:rgba(255,255,255,0.08); border-radius:3px;">
        <div class="progress-bar-fill" style="width:${pct}%; background:#38bdf8; height:100%; border-radius:3px;"></div>
      </div>
    `;
  }
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
      alertBox.style.cssText = 'background: rgba(239, 68, 68, 0.12); border-color: rgba(239, 68, 68, 0.4); color: #fca5a5; margin: 8px 0; border-radius: 8px; padding: 10px;';
      alertBox.innerHTML = `
        🛡️ <b>UOB Auto-Deduction Alert:</b> <b>${cardName}</b> renewal in <b>${diffDays} days</b> (${renewalMonthStr}).
        UOB will automatically deduct UNI$ for annual fees unless waived.
      `;
      container.appendChild(alertBox);
    }
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
  const deltaBadge = document.getElementById('reconcileDeltaBadge');
  if (!stmtInput || !deltaBadge) return;
  const stmt = parseFloat(stmtInput.value) || 0;
  const delta = stmt - appSpend;
  deltaBadge.innerText = `${delta >= 0 ? '+' : ''}$${delta.toFixed(2)}`;
  deltaBadge.style.color = Math.abs(delta) < 0.01 ? '#34d399' : '#f87171';
}

export function openReconcileModal() {
  renderReconcileView();
  const overlay = document.getElementById('reconcileModalOverlay');
  if (overlay) overlay.style.display = 'flex';
}

export function closeReconcileModal() {
  const overlay = document.getElementById('reconcileModalOverlay');
  if (overlay) overlay.style.display = 'none';
}

export function renderArchiveData() {
  renderArchiveModal();
}

export function renderArchiveModal() {
  const container = document.getElementById('archiveCardBreakdownList');
  if (!container) return;
  container.innerHTML = '';

  const select = document.getElementById('archiveMonthSelect');
  if (select && select.options.length === 0) {
    const months = [...new Set(state.transactions.map(t => (t.date || '').slice(0, 7)).filter(Boolean))].sort().reverse();
    months.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.innerText = m;
      select.appendChild(opt);
    });
  }

  const selectedMonth = select?.value || '';
  const txns = state.transactions.filter(t => (t.date || '').startsWith(selectedMonth));
  const totalSpent = txns.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
  const totalMiles = txns.reduce((sum, t) => sum + (parseFloat(t.miles) || 0), 0);

  const spentEl = document.getElementById('archiveTotalSpent');
  const milesEl = document.getElementById('archiveTotalMiles');
  const countEl = document.getElementById('archiveTxnCount');
  const mpdEl = document.getElementById('archiveBlendedMpd');

  if (spentEl) spentEl.innerText = `$${totalSpent.toFixed(2)}`;
  if (milesEl) milesEl.innerText = `${Math.round(totalMiles).toLocaleString()} mi`;
  if (countEl) countEl.innerText = `${txns.length} transactions`;
  if (mpdEl) mpdEl.innerText = `${totalSpent > 0 ? (totalMiles / totalSpent).toFixed(2) : '0.00'} blended mpd`;
}

export function openArchiveModal() {
  renderArchiveModal();
  const overlay = document.getElementById('archiveModalOverlay');
  if (overlay) overlay.style.display = 'flex';
}

export function closeArchiveModal() {
  const overlay = document.getElementById('archiveModalOverlay');
  if (overlay) overlay.style.display = 'none';
}

export function exportArchiveMonthCSV() {
  const select = document.getElementById('archiveMonthSelect');
  const monthStr = select?.value || '';
  const txns = state.transactions.filter(t => (t.date || '').startsWith(monthStr));
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
  link.setAttribute('download', `MilesTrackSG_Archive_${monthStr}_${state.myVaultKey}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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
  document.getElementById('modalCardCycle').innerText = card.cycleType === 'statement' ? `Statement Cutoff: ${card.cutoffDay || 18}th` : 'Calendar Month (1st - End)';

  const isUncapped = card.monthlyCap >= 999999;
  const spent = card.currentSpend || 0;
  const cap = card.monthlyCap;
  const pct = isUncapped ? 100 : Math.min(100, (spent / cap) * 100);

  document.getElementById('modalCardSpent').innerText = `$${spent.toFixed(2)}`;
  document.getElementById('modalCardSpentSub').innerText = isUncapped ? 'Uncapped capacity' : `${pct.toFixed(1)}% of $${cap} cap`;
  document.getElementById('modalCardRemaining').innerText = isUncapped ? 'Unlimited' : `$${Math.max(0, cap - spent).toFixed(2)}`;
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

  const quickLogBtn = document.getElementById('btnQuickLogCard');
  if (quickLogBtn) {
    quickLogBtn.onclick = () => {
      closeCardDetailModal();
      const select = document.getElementById('cardSelect');
      if (select) select.value = card.id;
      onCardSelectChange();
      openModal();
    };
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

// --- Transactions List Rendering ---
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

window.exportArchiveCSV = function() {
  exportArchiveMonthCSV();
};