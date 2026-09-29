import { useCallback, useEffect, useState } from 'react';
import {
  createShare,
  deleteFile,
  downloadSave,
  getInfo,
  listFiles,
  uploadFile,
  HttpError,
  type Entry,
  type ServerInfo,
  type TransferState,
} from './api.js';
import Header from './components/Header.jsx';
import Breadcrumb from './components/Breadcrumb.jsx';
import FileRow from './components/FileRow.jsx';
import UploadButton from './components/UploadButton.jsx';
import ProgressBar from './components/ProgressBar.jsx';
import Login from './components/Login.jsx';
import Preview from './components/Preview.jsx';
import { previewUrl } from './api.js';

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function is401(e: unknown): boolean {
  return e instanceof HttpError && e.code === 401;
}

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [needLogin, setNeedLogin] = useState(false);
  const [info, setInfo] = useState<ServerInfo | null>(null);
  const [path, setPath] = useState('/');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [transfers, setTransfers] = useState<TransferState[]>([]);
  const [error, setError] = useState('');
  const [share, setShare] = useState('');
  const [preview, setPreview] = useState<string | null>(null);

  const refresh = useCallback(async (p: string) => {
    try {
      const data = await listFiles(p);
      setEntries(data.entries || []);
      setError('');
    } catch (e) {
      if (is401(e)) { setNeedLogin(true); setAuthed(false); }
      else setError('Server unreachable — check you are on the same Wi-Fi');
    }
  }, []);

  const boot = useCallback(async () => {
    try {
      setInfo(await getInfo());
      setNeedLogin(false);
      setAuthed(true);
    } catch (e) {
      if (is401(e)) { setNeedLogin(true); setAuthed(false); }
      else setError('Server unreachable — check you are on the same Wi-Fi');
    }
  }, []);

  useEffect(() => {
    boot();
  }, [boot]);

  useEffect(() => {
    if (authed) refresh(path);
  }, [path, authed, refresh]);

  const toggle = (name: string) =>
    setSelected((s) => (s.includes(name) ? s.filter((x) => x !== name) : [...s, name]));

  const selectedFiles = (): [string, number][] =>
    entries
      .filter((e) => e.type === 'file' && selected.includes(e.name))
      .map((e) => [path === '/' ? `/${e.name}` : `${path}/${e.name}`, e.size ?? 0]);

  const startUpload = (files: File[]) => {
    files.forEach((file) => {
      const id = `${Date.now()}-${file.name}`;
      setTransfers((ts) => [...ts, { id, name: file.name, frac: 0, done: 0, total: file.size, state: 'running' }]);
      uploadFile(path, file, (frac) =>
        setTransfers((ts) => ts.map((t) =>
          t.id === id ? { ...t, frac, done: Math.round(frac * file.size) } : t,
        )),
      )
        .then((rec) => {
          setTransfers((ts) => ts.map((t) =>
            t.id === id ? { ...t, state: 'done', frac: 1, done: file.size, checksum: rec.checksum } : t,
          ));
          refresh(path);
        })
        .catch((e: unknown) => {
          if (is401(e)) { setNeedLogin(true); setAuthed(false); }
          setTransfers((ts) => ts.map((t) => (t.id === id ? { ...t, state: 'error', error: errMsg(e) } : t)));
        });
    });
  };

  const shareSelected = async (allowUpload: boolean) => {
    if (selected.length !== 1) return;
    const full = path === '/' ? `/${selected[0]}` : `${path}/${selected[0]}`;
    try {
      const rec = await createShare(full, 30, allowUpload);
      setShare(`${rec.url}${rec.pin ? ` (PIN: ${rec.pin})` : ''}`);
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const selectedIsDir = () =>
    selected.length === 1 && entries.some((e) => e.name === selected[0] && e.type === 'directory');

  const trackDownload = (name: string, total: number, fn: (onP: (done: number, total: number) => void) => Promise<{ resumed: boolean }>) => {
    const id = `${Date.now()}-${name}`;
    setTransfers((ts) => [...ts, { id, name, frac: 0, done: 0, total, state: 'running' }]);
    return fn(
      (done) => setTransfers((ts) => ts.map((t) => (t.id === id ? { ...t, frac: done / total, done } : t))),
    )
      .then((r) => {
        setTransfers((ts) => ts.map((t) =>
          t.id === id ? { ...t, state: 'done', frac: 1, done: total, note: r && r.resumed ? 'resumed' : '' } : t,
        ));
      })
      .catch((e: unknown) => {
        if (is401(e)) { setNeedLogin(true); setAuthed(false); }
        setTransfers((ts) => ts.map((t) => (t.id === id ? { ...t, state: 'error', error: `${errMsg(e)} — retry resumes` } : t)));
      });
  };

  // Sequential multi-download (per docs MVP); each keeps its own partial.
  const downloadPaths = async (paths: [string, number][]) => {
    for (const [full, size] of paths) {
      await trackDownload(full.split('/').pop() || full, size, (onP) => downloadSave(full, size, onP));
    }
  };

  const removeFile = async (full: string) => {
    try {
      await deleteFile(full);
      refresh(path);
    } catch (e) {
      setError(errMsg(e));
    }
  };

  if (needLogin) {
    return <Login onAuthed={() => { setNeedLogin(false); setAuthed(true); boot(); }} />;
  }

  const addr = info ? `${info.address}:${info.port}` : '';
  return (
    <main>
      <Header address={addr} active={transfers.filter((t) => t.state === 'running').length} total={`${entries.length} files`} />
      <Breadcrumb path={path} onNavigate={setPath} />
      {error && <p className="error">{error}</p>}
      {entries.length === 0 && !error && <p>No files yet — upload to begin</p>}
      {entries.map((e) => (
        <FileRow key={e.name} entry={e} dir={path}
          selected={selected.includes(e.name)}
          onToggle={() => toggle(e.name)}
          onOpen={() => e.type === 'directory' && setPath(path === '/' ? `/${e.name}` : `${path}/${e.name}`)}
          onDownload={(full, size) => downloadPaths([[full, size]])}
          onDelete={removeFile}
          onPreview={(full) => setPreview(full)} />
      ))}
      {preview && (
        <Preview name={preview.split('/').pop() || preview}
          url={previewUrl(preview)} onClose={() => setPreview(null)} />
      )}
      {selected.length === 1 && !selectedIsDir() && (
        <button onClick={() => shareSelected(false)}>Share {selected[0]} (30 min)</button>
      )}
      {selectedIsDir() && (
        <button onClick={() => shareSelected(true)}>Request files to {selected[0]}</button>
      )}
      {selected.length > 1 && (
        <button onClick={() => downloadPaths(selectedFiles())}>
          Download {selected.length} files
        </button>
      )}
      {share && <p className="meta">Share: {share}</p>}
      {transfers.map((t) => (
        <ProgressBar key={t.id} t={t}
          onRetry={() => setTransfers((ts) => ts.filter((x) => x.id !== t.id))} />
      ))}
      <UploadButton disabled={false} onFiles={startUpload} />
    </main>
  );
}
