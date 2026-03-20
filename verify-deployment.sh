#!/bin/bash

echo "╔════════════════════════════════════════════════╗"
echo "║   Airaplay Deployment Verification Script     ║"
echo "╚════════════════════════════════════════════════╝"
echo ""

ERRORS=0
WARNINGS=0

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check functions
check_pass() {
    echo -e "${GREEN}✓${NC} $1"
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ((ERRORS++))
}

check_warn() {
    echo -e "${YELLOW}!${NC} $1"
    ((WARNINGS++))
}

echo "Checking environment configuration..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check .env file
if [ -f .env ]; then
    check_pass ".env file exists"
    
    # Check required variables
    if grep -q "VITE_SUPABASE_URL" .env; then
        check_pass "VITE_SUPABASE_URL configured"
    else
        check_fail "VITE_SUPABASE_URL missing in .env"
    fi
    
    if grep -q "VITE_SUPABASE_ANON_KEY" .env; then
        check_pass "VITE_SUPABASE_ANON_KEY configured"
    else
        check_fail "VITE_SUPABASE_ANON_KEY missing in .env"
    fi
else
    check_fail ".env file not found"
fi

echo ""
echo "Checking build configuration..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check package.json scripts
if grep -q '"build:web"' package.json; then
    check_pass "Web build script configured"
else
    check_fail "Web build script missing"
fi

if grep -q '"build:app"' package.json; then
    check_pass "Mobile build script configured"
else
    check_fail "Mobile build script missing"
fi

# Check vercel.json
if [ -f vercel.json ]; then
    check_pass "vercel.json exists"
    if grep -q '"build:web"' vercel.json; then
        check_pass "Vercel configured for web build"
    else
        check_warn "Vercel may not use correct build command"
    fi
else
    check_warn "vercel.json not found (required for Vercel deployment)"
fi

# Check capacitor config
if [ -f capacitor.config.ts ]; then
    check_pass "capacitor.config.ts exists"
else
    check_fail "capacitor.config.ts missing (required for mobile build)"
fi

echo ""
echo "Checking project structure..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check critical directories
[ -d "src" ] && check_pass "src/ directory exists" || check_fail "src/ directory missing"
[ -d "src/screens" ] && check_pass "src/screens/ directory exists" || check_fail "src/screens/ missing"
[ -d "src/lib" ] && check_pass "src/lib/ directory exists" || check_fail "src/lib/ missing"
[ -d "android" ] && check_pass "android/ directory exists" || check_warn "android/ missing (needed for mobile build)"

# Check critical files
[ -f "src/index.tsx" ] && check_pass "src/index.tsx exists" || check_fail "src/index.tsx missing"
[ -f "src/lib/supabase.ts" ] && check_pass "src/lib/supabase.ts exists" || check_fail "src/lib/supabase.ts missing"
[ -f "src/lib/buildTarget.ts" ] && check_pass "src/lib/buildTarget.ts exists" || check_fail "src/lib/buildTarget.ts missing"

echo ""
echo "Checking dependencies..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -d "node_modules" ]; then
    check_pass "node_modules/ exists"
else
    check_warn "node_modules/ not found (run: npm install)"
fi

# Check if package-lock.json exists
if [ -f "package-lock.json" ]; then
    check_pass "package-lock.json exists"
else
    check_warn "package-lock.json missing"
fi

echo ""
echo "Running test builds..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test web build
echo "Testing web build..."
if npm run build:web > /dev/null 2>&1; then
    check_pass "Web build successful"
else
    check_fail "Web build failed (run: npm run build:web for details)"
fi

# Test mobile build
echo "Testing mobile build..."
if npm run build:app > /dev/null 2>&1; then
    check_pass "Mobile build successful"
else
    check_fail "Mobile build failed (run: npm run build:app for details)"
fi

echo ""
echo "╔════════════════════════════════════════════════╗"
echo "║              Verification Summary              ║"
echo "╚════════════════════════════════════════════════╝"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed! Ready for deployment.${NC}"
    echo ""
    echo "Next steps:"
    echo "1. For web: Push to GitHub (Vercel auto-deploys)"
    echo "2. For mobile: Run 'npx cap sync android' then open Android Studio"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ Passed with $WARNINGS warning(s)${NC}"
    echo "Review warnings above before deploying."
    exit 0
else
    echo -e "${RED}✗ Found $ERRORS error(s) and $WARNINGS warning(s)${NC}"
    echo "Please fix errors before deploying."
    exit 1
fi
