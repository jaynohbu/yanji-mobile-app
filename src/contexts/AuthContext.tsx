import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { API_BASE } from '../config';
import {
  getStoredTokens,
  storeTokens,
  clearTokens,
  isTokenExpired,
  getTokenTimeRemaining,
  formatTokenExpiry,
  type StoredTokens,
} from '../utils/tokenStorage';
import { extractUserRole, isTokenAboutToExpire, getTokenDebugInfo } from '../utils/jwt';

interface AuthTokens {
  accessToken: string | null;
  idToken: string | null;
  refreshToken: string | null;
  expiry: number;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  tokens: AuthTokens;
  userRole: string | null;
  login: (username: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  setNewPassword: (username: string, newPassword: string, session: string) => Promise<LoginResult>;
  forgotPassword: (username: string) => Promise<void>;
  confirmForgotPassword: (username: string, code: string, newPassword: string) => Promise<void>;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  getAccessToken: () => string | null;
  storeTokensFromMobile: (tokens: { idToken?: string | null; accessToken?: string | null; refreshToken?: string | null }) => Promise<void>;
}

interface LoginResult {
  success: boolean;
  challengeName?: 'NEW_PASSWORD_REQUIRED';
  session?: string;
  error?: string;
}

const SESSION_KEYS = {
  userRole: 'yanji-user-role',
};

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [tokens, setTokens] = useState<AuthTokens>({
    accessToken: null,
    idToken: null,
    refreshToken: null,
    expiry: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  const isAuthenticated = !!(tokens.accessToken && !isTokenExpired(tokens.expiry));

  const refreshAccessToken = useCallback(async (): Promise<boolean> => {
    try {
      const currentTokens = await getStoredTokens();
      if (!currentTokens.refreshToken) {
        console.log('[AuthContext] No refresh token available');
        return false;
      }

      console.log('[AuthContext] Refreshing access token...');
      const response = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: currentTokens.refreshToken }),
      });

      if (!response.ok) {
        console.error('[AuthContext] Refresh failed with status:', response.status);
        return false;
      }

      const data = await response.json();
      await storeTokens(data);
      const newTokens = await getStoredTokens();
      setTokens(newTokens);
      const newRole = extractUserRole(data.idToken);
      setUserRole(newRole);
      console.log('[AuthContext] Token refreshed successfully', getTokenDebugInfo(data.idToken));
      return true;
    } catch (error) {
      console.error('[AuthContext] Token refresh failed:', error);
      return false;
    }
  }, []);

  const verifyToken = useCallback(async (): Promise<boolean> => {
    try {
      const currentTokens = await getStoredTokens();
      if (!currentTokens.accessToken) {
        console.log('[AuthContext] No access token to verify');
        return false;
      }

      const response = await fetch(`${API_BASE}/api/auth/verify`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${currentTokens.accessToken}`,
        },
      });

      const isValid = response.ok;
      console.log('[AuthContext] Token verification:', isValid ? 'valid' : 'invalid');
      return isValid;
    } catch (error) {
      console.error('[AuthContext] Token verification failed:', error);
      return false;
    }
  }, []);

  // Initial auth check
  useEffect(() => {
    async function checkAuth() {
      try {
        console.log('[AuthContext] Checking auth status...');
        const currentTokens = await getStoredTokens();

        if (!currentTokens.accessToken) {
          console.log('[AuthContext] No stored tokens found');
          setIsLoading(false);
          return;
        }

        console.log('[AuthContext] Found stored tokens, validating...');
        if (isTokenExpired(currentTokens.expiry)) {
          console.log('[AuthContext] Token expired, attempting refresh...');
          const refreshed = await refreshAccessToken();
          if (!refreshed) {
            console.log('[AuthContext] Refresh failed, clearing tokens');
            await clearTokens();
            setTokens({
              accessToken: null,
              idToken: null,
              refreshToken: null,
              expiry: 0,
            });
            setUserRole(null);
          }
        } else {
          const isValid = await verifyToken();
          if (!isValid) {
            console.log('[AuthContext] Token invalid, attempting refresh...');
            const refreshed = await refreshAccessToken();
            if (!refreshed) {
              console.log('[AuthContext] Refresh failed, clearing tokens');
              await clearTokens();
              setTokens({
                accessToken: null,
                idToken: null,
                refreshToken: null,
                expiry: 0,
              });
              setUserRole(null);
            }
          } else {
            console.log('[AuthContext] Token valid, setting up state');
            setTokens(currentTokens);
            const role = extractUserRole(currentTokens.idToken);
            setUserRole(role);
          }
        }
      } catch (error) {
        console.error('[AuthContext] Auth check error:', error);
      } finally {
        setIsLoading(false);
      }
    }

    checkAuth();
  }, [refreshAccessToken, verifyToken]);

  // Auto-refresh token every 60 seconds if authenticated
  useEffect(() => {
    const interval = setInterval(async () => {
      const currentTokens = await getStoredTokens();
      if (currentTokens.accessToken) {
        const timeRemaining = getTokenTimeRemaining(currentTokens.expiry);
        console.log('[AuthContext] Token check - time remaining:', formatTokenExpiry(currentTokens.expiry));

        if (isTokenExpired(currentTokens.expiry)) {
          console.log('[AuthContext] Token expired during interval, refreshing...');
          const refreshed = await refreshAccessToken();
          if (!refreshed) {
            console.log('[AuthContext] Refresh failed, clearing tokens');
            await clearTokens();
            setTokens({
              accessToken: null,
              idToken: null,
              refreshToken: null,
              expiry: 0,
            });
            setUserRole(null);
          }
        }
      }
    }, 60000); // Every 60 seconds

    return () => clearInterval(interval);
  }, [refreshAccessToken]);

  const login = async (username: string, password: string): Promise<LoginResult> => {
    try {
      console.log('[AuthContext] Attempting login for:', username);
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[AuthContext] Login failed:', data.message);
        return { success: false, error: data.message || 'Invalid credentials' };
      }

      if (data.challengeName === 'NEW_PASSWORD_REQUIRED') {
        console.log('[AuthContext] New password required');
        return {
          success: false,
          challengeName: 'NEW_PASSWORD_REQUIRED',
          session: data.session,
        };
      }

      console.log('[AuthContext] Login successful');
      await storeTokens(data);
      const newTokens = await getStoredTokens();
      setTokens(newTokens);
      const role = extractUserRole(data.idToken);
      setUserRole(role);
      console.log('[AuthContext] Login complete', getTokenDebugInfo(data.idToken));
      return { success: true };
    } catch (error) {
      console.error('[AuthContext] Login error:', error);
      return { success: false, error: 'An error occurred. Please try again.' };
    }
  };

  const setNewPassword = async (
    username: string,
    newPassword: string,
    session: string
  ): Promise<LoginResult> => {
    try {
      console.log('[AuthContext] Setting new password for:', username);
      const response = await fetch(`${API_BASE}/api/auth/new-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, newPassword, session }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[AuthContext] Password set failed:', data.message);
        return { success: false, error: data.message || 'Failed to set password' };
      }

      console.log('[AuthContext] Password set successfully');
      await storeTokens(data);
      const newTokens = await getStoredTokens();
      setTokens(newTokens);
      const role = extractUserRole(data.idToken);
      setUserRole(role);
      return { success: true };
    } catch (error) {
      console.error('[AuthContext] Set password error:', error);
      return { success: false, error: 'An error occurred. Please try again.' };
    }
  };

  const forgotPassword = async (username: string): Promise<void> => {
    try {
      console.log('[AuthContext] Requesting password reset for:', username);
      const response = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });

      if (!response.ok) {
        throw new Error('Failed to send verification code');
      }
      console.log('[AuthContext] Password reset requested');
    } catch (error) {
      console.error('[AuthContext] Forgot password error:', error);
      throw error;
    }
  };

  const confirmForgotPassword = async (
    username: string,
    code: string,
    newPassword: string
  ): Promise<void> => {
    try {
      console.log('[AuthContext] Confirming password reset for:', username);
      const response = await fetch(`${API_BASE}/api/auth/confirm-forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, code, newPassword }),
      });

      if (!response.ok) {
        throw new Error('Failed to reset password');
      }
      console.log('[AuthContext] Password reset confirmed');
    } catch (error) {
      console.error('[AuthContext] Confirm forgot password error:', error);
      throw error;
    }
  };

  const authFetch = async (url: string, options?: RequestInit): Promise<Response> => {
    const currentTokens = await getStoredTokens();

    if (!currentTokens.accessToken) {
      throw new Error('No access token available');
    }

    // Check if token needs refresh
    if (isTokenExpired(currentTokens.expiry)) {
      console.log('[AuthContext] Token expired for API call, refreshing...');
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        throw new Error('Failed to refresh token');
      }
      // Get fresh tokens
      const freshTokens = await getStoredTokens();
      return fetch(url, {
        ...options,
        headers: {
          ...options?.headers,
          Authorization: `Bearer ${freshTokens.accessToken}`,
        },
      });
    }

    return fetch(url, {
      ...options,
      headers: {
        ...options?.headers,
        Authorization: `Bearer ${currentTokens.accessToken}`,
      },
    });
  };

  const getAccessToken = (): string | null => {
    return tokens.accessToken;
  };

  const storeTokensFromMobile = async (receivedTokens: { idToken?: string | null; accessToken?: string | null; refreshToken?: string | null }): Promise<void> => {
    try {
      console.log('[AuthContext] Storing tokens from web callback...');
      
      const tokensToStore: Partial<StoredTokens> = {
        accessToken: receivedTokens.accessToken || undefined,
        idToken: receivedTokens.idToken || undefined,
        refreshToken: receivedTokens.refreshToken || undefined,
      };

      // Store tokens
      await storeTokens(tokensToStore as any);
      
      // Update state
      const newTokens = await getStoredTokens();
      setTokens(newTokens);
      
      // Extract and store user role
      const role = extractUserRole(receivedTokens.idToken || null);
      setUserRole(role);
      
      console.log('[AuthContext] ✅ Tokens stored successfully from web callback');
      console.log('[AuthContext] User role:', role);
    } catch (error) {
      console.error('[AuthContext] Error storing tokens from mobile:', error);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      console.log('[AuthContext] Logging out...');
      await clearTokens();
      setTokens({
        accessToken: null,
        idToken: null,
        refreshToken: null,
        expiry: 0,
      });
      setUserRole(null);
      console.log('[AuthContext] Logout complete');
    } catch (error) {
      console.error('[AuthContext] Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        tokens,
        userRole,
        login,
        logout,
        setNewPassword,
        forgotPassword,
        confirmForgotPassword,
        authFetch,
        getAccessToken,
        storeTokensFromMobile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
