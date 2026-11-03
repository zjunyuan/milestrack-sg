// Trends (v1.63.60): a collapsible block above the History list with three views of the selected year, following the card filter.
//   1. Spend or miles per month, stacked by card.
//   2. Miles missed per month: what the best of your cards would have earned on each entry, less what it earned. Caps are shared within
//      a calendar month (the entries with the most to gain fill the bonus cards first), the channel follows the card used (an entry on an
//      online slot only compares online-capable cards) and foreign lines use the overseas rates, FX fees left out. Entries with no known
//      MCC are not judged. An estimate, labelled as one.
//   3. Cap use per bonus card per month: the card's bonus spend against its monthly cap; spend logged as Base on that card beyond it.
// Charts are plain SVG; colours are the validated dark categorical slots (dataviz skill reference palette, checked on --surface #1e1f24).
import { state } from "./state.js";
import { ALL_MASTER_CARDS, cardShort } from "./config.js";
import { familyOf, looksOnline } from "./statements.js";
import { mccOf } from "./summary.js";
import { getMccEntry } from "./mcc.js";
import { calcEarnedMiles } from "./recommender.js";
import { CITI_INSTORE_MCCS } from "./cardrules.js";
import { escapeHtml } from "./retailers.js";
import { fmtNum } from "./format.js";

const SLOTS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9"];
const OTHER = "#6b6e78";
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const cardById = (id) => ALL_MASTER_CARDS.find(c => c.id === id);
const famKey = (id) => familyOf(id)[0];
const famLabel = (k) => { const c = cardById(k); if (!c) return k; const s = cardShort(c); return familyOf(k).length > 1 ? s.replace(/\.[^.]*$/, "") : s; };
const counts = (t) => !t.refunded && !t.fee && (Number(t.amt) || 0) > 0;
let view = "spend", openState = false;

function yearTxs(year, cards) {
  const fam = cards && cards.length ? new Set(cards) : null;
  return (state.transactions || []).filter(t => { const d = new Date(Number(t.timestamp) || 0); return d.getFullYear() === year && (!fam || fam.has(t.cardId)); });
}

// Card colours: ranked by the year's spend over every card (so the card filter never repaints a card), the top seven get a slot.
function colourMap(year) {
  const tot = {};
  for (const t of yearTxs(year, null)) if (counts(t)) tot[famKey(t.cardId)] = (tot[famKey(t.cardId)] || 0) + Number(t.amt);
  const ranked = Object.keys(tot).sort((a, b) => tot[b] - tot[a]);
  const map = {};
  ranked.forEach((k, i) => { map[k] = i < SLOTS.length ? SLOTS[i] : OTHER; });
  return { map, top: ranked.slice(0, SLOTS.length) };
}

export function monthlyByCard(year, cards) {
  const rows = MON.map(() => ({}));
  for (const t of yearTxs(year, cards)) {
    const m = new Date(Number(t.timestamp)).getMonth(), k = famKey(t.cardId);
    const r = rows[m][k] = rows[m][k] || { spend: 0, miles: 0 };
    if (counts(t)) r.spend += Number(t.amt);
    r.miles += Number(t.miles) || 0;
  }
  return rows;
}

// ---------- miles missed ----------
const enabled = () => ALL_MASTER_CARDS.filter(c => (state.enabledCardIds || []).includes(c.id) && c.engine !== "yuu-10");
const capOf = (c) => Number(c.monthlyCap) && c.monthlyCap < 999999 ? Number(c.monthlyCap) : Infinity;
// The channel an entry was paid through: the card slot used says so (an online or in-person slot); for a card that takes both, the
// statement wording ("online", ".com", app stores ...) decides, else in person. Only cards that earn on that channel are compared.
const channelOf = (t, used) => used && used.channelMode && used.channelMode !== "both" ? used.channelMode : (looksOnline(`${t.stmtDesc || ""} ${t.desc || ""}`) ? "online" : "inperson");
const channelFits = (cand, ch, code) => {
  if (!(cand.channelMode === "both" || !cand.channelMode || cand.channelMode === ch)) return false;
  // Citi Rewards pays its bonus in store only at the listed clothing / department store MCCs (as the recommender does).
  if (ch === "inperson" && (cand.id === "citi-rewards" || cand.id === "citi-rewards-visa") && !CITI_INSTORE_MCCS.has(String(code))) return false;
  return true;
};
let mccMemo = new Map(), optMemo = new Map(), on = [];
const mccMemoOf = (t) => { const k = `${t.desc}|${t.mcc || ""}`; if (!mccMemo.has(k)) mccMemo.set(k, mccOf(t.desc, t.mcc)); return mccMemo.get(k); };
function options(t, used) {
  const code = mccMemoOf(t); if (!code) return null;
  const fx = !!(t.fx || t.fxGuess), ch = channelOf(t, used), key = `${code}|${fx}|${ch}`;
  if (optMemo.has(key)) return optMemo.get(key);
  const e = getMccEntry(code); if (!e) { optMemo.set(key, null); return null; }
  const list = (fx ? e.candidatesOverseas : e.candidatesLocal) || [], out = [];
  for (const c of list) { const card = on.find(x => x.id === c.id); if (card && channelFits(card, ch, code)) out.push({ card, rate: Number(c.baseRate) || 0 }); }
  for (const card of on) if (capOf(card) === Infinity && channelFits(card, ch, code) && !out.some(o => o.card.id === card.id)) out.push({ card, rate: Number(fx ? (card.fcyMpd || card.baseMpd) : card.baseMpd) || 0 });
  out.sort((a, b) => b.rate - a.rate);
  optMemo.set(key, out);
  return out;
}
export function missedByMonth(year, cards) {
  on = enabled(); optMemo = new Map();
  const months = MON.map(() => ({ missed: 0, judged: 0, unjudged: 0, items: [] }));
  const byMonth = MON.map(() => []);
  for (const t of yearTxs(year, cards)) if (counts(t) && !t.yuuBonus && !t.feeBonus) byMonth[new Date(Number(t.timestamp)).getMonth()].push(t);
  byMonth.forEach((list, m) => {
    const room = {};
    const prepared = list.map(t => ({ t, used: cardById(t.cardId), opts: null })).map(x => ({ ...x, opts: options(x.t, x.used) }));
    // The entries that can earn the most go first, so they get the bonus caps.
    prepared.sort((a, b) => ((b.opts && b.opts[0] ? b.opts[0].rate : 0) - (a.opts && a.opts[0] ? a.opts[0].rate : 0)) || (Number(b.t.amt) - Number(a.t.amt)));
    for (const x of prepared) {
      const amt = Number(x.t.amt), actual = Number(x.t.miles) || 0;
      if (!x.opts || !x.opts.length) { months[m].unjudged += amt; continue; }
      months[m].judged += amt;
      let left = amt, best = 0, bestCard = null;
      for (const o of x.opts) {
        if (left <= 0.005) break;
        const r = o.card.id in room ? room[o.card.id] : capOf(o.card);
        const take = Math.min(left, r); if (take <= 0.005) continue;
        best += calcEarnedMiles(o.card, take, o.rate); left -= take;
        if (!bestCard) bestCard = o.card;
        if (r !== Infinity) room[o.card.id] = r - take;
      }
      const gap = Math.round(best - actual);
      if (gap > 0) { months[m].missed += gap; months[m].items.push({ t: x.t, used: x.used, better: bestCard, gap }); }
    }
    months[m].items.sort((a, b) => b.gap - a.gap);
  });
  return months;
}

// ---------- cap use ----------
export function capUse(year, cards) {
  const fam = cards && cards.length ? new Set(cards) : null;
  const capped = enabled().filter(c => capOf(c) !== Infinity && (!fam || fam.has(c.id)));
  const rows = [];
  for (const c of capped) {
    const cells = MON.map(() => ({ bonus: 0, base: 0 }));
    for (const t of yearTxs(year, [c.id])) {
      if (!counts(t)) continue;
      const m = new Date(Number(t.timestamp)).getMonth();
      if (t.bonusCategory === "base") cells[m].base += Number(t.amt); else cells[m].bonus += Number(t.amt);
    }
    if (cells.some(x => x.bonus || x.base)) rows.push({ card: c, cap: capOf(c), cells });
  }
  return rows;
}

// ---------- rendering ----------
const lastMonth = (year) => { const now = new Date(); return year < now.getFullYear() ? 11 : year > now.getFullYear() ? -1 : now.getMonth(); };
const niceMax = (v) => { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); for (const s of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (v <= s * p) return s * p; return 10 * p; };
const short = (v) => v >= 1000 ? `${fmtNum(v / 1000, v >= 10000 ? 0 : 1)}k` : fmtNum(v);

function stackedSvg(rows, metric, colours, width, upto) {
  const H = 190, padL = 40, padB = 22, padT = 8, n = upto + 1;
  const plotW = Math.max(120, width - padL - 6), bw = Math.min(34, plotW / n * 0.62), step = plotW / n;
  const totals = rows.slice(0, n).map(r => Object.values(r).reduce((a, x) => a + x[metric], 0));
  const max = niceMax(Math.max(...totals, 0));
  const y = (v) => padT + (H - padT - padB) * (1 - v / max);
  let g = "";
  for (const f of [0, 0.5, 1]) { const v = max * f, yy = y(v); g += `<line x1="${padL}" x2="${width - 4}" y1="${yy}" y2="${yy}" class="tr-grid"/><text x="${padL - 6}" y="${yy + 4}" class="tr-axis" text-anchor="end">${metric === "spend" ? "S$" : ""}${short(v)}</text>`; }
  rows.slice(0, n).forEach((r, m) => {
    const x = padL + step * m + (step - bw) / 2;
    const tot = totals[m];
    g += `<rect x="${padL + step * m}" y="${padT}" width="${step}" height="${H - padT - padB}" fill="transparent" data-tip="${escapeHtml(`${MON[m]}: ${metric === "spend" ? `S$${fmtNum(tot, 2)}` : `${fmtNum(Math.round(tot))} mi`} in all`)}" class="tr-hit"/>`;
    let acc = 0;
    const keys = Object.keys(r).filter(k => r[k][metric] > 0).sort((a, b) => (colours.top.indexOf(a) + 99 * (colours.top.indexOf(a) < 0)) - (colours.top.indexOf(b) + 99 * (colours.top.indexOf(b) < 0)));
    keys.forEach((k, i) => {
      const v = r[k][metric], y1 = y(acc + v), y0 = y(acc), h = Math.max(0, y0 - y1 - (i ? 2 : 0));
      const top = i === keys.length - 1;
      const tip = `${MON[m]} · ${famLabel(k)}: ${metric === "spend" ? `S$${fmtNum(v, 2)}` : `${fmtNum(Math.round(v))} mi`}`;
      g += top && h > 4 ? `<path d="M${x},${y0 - (i ? 2 : 0)} V${y1 + 4} q0,-4 4,-4 H${x + bw - 4} q4,0 4,4 V${y0 - (i ? 2 : 0)} Z" fill="${colours.map[k] || OTHER}" data-tip="${escapeHtml(tip)}"/>`
        : `<rect x="${x}" y="${y1}" width="${bw}" height="${h}" fill="${colours.map[k] || OTHER}" data-tip="${escapeHtml(tip)}"/>`;
      acc += v;
    });
    g += `<text x="${padL + step * m + step / 2}" y="${H - 6}" class="tr-axis" text-anchor="middle">${MON[m]}</text>`;
  });
  return `<svg class="tr-svg" width="${width}" height="${H}" viewBox="0 0 ${width} ${H}" role="img" aria-label="${metric === "spend" ? "Spend" : "Miles"} per month by card">${g}</svg>`;
}
function barsSvg(vals, width, upto, label) {
  const H = 150, padL = 40, padB = 22, padT = 8, n = upto + 1;
  const plotW = Math.max(120, width - padL - 6), bw = Math.min(34, plotW / n * 0.62), step = plotW / n;
  const max = niceMax(Math.max(...vals.slice(0, n), 0));
  const y = (v) => padT + (H - padT - padB) * (1 - v / max);
  let g = "";
  for (const f of [0, 0.5, 1]) { const v = max * f, yy = y(v); g += `<line x1="${padL}" x2="${width - 4}" y1="${yy}" y2="${yy}" class="tr-grid"/><text x="${padL - 6}" y="${yy + 4}" class="tr-axis" text-anchor="end">${short(v)}</text>`; }
  vals.slice(0, n).forEach((v, m) => {
    const x = padL + step * m + (step - bw) / 2, y1 = y(v), y0 = y(0);
    if (v > 0) g += y0 - y1 > 4 ? `<path d="M${x},${y0} V${y1 + 4} q0,-4 4,-4 H${x + bw - 4} q4,0 4,4 V${y0} Z" fill="${SLOTS[1]}"/>` : `<rect x="${x}" y="${y1}" width="${bw}" height="${y0 - y1}" fill="${SLOTS[1]}"/>`;
    g += `<rect x="${padL + step * m}" y="${padT}" width="${step}" height="${H - padT - padB}" fill="transparent" class="tr-hit" data-month="${m}" data-tip="${escapeHtml(`${MON[m]}: about ${fmtNum(v)} ${label} · tap for the entries`)}"/>`;
    g += `<text x="${padL + step * m + step / 2}" y="${H - 6}" class="tr-axis" text-anchor="middle">${MON[m]}</text>`;
  });
  return `<svg class="tr-svg" width="${width}" height="${H}" viewBox="0 0 ${width} ${H}" role="img" aria-label="Miles missed per month">${g}</svg>`;
}
// Cap use cells: one blue hue, darker = less of the cap used (dark surface), from the reference sequential ramp.
const capFill = (p) => p <= 0 ? "" : p < 0.25 ? "#184f95" : p < 0.5 ? "#256abf" : p < 0.75 ? "#2a78d6" : p < 0.999 ? "#5598e7" : "#86b6ef";

let memo = { key: null };
function dataFor(year, cards) {
  const key = [year, (cards || []).join(","), (state.enabledCardIds || []).join(",")].join("|");
  if (memo.key === key && memo.txs === state.transactions && memo.n === (state.transactions || []).length) return memo.data;
  mccMemo = new Map();
  const data = { colours: colourMap(year), rows: monthlyByCard(year, cards), miss: missedByMonth(year, cards), caps: capUse(year, cards) };
  memo = { key, txs: state.transactions, n: (state.transactions || []).length, data };
  return data;
}

export function trendsHtml(year, cards, width) {
  const upto = lastMonth(year);
  if (upto < 0) return "";
  const { colours, rows, miss, caps } = dataFor(year, cards);
  const shownKeys = [...new Set(rows.flatMap(r => Object.keys(r)))].filter(k => rows.some(r => r[k] && (r[k].spend || r[k].miles)));
  if (!shownKeys.length) return "";
  const legendKeys = colours.top.filter(k => shownKeys.includes(k));
  const others = shownKeys.filter(k => !colours.top.includes(k));
  const legend = legendKeys.map(k => `<span class="tr-leg"><i style="background:${colours.map[k]}"></i>${escapeHtml(famLabel(k))}</span>`).join("") + (others.length ? `<span class="tr-leg"><i style="background:${OTHER}"></i>Other (${others.map(famLabel).map(escapeHtml).join(", ")})</span>` : "");
  const yearSpend = rows.reduce((a, r) => a + Object.values(r).reduce((b, x) => b + x.spend, 0), 0), yearMiles = rows.reduce((a, r) => a + Object.values(r).reduce((b, x) => b + x.miles, 0), 0);
  const tableRows = rows.slice(0, upto + 1).map((r, m) => { const s = Object.values(r).reduce((a, x) => a + x.spend, 0), mi = Object.values(r).reduce((a, x) => a + x.miles, 0); return `<tr><td>${MON[m]}</td><td class="num">S$${fmtNum(s, 2)}</td><td class="num">${fmtNum(Math.round(mi))}</td><td class="num">${s ? (mi / s).toFixed(2) : "—"}</td></tr>`; }).join("");

  const missTot = miss.reduce((a, x) => a + x.missed, 0), unj = miss.reduce((a, x) => a + x.unjudged, 0);
  const missLists = miss.map((x, m) => x.items.length ? `<div class="tr-misslist" data-miss-month="${m}" hidden><b>${MON[m]}: the biggest misses</b>${x.items.slice(0, 6).map(it => `<div>${escapeHtml(String(it.t.desc || "").slice(0, 30))} · S$${fmtNum(Number(it.t.amt), 2)} on ${escapeHtml(cardShort(it.used || { name: "?" }))} → ${escapeHtml(it.better ? cardShort(it.better) : "?")} <span class="tr-gap">+${fmtNum(it.gap)} mi</span></div>`).join("")}${x.items.length > 6 ? `<div class="dim">and ${x.items.length - 6} more</div>` : ""}</div>` : "").join("");

  const capTable = caps.length ? `<div class="stmt-scroll"><table class="tr-cap"><thead><tr><th></th>${MON.slice(0, upto + 1).map(m => `<th>${m[0]}</th>`).join("")}</tr></thead><tbody>${caps.map(r => `<tr><th>${escapeHtml(cardShort(r.card))} <span class="dim">S$${fmtNum(r.cap)}</span></th>${r.cells.slice(0, upto + 1).map((c, m) => {
    // Past the cap only S$1,000 (say) earns the bonus, whatever an entry says: shown as full, "+" when more was spent.
    const p = c.bonus / r.cap, fill = capFill(p), over = c.bonus > r.cap * 1.005 || (c.base > 0.005 && p >= 0.95);
    const tip = `${cardShort(r.card)} ${MON[m]}: S$${fmtNum(c.bonus, 2)} of S$${fmtNum(r.cap)} bonus cap (${Math.round(p * 100)}%)${c.base > 0.005 ? `; S$${fmtNum(c.base, 2)} logged as Base` : ""}`;
    return `<td class="${p >= 0.5 ? "tr-cap-hi" : ""}" style="${fill ? `background:${fill}` : ""}" data-tip="${escapeHtml(tip)}">${c.bonus || c.base ? `${Math.min(100, Math.round(p * 100))}${over ? "+" : ""}` : ""}</td>`;
  }).join("")}</tr>`).join("")}</tbody></table></div>
    <div class="hm-note">% of each card's monthly bonus cap used (calendar months; statement-cycle cards are approximate). Lighter = more used; “100+” = more was spent than the cap pays a bonus on.</div>` : `<div class="hm-note">No capped bonus cards with spend in ${year}.</div>`;

  return `<details class="tr-box" id="trendsBox"${openState ? " open" : ""}><summary>📈 Trends ${year}${cards && cards.length ? " · filtered cards" : ""} <span class="dim">S$${fmtNum(yearSpend, 0)} · ${fmtNum(Math.round(yearMiles))} mi${missTot ? ` · about ${fmtNum(missTot)} mi missed` : ""}</span></summary>
    <div class="tr-sec"><div class="tr-head"><b>${view === "spend" ? "Spend" : "Miles"} per month by card</b><span class="tr-toggle"><button type="button" data-tr-view="spend" class="${view === "spend" ? "on" : ""}">Spend</button><button type="button" data-tr-view="miles" class="${view === "miles" ? "on" : ""}">Miles</button></span></div>
      ${stackedSvg(rows, view, colours, width, upto)}
      <div class="tr-legend">${legend}</div>
      <details class="tr-table"><summary>Show as a table</summary><table><thead><tr><th>Month</th><th class="num">Spend</th><th class="num">Miles</th><th class="num">mpd</th></tr></thead><tbody>${tableRows}</tbody></table></details></div>
    <div class="tr-sec"><div class="tr-head"><b>Miles missed per month</b> <span class="dim">estimate · about ${fmtNum(missTot)} mi in ${year}</span></div>
      ${barsSvg(miss.map(x => x.missed), width, upto, "mi missed")}
      ${missLists}
      <div class="hm-note">What the best of your cards would have earned on each entry, less what it earned. Bonus caps are shared within each month, an entry on an online or in-person card is only compared with cards for that channel, and foreign lines use overseas rates without FX fees. ${unj ? `S$${fmtNum(unj, 0)} of spend has no known MCC and is not judged.` : ""} Tap a bar for that month's biggest misses.</div></div>
    <div class="tr-sec"><div class="tr-head"><b>Bonus cap use</b></div>${capTable}</div>
    <div class="tr-tip" hidden></div>
  </details>`;
}

// Draws into #txTrends and wires the toggle, tooltips and the month lists.
let lastWidth = 0;
export const trendsWidthChanged = (el) => { const w = el ? el.clientWidth : 0; return Math.abs(w - lastWidth) > 24; };
export function renderTrends(el, year, cards) {
  if (!el) return;
  lastWidth = el.clientWidth;
  const prev = document.getElementById("trendsBox"); if (prev) openState = prev.open;
  const width = Math.max(260, Math.min(1100, (el.clientWidth || el.parentElement?.clientWidth || 360) - 26));
  el.innerHTML = trendsHtml(year, cards, width);
  const box = document.getElementById("trendsBox"); if (!box) return;
  // Drawn while History was hidden (no width yet): redraw at the real width when it is opened or shown.
  box.addEventListener("toggle", () => { openState = box.open; if (box.open && Math.abs(el.clientWidth - lastWidth) > 24) renderTrends(el, year, cards); });
  box.querySelectorAll("[data-tr-view]").forEach(b => b.addEventListener("click", () => { view = b.dataset.trView; renderTrends(el, year, cards); }));
  const tip = box.querySelector(".tr-tip");
  const show = (e) => {
    const t = e.target.closest && e.target.closest("[data-tip]"); if (!t || !box.contains(t)) { tip.hidden = true; return; }
    tip.textContent = t.dataset.tip; tip.hidden = false;
    const br = box.getBoundingClientRect(), x = (e.clientX || 0) - br.left, y = (e.clientY || 0) - br.top;
    tip.style.left = `${Math.max(4, Math.min(br.width - 230, x + 12))}px`; tip.style.top = `${y + 14}px`;
  };
  box.addEventListener("pointermove", show);
  box.addEventListener("pointerleave", () => { tip.hidden = true; });
  box.addEventListener("click", (e) => {
    const t = e.target.closest && e.target.closest("[data-month]"); if (!t) return;
    const m = t.dataset.month;
    box.querySelectorAll("[data-miss-month]").forEach(d => { d.hidden = d.dataset.missMonth !== m || !d.hidden; });
    show(e);
  });
}
