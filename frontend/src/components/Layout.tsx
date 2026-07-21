import { useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { visibleModules } from '../rbac/navigation';
import { IconLogout, IconMoon, IconPill, IconSun } from './icons';
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
  const { theme, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  if (!user) return null;
  const modules = visibleModules(user.permissions);

  return (
    <div className="shell">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <span className="logo">
            <IconPill size={20} />
          </span>
          MedLine
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
              <div style={{ fontWeight: 600 }}>
                {modules.find((m) => m.path === location.pathname)?.label ?? 'Panel'}
              </div>
              <div className="topbar-role">{user.role.name}</div>
            </div>
          </div>

          <div className="row" style={{ gap: 12 }}>
            <button
              className="icon-btn"
              onClick={toggle}
              aria-label={theme === 'light' ? 'Activar modo oscuro' : 'Activar modo claro'}
              title={theme === 'light' ? 'Modo oscuro' : 'Modo claro'}
            >
              {theme === 'light' ? <IconMoon size={18} /> : <IconSun size={18} />}
            </button>
            <div className="user-chip">
              <div className="avatar">{initials(user.fullName)}</div>
              <div style={{ lineHeight: 1.2 }}>
                <div style={{ fontSize: '0.86rem', fontWeight: 600 }}>{user.fullName}</div>
                <div className="topbar-role">{user.email}</div>
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
