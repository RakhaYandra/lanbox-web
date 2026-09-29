import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { fetchPreviewText, previewKind } from '../api.js';

interface Props {
  name: string;
  url: string;
  onClose: () => void;
}

export default function Preview({ name, url, onClose }: Props) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState('');
  const kind = previewKind(name);

  useEffect(() => {
    if (kind !== 'text') return;
    fetchPreviewText(url)
      .then((t) => setText(t))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [url, kind]);

  return (
    <div className="preview" role="dialog" aria-label={`Preview ${name}`}>
      <div className="preview-head">
        <span>{name}</span>
        <button onClick={onClose} aria-label="Close preview"><Icon name="x" /></button>
      </div>
      {error && <p className="error">{error}</p>}
      {kind === 'image' && <img src={url} alt={name} />}
      {kind === 'pdf' && <iframe src={url} title={name} />}
      {kind === 'text' && text !== null && <pre>{text}</pre>}
    </div>
  );
}
