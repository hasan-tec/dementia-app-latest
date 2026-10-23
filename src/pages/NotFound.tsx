import { Link, useNavigate, useLocation } from 'react-router-dom';
import './NotFound.css';

export function NotFound() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="notfound-wrapper" id="notfound-page">
      {/* Ambient background glows */}
      <div className="notfound-glow glow-primary" />
      <div className="notfound-glow glow-secondary" />

      <main className="notfound-card glass-card">
        {/* Spatial / AR Visual Indicator */}
        <div className="notfound-visual">
          <div className="notfound-pulse-ring ring-outer" />
          <div className="notfound-pulse-ring ring-inner" />
          
          <div className="notfound-glass-badge">
            <span className="notfound-code">404</span>
          </div>

          <div className="notfound-floating-icon" aria-hidden="true">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12h20" />
              <path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6" />
              <path d="M12 2a5 5 0 0 1 5 5v5H7V7a5 5 0 0 1 5-5z" />
            </svg>
          </div>
        </div>

        {/* Text Content */}
        <div className="notfound-content">
          <div className="notfound-status-pill">
            <span className="status-indicator-dot" />
            <span>Lost In Space</span>
          </div>

          <h1 className="notfound-title">Page Not Found</h1>
          
          <p className="notfound-subtitle">
            The spatial view or memory record you are trying to reach does not exist or has been relocated.
          </p>

          <div className="notfound-route-preview" title="Attempted Path">
            <span className="route-icon">🔗</span>
            <code className="route-path">{location.pathname}</code>
          </div>
        </div>

        {/* Navigation Action Buttons */}
        <div className="notfound-actions">
          <Link to="/" className="btn btn-primary notfound-btn" id="notfound-home-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span>Back to Dashboard</span>
          </Link>

          <Link to="/people" className="btn btn-secondary notfound-btn" id="notfound-people-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span>People Directory</span>
          </Link>

          <Link to="/ar" className="btn btn-secondary notfound-btn" id="notfound-ar-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M3 7V5a2 2 0 0 1 2-2h2" />
              <path d="M17 3h2a2 2 0 0 1 2 2v2" />
              <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
              <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
            </svg>
            <span>Launch AR Viewer</span>
          </Link>
        </div>

        {/* Browser Back Button */}
        <div className="notfound-footer">
          <button
            type="button"
            className="notfound-back-link"
            onClick={() => navigate(-1)}
            id="notfound-go-back-btn"
          >
            <span className="back-arrow">←</span> Go back to previous page
          </button>
        </div>
      </main>
    </div>
  );
}
