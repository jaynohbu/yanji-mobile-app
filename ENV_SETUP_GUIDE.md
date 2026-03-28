# Development Environment Setup Guide

This guide explains how the Yanji mobile app automatically manages environment variables for development builds.

## Overview

The mobile app now uses an automated setup system that:

1. **Reads development environment variables** from `.env.local` (shell export format)
2. **Injects them into `app.json`** before each development build
3. **Passes them through Expo** to the running app
4. **Auto-fills login form** with demo credentials in development mode

## Files Changed

### 1. **scripts/setup-dev-config.js** (NEW)
A Node.js script that runs **before every development build** to inject `.env.local` values into `app.json`.

**What it does:**
- Reads `.env.local` file line by line
- Parses shell export format: `export KEY=VALUE`
- Updates `app.json` `expo.extra` with corresponding values
- Logs all applied configuration for debugging
- Boolean conversion: `DEMO_USER=true` becomes `demoUser: true`

**When it runs:**
- Automatically via npm scripts before Expo commands
- No manual steps required

**Example output:**
```
✅ Loaded environment variables from .env.local
📝 Updating app.json with development configuration...
✅ app.json updated successfully
   API_BASE: http://localhost:3001
   WEBVIEW_URL: http://localhost:5173/dashboard
   DEMO_USER: true
   DEMO_USER_ID: nohjiyoung@hotmail.com
```

### 2. **package.json** (Updated)
All development npm scripts now call setup-dev-config.js first:

```json
{
  "scripts": {
    "start": "node scripts/setup-dev-config.js && expo start",
    "ios": "node scripts/setup-dev-config.js && expo run:ios",
    "android": "node scripts/setup-dev-config.js && expo run:android",
    "web": "expo start --web"
  }
}
```

**Why?** 
- Ensures latest `.env.local` values are always in `app.json`
- Works across all operating systems (Node.js is cross-platform)
- No shell dependency (unlike `source .env.local`)

### 3. **app.json** (Updated)
Added placeholder fields for demo credentials:

```json
{
  "expo": {
    "extra": {
      "apiBase": "https://api.yanjirestaurant.com",        // Production default
      "webviewUrl": "https://yanjirestaurant.com/dashboard", // Production default
      "env": "production",                                   // Production default
      "demoUser": false,                                     // Will be true in dev
      "demoUserId": "",                                      // Will be set from .env.local
      "demoPassword": "",                                    // Will be set from .env.local
      "squareTerminalDeviceId": ""                           // Will be set from .env.local
    }
  }
}
```

**Note:** These defaults are used for production builds. Development builds override them with `.env.local` values.

### 4. **src/screens/HomeScreen.tsx** (Updated)
Added JavaScript injection to pre-fill login form with demo credentials:

```typescript
// New useEffect hook that:
// 1. Checks if demoUser is true in Constants.expoConfig?.extra
// 2. Reads demoUserId and demoPassword from app.json
// 3. Injects JavaScript to populate login form fields
// 4. Retries if form not yet rendered
```

**Features:**
- Waits for login form to render before injecting values
- Handles multiple possible input selectors (name, placeholder, type)
- Triggers `input` and `change` events to update React state
- Includes retry logic with 500ms/1000ms delays
- Logs success/error messages for debugging

## Environment Variables (.env.local)

Create `.env.local` in the project root with:

```bash
export API_BASE=http://localhost:3001
export WEBVIEW_URL=http://localhost:5173/dashboard
export ENV=development
export DEMO_USER=true
export DEMO_USER_ID=nohjiyoung@hotmail.com
export DEMO_PASSWORD=Yoomin10!
export SQUARE_TERMINAL_DEVICE_ID=145CS145A8001120
```

### Variable Mapping

| .env.local Variable | app.json Field | Purpose |
|---|---|---|
| `API_BASE` | `apiBase` | Backend API URL (localhost in dev, production URL in prod) |
| `WEBVIEW_URL` | `webviewUrl` | Web app URL for WebView to load |
| `ENV` | `env` | Environment flag ("development" or "production") |
| `DEMO_USER` | `demoUser` | Enable auto-fill of login form with demo credentials |
| `DEMO_USER_ID` | `demoUserId` | Demo username/email (pre-fills username field) |
| `DEMO_PASSWORD` | `demoPassword` | Demo password (pre-fills password field) |
| `SQUARE_TERMINAL_DEVICE_ID` | `squareTerminalDeviceId` | Square device ID for print commands |

## How It Works - Step by Step

### 1. Development Build (`npm run ios`)

```
User runs: npm run ios
    ↓
package.json script executes:
  node scripts/setup-dev-config.js && expo run:ios
    ↓
setup-dev-config.js runs:
  • Reads .env.local file
  • Parses shell export lines
  • Updates app.json extra fields
    ↓
expo run:ios starts:
  • Uses updated app.json values
  • Passes to iOS simulator
    ↓
App starts:
  • Constants.expoConfig?.extra has localhost URLs
  • Constants.expoConfig?.extra.demoUser = true
    ↓
HomeScreen loads:
  • Injects demo credentials into login form
  • User sees pre-filled username/password
```

### 2. Production Build (EAS Build)

```
User runs: eas build --platform ios --profile production
    ↓
EAS Build server uses:
  • app.json defaults (production URLs)
  • No .env.local file exists on server
  • demoUser = false
    ↓
App in App Store:
  • Uses production API and web URLs
  • Login form not pre-filled
```

## Workflow Examples

### Development: Running on iOS Simulator

```bash
cd yanji-mobile-app

# Option 1: Let npm script handle setup
npm run ios
# setup-dev-config.js runs automatically

# Option 2: Manual setup + expo
node scripts/setup-dev-config.js
expo run:ios
```

**Expected result:**
- App loads from `http://localhost:5173/dashboard`
- Login form has demo credentials pre-filled
- API calls go to `http://localhost:3001`
- Print commands work with demo device ID

### Development: Using Expo Go (Quick Prototyping)

```bash
npm start
# Browser shows QR code
# Scan with Expo Go app on device
```

**Note:** This uses the setup-dev-config.js values too.

### Checking Configuration

To verify what values got injected:

```bash
# Run the setup script
node scripts/setup-dev-config.js

# Check app.json
grep -A 10 '"extra"' app.json | grep -E "(apiBase|webviewUrl|demoUser)"
```

## Debugging

### If demo credentials don't appear on login form:

1. **Check if script ran:**
   ```bash
   # Look for setup-dev-config.js output in build logs
   # Should see: ✅ Loaded environment variables from .env.local
   ```

2. **Verify app.json was updated:**
   ```bash
   cat app.json | grep demoUser
   # Should show: "demoUser": true
   ```

3. **Check .env.local exists:**
   ```bash
   ls -la .env.local
   # Should exist in yanji-mobile-app directory
   ```

4. **Enable JavaScript console:**
   - Open Safari DevTools for iOS simulator
   - Check console for injection logs:
     ```
     [YanjiAuth] Demo credentials injected into login form
     ```

### If URLs are wrong:

1. **Check .env.local values:**
   ```bash
   cat .env.local | grep -E "(API_BASE|WEBVIEW_URL)"
   ```

2. **Verify app.json was updated:**
   ```bash
   grep apiBase app.json
   ```

3. **Run setup script manually:**
   ```bash
   node scripts/setup-dev-config.js
   ```

## Summary of Changes

| File | Change | Purpose |
|---|---|---|
| `scripts/setup-dev-config.js` | Created | Auto-inject .env.local into app.json |
| `package.json` | Updated 3 scripts | Call setup script before expo commands |
| `app.json` | Updated extra fields | Add demoUser, demoUserId, demoPassword fields |
| `src/screens/HomeScreen.tsx` | Added useEffect hook | Inject credentials into login form at runtime |

## Next Steps After Setup

1. **Ensure .env.local exists** with your environment variables
2. **Run development build:** `npm run ios` or `npm run android`
3. **Verify demo credentials** appear in login form
4. **Check console logs** for `[YanjiAuth]` messages confirming injection

## Important Notes

⚠️ **Production builds:** Do NOT commit `.env.local` - it's in `.gitignore` for security
✅ **Development builds:** `.env.local` is read every time you run `npm run ios/android`
✅ **Portable:** Works on Windows, Mac, and Linux (Node.js is cross-platform)
✅ **Safe:** In production, `app.json` defaults are used; `.env.local` is not required on EAS servers
