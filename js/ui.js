import { state } from "./state.js";
import { ALL_MASTER_CARDS, DEFAULT_VAULT, DEFAULT_PRESETS, CATEGORY_POOLS, KRISFLYER_4PAX_TIERS, VAULT_REGISTRY } from "./config.js";
import { calcEarnedMiles, runRecommendation, getDaysUntilCycleEnd } from "./recommender.js";
import { addTransaction, updateTransaction, deleteTransaction, saveVaultBalances, saveAppSettings } from "./firebase.js";

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

export function renderTransactions() {
  const list = document.getElementById('txList');
  const badge = document.getElementById('txCountBadge');
  if (!list) return;

  const searchVal = (document.getElementById('txSearchInput')?.value || '').toLowerCase().trim();
  const filterCard = document.getElementById('txFilterCardSelect')?.value || 'ALL';

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
    const peerBalances = state.peerVaults[k] || {};

    let totalPeerMiles = 0;
    Object.keys(DEFAULT_VAULT).forEach(key => {
      const pts = Number(peerBalances[key] || 0);
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

export function openFamilyMemberVaultModal(vaultKey) {
  const conf = VAULT_REGISTRY[vaultKey];
  if (!conf) return;

  const modalTitle = document.getElementById('peerModalTitle');
  if (modalTitle) modalTitle.innerText = `${conf.label} (Read-Only)`;

  const container = document.getElementById('sisterVaultContainer');
  if (!container) return;
  container.innerHTML = '';

  const balances = state.peerVaults[vaultKey] || {};

  Object.entries(DEFAULT_VAULT).forEach(([k, def]) => {
    const pts = Number(balances[k] || 0);
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

  document.getElementById('sisterVaultOverlay').style.display = 'flex';
}

export function renderVaultBalances() {
  const container = document.getElementById('vaultContainer');
  if (!container) return;
  container.innerHTML = '';

  let totalMiles = 0;

  Object.entries(DEFAULT_VAULT).forEach(([k, def]) => {
    const pts = Number(state.vault[k] || 0);
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
  Object.entries(DEFAULT_VAULT).forEach(([k, def]) => {
    const pts = Number(state.vault[k] || 0);
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

export function updateUobFeeRenewalAlerts() {
  const container = document.getElementById('uobFeeAlertContainer');
  if (!container) return;
  container.innerHTML = '';
}

export function checkShellMerchantTrigger() {
  const desc = (document.getElementById('descInput')?.value || '').toLowerCase();
  const area = document.getElementById('shellDiscountCalcArea');
  if (!area) return;
  area.style.display = desc.includes('shell') ? 'block' : 'none';
}

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

export function openModal() {
  document.getElementById('modalOverlay').style.display = 'flex';
}

export function closeModal() {
  document.getElementById('modalOverlay').style.display = 'none';
  document.getElementById('editTxId').value = '';
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
