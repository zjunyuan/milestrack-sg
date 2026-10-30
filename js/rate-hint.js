// "Rate to use" on the log form: pre-selects Bonus or Base from the merchant and the chosen card slot, and says why.
// Only on a new entry, only until the user changes the select themselves; the yuu card has its own rule (yuu.js).
import { resolveMccEntry } from "./recommender.js";
import { ALL_MASTER_CARDS, cardShort } from "./config.js";
import { escapeHtml } from "./retailers.js";

const $ = id => document.getElementById(id);

export function suggestRate() {
  const sel = $("bonusCategory"), hint = $("rateHint");
  if (!sel || !hint) return;
  hint.textContent = "";
  if (sel.dataset.touched === "1" || ($("editTxId")?.value || "")) return;
  const cardId = $("cardSelect")?.value, desc = ($("descInput")?.value || "").trim();
  const card = ALL_MASTER_CARDS.find(c => c.id === cardId);
  if (!card || card.id === "dbs-yuu") return;
  const back = () => { if (sel.dataset.auto === "1") { sel.value = "bonus"; sel.dataset.auto = ""; } };   // undo our own earlier pick
  if (!desc) return back();
  const entry = resolveMccEntry(desc);
  const list = entry && (cardId.endsWith("-fcy") ? entry.candidatesOverseas : entry.candidatesLocal);
  if (!Array.isArray(list)) return back();   // merchant not recognised: back to the default, never a guess
  const eligible = list.some(c => c.id === cardId);
  sel.value = eligible ? "bonus" : "base"; sel.dataset.auto = eligible ? "" : "1";
  if (!eligible) {
    const name = (entry.retailer && entry.retailer.name) || desc;
    hint.innerHTML = `${escapeHtml(name)} is not a bonus category for ${escapeHtml(cardShort(card))}, so Base rate is selected. Change it if the bank treated it differently.`;
  }
}

export function initRateHint() {
  $("bonusCategory")?.addEventListener("change", () => { $("bonusCategory").dataset.touched = "1"; $("bonusCategory").dataset.auto = ""; if ($("rateHint")) $("rateHint").textContent = ""; });
  $("descInput")?.addEventListener("input", suggestRate);
  $("cardSelect")?.addEventListener("change", suggestRate);
  window.addEventListener("rate-suggest", suggestRate);
}
