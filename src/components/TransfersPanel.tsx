import { useEffect, useState } from 'react';
import { cancelTransfer, formatBytes, listTransfers, type ServerTransfer } from '../api.js';

export default function TransfersPanel() {
  const [items, setItems] = useState<ServerTransfer[]>([]);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const data = await listTransfers();
        if (alive) setItems(data.transfers || []);
      } catch {
        if (alive) setItems([]);
      }
    };
    poll();
    const t = setInterval(poll, 1000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  if (items.length === 0) return null;

  const cancel = async (id: string) => {
    try {
      await cancelTransfer(id);
    } catch {
      // entry already gone; next poll refreshes
    }
  };

  return (
    <section aria-label="Active transfers">
      <h2>Active transfers</h2>
      {items.map((t) => (
        <div className="row" key={t.id}>
          <span className="name">{t.name}</span>
          <span className="size">{formatBytes(t.bytes)} / {formatBytes(t.total)}</span>
          <button aria-label={`Cancel ${t.name}`} title="Cancel" onClick={() => cancel(t.id)}>
            Cancel
          </button>
        </div>
      ))}
    </section>
  );
}
