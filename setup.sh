#!/bin/bash

echo "🚀 WP Filler Setup Script"
echo "========================"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "✅ .env file created"
    echo ""
    echo "⚠️  IMPORTANT: Edit .env file with your WordPress credentials:"
    echo "   - WP_ADMIN_URL"
    echo "   - WP_USERNAME" 
    echo "   - WP_PASSWORD"
    echo ""
else
    echo "✅ .env file already exists"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Install Playwright browsers
echo "🌐 Installing Playwright browsers..."
npx playwright install chromium
npx playwright install chrome

# Create directories
echo "📁 Creating directories..."
mkdir -p logs/screenshots
mkdir -p ~/.wp-filler/browser-data

echo ""
echo "✅ Setup complete!"
echo ""
echo "🧪 Next steps:"
echo "1. Edit .env file with your WordPress credentials"
echo "2. Run diagnostics: npm run test:diagnose"
echo "3. Test login: npm run test:phases 1"
echo "4. If blocked, try: npm run test:stealth 1"
echo "5. Or maximum stealth: npm run test:ultra"
echo ""
echo "📖 See TESTING_GUIDE.md for detailed instructions"