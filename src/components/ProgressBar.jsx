import { formatBytes } from '../api.js';

export default function ProgressBar({ t, onRetry }) {
  const pct = Math.round(t.frac * 100);
  return (
    <div className={`progress ${t.state}`} role="progressbar"
      aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100">
      <span className="pname">{t.name}</span>
      <div className="bar"><div className="fill" style={{ width: `${pct}%` }} /></div>
      <span className="pmeta">
        {t.state === 'error' ? (
          <>{t.error} <button onClick={onRetry}>Retry</button></>
        ) : (
          <>{formatBytes(t.done)} / {formatBytes(t.total)} · {pct}%</>
        )}
      </span>
    </div>
  );
}
