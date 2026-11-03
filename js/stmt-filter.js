// Statement view in History (v1.63.20): the entries one bank statement covers, next to what the bank says it credited.
// Opened from a check in "Check with banks" (each check's "Show these entries") or picked from History's Statement filter.
// A statement covers the entries that POSTED after the previous checkpoint and on or before its date, the way the points check
// counts them (posting date, else the transaction date). state.txView.stmt = { vk, cardId, from, to, label, bank, sure, maybe, status }.
import { state } from "./state.js";
import { ALL_MASTER_CARDS, DEFAULT_VAULT } from "./config.js";
import { reconcile, reconcileLedgers, familyIds, fmtDate, BANK_LABEL, cardName, expectedCredits } from "./reconcile.js";
import { escapeHtml } from "./retailers.js";
import { fmtNum } from "./format.js";
import { candidatesFor, findFixes } from "./bonus-finder.js";
import { monthlyRule, rowForStatement, monthSpend, monthLabel } from "./monthly-bonus.js";

// The sets found for the banner on screen, so its "Switch these" buttons can apply one (ui.js reads them).
let shownFixes = [];
export const fixAt = (i) => shownFixes[i] || null;

const n = (x) => fmtNum(Math.round(Number(x) || 0));

// Every statement checkpoint for a vault (one list per card when the bank keeps a balance per card), newest first.
export function statementPeriods(vk, cardId = null) {
  const pick = (rows, cid) => rows.filter(r => r.rec && r.rec.kind === "statement").map((r, i, all) => ({
    vk, cardId: cid, from: r.from, to: r.to, bank: r.periodBank, sure: r.periodSure, maybe: r.periodMaybe, status: r.status,
    bankId: r.rec.bank, earned: Number.isFinite(Number(r.rec.earned)) ? Number(r.rec.earned) : null, adjusted: Number(r.rec.adjusted) || 0,
    prevFrom: all[i + 1] ? all[i + 1].from : null, prevTo: all[i + 1] ? all[i + 1].to : null, prevTs: all[i + 1] ? all[i + 1].rec.ts : null,
    // A statement missing between this one and the last imported (v1.63.33): its own printed start is well after the last one's date,
    // or, with no printed start, the span is over 45 days. The bank figures are this statement's only, so the check is not fair.
    gap: !!(all[i + 1] && (r.rec.from ? Number(r.rec.from) - Number(all[i + 1].rec.ts) > 7 * 86400000 : r.to - r.from > 45 * 86400000)),
    recId: r.rec.id, recDate: Number(r.rec.ts),
    gapFrom: all[i + 1] ? Number(all[i + 1].rec.ts) : null, gapTo: r.rec.from ? Number(r.rec.from) : null,
    label: `${BANK_LABEL[r.rec.bank] || ""} statement ${fmtDate(r.from + 86400000)} – ${fmtDate(r.rec.ts)}${cid ? ` · ${cardName(cid)}` : ""}`
  })).map((p, i, list) => {
    // After a statement that carried a skipped one (v1.63.38): that statement already paid the skipped statement's bonus, so
    // "the previous statement's entries" are only the ones from the printed start of that statement on (HSBC: 3 Jun – 1 Jul,
    // not 4 May – 1 Jul; the May bonus was paid in July and was counted again on the August check).
    const pr = list[i + 1];
    if (pr && pr.gap && pr.gapTo) p.prevFrom = new Date(new Date(pr.gapTo).setHours(0, 0, 0, 0)).getTime() - 1;
    return p;
  });
  const led = reconcileLedgers(vk);
  if (led.length) return led.filter(l => l.cardId && (!cardId || familyIds(cardId).includes(l.cardId))).flatMap(l => pick(l.rows, l.cardId));
  return cardId ? pick(reconcile(vk, cardId), cardId) : pick(reconcile(vk), null);
}

// The statements for History's card filter (v1.63.45). When the filter is one card (or its channel entries) and the bank prints a row per
// card (DBS: Vantage, Woman's World, yuu ... in one summary), each check uses that card's own row; otherwise the whole currency's figure.
// Before this a Woman's World filter was checked against the total of every DBS card.
export function periodsForFilter(cards) {
  const vk = vaultOfCardFilter(cards);
  if (!vk) return [];
  const fams = new Set((cards || []).map(id => familyIds(id).slice().sort().join(",")));
  if (fams.size === 1) {
    const fam = familyIds(cards[0]);
    const perCard = (state.pointsLog || []).some(r => r.kind === "statement" && (r.byCard || []).length > 1 && r.byCard.some(c => c.cardId && fam.includes(c.cardId)));
    if (perCard) return statementPeriods(vk, cards[0]);
  }
  return statementPeriods(vk);
}

// The vault the History card filter points at, if all the chosen cards share one (else null: no Statement list).
export function vaultOfCardFilter(cards) {
  const vks = [...new Set((cards || []).map(id => (ALL_MASTER_CARDS.find(c => c.id === id) || {}).vaultKey).filter(Boolean))];
  return vks.length === 1 ? vks[0] : null;
}

const cardsOf = (s) => s.cardId ? familyIds(s.cardId) : ALL_MASTER_CARDS.filter(c => c.vaultKey === s.vk).map(c => c.id);
export function passesStmt(tx, s) {
  if (!s) return true;
  if (!cardsOf(s).includes(tx.cardId)) return false;
  const d = Number(tx.postTs) || Number(tx.timestamp) || 0;
  return d > s.from && d <= s.to;
}

// Box above the list (v1.63.22): everything in POINTS (the bank's unit), with miles beside it, split into what the bank credited,
// what the app is sure of, the bonus that could land in this statement, and the gap. Base points post with each entry; a bonus the bank
// credits after the cycle (HSBC: on the next statement) falls in a window, so it counts as "could land here" until it is past.
export function stmtBannerHtml(s, rows) {
  if (!s) return "";
  const unit = (DEFAULT_VAULT[s.vk] || {}).unit || "pts";
  const ratio = Number((state.myVault && state.myVault[s.vk] && state.myVault[s.vk].ratio) || (DEFAULT_VAULT[s.vk] || {}).ratio || 1);
  const mi = (p) => fmtNum(Math.round((Number(p) || 0) * ratio));
  const credits = expectedCredits(s.vk, cardsOf(s));
  const inside = (c) => c.lo > s.from && c.hi <= s.to, overlaps = (c) => c.hi > s.from && c.lo <= s.to && !inside(c);
  const postedHere = (c) => { const d = Number(c.tx.postTs) || Number(c.tx.timestamp) || 0; return d > s.from && d <= s.to; };
  const add = (list) => list.reduce((a, c) => a + c.pts, 0);
  const sureBase = add(credits.filter(c => inside(c) && c.kind !== "bonus")), sureBonus = add(credits.filter(c => inside(c) && c.kind === "bonus"));
  // Only the previous statement's entries, as the label says (v1.63.32): older entries' bonus windows can still overlap this statement
  // (HSBC's February bonus, already paid on the March statement, showed up again as "could land here" on April's).
  const postedPrev0 = (c) => { const d = Number(c.tx.postTs) || Number(c.tx.timestamp) || 0; return s.prevTo ? d > (s.prevFrom || 0) && d <= s.prevTo : true; };
  const maybeEarlier = add(credits.filter(c => overlaps(c) && c.kind === "bonus" && !postedHere(c) && postedPrev0(c)));
  const maybeThese = add(credits.filter(c => overlaps(c) && c.kind === "bonus" && postedHere(c) && !(s.gap && s.gapTo && Number(c.tx.postTs || c.tx.timestamp) < new Date(new Date(s.gapTo).setHours(0, 0, 0, 0)).getTime())));
  const maybeOther = add(credits.filter(c => overlaps(c) && c.kind !== "bonus"));
  // For the line-by-line match: the bonus for the entries that posted in the PREVIOUS statement only. The window rule would also pull in
  // older entries whose window still overlaps (November's bonus, already paid on the December statement), overstating what is due (v1.63.26).
  const postedPrev = (c) => { const d = Number(c.tx.postTs) || Number(c.tx.timestamp) || 0; return s.prevTo && d > (s.prevFrom || 0) && d <= s.prevTo; };
  // HSBC sometimes prints no REWARDS SUMMARY (seen: the 4 May – 2 Jun 2026 statement); the next statement then carries the base for
  // both and, as "adjusted", the bonus for the previous imported statement's entries plus the skipped one's (v1.63.34).
  const skipEnd = s.gap && s.gapTo ? new Date(new Date(s.gapTo).setHours(0, 0, 0, 0)).getTime() - 1 : null;
  const postedSkip = (c) => { const d = Number(c.tx.postTs) || Number(c.tx.timestamp) || 0; return skipEnd && d > s.from && d <= skipEnd; };
  const prevBonus = add(credits.filter(c => c.kind === "bonus" && (postedPrev(c) || postedSkip(c))));
  const sure = sureBase + sureBonus, maybe = maybeEarlier + maybeThese + maybeOther, bank = Number(s.bank) || 0;
  const spent = rows.reduce((a, t) => a + (Number(t.amt) || 0), 0), miles = rows.reduce((a, t) => a + (Number(t.miles) || 0), 0);
  const prevLbl = s.prevTo ? `entries of ${fmtDate(s.prevFrom + 86400000)} – ${fmtDate(skipEnd || s.prevTs || s.prevTo)}` : "the previous statement's entries";
  // HSBC prints base ("Points Earned") and the month-before bonus ("Points Adjusted") separately, so the two can be matched line by line.
  // Only HSBC is known to work this way (seen on its statements). UOB's "adjusted" holds fee reversals and other items, Maybank and OCBC
  // credit late bonuses differently, so for them the plain "could land here" layout is kept rather than a line-by-line match that would mislead.
  const split = s.bankId === "hsbc" && s.status !== "baseline" && s.earned !== null && s.adjusted > 0;
  // Bonus paid by calendar month (v1.63.49, MONTHLY_BONUS: DBS Woman's World): this statement pays the bonus for the month that ended
  // before it, a known figure, so it is compared as one, not as a "could land here" range that hid a shortfall.
  const mrow = !split && s.cardId && monthlyRule(s.cardId) && s.status !== "baseline" && !s.gap ? rowForStatement(s.cardId, statementPeriods(s.vk, s.cardId), s.recId) : null;
  const mName = mrow ? mrow.months.map(m => monthLabel(m.key).split(" ")[0]).join(" + ") : "";
  const diff = (app, bk) => { const d = bk - app; return Math.abs(d) <= 5 ? `<span class="ok">✓</span>` : `<span class="${d > 0 ? "over" : "bad"}">${d > 0 ? "+" : "−"}${n(Math.abs(d))} <span class="dim">(≈ ${mi(Math.abs(d))} mi)</span></span>`; };
  const line = (label, app, bk, cls = "") => `<tr class="${cls}"><td>${label}</td><td class="num">${app === null ? "—" : n(app)}</td><td class="num">${bk === null ? "—" : n(bk)}</td><td class="num">${app === null || bk === null ? "" : diff(app, bk)}</td></tr>`;
  let body;
  if (s.status === "baseline") body = line("<b>Bank credited</b> on this statement", null, bank, "strong");
  else if (mrow) {
    const rule = monthlyRule(s.cardId), sp = mrow.months.reduce((a, m) => a + m.capped, 0), capHit = mrow.months.some(m => m.spend > m.capped);
    const toKey = (() => { const d = new Date(s.to); return d.getFullYear() * 100 + d.getMonth() + 1; })();
    const next = mrow.months.some(m => m.key === toKey) ? null : monthSpend(s.cardId).find(m => m.key === toKey);
    const range = (lbl, hi) => `<tr class="dim"><td>${lbl}</td><td class="num">0 – ${n(hi)}</td><td class="num">—</td><td class="num"></td></tr>`;
    body = [
      line("Base points on the entries below", mrow.base, null),
      line(`Bonus for ${escapeHtml(mName)} spend <span class="dim">(${rule.rate} per S$${rule.per} on S$${fmtNum(sp, 2)}${capHit ? `, the first S$${fmtNum(rule.cap)}` : ""})</span>`, mrow.expected, null),
      mrow.baseMaybe ? range("Could land here: base for entries posting near the cut-off", mrow.baseMaybe) : "",
      line("<b>Total on this statement</b>", mrow.base + mrow.expected + (mrow.status === "ok" ? Math.max(0, bank - mrow.base - mrow.expected) : mrow.status === "over" ? mrow.baseMaybe : 0), bank, "strong"),
      next && next.expected ? line(`Still to come: bonus for ${escapeHtml(monthLabel(next.key).split(" ")[0])} spend <span class="dim">(next statement)</span>`, next.expected, null, "dim") : ""
    ].join("");
  }
  else if (split) body = [
    line(`Base points on the entries below <span class="dim">(bank: “earned”)</span>`, sureBase, s.earned),
    line(`Bonus for ${escapeHtml(prevLbl)} <span class="dim">(bank: “adjusted”)</span>`, prevBonus, s.adjusted),
    line(`<b>Total on this statement</b>`, sureBase + prevBonus, bank, "strong"),
    maybeThese ? line(`Still to come: bonus for the entries below <span class="dim">(on the next statement)</span>`, maybeThese, null, "dim") : ""
  ].join("");
  else body = [
    line("<b>Bank credited</b> on this statement", null, bank, "strong"),
    line("App is sure of: base points on the entries below", sureBase, null),
    sureBonus ? line("App is sure of: bonus already due", sureBonus, null) : "",
    maybeEarlier ? line(`Could land here: bonus for ${escapeHtml(prevLbl)}`, maybeEarlier, null, "dim") : "",
    maybeThese ? line("Could land here: bonus for the entries below (usually next statement)", maybeThese, null, "dim") : "",
    maybeOther ? line("Could land here: entries posting near the cut-off", maybeOther, null, "dim") : ""
  ].join("");
  let verdict;
  const gapNote = s.gap ? `<div class="hm-note">⚠️ No points figures for the statement of ${fmtDate(s.gapFrom + 86400000)} – ${s.gapTo ? fmtDate(s.gapTo - 86400000) : "?"}. ${split ? "If it printed no points summary (HSBC sometimes leaves it out), this statement carries its points too, as compared above; if it did, upload it and this check splits in two." : "Upload it (with its points summary) and this check will split in two."}</div>` : "";
  if (s.gap && !split) verdict = `<div class="stmt-verdict bad">⚠️ A statement is missing: the app has none between ${fmtDate(s.gapFrom)} and ${s.gapTo ? fmtDate(s.gapTo) : "this one"}, so the entries below cover two statements while the bank's figures are this statement's only. Upload the missing statement (with its points summary) and this check will split in two.</div>`;
  else if (s.status === "baseline") verdict = `<div class="hm-note">Your earliest statement, so it is the starting point and not checked: it includes the bonus for spend before your first entries.</div>`;
  else if (mrow) {
    const d = mrow.diff, amt = `${n(Math.abs(d))} ${escapeHtml(unit)} (≈ ${mi(Math.abs(d))} mi)`;
    verdict = mrow.status === "ok" ? `<div class="stmt-verdict ok">✓ Matches: base for the entries below plus the bonus for ${escapeHtml(mName)} spend${mrow.baseMaybe ? ` (allowing up to ${n(mrow.baseMaybe)} for lines near the cut-off)` : ""}.</div>`
      : mrow.status === "short" ? `<div class="stmt-verdict bad">⚠️ The bonus for ${escapeHtml(mName)} spend is about ${amt} short: the bank did not pay it on some of that month's entries (DBS only pays it on spend its system marks as online).</div>`
      : `<div class="stmt-verdict over">➕ About ${amt} more than expected: an entry on Base may have earned the bonus, or spend is not logged.</div>`;
  }
  else if (split) { const d = bank - (sureBase + prevBonus); verdict = Math.abs(d) <= 5 ? `<div class="stmt-verdict ok">✓ Matches: the bank paid what the app expects.</div>` : `<div class="stmt-verdict ${d > 0 ? "over" : "bad"}">${d > 0 ? "➕ The bank paid" : "⚠️ The bank paid"} ${n(Math.abs(d))} ${escapeHtml(unit)} (≈ ${mi(Math.abs(d))} mi) ${d > 0 ? "more" : "less"} than the app expects${d > 0 ? ": usually an entry on Base that earned a bonus, or spend not logged" : ": an entry may be on Bonus that the bank paid at base"}.</div>`; }
  else if (bank < sure - 5) verdict = `<div class="stmt-verdict bad">⚠️ Short: the bank credited ${n(sure - bank)} ${escapeHtml(unit)} (≈ ${mi(sure - bank)} mi) less than the app is sure of.</div>`;
  else if (bank > sure + maybe + 5) verdict = `<div class="stmt-verdict over">➕ ${n(bank - sure - maybe)} ${escapeHtml(unit)} (≈ ${mi(bank - sure - maybe)} mi) more than the app can explain: usually entries on Base that the bank paid a bonus on, or spend not logged.</div>`;
  else verdict = `<div class="stmt-verdict ok">✓ In range: the bank's ${n(bank)} is between ${n(sure)} (sure) and ${n(sure + maybe)} (if every bonus that could land here did).</div>`;
  // Which entries would explain a bonus gap (v1.63.35). HSBC: the "adjusted" figure against the bonus of the entries it pays for.
  // Other banks: what the bank credited beyond everything that could land (or below what the app is sure of).
  shownFixes = [];
  let fixBlock = "";
  const inWin = (t, a, b) => { const d = Number(t.postTs) || Number(t.timestamp) || 0; return d > a && d <= b; };
  const fam = cardsOf(s), mine = (state.transactions || []).filter(t => fam.includes(t.cardId));
  let fGap = 0, fTxs = [], what = "";
  let fTol = null, fewest = false;
  if (mrow) {
    // The gap is known within the base of lines near the cut-off: aim at the middle. Only that month's entries can change its bonus.
    if (mrow.status === "short" || mrow.status === "over") {
      const lo = mrow.paidLo - mrow.expected, hi = mrow.paidHi - mrow.expected;
      fGap = Math.round((lo + hi) / 2); fTol = Math.max(10, Math.ceil((hi - lo) / 2) + 5); fewest = true;
      fTxs = mrow.txs; what = `bonus for ${mName}`;
    }
  }
  else if (split) { fGap = s.adjusted - prevBonus; fTxs = mine.filter(t => inWin(t, s.prevFrom || 0, s.prevTo || 0) || (skipEnd && inWin(t, s.from, skipEnd))); what = "bonus (“adjusted”)"; }
  else if (s.status !== "baseline" && !s.gap) {
    if (bank > sure + maybe + 5) { fGap = bank - sure - maybe; what = "points"; }
    else if (bank < sure - 5) { fGap = bank - sure; what = "points"; }
    fTxs = mine.filter(t => inWin(t, s.from, s.to) || (s.prevTo && inWin(t, s.prevFrom || 0, s.prevTo)));
  }
  if (Math.abs(fGap) > 5 && fTxs.length) {
    const cands = candidatesFor(fTxs);
    const tol = fTol !== null ? fTol : Math.max(10, Math.ceil(Math.abs(split ? s.adjusted : bank) * 0.005), cands.length);
    const r = findFixes(cands, fGap, tol, { fewest });
    shownFixes = r.sets;
    const nm = (t) => escapeHtml(String(t.desc || "").slice(0, 28));
    const head = `<b>🔎 Which entries would explain the ${fGap > 0 ? "+" : "−"}${n(Math.abs(fGap))} ${what}?</b>`;
    if (!r.sets.length) fixBlock = `<div class="stmt-fix">${head} No combination of the ${r.candidates} entr${r.candidates === 1 ? "y" : "ies"} that could change rate adds up to it. More likely an entry is missing, or the bank used a different rate.</div>`;
    else fixBlock = `<div class="stmt-fix">${head}
      ${r.sets.map((set, i) => `<div class="stmt-fix-set"><span>${set.items.map(it => `${nm(it.tx)} <span class="${it.dir === "up" ? "ok" : "bad"}">${it.dir === "up" ? "→ Bonus" : "→ Base"}</span>`).join(", ")} <span class="dim">= ${set.total > 0 ? "+" : "−"}${n(Math.abs(set.total))}${set.diff ? `, ${n(Math.abs(set.diff))} off` : ""}</span></span> <button type="button" class="btn-backup" data-bonus-fix="${i}">Switch ${set.items.length === 1 ? "it" : "these"}</button></div>`).join("")}
      <div class="hm-note">${r.count === 1 ? "Only this set adds up" : `${r.count > 3 ? `${r.count} sets add up; the 3 closest are shown` : `${r.count} sets add up, closest first`}`} (from ${r.candidates} entr${r.candidates === 1 ? "y" : "ies"} that could change${r.partial ? ", the largest 22 tried" : ""}). A sum that fits is a strong hint, not proof: check a charge in the bank's app if unsure.</div></div>`;
  }
  return `<div class="stmt-banner">
    <div><b>📄 ${escapeHtml(s.label)}</b> <button type="button" class="stmt-x" data-stmt-clear title="Show all entries again">✕</button></div>
    <div class="hm-note"><button type="button" class="pc-link" data-stmt-del="${escapeHtml(s.recId || "")}">Delete this statement's points record</button> <span class="dim">(only the points figures; entries and balances stay)</span></div>
    <div class="stmt-scroll"><table class="stmt-tbl"><thead><tr><th></th><th class="num">App expects</th><th class="num">Bank</th><th class="num">Difference</th></tr></thead><tbody>${body}</tbody></table></div>
    ${verdict}${gapNote}${fixBlock}
    <div class="hm-note">All figures in ${escapeHtml(unit)} (1 ${escapeHtml(unit)} ≈ ${ratio} mi). The ${rows.length} entr${rows.length === 1 ? "y" : "ies"} below: S$${fmtNum(spent, 2)} · ${fmtNum(Math.round(miles))} mi in the app, base and bonus together.</div>
  </div>`;
}

// From a check: open History on that card and statement.
export async function openStatementView(s) {
  const { switchTab, renderTransactions } = await import("./ui.js");
  Object.assign(state.txView, { merchant: "", cats: [], rate: "", amtMin: "", amtMax: "", transFrom: "", transTo: "", postFrom: "", postTo: "" });
  state.txView.cards = cardsOf(s);
  state.txView.stmt = s;
  if (!document.body.classList.contains("show-history")) switchTab("history");
  renderTransactions();
  document.getElementById("txList")?.scrollIntoView({ block: "start" });
}
