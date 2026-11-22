// AI fallback for the Ask box (v1.63.84): when a sentence names a merchant the retailer list does not know, ask Google's Gemini
// (through Firebase AI Logic, Gemini Developer API) for the merchant's most likely MCC. Only the merchant words are sent, never an
// amount, a card or a balance. The answer is checked against the app's own MCC list and the app's rules still pick the card; the
// result says it is an AI guess so it can be corrected with the usual "Wrong category?" tools.
//
// It calls the Firebase AI Logic REST endpoint directly (the same request the firebase/ai SDK makes: POST
// https://firebasevertexai.googleapis.com/v1beta/projects/<project>/models/<model>:generateContent with the web API key and an
// App Check token), so the app keeps its Firebase 10.12.2 SDK and stays buildless. Off until `AI_FALLBACK.siteKey` is set in
// config.js (App Check, reCAPTCHA): the repo is public, so the endpoint must only answer this site.
import { firebaseConfig, AI_FALLBACK, MCC_DATABASE } from "./config.js";
import { MCC_NAMES } from "./mcc-names.js";
import { isKnownMcc, mccName } from "./mcc.js";
import { normalizeText } from "./retailers.js";
import { appCheckToken } from "./firebase.js";
import { isDemo } from "./demo.js";

export const aiFallbackOn = () => !!(AI_FALLBACK && AI_FALLBACK.siteKey) && !isDemo();

const CACHE_KEY = "milestrack_ai_mcc";
const readCache = () => { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); } catch (e) { return {}; } };
const writeCache = (c) => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch (e) { /* full or private mode */ } };

// Every code the app knows, as "5812 Eating Places & Restaurants" lines, so the model picks from codes the app has rules for.
let codeList = "";
function knownCodes() {
  if (codeList) return codeList;
  const codes = new Set([...Object.keys(MCC_NAMES), ...Object.keys(MCC_DATABASE)].filter(c => /^\d{4}$/.test(c)));
  codeList = [...codes].sort().map(c => `${c} ${mccName(c)}`).join("\n");
  return codeList;
}

const prompt = (merchant, channel) => `You classify card payments made by a person living in Singapore.
Merchant text the person typed: "${merchant}"
Paid ${channel === "online" ? "online or in an app" : "in person"}.
Give the Merchant Category Code (ISO 18245) that this merchant's card terminal most likely uses, choosing ONLY from this list:
${knownCodes()}
Also give a short clean merchant name (as the shop is usually called) and your confidence: "high" if you know this merchant,
"medium" if you are inferring from the kind of shop, "low" if you are guessing. If the text is not a merchant, answer mcc "".`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    mcc: { type: "STRING" },
    merchant: { type: "STRING" },
    confidence: { type: "STRING", enum: ["high", "medium", "low"] }
  },
  required: ["mcc", "merchant", "confidence"]
};

// { mcc, name, category, confidence, cached } or throws an Error whose message is safe to show.
export async function guessMcc(merchantText, { channel = "inperson" } = {}) {
  const key = `${channel}|${normalizeText(merchantText)}`;
  const cache = readCache();
  if (cache[key]) return { ...cache[key], cached: true };
  if (!aiFallbackOn()) throw new Error("AI lookup is not set up");

  const token = await appCheckToken();
  if (!token) throw new Error("this device could not get an App Check token");
  const url = `https://firebasevertexai.googleapis.com/v1beta/projects/${firebaseConfig.projectId}/models/${AI_FALLBACK.model}:generateContent`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", "x-goog-api-key": firebaseConfig.apiKey, "X-Firebase-AppCheck": token, "X-Firebase-Appid": firebaseConfig.appId },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt(String(merchantText).slice(0, 120), channel) }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 200, responseMimeType: "application/json", responseSchema: SCHEMA }
      })
    });
  } catch (e) {
    throw new Error(e.name === "AbortError" ? "the AI lookup took too long" : "the AI lookup could not be reached");
  } finally { clearTimeout(timer); }
  if (!res.ok) {
    let msg = "";
    try { msg = (await res.json())?.error?.message || ""; } catch (e) { /* not JSON */ }
    console.warn("AI MCC lookup failed:", res.status, msg);
    throw new Error(res.status === 429 ? "the AI lookup is busy, try again in a minute" : res.status === 403 ? "the AI lookup refused this request (setup or App Check)" : `the AI lookup failed (${res.status})`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
  let out;
  try { out = JSON.parse(text); } catch (e) { throw new Error("the AI answer could not be read"); }
  const mcc = String(out.mcc || "").trim();
  if (!/^\d{4}$/.test(mcc) || !isKnownMcc(mcc)) throw new Error("the AI could not place this merchant");
  const confidence = ["high", "medium", "low"].includes(out.confidence) ? out.confidence : "low";
  const name = String(out.merchant || merchantText).replace(/[<>]/g, "").trim().slice(0, 60) || merchantText;
  const result = { mcc, name, category: mccName(mcc), confidence };
  cache[key] = result;
  const keys = Object.keys(cache);
  if (keys.length > 200) delete cache[keys[0]];                       // keep the cache small, oldest first
  writeCache(cache);
  return { ...result, cached: false };
}
