import { useCallback, useEffect, useState } from 'react';
import { createShare, getInfo, listFiles, uploadFile } from './api.js';
import Header from './components/Header.jsx';
import Breadcrumb from './components/Breadcrumb.jsx';
import FileRow from './components/FileRow.jsx';
import UploadButton from './components/UploadButton.jsx';
import ProgressBar from './components/ProgressBar.jsx';
import Login from './components/Login.jsx';

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [needLogin, setNeedLogin] = useState(false);
  const [info, setInfo] = useState(null);
  const [path, setPath] = useState('/');
  const [entries, setEntries] = useState([]);
  const [selected, setSelected] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [error, setError] = useState('');
  const [share, setShare] = useState('');

  const refresh = useCallback(async (p) => {
    try {
      const data = await listFiles(p);
      setEntries(data.entries || []);
      setError('');
    } catch (e) {
      if (e.code === 401) setNeedLogin(true);
      else setError('Server unreachable — check you are on the same Wi-Fi');
    }
  }, []);

  const boot = useCallback(async () => {
    try {
      setInfo(await getInfo());
      setNeedLogin(false);
      setAuthed(true);
    } catch (e) {
      if (e.code === 401) setNeedLogin(true);
      else setError('Server unreachable — check you are on the same Wi-Fi');
    }
  }, []);

  useEffect(() => {
    boot();
  }, [boot]);

  useEffect(() => {
    if (authed) refresh(path);
  }, [path, authed, refresh]);

  const toggle = (name) =>
    setSelected((s) => (s.includes(name) ? s.filter((x) => x !== name) : [...s, name]));

  const startUpload = (files) => {
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
        .catch((e) => {
          if (e.code === 401) setNeedLogin(true);
          setTransfers((ts) => ts.map((t) => (t.id === id ? { ...t, state: 'error', error: e.message } : t)));
        });
    });
  };

  const shareSelected = async () => {
    if (selected.length !== 1) return;
    const full = path === '/' ? `/${selected[0]}` : `${path}/${selected[0]}`;
    try {
      const rec = await createShare(full);
      setShare(`${rec.url}${rec.pin ? ` (PIN: ${rec.pin})` : ''}`);
    } catch (e) {
      setError(e.message);
    }
  };

  if (needLogin && !authed) {
    return <Login onAuthed={() => { setNeedLogin(false); boot(); }} />;
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
          onOpen={() => e.type === 'directory' && setPath(path === '/' ? `/${e.name}` : `${path}/${e.name}`)} />
      ))}
      {selected.length === 1 && (
        <button onClick={shareSelected}>Share {selected[0]} (30 min)</button>
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
