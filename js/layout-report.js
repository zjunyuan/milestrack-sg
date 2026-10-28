// Phone layout report. Open the app with ?layout to show a small "📐" button. Tap it after reproducing a problem and it copies a text report
// (screen and visible-area sizes, keyboard state, where the result and floating + sit, and the last focus/resize events) to paste back.
// ?layout=0 turns it off again. Nothing is sent anywhere; no account or spend data is included.
import { APP_VERSION } from "./config.js";

const KEY = "mt_layout";
const events = [];
const t0 = Date.now();
const log = (m) => { events.push(`${((Date.now() - t0) / 1000).toFixed(1)}s ${m}`); if (events.length > 60) events.shift(); };
const q = (s) => document.querySelector(s);
const r = (n) => Math.round(n);

function rect(sel) {
  const el = q(sel); if (!el) return "(missing)";
  const b = el.getBoundingClientRect(), cs = getComputedStyle(el);
  return `top ${r(b.top)}, bottom ${r(b.bottom)}, h ${r(b.height)}${cs.display === "none" ? ", HIDDEN" : ""}`;
}
function desc(el) { return el ? `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}` : "none"; }

function inset(side) {
  const p = document.createElement("div");
  p.style.cssText = `position:fixed;visibility:hidden;padding-${side}:env(safe-area-inset-${side},0px)`;
  document.body.appendChild(p);
  const v = parseFloat(getComputedStyle(p)[`padding${side[0].toUpperCase()}${side.slice(1)}`]) || 0;
  p.remove();
  return r(v);
}

export function buildReport() {
  const vv = window.visualViewport;
  const lines = [
    `MilesTrack ${APP_VERSION} layout report`,
    `Browser: ${navigator.userAgent}`,
    `Standalone (home-screen app): ${!!navigator.standalone || matchMedia("(display-mode: standalone)").matches}`,
    `Coarse pointer: ${matchMedia("(pointer: coarse)").matches}`,
    `DPR ${window.devicePixelRatio}, screen ${screen.width}x${screen.height}`,
    `Window inner ${innerWidth}x${innerHeight}, document client ${document.documentElement.clientWidth}x${document.documentElement.clientHeight}`,
    vv ? `Visual viewport ${r(vv.width)}x${r(vv.height)}, offsetTop ${r(vv.offsetTop)}, scale ${vv.scale.toFixed(2)}` : "Visual viewport: not supported",
    `Keyboard guess (window - visual height): ${vv ? r(innerHeight - vv.height) : "?"}`,
    `Safe-area insets: top ${inset("top")}, bottom ${inset("bottom")}`,
    `body.kb-open: ${document.body.classList.contains("kb-open")}`,
    `Active element: ${desc(document.activeElement)}`,
    `Scroll Y: ${r(scrollY)}`,
    `#mccInput: ${rect("#mccInput")}`,
    `#recResultArea: ${rect("#recResultArea")}`,
    `FAB: ${rect("#fabButton")}`,
    `Bottom nav: ${rect("#bottomNav")}`,
    "",
    "Recent events:",
    ...(events.length ? events : ["(none yet)"])
  ];
  return lines.join("\n");
}

function showFallback(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.cssText = "position:fixed;inset:60px 10px auto 10px;height:50vh;z-index:100001;background:#0f172a;color:#e2e8f0;font:11px/1.4 monospace;border:1px solid #3b82f6;border-radius:10px;padding:8px;";
  ta.addEventListener("blur", () => ta.remove());
  document.body.appendChild(ta); ta.focus(); ta.select();
}

export function initLayoutReport() {
  try {
    const m = /[?&]layout(?:=(\w+))?/.exec(location.search);
    if (m) { if (m[1] === "0") localStorage.removeItem(KEY); else localStorage.setItem(KEY, "1"); }
    if (!localStorage.getItem(KEY)) return;
  } catch (e) { if (!/[?&]layout\b/.test(location.search)) return; }

  document.addEventListener("focusin", (e) => log(`focus ${desc(e.target)}`));
  document.addEventListener("focusout", (e) => log(`blur ${desc(e.target)}`));
  document.addEventListener("pointerdown", (e) => { const it = e.target.closest && e.target.closest(".rs-item"); if (it) log(`picked suggestion "${(it.textContent || "").trim().slice(0, 30)}"`); }, true);
  if (window.visualViewport) {
    let last = 0;
    visualViewport.addEventListener("resize", () => { const n = Date.now(); if (n - last > 120) { last = n; log(`visual viewport resize ${r(visualViewport.width)}x${r(visualViewport.height)} top ${r(visualViewport.offsetTop)}`); } });
  }

  const b = document.createElement("button");
  b.type = "button"; b.textContent = "📐";
  b.title = "Copy layout report";
  b.style.cssText = "position:fixed;left:8px;top:calc(8px + env(safe-area-inset-top,0px));z-index:100000;width:38px;height:38px;border-radius:12px;border:1px solid #3b82f6;background:rgba(15,23,42,0.92);color:#fff;font-size:18px;";
  b.addEventListener("pointerdown", (e) => e.preventDefault());   // keep the keyboard and focus as they are
  b.addEventListener("click", async () => {
    const text = buildReport();
    try { await navigator.clipboard.writeText(text); b.textContent = "✅"; setTimeout(() => (b.textContent = "📐"), 1500); }
    catch (e) { showFallback(text); }
  });
  document.body.appendChild(b);
}
