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

async function req(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const pin = getPin();
  if (pin) headers['X-PIN'] = pin;
  const res = await fetch(`${base}/api/v1${path}`, { ...opts, headers });
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
