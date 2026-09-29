import { useEffect, useState } from 'react';
import { formatBytes, listHistory, type HistoryEntry } from '../api.js';

export default function History() {
  const [items, setItems] = useState<HistoryEntry[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    listHistory(20, 0).then((d) => setItems(d.entries || [])).catch(() => setItems([]));
  }, [open ]);

  return (
    <section aria-label="History">
      <button onClick={() => setOpen((o) => !o)}>History</button>
      {open && (
        items.length === 0
          ? <p className="meta">No transfers yet</p>
          : items.map((e) => (
            <div className="row" key={e.id}>
              <span className="name">{e.name}</span>
              <span className="size">
                {e.kind} · {formatBytes(e.size)} · {e.status}{e.sha256 ? ` · ${e.sha256.slice(0, 12)}…` : ''}
              </span>
            </div>
          ))
      )}
    </section>
  );
}
