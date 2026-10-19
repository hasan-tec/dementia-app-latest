/**
 * Safe Return Path Sanitizer
 * Protects against open redirect attacks, protocol-relative URLs, and auth callback loops.
 */

const FORBIDDEN_REDIRECT_PREFIXES = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/auth/callback',
];

export function sanitizeReturnPath(path: unknown): string {
  if (typeof path !== 'string') return '/';

  const trimmed = path.trim();

  // Reject external protocols (http:, https:, javascript:, data:)
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) {
    return '/';
  }

  // Reject protocol-relative URLs (e.g. "//malicious-site.com")
  if (trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return '/';
  }

  // Must begin with single forward slash
  if (!trimmed.startsWith('/')) {
    return '/';
  }

  // Reject redirects back into auth loops
  for (const forbidden of FORBIDDEN_REDIRECT_PREFIXES) {
    if (trimmed === forbidden || trimmed.startsWith(`${forbidden}/`) || trimmed.startsWith(`${forbidden}?`)) {
      return '/';
    }
  }

  return trimmed;
}
