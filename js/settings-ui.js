// Settings & Card Wallet sheet: icon tabs, one row per physical card grouped by bank, per-card settings inside each row, and a dates overview.
// The inputs keep their original ids (uobLsRenewalInput, uobVsCutoff, citiApprovalInput, ...), so saveSettings() in ui.js reads them unchanged.
import { state } from "./state.js";
import { ALL_MASTER_CARDS, APP_VERSION, cardShort } from "./config.js";
import { familyOf } from "./statements.js";
import { escapeHtml } from "./retailers.js";
import { postingRule, BASIS_LABEL } from "./posting.js";

const $ = id => document.getElementById(id);
const icon = (name, cls = "") => `<span class="material-symbols-outlined ${cls}">${name}</span>`;

const BANKS = [["uob", "UOB"], ["dbs", "DBS"], ["citi", "Citi"], ["ocbc", "OCBC"], ["hsbc", "HSBC"], ["mb", "Maybank"]];
const bankOf = id => (id.startsWith("kf-uob") || id.startsWith("uob-")) ? "uob" : id.split("-")[0];

// Per-card settings, keyed by the first entry of each card family. kind "month" = a renewal / start month, "day" = statement cycle start day.
const CARD_FIELDS = {
  "uob-ls-dining": [{ id: "uobLsRenewalInput", kind: "month", yearly: true, label: "Annual fee renewal month", short: "Renews" }],
  "uob-vs-contactless": [
    { id: "uobVsRenewalInput", kind: "month", yearly: true, label: "Annual fee renewal month", short: "Renews" },
    { id: "uobVsCutoff", kind: "day", label: "Statement cycle starts on day", short: "Cycle from", hint: "The day after your statement date. Statement date 24th means enter 25." }
  ],
  "uob-ppv-contactless": [{ id: "uobPpvRenewalInput", kind: "month", yearly: true, label: "Annual fee renewal month", short: "Renews" }],
  "uob-prvi": [{ id: "uobPrviRenewalInput", kind: "month", yearly: true, label: "Annual fee renewal month", short: "Renews" }],
  "kf-uob": [{ id: "kfUobRenewalInput", kind: "month", yearly: true, label: "Membership year starts (month)", short: "Year starts" }],
  "citi-rewards": [
    { id: "citiApprovalInput", kind: "month", label: "Approval month (5-year cycle)", short: "Approved" },
    { id: "citiCutoff", kind: "day", label: "Statement cycle starts on day", short: "Cycle from", hint: "The day after your statement date. Statement date 28th means enter 29." }
  ]
};

const ordinal = n => { n = Number(n); const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const monthLabel = ym => { const [y, m] = String(ym).split("-").map(Number); return y && m ? new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : ""; };
const monthsAway = ym => { const [y, m] = String(ym).split("-").map(Number); if (!y || !m) return null; const now = new Date(); return (y - now.getFullYear()) * 12 + (m - 1 - now.getMonth()); };
const monthOnly = ym => { const [y, m] = String(ym).split("-").map(Number); return y && m ? new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "short" }) : ""; };
// Yearly dates (annual fee renewal, membership year) repeat every year, so only the month matters.
const fieldText = (f, v) => f.kind === "day" ? `the ${ordinal(v)}` : f.yearly ? `every ${monthOnly(v)}` : monthLabel(v);
// Months until a yearly date next comes round (0 = this month).
const monthsToNext = ym => { const m = Number(String(ym).split("-")[1]); return m ? (((m - 1 - new Date().getMonth()) % 12) + 12) % 12 : null; };

// One entry per physical card: { key, ids, name, bank }.
function walletRows() {
  const seen = new Set(), rows = [];
  for (const c of ALL_MASTER_CARDS) {
    if (seen.has(c.id)) continue;
    const ids = familyOf(c.id).filter(id => ALL_MASTER_CARDS.some(x => x.id === id));
    ids.forEach(id => seen.add(id));
    const first = ALL_MASTER_CARDS.find(x => x.id === ids[0]);
    rows.push({ key: ids[0], ids, name: ids.length > 1 ? cardShort(first).replace(/\.[^.]*$/, "") : cardShort(first), bank: bankOf(first.id), card: first });
  }
  return rows;
}

function thumb(card) {
  return card.image
    ? `<img class="wal-thumb" src="${escapeHtml(card.image)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`
    : `<span class="wal-thumb wal-thumb-ph">${icon("credit_card")}</span>`;
}

function fieldHtml(f) {
  const attrs = f.kind === "day" ? `type="number" min="1" max="31" inputmode="numeric"` : `type="month"`;
  return `<div class="form-group wal-field">
    <label for="${f.id}">${icon(f.kind === "day" ? "calendar_month" : "event_repeat")} ${escapeHtml(f.label)}</label>
    <input ${attrs} id="${f.id}" class="form-control">
    ${f.hint ? `<div class="hm-note">${escapeHtml(f.hint)}</div>` : ""}
  </div>`;
}

function rowHtml(r) {
  const fields = CARD_FIELDS[r.key] || [];
  const multi = r.ids.length > 1;
  const rule = postingRule(r.card);
  const basis = rule ? BASIS_LABEL[rule.basis] : null;
  const cycle = r.card.cycleType === "statement" ? "Statement cycle" : r.card.cycleType === "uncapped" ? "No monthly cap" : "Calendar month";
  const expandable = fields.length || multi || basis;
  const masterAttrs = multi ? `class="wal-master"` : `class="wal-master card-wallet-check" value="${r.ids[0]}"`;
  const checked = r.ids.some(id => state.enabledCardIds.includes(id));
  return `<div class="wal-row ${checked ? "" : "off"}" data-key="${r.key}">
    <div class="wal-main">
      ${thumb(r.card)}
      <div class="wal-name"><b>${escapeHtml(r.name)}</b><div class="wal-sub" data-sub="${r.key}"></div></div>
      ${expandable ? `<button type="button" class="wal-chev" aria-label="Details" aria-expanded="false">${icon("expand_more")}</button>` : ""}
      <label class="wal-switch" title="${checked ? "In my wallet" : "Not in my wallet"}"><input type="checkbox" ${masterAttrs} data-key="${r.key}" ${checked ? "checked" : ""}><span></span></label>
    </div>
    ${expandable ? `<div class="wal-body" hidden>
      <div class="wal-tags">
        <span class="wal-tag">${icon("calendar_clock")} ${cycle}</span>
        ${basis ? `<span class="wal-tag">${icon(rule.basis === "transaction" ? "shopping_cart" : "receipt_long")} ${escapeHtml(basis.short)}</span>` : ""}
      </div>
      ${fields.map(fieldHtml).join("")}
      ${multi ? `<div class="wal-chan"><div class="hm-note">${icon("alt_route")} Channels in your wallet</div>${r.ids.map(id => {
        const c = ALL_MASTER_CARDS.find(x => x.id === id);
        return `<label class="wal-chan-item"><input type="checkbox" class="card-wallet-check" value="${id}" ${state.enabledCardIds.includes(id) ? "checked" : ""}> <span>${escapeHtml(cardShort(c))}</span></label>`;
      }).join("")}</div>` : ""}
    </div>` : ""}
  </div>`;
}

export function renderCardWallet() {
  const box = $("cardChecklistContainer");
  if (!box) return;
  const rows = walletRows();
  box.innerHTML = BANKS.map(([code, label]) => {
    const list = rows.filter(r => r.bank === code);
    if (!list.length) return "";
    const on = list.filter(r => r.ids.some(id => state.enabledCardIds.includes(id))).length;
    return `<section class="wal-group"><div class="wal-group-head">${icon("account_balance")} <b>${label}</b> <span>${on}/${list.length}</span></div>${list.map(rowHtml).join("")}</section>`;
  }).join("");
}

// Collapsed-row summary chips and the dates tab, from the current input values.
export function refreshSettingsSummaries() {
  document.querySelectorAll(".wal-row").forEach(row => {
    const key = row.dataset.key;
    const sub = row.querySelector(`[data-sub="${key}"]`);
    if (!sub) return;
    const chips = (CARD_FIELDS[key] || []).map(f => {
      const v = $(f.id)?.value;
      return v ? `<span class="wal-chip">${icon(f.kind === "day" ? "calendar_month" : "event_repeat")} ${escapeHtml(f.short)} ${escapeHtml(fieldText(f, v))}</span>` : "";
    }).join("");
    sub.innerHTML = chips;
  });
  renderDatesTab();
}

function renderDatesTab() {
  const box = $("setDatesList");
  if (!box) return;
  const items = [];
  for (const r of walletRows()) {
    const on = r.ids.some(id => document.querySelector(`.card-wallet-check[value="${id}"]`)?.checked);
    if (!on) continue;
    for (const f of CARD_FIELDS[r.key] || []) {
      const v = $(f.id)?.value;
      if (v) items.push({ r, f, v });
    }
  }
  const order = i => i.f.yearly ? (monthsToNext(i.v) ?? 999) : 1000;
  items.sort((a, b) => order(a) - order(b));
  box.innerHTML = items.length ? items.map(({ r, f, v }) => {
    let badge = "";
    if (f.yearly) {
      const n = monthsToNext(v);
      badge = n === null ? "" : `<span class="wal-badge ${n <= 1 ? "soon" : ""}">${n === 0 ? "this month" : n === 1 ? "next month" : `in ${n} mo`}</span>`;
    }
    return `<button type="button" class="wal-date" data-key="${r.key}">${icon(f.kind === "day" ? "calendar_month" : "event_repeat", "wal-date-ico")}
      <span class="wal-date-main"><b>${escapeHtml(r.name)}</b><small>${escapeHtml(f.label)}: ${escapeHtml(fieldText(f, v))}</small></span>${badge}${icon("chevron_right")}</button>`;
  }).join("") : `<div class="hm-note">No dates set yet. Open a card on the Cards tab to add its renewal month or statement start day.</div>`;
}

export function showSettingsTab(tab) {
  document.querySelectorAll(".set-tab").forEach(b => { const on = b.dataset.tab === tab; b.classList.toggle("active", on); b.setAttribute("aria-selected", on ? "true" : "false"); });
  document.querySelectorAll("[data-panel]").forEach(p => { p.hidden = p.dataset.panel !== tab; });
  const save = $("setFooter"); if (save) save.hidden = tab === "data";
  if (tab === "dates") renderDatesTab();
}

function openRow(key) {
  showSettingsTab("cards");
  const row = document.querySelector(`.wal-row[data-key="${key}"]`);
  if (!row) return;
  toggleRow(row, true);
  row.scrollIntoView({ block: "center", behavior: "smooth" });
}

function toggleRow(row, open) {
  const body = row.querySelector(".wal-body"), chev = row.querySelector(".wal-chev");
  if (!body) return;
  const want = open === undefined ? body.hidden : open;
  body.hidden = !want;
  chev?.setAttribute("aria-expanded", want ? "true" : "false");
  row.classList.toggle("open", want);
}

// Called by openSettingsModal after the values are filled in.
export function prepareSettingsSheet() {
  refreshSettingsSummaries();
  showSettingsTab("cards");
  const v = $("setVersion"); if (v) v.textContent = `MilesTrack SG ${APP_VERSION}`;
}

export function initSettingsUi() {
  document.querySelectorAll(".set-tab").forEach(b => b.addEventListener("click", () => showSettingsTab(b.dataset.tab)));
  const box = $("cardChecklistContainer");
  box?.addEventListener("click", e => {
    const chev = e.target.closest(".wal-chev");
    if (chev) { toggleRow(chev.closest(".wal-row")); return; }
    const main = e.target.closest(".wal-main");
    if (main && !e.target.closest(".wal-switch")) { const row = main.closest(".wal-row"); if (row.querySelector(".wal-body")) toggleRow(row); }
  });
  box?.addEventListener("change", e => {
    const row = e.target.closest(".wal-row");
    if (!row) return;
    if (e.target.classList.contains("wal-master") && !e.target.classList.contains("card-wallet-check")) {
      row.querySelectorAll(".wal-chan .card-wallet-check").forEach(m => { m.checked = e.target.checked; });   // one switch for every channel of the card
    } else if (e.target.closest(".wal-chan")) {
      const members = [...row.querySelectorAll(".wal-chan .card-wallet-check")];
      const master = row.querySelector(".wal-master");
      master.checked = members.some(m => m.checked);
      master.indeterminate = members.some(m => m.checked) && !members.every(m => m.checked);
    }
    const on = row.querySelector(".wal-master").checked;
    row.classList.toggle("off", !on);
    const group = row.closest(".wal-group");
    if (group) { const rows = [...group.querySelectorAll(".wal-row")]; group.querySelector(".wal-group-head span").textContent = `${rows.filter(r => !r.classList.contains("off")).length}/${rows.length}`; }
    refreshSettingsSummaries();
  });
  box?.addEventListener("input", refreshSettingsSummaries);
  $("setDatesList")?.addEventListener("click", e => { const b = e.target.closest(".wal-date"); if (b) openRow(b.dataset.key); });
  $("btnSetPostingInfo")?.addEventListener("click", () => { $("settingsOverlay")?.classList.remove("open"); window.dispatchEvent(new Event("open-posting-sheet")); });
}
