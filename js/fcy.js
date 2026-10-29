// Overseas "after fees" maths. Pure helpers, no DOM. The fee is the card's `fcyFee` % (config.js) charged on the full foreign spend.
import { FCY_MILE_VALUE_CENTS } from "./config.js";

// fee (S$), cost per mile (cents, fee / miles earned), value of the miles (S$) and net (value - fee).
export function fcyEconomics(card, amount, miles, valueCents = FCY_MILE_VALUE_CENTS) {
  const pct = Number(card && card.fcyFee);
  if (!Number.isFinite(pct) || !(amount > 0)) return null;
  const fee = amount * pct / 100;
  const m = Math.max(0, Number(miles) || 0);
  const value = m * valueCents / 100;
  return {
    fee,
    miles: m,
    costPerMileCents: m > 0 ? (fee / m) * 100 : null,   // null = pays a fee (or nothing) and earns no miles
    value,
    net: value - fee,
    feePct: pct
  };
}

// rows: [{ card, miles, note }] -> same rows with economics, best net first. Cards without an fcyFee are left out.
export function rankByNet(rows, amount, valueCents = FCY_MILE_VALUE_CENTS) {
  return rows
    .map(r => ({ ...r, eco: fcyEconomics(r.card, amount, r.miles, valueCents) }))
    .filter(r => r.eco)
    .sort((a, b) => b.eco.net - a.eco.net || (b.eco.miles - a.eco.miles));
}
