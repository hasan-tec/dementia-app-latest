/**
 * Auth Callback Handler
 * Exchanges verification / recovery tokens from email links and redirects cleanly.
 */

import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './Auth.css';

export function AuthCallback() {
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function handleAuthExchange() {
      try {
        // Supabase client with detectSessionInUrl automatically processes hash / code.
        // We fetch the resulting session:
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          if (isMounted) setErrorMessage(error.message);
          return;
        }

        if (session) {
          // Check if user came from password recovery
          const urlParams = new URLSearchParams(window.location.search);
          const type = urlParams.get('type');

          if (type === 'recovery' || window.location.hash.includes('type=recovery')) {
            navigate('/reset-password', { replace: true });
          } else {
            navigate('/', { replace: true });
          }
        } else {
          // Wait briefly in case the hash exchange is asynchronously finalizing
          const timeout = setTimeout(async () => {
            const { data } = await supabase.auth.getSession();
            if (data.session) {
              navigate('/', { replace: true });
            } else if (isMounted) {
              setErrorMessage('Verification link is invalid, expired, or was already used.');
            }
          }, 1200);

          return () => clearTimeout(timeout);
        }
      } catch (err) {
        if (isMounted) {
          setErrorMessage(err instanceof Error ? err.message : 'Authentication exchange failed.');
        }
      }
    }

    handleAuthExchange();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  return (
    <div className="auth-container">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div className="auth-header">
          <div className="auth-logo"><RefreshCw size={28} color="#ffffff" strokeWidth={2.2} /></div>
          <h1 className="auth-title">Verifying Account</h1>
          <p className="auth-subtitle">Finalizing your authentication, please wait...</p>
        </div>

        {errorMessage ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="auth-error-banner">
              <span><AlertCircle size={16} /></span>
              <span>{errorMessage}</span>
            </div>
            <Link to="/login" className="auth-button" style={{ textDecoration: 'none' }}>
              Return to Sign In
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                border: '3px solid rgba(0, 113, 227, 0.2)',
                borderTopColor: '#0071e3',
                borderRadius: '50%',
                animation: 'authSpin 0.8s linear infinite',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
