// "How each bank pays its bonus" (v1.63.43): a short guide per bank in the Check with banks sheet, so a statement check can be read
// against how that bank actually credits points. Card rates and caps come from config.js (so they cannot drift from what the app uses);
// the notes say where each rule comes from: the bank's T&C, a secondary source, or a pattern seen on real statements.
// Keep this generic: the repo is public, so no amounts or merchants from anyone's own statements.
import { ALL_MASTER_CARDS } from "./config.js";
import { escapeHtml } from "./retailers.js";
import { fmtNum } from "./format.js";

const SRC = { tc: ["T&C", "Bank's own terms"], sec: ["Secondary", "MileLion / Mainly Miles / MoneySmart, not the bank"], seen: ["Seen on statements", "A pattern seen on real statements; the bank does not publish it"], app: ["App", "How the app handles it"] };

const BANKS = [
  { bank: "HSBC", unit: "HSBC points (1 point ≈ 0.4 mi in the app)", notes: [
    ["seen", "“Points Earned” on a statement is the base: 1 point per S$1 on that statement's lines."],
    ["seen", "“Points Adjusted” is the bonus (9 more points per S$1) for the lines of the statement before."],
    ["seen", "A line posted on the statement date belongs to the next statement."],
    ["seen", "Some statements print no rewards summary; the next statement then carries both statements' points."],
    ["tc", "The bonus only applies at the listed MCCs, paid online or by contactless (T&C 1 Apr 2026). Fast food (5814, including GrabFood), streaming (4899) and games (5816) are not on the list; rides (4121) are."],
    ["app", "KrisFlyer transfers are 3:1, but the app counts points at 2.5:1 (other airlines' rate)."]
  ] },
  { bank: "OCBC", unit: "OCBC$ (1 OCBC$ ≈ 0.4 mi)", notes: [
    ["tc", "Points per full S$5: 5 base, plus 45 bonus at the listed shopping MCCs and at named merchants whatever their MCC (Alibaba, AliExpress, Amazon, Ezbuy, Guardian, Lazada, Mustafa, NTUC Unity, Shopee, Taobao, TikTok Shop, Watsons). No points on Shopee Pay; no bonus on MCC 5411 (T&C 5 Oct 2026)."],
    ["sec", "Promo: 25 more OCBC$ per S$5 at Watsons, Shopee, Lazada, Taobao and TikTok Shop (6 mpd), 1 Jul 2025 to 31 Mar 2027, on the first S$1,000 a month; then 4 mpd up to S$1,110."],
    ["seen", "“Earned” on a statement is the base for its lines; the bonus arrives one statement later."],
    ["seen", "January to May 2026 statements printed no rewards table (OCBC system maintenance)."],
    ["seen", "The caps count S$5 blocks in the month: regular bonus on the first 222 blocks (S$1,110), promo bonus on the first 200 (S$1,000). A line that crosses a cap earns the bonus on the blocks that fit."]
  ] },
  { bank: "UOB", unit: "UNI$ (1 UNI$ = 2 mi)", notes: [
    ["sec", "Points per S$5: 1 UNI$ base. The bonus (9 UNI$ per S$5) is worked out once on the month's eligible spend and credited the month after."],
    ["tc", "Preferred Visa: online bonus only at the selected MCCs (T&C v3.0, section 1(a)(ix)); mobile contactless has its own cap."],
    ["seen", "“Adjusted” on a UOB statement is fee reversals and other items, not the bonus."]
  ] },
  { bank: "Citi", unit: "ThankYou points (1 TYP ≈ 0.4 mi); Citi Miles for PremierMiles", notes: [
    ["sec", "10X (4 mpd) online except the excluded categories, and in store only at clothing, shoe and department stores, on the first S$1,000 a statement month per card."],
    ["seen", "The bonus is on the same statement as the spend."],
    ["seen", "Each card keeps its own ThankYou balance: the Visa and the Mastercard are not pooled."]
  ] },
  { bank: "DBS", unit: "DBS Points (1 point = 2 mi)", notes: [
    ["tc", "Points per full S$5 (DBS Rewards Programme T&C, Sep 2026)."],
    ["tc", "Woman's World Card: 1 point per S$5 on each transaction, the next working day. Online bonus: 9 more per S$5 (7 for overseas online) on the calendar month's total online spend, first S$1,000 a month, credited by the end of the next month (T&C 27 Jul 2026, s.16-19)."],
    ["tc", "DBS decides what counts as online from the merchant's own indicator, so a taxi or ride paid in an app is online and a tap in the car is not."],
    ["app", "Woman's World is treated as online only: every line earns the bonus unless DBS excludes it by MCC or by name (AXS, EZ-Link, ShopeePay, YouTrip, bill payments ...). Grab bookings, rides or food, count as online."],
    ["seen", "DBS prints points per card (Vantage, Woman's World, yuu ...): filter History to one card to check it on its own. Vantage: points on the same statement."],
    ["sec", "Vantage: 25,000 miles (12,500 DBS Points) the next working day after the annual fee is charged; the fee is no longer waivable from 1 Aug 2026, and a waived fee claws them back. The import adds them as an entry when it sees the fee line."],
    ["app", "Woman's World: Check with banks shows the bonus month by month (expected on the month's total, paid on the next statement), so a month DBS paid short stands out."]
  ] },
  { bank: "yuu", unit: "yuu points (3.6 points = 1 mi)", notes: [
    ["app", "Each entry earns its fixed rate; the monthly 10 mpd bonus (S$800 spend and 4 partner brands) is added as one “yuu bonus” entry from the card sheet."]
  ] },
  { bank: "Maybank", unit: "TREATS points (1 point ≈ 0.4 mi)", notes: [
    ["seen", "Spend in the last 2 business days of a month shows on the next month's points."],
    ["seen", "World Mastercard: each statement holds 1X on its own lines plus the previous month's foreign-spend tier (7X / 8X) as one lump. Check with banks checks it month by month."],
    ["tc", "World Mastercard: no points at all on utilities (4900), insurance premiums, NETS, government, AXS/SAM and wallet top-ups (T&C 1 Dec 2025, Excluded Transactions). The import gives these lines 0 points."],
    ["tc", "World Mastercard foreign spend: 7X (2.8 mpd) in a calendar month with S$800 of retail spend, 8X (3.2 mpd) from S$4,000, else 1X; the month counts lines posted by the 7th of the next month. The import uses the month's total from every file uploaded together plus your entries."],
    ["tc", "Horizon: air tickets earn the higher rate once S$800 is spent in the month (T&C 1 Dec 2025). World Mastercard: overseas rate in tiers at S$800 and S$4,000."]
  ] },
  { bank: "Trust", unit: "Trust miles", notes: [["app", "One flat rate, no bonus categories; S$27.25 per transfer to KrisFlyer."]] }
];

const rate = (x) => (Number(x) % 1 ? Number(x).toFixed(2).replace(/0$/, "") : String(Number(x)));
function cardsLine(bank) {
  const cards = ALL_MASTER_CARDS.filter(c => c.bank === bank);
  if (!cards.length) return "";
  return `<ul class="bh-cards">${cards.map(c => {
    const bonus = Number(c.bonusMpd) > Number(c.baseMpd);
    const cap = Number(c.monthlyCap) && c.monthlyCap < 999999 ? ` on the first S$${fmtNum(c.monthlyCap)} a ${c.cycleType === "statement" ? "statement month" : "month"}` : "";
    return `<li><b>${escapeHtml(c.name)}</b>: ${bonus ? `${rate(c.bonusMpd)} mpd bonus${cap}, else ${rate(c.baseMpd)} mpd` : `${rate(c.baseMpd)} mpd`}</li>`;
  }).join("")}</ul>`;
}

export function bankHowtoHtml(currentBank = "") {
  const order = [...BANKS].sort((a, b) => (b.bank === currentBank) - (a.bank === currentBank));
  return `<details class="pc-sec" data-sec="howto"><summary>📘 How each bank pays its bonus</summary>
    <div class="hm-note">Rates and caps are the ones the app uses. Tags say where a rule comes from; banks change their terms often, so check the latest T&C before relying on one.</div>
    ${order.map(b => `<details class="bh-bank"${b.bank === currentBank ? " open" : ""}><summary>${escapeHtml(b.bank)} <span class="dim">· ${escapeHtml(b.unit)}</span></summary>
      ${cardsLine(b.bank)}
      <ul class="bh-notes">${b.notes.map(([k, t]) => `<li><span class="bh-src bh-${k}" title="${escapeHtml(SRC[k][1])}">${SRC[k][0]}</span> ${escapeHtml(t)}</li>`).join("")}</ul>
    </details>`).join("")}
  </details>`;
}
