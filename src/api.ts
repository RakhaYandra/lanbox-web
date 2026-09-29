// Single HTTP layer. Components never fetch directly.
// Credentials: ?token= (QR flow) seeds sessionStorage; login screen saves
// token + PIN there. Sent as Bearer + X-PIN (M2/GAP auth).
const base = import.meta.env.VITE_API_URL || '';

export interface Entry {
  name: string;
  type: 'file' | 'directory';
  size?: number;
}

export interface FileList {
  path: string;
  entries: Entry[];
}

export interface ServerInfo {
  name: string;
  hostname: string;
  address: string;
  port: number;
}

export interface UploadRecord {
  name: string;
  size: number;
  checksum?: string;
}

export interface ShareRecord {
  share_token: string;
  url: string;
  expires_at: number;
  pin_required: boolean;
  pin?: string;
}

export interface TransferState {
  id: string;
  name: string;
  frac: number;
  done: number;
  total: number;
  state: 'running' | 'done' | 'error';
  checksum?: string;
  note?: string;
  error?: string;
}

export class HttpError extends Error {
  code: number;
  constructor(message: string, code: number) {
    super(message);
    this.code = code;
  }
}

function seedFromQuery(): void {
  const q = new URLSearchParams(window.location.search).get('token');
  if (q) sessionStorage.setItem('lanbox-token', q);
}
seedFromQuery();

export const getToken = (): string => sessionStorage.getItem('lanbox-token') || '';
export const getPin = (): string => sessionStorage.getItem('lanbox-pin') || '';
export const saveAuth = (token: string, pin: string): void => {
  sessionStorage.setItem('lanbox-token', token);
  sessionStorage.setItem('lanbox-pin', pin || '');
};

export function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const pin = getPin();
  if (pin) headers['X-PIN'] = pin;
  return headers;
}

async function req(path: string, opts: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${base}/api/v1${path}`, { ...opts, headers: { ...authHeaders(), ...(opts.headers || {}) } });
  if (res.status === 401) throw new HttpError('Unauthorized — wrong token or PIN', 401);
  if (!res.ok) {
    const body = await res.json().catch(() => ({} as { error?: string }));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res;
}

export const getInfo = (): Promise<ServerInfo> => req('/info').then((r) => r.json());

export const listFiles = (path = '/'): Promise<FileList> =>
  req(`/files?path=${encodeURIComponent(path)}`).then((r) => r.json());

export const downloadUrl = (path: string): string => {
  const token = getToken();
  const pin = getPin();
  // Query form (not headers) so <img>/<iframe>/<a> loads authenticate too.
  return `${base}/api/v1/files/download?path=${encodeURIComponent(path)}${token ? `&token=${token}` : ''}${pin ? `&pin=${pin}` : ''}`;
};

export const previewUrl = (path: string): string => `${downloadUrl(path)}&preview=1`;

// fetchPreviewText GETs a preview URL with auth (plain fetch would 401
// when the server requires token/PIN).
export async function fetchPreviewText(url: string): Promise<string> {
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Preview failed: ${res.status}`);
  return (await res.text()).slice(0, 200_000);
}

export type PreviewKind = 'image' | 'text' | 'pdf' | 'none';

export function previewKind(name: string): PreviewKind {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
  if (['txt', 'md', 'json', 'log', 'csv'].includes(ext)) return 'text';
  if (ext === 'pdf') return 'pdf';
  return 'none';
}

export function previewable(name: string): boolean {
  return previewKind(name) !== 'none';
}

export const createShare = (path: string, expiresMinutes = 30, allowUpload = false): Promise<ShareRecord> =>
  req('/shares', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, expires_minutes: expiresMinutes, allow_upload: allowUpload }),
  }).then((r) => r.json());

// Upload with XHR for progress events. onProgress(frac) 0..1.
// Resolves to the server record {name, size, checksum}.
export function uploadFile(dir: string, file: File, onProgress: (frac: number) => void): Promise<UploadRecord> {
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
      if (xhr.status === 201) resolve(JSON.parse(xhr.responseText) as UploadRecord);
      else if (xhr.status === 401) reject(new HttpError('Unauthorized — wrong token or PIN', 401));
      else reject(new Error(`Upload failed: ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('Server unreachable — check you are on the same Wi-Fi'));
    xhr.send(form);
  });
}

export function formatBytes(n: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export interface ServerTransfer {
  id: string;
  name: string;
  bytes: number;
  total: number;
  started_at: string;
}

export const listTransfers = (): Promise<{ transfers: ServerTransfer[] }> =>
  req('/transfers').then((r) => r.json());

export const cancelTransfer = (id: string): Promise<{ cancelled: string }> =>
  req(`/transfers/${id}`, { method: 'DELETE' }).then((r) => r.json());

export const deleteFile = (path: string): Promise<{ deleted: string }> =>
  req(`/files?path=${encodeURIComponent(path)}`, { method: 'DELETE' }).then((r) => r.json());

// --- Resumable download -------------------------------------------------
// Partial chunks live in IndexedDB (keyed by server path) so a failed
// download resumes via Range instead of restarting. Completing assembles
// the Blob and triggers the browser save.

interface Partial {
  total: number;
  done: number;
  chunks: Uint8Array[];
}

function openPartials(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const q = indexedDB.open('lanbox', 1);
    q.onupgradeneeded = () => q.result.createObjectStore('partials');
    q.onsuccess = () => resolve(q.result);
    q.onerror = () => reject(q.error);
  });
}

function idbGet(db: IDBDatabase, key: string): Promise<Partial | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('partials', 'readonly');
    const q = tx.objectStore('partials').get(key);
    q.onsuccess = () => resolve((q.result as Partial) || null);
    q.onerror = () => reject(q.error);
  });
}

function idbPut(db: IDBDatabase, key: string, val: Partial): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('partials', 'readwrite');
    tx.objectStore('partials').put(val, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function idbDel(db: IDBDatabase, key: string): Promise<void> {
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
export async function downloadSave(
  path: string,
  total: number,
  onProgress: (done: number, total: number) => void,
): Promise<{ resumed: boolean }> {
  const db = await openPartials();
  const prev = await idbGet(db, path);
  let start = 0;
  let chunks: Uint8Array[] = [];
  if (prev && prev.total === total && prev.done > 0 && prev.done < total) {
    start = prev.done;
    chunks = prev.chunks;
  }
  const headers: Record<string, string> = { ...authHeaders() };
  if (start > 0) headers.Range = `bytes=${start}-`;
  const res = await fetch(`${base}/api/v1/files/download?path=${encodeURIComponent(path)}`, { headers });
  if (res.status === 401) throw new HttpError('Unauthorized — wrong token or PIN', 401);
  if (res.status !== 200 && res.status !== 206) throw new Error(`Download failed: ${res.status}`);
  if (start > 0 && res.status !== 206) {
    start = 0; // server ignored Range; restart clean
    chunks = [];
  }
  const reader = res.body!.getReader();
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
  const blob = new Blob(chunks as BlobPart[], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = path.split('/').pop() || 'download';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return { resumed: start > 0 };
}
