// "Save as image": draws the tab you are looking at into one long PNG, so a long screenshot does not depend on the phone's own scroll capture.
// The tab is cloned with its computed styles written inline, wrapped in an SVG <foreignObject>, drawn on a canvas and shared (or downloaded).
// Icons come from a web font that cannot be embedded this way, so they are left blank. Nothing leaves the device.

const PROPS = ["display", "position", "top", "right", "bottom", "left", "float", "clear", "z-index", "box-sizing",
  "width", "height", "min-width", "min-height", "max-width", "max-height", "margin", "padding",
  "border", "border-radius", "outline", "background-color", "background-image", "background-size", "background-position", "background-repeat",
  "color", "opacity", "box-shadow", "font-family", "font-size", "font-weight", "font-style", "line-height", "letter-spacing", "text-align",
  "text-decoration", "text-transform", "text-overflow", "white-space", "word-break", "overflow-wrap", "vertical-align", "list-style",
  "flex", "flex-direction", "flex-wrap", "flex-grow", "flex-shrink", "flex-basis", "align-items", "align-self", "align-content", "justify-content", "justify-items", "justify-self", "order", "gap", "row-gap", "column-gap",
  "grid-template-columns", "grid-template-rows", "grid-column", "grid-row", "grid-auto-flow", "grid-auto-columns", "grid-auto-rows",
  "transform", "fill", "stroke", "stroke-width", "accent-color"];

function inlineStyles(src, dst) {
  const cs = getComputedStyle(src);
  let css = "";
  for (const p of PROPS) { const v = cs.getPropertyValue(p); if (v) css += `${p}:${v};`; }
  // No inner scrolling (a scrolling list is shown in full), nothing fixed, nothing animated. Clipped (overflow: hidden) boxes stay clipped: panels
  // that are folded away rely on it.
  css += "animation:none;transition:none;backdrop-filter:none;";
  if (/auto|scroll/.test(cs.overflowY) || /auto|scroll/.test(cs.overflowX)) css += "overflow:visible;max-height:none;" + (src.scrollHeight > src.clientHeight + 1 ? "height:auto;" : "");
  if (cs.position === "fixed" || cs.position === "sticky") css += "position:static;";
  dst.setAttribute("style", css);
  if (src.tagName === "IMG") {                                                  // pictures must be inside the SVG as data, an outside file does not load
    try {
      const c = document.createElement("canvas"); c.width = src.naturalWidth || 1; c.height = src.naturalHeight || 1;
      c.getContext("2d").drawImage(src, 0, 0); dst.setAttribute("src", c.toDataURL("image/png"));
    } catch (e) { dst.removeAttribute("src"); dst.setAttribute("alt", ""); dst.style.visibility = "hidden"; }
    dst.removeAttribute("srcset"); dst.removeAttribute("loading");
  }
  if (src.classList && src.classList.contains("material-symbols-outlined")) dst.textContent = "";      // the icon font is not available inside the picture
  if (src.tagName === "INPUT" || src.tagName === "TEXTAREA") {
    if (src.type === "checkbox" || src.type === "radio") dst.setAttribute(src.checked ? "checked" : "data-off", "");
    else dst.setAttribute("value", src.value);
  }
  if (src.tagName === "DETAILS" && src.open) dst.setAttribute("open", "");      // folded panels stay folded, as on screen
  const sk = src.children, dk = dst.children;
  for (let i = 0; i < sk.length; i++) inlineStyles(sk[i], dk[i]);
}

export async function tabToPng() {
  const tabs = [...document.querySelectorAll(".tab-content")].filter(t => getComputedStyle(t).display !== "none");
  const el = tabs[0] || document.querySelector(".desktop-grid");
  if (!el) throw new Error("Nothing to capture.");
  const rect = el.getBoundingClientRect();
  const w = Math.ceil(rect.width), h = Math.ceil(el.scrollHeight);
  const pair = el.cloneNode(true); inlineStyles(el, pair);
  pair.querySelectorAll("script,template,.modal-overlay,.update-toast,.fab").forEach(n => n.remove());
  const bg = getComputedStyle(document.body).backgroundColor || "#111214";
  pair.style.cssText += `width:${w}px;height:auto;margin:0;padding:12px;box-sizing:border-box;background:${bg};display:block;`;
  const pad = 12, W = w, H = h + pad * 2;
  const html = new XMLSerializer().serializeToString(pair);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><foreignObject x="0" y="0" width="${W}" height="${H}">${html}</foreignObject></svg>`;
  const img = new Image();
  img.decoding = "async";
  await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error("Couldn't draw this screen as a picture.")); img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); });
  const scale = Math.max(1, Math.min(window.devicePixelRatio || 2, 2, 16000 / H));
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(W * scale); canvas.height = Math.floor(H * scale);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale); ctx.drawImage(img, 0, 0);
  const blob = await new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error("Couldn't make the picture.")), "image/png"));
  return { blob, width: canvas.width, height: canvas.height };
}

export async function saveTabImage(toast) {
  try {
    const { blob } = await tabToPng();
    const name = `milestrack-${new Date().toISOString().slice(0, 10)}.png`;
    const file = new File([blob], name, { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: "MilesTrack SG" }); return; } catch (e) { if (e && e.name === "AbortError") return; }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast && toast("Saved as an image in your downloads.");
  } catch (e) { console.error("Save as image failed", e); toast ? toast("Couldn't save this screen as an image: " + (e && e.message ? e.message : e)) : alert(e.message); }
}
