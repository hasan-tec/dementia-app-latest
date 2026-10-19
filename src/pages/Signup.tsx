/**
 * Signup Screen
 * Registers a new caregiver account with password confirmation and verification handling.
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

export function Signup() {
  const { signUp, isConfigured } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify your entries.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters in length.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const { error, needsEmailConfirmation } = await signUp(email.trim(), password);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (needsEmailConfirmation) {
        setNeedsConfirmation(true);
      } else {
        // Direct login if confirmation is disabled in Supabase project
        navigate('/', { replace: true });
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'An error occurred during account creation.');
    } finally {
      setLoading(false);
    }
  }

  if (needsConfirmation) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo">✉️</div>
            <h1 className="auth-title">Check Your Email</h1>
            <p className="auth-subtitle">
              We sent a verification link to <strong>{email}</strong>.
            </p>
          </div>

          <div className="auth-success-banner">
            <span>ℹ️</span>
            <span>Click the confirmation link in the email to activate your account, then sign in.</span>
          </div>

          <Link to="/login" className="auth-button" style={{ textDecoration: 'none' }}>
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">N</div>
          <h1 className="auth-title">Create Account</h1>
          <p className="auth-subtitle">Set up your private caregiver account to get started</p>
        </div>

        {!isConfigured && (
          <div className="auth-error-banner">
            ⚠️ Supabase credentials not found in environment. Please add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to your .env file.
          </div>
        )}

        {errorMessage && (
          <div className="auth-error-banner" role="alert">
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label className="auth-label" htmlFor="signup-email">Email Address</label>
            <input
              id="signup-email"
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

          <div className="auth-field">
            <label className="auth-label" htmlFor="signup-password">Password (min 8 characters)</label>
            <input
              id="signup-password"
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
            <label className="auth-label" htmlFor="signup-confirm-password">Confirm Password</label>
            <input
              id="signup-confirm-password"
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
            disabled={loading || !email || !password || !confirmPassword}
          >
            {loading ? (
              <>
                <div className="auth-spinner" />
                <span>Creating account...</span>
              </>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <div className="auth-footer-links">
          <span>
            Already have an account?{' '}
            <Link to="/login" className="auth-link">
              Sign in
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
}
