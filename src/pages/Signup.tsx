/**
 * Signup Screen
 * Registers a new caregiver account with password confirmation and verification handling.
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Info, Brain, AlertTriangle, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

export function Signup() {
  const { signUp, isConfigured } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
            <div className="auth-logo"><Mail size={28} color="#ffffff" strokeWidth={2.2} /></div>
            <h1 className="auth-title">Check Your Email</h1>
            <p className="auth-subtitle">
              We sent a verification link to <strong>{email}</strong>.
            </p>
          </div>

          <div className="auth-success-banner">
            <span><Info size={16} /></span>
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
          <div className="auth-logo"><Brain size={30} color="#ffffff" strokeWidth={2.2} /></div>
          <h1 className="auth-title">Create Account</h1>
          <p className="auth-subtitle">Set up your private caregiver account to get started</p>
        </div>

        {!isConfigured && (
          <div className="auth-error-banner" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} style={{ flexShrink: 0 }} /> Supabase credentials not found in environment. Please add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to your .env file.
          </div>
        )}

        {errorMessage && (
          <div className="auth-error-banner" role="alert">
            <span><AlertCircle size={16} /></span>
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
            <div className="auth-password-wrapper">
              <input
                id="signup-password"
                type={showPassword ? 'text' : 'password'}
                className="auth-input auth-input-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                disabled={loading}
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="signup-confirm-password">Confirm Password</label>
            <div className="auth-password-wrapper">
              <input
                id="signup-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                className="auth-input auth-input-password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                disabled={loading}
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowConfirmPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
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
