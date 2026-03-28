#!/usr/bin/env node

/**
 * Setup Development Configuration
 * 
 * This script reads environment variables from .env.local and updates app.json
 * with development values. It only runs when NODE_ENV is development.
 * 
 * Usage:
 *   node scripts/setup-dev-config.js
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Read .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envVars = {};

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  // Parse shell export format: export KEY=VALUE
  envContent.split('\n').forEach(line => {
    const match = line.match(/^export\s+(\w+)=(.*)$/);
    if (match) {
      const [, key, value] = match;
      envVars[key] = value;
    }
  });
  console.log('✅ Loaded environment variables from .env.local');
} else {
  console.warn('⚠️  .env.local not found, using production defaults');
}

// Read app.json
const appJsonPath = path.join(__dirname, '..', 'app.json');
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'));

// Update app.json with development values if available
if (envVars.API_BASE || envVars.WEBVIEW_URL || envVars.ENV === 'development') {
  console.log('📝 Updating app.json with development configuration...');
  
  appJson.expo.extra = appJson.expo.extra || {};
  
  if (envVars.API_BASE) appJson.expo.extra.apiBase = envVars.API_BASE;
  if (envVars.WEBVIEW_URL) appJson.expo.extra.webviewUrl = envVars.WEBVIEW_URL;
  if (envVars.ENV) appJson.expo.extra.env = envVars.ENV;
  if (envVars.DEMO_USER) appJson.expo.extra.demoUser = envVars.DEMO_USER === 'true';
  if (envVars.DEMO_USER_ID) appJson.expo.extra.demoUserId = envVars.DEMO_USER_ID;
  if (envVars.DEMO_PASSWORD) appJson.expo.extra.demoPassword = envVars.DEMO_PASSWORD;
  if (envVars.SQUARE_TERMINAL_DEVICE_ID) appJson.expo.extra.squareTerminalDeviceId = envVars.SQUARE_TERMINAL_DEVICE_ID;

  // Write updated app.json
  fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n');
  console.log('✅ app.json updated successfully');
  console.log('   API_BASE:', appJson.expo.extra.apiBase);
  console.log('   WEBVIEW_URL:', appJson.expo.extra.webviewUrl);
  console.log('   DEMO_USER:', appJson.expo.extra.demoUser);
  console.log('   DEMO_USER_ID:', appJson.expo.extra.demoUserId);
}
