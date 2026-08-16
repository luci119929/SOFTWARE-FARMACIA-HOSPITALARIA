import { useState } from 'react';
import { useApi } from '../api/useApi';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { P } from '../rbac/permissions';
import { Badge, ErrorState, Loading } from '../components/ui';
import type { UserRow } from '../api/types';

interface RoleRow {
  id: string;
  key: string;
  name: string;
  permissions: string[];
}

export function UsersPage() {
  const { can } = useAuth();
  const users = useApi<{ users: UserRow[] }>('/users');
  const roles = useApi<{ roles: RoleRow[] }>('/meta/roles');
  const canCreate = can(P.USERS_CREATE);

  const [form, setForm] = useState({ email: '', fullName: '', password: '', roleId: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api.post('/users', form);
      setMsg('Usuario creado.');
      setForm({ email: '', fullName: '', password: '', roleId: '' });
      users.reload();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Error al crear');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Usuarios y Roles</h1>
      </div>

      <div className="grid-2">
        <div>
          <h2 style={{ fontSize: '1.05rem' }}>Usuarios</h2>
          {users.loading && <Loading />}
          {users.error && <ErrorState message={users.error} />}
          {users.data && (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr><th>Nombre</th><th>Rol</th><th>Estado</th></tr>
                </thead>
                <tbody>
                  {users.data.users.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{u.fullName}</div>
                        <div className="muted" style={{ fontSize: '0.8rem' }}>{u.email}</div>
                      </td>
                      <td><Badge tone="info">{u.role.name}</Badge></td>
                      <td><Badge tone={u.isActive ? 'ok' : 'muted'}>{u.isActive ? 'Activo' : 'Inactivo'}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {canCreate && (
          <div className="card card-pad" style={{ alignSelf: 'start' }}>
            <h2 style={{ fontSize: '1.05rem' }}>Nuevo usuario</h2>
            <form onSubmit={createUser}>
              <div className="field">
                <label>Nombre completo</label>
                <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
              </div>
              <div className="field">
                <label>Correo institucional</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="field">
                <label>Contraseña (mín. 8)</label>
                <input type="password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              </div>
              <div className="field">
                <label>Rol</label>
                <select value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })} required>
                  <option value="">Seleccionar…</option>
                  {roles.data?.roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              {msg && <div className="muted" style={{ marginBottom: 10 }}>{msg}</div>}
              <button className="btn btn-primary" disabled={busy}>{busy ? 'Creando…' : 'Crear usuario'}</button>
            </form>
          </div>
        )}
      </div>

      {roles.data && (
        <>
          <h2 style={{ fontSize: '1.05rem', marginTop: 28 }}>Matriz de roles y permisos</h2>
          <div className="grid-2">
            {roles.data.roles.map((r) => (
              <div key={r.id} className="card card-pad">
                <div style={{ fontWeight: 700 }}>{r.name}</div>
                <div className="row wrap mt-16" style={{ gap: 6 }}>
                  {r.permissions.map((p) => (
                    <Badge key={p} tone="muted">{p}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
