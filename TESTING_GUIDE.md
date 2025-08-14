# WordPress Automation Testing Guide

## Quick Start - Avoiding Login Verification

WordPress is detecting your automation and requiring verification. Here's how to fix it:

### 🎯 Step-by-Step Testing Approach

## 1. First, Diagnose the Problem

```bash
npm run test:diagnose
```

This will:
- Check if WordPress can detect automation
- Identify security plugins
- Show what's triggering verification
- Provide specific recommendations

## 2. Try Different Testing Modes (In Order)

### Option A: Basic Phase Testing
```bash
# Test just the login
npm run test:phases 1

# If login works, test navigation
npm run test:phases 2

# Then test filling fields
npm run test:phases 3
npm run test:phases 4
```

### Option B: Stealth Mode (Recommended)
```bash
# Login with anti-detection measures
npm run test:stealth 1

# Once logged in, use saved session (no more login needed!)
npm run test:stealth 2

# Clear saved session if needed
npm run test:clear
```

### Option C: Ultra Stealth Mode (Maximum Protection)
```bash
# Use most aggressive anti-detection
npm run test:ultra
```

This mode:
- Uses playwright-extra with stealth plugin
- Mimics human behavior perfectly
- Adds random delays and mouse movements
- Saves cookies for reuse

## 3. What Each Test Does

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `npm run test:diagnose` | Identifies why WordPress blocks you | Run first to understand the problem |
| `npm run test:phases 1` | Tests basic login only | Initial testing |
| `npm run test:stealth 1` | Login with anti-detection | When basic login fails |
| `npm run test:stealth 2` | Use saved session | After successful stealth login |
| `npm run test:ultra` | Maximum anti-detection | When stealth mode fails |
| `npm run test:clear` | Clear saved sessions | Start fresh |

## 4. Configuration Tips

### Update your `.env` file:
```env
# Use the exact URL format WordPress expects
WP_ADMIN_URL=https://www.firstlighthomecare.com/home-healthcare-boston-northwest/wp-admin

# Slow down actions to appear human
SLOW_MO=200

# Keep browser visible to see what's happening
HEADLESS=false
```

## 5. Progressive Testing Strategy

### Phase 1: Get Login Working
1. Run `npm run test:diagnose` to identify issues
2. Try `npm run test:phases 1` for basic login
3. If blocked, try `npm run test:stealth 1`
4. If still blocked, try `npm run test:ultra`
5. If successful, session is saved automatically

### Phase 2: Use Saved Session
Once you've logged in successfully ONCE:
```bash
# All future tests can skip login!
npm run test:stealth 2
```

### Phase 3: Test Full Automation
After login works:
```bash
# Test the complete flow
npm test
```

## 6. WordPress-Side Solutions

If automation still fails, ask your WordPress admin to:

1. **Whitelist Your IP**:
   - Security plugin → Settings → Whitelist IPs
   - Add your computer's IP address

2. **Create Application Password**:
   - Users → Your Profile → Application Passwords
   - Generate new password for automation

3. **Temporarily Disable**:
   - Bot protection
   - Rate limiting
   - CAPTCHA for admin users
   - Two-factor authentication (for testing only)

## 7. How Stealth Mode Works

Our stealth modes use these techniques:

### Browser Fingerprinting:
- ✅ Hides `navigator.webdriver` flag
- ✅ Adds realistic Chrome plugins
- ✅ Sets proper screen dimensions
- ✅ Spoofs hardware concurrency
- ✅ Uses real Chrome (not Chromium)

### Human Behavior:
- ✅ Random mouse movements
- ✅ Variable typing speed
- ✅ Natural delays between actions
- ✅ Uses Tab/Enter keys (not just clicks)

### Session Persistence:
- ✅ Saves cookies after login
- ✅ Reuses session for future runs
- ✅ Stores in `~/.wp-filler/browser-data/`

## 8. Troubleshooting

### "Too many login attempts"
- Wait 30 minutes
- Use different IP
- Ask admin to reset

### "Please verify you're human"
- Use `npm run test:ultra`
- Complete CAPTCHA manually once
- Session will be saved

### "Invalid credentials"
- Double-check username/password
- Try application password
- Check for special characters

### Still Getting Blocked?
1. The browser stays open - complete verification manually
2. Once logged in, the session is saved
3. Future runs will work automatically

## 9. Emergency Fallback

If nothing works, you have two options:

### Option 1: Manual First Login
1. Run `npm run test:stealth 1`
2. Complete any verification in the browser
3. Let it save the session
4. Use `npm run test:stealth 2` for all future runs

### Option 2: Direct Navigation
Update `mapping.json` to skip sidebar navigation:
```json
"navigation": {
  "direct_url": "https://site.com/wp-admin/post-new.php?post_type=landing"
}
```

## 10. Test Commands Summary

```bash
# Diagnostic
npm run test:diagnose     # Identify what's blocking you

# Progressive Testing
npm run test:phases 1      # Test login only
npm run test:phases 2      # Test login + navigation
npm run test:phases 3      # Test login + fill title
npm run test:phases 4      # Test Hero Area fields

# Anti-Detection
npm run test:stealth 1     # Login with stealth mode
npm run test:stealth 2     # Use saved session
npm run test:ultra         # Maximum anti-detection

# Utilities
npm run test:clear         # Clear saved sessions
npm test                   # Run full test suite
```

## Success Indicators

✅ **Login Works** = You see WordPress dashboard
✅ **Navigation Works** = Landing page editor loads
✅ **Fields Fill** = Text appears in form fields
✅ **Session Saved** = "Browser state saved" message
✅ **Reuse Works** = Login not needed on second run

## Need Help?

1. Run diagnostics and save output
2. Check `logs/` folder for errors
3. Screenshots in `logs/screenshots/`
4. Share results when asking for help