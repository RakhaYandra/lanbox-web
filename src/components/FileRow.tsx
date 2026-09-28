import Icon from './Icon.jsx';
import { formatBytes, type Entry } from '../api.js';

interface Props {
  entry: Entry;
  dir: string;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onDownload: (full: string, size: number) => void;
  onDelete: (full: string) => void;
}

export default function FileRow({ entry, dir, selected, onToggle, onOpen, onDownload, onDelete }: Props) {
  const isDir = entry.type === 'directory';
  const full = dir === '/' ? `/${entry.name}` : `${dir}/${entry.name}`;
  return (
    <div className={selected ? 'row selected' : 'row'}>
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        aria-label={`Select ${entry.name}`}
      />
      {isDir ? (
        <button className="name" onClick={onOpen}>
          <Icon name="folder" /> {entry.name}
        </button>
      ) : (
        <button className="name" onClick={() => onDownload(full, entry.size ?? 0)}>
          <Icon name="file" /> {entry.name}
        </button>
      )}
      <span className="size">{isDir ? '' : formatBytes(entry.size ?? 0)}</span>
      {!isDir && (
        <button aria-label={`Delete ${entry.name}`} title="Delete"
          onClick={() => { if (window.confirm(`Delete ${entry.name}?`)) onDelete(full); }}>
          <Icon name="x" />
        </button>
      )}
    </div>
  );
}
