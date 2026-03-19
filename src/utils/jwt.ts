/**
 * JWT decoding utilities
 */

export interface DecodedToken {
  name?: string;
  given_name?: string;
  email?: string;
  email_verified?: boolean;
  'custom:role'?: string;
  role?: string;
  'cognito:groups'?: string[];
  aud?: string;
  event_id?: string;
  token_use?: string;
  auth_time?: number;
  exp?: number;
  iat?: number;
  iss?: string;
  [key: string]: any;
}

/**
 * Decode JWT token to extract claims
 * Handles React Native's atob limitations with proper padding
 */
export function decodeToken(token: string | null): DecodedToken | null {
  if (!token) {
    console.log('[JWT] No token provided');
    return null;
  }

  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.error('[JWT] Invalid token format (expected 3 parts)');
      return null;
    }

    let payload = parts[1];
    // Handle URL-safe base64 encoding (replace - and _ with + and /)
    payload = payload.replace(/-/g, '+').replace(/_/g, '/');

    // Add padding if needed
    while (payload.length % 4 !== 0) {
      payload += '=';
    }

    try {
      const decoded = JSON.parse(atob(payload));
      return decoded as DecodedToken;
    } catch (parseError) {
      console.error('[JWT] Failed to parse decoded payload:', parseError);
      return null;
    }
  } catch (error) {
    console.error('[JWT] Failed to decode token:', error);
    return null;
  }
}

/**
 * Extract user role from ID token
 * Checks multiple possible claim locations for backwards compatibility
 */
export function extractUserRole(idToken: string | null): string | null {
  if (!idToken) {
    console.log('[JWT] No idToken provided for role extraction');
    return null;
  }

  const decoded = decodeToken(idToken);
  if (!decoded) {
    console.log('[JWT] Failed to decode idToken');
    return null;
  }

  // IMPORTANT: In this app, the Cognito `name` claim is the canonical source of truth for
  // the user's role (for example: `admin`, `staff`, `owner`). Keep this first so we don't
  // accidentally switch role parsing to a different claim again.
  // The other fields below are only legacy/fallback compatibility for older tokens.
  const candidateRole =
    decoded['name'] ||
    decoded['given_name'] ||
    decoded['custom:role'] ||
    decoded['role'] ||
    (Array.isArray(decoded['cognito:groups']) ? decoded['cognito:groups'][0] : null) ||
    null;

  const normalizedRole = typeof candidateRole === 'string' ? candidateRole.trim().toLowerCase() : null;

  console.log('[JWT] Extracted role from token:', normalizedRole);
  return normalizedRole;
}

/**
 * Check if token is about to expire
 */
export function isTokenAboutToExpire(idToken: string | null, bufferSeconds: number = 300): boolean {
  if (!idToken) return true;

  const decoded = decodeToken(idToken);
  if (!decoded || !decoded.exp) return true;

  const expiryTime = decoded.exp * 1000; // Convert seconds to milliseconds
  const bufferTime = bufferSeconds * 1000;

  return Date.now() + bufferTime > expiryTime;
}

/**
 * Get token expiry timestamp in milliseconds
 */
export function getTokenExpiryMs(idToken: string | null): number {
  if (!idToken) return 0;

  const decoded = decodeToken(idToken);
  if (!decoded || !decoded.exp) return 0;

  return decoded.exp * 1000;
}

/**
 * Format token info for debugging
 */
export function getTokenDebugInfo(idToken: string | null): string {
  if (!idToken) return 'No token';

  const decoded = decodeToken(idToken);
  if (!decoded) return 'Invalid token';

  const expiryMs = getTokenExpiryMs(idToken);
  const timeRemaining = Math.floor((expiryMs - Date.now()) / 1000);

  return `Role: ${extractUserRole(idToken)}, Exp in: ${timeRemaining}s`;
}
