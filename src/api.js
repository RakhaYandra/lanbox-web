// Single HTTP layer. Components never fetch directly.
// Credentials: ?token= (QR flow) seeds sessionStorage; login screen saves
// token + PIN there. Sent as Bearer + X-PIN (M2/GAP auth).
const base = import.meta.env.VITE_API_URL || '';

function seedFromQuery() {
  const q = new URLSearchParams(window.location.search).get('token');
  if (q) sessionStorage.setItem('lanbox-token', q);
}
seedFromQuery();

export const getToken = () => sessionStorage.getItem('lanbox-token') || '';
export const getPin = () => sessionStorage.getItem('lanbox-pin') || '';
export const saveAuth = (token, pin) => {
  sessionStorage.setItem('lanbox-token', token);
  sessionStorage.setItem('lanbox-pin', pin || '');
};

export function authHeaders() {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const pin = getPin();
  if (pin) headers['X-PIN'] = pin;
  return headers;
}

async function req(path, opts = {}) {
  const res = await fetch(`${base}/api/v1${path}`, { ...opts, headers: { ...authHeaders(), ...(opts.headers || {}) } });
  if (res.status === 401) {
    const err = new Error('Unauthorized — wrong token or PIN');
    err.code = 401;
    throw err;
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res;
}

export const getInfo = () => req('/info').then((r) => r.json());

export const listFiles = (path = '/') =>
  req(`/files?path=${encodeURIComponent(path)}`).then((r) => r.json());

export const downloadUrl = (path) => {
  const token = getToken();
  return `${base}/api/v1/files/download?path=${encodeURIComponent(path)}${token ? `&token=${token}` : ''}`;
};

export const createShare = (path, expiresMinutes = 30) =>
  req('/shares', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, expires_minutes: expiresMinutes }),
  }).then((r) => r.json());

// Upload with XHR for progress events. onProgress(frac) 0..1.
// Resolves to the server record {name, size, checksum}.
export function uploadFile(dir, file, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${base}/api/v1/files/upload?path=${encodeURIComponent(dir)}`);
    const token = getToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    const pin = getPin();
    if (pin) xhr.setRequestHeader('X-PIN', pin);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status === 201) resolve(JSON.parse(xhr.responseText));
      else if (xhr.status === 401) reject(new Error('Unauthorized — wrong token or PIN'));
      else reject(new Error(`Upload failed: ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('Server unreachable — check you are on the same Wi-Fi'));
    xhr.send(form);
  });
}

export function formatBytes(n) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export const deleteFile = (path) =>
  req(`/files?path=${encodeURIComponent(path)}`, { method: 'DELETE' }).then((r) => r.json());

// --- Resumable download -------------------------------------------------
// Partial chunks live in IndexedDB (keyed by server path) so a failed
// download resumes via Range instead of restarting. Completing assembles
// the Blob and triggers the browser save.

function openPartials() {
  return new Promise((resolve, reject) => {
    const q = indexedDB.open('lanbox', 1);
    q.onupgradeneeded = () => q.result.createObjectStore('partials');
    q.onsuccess = () => resolve(q.result);
    q.onerror = () => reject(q.error);
  });
}

async function idbGet(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('partials', 'readonly');
    const q = tx.objectStore('partials').get(key);
    q.onsuccess = () => resolve(q.result || null);
    q.onerror = () => reject(q.error);
  });
}

async function idbPut(db, key, val) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('partials', 'readwrite');
    tx.objectStore('partials').put(val, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDel(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('partials', 'readwrite');
    tx.objectStore('partials').delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// downloadSave fetches path (total bytes known from listing), resumes from
// any stored partial, saves via browser download on completion.
// onProgress(done, total). Throws on failure; partial is kept for retry.
export async function downloadSave(path, total, onProgress) {
  const db = await openPartials();
  const prev = await idbGet(db, path);
  let start = 0;
  let chunks = [];
  if (prev && prev.total === total && prev.done > 0 && prev.done < total) {
    start = prev.done;
    chunks = prev.chunks;
  }
  const headers = { ...authHeaders() };
  if (start > 0) headers.Range = `bytes=${start}-`;
  const res = await fetch(`${base}/api/v1/files/download?path=${encodeURIComponent(path)}`, { headers });
  if (res.status === 401) {
    const err = new Error('Unauthorized — wrong token or PIN');
    err.code = 401;
    throw err;
  }
  if (res.status !== 200 && res.status !== 206) throw new Error(`Download failed: ${res.status}`);
  if (start > 0 && res.status !== 206) {
    start = 0; // server ignored Range; restart clean
    chunks = [];
  }
  const reader = res.body.getReader();
  let done = start;
  for (;;) {
    const { value, done: finished } = await reader.read();
    if (finished) break;
    chunks.push(value);
    done += value.byteLength;
    onProgress(done, total);
    // Persist batched (~1 MB): per-chunk idb writes throttle throughput.
    // The record is self-consistent; a kill resumes from the last batch.
    if (chunks.length % 16 === 0) await idbPut(db, path, { total, done, chunks });
  }
  await idbDel(db, path);
  const blob = new Blob(chunks, { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = path.split('/').pop();
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return { resumed: start > 0 };
}
