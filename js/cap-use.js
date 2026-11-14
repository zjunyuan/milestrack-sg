// How much of an entry earned the bonus before its card's cap ran out (v1.63.73). Used by the log/edit form (cap room in the entry's own
// cycle), the History tag on entries that crossed the cap, and the month summary's cap use.
import { ALL_MASTER_CARDS } from "./config.js";
import { calcEarnedMiles } from "./recommender.js";

const cardOf = (id) => ALL_MASTER_CARDS.find(c => c.id === id);

// Bonus spend an entry used up toward its card's cap: the whole amount on Bonus, except an entry that crossed the cap (its miles show only
// part earned the bonus, e.g. one imported at the end of a full month), where it is worked out from the miles.
export function capSpendOf(t, card = cardOf(t.cardId)) {
  if (!card || t.bonusCategory === 'base' || t.refunded || t.noPoints || t.feeBonus || t.promoBonus || t.yuuBonus) return 0;
  const amt = Number(t.amt) || 0, miles = Number(t.miles) || 0;
  if (!(card.bonusMpd > card.baseMpd)) return amt;
  const full = calcEarnedMiles(card, amt, card.bonusMpd), base = calcEarnedMiles(card, amt, card.baseMpd);
  if (miles >= full - 1) return amt;
  return Math.max(0, Math.min(amt, (miles - base) / (card.bonusMpd - card.baseMpd)));
}

// For the History tag: { at, amt } when a Bonus entry on a capped card earned the bonus on less than its amount (more than one S$5
// block short), else null. Cards whose rate depends on a tier or a month-level rule (yuu, Maybank tiers) are left out: a lower rate
// there is not the cap.
export function capInfo(t) {
  const card = cardOf(t.cardId);
  if (!card || t.bonusCategory === 'base' || t.refunded || t.noPoints || t.feeBonus || t.promoBonus || t.yuuBonus) return null;
  if (card.id === 'dbs-yuu' || card.tierRule || !(card.monthlyCap < 999999) || !(card.bonusMpd > card.baseMpd)) return null;
  const amt = Number(t.amt) || 0;
  if (amt < 5) return null;
  const at = capSpendOf(t, card);
  return at >= amt - 5 ? null : { at, amt };
}
