// Time-limited promotions on screen (v1.63.80): the PRVI cap bar, the Overseas-mode callout under the recommender result, and the
// choices behind them (registered, region, "won't reach the minimum"), saved in the settings doc as `promos`. Rules live in js/promos.js.
import { state } from "./state.js";
import { fmtNum } from "./format.js";
import { mccOf } from "./summary.js";
import { mergeSettingsDoc } from "./firebase.js";
import { livePromo, activePromo, promoPrefs, promoProgress, daysLeft, fmtDay, mpdOf, ratioOf, dayStr } from "./promos.js";

// An entry's MCC for promotion checks: its own, else from the merchant name without the recommender's "[FCY] " / "(Part 2)" wording.
export const promoMccOfEntry = (tx) => mccOf(String(tx.desc || "").replace(/^\s*(\[FCY\]|Kris\+)\s*/i, "").replace(/\s*\(Part \d+\)\s*$/i, ""), tx.mcc);

export async function savePromoPrefs(id, patch) {
  const before = state.promos || {};
  state.promos = { ...before, [id]: { ...(before[id] || {}), ...patch } };
  window.dispatchEvent(new Event("settings-updated"));
  try { await mergeSettingsDoc(state.myVaultKey, { promos: state.promos }); }
  catch (e) { console.error("Save promo choice failed:", e); state.promos = before; window.dispatchEvent(new Event("settings-updated")); alert("Could not save: " + e.message); }
}

const recorded = (p) => (state.transactions || []).some(t => t.promoBonus && (t.promoId === p.id || (t.cardId === p.cardId && dayStr(Number(t.timestamp) || 0) > p.to && dayStr(Number(t.timestamp) || 0) <= p.bonusBy)));

// The PRVI cap bar while a promotion runs, and until its bonus is due. null = no bar (show the card as a plain uncapped card).
export function promoBarInfo(card) {
  const p = livePromo(card.id);
  if (!p || !state.enabledCardIds.includes(card.id)) return null;
  const prog = promoProgress(p, state.transactions, promoMccOfEntry);
  const prefs = promoPrefs(p);
  const running = dayStr(Date.now()) <= p.to;
  const money = x => `S$${fmtNum(x, x % 1 ? 2 : 0)}`;
  const left = `${money(prog.spend)} promo spend`;
  if (running) {
    const reg = prefs.registered ? "" : ` · <span style="color:var(--warning);">register by ${fmtDay(p.registerBy)}</span>`;
    if (!prog.met) return { pct: Math.min(100, prog.spend / p.minSpend * 100).toFixed(0), color: "var(--warning)", badge: "5 mpd promo", left,
      notice: `<span style="color:var(--warning); font-weight:700;">⚠️ ${money(prog.needMore)} to unlock 5 mpd (${daysLeft(p)}d left)</span>${reg}` };
    const full = prog.capLeftPts <= 0;
    return { pct: Math.min(100, prog.rawPts / p.capPts * 100).toFixed(0), color: full ? "var(--danger)" : "var(--accent)", badge: "5 mpd promo", left,
      notice: `<span style="color:${full ? "var(--danger)" : "var(--accent)"}; font-weight:700;">${full ? "Bonus cap reached" : `✅ ${fmtNum(prog.miles)} / ${fmtNum(prog.capMiles)} bonus mi`}</span>${reg}` };
  }
  if (!(prog.spend > 0)) return null;
  if (!prog.met) return { pct: Math.min(100, prog.spend / p.minSpend * 100).toFixed(0), color: "var(--danger)", badge: "promo ended", left,
    notice: `<span style="color:var(--danger);">❌ ${money(p.minSpend)} not reached: no bonus</span>` };
  if (recorded(p)) return null;
  return { pct: 100, color: "var(--accent)", badge: "bonus due", left,
    notice: `<span style="color:var(--accent); font-weight:700;">🎁 ~${fmtNum(prog.miles)} bonus mi due by ${fmtDay(p.bonusBy)}</span>` };
}

// The callout under an Overseas result. `use` is what the recommender did with the promotion for this spend:
// { p, eligible, why, region, prog, room, planned } (planned = S$ put on PRVI in the result).
export function promoCalloutHtml(use) {
  const { p, eligible, why, region, prog, room, planned } = use;
  const prefs = promoPrefs(p);
  const r = p.per5[region], ratio = ratioOf(p);
  const total = mpdOf(r.base + r.bonus, ratio), base = mpdOf(r.base, ratio);
  const money = x => `S$${fmtNum(x, x % 1 ? 2 : 0)}`;
  const status = prog.met
    ? `S$${fmtNum(p.minSpend)} minimum met (${money(prog.spend)} logged). Bonus so far ${fmtNum(prog.miles)} of ${fmtNum(prog.capMiles)} mi${prog.capLeftPts > 0 ? `, about ${money(room)} more spend earns it` : ", cap reached"}.`
    : `${money(prog.spend)} of the S$${fmtNum(p.minSpend)} minimum logged: <b>${money(prog.needMore)} more</b> of PRVI dining / shopping abroad by ${fmtDay(p.to)}, or there is no bonus at all and PRVI is just ${base} mpd for a 3.25% fee (worse than Trust).`;
  const head = eligible
    ? (planned > 0 ? `🎁 <b>${p.short}:</b> ${money(planned)} on PRVI at ${total} mpd (${base} now, ${mpdOf(r.bonus, ratio)} bonus by ${fmtDay(p.bonusBy)}).`
      : prefs.skip ? `🎁 <b>${p.short}</b> is left out: you said you won't reach S$${fmtNum(p.minSpend)}.`
      : `🎁 <b>${p.short}:</b> bonus cap used up, PRVI is back to ${base} mpd.`)
    : `🎁 <b>${p.short}</b> doesn't apply here: ${why}.`;
  if (!eligible) return `<div class="promo-callout"><div>${head}</div><div class="promo-status">${prog.met ? status : `${money(prog.spend)} of the S$${fmtNum(p.minSpend)} minimum logged so far. Ends ${fmtDay(p.to)}.`}</div></div>`;
  const btn = (k, v, label, on) => `<button type="button" class="${on ? "on" : ""}" data-promo-${k}="${v}">${label}</button>`;
  return `<div class="promo-callout">
    <div>${head}</div>
    <div class="promo-status">${status}</div>
    <div class="fcy-view promo-region">${btn("region", "other", "Rest of world", region === "other")}${btn("region", "regional", "ID · MY · TH · VN", region === "regional")}</div>
    <label class="promo-check"><input type="checkbox" data-promo-reg ${prefs.registered ? "checked" : ""}> I've registered (${p.register}, by ${fmtDay(p.registerBy)})</label>
    <label class="promo-check"><input type="checkbox" data-promo-skip ${prefs.skip ? "checked" : ""}> I won't reach S$${fmtNum(p.minSpend)}: leave PRVI out</label>
    <small>In person only, dining and shopping MCCs (not ${p.excluded}). Pay in the local currency. Ends ${fmtDay(p.to)} (charges must post by then).</small>
  </div>`;
}

export function wirePromoCallout(box, p, rerun) {
  box.querySelectorAll("[data-promo-region]").forEach(b => b.addEventListener("click", () => savePromoPrefs(p.id, { region: b.dataset.promoRegion }).then(rerun)));
  box.querySelector("[data-promo-reg]")?.addEventListener("change", e => savePromoPrefs(p.id, { registered: e.target.checked }));
  box.querySelector("[data-promo-skip]")?.addEventListener("change", e => savePromoPrefs(p.id, { skip: e.target.checked }).then(rerun));
}

export { activePromo };
