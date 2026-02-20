#!/bin/bash
set -e

echo "Building Gemini Web Wrapper for production..."

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd frontend
bun install

# Build frontend
echo "Building frontend..."
bun run build

# Install backend dependencies
echo "Installing backend dependencies..."
cd ..
uv sync --frozen

echo "Build completed."
echo "Frontend built to: frontend/dist"
echo "Ready for deployment."
