#!/bin/bash
set -e

echo "🚀 Building AI Assistant App for production..."

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend
npm install

# Build frontend
echo "🔨 Building frontend..."
npm run build

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd ..
pip install -r requirements.txt

echo "✅ Build completed successfully!"
echo "📁 Frontend built to: frontend/dist"
echo "🚀 Ready for deployment!"