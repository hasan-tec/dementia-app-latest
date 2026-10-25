/**
 * Login Screen
 * Authenticates caregiver via email and password using Supabase Auth.
 */

import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Brain, AlertTriangle, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { sanitizeReturnPath } from '../lib/safe-return-path';
import './Auth.css';

export function Login() {
  const { signIn, isConfigured } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const returnUrl = sanitizeReturnPath(searchParams.get('returnUrl') || '/');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password || loading) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      const { error } = await signIn(email.trim(), password);

      if (error) {
        // Generic clean message to prevent account enumeration, unless specific issue
        if (error.message.includes('Invalid login credentials')) {
          setErrorMessage('Invalid email address or password. Please try again.');
        } else if (error.message.includes('Email not confirmed')) {
          setErrorMessage('Please confirm your email address before signing in.');
        } else {
          setErrorMessage(error.message);
        }
        return;
      }

      navigate(returnUrl, { replace: true });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred during sign in.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Brain size={30} color="#ffffff" strokeWidth={2.2} />
          </div>
          <h1 className="auth-title">Welcome Back</h1>
          <p className="auth-subtitle">Sign in to your caregiver memory assistance portal</p>
        </div>

        {!isConfigured && (
          <div className="auth-error-banner">
            <AlertTriangle size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
            <span>Supabase credentials not found in environment. Please add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to your .env file.</span>
          </div>
        )}

        {errorMessage && (
          <div className="auth-error-banner" role="alert">
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label className="auth-label" htmlFor="login-email">Email Address</label>
            <input
              id="login-email"
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="auth-label" htmlFor="login-password">Password</label>
              <Link to="/forgot-password" className="auth-link" style={{ fontSize: '0.82rem' }}>
                Forgot password?
              </Link>
            </div>
            <div className="auth-password-wrapper">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="auth-input auth-input-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
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

          <button
            type="submit"
            className="auth-button"
            disabled={loading || !email || !password}
          >
            {loading ? (
              <>
                <div className="auth-spinner" />
                <span>Signing in...</span>
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="auth-footer-links">
          <span>
            Don't have an account?{' '}
            <Link to="/signup" className="auth-link">
              Sign up
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
}
