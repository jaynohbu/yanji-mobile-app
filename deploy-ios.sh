#!/bin/bash

################################################################################
# Yanji Mobile App - iOS Deployment Script
# Builds and submits iOS app to App Store via EAS
# Bundle ID: com.yanjirestaurant.app
# Distribution: App Store (production)
################################################################################

set -euo pipefail

cd "$(dirname "$0")"
export EXPO_NO_DOTENV=1

# Configuration
BUNDLE_ID="com.yanjirestaurant.app"
PROFILE="production"
PLATFORM="ios"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Yanji Mobile App - iOS Deployment${NC}"
echo -e "${GREEN}========================================${NC}"
echo "Bundle ID: $BUNDLE_ID"
echo "Profile: $PROFILE"
echo "Platform: $PLATFORM"
echo ""

# Step 1: Verify prerequisites
echo -e "${YELLOW}[1/4] Checking prerequisites...${NC}"

# Check if eas-cli is installed
if ! command -v eas &> /dev/null; then
    echo -e "${RED}✗ EAS CLI not found${NC}"
    echo "Install eas-cli before deploying."
    exit 1
fi
echo -e "${GREEN}✓ EAS CLI available${NC}"

# Check if logged in to EAS
if ! eas whoami &> /dev/null 2>&1; then
    echo -e "${YELLOW}Not logged in to EAS. Please authenticate:${NC}"
    eas login
fi
echo -e "${GREEN}✓ EAS authenticated${NC}"
node <<'NODE'
const assert = require('node:assert/strict');
const { getConfig } = require('@expo/config');
const { extra } = getConfig(process.cwd()).exp;
assert.equal(extra.env, 'production', 'Deployment requires production configuration');
assert.equal(extra.demoUser, false, 'Demo login must be disabled for deployment');
assert.equal(extra.demoUserId, undefined, 'Remove demo login ID before deployment');
assert.equal(extra.demoPassword, undefined, 'Remove demo password before deployment');
NODE
echo ""

# Step 2: Install dependencies
echo -e "${YELLOW}[2/4] Installing dependencies...${NC}"
if [ ! -d "node_modules" ]; then
    npm install
    echo -e "${GREEN}✓ Dependencies installed${NC}"
else
    echo -e "${GREEN}✓ Dependencies already installed${NC}"
fi
echo ""

# Step 3: Build iOS app for production
echo -e "${YELLOW}[3/4] Building iOS app for production...${NC}"
echo -e "${BLUE}Running: eas build --platform $PLATFORM --profile $PROFILE --auto-submit --wait --non-interactive${NC}"
echo ""

eas build --platform "$PLATFORM" --profile "$PROFILE" --auto-submit --wait --non-interactive

echo -e "${YELLOW}[4/4] Build finished; check the scheduled submission in EAS.${NC}"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Build Complete - Submission Scheduled${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Check build and submission status using the EAS links above."
echo "2. Check App Store Connect: https://appstoreconnect.apple.com"
echo "3. Review submission and submit for review"
echo ""
