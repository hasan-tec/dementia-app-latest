/**
 * Reset Password Screen
 * Completes recovery flow when user arrives from a valid Supabase recovery link.
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

export function ResetPassword() {
  const { updatePassword, isRecoveryMode, session } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // User is allowed if in recovery mode OR has an active authenticated session from the recovery email
  const hasValidContext = isRecoveryMode || Boolean(session);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const { error } = await updatePassword(password);
      if (error) {
        setErrorMessage(error.message);
        return;
      }
      setSuccess(true);
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 2500);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  }

  if (!hasValidContext && !success) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo"><AlertTriangle size={28} color="#ffffff" strokeWidth={2.2} /></div>
            <h1 className="auth-title">Invalid or Expired Link</h1>
            <p className="auth-subtitle">
              This password reset link is invalid or has expired. Please request a new link.
            </p>
          </div>

          <Link to="/forgot-password" className="auth-button" style={{ textDecoration: 'none' }}>
            Request New Link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo"><Lock size={28} color="#ffffff" strokeWidth={2.2} /></div>
          <h1 className="auth-title">Set New Password</h1>
          <p className="auth-subtitle">Create a secure new password for your account</p>
        </div>

        {errorMessage && (
          <div className="auth-error-banner" role="alert">
            <span><AlertCircle size={16} /></span>
            <span>{errorMessage}</span>
          </div>
        )}

        {success ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="auth-success-banner">
              <span><CheckCircle2 size={16} color="#34c759" /></span>
              <span>Your password has been reset successfully! Redirecting you to the dashboard...</span>
            </div>
            <Link to="/" className="auth-button" style={{ textDecoration: 'none' }}>
              Go to Dashboard
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-field">
              <label className="auth-label" htmlFor="new-password">New Password (min 8 characters)</label>
              <input
                id="new-password"
                type="password"
                className="auth-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                disabled={loading}
              />
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="new-confirm-password">Confirm New Password</label>
              <input
                id="new-confirm-password"
                type="password"
                className="auth-input"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="auth-button"
              disabled={loading || !password || !confirmPassword}
            >
              {loading ? (
                <>
                  <div className="auth-spinner" />
                  <span>Updating password...</span>
                </>
              ) : (
                'Save New Password'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
