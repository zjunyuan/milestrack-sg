import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
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
  ALL_VAULT_KEYS,
  VAULT_LABELS,
  DEFAULT_VAULT, 
  ALL_MASTER_CARDS,
  normalizeVault
} from "./config.js";
import { isKnownMcc, normalizeRule } from "./mcc.js";
import { state } from "./state.js";
import { isDemo, startDemo, demoSaveTx, demoDeleteTx, demoUpdateVault, demoSettings, demoMerchant, demoRule, demoPoints } from "./demo.js";

export let auth, db, googleProvider;

const ROLE_CACHE_KEY = "milestrack_role_cache";
const roleCache = () => { try { return JSON.parse(localStorage.getItem(ROLE_CACHE_KEY) || "{}"); } catch (_) { return {}; } };
const setRoleCache = (email, key) => { try { const c = roleCache(); if (key) c[email] = key; else delete c[email]; localStorage.setItem(ROLE_CACHE_KEY, JSON.stringify(c)); } catch (_) { /* optional */ } };
const guestKey = (email) => email.replace(/[^a-zA-Z0-9]/g, "_");

// Pure: which vault key does this email have in a roles document ({primary: [...], ...})? null when it is on no list.
export function roleFromDoc(email = "", data = {}) {
  const clean = email.toLowerCase().trim();
  for (const key of ALL_VAULT_KEYS) {
    const list = Array.isArray(data[key]) ? data[key] : [];
    if (list.some(e => String(e).toLowerCase().trim() === clean)) return key;
  }
  return null;
}

// Display names (Household, Sister, ...) come from the same document's `labels` map; the repo only has neutral placeholders.
const LABELS_CACHE_KEY = "milestrack_labels_cache";
function applyLabels(labels, remember) {
  if (!labels || typeof labels !== "object") return;
  const clean = {};
  for (const key of ALL_VAULT_KEYS) if (typeof labels[key] === "string" && labels[key].trim()) clean[key] = labels[key].trim().slice(0, 40);
  Object.assign(VAULT_LABELS, clean);
  if (remember) { try { localStorage.setItem(LABELS_CACHE_KEY, JSON.stringify(clean)); } catch (_) { /* optional */ } }
}
const cachedLabels = () => { try { return JSON.parse(localStorage.getItem(LABELS_CACHE_KEY) || "null"); } catch (_) { return null; } };

// The email lists live in Firestore (milestrack_config/roles), not in this public repo. The rules only let a listed member read that document,
// so a refusal means "not on any list" (guest). When the network is down the last role this device saw is used.
export async function resolveVaultKey(email = "") {
  const clean = email.toLowerCase().trim();
  try {
    const snap = await getDoc(doc(db, "milestrack_config", "roles"));
    if (!snap.exists()) { console.warn("milestrack_config/roles is missing: create it in the Firebase console."); return guestKey(clean); }
    const key = roleFromDoc(clean, snap.data());
    if (key) applyLabels(snap.data().labels, true);
    setRoleCache(clean, key);
    return key || guestKey(clean);
  } catch (e) {
    if (e && e.code === "permission-denied") { setRoleCache(clean, null); return guestKey(clean); }
    const cached = roleCache()[clean];
    if (cached) applyLabels(cachedLabels(), false);
    return cached || guestKey(clean);
  }
}

// v1.64.0: iPhone Home Screen apps cannot finish Google's pop-up sign-in when the app and Firebase's sign-in pages are on different
// sites (GitHub Pages vs milestracker-sg.firebaseapp.com). When the app is served from the Firebase auth domain itself (Firebase Hosting,
// same origin) a full-page redirect sign-in works there, so it is used on that address only. Everywhere else the pop-up stays.
export function usesRedirectSignIn(host = location.hostname, authDomain = firebaseConfig.authDomain) {
  return !!host && !!authDomain && host.toLowerCase() === authDomain.toLowerCase();
}

export function initFirebase(onAuthSuccess, onAuthLoggedOut) {
  if (isDemo()) return startDemo(onAuthSuccess);   // sample data, no Firebase (js/demo.js)
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  googleProvider = new GoogleAuthProvider();

  setPersistence(auth, indexedDBLocalPersistence).catch(console.error);

  // Coming back from Google after a redirect sign-in: success is picked up by onAuthStateChanged below; only errors need showing here.
  if (usesRedirectSignIn()) {
    getRedirectResult(auth).catch((e) => {
      sessionStorage.removeItem('auth_in_progress');
      if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') alert(e.message);
    });
  }

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      state.currentUser = user;
      sessionStorage.removeItem('auth_in_progress');
      const resolvedKey = await resolveVaultKey(user.email);
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
    if (usesRedirectSignIn()) { await signInWithRedirect(auth, googleProvider); return; }   // the page leaves for Google and comes back signed in
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
      if (Number(data.bigCheck) > 0) state.bigCheck = Number(data.bigCheck);
      state.stmtCoverage = (data.stmtCoverage && typeof data.stmtCoverage === 'object') ? data.stmtCoverage : {};
      state.feeCards = (data.feeCards && typeof data.feeCards === 'object') ? data.feeCards : {};
      state.feeAlerts = (data.feeAlerts && typeof data.feeAlerts === 'object') ? data.feeAlerts : {};
      if (data.enabledCards && Array.isArray(data.enabledCards)) {
        state.enabledCardIds = data.enabledCards;
        state.setup.saved = true;
      }
      if (data.cutoffDays) {
        ALL_MASTER_CARDS.forEach(c => {
          if (c.id.startsWith('uob-vs')) c.cutoffDay = data.cutoffDays.uobVs || 18;
          if (c.id === 'citi-rewards') c.cutoffDay = data.cutoffDays.citi || 15;
          if (c.id === 'citi-rewards-visa') c.cutoffDay = data.cutoffDays.citiVisa || 29;
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

  // What the banks say about points (v1.59.0): statement points summaries, typed balances, transfers and redemptions.
  onSnapshot(query(collection(db, "milestrack_points"), where("owner", "==", state.myVaultKey), limit(2000)), (snap) => {
    const next = [];
    snap.forEach((d) => next.push({ ...d.data(), id: d.id }));
    state.pointsLog = next.sort((a, b) => (a.ts || 0) - (b.ts || 0));
    window.dispatchEvent(new CustomEvent('points-updated'));
  }, (err) => console.error("Points log listener error:", err));

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
    state.txLoaded = true;
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

export async function savePointsRecord(id, rec) {
  if (isDemo()) return demoPoints(id, rec);
  await setDoc(doc(db, "milestrack_points", id), { ...rec, owner: state.myVaultKey });
}

export async function deletePointsRecord(id) {
  if (isDemo()) return demoPoints(id, null);
  await deleteDoc(doc(db, "milestrack_points", id));
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
