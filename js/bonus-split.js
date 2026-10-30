// Base vs bonus miles for cards where the bank credits them separately (BONUS_SPLIT in config.js).
// Display only: logged entries and vault totals are not changed. Pure functions.
import { BONUS_SPLIT } from "./config.js";
import { countsTs } from "./posting.js";

export const hasSplit = card => !!(card && BONUS_SPLIT[card.id]);

const down = (amt, block) => Math.floor((Number(amt) || 0) / block) * block;
const baseOf = (rule, card, amt) => Math.round((rule.baseRound === 'dollar' ? Math.round(Number(amt) || 0) : down(amt, rule.block)) * card.baseMpd);

// What the bank should show for these entries (one cycle): base per transaction, bonus per its rule, against what is logged.
export function splitForCycle(card, txns) {
  const rule = BONUS_SPLIT[card.id]; if (!rule) return null;
  const sorted = [...txns].sort((a, b) => countsTs(a, card) - countsTs(b, card));
  const extra = Math.max(0, card.bonusMpd - card.baseMpd);
  let base = 0, eligible = 0, bonusTxn = 0;
  for (const t of sorted) {
    const amt = Number(t.amt) || 0;
    base += baseOf(rule, card, amt);
    if (t.bonusCategory === 'base' || amt <= 0) continue;
    const room = Math.max(0, card.monthlyCap - eligible);
    const inCap = Math.min(amt, room);
    eligible += inCap;
    bonusTxn += Math.round(down(inCap, rule.block) * extra);
  }
  const bonus = rule.bonusRound === 'month' ? Math.round(down(eligible, rule.block) * extra) : bonusTxn;
  const logged = txns.reduce((s, t) => s + (Number(t.miles) || 0), 0);
  return { rule, base, bonus, eligible, total: base + bonus, logged, drift: base + bonus - logged };
}

// Bonus miles in one entry that the bank has not credited yet (its own logged miles minus its base). Used for the vault note.
export function entryBonusMiles(card, tx) {
  const rule = BONUS_SPLIT[card.id]; if (!rule || tx.bonusCategory === 'base') return 0;
  return Math.max(0, (Number(tx.miles) || 0) - baseOf(rule, card, tx.amt));
}
