// Overseas "after FX fees" maths. Pure helpers, no DOM. Everything that can change when a bank changes its terms lives in config.js:
//   card.fcyFee (% fee), card.fcyMpd (top-tier mpd on ordinary spend), card.fcyEarnsOnFee, FCY_MILE_VALUE_CENTS, FCY_EARN_ON_FEE.
import { FCY_MILE_VALUE_CENTS, FCY_EARN_ON_FEE } from "./config.js";

// Does this card earn miles on the FX fee too? (S$100 abroad is billed S$103.25 at 3.25%.)
export function earnsOnFee(card) {
  return card && card.fcyEarnsOnFee !== undefined ? !!card.fcyEarnsOnFee : FCY_EARN_ON_FEE;
}

// The amount the bank bills, and so the amount miles are earned on.
export function billedAmount(card, amount) {
  const pct = Number(card && card.fcyFee);
  if (!(amount > 0) || !Number.isFinite(pct) || !earnsOnFee(card)) return amount;
  return amount * (1 + pct / 100);
}

// fee (S$), miles, value of the miles (S$), net (value - fee) and cost per mile in cents (fee / miles earned).
export function fcyEconomics(card, amount, miles, valueCents = FCY_MILE_VALUE_CENTS) {
  const pct = Number(card && card.fcyFee);
  if (!Number.isFinite(pct) || !(amount > 0)) return null;
  const fee = amount * pct / 100;
  const m = Math.max(0, Number(miles) || 0);
  const value = m * valueCents / 100;
  return { fee, miles: m, value, net: value - fee, feePct: pct, costPerMileCents: m > 0 ? (fee / m) * 100 : null };
}

// What switching from `base` to `row` costs and buys: extra fee, extra miles, cost per extra mile (cents) and the net gain.
export function incremental(eco, baseEco) {
  const extraFee = eco.fee - baseEco.fee;
  const extraMiles = eco.miles - baseEco.miles;
  return {
    extraFee,
    extraMiles,
    costPerExtraMileCents: extraMiles > 0 ? (extraFee / extraMiles) * 100 : null,   // null = no extra miles to pay for
    gain: eco.net - baseEco.net
  };
}

// rows: [{ card, capped, ... }], milesOf(row) -> miles for `amount` (the caller applies caps, rounding and the billed amount).
// Returns:
//   best      the uncapped row with the best net (the baseline everything else is measured against)
//   noFee     best-miles uncapped card with no FX fee (or null)
//   withFee   best-miles uncapped card that charges a fee and earns more miles than noFee (or null)
//   bonus     capped rows that beat the baseline, in the order given (the caller's whitelist/blacklist order)
//   hidden    capped rows that do not beat it at the current mile value
export function planOverseas(rows, amount, { milesOf, valueCents = FCY_MILE_VALUE_CENTS } = {}) {
  const scored = rows.map(r => ({ ...r, eco: fcyEconomics(r.card, amount, milesOf(r), valueCents) })).filter(r => r.eco);
  const uncapped = scored.filter(r => !r.capped).sort((a, b) => b.eco.net - a.eco.net || b.eco.miles - a.eco.miles);
  const capped = scored.filter(r => r.capped);
  const best = uncapped[0] || null;
  const byMiles = (a, b) => b.eco.miles - a.eco.miles;
  const noFee = uncapped.filter(r => r.eco.fee === 0).sort(byMiles)[0] || null;
  const withFee = uncapped.filter(r => r.eco.fee > 0 && (!noFee || r.eco.miles > noFee.eco.miles)).sort(byMiles)[0] || null;
  const baseEco = best ? best.eco : null;
  const withInc = r => ({ ...r, inc: baseEco ? incremental(r.eco, baseEco) : null });
  const bonus = [], hidden = [];
  for (const r of capped) {
    const x = withInc(r);
    (!baseEco || x.inc.gain > 0 ? bonus : hidden).push(x);
  }
  return {
    best: best && withInc(best),
    noFee: noFee && withInc(noFee),
    withFee: withFee && withInc(withFee),
    bonus, hidden, valueCents
  };
}
