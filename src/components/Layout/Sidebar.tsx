import { NavLink } from 'react-router-dom';
import './Sidebar.css';

export function Sidebar() {
    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <div className="sidebar-logo">
                    <span className="logo-icon">🧠</span>
                    <span className="logo-text">MemoryAR</span>
                </div>
            </div>

            <nav className="sidebar-nav">
                <NavLink
                    to="/"
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    end
                >
                    <span className="nav-icon">📊</span>
                    <span className="nav-label">Dashboard</span>
                </NavLink>

                <NavLink
                    to="/people"
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                    <span className="nav-icon">👥</span>
                    <span className="nav-label">People</span>
                </NavLink>

                <NavLink
                    to="/ar"
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                    <span className="nav-icon">👓</span>
                    <span className="nav-label">AR Viewer</span>
                </NavLink>
            </nav>

            <div className="sidebar-footer">
                <div className="sidebar-divider"></div>
                <div className="sidebar-info">
                    <span className="info-icon">ℹ️</span>
                    <span className="info-text">Caregiver Portal</span>
                </div>
            </div>
        </aside>
    );
}
