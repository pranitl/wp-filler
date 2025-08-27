#!/usr/bin/env node

/**
 * Session Capture Tool
 * Run this locally to capture WordPress login session, then transfer to VPS
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function captureSession() {
  console.log('🔐 WordPress Session Capture Tool\n');
  console.log('This tool will:');
  console.log('1. Open a browser window');
  console.log('2. Let you login manually to WordPress');
  console.log('3. Save the session cookies to transfer to your VPS\n');
  
  const browser = await chromium.launch({
    headless: false, // Show browser window
    args: [
      '--disable-blink-features=AutomationControlled',
      '--start-maximized'
    ]
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  });
  
  const page = await context.newPage();
  
  try {
    console.log('📍 Navigating to WordPress login page...');
    const loginUrl = process.env.WP_ADMIN_URL.replace('/wp-admin/index.php', '/wp-login.php');
    await page.goto(loginUrl);
    
    console.log('\n✋ MANUAL ACTION REQUIRED:');
    console.log('1. Login to WordPress in the browser window');
    console.log('2. Complete any verification required');
    console.log('3. Once you see the WordPress dashboard, press ENTER here...\n');
    
    // Wait for user to press enter
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });
    
    // Check if logged in
    const dashboardVisible = await page.isVisible('#adminmenu').catch(() => false);
    if (!dashboardVisible) {
      console.log('❌ Not logged in. Please ensure you are on the WordPress dashboard.');
      process.exit(1);
    }
    
    console.log('✅ Login successful! Saving session...');
    
    // Save the storage state
    const sessionDir = path.join(__dirname, '..', '.wp-session');
    await fs.mkdir(sessionDir, { recursive: true });
    
    const storageState = await context.storageState();
    const sessionFile = path.join(sessionDir, 'session.json');
    await fs.writeFile(sessionFile, JSON.stringify(storageState, null, 2));
    
    console.log(`\n📁 Session saved to: ${sessionFile}`);
    console.log('\n📤 Next steps:');
    console.log('1. Copy the .wp-session folder to your VPS:');
    console.log(`   scp -r .wp-session/ your-vps:/home/pranit/docker/wp-filler/`);
    console.log('\n2. The session will be automatically used by the wp-filler service');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

// Handle stdin for headless environments
process.stdin.resume();
process.stdin.setEncoding('utf8');

captureSession().catch(console.error);