# 🚀 WP Filler - Quick Start Guide

## Problem You're Facing
WordPress is detecting automated login and requiring verification. This guide will help you bypass that.

## Immediate Solution - 3 Steps

### Step 1: Setup (One Time)
```bash
# Run setup script
./setup.sh

# Edit .env file with your credentials
nano .env
```

Update in `.env`:
```
WP_ADMIN_URL=https://www.firstlighthomecare.com/home-healthcare-boston-northwest/wp-admin
WP_USERNAME=your_actual_username
WP_PASSWORD=your_actual_password
```

### Step 2: Diagnose & Test
```bash
# See what's blocking you
npm run test:diagnose

# Try progressive testing
npm run test:phases 1    # Just test login
```

### Step 3: If Blocked, Use Stealth Mode

#### Option A: Stealth Mode
```bash
npm run test:stealth 1    # First login (saves session)
npm run test:stealth 2    # Future logins (uses saved session)
```

#### Option B: Ultra Stealth (Maximum Protection)
```bash
npm run test:ultra        # Most aggressive anti-detection
```

## How It Works

1. **First Run**: Logs in with anti-detection, saves cookies
2. **Future Runs**: Uses saved cookies, no login needed!
3. **Navigation**: Clicks "Landing Pages" → "New Landing Page"
4. **Fills Forms**: Completes all ACF fields automatically

## Test Commands Reference

```bash
# Diagnostic & Testing
npm run test:diagnose    # Find what's blocking you
npm run test:phases 1    # Test login only
npm run test:phases 2    # Test login + navigation
npm run test:phases 3    # Test login + fill title
npm run test:phases 4    # Test Hero Area

# Anti-Detection Modes
npm run test:stealth 1   # Stealth login (saves session)
npm run test:stealth 2   # Use saved session
npm run test:ultra       # Maximum anti-detection
npm run test:clear       # Clear saved sessions

# Full Testing
npm test                 # Run complete test suite
```

## If Still Blocked

### In WordPress Admin:
1. Go to Security Plugin Settings
2. Add your IP to whitelist
3. Disable bot protection for your IP
4. Create Application Password (Users → Profile)

### Or Complete Verification Once:
1. Run `npm run test:stealth 1`
2. Complete CAPTCHA/verification manually in browser
3. Let script save the session
4. All future runs will work!

## Success Checklist

- [ ] Installed dependencies: `./setup.sh`
- [ ] Updated `.env` with credentials
- [ ] Ran diagnostics: `npm run test:diagnose`
- [ ] Tested login: `npm run test:phases 1`
- [ ] If blocked, tried stealth: `npm run test:stealth 1`
- [ ] Session saved for future use
- [ ] Navigation to Landing Pages works
- [ ] Fields fill correctly

## Files Created

```
wp-filler/
├── src/
│   ├── server.js           # Main automation server
│   └── browser-config.js   # Anti-detection config
├── tests/
│   ├── test-phases.js      # Phase-by-phase testing
│   ├── test-phases-stealth.js  # Stealth mode testing
│   ├── test-ultra-stealth.js   # Maximum anti-detection
│   └── diagnose-login.js   # Diagnostic tool
├── config/
│   └── mapping.json        # Field selectors (updated!)
├── TESTING_GUIDE.md        # Detailed testing guide
└── .env                    # Your credentials (create from .env.example)
```

## Need Help?

1. Check `TESTING_GUIDE.md` for detailed instructions
2. Check `docs/TROUBLESHOOTING.md` for solutions
3. Run `npm run test:diagnose` and save output
4. Check `logs/` folder for error details

## Ready to Start?

```bash
# Quick test to see if it works
npm run test:phases 1

# If that works, test the full flow
npm test
```

Good luck! 🎉