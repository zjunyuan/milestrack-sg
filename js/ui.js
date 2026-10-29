import { fmtNum, fmtAuto } from "./format.js";
import { tierStatus } from "./tiers.js";
import { 
  ALL_MASTER_CARDS, 
  DEFAULT_PRESETS, 
  CATEGORY_POOLS, 
  KRISFLYER_4PAX_TIERS, 
  detectYuuMerchant,
  ALL_VAULT_KEYS,
  VAULT_LABELS,
  APP_VERSION,
  DEFAULT_VAULT,
  MCC_DATABASE,
  normalizeVault,
  cardShort
} from "./config.js";
import { getBuiltinMccEntry, shortCategory } from "./mcc.js";
import { escapeHtml } from "./retailers.js";
import { state } from "./state.js";
import { countsTs, postingRule } from "./posting.js";
import { renderCardWallet, prepareSettingsSheet, feeCardFamilies, feeRenewalId, feeDayId } from "./settings-ui.js";
import { monthlySummaryHtml, monthDeltas, deltaText } from "./summary.js";
import { renderTxChips } from "./history-chips.js";
import { deleteTransactionsBulk, restoreTransactions, pointsHeld } from "./bulk-delete.js";
import { setLogContext, getLogContext, showToast, markSplitLogged, unmarkSplitByTx, splitTotal } from "./log-feedback.js";
import { passesView, sortTxns, toggleSort, categoryOptions, totalsHtml, tableHtml, viewIsFiltered, NO_CATEGORY } from "./history-table.js";
import { postingChipHtml, postingDetailHtml } from "./posting-ui.js";
import { 
  saveTxToFirestore, 
  deleteTxFromFirestore, 
  updateVaultDoc, 
  updateSettingsDoc,
  mergeSettingsDoc
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
  const activeTxns = state.transactions.filter(tx => tx.cardId === card.id && isTxInActiveCycle(countsTs(tx, card), card));
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

  openModal();
}

// Card artwork at a given size class: "" (list, 96x61), "card-thumb-rec" (recommendation, 128x81), "card-thumb-sm" (64x40).
// Falls back to a themed block with the bank name if the picture is missing or fails to load.
export function cardThumbHtml(card, size = "") {
  const cls = `card-thumb ${size}`.trim();
  const fallback = `<div class="${cls} ${card.themeClass || 'thumb-uob'}"${card.image ? ' style="display:none;"' : ''}><div class="thumb-chip"></div><div class="thumb-bank">${card.bank}</div></div>`;
  if (!card.image) return fallback;
  return `<img src="${card.image}" class="${cls}" style="object-fit:cover; padding:0;" alt="${card.name}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">${fallback}`;
}

const money0 = (n) => 'S$' + Math.round(n).toLocaleString('en-SG');

// "Earning profile & rules" panel in the card detail sheet.
export function earningProfileHtml(card) {
  const pill = (t, warn) => `<span class="rule-pill ${warn ? 'rule-pill-warn' : ''}">${t}</span>`;
  const pills = [];
  const rule = card.tierRule;
  if (rule && rule.kind === 'monthly') {
    pills.push(pill(`${card.baseMpd} mpd base`));
    rule.steps.forEach(st => pills.push(pill(`${money0(st.at)}/month spend → ${st.mpd} mpd`)));
  } else if (rule && rule.kind === 'annual-sia') {
    pills.push(pill(`${card.baseMpd} mpd base`));
    pills.push(pill(`3 mpd on SIA Group, Kris+ and Pelago`));
    pills.push(pill(`${money0(rule.at)} SIA Group spend per membership year → ${rule.mpd} mpd (credited after the year)`, true));
  } else {
    pills.push(pill(`<b>${card.bonusMpd} mpd</b> bonus`));
    pills.push(pill(`${card.baseMpd} mpd base`));
  }
  const capped = card.monthlyCap < 999999;
  pills.push(pill(capped ? `${money0(card.monthlyCap)} bonus cap per ${card.cycleType === 'statement' ? 'statement cycle' : 'month'}` : 'No bonus cap'));
  if (card.minSpend > 0 && !rule) pills.push(pill(`Minimum ${money0(card.minSpend)} spend to unlock`, true));
  const channel = card.channelMode === 'online' ? 'Online spend only' : card.channelMode === 'inperson' ? 'In-person only' : 'Online and in-person';
  pills.push(pill(channel));
  if (card.isContactlessOnly) pills.push(pill('Contactless / mobile wallet only', true));
  if (card.inPersonNeedsContactless) pills.push(pill('In person only via contactless', true));
  pills.push(pill(card.strategyType === 'blacklist' ? 'Earns on any category except the bank\'s exclusions' : 'Earns only on listed categories'));
  const today = new Date().toLocaleDateString('en-CA');
  (card.rateSchedule || []).filter(r => r.from > today).forEach(r => {
    const d = new Date(r.from + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    pills.push(pill(`Rate changes on ${d}: ${r.baseMpd} mpd`, true));
  });

  let cats = '';
  if (card.strategyType === 'whitelist') {
    const names = Object.keys(MCC_DATABASE)
      .filter(code => (getBuiltinMccEntry(code)?.candidatesLocal || []).some(c => c.id === card.id && c.baseRate > card.baseMpd))
      .map(code => shortCategory(MCC_DATABASE[code].name));
    const unique = [...new Set(names)];
    if (unique.length) cats = `<div class="rule-cats"><b>Bonus categories:</b> ${unique.slice(0, 12).join(', ')}${unique.length > 12 ? ` and ${unique.length - 12} more` : ''}</div>`;
  }
  return `<div class="rule-pill-container">${pills.join('')}</div>${card.hint ? `<div class="rule-cats">${card.hint}</div>` : ''}${cats}`;
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
      filterSelect.innerHTML += `<option value="${c.id}">${escapeHtml(cardShort(c))}</option>`;
    });
    filterSelect.value = currentFilter || 'ALL';
  }

  state.cards.forEach(card => {
    const activeTxns = state.transactions.filter(tx => tx.cardId === card.id && isTxInActiveCycle(countsTs(tx, card), card));
    const currentSpend = activeTxns.reduce((sum, tx) => sum + (Number(tx.amt) || 0), 0);
    card.currentSpend = currentSpend;

    const isUncapped = card.monthlyCap >= 999999;
    const isStatement = card.cycleType === 'statement';
    const daysLeft = getDaysUntilCycleEnd(card);

    let pct = isUncapped ? 100 : Math.min(100, (currentSpend / card.monthlyCap) * 100).toFixed(0);
    let barColor = 'var(--primary)';
    let statusNotice = '';
    let markerHtml = '';
    let tierInfo = null;

    if (card.id.startsWith('uob-vs')) {
      const minDeficit = Math.max(0, 1000 - currentSpend);
      const minSpendPct = (1000 / card.monthlyCap) * 100;
      markerHtml = `<div class="min-spend-marker" style="left: ${minSpendPct}%;"></div>`;
      barColor = currentSpend < 1000 ? 'var(--warning)' : 'var(--accent)';
      statusNotice = currentSpend < 1000 ? `<span style="color:var(--warning); font-weight:700;">⚠️ $${fmtNum(minDeficit, 0)} to unlock 4 mpd (${daysLeft}d left)</span>` : `<span style="color:var(--accent); font-weight:700;">✅ S$1k Met!</span>`;
    } else if (card.tierRule) {
      const ts = tierStatus(card, { spend: currentSpend, txns: state.transactions, renewalYm: state.uobRenewals.kf });
      tierInfo = ts;
      pct = Math.min(100, (ts.spent / ts.scale) * 100).toFixed(0);
      barColor = ts.met ? 'var(--accent)' : 'var(--warning)';
      markerHtml = ts.markers.map(m => `<div class="min-spend-marker" style="left: ${m}%;"></div>`).join('');
      statusNotice = `<span style="color:${ts.met ? 'var(--accent)' : 'var(--warning)'}; font-weight:700;">${ts.headline}</span>`;
    } else if (card.id === 'dbs-yuu') {
      const yuuProgress = getYuuMerchantProgress(card);
      barColor = (currentSpend >= 800 && yuuProgress.isEligible) ? 'var(--accent)' : 'var(--warning)';
      statusNotice = `${yuuProgress.isEligible ? '✅ 4/4 Merchants' : `⚠️ ${yuuProgress.count}/4 Merchants`} • $${fmtNum(Math.max(0, 800 - currentSpend), 0)} min left`;
    }

    // Plain uncapped cards have no bar worth showing; tiers and min-spend cards stay.
    if (isUncapped && !tierInfo && !statusNotice) {
      select.innerHTML += `<option value="${card.id}">${escapeHtml(cardShort(card))}</option>`;
      return;
    }

    const thumbHtml = cardThumbHtml(card);

    const cardEl = document.createElement('div');
    cardEl.className = `credit-card ${isStatement ? 'statement-cycle' : ''}`;
    cardEl.style.cursor = 'pointer';
    cardEl.innerHTML = `
      <div class="card-header">
        <div class="card-header-left">
          ${thumbHtml}
          <div>
            <div class="card-name">${escapeHtml(cardShort(card))}</div>
            <div class="cycle-pill ${isStatement ? 'statement-pill' : ''}">${getCycleLabel(card)}</div>
            ${postingChipHtml(card)}
          </div>
        </div>
        <span class="card-badge ${card.badgeClass || ''}">${tierInfo ? (tierInfo.met ? tierInfo.current + ' mpd' : tierInfo.current + ' → ' + tierInfo.steps[tierInfo.steps.length - 1].mpd + ' mpd') : card.bonusMpd + ' mpd'}</span>
      </div>
      <div class="progress-bar-container">
        ${markerHtml}
        <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${pct}%; background:${barColor};"></div></div>
      </div>
      <div class="card-stats">
        <span>${tierInfo && tierInfo.kind === 'annual-sia' ? '$' + fmtNum(tierInfo.spent, 2) + ' SIA Group spend' : '$' + fmtNum(currentSpend, 2) + ' spent'}</span>
        <span>${statusNotice || (isUncapped ? 'Uncapped' : `Cap: $${fmtAuto(card.monthlyCap)} (${pct}%)`)}</span>
      </div>
    `;
    cardEl.addEventListener('click', (e) => {
      if (e.target.closest('.post-chip')) { window.dispatchEvent(new Event('open-posting-sheet')); return; }
      openCardDetailModal(card.id);
    });
    container.appendChild(cardEl);

    select.innerHTML += `<option value="${card.id}">${escapeHtml(cardShort(card))}</option>`;
  });

  onCardSelectChange();
  runRecommendation();
  window.dispatchEvent(new Event('cards-rendered'));
}

export function openCardDetailModal(cardId) {
  const card = state.cards.find(c => c.id === cardId) || ALL_MASTER_CARDS.find(c => c.id === cardId);
  if (!card) return;

  const activeTxns = state.transactions.filter(tx => tx.cardId === card.id && isTxInActiveCycle(countsTs(tx, card), card));
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

  const rulesBox = document.getElementById('modalCardRules');
  if (rulesBox) rulesBox.outerHTML = `<div id="modalCardRules">${earningProfileHtml(card)}</div>`;
  const tierAlert = document.getElementById('modalCardAlertArea');
  if (tierAlert) {
    const ts = tierStatus(card, { spend: currentSpend, txns: state.transactions, renewalYm: state.uobRenewals.kf });
    tierAlert.innerHTML = ts ? `<div class="fee-alert"><div class="fee-alert-desc"><b>${ts.headline}</b><br>${ts.detail}</div></div>` : '';
  }
  document.getElementById('modalCardName').innerText = cardShort(card);
  document.getElementById('modalCardCycle').innerText = `${getCycleLabel(card)} • ${card.bonusMpd} mpd tier`;
  const cycleEl = document.getElementById('modalCardCycle');
  let postEl = document.getElementById('modalCardPosting');
  if (!postEl && cycleEl) { postEl = document.createElement('div'); postEl.id = 'modalCardPosting'; postEl.className = 'post-note'; cycleEl.insertAdjacentElement('afterend', postEl); }
  if (postEl) { const h = postingDetailHtml(card); postEl.innerHTML = h; postEl.style.display = h ? '' : 'none'; }
  document.getElementById('modalCardSpent').innerText = `$${fmtNum(currentSpend, 2)}`;
  document.getElementById('modalCardSpentSub').innerText = isUncapped ? 'Uncapped capacity' : `${pct.toFixed(0)}% of $${fmtAuto(card.monthlyCap)}`;
  document.getElementById('modalCardRemaining').innerText = isUncapped ? 'Unlimited' : `$${fmtNum(remaining, 2)}`;
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
          <div><div class="tx-miles" style="font-size:0.85rem;">+${fmtNum(tx.miles)} mi</div><div class="tx-amt" style="font-size:0.7rem;">$${fmtNum(Number(tx.amt || 0), 2)}</div></div>
        </div>
      `;
    });
  }
  document.getElementById('modalCardTxTotalMiles').innerText = `+${fmtNum(cycleMilesSum)} miles earned`;

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
        <div class="vault-miles-big">${fmtNum(equivMiles)} <span class="vault-miles-unit">miles</span></div>
        <span class="vault-raw-pts">${fmtNum(Number(item.points || 0))} ${item.unit}</span>
      </div>
    `;
  }

  document.getElementById('myTotalVaultMiles').innerText = `${fmtNum(myGrandTotalMiles)} mi`;
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
  const barEl = document.getElementById('travelGoalBar');
  const floor = unlockedTier ? unlockedTier.totalMiles : 0;
  const pct = nextTier
    ? Math.max(0, Math.min(100, ((personalTotalMiles - floor) / (nextTier.totalMiles - floor)) * 100))
    : 100;
  if (barEl) barEl.style.width = `${pct.toFixed(0)}%`;

  if (!unlockedTier) {
    const firstTier = KRISFLYER_4PAX_TIERS[0];
    destEl.innerHTML = `✈️ 4 pax business return: starting`;
    progEl.innerHTML = `<b>${fmtNum((firstTier.totalMiles - personalTotalMiles))}</b> more miles for <b>${firstTier.name}</b>`;
  } else {
    destEl.innerHTML = `✈️ 4 pax business: <b>${unlockedTier.name}</b> ✓`;
    progEl.innerHTML = nextTier ? `<b>${fmtNum((nextTier.totalMiles - personalTotalMiles))}</b> more miles for <b>${nextTier.name}</b>` : `🌟 Top tier reached`;
  }
}

// The bar above the list in Select mode.
function selectBarHtml(rows) {
  const n = state.txSelect.ids.size;
  const spent = rows.filter(t => state.txSelect.ids.has(String(t.id))).reduce((a, t) => a + (Number(t.amt) || 0), 0);
  return `<div class="tx-selectbar"><span><b>${n}</b> selected${n ? ` · S$${fmtNum(spent, 2)}` : ''}</span>
    <button type="button" class="btn-backup" data-sel="all">Select all ${rows.length} shown</button>
    <button type="button" class="btn-backup" data-sel="none" ${n ? '' : 'disabled'}>Clear</button>
    <button type="button" class="btn-backup tx-del-btn" data-sel="delete" ${n ? '' : 'disabled'}>Delete ${n || ''}</button></div>`;
}

async function handleSelectAction(action) {
  const sel = state.txSelect;
  if (action === 'none') { sel.ids = new Set(); renderTransactions(); return; }
  if (action === 'all') {
    // "shown" = what the filters and search currently leave on screen
    document.querySelectorAll('#txList [data-id]').forEach(el => sel.ids.add(String(el.dataset.id)));
    renderTransactions(); return;
  }
  if (action !== 'delete') return;
  const txs = state.transactions.filter(t => sel.ids.has(String(t.id)));
  if (!txs.length) return;
  const total = txs.reduce((a, t) => a + (Number(t.amt) || 0), 0);
  const pts = pointsHeld(txs);
  if (!confirm(`Delete ${txs.length} transaction${txs.length === 1 ? '' : 's'} (S$${fmtNum(total, 2)})?\n\nTheir points (${fmtNum(pts)}) are taken off your balances too. You can undo straight after.`)) return;
  const { deleted, failed } = await deleteTransactionsBulk(txs);
  sel.ids = new Set(); sel.on = false;
  renderTransactions();
  if (deleted.length) {
    showToast(`Deleted ${deleted.length} transaction${deleted.length === 1 ? '' : 's'}${failed.length ? `, ${failed.length} failed` : ''}`, {
      kind: failed.length ? 'error' : 'ok', actionLabel: 'Undo', ms: 12000,
      onAction: async () => { try { await restoreTransactions(deleted); showToast(`Restored ${deleted.length}`); } catch (err) { console.error(err); showToast('Could not restore: ' + (err.message || err), { kind: 'error' }); } }
    });
  } else if (failed.length) showToast('Nothing was deleted. Check your connection and try again.', { kind: 'error' });
}

export function renderTransactions() {
  const list = document.getElementById('txList');
  const badge = document.getElementById('txCountBadge');
  if (!list) return;

  // Table clicks (sort headers, edit, delete) are handled once, by delegation.
  if (!list.dataset.bound) {
    list.dataset.bound = '1';
    list.addEventListener('click', (e) => {
      const th = e.target.closest('th[data-sort]');
      if (th) { toggleSort(state.txView, th.dataset.sort); renderTransactions(); return; }
      const selBtn = e.target.closest('[data-sel]');
      if (selBtn && selBtn.tagName === 'BUTTON') { handleSelectAction(selBtn.dataset.sel); return; }
      const btn = e.target.closest('button[data-act]');
      const tr = btn && btn.closest('tr[data-id]');
      if (!tr) return;
      if (btn.dataset.act === 'edit') openEditModal(tr.dataset.id);
      else if (btn.dataset.act === 'delete') deleteTransaction(tr.dataset.id);
    });
    list.addEventListener('change', (e) => {
      const t = e.target;
      if (t.classList.contains('tx-sel')) {
        const id = String((t.closest('[data-id]') || {}).dataset?.id || '');
        if (!id) return;
        if (t.checked) state.txSelect.ids.add(id); else state.txSelect.ids.delete(id);
        renderTransactions();
      } else if (t.dataset && t.dataset.sel === 'all-toggle') {
        handleSelectAction(t.checked ? 'all' : 'none');
      }
    });
  }
  const selBtnEl = document.getElementById('btnTxSelect');
  if (selBtnEl && !selBtnEl.dataset.bound) {
    selBtnEl.dataset.bound = '1';
    selBtnEl.addEventListener('click', () => { state.txSelect.on = !state.txSelect.on; state.txSelect.ids = new Set(); renderTransactions(); });
  }

  const cardOf = (tx) => ALL_MASTER_CARDS.find(c => c.id === tx.cardId) || { name: 'Card' };
  const view = state.txView;
  const queryClean = state.txSearchQuery.toLowerCase().trim();
  const inPeriodRows = state.transactions.filter(inHistoryPeriod);

  // Category dropdown follows the period; keep the current pick.
  const catSel = document.getElementById('txFilterCategory');
  if (catSel) {
    const { names, none } = categoryOptions(inPeriodRows);
    if (view.category !== 'ALL' && view.category !== NO_CATEGORY && !names.includes(view.category)) names.push(view.category);
    catSel.innerHTML = `<option value="ALL">All categories</option>`
      + names.sort().map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('')
      + (none ? `<option value="${NO_CATEGORY}">Unrecognised</option>` : '');
    catSel.value = view.category;
  }

  renderTxChips(inPeriodRows);

  const filteredTxns = inPeriodRows.filter(tx => {
    const card = cardOf(tx);
    if (state.txCardFilter !== "ALL" && tx.cardId !== state.txCardFilter) return false;
    if (!passesView(tx, view)) return false;
    if (queryClean) {
      const matchDesc = (tx.desc || '').toLowerCase().includes(queryClean);
      const matchCard = card.name.toLowerCase().includes(queryClean) || cardShort(card).toLowerCase().includes(queryClean);
      const matchDate = (tx.date || '').toLowerCase().includes(queryClean);
      const matchCategory = (tx.bonusCategory || '').toLowerCase().includes(queryClean);
      return matchDesc || matchCard || matchDate || matchCategory;
    }
    return true;
  });
  const rows = sortTxns(filteredTxns, view, cardOf);

  // Select mode: only rows that are showing can stay selected, so nothing hidden by a filter is deleted by mistake.
  const sel = state.txSelect;
  const selBtn = document.getElementById('btnTxSelect');
  if (selBtn) { selBtn.textContent = sel.on ? 'Done' : 'Select'; selBtn.classList.toggle('active', sel.on); }
  if (sel.on) { const shown = new Set(rows.map(t => String(t.id))); sel.ids = new Set([...sel.ids].filter(id => shown.has(id))); }
  const selectBar = sel.on ? selectBarHtml(rows) : '';

  if (badge) {
    badge.innerText = (queryClean || state.txCardFilter !== "ALL" || viewIsFiltered(view))
      ? `${rows.length} of ${inPeriodRows.length} shown`
      : `${inPeriodRows.length} recorded`;
  }

  if (rows.length === 0) {
    list.innerHTML = `${selectBar}<div style="text-align:center; padding:16px; font-size:0.8rem; color:#94a3b8;">No matching transactions found.</div>`;
    return;
  }

  if (window.matchMedia('(min-width: 900px)').matches) {
    list.innerHTML = selectBar + tableHtml(rows, view, cardOf, sel.on ? sel : null) + totalsHtml(rows, view);
    return;
  }

  list.innerHTML = selectBar;
  rows.forEach(tx => {
    const card = cardOf(tx);
    const row = document.createElement('div');
    row.className = 'tx-item' + (sel.on && sel.ids.has(String(tx.id)) ? ' selected' : '');
    row.dataset.id = String(tx.id);
    row.innerHTML = `
      ${sel.on ? `<input type="checkbox" class="tx-sel tx-sel-phone" ${sel.ids.has(String(tx.id)) ? 'checked' : ''} aria-label="Select">` : ''}
      <div style="flex:1; min-width:0; padding-right:8px;">
        <div class="tx-desc" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(tx.desc || '')}</div>
        <div class="tx-meta">${escapeHtml(cardShort(card))} • ${tx.date}</div>
      </div>
      <div>
        <div class="tx-miles">+${fmtNum(tx.miles)} mi</div>
        <div class="tx-amt">$${fmtNum(Number(tx.amt || 0), 2)}</div>
      </div>
      ${sel.on ? '' : `<div class="tx-actions">
        <button class="btn-tx-action btn-edit" title="Edit entry"><span class="material-symbols-outlined" style="font-size:18px;">edit</span></button>
        <button class="btn-tx-action btn-delete" title="Delete entry"><span class="material-symbols-outlined" style="font-size:18px;">delete</span></button>
      </div>`}
    `;
    if (sel.on) {
      row.addEventListener('click', (e) => { if (e.target.closest('input')) return; if (sel.ids.has(String(tx.id))) sel.ids.delete(String(tx.id)); else sel.ids.add(String(tx.id)); renderTransactions(); });
    } else {
      row.querySelector('.btn-edit').addEventListener('click', () => openEditModal(tx.id));
      row.querySelector('.btn-delete').addEventListener('click', () => deleteTransaction(tx.id));
    }
    list.appendChild(row);
  });
  list.insertAdjacentHTML('beforeend', totalsHtml(rows, view));
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
      chips.push(`<span class="category-chip">${escapeHtml(cardShort(c))}: <b>$${fmtNum(spent, 0)}</b>/${isUncapped ? '∞' : '$' + fmtAuto(cap)}</span>`);
    });

    const catRemaining = Math.max(0, catTotalCap - catTotalSpent);
    const pct = catTotalCap > 0 ? Math.min(100, (catTotalSpent / catTotalCap) * 100).toFixed(0) : 0;
    const barColor = pct >= 90 ? "var(--danger)" : (pct >= 70 ? "var(--warning)" : "var(--primary)");

    html += `
      <div class="category-card">
        <div class="category-header">
          <div class="category-title"><span>${cat.icon}</span><span>${cat.name}</span></div>
          <span style="font-size:0.8rem; font-weight:700; color:${pct >= 90 ? 'var(--danger)' : 'var(--accent)'};">$${fmtNum(catRemaining, 0)} left</span>
        </div>
        <div class="progress-bar-bg" style="height:7px;"><div class="progress-bar-fill" style="width:${pct}%; background:${barColor};"></div></div>
        <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:#94a3b8;">
          <span>$${fmtNum(catTotalSpent, 2)} spent of $${fmtNum(catTotalCap)}</span>
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
  if (!card || !container) return;

  // Only the household admin sees every vault.
  const isAdmin = state.userRole === 'PRIMARY';
  card.style.display = isAdmin ? 'block' : 'none';
  if (!isAdmin) return;

  container.innerHTML = ALL_VAULT_KEYS.map((key) => {
    const vault = state.allVaultsData[key] || {};
    const miles = Object.values(vault).reduce(
      (sum, item) => sum + Math.floor((Number(item?.points) || 0) * (Number(item?.ratio) || 1)), 0);
    return `<span class="vault-chip${miles > 0 ? '' : ' vault-chip-empty'}"><span class="vault-row-dot ${key === 'primary' ? 'household' : key}"></span>${escapeHtml(VAULT_LABELS[key] || key)} <b>${fmtNum(miles)}</b></span>`;
  }).join('');
}

export function checkUobFeeDefense() {
  const container = document.getElementById('uobFeeAlertContainer');
  if (!container) return;
  container.innerHTML = '';
  const now = new Date();

  const uobTargets = [
    { name: "UOB Lady's Solitaire", key: 'solitaire', fee: '$414.20' },
    { name: "UOB Visa Signature", key: 'visaSig', fee: '$218.00' },
    { name: "UOB Preferred Visa", key: 'ppv', fee: '$196.20' },
    { name: "UOB PRVI Miles", key: 'prvi', fee: '$261.60' }
  ];

  uobTargets.forEach(card => {
    const w = feeAlertWindow(state.uobRenewals[card.key], state.uobStatementDay, now);
    if (!w) return;
    const rec = (state.feeAlerts || {})[card.key];
    if (rec && rec.cycle === w.cycle) {
      if (rec.status === 'requested') return;
      if (rec.status === 'snoozed' && Number(rec.until) > now.getTime()) return;
    }
    const since = Math.max(0, Math.floor((now - w.start) / 86400000));
    const stmt = w.start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    container.innerHTML += feeAlertHtml(card.key, w.cycle, since, card.name, `The ${card.fee} fee is on your ${stmt} statement. Ask UOB to reverse it.`);
  });

  // Every other card in the wallet that has a renewal month set (Settings > the card).
  feeCardFamilies().forEach(f => {
    if (!f.ids.some(id => state.enabledCardIds.includes(id))) return;
    const conf = (state.feeCards || {})[f.key];
    if (!conf || !conf.renewal) return;
    const w = feeAlertWindow(conf.renewal, conf.day || 1, now);
    if (!w) return;
    const rec = (state.feeAlerts || {})[f.key];
    if (rec && rec.cycle === w.cycle) {
      if (rec.status === 'requested') return;
      if (rec.status === 'snoozed' && Number(rec.until) > now.getTime()) return;
    }
    const since = Math.max(0, Math.floor((now - w.start) / 86400000));
    const stmt = w.start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    container.innerHTML += feeAlertHtml(f.key, w.cycle, since, f.name, `The annual fee should be on your statement from ${stmt}. Ask ${f.bankLabel} to waive or reverse it.`);
  });
}

function feeAlertHtml(key, cycle, since, name, desc) {
  return `
      <div class="fee-alert-card${since >= 7 ? ' is-soon' : ''}" data-fee-key="${escapeHtml(key)}" data-fee-cycle="${cycle}">
        <div class="fee-alert-title"><span class="material-symbols-outlined" style="font-size:19px;">receipt_long</span> Annual fee on your statement: ${escapeHtml(name)}</div>
        <div class="fee-alert-desc">${escapeHtml(desc)}</div>
        <div class="fee-alert-actions">
          <button type="button" class="fee-btn fee-btn-primary" data-fee-action="requested">I've requested a reversal</button>
          <button type="button" class="fee-btn" data-fee-action="snooze">Remind me in a week</button>
        </div>
      </div>
    `;
}

// The window an annual fee alert is live: from the statement day of the month after the renewal month, until the next statement day.
// renewalYm is "YYYY-MM" (only the month counts, it repeats every year). Returns { start, end, cycle } or null.
export function feeAlertWindow(renewalYm, statementDay, now = new Date()) {
  const m = parseInt(String(renewalYm || '').split('-')[1], 10);
  if (!m) return null;
  const day = Math.min(31, Math.max(1, Number(statementDay) || 23));
  const at = (y, mon) => new Date(y, mon, Math.min(day, new Date(y, mon + 1, 0).getDate()));   // clamp to month length
  for (const y of [now.getFullYear() - 1, now.getFullYear()]) {
    const start = at(y, m);          // month index m = the month after the renewal month (renewal month is m - 1)
    const end = at(y, m + 1);
    if (now >= start && now < end) return { start, end, cycle: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}` };
  }
  return null;
}

// Saves a dismissal or snooze for one card's alert, shared across the household's devices.
async function recordFeeAlert(key, cycle, status) {
  const rec = status === 'snoozed' ? { cycle, status, until: Date.now() + 7 * 86400000 } : { cycle, status };
  const prev = state.feeAlerts || {};
  state.feeAlerts = { ...prev, [key]: rec };
  checkUobFeeDefense();
  try {
    await mergeSettingsDoc(state.myVaultKey, { feeAlerts: { [key]: rec } });
  } catch (e) {
    state.feeAlerts = prev; checkUobFeeDefense();
    console.error('Fee alert save failed:', e);
    alert('Could not save that: ' + e.message);
  }
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest && e.target.closest('[data-fee-action]');
  if (!btn) return;
  const card = btn.closest('[data-fee-key]');
  if (!card) return;
  recordFeeAlert(card.dataset.feeKey, card.dataset.feeCycle, btn.dataset.feeAction === 'requested' ? 'requested' : 'snoozed');
});

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
        <div><div style="font-size:0.85rem; font-weight:600;">${item.name}</div><div style="font-size:0.75rem; color:#94a3b8;">${fmtNum(Number(item.pts))} pts</div></div>
        <span class="radar-badge ${diffDays <= 90 ? 'badge-crit' : 'badge-safe'}">${diffDays}d left</span>
      </div>
    `;
  });
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
  window.dispatchEvent(new Event('tx-form-changed'));
}

export function onYuuMerchantChange() {
  const selected = document.getElementById('yuuMerchantSelect')?.value;
  const bonusCategory = document.getElementById('bonusCategory');
  if (bonusCategory) {
    bonusCategory.value = (selected === 'Other / Non-Partner') ? 'base' : 'bonus';
  }
}

export function openModal() {
  setLogContext(null);
  document.getElementById('editTxId').value = '';
  document.getElementById('descInput').value = '';
  document.getElementById('amtInput').value = '';
  document.getElementById('txDateInput').value = new Date().toLocaleDateString('en-CA');
  const pi = document.getElementById('txPostInput'); if (pi) pi.value = '';
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

  const pe = document.getElementById('txPostInput'); if (pe) pe.value = tx.postTs ? new Date(tx.postTs).toLocaleDateString('en-CA') : '';
  window.dispatchEvent(new Event('tx-form-changed'));
  document.getElementById('modalOverlay')?.classList.add('open');
}

export async function deleteTransaction(txId) {
  const tx = state.transactions.find(t => t.id === txId);
  if (!tx || !confirm(`Delete "${tx.desc}" ($${fmtNum(Number(tx.amt || 0), 2)})?`)) return;
  await removeTransaction(tx);
}

// Deletes a transaction and takes its points back out of the vault (no confirmation: used by Undo as well).
export async function removeTransaction(tx) {
  const card = ALL_MASTER_CARDS.find(c => c.id === tx.cardId);
  const neverCounted = tx.source === "statement" && !tx.vaultCounted;     // imported without ticking "add to balances"
  if (card && !neverCounted && state.myVault[card.vaultKey]) {
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

  let postTs = null;
  const rawPost = document.getElementById('txPostInput')?.value;
  if (rawPost && postingRule(card)?.basis !== 'transaction') {
    const pp = rawPost.split('-').map(Number);
    postTs = new Date(pp[0], pp[1] - 1, pp[2], 12, 0, 0).getTime();
    if (postTs < txTimestamp) return alert('The posting date cannot be before the transaction date.');
  }

  const btn = document.getElementById('btnSaveLedger');
  if (btn?.disabled) return;                      // already saving: ignore a second tap
  const vaultBefore = JSON.stringify(state.myVault);
  let vaultWritten = false;
  const ctx = getLogContext();
  if (btn) btn.disabled = true;

  try {
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
      vaultWritten = true;
    }

    const txRecordId = editId || String(Date.now());
    const payload = {
      id: txRecordId,
      owner: state.myVaultKey,
      timestamp: txTimestamp,
      desc,
      amt,
      cardId,
      bonusCategory: isBonus ? 'bonus' : 'base',
      miles: earnedMiles,
      earnedRawPoints,
      date: displayDateStr,
      ...(postTs ? { postTs } : {})
    };
    await saveTxToFirestore(txRecordId, payload);

    closeModal();
    const what = `${cardShort(card)} · S$${fmtNum(amt, 2)} · +${fmtNum(Math.round(earnedMiles))} mi`;
    if (editId) {
      showToast(`Updated: ${what}`);
    } else if (ctx && ctx.kind === 'split') {
      const n = markSplitLogged(ctx.part, payload);
      const allDone = n >= splitTotal();
      showToast(allDone ? `All ${splitTotal()} cards logged ✅` : `Logged ${n} of ${splitTotal()}: ${what}`, {
        actionLabel: 'Undo last',
        onAction: () => undoLogged(payload)
      });
    } else {
      showToast(`Logged: ${what}`, { actionLabel: 'Undo', onAction: () => undoLogged(payload) });
      if (ctx && ctx.kind === 'single') clearRecommender();
    }
    setLogContext(null);
  } catch (err) {
    console.error('Save transaction failed:', err);
    // Put the in-memory balances back; if the vault write had gone through, write it back too.
    try { state.myVault = JSON.parse(vaultBefore); } catch (e) { /* keep as is */ }
    if (vaultWritten) { try { await updateVaultDoc(state.myVaultKey, state.myVault); } catch (e) { /* nothing more to do */ } }
    showToast(`Not saved. ${err && err.message ? err.message : 'Check your connection and try again.'} Your entry is still on screen.`, { kind: 'error' });
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function undoLogged(tx) {
  try {
    await removeTransaction(tx);
    unmarkSplitByTx(tx.id);
    showToast('Undone: transaction removed');
  } catch (err) {
    console.error('Undo failed:', err);
    showToast('Could not undo. Delete it from History instead.', { kind: 'error' });
  }
}

// Empties the recommender after a single-card log so the next purchase starts fresh.
function clearRecommender() {
  const input = document.getElementById('mccInput');
  const amtEl = document.getElementById('recAmount');
  if (input) input.value = '';
  if (amtEl) amtEl.value = '';
  const clearBtn = document.getElementById('btnClearMcc'); if (clearBtn) clearBtn.style.display = 'none';
  const area = document.getElementById('recResultArea'); if (area) area.innerHTML = '';
  window.dispatchEvent(new Event('rec-cleared'));
}

// Monthly & Annual Archive Helpers
export function getStatementCycleForMonth(card, targetYear, targetMonth) {
  const cutoff = card.cutoffDay || 15;
  const windowEnd = new Date(targetYear, targetMonth - 1, cutoff - 1, 23, 59, 59, 999);
  const windowStart = new Date(targetYear, targetMonth - 2, cutoff, 0, 0, 0, 0);

  const cycleTxns = state.transactions.filter(tx => {
    if (tx.cardId !== card.id || !tx.timestamp) return false;
    const txDate = new Date(countsTs(tx, card));
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

export function refreshHistory() {
  const select = document.getElementById('archiveMonthSelect');
  if (!select) return;
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prev = select.value;
  const options = getAvailableArchiveMonths();
  select.innerHTML = options
    .map(opt => `<option value="${opt.value}">${opt.label}</option>`)
    .join('');
  const keep = options.some(o => o.value === prev) ? prev : currentKey;
  select.value = keep;
  renderArchiveData();
  renderTransactions();
}

/** True when tx falls in the History period picked in #archiveMonthSelect. */
function inHistoryPeriod(tx) {
  const key = document.getElementById('archiveMonthSelect')?.value;
  if (!key) return true;
  if (!tx.timestamp) return false;
  const d = new Date(tx.timestamp);
  if (key.startsWith('YEAR-')) return d.getFullYear() === parseInt(key.slice(5), 10);
  const [y, m] = key.split('-').map(Number);
  return d.getFullYear() === y && (d.getMonth() + 1) === m;
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
  document.getElementById('archiveTotalMiles').innerText = `+${fmtNum(Math.round(totalMiles))} mi`;
  document.getElementById('archiveBlendedMpd').innerText = `${blendedMpd} blended mpd`;

  // Month view: deltas vs last month and the monthly summary. Full-year view has neither.
  const summaryEl = document.getElementById('monthlySummary');
  if (summaryEl) {
    summaryEl.innerHTML = isFullYear ? '' : monthlySummaryHtml(targetYear, targetMonth, (c, y, m) => getStatementCycleForMonth(c, y, m).spent);
  }
  if (!isFullYear) {
    const dt = deltaText(monthDeltas(targetYear, targetMonth));
    // Spend going up or down is neutral; miles and mpd are green when up, amber when down.
    const add = (id, txt, neutral) => {
      if (!txt) return;
      const cls = neutral ? 'ms-delta neutral' : (txt.startsWith('▼') ? 'ms-delta down' : 'ms-delta');
      document.getElementById(id).innerHTML += `<span class="${cls}">${escapeHtml(txt)}</span>`;
    };
    const esc = (id) => { const el = document.getElementById(id); el.innerHTML = escapeHtml(el.innerText); };
    ['archiveTxnCount', 'archiveTotalMiles', 'archiveBlendedMpd'].forEach(esc);
    add('archiveTxnCount', dt.spent, true);
    add('archiveTotalMiles', dt.miles);
    add('archiveBlendedMpd', dt.mpd);
  }

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
          ? `<span style="color:var(--accent); font-weight:700;">✅ S$1k Min Spend Met ($${fmtNum(stmt.spent, 0)})</span>` 
          : `<span style="color:var(--danger); font-weight:700;">⚠️ Min Spend Missed ($${fmtNum(stmt.spent, 0)} / $1,000)</span>`;
      } else {
        statusBadge = `<span>Bill Window: $${fmtNum(stmt.spent, 0)} / $${fmtAuto(card.monthlyCap)}</span>`;
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
          <span style="font-size:0.85rem; font-weight:700; color:#fff;">${escapeHtml(cardShort(card))}</span>
          <span style="font-size:0.85rem; font-weight:700; color:var(--accent);">+${fmtNum(item.miles)} mi</span>
        </div>
        <div class="progress-bar-bg" style="height:5px;">
          <div class="progress-bar-fill" style="width:${capPct}%; background:${capPct >= 100 && !isUncapped ? 'var(--danger)' : 'var(--primary)'};"></div>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:0.72rem; color:#94a3b8;">
          <span>Charged $${fmtNum(item.spent, 2)} ${isUncapped ? '(Uncapped)' : `(Cap: $${fmtAuto(cumulativeCap)} • ${capPct}%)`}</span>
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
  renderCardWallet();   // card rows, with the per-card inputs inside them

  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };
  setVal('uobLsRenewalInput', state.uobRenewals.solitaire);
  setVal('uobVsRenewalInput', state.uobRenewals.visaSig);
  setVal('uobPpvRenewalInput', state.uobRenewals.ppv);
  setVal('uobPrviRenewalInput', state.uobRenewals.prvi);
  setVal('kfUobRenewalInput', state.uobRenewals.kf);
  setVal('citiApprovalInput', state.citiApprovalDate);
  setVal('uobStatementDayInput', state.uobStatementDay);
  const vs = ALL_MASTER_CARDS.find(c => c.id.startsWith('uob-vs'));
  const citi = ALL_MASTER_CARDS.find(c => c.id === 'citi-rewards');
  setVal('uobVsCutoff', vs?.cutoffDay ?? 18);
  setVal('citiCutoff', citi?.cutoffDay ?? 15);
  for (const f of feeCardFamilies()) {
    setVal(feeRenewalId(f.key), state.feeCards?.[f.key]?.renewal);
    setVal(feeDayId(f.key), state.feeCards?.[f.key]?.day);
  }
  prepareSettingsSheet();

  document.getElementById('settingsOverlay')?.classList.add('open');
}

export function closeSettingsModal() {
  document.getElementById('settingsOverlay')?.classList.remove('open');
}

// Reads the per-card fee alert inputs (non-UOB cards). A card with no renewal month has no entry.
function collectFeeCards() {
  const out = {};
  for (const f of feeCardFamilies()) {
    const renewal = document.getElementById(feeRenewalId(f.key))?.value || '';
    if (!/^\d{4}-\d{2}$/.test(renewal)) continue;
    const day = parseInt(document.getElementById(feeDayId(f.key))?.value, 10);
    out[f.key] = { renewal, ...(Number.isFinite(day) ? { day: Math.min(31, Math.max(1, day)) } : {}) };
  }
  return out;
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
    uobStatementDay: clampDay(val('uobStatementDayInput'), state.uobStatementDay || 23),
    feeAlerts: state.feeAlerts || {},   // keep dismissals: this write replaces the whole settings document
    feeCards: collectFeeCards(),
    stmtCoverage: state.stmtCoverage || {},
    uobRenewals: {
      solitaire: val('uobLsRenewalInput') || state.uobRenewals.solitaire,
      visaSig: val('uobVsRenewalInput') || state.uobRenewals.visaSig,
      ppv: val('uobPpvRenewalInput') || state.uobRenewals.ppv,
      prvi: val('uobPrviRenewalInput') || state.uobRenewals.prvi,
      kf: val('kfUobRenewalInput') || state.uobRenewals.kf || ''
    },
    cutoffDays: {
      uobVs: clampDay(val('uobVsCutoff'), 18),
      citi: clampDay(val('citiCutoff'), 15)
    }
  };

  const btn = document.getElementById('btnSaveSettings');
  const btnHtml = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerText = 'Saving...'; }
  try {
    // The Firestore settings listener applies these values and re-renders.
    await updateSettingsDoc(state.myVaultKey, payload);
    closeSettingsModal();
  } catch (e) {
    console.error('Save settings failed:', e);
    alert('Could not save settings: ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = btnHtml; }
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
      feeCards: state.feeCards || {},
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
    feeCards: s.feeCards && typeof s.feeCards === 'object' ? s.feeCards : null,
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
      state.myVault = normalizeVault({ ...state.myVault, ...balances });
      await updateVaultDoc(state.myVaultKey, state.myVault);
    }
    const payload = {
      enabledCards: settings.enabledCards?.length ? settings.enabledCards : state.enabledCardIds,
      citiApprovalDate: settings.citiApprovalDate || state.citiApprovalDate,
      uobRenewals: { ...state.uobRenewals, ...(settings.uobRenewals || {}) },
      uobStatementDay: state.uobStatementDay || 23,
      feeAlerts: state.feeAlerts || {},
      feeCards: settings.feeCards || state.feeCards || {},
      stmtCoverage: state.stmtCoverage || {},
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
    cardSelect.innerHTML += `<option value="${c.id}">${escapeHtml(cardShort(c))}</option>`;
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
    const txDate = new Date(countsTs(tx, card));
    return txDate >= cycleInfo.windowStart && txDate <= cycleInfo.windowEnd;
  });

  const loggedSpend = activeTxns.reduce((sum, t) => sum + (Number(t.amt) || 0), 0);
  document.getElementById('reconcileAppSpend').innerText = `$${fmtNum(loggedSpend, 2)}`;
  document.getElementById('reconcileTxnCount').innerText = `${activeTxns.length} txns logged`;

  updateReconcileDelta(loggedSpend);

  const listEl = document.getElementById('reconcileTxnList');
  if (!listEl) return;
  listEl.innerHTML = '';

  if (activeTxns.length === 0) {
    listEl.innerHTML = `<div class="detail-tx-empty" style="padding:10px;">No charges logged on ${escapeHtml(cardShort(card))} for this billing window.</div>`;
  } else {
    activeTxns.slice().reverse().forEach(tx => {
      listEl.innerHTML += `
        <div class="tx-item" style="padding:6px 10px; background:rgba(0,0,0,0.25); font-size:0.75rem;">
          <div style="flex:1; min-width:0; padding-right:6px;">
            <div class="tx-desc" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${tx.desc}</div>
            <div class="tx-meta" style="font-size:0.68rem;">${tx.date}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-weight:700;">$${fmtNum(Number(tx.amt || 0), 2)}</div>
            <div style="color:var(--accent); font-size:0.68rem;">+${fmtNum(tx.miles)} mi</div>
          </div>
        </div>
      `;
    });
  }

  const vaultObj = state.myVault[card.vaultKey];
  document.getElementById('reconcileVaultLabel').innerText = `${vaultObj?.name || 'Points'} Balance`;
  document.getElementById('reconcileVaultPtsDisplay').innerText = `${fmtNum(Number(vaultObj?.points || 0))} ${vaultObj?.unit || 'pts'}`;
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
    deltaBadge.innerText = `⚠️ -$${fmtNum(Math.abs(diff), 2)} (Missing from app)`;
    deltaBadge.style.color = 'var(--danger)';
  } else {
    deltaBadge.innerText = `⚠️ +$${fmtNum(diff, 2)} (Over-logged in app)`;
    deltaBadge.style.color = 'var(--warning)';
  }
}

export function switchTab(tabName) {
  if (window.innerWidth >= 900) {
    // Desktop: History is its own page, shown only on request.
    const on = tabName === 'history';
    document.body.classList.toggle('show-history', on);
    document.getElementById('btnHeaderHistory')?.classList.toggle('active', on);
    if (on) window.scrollTo({ top: 0 });
    return;
  }
  const tabs = {
    cards: ['tabContentCards', 'btnTabCards'],
    category: ['tabContentCategory', 'btnTabCategory'],
    vault: ['tabContentVault', 'btnTabVault'],
    history: ['tabContentHistory', 'btnTabHistory']
  };
  const target = tabs[tabName] ? tabName : 'vault';
  Object.entries(tabs).forEach(([name, [contentId, btnId]]) => {
    const el = document.getElementById(contentId);
    const btn = document.getElementById(btnId);
    if (el) el.style.display = name === target ? 'flex' : 'none';
    btn?.classList.toggle('active', name === target);
  });
}
