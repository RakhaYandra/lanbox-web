// Single HTTP layer. Components never fetch directly.
const base = import.meta.env.VITE_API_URL || '';

async function req(path, opts = {}) {
  const res = await fetch(`${base}/api/v1${path}`, opts);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res;
}

export const getInfo = () => req('/info').then((r) => r.json());

export const listFiles = (path = '/') =>
  req(`/files?path=${encodeURIComponent(path)}`).then((r) => r.json());

export const downloadUrl = (path) =>
  `${base}/api/v1/files/download?path=${encodeURIComponent(path)}`;

// Upload with XHR for progress events. onProgress(frac) 0..1.
export function uploadFile(dir, file, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${base}/api/v1/files/upload?path=${encodeURIComponent(dir)}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status === 201) resolve(JSON.parse(xhr.responseText));
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
