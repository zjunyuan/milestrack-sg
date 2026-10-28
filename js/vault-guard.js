// Safety net for points balances. Remembers, on this device only, the last balances seen that were not all zero. If the cloud later says
// every balance is 0 (a reset), a banner offers to put the remembered values back; nothing is written unless you tap Restore.
import { state } from "./state.js";
import { updateVaultDoc } from "./firebase.js";
import { escapeHtml } from "./retailers.js";

const key = () => `milestrack_vault_lastgood_${state.myVaultKey}`;
const sum = (v) => Object.values(v || {}).reduce((t, c) => t + (Number(c?.points) || 0), 0);
const pointsOf = (v) => Object.fromEntries(Object.entries(v || {}).map(([k, c]) => [k, Number(c?.points) || 0]));

function remember() {
  try { if (sum(state.myVault) > 0) localStorage.setItem(key(), JSON.stringify({ at: Date.now(), points: pointsOf(state.myVault) })); } catch (e) {}
}
function lastGood() { try { return JSON.parse(localStorage.getItem(key()) || "null"); } catch (e) { return null; } }

function banner(good) {
  if (document.getElementById("vaultGuardBanner")) return;
  const names = Object.entries(good.points).filter(([, p]) => p > 0).map(([k, p]) => `${escapeHtml(state.myVault[k]?.name || k)} ${p.toLocaleString("en-SG")}`).join(", ");
  const d = document.createElement("div");
  d.id = "vaultGuardBanner";
  d.className = "kp-note";
  d.style.cssText = "position:fixed;left:12px;right:12px;top:12px;z-index:9000;background:#3b1d1d;border-left-color:#ef4444;";
  d.innerHTML = `⚠️ <b>Your points balances now read 0.</b> On ${escapeHtml(new Date(good.at).toLocaleString("en-SG"))} this device saw: ${names}. Restore those?
    <div style="margin-top:8px;"><button type="button" class="btn-backup" id="vgRestore">Restore these balances</button> <button type="button" class="btn-backup" id="vgDismiss">Not now</button></div>`;
  document.body.appendChild(d);
  document.getElementById("vgDismiss").onclick = () => d.remove();
  document.getElementById("vgRestore").onclick = async () => {
    try {
      for (const [k, p] of Object.entries(good.points)) if (state.myVault[k]) state.myVault[k].points = p;
      await updateVaultDoc(state.myVaultKey, state.myVault);
      d.remove(); window.dispatchEvent(new CustomEvent("vault-updated"));
    } catch (e) { alert("Could not restore: " + (e?.message || e)); }
  };
}

export function initVaultGuard() {
  window.addEventListener("vault-updated", () => {
    if (!state.vaultLoaded || !state.myVault) return;
    if (sum(state.myVault) > 0) { remember(); document.getElementById("vaultGuardBanner")?.remove(); return; }
    const good = lastGood();
    if (good && sum({ x: { points: Object.values(good.points).reduce((a, b) => a + b, 0) } }) > 0) banner(good);
  });
}
