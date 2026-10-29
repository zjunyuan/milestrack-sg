import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  setPersistence,
  indexedDBLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  limit 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { 
  firebaseConfig, 
  PRIMARY_EMAILS, 
  SISTER_EMAILS, 
  ELLICE_EMAILS,
  EUGENE_EMAILS,
  TEST_EMAILS,
  ALL_VAULT_KEYS,
  DEFAULT_VAULT, 
  ALL_MASTER_CARDS,
  normalizeVault
} from "./config.js";
import { isKnownMcc, normalizeRule } from "./mcc.js";
import { state } from "./state.js";
import { isDemo, startDemo, demoSaveTx, demoDeleteTx, demoUpdateVault, demoSettings, demoMerchant, demoRule } from "./demo.js";

export let auth, db, googleProvider;

export function resolveVaultKey(email = "") {
  const clean = email.toLowerCase().trim();
  if (PRIMARY_EMAILS.includes(clean)) return "primary";
  if (SISTER_EMAILS.includes(clean)) return "sister";
  if (ELLICE_EMAILS.includes(clean)) return "ellice";
  if (EUGENE_EMAILS.includes(clean)) return "eugene";
  if (TEST_EMAILS.includes(clean)) return "test";
  return clean.replace(/[^a-zA-Z0-9]/g, "_");
}

export function initFirebase(onAuthSuccess, onAuthLoggedOut) {
  if (isDemo()) return startDemo(onAuthSuccess);   // sample data, no Firebase (js/demo.js)
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  googleProvider = new GoogleAuthProvider();

  setPersistence(auth, indexedDBLocalPersistence).catch(console.error);

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      state.currentUser = user;
      sessionStorage.removeItem('auth_in_progress');
      const resolvedKey = resolveVaultKey(user.email);
      state.myVaultKey = resolvedKey;
      state.userRole = ALL_VAULT_KEYS.includes(resolvedKey) ? resolvedKey.toUpperCase() : "GUEST";
      if (onAuthSuccess) onAuthSuccess(user);
      await checkAndMigrateSharedVault();
      subscribeToCloudData();
    } else {
      state.currentUser = null;
      if (onAuthLoggedOut) onAuthLoggedOut();
    }
  });
}

export async function loginWithGoogle() {
  const btn = document.getElementById('btnLoginGoogle');
  try {
    sessionStorage.setItem('auth_in_progress', '1');
    if (btn) {
      btn.disabled = true;
      btn.innerText = "Signing in...";
    }
    await setPersistence(auth, indexedDBLocalPersistence);
    await signInWithPopup(auth, googleProvider);
  } catch (e) {
    sessionStorage.removeItem('auth_in_progress');
    if (e.code !== 'auth/popup-closed-by-user') {
      alert(e.message);
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `
        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google logo">
        Sign in with Google
      `;
    }
  }
}

export async function logoutUser() {
  if (isDemo()) { location.href = location.pathname; return; }
  if (confirm("Sign out?")) {
    await signOut(auth);
  }
}

async function checkAndMigrateSharedVault() {
  if (state.myVaultKey !== "primary") return;
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
        state.myVault = normalizeVault(sharedSnap.data());
        await setDoc(primDocRef, state.myVault);
        window.dispatchEvent(new CustomEvent('vault-updated'));
      }
    }
  } catch (e) {
    console.warn("Migration notice:", e);
  }
}

export function subscribeToCloudData() {
  onSnapshot(doc(db, "milestrack_vaults", state.myVaultKey), (docSnap) => {
    const fromCache = !!docSnap.metadata?.fromCache;
    if (docSnap.exists()) {
      state.myVault = normalizeVault(docSnap.data());
      if (!fromCache) state.vaultLoaded = true;
      window.dispatchEvent(new CustomEvent('vault-updated'));
    } else if (!fromCache) {
      // Only a read confirmed by the server may say "no vault yet". A cache-only or offline read that finds nothing must never create a
      // blank vault: that write would later reach the server and wipe real balances.
      state.vaultLoaded = true;
      setDoc(doc(db, "milestrack_vaults", state.myVaultKey), DEFAULT_VAULT);
    }
  }, (err) => console.error("My vault error:", err));

  // Household admin: live-listen to every vault for the all-vaults tally.
  if (state.userRole === "PRIMARY") {
    ALL_VAULT_KEYS.forEach((key) => {
      onSnapshot(doc(db, "milestrack_vaults", key), (docSnap) => {
        state.allVaultsData[key] = docSnap.exists()
          ? normalizeVault(docSnap.data())
          : normalizeVault({});
        window.dispatchEvent(new CustomEvent('all-vaults-updated'));
      }, (err) => console.error(`Vault ${key} listener error:`, err));
    });
  }

  onSnapshot(doc(db, "milestrack_settings", state.myVaultKey), (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.citiApprovalDate) state.citiApprovalDate = data.citiApprovalDate;
      if (data.uobRenewals) state.uobRenewals = { ...state.uobRenewals, ...data.uobRenewals };
      if (Number.isFinite(Number(data.uobStatementDay)) && Number(data.uobStatementDay) >= 1) state.uobStatementDay = Math.min(31, Number(data.uobStatementDay));
      state.feeCards = (data.feeCards && typeof data.feeCards === 'object') ? data.feeCards : {};
      state.feeAlerts = (data.feeAlerts && typeof data.feeAlerts === 'object') ? data.feeAlerts : {};
      if (data.enabledCards && Array.isArray(data.enabledCards)) {
        state.enabledCardIds = data.enabledCards;
      }
      if (data.cutoffDays) {
        ALL_MASTER_CARDS.forEach(c => {
          if (c.id.startsWith('uob-vs')) c.cutoffDay = data.cutoffDays.uobVs || 18;
          if (c.id === 'citi-rewards') c.cutoffDay = data.cutoffDays.citi || 15;
        });
      }
      state.cards = ALL_MASTER_CARDS.filter(c => state.enabledCardIds.includes(c.id));
      window.dispatchEvent(new CustomEvent('settings-updated'));
    }
  });

  // Household-shared merchant corrections (brand -> MCC)
  onSnapshot(collection(db, "milestrack_merchants"), (snap) => {
    const next = {};
    snap.forEach((d) => {
      const v = d.data() || {};
      if (typeof v.name === "string" && v.name && isKnownMcc(v.mcc)) {
        next[d.id] = { name: v.name, mcc: v.mcc, aliases: Array.isArray(v.aliases) ? v.aliases.filter(a => typeof a === "string") : [] };
      }
    });
    state.merchantOverrides = next;
    window.dispatchEvent(new CustomEvent('merchants-updated'));
  }, (err) => console.error("Merchants listener error:", err));

  // Household card rules per MCC category (everyone reads; only the admin writes)
  onSnapshot(collection(db, "milestrack_mccRules"), (snap) => {
    const next = {};
    snap.forEach((d) => {
      const rule = normalizeRule({ ...d.data(), mcc: d.id });
      if (rule) next[d.id] = rule;
    });
    state.mccRules = next;
    window.dispatchEvent(new CustomEvent('rules-updated'));
  }, (err) => console.error("MCC rules listener error:", err));

  const txQuery = query(
    collection(db, "milestrack_txns"), 
    where("owner", "==", state.myVaultKey),
    limit(1000)
  );
  
  onSnapshot(txQuery, (querySnapshot) => {
    state.transactions = [];
    querySnapshot.forEach((d) => {
      state.transactions.push({ ...d.data(), firestoreId: d.id });
    });
    state.transactions.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    window.dispatchEvent(new CustomEvent('txns-updated'));
  }, (err) => {
    console.error("Transactions snapshot listener error:", err);
  });
}

export async function saveTxToFirestore(txRecordId, payload) {
  if (isDemo()) return demoSaveTx(txRecordId, payload);
  await setDoc(doc(db, "milestrack_txns", txRecordId), payload);
}

export async function deleteTxFromFirestore(firestoreDocId) {
  if (isDemo()) return demoDeleteTx(firestoreDocId);
  await deleteDoc(doc(db, "milestrack_txns", firestoreDocId));
}

export async function updateVaultDoc(targetVaultKey, vaultPayload) {
  if (isDemo()) return demoUpdateVault(targetVaultKey, vaultPayload);
  // Writing the whole vault from a copy that was never confirmed by the server could overwrite real balances with blanks.
  if (targetVaultKey === state.myVaultKey && !state.vaultLoaded) throw new Error("Your balances have not finished loading from the cloud yet. Wait a moment and try again.");
  await setDoc(doc(db, "milestrack_vaults", targetVaultKey), vaultPayload);
}

export async function updateSettingsDoc(targetVaultKey, settingsPayload) {
  if (isDemo()) return demoSettings(targetVaultKey, settingsPayload);
  await setDoc(doc(db, "milestrack_settings", targetVaultKey), settingsPayload);
}

// Writes only the given fields, leaving the rest of the settings document alone (used for fee alert dismissals).
export async function mergeSettingsDoc(targetVaultKey, partial) {
  if (isDemo()) return demoSettings(targetVaultKey, partial);
  await setDoc(doc(db, "milestrack_settings", targetVaultKey), partial, { merge: true });
}

export async function saveMerchantOverride(slug, data) {
  if (isDemo()) return demoMerchant(slug, data);
  await setDoc(doc(db, "milestrack_merchants", slug), data);
}

export async function deleteMerchantOverride(slug) {
  if (isDemo()) return demoMerchant(slug, null);
  await deleteDoc(doc(db, "milestrack_merchants", slug));
}

export async function saveMccRule(code, data) {
  if (isDemo()) return demoRule(code, data);
  await setDoc(doc(db, "milestrack_mccRules", code), data);
}

export async function deleteMccRule(code) {
  if (isDemo()) return demoRule(code, null);
  await deleteDoc(doc(db, "milestrack_mccRules", code));
}
