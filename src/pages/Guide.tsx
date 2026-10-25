/**
 * Help & Guided Tour Page (/help)
 * Explains memory assistance workflows, AR face recognition instructions,
 * and allows restarting the guided arrow tutorial.
 */

import { useNavigate } from 'react-router-dom';
import { useTour } from '../components/tour/TourProvider';
import './Dashboard.css';

export function Guide() {
  const { startTour, status } = useTour();
  const navigate = useNavigate();

  return (
    <div className="dashboard" style={{ maxWidth: '860px', margin: '0 auto' }}>
      <header className="page-header" style={{ marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 className="page-title">Help & Guide</h1>
          <p className="page-subtitle">Learn how to configure face recognition and memory anchors</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            startTour();
            navigate('/');
          }}
          data-tour="help-replay"
        >
          🔄 {status === 'completed' || status === 'skipped' ? 'Replay Interactive Guide' : 'Start Guide'}
        </button>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Core Concepts Card */}
        <div className="stat-card glass-card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 16px 0', color: '#1d1d1f' }}>
            🌟 How MemoryAR Works
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '1.5rem' }}>📷</div>
              <strong style={{ fontSize: '0.95rem', color: '#1d1d1f' }}>1. Add Loved Ones</strong>
              <p style={{ fontSize: '0.88rem', color: '#86868b', margin: 0, lineHeight: 1.45 }}>
                Upload photos of family and caregivers. The system safely extracts a 128-dimensional facial embedding.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '1.5rem' }}>📝</div>
              <strong style={{ fontSize: '0.95rem', color: '#1d1d1f' }}>2. Record Memories</strong>
              <p style={{ fontSize: '0.88rem', color: '#86868b', margin: 0, lineHeight: 1.45 }}>
                Log conversations and recent topics. An AI memory summary creates a short, comforting reminder.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '1.5rem' }}>👓</div>
              <strong style={{ fontSize: '0.95rem', color: '#1d1d1f' }}>3. Real-Time AR</strong>
              <p style={{ fontSize: '0.88rem', color: '#86868b', margin: 0, lineHeight: 1.45 }}>
                Launch the camera feed. As family members enter view, names, relationships, and conversation anchors appear.
              </p>
            </div>
          </div>
        </div>

        {/* Best Practices */}
        <div className="stat-card glass-card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 16px 0', color: '#1d1d1f' }}>
            💡 Best Practices for Best Recognition
          </h2>
          <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '10px', color: '#48484a', fontSize: '0.9rem', lineHeight: 1.5 }}>
            <li>
              <strong>Single-person photos:</strong> Ensure photos contain only one person looking straight towards the camera.
            </li>
            <li>
              <strong>Good lighting:</strong> Natural or evenly lit indoor photos maximize recognition accuracy.
            </li>
            <li>
              <strong>Camera permissions:</strong> When entering the AR Viewer, allow browser camera access. You can stop and restart the video stream anytime.
            </li>
            <li>
              <strong>Glasses Preview:</strong> The Ray-Ban display option simulates wearable heads-up display framing.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
