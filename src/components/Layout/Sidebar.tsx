import { NavLink, useNavigate } from 'react-router-dom';
import {
    X,
    Brain,
    LayoutDashboard,
    Users,
    Glasses,
    HelpCircle,
    Compass,
    LogOut,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTour } from '../tour/TourProvider';
import './Sidebar.css';

interface SidebarProps {
    isOpen?: boolean;
    onClose?: () => void;
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps = {}) {
    const { user, signOut } = useAuth();
    const { startTour } = useTour();
    const navigate = useNavigate();

    async function handleLogout() {
        onClose?.();
        await signOut();
        navigate('/login', { replace: true });
    }

    return (
        <aside className={`sidebar ${isOpen ? 'mobile-open' : ''}`}>
            <div className="sidebar-header">
                <div className="sidebar-logo">
                    <span className="logo-icon">
                        <Brain size={24} color="#0071e3" strokeWidth={2.2} />
                    </span>
                    <span className="logo-text">MemoryAR</span>
                </div>
                <button
                    type="button"
                    className="sidebar-close-btn"
                    onClick={onClose}
                    aria-label="Close navigation"
                >
                    <X size={20} />
                </button>
            </div>

            <nav className="sidebar-nav">
                <NavLink
                    to="/"
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    data-tour="nav-dashboard"
                    onClick={onClose}
                    end
                >
                    <LayoutDashboard size={20} className="nav-icon" />
                    <span className="nav-label">Dashboard</span>
                </NavLink>

                <NavLink
                    to="/people"
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    data-tour="nav-people"
                    onClick={onClose}
                >
                    <Users size={20} className="nav-icon" />
                    <span className="nav-label">People</span>
                </NavLink>

                <NavLink
                    to="/ar"
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    data-tour="nav-ar"
                    onClick={onClose}
                >
                    <Glasses size={20} className="nav-icon" />
                    <span className="nav-label">AR Viewer</span>
                </NavLink>

                <NavLink
                    to="/help"
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    data-tour="nav-help"
                    onClick={onClose}
                >
                    <HelpCircle size={20} className="nav-icon" />
                    <span className="nav-label">Help & Guide</span>
                </NavLink>
            </nav>

            <div className="sidebar-footer">
                <button
                    className="sidebar-guide-btn"
                    onClick={() => {
                        onClose?.();
                        startTour();
                        navigate('/');
                    }}
                    title="Start or restart interactive tour"
                >
                    <Compass size={18} />
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
                        <LogOut size={18} />
                    </button>
                </div>
            </div>
        </aside>
    );
}
