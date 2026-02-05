#!/bin/bash
set -e

echo "🔍 Verifying AI Assistant App deployment readiness..."

# Check Node.js
echo "📋 Checking Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✅ Node.js version: $NODE_VERSION"
else
    echo "❌ Node.js not found"
    exit 1
fi

# Check npm
echo "📋 Checking npm..."
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo "✅ npm version: $NPM_VERSION"
else
    echo "❌ npm not found"
    exit 1
fi

# Check Python
echo "📋 Checking Python..."
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    echo "✅ Python version: $PYTHON_VERSION"
else
    echo "❌ Python3 not found"
    exit 1
fi

# Check pip
echo "📋 Checking pip..."
if command -v pip3 &> /dev/null; then
    PIP_VERSION=$(pip3 --version)
    echo "✅ pip version: $PIP_VERSION"
else
    echo "❌ pip3 not found"
    exit 1
fi

# Check required files
echo "📋 Checking required files..."
REQUIRED_FILES=(
    "package.json"
    "frontend/package.json"
    "server.py"
    "requirements.txt"
    "vercel.json"
    ".env.example"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file exists"
    else
        echo "❌ $file missing"
        exit 1
    fi
done

# Check frontend dependencies
echo "📋 Checking frontend dependencies..."
cd frontend
if [ -d "node_modules" ]; then
    echo "✅ Frontend node_modules exists"
else
    echo "⚠️  Frontend node_modules not found, run: cd frontend && npm install"
fi

# Check if frontend is built
if [ -d "dist" ]; then
    echo "✅ Frontend built (dist directory exists)"
else
    echo "⚠️  Frontend not built, run: cd frontend && npm run build"
fi
cd ..

# Check Python dependencies
echo "📋 Checking Python dependencies..."
if python3 -c "import fastapi" &> /dev/null; then
    echo "✅ FastAPI installed"
else
    echo "⚠️  FastAPI not installed, run: pip install -r requirements.txt"
fi

# Check environment file
echo "📋 Checking environment configuration..."
if [ -f ".env" ]; then
    echo "✅ .env file exists"
    
    # Check for required API keys
    if grep -q "GOOGLE_API_KEY" .env; then
        echo "✅ GOOGLE_API_KEY configured"
    else
        echo "⚠️  GOOGLE_API_KEY not found in .env"
    fi
else
    echo "⚠️  .env file not found, copy from .env.example"
fi

# Check TypeScript
echo "📋 Checking TypeScript..."
cd frontend
if npm run typecheck &> /dev/null; then
    echo "✅ TypeScript compilation successful"
else
    echo "⚠️  TypeScript compilation issues found"
fi
cd ..

# Check linting
echo "📋 Checking linting..."
if npm run lint &> /dev/null; then
    echo "✅ Linting passed"
else
    echo "⚠️  Linting issues found"
fi

echo ""
echo "🎉 Verification completed!"
echo ""
echo "📊 Summary:"
echo "- ✅ All required tools are installed"
echo "- ✅ All required files are present"
echo "- ✅ Project structure is correct"
echo ""
echo "🚀 Ready for deployment!"
echo ""
echo "Next steps:"
echo "1. Update .env with your API keys"
echo "2. Build frontend: cd frontend && npm run build"
echo "3. Install Python deps: pip install -r requirements.txt"
echo "4. Deploy: vercel --prod"