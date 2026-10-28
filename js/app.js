import { APP_VERSION, ALL_MASTER_CARDS, VAULT_LABELS, normalizeVault } from "./config.js";
import { state } from "./state.js";
import { 
  initFirebase, 
  loginWithGoogle, 
  logoutUser, 
  updateVaultDoc 
} from "./firebase.js";
import { 
  runRecommendation
} from "./recommender.js";
import { initRetailerSuggest } from "./merchants.js";
import { initHeymax } from "./heymax.js";
import { initStatementImport } from "./statement-import.js";
import { initVaultGuard } from "./vault-guard.js";
import { initKrisPlusBrowser } from "./krisplus-browse.js";
import { initPostingUi } from "./posting-ui.js";
import { initSettingsUi } from "./settings-ui.js";
import { initSearchMode } from "./search-mode.js";
import { initLayoutReport } from "./layout-report.js";
import { 
  renderPresets, 
  renderCards, 
  renderVault, 
  renderCategoryTracker, 
  renderTransactions, 
  refreshHistory,
  renderAllVaultsTally,
  openSettingsModal,
  closeSettingsModal,
  saveSettings,
  exportJSONBackup,
  importJSONBackup,
  exportLedgerCSV,
  renderExpiryRadar,
  checkUobFeeDefense,
  renderReconcileView,
  renderArchiveData,
  exportArchiveMonthCSV,
  updateReconcileDelta,
  openModal,
  closeModal,
  closeCardDetailModal,
  openReconcileModal,
  closeReconcileModal,
  saveTransaction,
  onCardSelectChange,
  onYuuMerchantChange,
  switchTab
} from "./ui.js";

window.__milesBooted = true;   // tells the watchdog in index.html that the app started

// Initialize Version Tags
const authVer = document.getElementById("authVersionTag");
const headerVer = document.getElementById("headerVersionTag");
if (authVer) authVer.innerText = APP_VERSION;
if (headerVer) headerVer.innerText = APP_VERSION;

// Auth Callbacks
function onAuthSuccess(user) {
  document.getElementById('authOverlay').style.display = 'none';
  document.getElementById('mainApp').style.display = 'flex';
  document.getElementById('fabButton').style.display = 'flex';
  document.getElementById('syncStatusIndicator').innerText = "● Cloud Connected";
  document.getElementById('signedInUserDisplay').innerText = `Signed in: ${user.email} (${VAULT_LABELS[state.myVaultKey] || state.myVaultKey})`;

  // Household admin sees household titles; everyone else sees "My ..."
  const isHousehold = state.myVaultKey === "primary";
  document.getElementById('warChestTitle').innerText = isHousehold ? "Zhangs Total Miles" : "My Personal Mileage War Chest";
  document.getElementById('cardBonusTitle').innerText = isHousehold ? "Household Monthly Bonus Caps" : "My Monthly Bonus Caps";
  document.getElementById('vaultSectionTitle').innerText = isHousehold ? "Household Bank Points Vault" : "My Bank Points Vault";

  renderPresets();
  renderCards();
  renderVault();
  renderCategoryTracker();
}

function onAuthLoggedOut() {
  document.getElementById('authOverlay').style.display = 'flex';
  document.getElementById('mainApp').style.display = 'none';
  document.getElementById('fabButton').style.display = 'none';
}

// React to Firestore Event Signals
window.addEventListener('vault-updated', () => {
  renderVault();
  renderCards();
});

window.addEventListener('all-vaults-updated', renderAllVaultsTally);

window.addEventListener('merchants-updated', runRecommendation);
window.addEventListener('rules-updated', runRecommendation);

window.addEventListener('settings-updated', () => {
  renderCards();
  renderCategoryTracker();
  renderExpiryRadar();
  checkUobFeeDefense();
});

window.addEventListener('txns-updated', () => {
  renderCards();
  renderCategoryTracker();
  refreshHistory();
});

// Boot Firebase
initFirebase(onAuthSuccess, onAuthLoggedOut);

// Event Listeners Wiring
document.getElementById('btnLoginGoogle')?.addEventListener('click', loginWithGoogle);
document.getElementById('btnHeaderLogout')?.addEventListener('click', logoutUser);

const VAULT_FIELDS = {
  v_uob_uni: 'uob_uni', v_citi_typ: 'citi_typ', v_citi_miles: 'citi_miles', v_dbs_pts: 'dbs_pts',
  v_yuu_pts: 'yuu_pts', v_ocbc_pts: 'ocbc_pts', v_hsbc_pts: 'hsbc_pts', v_mb_treats: 'mb_treats', v_kf_miles: 'kf_direct'
};

document.getElementById('btnHeaderVault')?.addEventListener('click', () => {
  state.myVault = normalizeVault(state.myVault);
  for (const [id, key] of Object.entries(VAULT_FIELDS)) {
    const el = document.getElementById(id);
    if (!el) continue;
    const pts = state.myVault[key]?.points || 0;
    el.value = pts ? pts : '';      // blank (placeholder 0) so typing replaces the zero instead of appending
    el.placeholder = '0';
    el.min = '0';
    el.step = 'any';
  }
  document.getElementById('vaultOverlay')?.classList.add('open');
});

// Select the whole value on focus so a typed balance replaces what was there
document.querySelectorAll('#vaultOverlay input[type="number"]').forEach(el =>
  el.addEventListener('focus', () => el.select()));

document.getElementById('btnSaveVaultBalances')?.addEventListener('click', async () => {
  const btn = document.getElementById('btnSaveVaultBalances');
  const next = normalizeVault(state.myVault);
  for (const [id, key] of Object.entries(VAULT_FIELDS)) {
    const v = parseFloat(document.getElementById(id)?.value);
    next[key].points = Number.isFinite(v) && v >= 0 ? v : 0;
  }
  const prev = state.myVault;
  state.myVault = next;
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  try {
    await updateVaultDoc(state.myVaultKey, next);
    renderVault();
    renderCards();
    document.getElementById('vaultOverlay')?.classList.remove('open');
  } catch (err) {
    console.error('Vault save failed', err);
    state.myVault = prev;           // roll back
    alert('Could not save balances: ' + (err?.message || err));
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Save to Vault'; }
  }
});

document.getElementById('btnOpenVaultBalances')?.addEventListener('click', () => document.getElementById('btnHeaderVault')?.click());
document.getElementById('btnSummaryUpdateVault')?.addEventListener('click', () => document.getElementById('btnHeaderVault')?.click());

document.getElementById('btnTabCards')?.addEventListener('click', () => switchTab('cards'));
document.getElementById('btnTabCategory')?.addEventListener('click', () => switchTab('category'));
document.getElementById('btnTabVault')?.addEventListener('click', () => switchTab('vault'));
document.getElementById('btnTabHistory')?.addEventListener('click', () => switchTab('history'));

document.getElementById('fabButton')?.addEventListener('click', openModal);
document.getElementById('btnCloseModal')?.addEventListener('click', closeModal);
document.getElementById('btnCloseCardDetail')?.addEventListener('click', closeCardDetailModal);
document.getElementById('btnCloseVault')?.addEventListener('click', () => document.getElementById('vaultOverlay')?.classList.remove('open'));
document.getElementById('btnHeaderSettings')?.addEventListener('click', openSettingsModal);
document.getElementById('btnOpenExpirySettings')?.addEventListener('click', openSettingsModal);
document.getElementById('btnCloseSettings')?.addEventListener('click', closeSettingsModal);
document.getElementById('btnSaveSettings')?.addEventListener('click', saveSettings);
document.getElementById('btnExportJSON')?.addEventListener('click', exportJSONBackup);
document.getElementById('btnExportCSV')?.addEventListener('click', exportLedgerCSV);
document.getElementById('btnImportJSON')?.addEventListener('click', () => document.getElementById('importFileInput')?.click());
document.getElementById('importFileInput')?.addEventListener('change', (e) => importJSONBackup(e.target.files[0]));
document.getElementById('settingsOverlay')?.addEventListener('click', (e) => {
  if (e.target.id === 'settingsOverlay') closeSettingsModal();
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
    document.getElementById('btnClearMcc').style.display = 'none';
    input.focus();
    runRecommendation();
  }
});

initRetailerSuggest();
initSearchMode();
initLayoutReport();
initHeymax();
initStatementImport();
initVaultGuard();
initKrisPlusBrowser();
initPostingUi();
initSettingsUi();
document.getElementById('recAmount')?.addEventListener('input', runRecommendation);
document.getElementById('contactlessSwitch')?.addEventListener('change', runRecommendation);
document.getElementById('cardSelect')?.addEventListener('change', onCardSelectChange);
document.getElementById('yuuMerchantSelect')?.addEventListener('change', onYuuMerchantChange);

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
    document.getElementById('btnClearTxSearch').style.display = 'none';
    input.focus();
    renderTransactions();
  }
});

document.getElementById('txFilterCardSelect')?.addEventListener('change', (e) => {
  state.txCardFilter = e.target.value;
  renderTransactions();
});

// Archive Modal Listeners
document.getElementById('btnOpenArchiveHistory')?.addEventListener('click', () => switchTab('history'));
document.getElementById('archiveMonthSelect')?.addEventListener('change', () => { renderArchiveData(); renderTransactions(); });
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

  const currentPts = state.myVault[card.vaultKey]?.points || 0;
  const newPtsStr = prompt(`Update ${state.myVault[card.vaultKey]?.name} balance from statement:`, currentPts);
  if (newPtsStr !== null && !isNaN(parseFloat(newPtsStr))) {
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

// Touch devices: hide the floating + while the on-screen keyboard is up so it does not cover the form or results (v1.26.0).
(function () {
  if (!window.matchMedia || !matchMedia("(pointer: coarse)").matches) return;
  const typing = el => el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
  document.addEventListener("focusin", e => { if (typing(e.target)) document.body.classList.add("kb-open"); });
  document.addEventListener("focusout", () => setTimeout(() => { if (!typing(document.activeElement)) document.body.classList.remove("kb-open"); }, 50));
})();

// Options (Kris+, contactless, single card) start folded on phones and open on wider screens (v1.27.0).
(function () {
  const d = document.getElementById("recOptions");
  if (d) d.open = !(window.matchMedia && matchMedia("(max-width: 700px)").matches);
})();
