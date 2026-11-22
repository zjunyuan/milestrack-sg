// Ask box (v1.63.82): a sentence such as "I'm going to spend $50 at dintaifung, which card?" is read for an amount, a merchant and
// (when it says so) online or in person, and those fill the recommender's own boxes. The recommender then answers as usual, so the
// answer only ever comes from the app's own card rules, caps and the signed-in person's cards. Nothing is sent anywhere.
// parseAsk() is pure (no DOM, no state) so it can be tested on its own.
import { state } from "./state.js";
import { buildRetailerList, searchRetailers, normalizeText, escapeHtml } from "./retailers.js";
import { applyRetailerSelection, runRecommendation } from "./recommender.js";
import { setSearchMode } from "./search-mode.js";

const NUM = String.raw`(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?`;
// Tried in order: "$50" / "S$50" / "SGD 50", then "50 dollars" / "50sgd", then "spend 50", then any number standing alone
// (not part of a word, so the 7 in "7-Eleven" is not an amount).
const AMOUNT_RES = [
  new RegExp(String.raw`(?:s\$|sgd\s*|\$)\s*${NUM}\s*(k)?\b`, "i"),
  new RegExp(String.raw`(?<![\w-])${NUM}\s*(k)?\s*(?:dollars?|bucks|sgd)\b`, "i"),
  new RegExp(String.raw`\b(?:spend|spending|spent|pay|paying|paid|costs?|for|of|about|around)\s+${NUM}\s*(k)?(?![\w-])`, "i"),
  new RegExp(String.raw`(?<![\w$-])${NUM}\s*(k)?(?![\w-])`, "i")
];

const ONLINE_RE = /\b(online|on line|in[- ]?app|app|website|web ?site|on the web|delivery|deliver|e-?commerce|order(?:ing)? online)\b/i;
const INPERSON_RE = /\b(in[- ]?person|in[- ]?store|at the (?:counter|shop|store|outlet|restaurant)|tap(?:ping)?|terminal|physical(?:ly)?)\b/i;

// Words that say nothing about the merchant: dropped before matching names and from the text shown when nothing matched.
const FILLER = new Set(("i im ive id am is are was be been will would going gonna go to want wanna plan planning about around approx " +
  "spend spending spent pay paying paid buy buying bought get getting order ordering ordered use using swipe swiping charge " +
  "at on in for from with of the a an my our some this that it which what whats card cards best better should could can do does " +
  "me tell please pls thanks thank you dollars dollar bucks sgd s total bill worth k and or if so then now today tonight tomorrow " +
  "online app website web delivery person store tap terminal counter shop outlet").split(" "));
// Names and aliases that are everyday words in a sentence ("for my trip"), only matched when they are the whole merchant text.
const COMMON = new Set(["trip", "sit", "typo", "tax", "train", "bus", "cab", "taxi", "metro", "coach", "alley", "unity", "panda", "flora", "boss", "apple", "steam", "mango", "omega", "jumbo", "giant", "shell"]);

function readAmount(text) {
  for (const re of AMOUNT_RES) {
    const m = re.exec(text);
    if (!m) continue;
    let v = Number(m[1].replace(/,/g, "") + (m[2] ? "." + m[2] : ""));
    if (m[3]) v *= 1000;
    if (!(v > 0)) continue;
    return { amount: Math.round(v * 100) / 100, rest: text.slice(0, m.index) + " " + text.slice(m.index + m[0].length) };
  }
  return { amount: null, rest: text };
}

// Best retailer named anywhere in the words: a whole-word match of a name or alias ("din tai fung", "dtf"), or the name with its spaces
// taken out lining up with word edges ("dintaifung", "coldstorage"). Longest wins, so "Cold Storage" beats "Cold".
function findNamed(words, list) {
  const s = ` ${words.join(" ")} `;
  const compact = words.join("");
  const starts = new Set(), ends = new Set();
  let pos = 0;
  for (const w of words) { starts.add(pos); pos += w.length; ends.add(pos); }
  const onlyText = words.join(" ");
  let best = null;
  for (const r of list) {
    for (const raw of [r.name, ...(r.aliases || [])]) {
      const n = normalizeText(raw);
      if (!n) continue;
      const isWhole = n === onlyText;
      if (!isWhole && (n.length < 3 || COMMON.has(n))) continue;
      let hit = isWhole || s.includes(` ${n} `);
      if (!hit) {
        const c = n.replace(/ /g, "");
        if (c.length >= 4) {
          let i = compact.indexOf(c);
          while (i !== -1 && !hit) { hit = starts.has(i) && ends.has(i + c.length); i = compact.indexOf(c, i + 1); }
        }
      }
      const score = n.replace(/ /g, "").length + (r.source === "household" ? 0.5 : 0);
      if (hit && (!best || score > best.score)) best = { retailer: r, score };
    }
  }
  return best && best.retailer;
}

// parseAsk("I'm spending $50 at dintaifung, which card?", retailers) →
//   { amount: 50, channel: null | "online" | "inperson", retailer: {...} | null, merchantText: "dintaifung" }
export function parseAsk(text, retailers, overrides = {}) {
  const raw = String(text || "").trim();
  const { amount, rest } = readAmount(raw);
  const words = normalizeText(rest).split(" ").filter(Boolean);
  let retailer = findNamed(words, retailers);
  // What is left once the filler is gone is the merchant as typed ("din tai fong"); a close spelling of one brand is accepted.
  const left = words.filter(w => !FILLER.has(w));
  const merchantText = left.join(" ");
  if (!retailer && merchantText.length >= 4) {
    const [top, second] = searchRetailers(merchantText, overrides, 2);
    if (top && top.score >= 45 && !(second && second.score === top.score && second.retailer.slug !== top.retailer.slug)) retailer = top.retailer;
  }
  // Online / in person, read from the words that are not part of the merchant's own name ("FairPrice App" is not "in the app").
  let chanText = ` ${normalizeText(rest)} `;
  if (retailer) for (const n of [retailer.name, ...(retailer.aliases || [])].map(normalizeText).filter(Boolean)) chanText = chanText.split(` ${n} `).join(" ");
  const channel = ONLINE_RE.test(chanText) ? "online" : INPERSON_RE.test(chanText) ? "inperson" : null;
  return { amount, channel, retailer: retailer || null, merchantText };
}

// ---- screen -----------------------------------------------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const money = (n) => "S$" + Number(n).toLocaleString("en-SG", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 });

function setChannel(ch) {
  if (!ch || state.currentChannel === ch || state.isKrisPlusMode) return;
  $(ch === "online" ? "btnChannelOnline" : "btnChannelInPerson")?.click();   // the buttons' own handlers keep the rest of the screen in step
}

function ask() {
  const input = $("askInput"), echo = $("askEcho");
  const text = (input?.value || "").trim();
  if (!text) { input?.focus(); return; }
  const r = parseAsk(text, buildRetailerList(state.merchantOverrides), state.merchantOverrides);
  if (!r.retailer && !r.merchantText) {
    echo.innerHTML = `Add where you're paying, e.g. <b>$50 at Din Tai Fung</b>.`;
    return;
  }
  const box = $("mccInput");
  if (r.retailer) {
    applyRetailerSelection(r.retailer.name, r.retailer.mcc);
  } else if (box) {
    // Not in the retailer list: the text goes into the search box as typed, where Kris+ merchants and categories are still tried.
    setSearchMode("retailer");
    state.selectedRetailer = null;
    box.value = r.merchantText;
    delete box.dataset.committed;
    box.closest(".mcc-input-wrapper")?.classList.remove("has-selection");
  }
  const x = $("btnClearMcc"); if (x) x.style.display = "flex";
  if (r.amount) $("recAmount").value = String(r.amount);
  setChannel(r.channel);
  runRecommendation();
  try { if (box?.value && $("recAmount")?.value) localStorage.setItem("milestrack_onb_rec", "1"); } catch (e) { /* private mode */ }

  const where = r.retailer ? `<b>${escapeHtml(r.retailer.name)}</b>` : `“${escapeHtml(r.merchantText)}” <span class="ask-warn">(not a known retailer)</span>`;
  const amt = r.amount ? ` · ${money(r.amount)}` : ` · <span class="ask-warn">add an amount</span>`;
  const ch = (state.isKrisPlusMode || state.currentChannel === "online") ? "online / in-app" : "in person";
  echo.innerHTML = `${where}${amt} · ${ch}`;
  input.blur();                                                                        // closes the phone keyboard so the answer shows
  if (!r.amount) $("recAmount")?.focus();
  else setTimeout(() => $("recResultArea")?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 60);
}

export function initAsk() {
  $("askForm")?.addEventListener("submit", (e) => { e.preventDefault(); ask(); });
  $("askInput")?.addEventListener("input", () => { if (!$("askInput").value.trim()) $("askEcho").innerHTML = ""; });
}
