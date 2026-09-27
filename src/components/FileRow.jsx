import Icon from './Icon.jsx';
import { downloadUrl, formatBytes } from '../api.js';

export default function FileRow({ entry, dir, selected, onToggle, onOpen }) {
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
        <a className="name" href={downloadUrl(full)}>
          <Icon name="file" /> {entry.name}
        </a>
      )}
      <span className="size">{isDir ? '' : formatBytes(entry.size)}</span>
    </div>
  );
}
