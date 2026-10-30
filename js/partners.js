// "Where can my points go": what each Vault currency converts to at another airline right now (v1.60.0).
// Pure helpers plus the sheet markup. Uses the same block maths as the Vault tiles (transferPlan); nothing is stored or changed.
import { TRANSFER_PARTNERS } from "./config.js";
import { transferPlan } from "./transfer.js";
import { escapeHtml } from "./retailers.js";
import { fmtNum } from "./format.js";

// One row per currency that can reach the airline: miles transferable now, points left over, and what is still needed for the next block.
export function partnerRows(airline, vault) {
  const p = TRANSFER_PARTNERS[airline]; if (!p) return [];
  const rows = [];
  for (const [key, rule] of Object.entries(p.rules)) {
    const item = vault && vault[key]; if (!item) continue;
    const pts = Math.max(0, Math.floor(Number(item.points) || 0));
    const plan = transferPlan({ points: pts, transfer: rule });
    rows.push({ key, name: item.name, unit: item.unit, pts, rule, conf: rule.conf, note: rule.note,
      miles: plan.miles, leftPts: plan.orphanPts, nextIn: plan.nextIn, firstBlock: plan.firstBlock });
  }
  return rows.sort((a, b) => b.miles - a.miles || b.pts - a.pts);
}

export function partnerTotal(rows) { return rows.reduce((s, r) => s + r.miles, 0); }

export function partnerSheetHtml(airline, vault) {
  const p = TRANSFER_PARTNERS[airline]; if (!p) return "";
  const rows = partnerRows(airline, vault), total = partnerTotal(rows);
  const body = rows.map(r => `
    <div class="pt-row">
      <div class="pt-main"><div class="pt-name">${escapeHtml(r.name)}</div>
        <div class="pt-sub">${fmtNum(r.pts, 0)} ${escapeHtml(r.unit)} \u00B7 ${fmtNum(r.rule.pts, 0)} : ${fmtNum(r.rule.miles, 0)}${r.conf === "assumed" ? ' <span class="pt-flag" title="' + escapeHtml(r.note || "") + '">verify</span>' : ""}</div></div>
      <div class="pt-num">${r.firstBlock ? '<span class="pt-none">not yet</span>' : fmtNum(r.miles, 0) + " mi"}
        <div class="pt-sub">${r.firstBlock ? fmtNum(r.nextIn, 0) + " to first block" : fmtNum(r.leftPts, 0) + " left \u00B7 " + fmtNum(r.nextIn, 0) + " to next"}</div></div>
    </div>`).join("");
  const notes = rows.filter(r => r.note).map(r => `<li><b>${escapeHtml(r.name)}:</b> ${escapeHtml(r.note)}</li>`).join("");
  return `
    <div class="pt-total">${fmtNum(total, 0)} <span>${escapeHtml(p.short || p.name)} possible now</span></div>
    ${body || '<div class="pt-sub">No points in the currencies that reach this airline yet.</div>'}
    <details class="pt-notes"><summary>Where these ratios come from</summary><ul>${notes}</ul>
      <p>Secondary sources (MileLion, ShopBack, Oct 2026). Rows marked <b>verify</b> reuse the KrisFlyer ratio because the source only says the bank uses one ratio for every airline. Banks charge a fee per transfer (about S$25 to S$27.25, none for HSBC); it is not counted here. Trust and yuu do not transfer to ${escapeHtml(p.short || p.name)}. KrisFlyer miles you already hold cannot move to another airline. Conversions cannot be reversed: check award space and the bank\u2019s own page first.</p></details>`;
}

export function openPartners(airline = "asiamiles", vault) {
  const box = document.getElementById("partnersBody"); if (!box) return;
  const p = TRANSFER_PARTNERS[airline];
  const t = document.getElementById("partnersTitle"); if (t && p) t.textContent = "Where can my points go: " + (p.short || p.name);
  box.innerHTML = partnerSheetHtml(airline, vault);
  document.getElementById("partnersOverlay")?.classList.add("open");
}
export function closePartners() { document.getElementById("partnersOverlay")?.classList.remove("open"); }
