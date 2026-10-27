import { APP_VERSION, ALL_MASTER_CARDS } from "./config.js";
import { state } from "./state.js";
import { 
  initFirebase, 
  loginWithGoogle, 
  logoutUser, 
  updateVaultDoc 
} from "./firebase.js";
import { 
  runRecommendation, 
  updateShellNettCalc 
} from "./recommender.js";
import { 
  renderPresets, 
  renderCards, 
  renderVault, 
  renderCategoryTracker, 
  renderTransactions, 
  renderSisterVaultModal,
  renderExpiryRadar,
  checkUobFeeDefense,
  renderReconcileView,
  renderArchiveData,
  exportArchiveMonthCSV,
  updateReconcileDelta,
  openModal,
  closeModal,
  closeCardDetailModal,
  openSisterVaultModal,
  closeSisterVaultModal,
  openArchiveModal,
  closeArchiveModal,
  openReconcileModal,
  closeReconcileModal,
  saveTransaction,
  onCardSelectChange,
  onYuuMerchantChange,
  checkShellMerchantTrigger,
  switchTab
} from "./ui.js";

// Initialize Version Tags
const authVer = document.getElementById("authVersionTag");
const headerVer = document.getElementById("headerVersionTag");
if (authVer) authVer.innerText = APP_VERSION;
if (headerVer) headerVer.innerText = APP_VERSION;

// Auth Callbacks
function onAuthSuccess(user) {
  const authOverlay = document.getElementById('authOverlay');
  const mainApp = document.getElementById('mainApp');
  const fabButton = document.getElementById('fabButton');
  const syncIndicator = document.getElementById('syncStatusIndicator');
  const userDisplay = document.getElementById('signedInUserDisplay');

  if (authOverlay) authOverlay.style.display = 'none';
  if (mainApp) mainApp.style.display = 'block';
  if (fabButton) fabButton.style.display = 'flex';
  if (syncIndicator) syncIndicator.innerText = "● Cloud Connected";
  if (userDisplay) {
    userDisplay.innerText = `Signed in: ${user.email} (${state.vaultLabel || (state.myVaultKey === 'primary' ? 'Household' : 'Member')})`;
  }

  const peerCardTitle = document.getElementById('peerCardTitle');
  const peerModalTitle = document.getElementById('peerModalTitle');
  const warChestTitle = document.getElementById('warChestTitle');
  const cardBonusTitle = document.getElementById('cardBonusTitle');
  const vaultSectionTitle = document.getElementById('vaultSectionTitle');

  if (state.myVaultKey === "sister" || !state.isAdmin) {
    if (peerCardTitle) peerCardTitle.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">family_restroom</span> Household Vault (Brother)';
    if (peerModalTitle) peerModalTitle.innerText = "Household Points Vault (Brother)";
    if (warChestTitle) warChestTitle.innerText = "My Personal Mileage War Chest";
    if (cardBonusTitle) cardBonusTitle.innerText = "My Monthly Bonus Caps";
    if (vaultSectionTitle) vaultSectionTitle.innerText = "My Bank Points Vault";
  } else {
    if (peerCardTitle) peerCardTitle.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">family_restroom</span> Extended Family Vaults';
    if (peerModalTitle) peerModalTitle.innerText = "Extended Family Vaults";
    if (warChestTitle) warChestTitle.innerText = "Household Mileage War Chest";
    if (cardBonusTitle) cardBonusTitle.innerText = "Household Monthly Bonus Caps";
    if (vaultSectionTitle) vaultSectionTitle.innerText = "Household Bank Points Vault";
  }

  renderPresets();
  renderCards();
  renderVault();
  renderCategoryTracker();
}

function onAuthLoggedOut() {
  const authOverlay = document.getElementById('authOverlay');
  const mainApp = document.getElementById('mainApp');
  const fabButton = document.getElementById('fabButton');

  if (authOverlay) authOverlay.style.display = 'flex';
  if (mainApp) mainApp.style.display = 'none';
  if (fabButton) fabButton.style.display = 'none';
}

// React to Firestore Event Signals
window.addEventListener('vault-updated', () => {
  renderVault();
  renderCards();
});

window.addEventListener('peer-vault-updated', () => {
  renderSisterVaultModal();
});

window.addEventListener('settings-updated', () => {
  renderCards();
  renderCategoryTracker();
  renderExpiryRadar();
  checkUobFeeDefense();
});

window.addEventListener('txns-updated', () => {
  renderCards();
  renderCategoryTracker();
  renderTransactions();
});

// Boot Firebase
initFirebase(onAuthSuccess, onAuthLoggedOut);

// Event Listeners Wiring
document.getElementById('btnLoginGoogle')?.addEventListener('click', loginWithGoogle);
document.getElementById('btnHeaderLogout')?.addEventListener('click', logoutUser);

document.getElementById('btnHeaderVault')?.addEventListener('click', () => {
  const vSource = state.myVault || state.vault || {};
  const setVal = (id, key) => {
    const el = document.getElementById(id);
    if (el) el.value = vSource[key]?.points ?? vSource[key] ?? 0;
  };

  setVal('v_uob_uni', 'uob_uni');
  setVal('v_citi_typ', 'citi_typ');
  setVal('v_citi_miles', 'citi_miles');
  setVal('v_dbs_pts', 'dbs_pts');
  setVal('v_yuu_pts', 'yuu_pts');
  setVal('v_ocbc_pts', 'ocbc_pts');
  setVal('v_hsbc_pts', 'hsbc_pts');
  setVal('v_mb_treats', 'mb_treats');
  setVal('v_kf_miles', 'kf_direct');

  const overlay = document.getElementById('vaultOverlay');
  if (overlay) overlay.style.display = 'flex';
});

document.getElementById('btnSaveVaultBalances')?.addEventListener('click', async () => {
  if (!state.myVault) state.myVault = {};
  
  const readVal = (id) => parseFloat(document.getElementById(id)?.value) || 0;
  
  const updatedVault = {
    ...state.myVault,
    uob_uni: { ...(state.myVault.uob_uni || {}), points: readVal('v_uob_uni') },
    citi_typ: { ...(state.myVault.citi_typ || {}), points: readVal('v_citi_typ') },
    citi_miles: { ...(state.myVault.citi_miles || {}), points: readVal('v_citi_miles') },
    dbs_pts: { ...(state.myVault.dbs_pts || {}), points: readVal('v_dbs_pts') },
    yuu_pts: { ...(state.myVault.yuu_pts || {}), points: readVal('v_yuu_pts') },
    ocbc_pts: { ...(state.myVault.ocbc_pts || {}), points: readVal('v_ocbc_pts') },
    hsbc_pts: { ...(state.myVault.hsbc_pts || {}), points: readVal('v_hsbc_pts') },
    mb_treats: { ...(state.myVault.mb_treats || {}), points: readVal('v_mb_treats') },
    kf_direct: { ...(state.myVault.kf_direct || {}), points: readVal('v_kf_miles') }
  };

  state.myVault = updatedVault;
  state.vault = updatedVault;

  await updateVaultDoc(state.myVaultKey, updatedVault);
  
  const overlay = document.getElementById('vaultOverlay');
  if (overlay) overlay.style.display = 'none';
  renderVault();
});

document.getElementById('btnOpenPeerVault')?.addEventListener('click', openSisterVaultModal);
document.getElementById('btnOpenVaultBalances')?.addEventListener('click', () => document.getElementById('btnHeaderVault')?.click());
document.getElementById('btnSummaryUpdateVault')?.addEventListener('click', () => document.getElementById('btnHeaderVault')?.click());

document.getElementById('btnTabCards')?.addEventListener('click', () => switchTab('cards'));
document.getElementById('btnTabCategory')?.addEventListener('click', () => switchTab('category'));
document.getElementById('btnTabVault')?.addEventListener('click', () => switchTab('vault'));

document.getElementById('fabButton')?.addEventListener('click', openModal);
document.getElementById('btnCloseModal')?.addEventListener('click', closeModal);
document.getElementById('btnCloseCardDetail')?.addEventListener('click', closeCardDetailModal);
document.getElementById('btnCloseSisterVault')?.addEventListener('click', closeSisterVaultModal);
document.getElementById('btnCloseVault')?.addEventListener('click', () => {
  const overlay = document.getElementById('vaultOverlay');
  if (overlay) overlay.style.display = 'none';
});
document.getElementById('btnCloseSettings')?.addEventListener('click', () => {
  const overlay = document.getElementById('settingsOverlay');
  if (overlay) overlay.style.display = 'none';
});

document.getElementById('btnSaveLedger')?.addEventListener('click', saveTransaction);

document.getElementById('overseasSwitch')?.addEventListener('change', (e) => {
  state.isOverseasMode = e.target.checked;
  const bar = document.getElementById('overseasBar');
  const text = document.getElementById('overseasText');
  if (state.isOverseasMode) {
    bar?.classList.add('active');
    if (text) text.innerHTML = '<span style="color:var(--fcy-cyan);">✈️ Mode: Overseas Travel (FCY Spend)</span>';
  } else {
    bar?.classList.remove('active');
    if (text) text.innerText = 'Mode: Singapore (Local SGD)';
  }
  runRecommendation();
});

document.getElementById('krisPlusSwitch')?.addEventListener('change', (e) => {
  state.isKrisPlusMode = e.target.checked;
  state.currentChannel = state.isKrisPlusMode ? 'online' : 'inperson';
  document.getElementById('btnChannelOnline')?.classList.toggle('active', state.isKrisPlusMode);
  document.getElementById('btnChannelInPerson')?.classList.toggle('active', !state.isKrisPlusMode);
  const row = document.getElementById('contactlessPrefRow');
  if (row) row.style.display = state.isKrisPlusMode ? 'none' : 'flex';
  runRecommendation();
});

document.getElementById('singleSwipeSwitch')?.addEventListener('change', (e) => {
  state.isSingleSwipeMode = e.target.checked;
  runRecommendation();
});

document.getElementById('btnChannelInPerson')?.addEventListener('click', () => {
  state.currentChannel = 'inperson';
  document.getElementById('btnChannelInPerson')?.classList.add('active');
  document.getElementById('btnChannelOnline')?.classList.remove('active');
  if (!state.isKrisPlusMode) {
    const row = document.getElementById('contactlessPrefRow');
    if (row) row.style.display = 'flex';
  }
  runRecommendation();
});

document.getElementById('btnChannelOnline')?.addEventListener('click', () => {
  state.currentChannel = 'online';
  document.getElementById('btnChannelOnline')?.classList.add('active');
  document.getElementById('btnChannelInPerson')?.classList.remove('active');
  const row = document.getElementById('contactlessPrefRow');
  if (row) row.style.display = 'none';
  runRecommendation();
});

document.getElementById('mccInput')?.addEventListener('input', (e) => {
  const clearBtn = document.getElementById('btnClearMcc');
  if (clearBtn) clearBtn.style.display = e.target.value.trim() ? 'flex' : 'none';
  runRecommendation();
});

document.getElementById('btnClearMcc')?.addEventListener('click', () => {
  const input = document.getElementById('mccInput');
  if (input) {
    input.value = '';
    const btn = document.getElementById('btnClearMcc');
    if (btn) btn.style.display = 'none';
    input.focus();
    runRecommendation();
  }
});

document.getElementById('recAmount')?.addEventListener('input', runRecommendation);
document.getElementById('contactlessSwitch')?.addEventListener('change', runRecommendation);
document.getElementById('cardSelect')?.addEventListener('change', onCardSelectChange);
document.getElementById('yuuMerchantSelect')?.addEventListener('change', onYuuMerchantChange);
document.getElementById('descInput')?.addEventListener('input', checkShellMerchantTrigger);
document.getElementById('shellGrossInput')?.addEventListener('input', updateShellNettCalc);

document.getElementById('btnApplyShellDiscount')?.addEventListener('click', () => {
  const gross = parseFloat(document.getElementById('shellGrossInput')?.value) || 0;
  if (gross > 0) {
    const amtEl = document.getElementById('amtInput');
    if (amtEl) amtEl.value = (gross * 0.86).toFixed(2);
  }
});

// Transaction Search Listeners
document.getElementById('txSearchInput')?.addEventListener('input', (e) => {
  state.txSearchQuery = e.target.value;
  const clearBtn = document.getElementById('btnClearTxSearch');
  if (clearBtn) clearBtn.style.display = state.txSearchQuery.trim() ? 'flex' : 'none';
  renderTransactions();
});

document.getElementById('btnClearTxSearch')?.addEventListener('click', () => {
  const input = document.getElementById('txSearchInput');
  if (input) {
    input.value = '';
    state.txSearchQuery = '';
    const btn = document.getElementById('btnClearTxSearch');
    if (btn) btn.style.display = 'none';
    input.focus();
    renderTransactions();
  }
});

document.getElementById('txFilterCardSelect')?.addEventListener('change', (e) => {
  state.txCardFilter = e.target.value;
  renderTransactions();
});

// Archive Modal Listeners
document.getElementById('btnOpenArchiveHistory')?.addEventListener('click', openArchiveModal);
document.getElementById('btnCloseArchiveModal')?.addEventListener('click', closeArchiveModal);
document.getElementById('archiveMonthSelect')?.addEventListener('change', renderArchiveData);
document.getElementById('btnExportArchiveCSV')?.addEventListener('click', exportArchiveMonthCSV);

// Reconciliation Modal Listeners
document.getElementById('btnHeaderReconcile')?.addEventListener('click', openReconcileModal);
document.getElementById('btnCloseReconcileModal')?.addEventListener('click', closeReconcileModal);
document.getElementById('reconcileCardSelect')?.addEventListener('change', renderReconcileView);
document.getElementById('reconcileCycleSelect')?.addEventListener('change', renderReconcileView);

document.getElementById('reconcileStmtInput')?.addEventListener('input', () => {
  const rawSpend = document.getElementById('reconcileAppSpend')?.innerText.replace('$', '');
  const appSpend = parseFloat(rawSpend) || 0;
  updateReconcileDelta(appSpend);
});

document.getElementById('btnReconcileQuickAdd')?.addEventListener('click', () => {
  const cardId = document.getElementById('reconcileCardSelect')?.value;
  closeReconcileModal();
  const select = document.getElementById('cardSelect');
  if (select) select.value = cardId;
  onCardSelectChange();
  openModal();
});

document.getElementById('btnReconcileUpdateVault')?.addEventListener('click', () => {
  const cardId = document.getElementById('reconcileCardSelect')?.value;
  const card = ALL_MASTER_CARDS.find(c => c.id === cardId);
  if (!card) return;

  const currentPts = state.myVault?.[card.vaultKey]?.points || 0;
  const newPtsStr = prompt(`Update ${state.myVault?.[card.vaultKey]?.name || card.vaultKey} balance from statement:`, currentPts);
  if (newPtsStr !== null && !isNaN(parseFloat(newPtsStr))) {
    if (!state.myVault[card.vaultKey]) state.myVault[card.vaultKey] = {};
    state.myVault[card.vaultKey].points = parseFloat(newPtsStr);
    updateVaultDoc(state.myVaultKey, state.myVault);
    renderReconcileView();
    renderVault();
  }
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
    if (!refreshing && !sessionStorage.getItem('auth_in_progress')) {
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