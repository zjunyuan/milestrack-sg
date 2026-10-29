// Cards whose bonus rate only applies after a minimum spend. Each card carries a `tierRule` in config.js:
//   { kind:'monthly', steps:[{at, mpd}], scope }   spend this month on the card unlocks higher rates
//   { kind:'annual-sia', at, mpd }                 SIA Group spend in the membership year unlocks the rate
// Pure functions: pass in the transactions and the date so they can be tested.

import { cardShort } from "./config.js";
export const SIA_GROUP_RE = /singapore ?air|\bsia\b|scoot|krisshop|kris\+|krisflyer|silk ?air|pelago/i;

export function isSiaGroupTx(tx) {
  return SIA_GROUP_RE.test(String(tx && tx.desc || ""));
}

// Membership year containing `now`, anchored on the card's renewal month ("YYYY-MM"). Falls back to the calendar year.
export function membershipYear(renewalYm, now = new Date()) {
  const m = /^(\d{4})-(\d{2})$/.exec(renewalYm || "");
  if (!m) return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear() + 1, 0, 1), anchored: false };
  const month = Number(m[2]) - 1;
  let startYear = now.getFullYear();
  if (new Date(startYear, month, 1) > now) startYear -= 1;
  return { start: new Date(startYear, month, 1), end: new Date(startYear + 1, month, 1), anchored: true };
}

const money = (n) => "S$" + Math.round(n).toLocaleString("en-SG");

// Returns null for cards without a tierRule.
//   current: rate earned right now (before the next tier), next: {at, mpd}|null, spent, scale (bar max),
//   markers: [pct], met: bool (top tier reached), headline, detail
export function tierStatus(card, { spend = 0, txns = [], renewalYm = "", now = new Date() } = {}) {
  const rule = card && card.tierRule;
  if (!rule) return null;

  if (rule.kind === "annual-sia") {
    const yr = membershipYear(renewalYm, now);
    const spent = txns
      .filter(t => t.cardId === card.id && isSiaGroupTx(t) && t.timestamp >= yr.start.getTime() && t.timestamp < yr.end.getTime())
      .reduce((s, t) => s + (Number(t.amt) || 0), 0);
    const met = spent >= rule.at;
    const endTxt = yr.end.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
    return {
      kind: rule.kind, spent, scale: rule.at, markers: [], met, steps: [{ at: rule.at, mpd: rule.mpd }],
      current: met ? rule.mpd : card.baseMpd,
      headline: met
        ? `✅ ${money(rule.at)} SIA Group spend met`
        : `⚠️ ${money(rule.at - spent)} more SIA Group spend to unlock ${rule.mpd} mpd`,
      detail: `${money(spent)} of ${money(rule.at)} SIA Group spend (SIA, Scoot, KrisShop, Kris+, Pelago) this membership year`
        + (yr.anchored ? ` (to ${endTxt})` : " (calendar year; set your KrisFlyer UOB renewal month in Settings)")
        + `. The ${rule.mpd} mpd tier is credited by UOB after the year ends, not at the time of the swipe.`
    };
  }

  // monthly minimum-spend tiers
  const steps = [...rule.steps].sort((a, b) => a.at - b.at);
  const reached = steps.filter(s => spend >= s.at);
  const next = steps.find(s => spend < s.at) || null;
  const top = steps[steps.length - 1];
  return {
    kind: rule.kind, spent: spend, scale: top.at, markers: steps.slice(0, -1).map(s => (s.at / top.at) * 100), met: !next,
    steps, next,
    current: reached.length ? reached[reached.length - 1].mpd : card.baseMpd,
    headline: next
      ? `⚠️ ${money(next.at - spend)} to unlock ${next.mpd} mpd`
      : `✅ ${top.mpd} mpd unlocked`,
    detail: (rule.scope ? rule.scope + " " : "") + steps.map(s => `${money(s.at)}/mo → ${s.mpd} mpd`).join(", ") + `. Below the first minimum the card earns ${card.baseMpd} mpd.`
  };
}

// One-line warning for the recommender when a card is shown at a rate that is not yet unlocked.
export function lockedWarning(card, status) {
  if (!status || status.met) return "";
  if (status.kind === "annual-sia") return `${cardShort(card)}: the ${status.steps[0].mpd} mpd rate needs ${money(status.steps[0].at)} of SIA Group spend this membership year (${money(status.spent)} so far), credited after the year ends.`;
  return `${cardShort(card)}: ${status.next.mpd} mpd applies only once ${money(status.next.at)} is spent this month (${money(status.spent)} so far).`;
}

// Minimum-spend gate for one planned charge. Returns null when the card has no monthly minimum for this charge,
// otherwise { min, spend, after, locked, needMore, unlockMpd }. `after` is the cycle spend including this charge.
// Cards with a monthly tierRule (Maybank) only gate foreign-currency spend, so they are skipped for local spend.
// Banks credit the bonus on the whole cycle's spend once the minimum is met, so a locked charge is "pending", not lost.
export function minSpendGate(card, { cardSpend = 0, amount = 0, rate = 0, overseas = false } = {}) {
  if (!card) return null;
  let min = 0, unlockMpd = rate;
  const rule = card.tierRule;
  if (rule && rule.kind === "monthly") {
    if (!overseas) return null;
    const first = [...rule.steps].sort((a, b) => a.at - b.at)[0];
    min = first.at; unlockMpd = Math.max(rate, first.mpd);
  } else if (!rule && card.minSpend > 0) {
    min = card.minSpend;
  }
  if (!(min > 0) || !(unlockMpd > card.baseMpd)) return null;
  const after = cardSpend + amount;
  const locked = after < min;
  return { min, spend: cardSpend, after, locked, needMore: Math.max(0, min - after), unlockMpd };
}

// "18 Nov" for a cycle that ends in `daysLeft` days.
export function cycleEndLabel(daysLeft, now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysLeft);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
