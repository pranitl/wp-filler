# Troubleshooting WordPress Login Verification Issues

## Problem: WordPress Requires Additional Verification

WordPress and security plugins can detect automated browsers and trigger additional verification. Here's how to fix it:

## Solution 1: Use Stealth Mode (Recommended)

We've created a special stealth mode that makes Playwright appear like a regular browser:

```bash
# First, diagnose the issue
npm run test:diagnose

# Then use stealth mode for testing
npm run test:stealth 1  # Login and save session
npm run test:stealth 2  # Use saved session
```

### What Stealth Mode Does:
- ✅ Hides webdriver detection flags
- ✅ Uses realistic browser fingerprint
- ✅ Adds human-like typing delays
- ✅ Saves cookies/session for reuse
- ✅ Spoofs plugins and Chrome objects
- ✅ Uses real Chrome instead of Chromium

## Solution 2: WordPress Security Settings

### Check These Settings in WordPress:

1. **Security Plugins** (Wordfence, Sucuri, iThemes, etc.):
   - Go to plugin settings
   - Find "Whitelist IP" or "Trusted IPs"
   - Add your server/computer IP address
   - Look for "Bot Protection" and add exceptions

2. **Application Passwords** (WordPress 5.6+):
   - Go to Users → Your Profile
   - Scroll to "Application Passwords"
   - Create a new application password
   - Use this instead of your regular password

3. **Two-Factor Authentication**:
   - Temporarily disable for testing
   - Or create app-specific password
   - Or use backup codes

4. **Rate Limiting**:
   - Check if login attempts are limited
   - Wait 15-30 minutes if locked out
   - Increase limit in security settings

## Solution 3: Server Configuration

### Add to .htaccess (if you have access):

```apache
# Allow your IP
<RequireAll>
    Require all granted
    Require ip YOUR.IP.ADDRESS.HERE
</RequireAll>
```

### Cloudflare Settings (if using):
1. Go to Cloudflare Dashboard
2. Security → WAF → Tools
3. Add IP Access Rule for your server
4. Set to "Allow"

## Solution 4: Use Session Persistence

The stealth mode saves your browser session after successful login:

```bash
# Login once manually to save session
npm run test:stealth 1

# All future runs use saved session (no login needed)
npm run test:stealth 2

# Clear session if needed
npm run test:clear
```

Session files are saved in: `~/.wp-filler/browser-data/`

## Solution 5: Manual Verification Bypass

If automated login still fails:

1. **Manual First Login**:
   ```bash
   # Run with visible browser
   HEADLESS=false npm run test:stealth 1
   ```
   - Complete any verification manually
   - Let the script save the session
   - Future runs will use saved session

2. **Cookie Import**:
   - Login manually in regular browser
   - Export cookies using browser extension
   - Import into Playwright session

## Solution 6: Environment Variables

Update your `.env` file:

```env
# Use actual admin URL (not wp-login.php directly)
WP_ADMIN_URL=https://www.site.com/subfolder/wp-admin

# Slow down actions to appear human
SLOW_MO=200

# Keep browser visible for debugging
HEADLESS=false
```

## Diagnostic Commands

```bash
# Check what WordPress can detect
npm run test:diagnose

# Test login with maximum stealth
npm run test:stealth 1

# Test specific phase
npm run test:phases 1  # Just login
npm run test:phases 2  # Login + navigate
```

## Common Error Messages and Solutions

| Error | Solution |
|-------|----------|
| "Too many login attempts" | Wait 30 minutes, add IP to whitelist |
| "Please verify you're human" | Use stealth mode, disable CAPTCHA for your IP |
| "Invalid username or password" | Check credentials, try application password |
| "Security check required" | Complete manually once, save session |
| "Access denied from your location" | Check Cloudflare/firewall settings |

## If Nothing Works

1. **Contact your WordPress admin** to:
   - Whitelist your IP address
   - Create a special test account
   - Temporarily disable security for testing

2. **Alternative approach**:
   - Use WordPress REST API instead
   - Create posts programmatically via wp_insert_post()
   - Use WordPress CLI if you have server access

## Testing Checklist

- [ ] Run diagnostics: `npm run test:diagnose`
- [ ] Check security plugins in WordPress
- [ ] Try stealth mode: `npm run test:stealth 1`
- [ ] Create application password in WordPress
- [ ] Whitelist IP in security settings
- [ ] Check .htaccess for IP restrictions
- [ ] Verify Cloudflare/WAF settings
- [ ] Test with saved session
- [ ] Try manual verification once

## Support

If you continue experiencing issues:
1. Run `npm run test:diagnose` and save output
2. Check WordPress error logs
3. Check security plugin logs
4. Open issue on GitHub with diagnostic info