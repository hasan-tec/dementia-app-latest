/**
 * Protected Route Wrapper
 * Guards authenticated routes, shows a neutral loading state while session initializes,
 * and redirects unauthenticated visitors to /login preserving a sanitized return path.
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { sanitizeReturnPath } from '../../lib/safe-return-path';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'initializing') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: '#0a0d14',
          color: '#94a3b8',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            border: '3px solid rgba(255, 255, 255, 0.1)',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            marginBottom: '16px',
          }}
        />
        <p style={{ margin: 0, fontSize: '0.9rem' }}>Verifying session...</p>
        <style>
          {`@keyframes spin { to { transform: rotate(360deg); } }`}
        </style>
      </div>
    );
  }

  if (status === 'signedOut') {
    const returnUrl = sanitizeReturnPath(location.pathname + location.search);
    return <Navigate to={`/login?returnUrl=${encodeURIComponent(returnUrl)}`} replace />;
  }

  return <>{children}</>;
}
