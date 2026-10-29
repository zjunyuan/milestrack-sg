// Deleting several transactions at once (History "Select" mode and the statement import clean-up), with a way back.
import { state } from "./state.js";
import { ALL_MASTER_CARDS } from "./config.js";
import { saveTxToFirestore, deleteTxFromFirestore, updateVaultDoc } from "./firebase.js";

// Raw points a logged transaction put into the balances (statement lines imported without "add to balances" never did).
function rawPointsOf(tx) {
  if (tx.source === "statement" && !tx.vaultCounted) return 0;
  const c = ALL_MASTER_CARDS.find(x => x.id === tx.cardId);
  const ratio = (c && state.myVault[c.vaultKey]?.ratio) || 1;
  return Number(tx.earnedRawPoints) || Math.round((Number(tx.miles) || 0) / ratio);
}

async function adjustVault(txs, sign) {
  const byVault = {};
  for (const tx of txs) {
    const c = ALL_MASTER_CARDS.find(x => x.id === tx.cardId);
    const raw = rawPointsOf(tx);
    if (c && raw) byVault[c.vaultKey] = (byVault[c.vaultKey] || 0) + raw;
  }
  let touched = false;
  for (const [k, raw] of Object.entries(byVault)) {
    if (!state.myVault[k]) continue;
    state.myVault[k].points = Math.max(0, (Number(state.myVault[k].points) || 0) + sign * raw);
    touched = true;
  }
  if (touched) await updateVaultDoc(state.myVaultKey, state.myVault);
  return byVault;
}

// Points the given transactions hold in the balances, summed (for the confirmation message).
export function pointsHeld(txs) { return txs.reduce((a, t) => a + rawPointsOf(t), 0); }

// Deletes the transactions one by one, then takes their points off the balances in a single write.
// Returns { deleted, failed } where deleted are full copies (so they can be put back with restoreTransactions).
export async function deleteTransactionsBulk(txs) {
  const deleted = [], failed = [];
  for (const tx of txs) {
    try {
      await deleteTxFromFirestore(tx.firestoreId || tx.id);
      const copy = { ...tx }; delete copy.firestoreId;
      deleted.push(copy);
    } catch (err) {
      console.error("Delete failed for", tx.id, err);
      failed.push(tx);
    }
  }
  if (deleted.length) {
    try { await adjustVault(deleted, -1); }
    catch (err) { console.error("Vault update failed after delete", err); }
  }
  return { deleted, failed };
}

// Puts deleted transactions back and adds their points to the balances again.
export async function restoreTransactions(copies) {
  let n = 0;
  for (const tx of copies) { await saveTxToFirestore(tx.id, tx); n++; }
  await adjustVault(copies, +1);
  return n;
}
