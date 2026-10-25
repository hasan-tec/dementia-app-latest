import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Compass, Link2, Home, Users, Glasses, ArrowLeft } from 'lucide-react';
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
            <Compass size={36} strokeWidth={1.8} />
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
            <span className="route-icon" style={{ display: 'inline-flex', alignItems: 'center' }}>
              <Link2 size={15} />
            </span>
            <code className="route-path">{location.pathname}</code>
          </div>
        </div>

        {/* Navigation Action Buttons */}
        <div className="notfound-actions">
          <Link to="/" className="btn btn-primary notfound-btn" id="notfound-home-btn">
            <Home size={18} strokeWidth={2} />
            <span>Back to Dashboard</span>
          </Link>

          <Link to="/people" className="btn btn-secondary notfound-btn" id="notfound-people-btn">
            <Users size={18} strokeWidth={2} />
            <span>People Directory</span>
          </Link>

          <Link to="/ar" className="btn btn-secondary notfound-btn" id="notfound-ar-btn">
            <Glasses size={18} strokeWidth={2} />
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
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <ArrowLeft size={14} className="back-arrow" /> Go back to previous page
          </button>
        </div>
      </main>
    </div>
  );
}
