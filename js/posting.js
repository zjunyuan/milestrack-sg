// Transaction date vs posting date.
//
// A card's monthly cap or minimum spend is counted either by the date you paid (transaction date) or by the date the bank posted the charge
// (posting date, usually 1-3 days later). Near the end of a cycle that decides which cycle a purchase lands in.
//
// SOURCE: The MileLion, "Which cards track spending by transaction date vs posting date?", 30 Jul 2026:
//   https://milelion.com/2026/07/30/which-cards-track-spending-by-transaction-date-vs-posting-date/
// A third-party summary of bank behaviour, not bank T&Cs. It says every bank except DBS and Maybank uses the posting date; DBS uses the
// transaction date (though possibly in the merchant's or acquirer's timezone, so the 31st and 1st are the risky days); Maybank counts a charge
// to the earlier month if it posts by a set day of the next month (6th Horizon, 7th World Mastercard). Posting usually lags 1-3 days and can
// lag more over weekends and public holidays. Some merchants post the same day (reported by readers, not guaranteed).
// To refresh: edit POSTING_RULES / POSTING_META. Cards with no cap and no minimum spend need no rule.
//
// Pure functions: pass in the cards, transactions and dates so they can be tested.

export const POSTING_META = {
  asOf: "30 Jul 2026",
  source: "The MileLion",
  url: "https://milelion.com/2026/07/30/which-cards-track-spending-by-transaction-date-vs-posting-date/"
};

const DAY = 86400000;
const TXN = { basis: "transaction", note: "DBS counts the transaction date, but possibly in the merchant's or acquirer's timezone. To be safe, avoid spending on the last day of the month and the 1st." };
const POST = { basis: "posting", note: "Counted when the bank posts the charge, usually 1-3 days after you pay (longer over weekends and public holidays)." };

export const POSTING_RULES = {
  "dbs-yuu": TXN,
  "dbs-wwmc": TXN,
  "citi-rewards": POST,
  "hsbc-rev": POST,
  "ocbc-rewards": POST,
  "uob-ppv-contactless": POST, "uob-ppv-online": POST,
  "uob-vs-contactless": POST, "uob-vs-fcy": POST,
  "uob-ls-dining": POST, "uob-ls-travel": POST,
  "mb-horizon-vs": { basis: "grace", graceDay: 6, note: "Maybank counts a charge to the month you spent it in if it posts by the 6th of the next month." },
  "mb-world-mc": { basis: "grace", graceDay: 7, note: "Maybank counts a charge to the month you spent it in if it posts by the 7th of the next month." }
};

export const BASIS_LABEL = {
  transaction: { icon: "🛒", short: "Transaction date", long: "Counted by the date you paid" },
  posting: { icon: "🧾", short: "Posting date", long: "Counted by the date the bank posts it" },
  grace: { icon: "🗓️", short: "Posting date (grace)", long: "Counted to the month you spent in if posted in time" }
};

// The rule for a card, or null when the card has no cap or minimum spend (so no cycle edge to worry about) or isn't covered.
export function postingRule(card) {
  if (!card) return null;
  const capped = (Number(card.monthlyCap) || 0) < 999999 || (Number(card.minSpend) || 0) > 0;
  if (!capped) return null;
  const r = POSTING_RULES[card.id];
  return r ? { ...r } : null;
}

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// The cycle that contains `ref`: { start, next } where `next` is the first moment of the following cycle.
export function cycleBounds(card, ref = new Date()) {
  const y = ref.getFullYear(), m = ref.getMonth();
  if (card.cycleType === "statement") {
    const cut = card.cutoffDay || 15;
    return ref.getDate() >= cut
      ? { start: new Date(y, m, cut), next: new Date(y, m + 1, cut) }
      : { start: new Date(y, m - 1, cut), next: new Date(y, m, cut) };
  }
  return { start: new Date(y, m, 1), next: new Date(y, m + 1, 1) };
}

// The last calendar day of the cycle containing `ref` (midnight).
export function cycleLastDay(card, ref = new Date()) {
  const { next } = cycleBounds(card, ref);
  return new Date(next.getFullYear(), next.getMonth(), next.getDate() - 1);
}

// Whole days from `ref`'s date to the last day of its cycle (0 on the last day itself).
export function daysToCycleEnd(card, ref = new Date()) {
  return Math.round((cycleLastDay(card, ref) - startOfDay(ref)) / DAY);
}

// Whole days since the cycle started (0 on the first day).
export function daysIntoCycle(card, ref = new Date()) {
  return Math.round((startOfDay(ref) - cycleBounds(card, ref).start) / DAY);
}

const fmtDay = (d) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

// The next business days after `d` (weekends skipped; public holidays are not known), as the usual earliest and latest posting day.
export function expectedPosting(d) {
  const add = (n) => { const x = startOfDay(d); let left = n; while (left > 0) { x.setDate(x.getDate() + 1); if (x.getDay() !== 0 && x.getDay() !== 6) left--; } return x; };
  return { from: add(1), to: add(3) };
}

// How risky is spending on `spendDate` for this card's cycle?
// level: "none" (no rule) | "safe" | "edge" (transaction-date card on the 31st/1st) | "grace" (Maybank) | "maybe" | "likely" (posting-date card)
// For "maybe" and "likely", `post` is the usual posting window and `nextStart` the start of the cycle it would land in.
export function slipRisk(card, spendDate = new Date(), rule = postingRule(card)) {
  if (!rule) return { level: "none", rule: null };
  const d = startOfDay(spendDate);
  const dte = daysToCycleEnd(card, d);
  const bounds = cycleBounds(card, d);
  const base = { rule, daysToEnd: dte, lastDay: cycleLastDay(card, d), nextStart: bounds.next };
  if (rule.basis === "transaction") {
    const edge = dte === 0 || daysIntoCycle(card, d) === 0;
    return { ...base, level: edge ? "edge" : "safe" };
  }
  if (rule.basis === "grace") {
    const deadline = new Date(bounds.next.getFullYear(), bounds.next.getMonth(), bounds.next.getDate() + rule.graceDay - 1);
    return { ...base, level: "grace", deadline };
  }
  const post = expectedPosting(d);
  let weekendBetween = false;
  for (let x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1); x <= base.lastDay; x.setDate(x.getDate() + 1)) if (x.getDay() === 0 || x.getDay() === 6) weekendBetween = true;
  const level = dte <= 0 ? "likely" : (dte <= 2 || (dte <= 3 && weekendBetween)) ? "maybe" : "safe";
  return { ...base, level, post, weekendBetween };
}

// One short line for the recommender and log form, or "" when there is nothing to say. `what` names the thing that could slip ("the S$600 cap").
export function slipLine(card, spendDate = new Date()) {
  const r = slipRisk(card, spendDate);
  const on = fmtDay(startOfDay(spendDate));
  if (r.level === "likely" || r.level === "maybe") {
    const when = `${fmtDay(r.post.from)} to ${fmtDay(r.post.to)}`;
    return r.level === "likely"
      ? `⏳ <b>Posting-date card:</b> ${on} is the last day of this cycle, and a charge then usually posts ${when}, so it will probably count to the <b>next</b> cycle (from ${fmtDay(r.nextStart)}), not this one.`
      : `⏳ <b>Posting-date card:</b> this cycle ends ${fmtDay(r.lastDay)} and a charge on ${on} usually posts ${when}. It <b>might</b> slip into the next cycle${r.weekendBetween ? " (a weekend is in between)" : ""}. Spend earlier if it needs to count to this one.`;
  }
  if (r.level === "edge") return `🛒 <b>Transaction-date card:</b> counts the day you pay, but DBS may use the merchant's timezone, so the last day and the 1st are the risky days.`;
  if (r.level === "grace") return `🗓️ <b>Maybank:</b> counts to this cycle if the charge posts by ${fmtDay(r.deadline)}.`;
  return "";
}

// The date a transaction counts to for cap and minimum-spend tracking. Normally the day you paid; for posting-date cards the posting date,
// when it is known (`postTs`, from a statement or typed in by hand).
export function countsTs(tx, card) {
  const ts = tx && tx.timestamp;
  const rule = postingRule(card);
  if (!rule || rule.basis === "transaction" || !tx || !tx.postTs) return ts;
  if (rule.basis === "posting") return tx.postTs;
  const { next } = cycleBounds(card, new Date(ts));                           // grace: counts to the spend month if posted by graceDay
  const deadline = next.getTime() + rule.graceDay * DAY;
  return tx.postTs < deadline ? ts : tx.postTs;
}

// Cards whose cycle ends soon (or just ended), for the home banner. `window` is how many days either side count as "near".
// Returns [{ card, rule, phase: "ending" | "started", daysToEnd, lastDay, start }] for cards where a posting date could move spend across the line.
export function bannerRows(cards, now = new Date(), window = 3) {
  const out = [];
  for (const card of cards) {
    const rule = postingRule(card);
    if (!rule || rule.basis === "transaction") continue;
    const dte = daysToCycleEnd(card, now);
    const into = daysIntoCycle(card, now);
    if (dte <= window) out.push({ card, rule, phase: "ending", daysToEnd: dte, lastDay: cycleLastDay(card, now), start: cycleBounds(card, now).next });
    else if (into <= window - 1) out.push({ card, rule, phase: "started", daysToEnd: dte, lastDay: cycleLastDay(card, new Date(cycleBounds(card, now).start.getTime() - DAY)), start: cycleBounds(card, now).start });
  }
  return out;
}

// What a statement line means for the cycle it counts to. line: { ts, postTs? }. Returns null when nothing is worth saying.
// status: "posted-later" (posting date falls in a later cycle than the purchase) | "may-slip" (no posting date in the file, purchase near the cycle end)
export function statementTiming(card, line) {
  const rule = postingRule(card);
  if (!rule || rule.basis === "transaction") return null;
  const spent = new Date(line.ts);
  const sb = cycleBounds(card, spent);
  if (line.postTs) {
    const counted = countsTs({ timestamp: line.ts, postTs: line.postTs }, card);
    const cb = cycleBounds(card, new Date(counted));
    if (cb.start.getTime() !== sb.start.getTime()) return { status: "posted-later", spent, posted: new Date(line.postTs), nextStart: cb.start, rule };
    return null;
  }
  const dte = daysToCycleEnd(card, spent);
  if (dte <= 2) return { status: "may-slip", spent, nextStart: sb.next, rule };
  return null;
}
