#!/usr/bin/env node

/**
 * Headless Login with Virtual Display
 * This can run on a VPS without GUI
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function headlessLogin() {
  console.log('🔐 Automated Session Capture (Headless Mode)\n');
  
  const browser = await chromium.launch({
    headless: false, // We'll use Xvfb for virtual display
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process'
    ]
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'America/New_York'
  });
  
  // Add stealth scripts
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined
    });
    delete navigator.__proto__.webdriver;
  });
  
  const page = await context.newPage();
  
  try {
    console.log('📍 Navigating to WordPress login...');
    await page.goto(process.env.WP_ADMIN_URL, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    // Check if already at login page
    const loginFormVisible = await page.isVisible('#user_login').catch(() => false);
    if (!loginFormVisible) {
      const loginUrl = process.env.WP_ADMIN_URL.replace('/wp-admin/index.php', '/wp-login.php');
      await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
    }
    
    console.log('🔑 Attempting automated login...');
    
    // Clear and fill username
    await page.click('#user_login');
    await page.fill('#user_login', '');
    await page.type('#user_login', process.env.WP_USERNAME, { delay: 100 });
    
    // Fill password
    await page.click('#user_pass');
    await page.type('#user_pass', process.env.WP_PASSWORD, { delay: 100 });
    
    // Check remember me
    const rememberMe = await page.$('#rememberme');
    if (rememberMe) {
      const isChecked = await rememberMe.isChecked();
      if (!isChecked) await rememberMe.click();
    }
    
    // Take screenshot before login
    await page.screenshot({ 
      path: path.join(__dirname, '..', 'logs', 'screenshots', 'before-login.png'),
      fullPage: true 
    });
    
    // Submit form
    await page.click('#wp-submit');
    
    // Wait for navigation
    console.log('⏳ Waiting for login response...');
    
    try {
      await page.waitForURL('**/wp-admin/**', { timeout: 30000 });
      console.log('✅ Login successful!');
    } catch (e) {
      // Check if verification is required
      const verificationVisible = await page.isVisible('text="VERIFICATION REQUIRED"').catch(() => false);
      if (verificationVisible) {
        console.log('\n⚠️  VERIFICATION REQUIRED');
        console.log('WordPress requires email verification.');
        console.log('\nOptions:');
        console.log('1. Check the email for verification link');
        console.log('2. Use the VNC method to login manually');
        console.log('3. Disable verification in WordPress if you have server access');
        
        await page.screenshot({ 
          path: path.join(__dirname, '..', 'logs', 'screenshots', 'verification-required.png'),
          fullPage: true 
        });
        
        process.exit(1);
      }
    }
    
    // Save the session
    const sessionDir = path.join(__dirname, '..', '.wp-session');
    await fs.mkdir(sessionDir, { recursive: true });
    
    const storageState = await context.storageState();
    const sessionFile = path.join(sessionDir, 'session.json');
    await fs.writeFile(sessionFile, JSON.stringify(storageState, null, 2));
    
    console.log(`\n✅ Session saved to: ${sessionFile}`);
    console.log('The wp-filler service will now use this session automatically.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ 
      path: path.join(__dirname, '..', 'logs', 'screenshots', 'error.png'),
      fullPage: true 
    });
  } finally {
    await browser.close();
  }
}

headlessLogin().catch(console.error);