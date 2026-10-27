import { firebaseConfig, DEFAULT_VAULT, VAULT_REGISTRY } from "./config.js";
import { state } from "./state.js";
import { 
  renderCards, 
  renderTransactions, 
  renderVaultBalances, 
  renderExpiryRadar, 
  renderTravelGoalBanner, 
  renderFamilyVaultsSection,
  checkUobFeeDefense 
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

export async function initFirebase(onAuthSuccess, onAuthLoggedOut) {
  if (!window.firebase || !window.firebase.auth || !window.firebase.firestore) {
    setTimeout(() => initFirebase(onAuthSuccess, onAuthLoggedOut), 50);
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

      if (!state.myVault) {
        state.myVault = JSON.parse(JSON.stringify(DEFAULT_VAULT));
      }

      await subscribeToMyVaultData();

      if (state.isAdmin) {
        subscribeToExtendedFamilyVaults();
      } else {
        const familySec = document.getElementById('familyVaultsSection');
        if (familySec) familySec.style.display = 'none';
      }

      updateSyncIndicator(true);
      if (typeof onAuthSuccess === 'function') {
        onAuthSuccess(user);
      }
    } else {
      state.currentUser = null;
      unsubscribeAllListeners();
      updateSyncIndicator(false);
      if (typeof onAuthLoggedOut === 'function') {
        onAuthLoggedOut();
      }
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

  const vaultRef = db.collection("milestrack_vaults").doc(state.myVaultKey);
  unsubVault = vaultRef.onSnapshot(doc => {
    if (doc.exists) {
      const data = doc.data();
      const loadedBalances = data.balances || {};
      
      const merged = JSON.parse(JSON.stringify(DEFAULT_VAULT));
      Object.keys(merged).forEach(k => {
        if (loadedBalances[k] !== undefined) {
          if (typeof loadedBalances[k] === 'object' && loadedBalances[k] !== null) {
            merged[k] = { ...merged[k], ...loadedBalances[k] };
          } else {
            merged[k].points = Number(loadedBalances[k]) || 0;
          }
        }
      });

      state.vault = merged;
      state.myVault = merged;

      if (data.settings) state.settings = { ...state.settings, ...data.settings };
      if (data.enabledCardIds) state.enabledCardIds = data.enabledCardIds;
    } else {
      vaultRef.set({
        balances: DEFAULT_VAULT,
        settings: state.settings,
        enabledCardIds: state.enabledCardIds,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      state.myVault = JSON.parse(JSON.stringify(DEFAULT_VAULT));
      state.vault = JSON.parse(JSON.stringify(DEFAULT_VAULT));
    }

    window.dispatchEvent(new CustomEvent('vault-updated'));
    window.dispatchEvent(new CustomEvent('settings-updated'));
  });

  unsubTxns = db.collection("milestrack_txns")
    .where("owner", "==", state.myVaultKey)
    .orderBy("date", "desc")
    .onSnapshot(snapshot => {
      state.transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      recalculateCardSpends();
      window.dispatchEvent(new CustomEvent('txns-updated'));
    }, err => {
      console.warn("Txn listener index fallback:", err);
      db.collection("milestrack_txns")
        .where("owner", "==", state.myVaultKey)
        .onSnapshot(s => {
          state.transactions = s.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
          recalculateCardSpends();
          window.dispatchEvent(new CustomEvent('txns-updated'));
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
        if (key === 'sister') {
          state.peerVault = doc.data().balances || {};
        }
      } else {
        state.peerVaults[key] = {};
        if (key === 'sister') {
          state.peerVault = {};
        }
      }
      window.dispatchEvent(new CustomEvent('peer-vault-updated'));
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

export async function updateVaultDoc(vaultKey, vaultBalances) {
  if (!db) db = firebase.firestore();
  await db.collection("milestrack_vaults").doc(vaultKey).set({
    balances: vaultBalances,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}

export async function saveVaultBalances(newBalances) {
  await updateVaultDoc(state.myVaultKey, newBalances);
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
        ? (state.settings?.uobVsCutoff || 18) 
        : (state.settings?.citiCutoff || 15);

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