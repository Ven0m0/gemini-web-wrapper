#!/bin/bash
set -e

echo "🚀 Deploying AI Assistant App to production..."

# Check if required files exist
if [ ! -f "package.json" ]; then
    echo "❌ package.json not found"
    exit 1
fi

if [ ! -f "frontend/package.json" ]; then
    echo "❌ frontend/package.json not found"
    exit 1
fi

if [ ! -f "server.py" ]; then
    echo "❌ server.py not found"
    exit 1
fi

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend
npm install

# Build frontend
echo "🔨 Building frontend..."
npm run build

# Check if build was successful
if [ ! -d "dist" ]; then
    echo "❌ Frontend build failed - dist directory not found"
    exit 1
fi

echo "✅ Frontend built successfully"

# Go back to root
cd ..

# Install Python dependencies
echo "📦 Installing Python dependencies..."
pip install -r requirements.txt

# Run type checks
echo "🔍 Running type checks..."
npm run typecheck || echo "⚠️  Type check warnings found"

# Run linting
echo "🔍 Running linting..."
npm run lint || echo "⚠️  Lint warnings found"

# Create environment file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found, creating from .env.example"
    cp .env.example .env
    echo "📝 Please update .env with your API keys"
fi

echo "✅ Deployment preparation completed!"
echo ""
echo "🚀 Ready for deployment!"
echo "📁 Frontend built to: frontend/dist"
echo "🐍 Backend ready: server.py"
echo ""
echo "To deploy to Vercel:"
echo "1. Install Vercel CLI: npm i -g vercel"
echo "2. Run: vercel --prod"
echo ""
echo "To run locally:"
echo "1. Update .env with your API keys"
echo "2. Run: python server.py"