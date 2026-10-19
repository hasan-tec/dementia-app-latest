import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTour } from '../tour/TourProvider';
import './Sidebar.css';

export function Sidebar() {
    const { user, signOut } = useAuth();
    const { startTour } = useTour();
    const navigate = useNavigate();

    async function handleLogout() {
        await signOut();
        navigate('/login', { replace: true });
    }

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
                    data-tour="nav-dashboard"
                    end
                >
                    <span className="nav-icon">📊</span>
                    <span className="nav-label">Dashboard</span>
                </NavLink>

                <NavLink
                    to="/people"
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    data-tour="nav-people"
                >
                    <span className="nav-icon">👥</span>
                    <span className="nav-label">People</span>
                </NavLink>

                <NavLink
                    to="/ar"
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    data-tour="nav-ar"
                >
                    <span className="nav-icon">👓</span>
                    <span className="nav-label">AR Viewer</span>
                </NavLink>

                <NavLink
                    to="/help"
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    data-tour="nav-help"
                >
                    <span className="nav-icon">💡</span>
                    <span className="nav-label">Help & Guide</span>
                </NavLink>
            </nav>

            <div className="sidebar-footer">
                <button
                    className="sidebar-guide-btn"
                    onClick={() => {
                        startTour();
                        navigate('/');
                    }}
                    title="Start or restart interactive tour"
                >
                    <span>🧭</span>
                    <span>Replay Tour</span>
                </button>

                <div className="sidebar-divider"></div>

                <div className="sidebar-user-section">
                    <div className="sidebar-user-info" title={user?.email || 'Caregiver'}>
                        <span className="sidebar-avatar-circle">
                            {(user?.email?.[0] || 'C').toUpperCase()}
                        </span>
                        <div className="sidebar-user-meta">
                            <span className="sidebar-user-name">Caregiver</span>
                            <span className="sidebar-user-email">{user?.email || 'Authenticated'}</span>
                        </div>
                    </div>

                    <button
                        className="sidebar-logout-btn"
                        onClick={handleLogout}
                        title="Sign out of account"
                        aria-label="Sign out"
                    >
                        🚪
                    </button>
                </div>
            </div>
        </aside>
    );
}
