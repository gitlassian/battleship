import { useState } from 'react';
import { api, usingMock } from '../api.js';

export default function Login({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { token } = await api.login(password);
      onLogin(token);
    } catch (err) {
      setError(err.status === 401 ? 'Неверный пароль' : err.message);
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <form className="card login-card" onSubmit={submit}>
        <h1>🐱 Cat Shop</h1>
        <p className="muted">Вход в админку</p>
        <label>
          Пароль
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus required />
        </label>
        {error && <div className="error">{error}</div>}
        <button className="primary" disabled={busy}>{busy ? 'Входим…' : 'Войти'}</button>
        {usingMock && <p className="muted small">Тестовый режим: пароль «admin».</p>}
      </form>
    </div>
  );
}
