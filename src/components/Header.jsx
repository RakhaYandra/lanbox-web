export default function Header({ address, active, total }) {
  return (
    <header>
      <h1>LANBox</h1>
      <p className="meta">{address} · Active {active} · Total {total}</p>
    </header>
  );
}
