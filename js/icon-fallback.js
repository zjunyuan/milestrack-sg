// Icons when the icon font cannot load (v1.63.25). The app's icons are ligatures: the text "credit_card" drawn by the icon font as one
// symbol. If no icon font reaches the device (iPhone Lockdown Mode, a content blocker, no network on the first visit), the browser prints
// the words instead and they overlap the labels. This checks, after the page settles, whether an icon actually drew as a single symbol,
// and if not swaps each icon's word for a small emoji (or nothing), now and for anything drawn later.
const EMOJI = {
  account_balance: "🏦", account_balance_wallet: "👛", add: "＋", add_circle: "＋", add_to_home_screen: "📲", alt_route: "↔︎",
  calculate: "🧮", calendar_clock: "🗓️", calendar_month: "🗓️", call_split: "✂︎", check: "✓", chevron_right: "›", close: "✕",
  contactless: "📶", credit_card: "💳", database: "🗄️", delete: "🗑️", donut_large: "🍩", download: "⬇︎", edit: "✏️", event_note: "🗓️",
  event_repeat: "🔁", expand_more: "⌄", fact_check: "☑︎", filter_alt: "⏷", flight_takeoff: "✈︎", history: "🕘", info: "ⓘ", logout: "⎋",
  loyalty: "🏷️", notifications_active: "🔔", receipt_long: "🧾", settings: "⚙︎", shield: "🛡️", shopping_bag: "🛍️", shopping_cart: "🛒",
  storefront: "🏪", swap_horiz: "⇄", table_view: "▦", tag: "#", travel: "🧳", tune: "⚙︎", upload: "⬆︎", upload_file: "📄", wallet: "👛"
};

function iconDrew() {
  const probe = document.createElement("span");
  probe.className = "material-symbols-outlined";
  probe.style.cssText = "position:absolute;left:-9999px;top:0;font-size:24px;visibility:hidden";
  probe.textContent = "credit_card";
  document.body.appendChild(probe);
  const w = probe.getBoundingClientRect().width;
  probe.remove();
  return w > 0 && w < 40;            // one symbol is about 24px wide; the spelled-out word is well over 100px
}

function swap(el) {
  if (el.dataset.icon) return;
  const name = (el.textContent || "").trim();
  el.dataset.icon = name;
  el.textContent = EMOJI[name] || "";
}
const swapAll = (root) => root.querySelectorAll && root.querySelectorAll(".material-symbols-outlined:not([data-icon])").forEach(swap);

export function initIconFallback() {
  const run = () => {
    if (iconDrew()) return;
    document.documentElement.classList.add("no-icon-font");
    swapAll(document);
    new MutationObserver((list) => {
      for (const m of list) for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.classList && node.classList.contains("material-symbols-outlined")) swap(node);
        swapAll(node);
      }
    }).observe(document.body, { childList: true, subtree: true });
  };
  // Give the font time to arrive (it is cached after the first visit), then decide once.
  const later = () => setTimeout(run, 2500);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(later, later); else later();
}
