#!/bin/bash
# Debug script - Super Admin Login issues

echo "🔍 Super Admin Debug Checker"
echo "=============================="
echo ""

# Check .env file
if [ -f ".env" ]; then
    echo "✅ .env file found"
    if grep -q "VITE_SUPER_ADMIN_EMAIL" .env; then
        echo "✅ VITE_SUPER_ADMIN_EMAIL is set"
    else
        echo "❌ VITE_SUPER_ADMIN_EMAIL missing"
    fi
    if grep -q "VITE_SUPER_ADMIN_PHONE" .env; then
        echo "✅ VITE_SUPER_ADMIN_PHONE is set"
    else
        echo "❌ VITE_SUPER_ADMIN_PHONE missing"
    fi
    if grep -q "VITE_SUPER_ADMIN_PASSWORD" .env; then
        echo "✅ VITE_SUPER_ADMIN_PASSWORD is set"
    else
        echo "❌ VITE_SUPER_ADMIN_PASSWORD missing"
    fi
else
    echo "❌ .env file NOT found"
fi

echo ""
echo "📝 Expected Credentials (from .env):"
grep "VITE_SUPER_ADMIN" .env 2>/dev/null || echo "❌ Not found"

echo ""
echo "📂 Pages available:"
if [ -f "src/pages/SuperAdminLogin.tsx" ]; then
    echo "✅ SuperAdminLogin.tsx exists"
else
    echo "❌ SuperAdminLogin.tsx missing"
fi

if [ -f "src/pages/super-admin/SettingsPage.tsx" ]; then
    echo "✅ SettingsPage.tsx exists"
else
    echo "❌ SettingsPage.tsx missing"
fi

echo ""
echo "💡 Next step: http://localhost:3000/super-admin-login ga kiring"
