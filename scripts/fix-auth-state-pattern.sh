#!/bin/bash

# Script to find and report components using the auth state anti-pattern
# This helps identify components that need to be migrated to use useAuth()

echo "=================================================="
echo "  Authentication State Anti-Pattern Detector"
echo "=================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Find components with local isAuthenticated state
echo "🔍 Scanning for components with local auth state..."
echo ""

files=$(grep -r "const \[isAuthenticated, setIsAuthenticated\] = useState" src/ --files-with-matches 2>/dev/null)

if [ -z "$files" ]; then
    echo -e "${GREEN}✅ No anti-pattern detected! All components are using centralized auth.${NC}"
    exit 0
fi

# Count files
count=$(echo "$files" | wc -l)
echo -e "${RED}❌ Found $count component(s) using local auth state:${NC}"
echo ""

# List each file with context
while IFS= read -r file; do
    echo -e "${YELLOW}📄 $file${NC}"

    # Show the problematic line
    grep -n "const \[isAuthenticated, setIsAuthenticated\] = useState" "$file" | while read -r line; do
        echo "   Line: $line"
    done

    # Check if it has onAuthStateChange
    if grep -q "onAuthStateChange" "$file"; then
        echo -e "   ${RED}⚠️  Has custom onAuthStateChange listener${NC}"
    fi

    echo ""
done <<< "$files"

echo "=================================================="
echo "  Migration Guide"
echo "=================================================="
echo ""
echo "For each file above, follow these steps:"
echo ""
echo "1. Import useAuth hook:"
echo "   import { useAuth } from '@/contexts/AuthContext';"
echo ""
echo "2. Replace local state:"
echo "   const { user, isAuthenticated, isInitialized } = useAuth();"
echo ""
echo "3. Remove custom auth listeners"
echo ""
echo "4. Add reactive effect:"
echo "   useEffect(() => {"
echo "     if (isInitialized && isAuthenticated && user) {"
echo "       loadUserData();"
echo "     }"
echo "   }, [isAuthenticated, user, isInitialized]);"
echo ""
echo "See AUTH_STATE_PERSISTENCE_FIX.md for detailed instructions."
echo ""

exit 1
