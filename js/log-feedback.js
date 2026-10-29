// Feedback after logging a transaction: a toast (with optional Undo) and the split-payment checklist.
// Pure DOM + state, no imports from ui.js, so ui.js and recommender.js can both use it.

let toastTimer = null;
let logCtx = null;                              // where the open log form came from: null, or { kind: 'single' } / { kind: 'split', key, part, total }
let split = { key: '', parts: {}, total: 0 };   // parts: { [partIndex]: { txId, tx } }

export function setLogContext(ctx) { logCtx = ctx || null; }
export function getLogContext() { return logCtx; }

function toastEl() {
  let el = document.getElementById('logToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'logToast';
    el.className = 'log-toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  return el;
}

// kind: 'ok' | 'error'. Errors stay longer. onAction runs once when the action link is tapped.
export function showToast(message, { kind = 'ok', actionLabel = '', onAction = null, ms } = {}) {
  const el = toastEl();
  clearTimeout(toastTimer);
  el.className = `log-toast ${kind === 'error' ? 'err' : 'ok'}`;
  el.innerHTML = '';
  const msg = document.createElement('span');
  msg.className = 'lt-msg';
  msg.textContent = message;
  el.appendChild(msg);
  if (actionLabel && onAction) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'lt-action';
    b.textContent = actionLabel;
    b.addEventListener('click', () => { hideToast(); onAction(); });
    el.appendChild(b);
  }
  requestAnimationFrame(() => el.classList.add('visible'));
  toastTimer = setTimeout(hideToast, ms || (kind === 'error' ? 8000 : 5000));
}

export function hideToast() {
  clearTimeout(toastTimer);
  document.getElementById('logToast')?.classList.remove('visible');
}

// ---- split checklist ---------------------------------------------------------------------------------------------------------
// Called after the split tiles are drawn. A new plan (different key) starts with nothing logged.
export function syncSplit(area, key, total) {
  if (split.key !== key) split = { key, parts: {}, total };
  paintSplit(area);
}

export function markSplitLogged(part, tx) {
  if (!split.key) return 0;
  split.parts[part] = { txId: tx.id, tx };
  paintSplit(document.getElementById('recResultArea'));
  return Object.keys(split.parts).length;
}

export function unmarkSplitByTx(txId) {
  for (const [i, p] of Object.entries(split.parts)) if (p.txId === txId) delete split.parts[i];
  paintSplit(document.getElementById('recResultArea'));
}

export function splitCount() { return Object.keys(split.parts).length; }
export function splitTotal() { return split.total; }
export function splitKey() { return split.key; }

function paintSplit(area) {
  const head = area?.querySelector('.cascade-header');
  if (!head) return;
  const n = Object.keys(split.parts).length;
  let line = area.querySelector('.split-progress');
  if (!n) { line?.remove(); }
  else {
    if (!line) { line = document.createElement('div'); line.className = 'split-progress'; head.after(line); }
    line.classList.toggle('done', n >= split.total);
    line.textContent = n >= split.total ? `✅ All ${split.total} cards logged` : `${n} of ${split.total} logged`;
  }
  area.querySelectorAll('.btn-apply-rec[data-part]').forEach(btn => {
    const logged = !!split.parts[btn.dataset.part];
    const tile = btn.closest('.card-tile');
    tile?.classList.toggle('ct-logged', logged);
    btn.disabled = logged;
    btn.textContent = logged ? '✓ Logged' : 'Log';
    btn.classList.toggle('is-logged', logged);
  });
}
