// Expiry of miles that expire per earn date, worked out from the logged entries (the vault balance has no dates).
// Trust Miles: end of the 3rd year after the year they were earned (earned in 2026 -> 31 Dec 2029). Source: MileLion; Trust's own T&Cs do not state it.
// Entries are logged earnings only: miles transferred out or earned before the app tracked them are not known here.
import { countsTs } from "./posting.js";

export const TRUST_EXPIRY_YEARS = 3;

// Returns the soonest-expiring batch {year, miles, expiry: Date} and all batches, or null when nothing is logged.
export function trustExpiry(txns, cards, now = new Date()) {
  const ids = new Set(cards.filter(c => c.vaultKey === "trust_miles").map(c => c.id));
  const byYear = new Map();
  for (const t of txns) {
    if (!ids.has(t.cardId)) continue;
    const card = cards.find(c => c.id === t.cardId);
    const y = new Date(countsTs(t, card)).getFullYear();
    byYear.set(y, (byYear.get(y) || 0) + (Number(t.miles) || 0));
  }
  const batches = [...byYear.entries()].sort((a, b) => a[0] - b[0])
    .map(([year, miles]) => ({ year, miles, expiry: new Date(year + TRUST_EXPIRY_YEARS, 11, 31) }))
    .filter(b => b.expiry >= new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  return batches.length ? { next: batches[0], batches } : null;
}
