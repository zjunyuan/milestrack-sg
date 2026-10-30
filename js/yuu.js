// DBS yuu miles. Each entry gets a FIXED rate that depends only on the entry itself (never on other entries):
//   partner merchant  -> card.lockedMpd (about 2.78 mpd, what it earns without the bonus)
//   anything else     -> card.baseMpd (0.14 mpd)
// The 10 mpd bonus is a month-level extra: S$800 spend AND 4 different partners in the calendar month, on partner spend up to the
// S$822.86 cap. Once met, the card sheet offers ONE "yuu bonus" entry (amount 0) holding the extra miles. Nothing is rewritten later.
import { state } from "./state.js";
import { detectYuuMerchant } from "./config.js";
import { saveTxToFirestore, updateVaultDoc } from "./firebase.js";

export const YUU_BONUS_DESC = "yuu bonus";
export const isYuuBonusEntry = t => !!t && (t.yuuBonus === true || t.desc === YUU_BONUS_DESC);

// Miles for one entry, from the entry alone.
export function yuuEntryMiles(card, amt, desc) {
  const partner = !!detectYuuMerchant(desc);
  const rate = partner ? (card.lockedMpd ?? card.baseMpd) : card.baseMpd;
  return { miles: Math.round((Number(amt) || 0) * rate), partner };
}

// The month's bonus status. txns = the card's entries in the calendar month.
export function yuuMonthStatus(card, txns) {
  const real = txns.filter(t => !isYuuBonusEntry(t));
  const spend = real.reduce((s, t) => s + (Number(t.amt) || 0), 0);
  const partners = new Set(real.map(t => detectYuuMerchant(t.desc)).filter(Boolean));
  const partnerSpend = real.reduce((s, t) => s + (detectYuuMerchant(t.desc) ? (Number(t.amt) || 0) : 0), 0);
  const need = Number(card.minSpend) || 800;
  const met = spend >= need && partners.size >= 4;
  const extraRate = Math.max(0, card.bonusMpd - (card.lockedMpd ?? card.baseMpd));
  const bonusSpend = Math.min(partnerSpend, card.monthlyCap);
  const earnable = Math.round(bonusSpend * extraRate);
  const bonusLogged = txns.filter(isYuuBonusEntry).reduce((s, t) => s + (Number(t.miles) || 0), 0);
  return { met, spend, need, partners, partnerSpend, earnable, bonusLogged, topUp: met ? Math.max(0, earnable - bonusLogged) : 0 };
}

// Adds the single top-up entry (or tops up an earlier one) and the matching vault points. Rolls the vault back if a write fails.
export async function addYuuBonus(card, txns, ts = Date.now()) {
  const st = yuuMonthStatus(card, txns);
  if (!st.met || st.topUp <= 0) return { miles: 0 };
  const ratio = state.myVault[card.vaultKey]?.ratio || 1;
  const raw = Math.round(st.topUp / ratio);
  const vaultBefore = JSON.stringify(state.myVault);
  const id = String(Date.now());
  const rec = { id, owner: state.myVaultKey, timestamp: ts, desc: YUU_BONUS_DESC, amt: 0, cardId: card.id, bonusCategory: "bonus", miles: st.topUp, earnedRawPoints: raw, date: new Date(ts).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" }), yuuBonus: true };
  try {
    if (state.myVault[card.vaultKey]) {
      state.myVault[card.vaultKey].points = (Number(state.myVault[card.vaultKey].points) || 0) + raw;
      await updateVaultDoc(state.myVaultKey, state.myVault);
    }
    await saveTxToFirestore(id, rec);
  } catch (err) {
    try { state.myVault = JSON.parse(vaultBefore); } catch (e) { /* keep as is */ }
    throw err;
  }
  return { miles: st.topUp, rec };
}
