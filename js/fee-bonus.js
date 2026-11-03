// Annual fee bonus (v1.63.53): some cards credit points for charging the annual fee (FEE_BONUS in config.js; DBS Vantage 12,500 DBS
// Points). The fee line itself is not spend and earns nothing, so without this the statement that carries those points showed them as
// "more than the app can explain". The bonus is kept as one zero-amount entry on the card (like the yuu bonus), dated the day after the fee.
import { state } from "./state.js";
import { FEE_BONUS } from "./config.js";

const DAY = 86400000;
export const feeRule = (cardId) => FEE_BONUS[cardId] || null;
export const isFeeBonusEntry = (t) => !!t && t.feeBonus === true;

// Is this statement line the annual fee charge of a card with a fee bonus?
export const isFeeBonusLine = (cardId, line) => { const r = feeRule(cardId); return !!(r && line && line.amt > 0 && r.re.test(line.desc || "")); };

// An entry for the card already holding a fee bonus within a few days of ts (so a re-import or a second click adds nothing).
export const feeBonusNear = (cardId, ts) => (state.transactions || []).find(t => isFeeBonusEntry(t) && t.cardId === cardId && Math.abs((Number(t.timestamp) || 0) - ts) < 10 * DAY) || null;

// The entry for a fee charged on feeTs. ratio = miles per point of the card's currency.
export function feeBonusRecord(cardId, feeTs, ratio, extra = {}) {
  const r = feeRule(cardId), ts = feeTs + DAY;
  const id = `feebonus_${cardId}_${new Date(feeTs).toISOString().slice(0, 10)}`;
  return { id, owner: state.myVaultKey, timestamp: ts, postTs: ts, desc: r.label, amt: 0, cardId, bonusCategory: "bonus",
    miles: Math.round(r.pts * ratio), earnedRawPoints: r.pts, date: new Date(ts).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" }),
    feeBonus: true, stmtNote: `${r.pts.toLocaleString("en-US")} points for the annual fee`, ...extra };
}
