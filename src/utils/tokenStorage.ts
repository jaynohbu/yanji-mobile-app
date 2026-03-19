import * as SecureStore from 'expo-secure-store';

export interface StoredTokens {
  accessToken: string | null;
  idToken: string | null;
  refreshToken: string | null;
  expiry: number;
}

const AUTH_KEYS = {
  accessToken: 'yanji-access-token',
  idToken: 'yanji-id-token',
  refreshToken: 'yanji-refresh-token',
  tokenExpiry: 'yanji-token-expiry',
  lastRefresh: 'yanji-last-refresh',
};

/**
 * Safely retrieve all stored tokens from secure storage
 */
export async function getStoredTokens(): Promise<StoredTokens> {
  try {
    const [accessToken, idToken, refreshToken, tokenExpiryStr] = await Promise.all([
      SecureStore.getItemAsync(AUTH_KEYS.accessToken),
      SecureStore.getItemAsync(AUTH_KEYS.idToken),
      SecureStore.getItemAsync(AUTH_KEYS.refreshToken),
      SecureStore.getItemAsync(AUTH_KEYS.tokenExpiry),
    ]);

    return {
      accessToken,
      idToken,
      refreshToken,
      expiry: tokenExpiryStr ? parseInt(tokenExpiryStr) : 0,
    };
  } catch (error) {
    console.error('[TokenStorage] Error retrieving tokens:', error);
    return {
      accessToken: null,
      idToken: null,
      refreshToken: null,
      expiry: 0,
    };
  }
}

/**
 * Store tokens in secure storage
 */
export async function storeTokens(tokens: {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
  expiresIn: number;
}): Promise<void> {
  try {
    const operations = [
      SecureStore.setItemAsync(AUTH_KEYS.accessToken, tokens.accessToken),
      SecureStore.setItemAsync(AUTH_KEYS.idToken, tokens.idToken),
      SecureStore.setItemAsync(
        AUTH_KEYS.tokenExpiry,
        String(Date.now() + tokens.expiresIn * 1000)
      ),
      SecureStore.setItemAsync(AUTH_KEYS.lastRefresh, String(Date.now())),
    ];

    if (tokens.refreshToken) {
      operations.push(
        SecureStore.setItemAsync(AUTH_KEYS.refreshToken, tokens.refreshToken)
      );
    }

    await Promise.all(operations);
    console.log('[TokenStorage] Tokens stored successfully');
  } catch (error) {
    console.error('[TokenStorage] Error storing tokens:', error);
    throw error;
  }
}

/**
 * Clear all tokens from secure storage
 */
export async function clearTokens(): Promise<void> {
  try {
    await Promise.all(
      Object.values(AUTH_KEYS).map((key) =>
        SecureStore.deleteItemAsync(key).catch(() => {})
      )
    );
    console.log('[TokenStorage] Tokens cleared successfully');
  } catch (error) {
    console.error('[TokenStorage] Error clearing tokens:', error);
  }
}

/**
 * Get time remaining until token expires (in seconds)
 */
export function getTokenTimeRemaining(expiry: number): number {
  if (!expiry) return -1;
  return Math.floor((expiry - Date.now()) / 1000);
}

/**
 * Check if token is expired or about to expire
 */
export function isTokenExpired(expiry: number, bufferSeconds: number = 300): boolean {
  if (!expiry) return true;
  // Expired or about to expire within buffer (default 5 minutes)
  return Date.now() > expiry - bufferSeconds * 1000;
}

/**
 * Format token expiry time for logging
 */
export function formatTokenExpiry(expiry: number): string {
  if (!expiry) return 'never';
  const secondsRemaining = getTokenTimeRemaining(expiry);
  if (secondsRemaining <= 0) return 'expired';
  if (secondsRemaining < 60) return `${secondsRemaining}s`;
  if (secondsRemaining < 3600) return `${Math.floor(secondsRemaining / 60)}m`;
  return `${Math.floor(secondsRemaining / 3600)}h`;
}
