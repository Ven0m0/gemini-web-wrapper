#!/bin/bash

# Chat GitHub iOS Build Script
# This script automates the process of building the iOS app

set -e

echo "🚀 Building Chat GitHub iOS App..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo -e "${RED}❌ Error: iOS builds require macOS${NC}"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Error: Node.js is required${NC}"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ Error: npm is required${NC}"
    exit 1
fi

echo -e "${BLUE}📦 Installing dependencies...${NC}"
npm install

echo -e "${BLUE}🔧 Building web assets...${NC}"
npm run build

# Install Capacitor if not already present
if ! npx cap --version &> /dev/null 2>&1; then
    echo -e "${YELLOW}📲 Installing Capacitor...${NC}"
    npm install @capacitor/core @capacitor/cli @capacitor/ios
else
    echo -e "${GREEN}✅ Capacitor already installed${NC}"
fi

# Initialize Capacitor if not already done
if [ ! -f "capacitor.config.ts" ]; then
    echo -e "${BLUE}⚙️  Initializing Capacitor...${NC}"
    npx cap init "Chat GitHub" "com.chatgithub.app"
fi

# Add iOS platform if not already added
if [ ! -d "ios" ]; then
    echo -e "${BLUE}📱 Adding iOS platform...${NC}"
    npx cap add ios
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to add iOS platform${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ iOS platform already exists${NC}"
fi

echo -e "${BLUE}📋 Copying web assets...${NC}"
npx cap copy ios
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to copy web assets${NC}"
    exit 1
fi

echo -e "${BLUE}🔄 Syncing Capacitor...${NC}"
npx cap sync ios
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to sync iOS project${NC}"
    exit 1
fi

echo -e "${GREEN}✅ iOS project is ready!${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Open Xcode: npx cap open ios"
echo "2. Configure signing & certificates"
echo "3. Build and test in simulator"
echo "4. Archive for App Store submission"

# Option to automatically open Xcode
read -p "Do you want to open Xcode now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}🎯 Opening Xcode...${NC}"
    npx cap open ios
fi

echo -e "${GREEN}🎉 iOS build process completed!${NC}"