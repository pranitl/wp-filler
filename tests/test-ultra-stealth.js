#!/usr/bin/env node

/**
 * Ultra Stealth Mode - Maximum anti-detection for WordPress
 * This uses playwright-extra with stealth plugin for best results
 */

const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
require('dotenv').config();

// Configure stealth plugin
chromium.use(StealthPlugin());

async function testWithUltraStealth() {
  console.log('🥷 ULTRA STEALTH MODE - Maximum Anti-Detection\n');
  console.log('='.repeat(50));
  console.log('This mode uses advanced techniques to avoid detection.\n');
  
  const browser = await chromium.launch({
    headless: false,
    
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=site-per-process',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--disable-setuid-sandbox',
      '--no-sandbox',
      '--window-size=1920,1080',
      '--start-maximized',
      '--user-data-dir=/tmp/chrome-profile-' + Date.now(),
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--disable-dev-tools',
      '--mute-audio',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-popup-blocking',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--disable-ipc-flooding-protection',
      '--password-store=basic',
      '--use-mock-keychain',
      '--force-color-profile=srgb'
    ],
    
    // Use Chrome channel if available
    channel: 'chrome',
    
    // Viewport
    viewport: { width: 1920, height: 1080 },
    
    // Download Chrome if needed
    downloadsPath: '/tmp/downloads',
    
    // Ignore HTTPS errors
    ignoreHTTPSErrors: true,
    
    // Slow down to appear human
    slowMo: 150
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    
    locale: 'en-US',
    
    timezoneId: 'America/New_York',
    
    permissions: ['geolocation', 'notifications'],
    
    geolocation: { latitude: 40.7128, longitude: -74.0060 },
    
    colorScheme: 'light',
    
    deviceScaleFactor: 1,
    
    hasTouch: false,
    
    isMobile: false,
    
    // Extra HTTP headers
    extraHTTPHeaders: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'max-age=0',
      'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1'
    }
  });

  // Additional evasions (must be added before creating page)
  await context.addInitScript(() => {
    // Overwrite the navigator object
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });
    
    // Add chrome object
    if (!window.chrome) {
      window.chrome = {
        runtime: {},
        loadTimes: function() {},
        csi: function() {},
        app: {}
      };
    }
    
    // Mock plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', length: 1 },
        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', length: 1 },
        { name: 'Native Client', filename: 'internal-nacl-plugin', length: 2 }
      ],
    });
    
    // Mock languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });
    
    // Mock hardware concurrency
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      get: () => 8,
    });
    
    // Mock memory
    Object.defineProperty(navigator, 'deviceMemory', {
      get: () => 8,
    });
    
    // Fix Notification permission
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications' ?
        Promise.resolve({ state: Notification.permission }) :
        originalQuery(parameters)
    );
    
    // WebGL Vendor
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(parameter) {
      if (parameter === 37445) {
        return 'Intel Inc.';
      }
      if (parameter === 37446) {
        return 'Intel Iris OpenGL Engine';
      }
      return getParameter(parameter);
    };
    
    // Battery API
    if (navigator.getBattery) {
      navigator.getBattery = () => Promise.resolve({
        charging: true,
        chargingTime: 0,
        dischargingTime: Infinity,
        level: 1
      });
    }
    
    // Connection API
    if (navigator.connection) {
      Object.defineProperty(navigator.connection, 'rtt', {
        get: () => 50
      });
    }
  });
  
  // Now create the page after all init scripts are added
  const page = await context.newPage();

  try {
    console.log('📍 Testing WordPress login with Ultra Stealth...\n');
    
    // Random initial navigation (looks more natural)
    console.log('🌐 Initial navigation to Google (appears more natural)...');
    await page.goto('https://www.google.com');
    await page.waitForTimeout(2000 + Math.random() * 2000);
    
    // Now go to WordPress
    console.log('📍 Navigating to WordPress admin...');
    await page.goto(process.env.WP_ADMIN_URL, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    // Check if already logged in
    const dashboardVisible = await page.isVisible('#adminmenu').catch(() => false);
    
    if (!dashboardVisible) {
      console.log('📝 Need to login...\n');
      
      // Check if on login page
      const onLoginPage = await page.isVisible('#user_login').catch(() => false);
      if (!onLoginPage) {
        await page.goto(`${process.env.WP_ADMIN_URL}/wp-login.php`);
        await page.waitForLoadState('networkidle');
      }
      
      // Random mouse movements
      console.log('🖱️ Adding human-like mouse movements...');
      for (let i = 0; i < 3; i++) {
        const x = 100 + Math.random() * 700;
        const y = 100 + Math.random() * 400;
        await page.mouse.move(x, y, { steps: 10 });
        await page.waitForTimeout(200 + Math.random() * 300);
      }
      
      // Focus username field naturally
      await page.mouse.click(300, 200); // Click somewhere random first
      await page.waitForTimeout(500 + Math.random() * 500);
      
      console.log('📝 Filling login form with human-like behavior...');
      
      // Click and type username
      await page.click('#user_login');
      await page.waitForTimeout(300 + Math.random() * 200);
      
      // Type character by character with random delays
      for (const char of process.env.WP_USERNAME) {
        await page.keyboard.type(char);
        await page.waitForTimeout(50 + Math.random() * 150);
      }
      
      // Tab to password field (more natural than clicking)
      await page.waitForTimeout(500 + Math.random() * 500);
      await page.keyboard.press('Tab');
      await page.waitForTimeout(300 + Math.random() * 200);
      
      // Type password
      for (const char of process.env.WP_PASSWORD) {
        await page.keyboard.type(char);
        await page.waitForTimeout(50 + Math.random() * 100);
      }
      
      // Random pause (like double-checking)
      await page.waitForTimeout(800 + Math.random() * 1200);
      
      // Check remember me
      const rememberMe = await page.$('#rememberme');
      if (rememberMe) {
        const isChecked = await rememberMe.isChecked();
        if (!isChecked) {
          await page.keyboard.press('Tab');
          await page.keyboard.press('Space');
        }
      }
      
      // Submit with Enter key (more natural than clicking)
      await page.waitForTimeout(500 + Math.random() * 500);
      console.log('🔑 Submitting login...');
      await page.keyboard.press('Enter');
      
      // Wait for navigation
      await page.waitForNavigation({ 
        waitUntil: 'networkidle',
        timeout: 30000 
      });
    }
    
    // Check if logged in
    const loggedIn = await page.isVisible('#adminmenu').catch(() => false);
    
    if (loggedIn) {
      console.log('\n✅ SUCCESS! Logged in with Ultra Stealth Mode!');
      console.log('WordPress did not detect automation.');
      
      // Save cookies
      const cookies = await context.cookies();
      const fs = require('fs').promises;
      await fs.writeFile('wordpress-cookies.json', JSON.stringify(cookies, null, 2));
      console.log('🍪 Cookies saved to wordpress-cookies.json');
      
    } else {
      console.log('\n⚠️  Login may have failed or requires additional verification.');
      console.log('Check the browser window for any security prompts.');
      
      // Take screenshot
      await page.screenshot({ path: 'ultra-stealth-result.png', fullPage: true });
      console.log('📸 Screenshot saved as ultra-stealth-result.png');
    }
    
    console.log('\n⏸️  Keeping browser open for 20 seconds...');
    await page.waitForTimeout(20000);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: 'ultra-stealth-error.png', fullPage: true });
    console.log('📸 Error screenshot saved');
  } finally {
    await browser.close();
  }
}

// Run the test
console.log('🚀 Starting Ultra Stealth Mode Test\n');
console.log('This uses the most advanced anti-detection techniques available.');
console.log('If this doesn\'t work, the site has very strict bot detection.\n');

testWithUltraStealth().catch(console.error);