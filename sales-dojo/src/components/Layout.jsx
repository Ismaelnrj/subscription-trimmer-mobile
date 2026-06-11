import { NavLink, Outlet } from 'react-router-dom';
import { MODULES } from '../data/curriculum.js';

export default function Layout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span>🥋</span>
          <span>Sales Dojo</span>
        </div>

        <NavLink to="/" end className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          <span className="icon">🏠</span> Dashboard
        </NavLink>

        <div className="sidebar-section-label">Modules</div>
        {MODULES.map((mod) => (
          <NavLink
            key={mod.id}
            to={`/module/${mod.id}`}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          >
            <span className="icon">{mod.icon}</span> {mod.title}
          </NavLink>
        ))}

        <div className="sidebar-section-label">Practice</div>
        <NavLink to="/flashcards" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          <span className="icon">🗂️</span> Flashcards
        </NavLink>
        <NavLink to="/roleplay" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          <span className="icon">🤖</span> AI Roleplay
        </NavLink>

        <div className="sidebar-section-label">Account</div>
        <NavLink to="/settings" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          <span className="icon">⚙️</span> Settings
        </NavLink>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
