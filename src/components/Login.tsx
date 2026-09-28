import { useState } from 'react';
import { getInfo, saveAuth } from '../api.js';

export default function Login({ onAuthed }: { onAuthed: () => void }) {
  const [token, setToken] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    saveAuth(token.trim(), pin.trim());
    try {
      await getInfo();
      setError('');
      onAuthed();
    } catch {
      setError('Wrong token or PIN — try again');
    }
  };

  return (
    <main>
      <h1>LANBox</h1>
      <p className="meta">Enter the token and PIN from the server screen (or open the QR link).</p>
      <form onSubmit={submit}>
        <label>
          Token
          <input value={token} onChange={(e) => setToken(e.target.value)}
            placeholder="64-hex server token" autoComplete="off" />
        </label>
        <label>
          PIN
          <input value={pin} onChange={(e) => setPin(e.target.value)}
            placeholder="6-digit PIN" inputMode="numeric" autoComplete="off" />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit">Connect</button>
      </form>
    </main>
  );
}
