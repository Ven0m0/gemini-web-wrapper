#!/bin/bash
set -e

echo "Building Gemini Web Wrapper for production..."

echo "Installing frontend dependencies..."
cd apps/web
bun install

echo "Building frontend..."
bun run build

echo "Installing backend dependencies..."
cd ../api
uv sync --frozen

echo "Build completed."
echo "Frontend built to: apps/web/dist"
echo "API ready: apps/api/src/affine/api/server.py"
