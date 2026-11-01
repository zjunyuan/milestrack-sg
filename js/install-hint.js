// iPhone / iPad install hint (v1.61.0). iOS has no install button for web apps: the only way is Share > Add to Home Screen.
// This shows a short guide, only on iOS, only when the app is not already running from the Home Screen, and only until it is closed.
// v1.63.2: Settings > Data has an "Install on iPhone" row that opens the same guide on demand (even after "Don't show again"),
// and the guide adds a line when the page is open in a browser other than Safari.
// Nothing is stored except one localStorage flag (wrapped in try/catch: private windows can throw).
const KEY = "milestrack_install_hint";

export function isIos(ua = navigator.userAgent, platform = navigator.platform, touchPoints = navigator.maxTouchPoints) {
  return /iPhone|iPad|iPod/.test(ua) || (platform === "MacIntel" && touchPoints > 1);   // iPadOS reports itself as a Mac
}
export function isStandalone() {
  try { return navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches; } catch (_) { return false; }
}
export function isNonSafariIos(ua = navigator.userAgent) {
  return /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua);   // Chrome, Firefox, Edge, Opera, Google app on iPhone
}
export const canShowInstallHelp = () => isIos() && !isStandalone();
const dismissed = () => { try { return localStorage.getItem(KEY) === "1"; } catch (_) { return false; } };
export function shouldShowInstallHint() {
  if (new URLSearchParams(location.search).has("iosHint")) return true;   // ?iosHint forces it, to preview on a computer
  return isIos() && !isStandalone() && !dismissed();
}

const SHARE_ICON = `<svg class="ih-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M12 15V3m0 0L8 7m4-4l4 4M7 11H6a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>`;

function buildHint() {
  if (document.getElementById("installHint")) return;
  const box = document.createElement("div");
  box.id = "installHint"; box.className = "install-hint"; box.setAttribute("role", "dialog");
  const safariNote = isNonSafariIos() ? `<div class="ih-why"><b>Use Safari.</b> This page is open in another browser, so the steps below may look different. Open this page in Safari first.</div>` : "";
  box.innerHTML = `
    <button class="ih-close" id="ihClose" aria-label="Close">&times;</button>
    <div class="ih-title">Install MilesTrack on your iPhone</div>
    ${safariNote}
    <ol class="ih-steps">
      <li>Tap <b>Share</b> ${SHARE_ICON} in the browser toolbar (tap <b>&bull;&bull;&bull;</b> first if you do not see it).</li>
      <li>Scroll down and tap <b>Add to Home Screen</b>.</li>
      <li>Tap <b>Add</b>. Open MilesTrack from your Home Screen.</li>
    </ol>
    <div class="ih-why">It opens full screen like an app and your data stays on this device longer. You will sign in with Google once more inside the Home Screen app.</div>
    <button class="ih-done" id="ihDone">Don't show again</button>`;
  document.body.appendChild(box);
  const hide = (forever) => { if (forever) { try { localStorage.setItem(KEY, "1"); } catch (_) { /* optional */ } } box.remove(); };
  box.querySelector("#ihClose").addEventListener("click", () => hide(false));   // closes for this visit only
  box.querySelector("#ihDone").addEventListener("click", () => hide(true));
}

export function initInstallHint() {
  if (!shouldShowInstallHint()) return;
  buildHint();
}

// Settings > Data row: shown only where the guide applies (iPhone/iPad, not already on the Home Screen, or ?iosHint to preview).
export function initInstallHelp() {
  const row = document.getElementById("btnInstallHelp");
  if (!row) return;
  if (canShowInstallHelp() || new URLSearchParams(location.search).has("iosHint")) row.style.display = "";
  row.addEventListener("click", () => {
    document.getElementById("settingsOverlay")?.classList.remove("open");   // the guide sits under open sheets otherwise
    buildHint();
  });
}
