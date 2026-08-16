import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';
import { Wordmark } from '../components/Wordmark';
import '../styles/login.css';

const DEMO_USERS = [
  { email: 'admin@medline.hospital', label: 'Administrador' },
  { email: 'jefe@medline.hospital', label: 'Jefe de Farmacia' },
  { email: 'farmaceutico@medline.hospital', label: 'Farmacéutico' },
  { email: 'deposito@medline.hospital', label: 'Depósito' },
  { email: 'compras@medline.hospital', label: 'Compras' },
  { email: 'auditor@medline.hospital', label: 'Auditor' },
];
const DEMO_PASSWORD = 'Medline2026!';

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error de conexión');
    } finally {
      setBusy(false);
    }
  }

  function quickFill(userEmail: string) {
    setEmail(userEmail);
    setPassword(DEMO_PASSWORD);
  }

  return (
    <div className="login-wrap">
      <div className="login-hero">
        <div className="login-brand">
          <Wordmark size={64} color="#00ffc2" />
        </div>
      </div>

      <div className="login-panel">
        <div className="login-card">
          <h2>Ingresar</h2>
          <form onSubmit={submit}>
            <div className="field">
              <label htmlFor="email">Mail</label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="password">Contraseña</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <div className="login-error">{error}</div>}
            <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>
              {busy ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>

          <div className="login-demo">
            <div className="muted" style={{ fontSize: '0.8rem', marginBottom: 8 }}>
              Usuarios de demostración (contraseña: <span className="mono">{DEMO_PASSWORD}</span>)
            </div>
            <div className="row wrap" style={{ gap: 6 }}>
              {DEMO_USERS.map((u) => (
                <button
                  key={u.email}
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => quickFill(u.email)}
                >
                  {u.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
