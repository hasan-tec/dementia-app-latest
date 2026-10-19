/**
 * Forgot Password Screen
 * Initiates the password recovery flow via email instructions.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

export function ForgotPassword() {
  const { resetPasswordForEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || loading) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      const { error } = await resetPasswordForEmail(email.trim());
      if (error) {
        setErrorMessage(error.message);
        return;
      }
      setSubmitted(true);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to request password reset.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">🔑</div>
          <h1 className="auth-title">Reset Password</h1>
          <p className="auth-subtitle">Enter your account email to receive a recovery link</p>
        </div>

        {errorMessage && (
          <div className="auth-error-banner" role="alert">
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {submitted ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="auth-success-banner">
              <span>✅</span>
              <span>
                If an account exists for <strong>{email}</strong>, a recovery link has been sent. Please check your inbox.
              </span>
            </div>
            <Link to="/login" className="auth-button" style={{ textDecoration: 'none' }}>
              Back to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-field">
              <label className="auth-label" htmlFor="recovery-email">Email Address</label>
              <input
                id="recovery-email"
                type="email"
                className="auth-input"
                placeholder="caregiver@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="auth-button"
              disabled={loading || !email}
            >
              {loading ? (
                <>
                  <div className="auth-spinner" />
                  <span>Sending recovery link...</span>
                </>
              ) : (
                'Send Recovery Link'
              )}
            </button>

            <div className="auth-footer-links">
              <Link to="/login" className="auth-link">
                ← Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
