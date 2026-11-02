// "Copy for Claude" (v1.63.27): copies what History is showing, as plain text, so it can be pasted into a Claude chat with a question
// ("which of these should be base?"). Nothing is sent anywhere by the app: the text only goes where the user pastes it.
// Card numbers never appear (entries hold descriptions and card names only), and descriptions were masked on import.
import { state } from "./state.js";
import { ALL_MASTER_CARDS, cardShort } from "./config.js";
import { pointsSplit } from "./reconcile.js";
import { categoryOf, mccOf } from "./summary.js";

let lastRows = [];
export function setCopyRows(rows) { lastRows = rows || []; }

const day = (ts) => (ts ? new Date(Number(ts)).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "");
const clean = (s) => String(s ?? "").replace(/[\t\r\n]+/g, " ").trim();

export function copyText() {
  const parts = ["Data from my miles-tracking app (MilesTrack SG, Singapore credit cards). My question:", "", ""];
  const banner = document.querySelector(".stmt-banner");
  if (banner) parts.push("STATEMENT CHECK (as the app shows it)", banner.innerText.split("\n").map(l => l.replace(/\s+/g, " ").trim()).filter(l => l && l !== "✕").join("\n"), "");
  const v = state.txView;
  const f = [];
  if (v.cards.length) f.push(`cards: ${v.cards.map(id => cardShort(ALL_MASTER_CARDS.find(c => c.id === id) || { name: id })).join(", ")}`);
  if (v.rate && v.rate !== "ALL") f.push(`rate: ${v.rate}`);
  if (v.cats.length) f.push(`categories: ${v.cats.join(", ")}`);
  if (v.merchant) f.push(`merchant contains "${v.merchant}"`);
  if (f.length) parts.push(`Filter: ${f.join("; ")}`);
  parts.push(`ENTRIES (${lastRows.length}). Base/bonus points are in each bank's own points; "rate" is how the entry is logged.`);
  parts.push(["Trans date", "Posted", "Merchant", "MCC", "Category", "Card", "Amount S$", "Rate", "Base pts", "Bonus pts", "Miles", "Confirmed by statement"].join("\t"));
  let amt = 0, base = 0, bonus = 0, miles = 0;
  for (const t of lastRows) {
    const card = ALL_MASTER_CARDS.find(c => c.id === t.cardId);
    const p = pointsSplit(t);
    amt += Number(t.amt) || 0; base += p.base; bonus += p.bonus; miles += Number(t.miles) || 0;
    parts.push([day(t.timestamp), day(t.postTs), clean(t.desc), mccOf(t.desc, t.mcc) || "", categoryOf(t.desc, t.mcc) || "", card ? cardShort(card) : t.cardId,
      (Number(t.amt) || 0).toFixed(2), t.refunded ? "Refunded" : t.bonusCategory === "base" ? "Base" : "Bonus", p.base, p.bonus, Math.round(Number(t.miles) || 0),
      (t.stmtConfirmed || t.stmtKey || t.source === "statement") ? "yes" : ""].join("\t"));
  }
  parts.push(["Total", "", "", "", "", "", amt.toFixed(2), "", base, bonus, Math.round(miles), ""].join("\t"));
  return parts.join("\n");
}

export async function copyForClaude(btn) {
  const text = copyText();
  let ok = false;
  try { await navigator.clipboard.writeText(text); ok = true; } catch (_) {
    try {                                              // older browsers / no clipboard permission: select a hidden textarea and copy
      const ta = document.createElement("textarea"); ta.value = text; ta.style.cssText = "position:fixed;left:-9999px;top:0";
      document.body.appendChild(ta); ta.select(); ok = document.execCommand("copy"); ta.remove();
    } catch (_) { ok = false; }
  }
  if (btn) { const old = btn.textContent; btn.textContent = ok ? "Copied ✓ paste into Claude" : "Couldn't copy"; setTimeout(() => { btn.textContent = old; }, 2500); }
  return ok;
}
