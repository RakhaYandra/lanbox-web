import Icon from './Icon.jsx';

interface Props {
  path: string;
  onNavigate: (path: string) => void;
}

export default function Breadcrumb({ path, onNavigate }: Props) {
  const segs = path.split('/').filter(Boolean);
  return (
    <nav aria-label=" breadcrumb">
      <button onClick={() => onNavigate('/')}>LANBox</button>
      {segs.map((s, i) => {
        const sub = '/' + segs.slice(0, i + 1).join('/');
        const last = i === segs.length - 1;
        return (
          <span key={sub}>
            <Icon name="chevron" />
            {last ? <span>{s}</span> : <button onClick={() => onNavigate(sub)}>{s}</button>}
          </span>
        );
      })}
    </nav>
  );
}
