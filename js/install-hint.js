// iPhone / iPad install hint (v1.61.0). iOS has no install button for web apps: the only way is Share > Add to Home Screen.
// This shows a short guide once, only on iOS, only when the app is not already running from the Home Screen, and only until it is closed.
// Nothing is stored except one localStorage flag (wrapped in try/catch: private windows can throw).
const KEY = "milestrack_install_hint";

export function isIos(ua = navigator.userAgent, platform = navigator.platform, touchPoints = navigator.maxTouchPoints) {
  return /iPhone|iPad|iPod/.test(ua) || (platform === "MacIntel" && touchPoints > 1);   // iPadOS reports itself as a Mac
}
export function isStandalone() {
  try { return navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches; } catch (_) { return false; }
}
const dismissed = () => { try { return localStorage.getItem(KEY) === "1"; } catch (_) { return false; } };
export function shouldShowInstallHint() {
  if (new URLSearchParams(location.search).has("iosHint")) return true;   // ?iosHint forces it, to preview on a computer
  return isIos() && !isStandalone() && !dismissed();
}

const SHARE_ICON = `<svg class="ih-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M12 15V3m0 0L8 7m4-4l4 4M7 11H6a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>`;

export function initInstallHint() {
  if (!shouldShowInstallHint() || document.getElementById("installHint")) return;
  const box = document.createElement("div");
  box.id = "installHint"; box.className = "install-hint"; box.setAttribute("role", "dialog");
  box.innerHTML = `
    <button class="ih-close" id="ihClose" aria-label="Close">&times;</button>
    <div class="ih-title">Install MilesTrack on your iPhone</div>
    <ol class="ih-steps">
      <li>Tap <b>Share</b> ${SHARE_ICON} in the browser toolbar (tap <b>&bull;&bull;&bull;</b> first if you do not see it).</li>
      <li>Scroll down and tap <b>Add to Home Screen</b>.</li>
      <li>Tap <b>Add</b>. Open MilesTrack from your Home Screen.</li>
    </ol>
    <div class="ih-why">It opens full screen like an app and your data stays on this device longer.</div>
    <button class="ih-done" id="ihDone">Don't show again</button>`;
  document.body.appendChild(box);
  const hide = (forever) => { if (forever) { try { localStorage.setItem(KEY, "1"); } catch (_) { /* optional */ } } box.remove(); };
  box.querySelector("#ihClose").addEventListener("click", () => hide(false));   // closes for this visit only
  box.querySelector("#ihDone").addEventListener("click", () => hide(true));
}
