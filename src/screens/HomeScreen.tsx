// =============================================================================
// PRINT-STEP 3: WebView message bridge — native side
//
// This screen hosts the publicly-hosted yanji-landing website inside a WebView.
// When the website calls sendPrintCommand() and detects it is running inside the
// app (window.ReactNativeWebView exists), it posts a message of type 'print'
// instead of attempting a direct HTTP call to the local printer — which would
// be blocked from a public host.
//
// HomeScreen receives that message here, calls the Star SDK print service
// (printService.ts), and posts the result back to the web page via
// injectJavaScript so the web can show success/error feedback to the user.
// =============================================================================

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Text,
  SafeAreaView,
  Alert,
  Platform,
  AppState,
  AppStateStatus,
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import Constants from 'expo-constants';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE } from '../config';

// PRINT-STEP 3a: Import the native Star SDK print service.
// This import will only work in a development/production build (not Expo Go)
// because react-native-star-io10 contains native iOS/Android modules.
import { printToStarTSP100III } from '../services/printService';

// PRINT-STEP 3b: Add 'print' to the message type union so TypeScript recognises
// messages sent by sendPrintCommand() in OrdersDashboard.tsx.
interface WebViewMessage {
  type: 'log' | 'error' | 'tokenRefresh' | 'debug' | 'activity' | 'print';
  data?: any;
  timestamp?: number;
}

export function HomeScreen() {
  const { tokens, logout, userRole, isAuthenticated, storeTokensFromMobile } = useAuth();
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenInjected, setTokenInjected] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [maxRetries, setMaxRetries] = useState(5);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTokenRef = useRef<string>('');
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Constants for error retry
  const TOKEN_POLLING_INTERVAL_MS = 5 * 1000; // Poll for tokens every 5 seconds
  const MOBILE_APP_ACCESS_KEY = 'mobile-app-secret-key-2026'; // Should match env var in web
  const MAX_RETRIES = 5;
  const INITIAL_RETRY_DELAY_MS = 2000; // 2 seconds
  const MAX_RETRY_DELAY_MS = 30000; // 30 seconds

  // Safely escape string for JavaScript injection
  const escapeForJavaScript = useCallback((str: string | null | undefined): string => {
    if (!str) return '';
    return str
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');
  }, []);

  // Inject token into WebView when auth changes
  useEffect(() => {
    if (!tokens.accessToken || !webViewRef.current) {
      console.log('[HomeScreen] Missing token or webview ref');
      return;
    }

    // Only inject if token has changed
    if (lastTokenRef.current === tokens.accessToken) {
      console.log('[HomeScreen] Token unchanged, skipping injection');
      return;
    }

    lastTokenRef.current = tokens.accessToken;
    setError(null);

    const escapedAccessToken = escapeForJavaScript(tokens.accessToken);
    const escapedIdToken = escapeForJavaScript(tokens.idToken);

    // JavaScript to inject token into localStorage
    const injectionScript = `
      (function() {
        try {
          // Store tokens in localStorage
          localStorage.setItem('yanji-access-token', '${escapedAccessToken}');
          localStorage.setItem('yanji-id-token', '${escapedIdToken}');
          
          // Store metadata
          localStorage.setItem('yanji-auth-timestamp', Date.now().toString());
          localStorage.setItem('yanji-token-expiry', '${tokens.expiry}');
          
          // Trigger global auth event
          const authEvent = new CustomEvent('yanjAuthTokenUpdated', {
            detail: {
              accessToken: '${escapedAccessToken.substring(0, 20)}...',
              timestamp: Date.now(),
              hasToken: true
            }
          });
          window.dispatchEvent(authEvent);
          
          // Send confirmation to native
          window.ReactNativeWebView?.postMessage(JSON.stringify({
            type: 'debug',
            data: 'Token injected successfully into localStorage'
          }));
          
          console.log('[YanjiAuth] Token injected into localStorage');
        } catch (e) {
          console.error('[YanjiAuth] Injection error:', e);
          window.ReactNativeWebView?.postMessage(JSON.stringify({
            type: 'error',
            data: 'Token injection failed: ' + e.message
          }));
        }
      })();
      true;
    `;

    webViewRef.current.injectJavaScript(injectionScript);
    setTokenInjected(true);
    console.log('[HomeScreen] Token injected into WebView');
  }, [tokens.accessToken, tokens.idToken, tokens.expiry, escapeForJavaScript]);

  // Inject demo credentials into login form when available (development only)
  useEffect(() => {
    if (!webViewRef.current) return;

    const demoUser = Constants.expoConfig?.extra?.demoUser;
    const demoUserId = Constants.expoConfig?.extra?.demoUserId;
    const demoPassword = Constants.expoConfig?.extra?.demoPassword;

    if (!demoUser || !demoUserId || !demoPassword) {
      console.log('[HomeScreen] Demo credentials not configured');
      return;
    }

    console.log('[HomeScreen] Injecting demo credentials into login form');

    const escapedDemoUserId = escapeForJavaScript(demoUserId);
    const escapedDemoPassword = escapeForJavaScript(demoPassword);

    const injectionScript = `
      (function() {
        try {
          // Wait for the login form to render
          const tryInject = () => {
            const usernameInput = document.querySelector('input[name="username"]') || 
                                 document.querySelector('input[placeholder*="Username"]') ||
                                 document.querySelector('input[placeholder*="Email"]') ||
                                 document.querySelector('input[type="email"]') ||
                                 document.querySelector('input[type="text"][id*="username"]') ||
                                 document.querySelector('input[type="text"][id*="email"]');
            const passwordInput = document.querySelector('input[name="password"]') || 
                                 document.querySelector('input[placeholder*="Password"]') ||
                                 document.querySelector('input[type="password"]');
            
            if (usernameInput && passwordInput) {
              usernameInput.value = '${escapedDemoUserId}';
              passwordInput.value = '${escapedDemoPassword}';
              
              // Trigger input events to update React state
              usernameInput.dispatchEvent(new Event('input', { bubbles: true }));
              usernameInput.dispatchEvent(new Event('change', { bubbles: true }));
              passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
              passwordInput.dispatchEvent(new Event('change', { bubbles: true }));
              
              console.log('[YanjiAuth] Demo credentials injected into login form');
              window.ReactNativeWebView?.postMessage(JSON.stringify({
                type: 'debug',
                data: 'Demo credentials pre-filled'
              }));
              return true;
            } else {
              // Retry after short delay if form not ready yet
              if (document.readyState === 'loading') {
                setTimeout(tryInject, 500);
              } else {
                // Try one more time after a longer delay
                setTimeout(tryInject, 1000);
              }
            }
          };
          
          tryInject();
        } catch (e) {
          console.error('[YanjiAuth] Demo credential injection error:', e);
        }
      })();
      true;
    `;

    webViewRef.current.injectJavaScript(injectionScript);
  }, [escapeForJavaScript]);

  // Reset inactivity timer on user activity

  const retryLoad = useCallback(() => {
    if (retryCount >= MAX_RETRIES) {
      console.error('[WebView] Max retries reached, giving up');
      setError(`Failed to load page after ${MAX_RETRIES} attempts. Please check your connection and try again.`);
      return;
    }

    // Calculate exponential backoff delay
    const delayMs = Math.min(
      INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount),
      MAX_RETRY_DELAY_MS
    );

    console.log(`[WebView] Scheduling retry ${retryCount + 1}/${MAX_RETRIES} in ${delayMs}ms`);
    setError(`Connection failed. Retrying... (${retryCount + 1}/${MAX_RETRIES})`);
    setLoading(true);

    retryTimerRef.current = setTimeout(() => {
      console.log(`[WebView] Executing retry ${retryCount + 1}/${MAX_RETRIES}`);
      if (webViewRef.current) {
        webViewRef.current.reload();
        setRetryCount(prev => prev + 1);
      }
    }, delayMs);
  }, [retryCount]);

  // Cleanup retry timer on unmount
  useEffect(() => {
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

  // Handle messages from WebView
  const handleWebViewMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const message: WebViewMessage = JSON.parse(event.nativeEvent.data);
      const timestamp = new Date().toISOString();

      switch (message.type) {
        case 'log':
          console.log(`[WebView ${timestamp}]`, message.data);
          break;
        case 'debug':
          console.log(`[WebView Debug ${timestamp}]`, message.data);
          break;
        case 'activity':
          // Activity detected - app is in use (no action needed)
          console.log('[HomeScreen] User activity detected');
          break;
        case 'error':
          console.error(`[WebView Error ${timestamp}]`, message.data);
          setError(message.data || 'WebView error occurred');
          break;
        case 'tokenRefresh':
          console.log(`[WebView ${timestamp}] Token refresh requested`);
          // Token will be auto-injected on next auth context change
          break;

        // PRINT-STEP 3c: Handle the 'print' message posted by sendPrintCommand()
        // in OrdersDashboard.tsx. The web page captures its receipt as a base64
        // image and sends it to the native side for printing.
        case 'print': {
          const { printerIp, receiptImage } = message.data;
          console.log(`[HomeScreen] PRINT-STEP 3c: Received print request for printer at ${printerIp}`);
          console.log(`[HomeScreen] Image size: ${receiptImage?.length || 0} bytes`);

          // PRINT-STEP 3d: Call the Star SDK service with the base64 receipt image
          printToStarTSP100III(printerIp, receiptImage)
            .then(() => {
              console.log(`[HomeScreen] PRINT-STEP 3d: Print succeeded, notifying web page`);
              // PRINT-STEP 3e: Notify the web page of success
              webViewRef.current?.injectJavaScript(`
                window.dispatchEvent(new CustomEvent('yanjPrintResult', { detail: { success: true } }));
                true;
              `);
            })
            .catch((err: Error) => {
              console.error(`[HomeScreen] PRINT-STEP 3d: Print failed:`, err.message);
              // PRINT-STEP 3e: Notify the web page of failure
              webViewRef.current?.injectJavaScript(`
                window.dispatchEvent(new CustomEvent('yanjPrintResult', { detail: { success: false, error: ${JSON.stringify(err.message)} } }));
                true;
              `);
            });
          break;
        }

        default:
          console.log(`[WebView ${timestamp}] Unknown message type:`, message.type);
      }
    } catch (error) {
      console.log('[WebView] Raw message:', event.nativeEvent.data);
    }
  }, []);

  // Setup token injection interceptor for all requests
  const setupTokenInterceptor = `
    (function() {
      try {
        // Store original fetch
        const originalFetch = window.fetch;
        
        // Override fetch to include auth token
        window.fetch = function(...args) {
          let [resource, config] = args;
          const token = localStorage.getItem('yanji-access-token');
          
          if (token && typeof resource === 'string') {
            if (!config) config = {};
            if (!config.headers) config.headers = {};
            
            // Add Authorization header
            config.headers['Authorization'] = 'Bearer ' + token;
          }
          
          return originalFetch.apply(this, args);
        };
        
        // Setup axios interceptor if available
        if (window.axios) {
          window.axios.interceptors.request.use(function(config) {
            const token = localStorage.getItem('yanji-access-token');
            if (token) {
              config.headers.Authorization = 'Bearer ' + token;
            }
            return config;
          });
        }
        
        console.log('[YanjiAuth] Request interceptors installed');
        window.ReactNativeWebView?.postMessage(JSON.stringify({
          type: 'debug',
          data: 'Request interceptors installed'
        }));
      } catch (e) {
        console.error('[YanjiAuth] Interceptor setup error:', e);
      }
    })();
    true;
  `;

  // Listen for app state changes (foreground/background) to reload when app wakes from sleep
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, []);

  const handleAppStateChange = useCallback((nextAppState: AppStateStatus) => {
    // Check if app is transitioning from background to foreground
    if (appStateRef.current !== 'active' && nextAppState === 'active') {
      console.log('[HomeScreen] App came to foreground, reloading WebView');
      if (webViewRef.current) {
        webViewRef.current.reload();
      }
    }

    appStateRef.current = nextAppState;
  }, []);



  // Poll for tokens from backend API (DISABLED - tokens managed by AuthContext)
  // useEffect(() => {
  //   if (isAuthenticated && tokens.accessToken) {
  //     // Already have tokens, stop polling
  //     if (pollingTimerRef.current) {
  //       clearInterval(pollingTimerRef.current);
  //       pollingTimerRef.current = null;
  //     }
  //     return;
  //   }

  //   const pollForTokens = async () => {
  //     try {
  //       const url = `https://yanjirestaurant.com/api/auth/login`;
  //       const response = await fetch(url, {
  //         method: 'POST',
  //         headers: {
  //           'Content-Type': 'application/json',
  //         },
  //         body: JSON.stringify({
  //           username: 'staff@yanjirestaurant.com',
  //           password: 'Yanji1234!',
  //         }),
  //       });

  //       if (response.ok) {
  //         const data = await response.json();
  //         console.log('[HomeScreen] Login response received:', {
  //           hasToken: !!(data.accessToken && data.idToken),
  //           timestamp: new Date().toISOString(),
  //         });

  //         if (data.accessToken && data.idToken) {
  //           console.log('[HomeScreen] ✓ Tokens received! Storing tokens...');
  //           // Store tokens from backend API
  //           await storeTokensFromMobile({
  //             accessToken: data.accessToken,
  //             idToken: data.idToken,
  //             refreshToken: data.refreshToken,
  //           });
  //           console.log('[HomeScreen] ✓ Tokens stored successfully');
  //           // Stop polling once we have tokens
  //           if (pollingTimerRef.current) {
  //             clearInterval(pollingTimerRef.current);
  //             pollingTimerRef.current = null;
  //           }
  //         } else {
  //           console.log('[HomeScreen] No tokens in response, will check again...');
  //         }
  //       } else {
  //         const errorData = await response.json();
  //         console.log('[HomeScreen] Login failed:', errorData.message || 'Unknown error');
  //       }
  //     } catch (error) {
  //       console.log('[HomeScreen] Token polling error:', error);
  //       // Continue polling even on error
  //     }
  //   };

  //   // Start polling only if not authenticated
  //   console.log('[HomeScreen] Starting token acquisition...');
  //   pollingTimerRef.current = setInterval(pollForTokens, TOKEN_POLLING_INTERVAL_MS);
  //   // Poll immediately on start
  //   pollForTokens();

  //   return () => {
  //     if (pollingTimerRef.current) {
  //       clearInterval(pollingTimerRef.current);
  //       pollingTimerRef.current = null;
  //     }
  //   };
  // }, [isAuthenticated, tokens.accessToken, storeTokensFromMobile]);


  return (
    <SafeAreaView style={styles.container}>
      {/* Error Banner with Retry */}
      {error && (
        <View style={styles.errorBanner}>
          <View style={styles.errorBannerContent}>
            <Text style={styles.errorBannerText}>{error}</Text>
            {retryCount < MAX_RETRIES && (
              <TouchableOpacity 
                style={styles.retryButton}
                onPress={() => {
                  setRetryCount(0);
                  if (retryTimerRef.current) {
                    clearTimeout(retryTimerRef.current);
                  }
                  retryLoad();
                }}
              >
                <Text style={styles.retryButtonText}>Retry Now</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={() => setError(null)}>
            <Text style={styles.errorBannerClose}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* WebView */}
      <View style={styles.webviewContainer}>
        <WebView
          ref={webViewRef}
          source={{ uri: Constants.expoConfig?.extra?.webviewUrl || 'https://yanjirestaurant.com/dashboard' }}
          style={styles.webview}
          onLoadStart={() => {
            setLoading(true);
            setError(null);
            console.log('[WebView] Loading from URL:', Constants.expoConfig?.extra?.webviewUrl || 'https://yanjirestaurant.com/dashboard');
            console.log('[WebView] Load started');
          }}
          onLoadEnd={() => {
            setLoading(false);
            // Reset retry count on successful load
            setRetryCount(0);
            if (retryTimerRef.current) {
              clearTimeout(retryTimerRef.current);
            }
            console.log('[WebView] Load ended successfully');
          }}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.error('[WebView] Error:', nativeEvent);
            setLoading(false);
            retryLoad();
          }}
          onMessage={handleWebViewMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          geolocationEnabled={false}
          allowUniversalAccessFromFileURLs={true}
          mixedContentMode="always"
          scalesPageToFit={true}
          startInLoadingState={true}
          incognito={false}
          // Inject token interceptor
          injectedJavaScript={setupTokenInterceptor}
          // Security
          userAgent={`Yanji/${Platform.OS}-v1.0`}
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#000" />
              <Text style={styles.loadingText}>
                {retryCount > 0 ? `Loading... (Attempt ${retryCount}/${MAX_RETRIES})` : 'Loading website...'}
              </Text>
            </View>
          )}
          // Performance
          cacheEnabled={false}
          // Cookies
          sharedCookiesEnabled={true}
        />
      </View>

      {/* Loading Overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  webviewContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: '#0f3460',
    fontWeight: '600',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    zIndex: 999,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorContent: {
    padding: 32,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 20,
    borderLeftWidth: 5,
    borderLeftColor: '#f43f5e',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 25 },
    shadowOpacity: 0.35,
    shadowRadius: 65,
    elevation: 8,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 12,
    color: '#0f3460',
  },
  errorMessage: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 1.5,
  },
  primaryButton: {
    backgroundColor: '#4ecdc4',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 10,
    shadowColor: '#4ecdc4',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  errorBanner: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#f87171',
  },
  errorBannerContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginRight: 12,
  },
  errorBannerText: {
    color: '#dc2626',
    fontSize: 14,
    flex: 1,
    fontWeight: '600',
  },
  retryButton: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  errorBannerClose: {
    color: '#dc2626',
    fontSize: 20,
    fontWeight: '700',
  },
});
