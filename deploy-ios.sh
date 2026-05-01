#!/bin/bash

################################################################################
# Yanji Mobile App - iOS Deployment Script
# Builds and submits iOS app to App Store via EAS
# Bundle ID: com.yanjirestaurant.app
# Distribution: App Store (production)
################################################################################

set -e

# Configuration
BUNDLE_ID="com.yanjirestaurant.app"
PROFILE="production"
PLATFORM="ios"
BUILD_DIR="."

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
    echo "Installing EAS CLI..."
    npm install -g eas-cli
fi
echo -e "${GREEN}✓ EAS CLI available${NC}"

# Check if logged in to EAS
if ! eas whoami &> /dev/null 2>&1; then
    echo -e "${YELLOW}Not logged in to EAS. Please authenticate:${NC}"
    eas login
fi
echo -e "${GREEN}✓ EAS authenticated${NC}"
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
echo -e "${BLUE}Running: eas build --platform $PLATFORM --profile $PROFILE${NC}"
echo ""

BUILD_OUTPUT=$(eas build --platform "$PLATFORM" --profile "$PROFILE" 2>&1)
BUILD_ID=$(echo "$BUILD_OUTPUT" | grep -oP 'Build ID: \K[^ ]*' | head -1)

if [ -z "$BUILD_ID" ]; then
    echo -e "${RED}✗ Failed to get build ID${NC}"
    echo "$BUILD_OUTPUT"
    exit 1
fi

echo -e "${GREEN}✓ Build submitted${NC}"
echo -e "${BLUE}Build ID: $BUILD_ID${NC}"
echo ""

# Step 4: Submit to App Store
echo -e "${YELLOW}[4/4] Submitting to App Store...${NC}"
echo -e "${BLUE}Running: eas submit --platform $PLATFORM --build-id $BUILD_ID${NC}"
echo ""

SUBMIT_OUTPUT=$(eas submit --platform "$PLATFORM" --build-id "$BUILD_ID" 2>&1)
echo "$SUBMIT_OUTPUT"

if echo "$SUBMIT_OUTPUT" | grep -q "successfully"; then
    echo -e "${GREEN}✓ Successfully submitted to App Store${NC}"
    echo -e "${GREEN}Build ID: $BUILD_ID${NC}"
else
    echo -e "${YELLOW}⚠ Check submission status manually${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Monitor build progress: eas build --status --build-id $BUILD_ID"
echo "2. Check App Store Connect: https://appstoreconnect.apple.com"
echo "3. Review submission and submit for review"
echo ""
