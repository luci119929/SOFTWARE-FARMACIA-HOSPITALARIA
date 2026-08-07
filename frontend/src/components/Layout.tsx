import { useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { visibleModules } from '../rbac/navigation';
import { IconLogout } from './icons';
import { Wordmark } from './Wordmark';
import '../styles/layout.css';

function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  if (!user) return null;
  const modules = visibleModules(user.permissions);

  return (
    <div className="shell">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <Wordmark size={26} />
        </div>
        <nav className="sidebar-nav">
          {modules.map((m) => {
            const Icon = m.icon;
            return (
              <NavLink
                key={m.key}
                to={m.path}
                end={m.path === '/'}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                <Icon size={19} />
                {m.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="sidebar-foot">
          MedLine · Fase 1 — Arquitectura Base
          <br />
          Farmacia Hospitalaria
        </div>
      </aside>

      <div className="main-scroll">
        <header className="topbar">
          <div className="row" style={{ gap: 14 }}>
            <button
              className="icon-btn"
              onClick={() => setMenuOpen((v) => !v)}
              style={{ display: 'none' }}
              aria-label="Menú"
            >
              ☰
            </button>
            <div>
              <div className="topbar-title">
                {modules.find((m) => m.path === location.pathname)?.label ?? 'Panel'}
              </div>
              <div className="topbar-role">{user.role.name}</div>
            </div>
          </div>

          <div className="row" style={{ gap: 12 }}>
            <div className="user-chip">
              <div className="avatar">{initials(user.fullName)}</div>
              <div style={{ lineHeight: 1.3 }}>
                <div className="user-chip-email">{user.email}</div>
                <div className="topbar-role">{user.fullName}</div>
              </div>
            </div>
            <button className="icon-btn" onClick={logout} aria-label="Cerrar sesión" title="Cerrar sesión">
              <IconLogout size={18} />
            </button>
          </div>
        </header>

        <main>{children}</main>
      </div>
    </div>
  );
}
