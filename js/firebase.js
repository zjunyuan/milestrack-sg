import { firebaseConfig, DEFAULT_VAULT, VAULT_REGISTRY } from "./config.js";
import { state } from "./state.js";
import { 
  renderCards, 
  renderTransactions, 
  renderVaultBalances, 
  renderExpiryRadar, 
  renderTravelGoalBanner, 
  renderFamilyVaultsSection,
  updateUobFeeRenewalAlerts 
} from "./ui.js";

let app, auth, db;
let unsubTxns = null;
let unsubVault = null;
const unsubPeerVaults = {};

export function resolveVaultContext(email = "") {
  const clean = email.toLowerCase().trim();
  for (const [key, conf] of Object.entries(VAULT_REGISTRY)) {
    if (conf.emails.map(e => e.toLowerCase()).includes(clean)) {
      return {
        vaultKey: key,
        role: conf.role,
        label: conf.label
      };
    }
  }
  return {
    vaultKey: clean.replace(/[^a-zA-Z0-9]/g, "_"),
    role: "member",
    label: "Personal Vault"
  };
}

export async function initFirebase() {
  if (!window.firebase) {
    console.error("Firebase SDK script not loaded yet.");
    return;
  }

  if (!firebase.apps.length) {
    app = firebase.initializeApp(firebaseConfig);
  } else {
    app = firebase.app();
  }

  auth = firebase.auth();
  db = firebase.firestore();

  try {
    await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
  } catch (err) {
    console.warn("Could not enable local auth persistence:", err);
  }

  auth.onAuthStateChanged(async (user) => {
    if (user) {
      state.currentUser = user;
      const ctx = resolveVaultContext(user.email);
      state.myVaultKey = ctx.vaultKey;
      state.vaultLabel = ctx.label;
      state.isAdmin = (ctx.role === 'admin');

      const userDisplay = document.getElementById('signedInUserDisplay');
      if (userDisplay) {
        userDisplay.innerText = `Signed in: ${user.email} (${state.vaultLabel})`;
      }

      document.getElementById('authOverlay').style.display = 'none';
      document.getElementById('mainApp').style.display = 'block';
      document.getElementById('fabButton').style.display = 'flex';

      await subscribeToMyVaultData();
      if (state.isAdmin) {
        subscribeToExtendedFamilyVaults();
      } else {
        const familySec = document.getElementById('familyVaultsSection');
        if (familySec) familySec.style.display = 'none';
      }

      updateSyncIndicator(true);
    } else {
      state.currentUser = null;
      unsubscribeAllListeners();
      document.getElementById('authOverlay').style.display = 'flex';
      document.getElementById('mainApp').style.display = 'none';
      document.getElementById('fabButton').style.display = 'none';
      updateSyncIndicator(false);
    }
  });
}

export async function loginWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await auth.signInWithPopup(provider);
  } catch (err) {
    console.error("Google Auth Error:", err);
    alert("Sign-in failed: " + err.message);
  }
}

export async function logoutUser() {
  if (confirm("Sign out of MilesTrack SG?")) {
    await auth.signOut();
  }
}

export async function subscribeToMyVaultData() {
  unsubscribeAllListeners();

  // 1. Listen to active user's points vault
  const vaultRef = db.collection("milestrack_vaults").doc(state.myVaultKey);
  unsubVault = vaultRef.onSnapshot(doc => {
    if (doc.exists) {
      const data = doc.data();
      state.vault = { ...JSON.parse(JSON.stringify(DEFAULT_VAULT)), ...data.balances };
      if (data.settings) state.settings = { ...state.settings, ...data.settings };
      if (data.enabledCardIds) state.enabledCardIds = data.enabledCardIds;
    } else {
      vaultRef.set({
        balances: DEFAULT_VAULT,
        settings: state.settings,
        enabledCardIds: state.enabledCardIds,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }

    renderVaultBalances();
    renderExpiryRadar();
    renderTravelGoalBanner();
    updateUobFeeRenewalAlerts();
  });

  // 2. Listen to active user's transactions
  unsubTxns = db.collection("milestrack_txns")
    .where("owner", "==", state.myVaultKey)
    .orderBy("date", "desc")
    .onSnapshot(snapshot => {
      state.transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      recalculateCardSpends();
      renderCards();
      renderTransactions();
    }, err => {
      console.warn("Txn listener index requirement, fallback without sorting:", err);
      db.collection("milestrack_txns")
        .where("owner", "==", state.myVaultKey)
        .onSnapshot(s => {
          state.transactions = s.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
          recalculateCardSpends();
          renderCards();
          renderTransactions();
        });
    });
}

export function subscribeToExtendedFamilyVaults() {
  Object.keys(VAULT_REGISTRY).forEach(key => {
    if (key === 'primary') return;
    
    if (unsubPeerVaults[key]) unsubPeerVaults[key]();

    unsubPeerVaults[key] = db.collection("milestrack_vaults").doc(key).onSnapshot(doc => {
      if (doc.exists) {
        state.peerVaults[key] = doc.data().balances || {};
      } else {
        state.peerVaults[key] = {};
      }
      renderFamilyVaultsSection();
    });
  });
}

export function unsubscribeAllListeners() {
  if (unsubTxns) { unsubTxns(); unsubTxns = null; }
  if (unsubVault) { unsubVault(); unsubVault = null; }
  Object.keys(unsubPeerVaults).forEach(k => {
    if (unsubPeerVaults[k]) { unsubPeerVaults[k](); delete unsubPeerVaults[k]; }
  });
}

export async function saveVaultBalances(newBalances) {
  if (!state.currentUser) return;
  await db.collection("milestrack_vaults").doc(state.myVaultKey).set({
    balances: newBalances,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}

export async function saveAppSettings(newSettings, newEnabledCardIds) {
  if (!state.currentUser) return;
  await db.collection("milestrack_vaults").doc(state.myVaultKey).set({
    settings: newSettings,
    enabledCardIds: newEnabledCardIds,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}

export async function addTransaction(txn) {
  if (!state.currentUser) return;
  const payload = {
    ...txn,
    owner: state.myVaultKey,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  await db.collection("milestrack_txns").add(payload);
}

export async function updateTransaction(id, txn) {
  if (!state.currentUser) return;
  await db.collection("milestrack_txns").doc(id).update(txn);
}

export async function deleteTransaction(id) {
  if (!state.currentUser) return;
  await db.collection("milestrack_txns").doc(id).delete();
}

export function recalculateCardSpends() {
  state.cards.forEach(card => card.currentSpend = 0);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const today = now.getDate();

  state.transactions.forEach(tx => {
    const card = state.cards.find(c => c.id === tx.cardId);
    if (!card) return;

    const txDate = new Date(tx.date);
    if (isNaN(txDate.getTime())) return;

    let isInCycle = false;

    if (card.cycleType === 'calendar' || card.cycleType === 'monthly') {
      isInCycle = (txDate.getFullYear() === currentYear && txDate.getMonth() === currentMonth);
    } else if (card.cycleType === 'statement') {
      const cutoff = (card.id === 'uob-vs-contactless' || card.id === 'uob-vs-fcy') 
        ? (state.settings.uobVsCutoff || 18) 
        : (state.settings.citiCutoff || 15);

      let cycleStart, cycleEnd;
      if (today >= cutoff) {
        cycleStart = new Date(currentYear, currentMonth, cutoff);
        cycleEnd = new Date(currentYear, currentMonth + 1, cutoff - 1, 23, 59, 59);
      } else {
        cycleStart = new Date(currentYear, currentMonth - 1, cutoff);
        cycleEnd = new Date(currentYear, currentMonth, cutoff - 1, 23, 59, 59);
      }
      isInCycle = (txDate >= cycleStart && txDate <= cycleEnd);
    } else {
      isInCycle = (txDate.getFullYear() === currentYear && txDate.getMonth() === currentMonth);
    }

    if (isInCycle) {
      card.currentSpend += (parseFloat(tx.amount) || 0);
    }
  });
}

function updateSyncIndicator(connected) {
  const el = document.getElementById('syncStatusIndicator');
  if (!el) return;
  if (connected) {
    el.innerHTML = '● Cloud Connected';
    el.style.color = '#34d399';
  } else {
    el.innerHTML = '○ Offline / Not Logged In';
    el.style.color = '#94a3b8';
  }
}
