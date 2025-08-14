const { chromium } = require('playwright');
const browserConfig = require('../src/browser-config');
require('dotenv').config();

// PHASE 1: Test login with stealth mode
async function testLoginWithStealth() {
  console.log('🔐 Testing WordPress Login with Stealth Mode...\n');
  console.log('This version uses anti-detection measures to avoid verification prompts.\n');
  
  // Load saved browser state if exists
  const savedState = await browserConfig.loadState();
  if (savedState) {
    console.log('📂 Found saved browser state, using existing cookies/session');
  }
  
  const browser = await chromium.launch(browserConfig.getBrowserConfig());
  
  const contextConfig = browserConfig.getContextConfig();
  if (savedState) {
    contextConfig.storageState = savedState;
  }
  
  const context = await browser.newContext(contextConfig);
  
  // Apply stealth mode to context before creating page
  const { addHumanBehavior } = await browserConfig.applyStealthMode(context);
  
  const page = await context.newPage();

  try {
    // Add some human-like behavior before navigation
    await addHumanBehavior(page);
    
    // Navigate to login page
    console.log('📍 Going to: ' + process.env.WP_ADMIN_URL);
    await page.goto(process.env.WP_ADMIN_URL, { waitUntil: 'networkidle' });
    
    // Check if already logged in (from saved session)
    const dashboardVisible = await page.isVisible('#adminmenu').catch(() => false);
    if (dashboardVisible) {
      console.log('✅ Already logged in using saved session!');
      console.log('You should see the WordPress dashboard.');
    } else {
      // Need to login
      console.log('📝 Need to login...');
      
      // Check if we're on login page
      const loginFormVisible = await page.isVisible('#user_login').catch(() => false);
      if (!loginFormVisible) {
        // Navigate to login page
        await page.goto(`${process.env.WP_ADMIN_URL}/wp-login.php`);
      }
      
      // Add human-like delays
      await page.waitForTimeout(Math.random() * 1000 + 500);
      
      console.log('📝 Filling username...');
      await page.click('#user_login');
      await page.waitForTimeout(Math.random() * 500 + 200);
      
      // Type slowly like a human
      await page.type('#user_login', process.env.WP_USERNAME, { delay: Math.random() * 50 + 50 });
      
      await page.waitForTimeout(Math.random() * 500 + 200);
      
      console.log('📝 Filling password...');
      await page.click('#user_pass');
      await page.waitForTimeout(Math.random() * 500 + 200);
      await page.type('#user_pass', process.env.WP_PASSWORD, { delay: Math.random() * 50 + 50 });
      
      // Check for "Remember Me" checkbox and check it
      const rememberMe = await page.$('#rememberme');
      if (rememberMe) {
        const isChecked = await rememberMe.isChecked();
        if (!isChecked) {
          console.log('☑️  Checking "Remember Me"...');
          await rememberMe.click();
        }
      }
      
      await page.waitForTimeout(Math.random() * 500 + 300);
      
      console.log('🖱️ Clicking login button...');
      await page.click('#wp-submit');
      
      // Wait for navigation
      console.log('⏳ Waiting for dashboard to load...');
      await page.waitForNavigation({ waitUntil: 'networkidle' });
      
      // Check if we're logged in
      const nowDashboardVisible = await page.isVisible('#adminmenu').catch(() => false);
      if (nowDashboardVisible) {
        console.log('✅ SUCCESS! Logged in to WordPress!');
        console.log('You should see the WordPress dashboard.');
        
        // Save the browser state for future use
        await browserConfig.saveState(context);
        console.log('💾 Saved browser state for future sessions');
      } else {
        console.log('❌ FAILED! Could not see dashboard menu.');
        console.log('Check if there is additional verification required.');
        
        // Check for common verification/security plugin messages
        const pageContent = await page.content();
        if (pageContent.includes('verification') || pageContent.includes('authenticate')) {
          console.log('\n⚠️  Additional verification detected!');
          console.log('You may need to:');
          console.log('  1. Complete the verification manually');
          console.log('  2. Whitelist your IP in WordPress security settings');
          console.log('  3. Disable 2FA temporarily for testing');
        }
      }
    }
    
    console.log('\n⏸️  Keeping browser open for 15 seconds...');
    await page.waitForTimeout(15000);
    
  } catch (error) {
    console.error('❌ Error during login:', error.message);
    
    // Save screenshot for debugging
    await page.screenshot({ path: 'login-error.png', fullPage: true });
    console.log('📸 Screenshot saved as login-error.png');
  } finally {
    // Save state before closing
    await browserConfig.saveState(context);
    await browser.close();
  }
}

// PHASE 2: Login + Navigate to New Landing Page
async function testLoginAndNavigate() {
  console.log('🔐 Testing Login + Navigation to Landing Page with Stealth...\n');
  
  // Load saved browser state if exists
  const savedState = await browserConfig.loadState();
  if (savedState) {
    console.log('📂 Found saved browser state, will try to use it');
  }
  
  const browser = await chromium.launch(browserConfig.getBrowserConfig());
  
  const contextConfig = browserConfig.getContextConfig();
  if (savedState) {
    contextConfig.storageState = savedState;
  }
  
  const context = await browser.newContext(contextConfig);
  
  // Apply stealth mode to context
  const { addHumanBehavior } = await browserConfig.applyStealthMode(context);
  
  const page = await context.newPage();
  
  try {
    // Add human-like behavior
    await addHumanBehavior(page);
    
    console.log('📍 Going to WordPress admin...');
    await page.goto(process.env.WP_ADMIN_URL, { waitUntil: 'networkidle' });
    
    // Check if already logged in
    const dashboardVisible = await page.isVisible('#adminmenu').catch(() => false);
    
    if (!dashboardVisible) {
      console.log('📝 Not logged in, performing login...');
      
      // Check if on login page
      const onLoginPage = await page.isVisible('#user_login').catch(() => false);
      if (!onLoginPage) {
        await page.goto(`${process.env.WP_ADMIN_URL}/wp-login.php`);
      }
      
      // Login with human-like behavior
      await page.waitForTimeout(Math.random() * 1000 + 500);
      await page.click('#user_login');
      await page.waitForTimeout(Math.random() * 300 + 200);
      await page.type('#user_login', process.env.WP_USERNAME, { delay: Math.random() * 50 + 50 });
      
      await page.waitForTimeout(Math.random() * 500 + 200);
      await page.click('#user_pass');
      await page.waitForTimeout(Math.random() * 300 + 200);
      await page.type('#user_pass', process.env.WP_PASSWORD, { delay: Math.random() * 50 + 50 });
      
      // Check remember me
      const rememberMe = await page.$('#rememberme');
      if (rememberMe) {
        const isChecked = await rememberMe.isChecked();
        if (!isChecked) {
          await rememberMe.click();
        }
      }
      
      await page.waitForTimeout(Math.random() * 500 + 300);
      await page.click('#wp-submit');
      await page.waitForNavigation({ waitUntil: 'networkidle' });
      
      console.log('✅ Logged in successfully');
      
      // Save state
      await browserConfig.saveState(context);
      console.log('💾 Saved browser state');
    } else {
      console.log('✅ Already logged in using saved session');
    }
    
    // Navigate to Landing Pages
    console.log('\n🖱️ Clicking "Landing Pages" in sidebar...');
    const landingPagesSelectors = [
      'text=Landing Pages',
      'div.wp-menu-name:has-text("Landing Pages")',
      '//div[contains(@class, "wp-menu-name") and contains(text(), "Landing Pages")]',
      'a[href*="edit.php?post_type=landing"]'
    ];
    
    let clicked = false;
    for (const selector of landingPagesSelectors) {
      try {
        await page.click(selector);
        clicked = true;
        console.log('✅ Clicked Landing Pages menu');
        break;
      } catch (e) {
        // Try next selector
      }
    }
    
    if (!clicked) {
      console.log('❌ Could not click Landing Pages menu');
      throw new Error('Landing Pages menu not found');
    }
    
    await page.waitForLoadState('networkidle');
    
    // Click New Landing Page button
    console.log('🖱️ Clicking "New Landing Page" button...');
    const newPageSelectors = [
      'text=New Landing Page',
      'a.page-title-action:has-text("New Landing Page")',
      'a[href*="post-new.php?post_type=landing"]'
    ];
    
    clicked = false;
    for (const selector of newPageSelectors) {
      try {
        await page.click(selector);
        clicked = true;
        console.log('✅ Clicked New Landing Page button');
        break;
      } catch (e) {
        // Try next selector
      }
    }
    
    if (!clicked) {
      console.log('❌ Could not click New Landing Page button');
      throw new Error('New Landing Page button not found');
    }
    
    await page.waitForLoadState('networkidle');
    
    // Check if editor is visible
    const editorVisible = await page.isVisible('#title');
    if (editorVisible) {
      console.log('✅ SUCCESS! Landing page editor loaded!');
      console.log('You should see the landing page creation form.');
    } else {
      console.log('❌ FAILED! Could not find title field.');
    }
    
    console.log('\n⏸️  Keeping browser open for 10 seconds...');
    await page.waitForTimeout(10000);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: 'phase2-error.png', fullPage: true });
    console.log('📸 Screenshot saved as phase2-error.png');
  } finally {
    // Save state before closing
    await browserConfig.saveState(context);
    await browser.close();
  }
}

// PHASE 3: Login + Fill Header/Title
async function testFillHeader() {
  console.log('🔐 Testing Login + Fill Page Title with Stealth...\n');
  
  const savedState = await browserConfig.loadState();
  if (savedState) {
    console.log('📂 Using saved browser state');
  }
  
  const browser = await chromium.launch(browserConfig.getBrowserConfig());
  
  const contextConfig = browserConfig.getContextConfig();
  if (savedState) {
    contextConfig.storageState = savedState;
  }
  
  const context = await browser.newContext(contextConfig);
  const { addHumanBehavior } = await browserConfig.applyStealthMode(context);
  const page = await context.newPage();

  try {
    await addHumanBehavior(page);
    
    // Login if needed
    await page.goto(process.env.WP_ADMIN_URL, { waitUntil: 'networkidle' });
    const dashboardVisible = await page.isVisible('#adminmenu').catch(() => false);
    
    if (!dashboardVisible) {
      console.log('📝 Logging in...');
      const onLoginPage = await page.isVisible('#user_login').catch(() => false);
      if (!onLoginPage) {
        await page.goto(`${process.env.WP_ADMIN_URL}/wp-login.php`);
      }
      
      await page.waitForTimeout(Math.random() * 1000 + 500);
      await page.click('#user_login');
      await page.type('#user_login', process.env.WP_USERNAME, { delay: Math.random() * 50 + 50 });
      await page.click('#user_pass');
      await page.type('#user_pass', process.env.WP_PASSWORD, { delay: Math.random() * 50 + 50 });
      
      const rememberMe = await page.$('#rememberme');
      if (rememberMe && !(await rememberMe.isChecked())) {
        await rememberMe.click();
      }
      
      await page.click('#wp-submit');
      await page.waitForNavigation({ waitUntil: 'networkidle' });
      await browserConfig.saveState(context);
    }
    
    // Navigate to Landing Pages
    console.log('📍 Navigating to Landing Pages...');
    await page.click('text=Landing Pages');
    await page.waitForLoadState('networkidle');
    
    console.log('📍 Clicking New Landing Page...');
    await page.click('text=New Landing Page');
    await page.waitForLoadState('networkidle');
    
    // Fill the title
    const testTitle = 'Test Landing Page - ' + new Date().toLocaleString();
    console.log(`\n📝 Filling page title: "${testTitle}"`);
    await page.fill('#title', testTitle);
    
    console.log('✅ SUCCESS! Title filled!');
    console.log('\n⏸️  Keeping browser open for 15 seconds...');
    await page.waitForTimeout(15000);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: 'phase3-error.png', fullPage: true });
  } finally {
    await browserConfig.saveState(context);
    await browser.close();
  }
}

// PHASE 4: Full test with Hero Area fields
async function testHeroArea() {
  console.log('🔐 Testing Full Hero Area Panel with Stealth...\n');
  
  const savedState = await browserConfig.loadState();
  if (savedState) {
    console.log('📂 Using saved browser state');
  }
  
  const browser = await chromium.launch(browserConfig.getBrowserConfig());
  
  const contextConfig = browserConfig.getContextConfig();
  if (savedState) {
    contextConfig.storageState = savedState;
  }
  
  const context = await browser.newContext(contextConfig);
  const { addHumanBehavior } = await browserConfig.applyStealthMode(context);
  const page = await context.newPage();

  try {
    await addHumanBehavior(page);
    
    // Login if needed
    await page.goto(process.env.WP_ADMIN_URL, { waitUntil: 'networkidle' });
    const dashboardVisible = await page.isVisible('#adminmenu').catch(() => false);
    
    if (!dashboardVisible) {
      console.log('📝 Logging in...');
      const onLoginPage = await page.isVisible('#user_login').catch(() => false);
      if (!onLoginPage) {
        await page.goto(`${process.env.WP_ADMIN_URL}/wp-login.php`);
      }
      
      await page.waitForTimeout(Math.random() * 1000 + 500);
      await page.click('#user_login');
      await page.type('#user_login', process.env.WP_USERNAME, { delay: Math.random() * 50 + 50 });
      await page.click('#user_pass');
      await page.type('#user_pass', process.env.WP_PASSWORD, { delay: Math.random() * 50 + 50 });
      
      const rememberMe = await page.$('#rememberme');
      if (rememberMe && !(await rememberMe.isChecked())) {
        await rememberMe.click();
      }
      
      await page.click('#wp-submit');
      await page.waitForNavigation({ waitUntil: 'networkidle' });
      await browserConfig.saveState(context);
    }
    
    // Navigate to Landing Pages
    console.log('📍 Navigating to Landing Pages...');
    await page.click('text=Landing Pages');
    await page.waitForLoadState('networkidle');
    
    console.log('📍 Clicking New Landing Page...');
    await page.click('text=New Landing Page');
    await page.waitForLoadState('networkidle');
    
    // Fill title
    await page.fill('#title', 'Test Page with Hero - ' + Date.now());
    
    // Load mapping for Hero Area
    const fs = require('fs').promises;
    const path = require('path');
    const mappingContent = await fs.readFile(path.join(__dirname, '..', 'config', 'mapping.json'), 'utf8');
    const mapping = JSON.parse(mappingContent);
    
    // Click Hero Area tab
    console.log('\n🖱️ Clicking Hero Area tab...');
    const heroSelectors = [
      '#acf-group_62f544c0a7ba2 > div.inside.acf-fields.-top.-sidebar > div.acf-tab-wrap.-left > ul > li:first-child > a',
      'a[data-key="field_62f54631a1cf0"]',
      '.acf-tab-button:first-child'
    ];
    
    let clicked = false;
    for (const selector of heroSelectors) {
      try {
        await page.click(selector);
        clicked = true;
        console.log('✅ Clicked Hero Area tab');
        break;
      } catch (e) {
        // Try next selector
      }
    }
    
    if (!clicked) {
      console.log('⚠️  Could not click Hero tab, trying to fill fields anyway...');
    }
    
    await page.waitForTimeout(1000);
    
    // Fill Hero fields with human-like delays
    console.log('\n📝 Filling Hero Area fields...');
    
    const heroFields = [
      { selector: '#acf-field_62f5463fa1cf1', value: 'Professional', name: 'Hero Text Left' },
      { selector: '#acf-field_62f5464ea1cf2', value: 'Home Care', name: 'Hero Text Right' },
      { selector: '#acf-field_62f5464ea1cf4', value: 'in', name: 'Preposition' },
      { selector: '#acf-field_66alf5mrd3g5', value: 'New York, Brooklyn', name: 'Territories' },
      { selector: '#acf-field_66alf5mrd3g6', value: 'Quality care services', name: 'Excerpt' }
    ];
    
    for (const field of heroFields) {
      try {
        await page.waitForTimeout(Math.random() * 500 + 300);
        await page.fill(field.selector, field.value);
        console.log(`  ✓ Filled ${field.name}: "${field.value}"`);
      } catch (e) {
        console.log(`  ⚠️ Could not fill ${field.name}`);
      }
    }
    
    console.log('\n✅ Test complete! Check if fields are filled.');
    console.log('\n⏸️  Keeping browser open for 20 seconds...');
    await page.waitForTimeout(20000);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: 'phase4-error.png', fullPage: true });
    console.log('📸 Screenshot saved as phase4-error.png');
  } finally {
    await browserConfig.saveState(context);
    await browser.close();
  }
}

// Clear saved session
async function clearSession() {
  console.log('🗑️  Clearing saved browser session...\n');
  
  const fs = require('fs').promises;
  const path = require('path');
  const stateDir = browserConfig.getUserDataDir();
  
  try {
    await fs.rm(stateDir, { recursive: true, force: true });
    console.log('✅ Browser session cleared successfully');
    console.log('Next login will create a fresh session');
  } catch (error) {
    console.log('❌ Error clearing session:', error.message);
  }
}

// Main execution
async function main() {
  const phase = process.argv[2] || '1';
  
  console.log('='.repeat(50));
  console.log('WP FILLER - STEALTH MODE TESTING');
  console.log('='.repeat(50) + '\n');
  
  switch(phase) {
    case '1':
      await testLoginWithStealth();
      break;
    case '2':
      await testLoginAndNavigate();
      break;
    case '3':
      await testFillHeader();
      break;
    case '4':
      await testHeroArea();
      break;
    case 'clear':
      await clearSession();
      break;
    default:
      console.log('Usage: node test-phases-stealth.js [phase]');
      console.log('Phases:');
      console.log('  1     - Login with stealth mode (saves session)');
      console.log('  2     - Login + Navigate to New Landing Page');
      console.log('  3     - Login + Fill page title');
      console.log('  4     - Login + Fill Hero Area fields');
      console.log('  clear - Clear saved browser session');
      console.log('\nAll phases include:');
      console.log('  • Anti-detection measures');
      console.log('  • Human-like typing and delays');
      console.log('  • Session persistence (cookies saved)');
      console.log('  • Browser fingerprint spoofing');
      console.log('\n💡 TIP: Run phase 1 first to save session, then other phases will reuse it!');
  }
}

main().catch(console.error);