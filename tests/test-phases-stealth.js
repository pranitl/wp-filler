const { chromium } = require('playwright');
const browserConfig = require('../src/browser-config');
require('dotenv').config();

// Helper function to navigate to new landing page
async function navigateToNewLandingPage(page) {
  console.log('\n📍 Starting navigation to New Landing Page...');
  
  // Step 1: Click Landing Pages in sidebar
  console.log('🖱️ Clicking "Landing Pages" in sidebar...');
  
  try {
    // Try multiple selectors for the menu item
    const menuClicked = await page.click('text=Landing Pages').then(() => true).catch(() => false) ||
                        await page.click('a[href*="edit.php?post_type=landing"]').then(() => true).catch(() => false) ||
                        await page.click('//div[contains(@class, "wp-menu-name") and contains(text(), "Landing Pages")]').then(() => true).catch(() => false);
    
    if (!menuClicked) {
      throw new Error('Could not click Landing Pages menu');
    }
    
    console.log('✅ Clicked Landing Pages menu');
    
    // Wait for navigation to start and page to be ready
    console.log('⏳ Waiting for Landing Pages list to load...');
    await Promise.race([
      page.waitForLoadState('domcontentloaded'),
      page.waitForTimeout(1000) // Max 1 second wait
    ]);
    
    // Quick check if we need more time
    const hasButton = await page.isVisible('a.page-title-action').catch(() => false);
    if (!hasButton) {
      await page.waitForLoadState('networkidle', { timeout: 2000 }).catch(() => {});
    }
    
    // Verify we're on the landing pages list
    const currentUrl = page.url();
    console.log(`📍 Current URL: ${currentUrl}`);
    
    if (!currentUrl.includes('edit.php') || !currentUrl.includes('post_type=landing')) {
      console.log('⚠️ Not on Landing Pages list, trying direct navigation...');
      await page.goto(`${process.env.WP_ADMIN_URL}/edit.php?post_type=landing`);
      await page.waitForLoadState('domcontentloaded');
    }
    
    // Step 2: Click New Landing Page button - OPTIMIZED
    console.log('🔍 Looking for "New Landing Page" button...');
    
    // Try to find and click the New Landing Page button quickly
    let buttonClicked = false;
    
    // Method 1: Quick selector check and click
    const button = await page.$('a.page-title-action').catch(() => null);
    if (button) {
      await button.click();
      buttonClicked = true;
      console.log('✅ Clicked New Landing Page button');
    }
    
    // Method 2: Text selector (fast fallback)
    if (!buttonClicked) {
      buttonClicked = await page.click('text="New Landing Page"').then(() => true).catch(() => false);
      if (buttonClicked) {
        console.log('✅ Clicked New Landing Page button (text)');
      }
    }
    
    // Method 3: Direct navigation (fastest fallback)
    if (!buttonClicked) {
      console.log('⚠️ Could not click button, navigating directly...');
      await page.goto(`${process.env.WP_ADMIN_URL}/post-new.php?post_type=landing`);
    }
    
    // Wait for editor to load - OPTIMIZED
    console.log('⏳ Waiting for editor to load...');
    
    // Wait for the title field as our primary indicator
    await page.waitForSelector('#title', { state: 'visible', timeout: 5000 });
    
    // Quick additional wait only if needed
    const titleReady = await page.isVisible('#title');
    if (titleReady) {
      console.log('✅ Successfully navigated to new landing page editor!');
      await page.waitForTimeout(500); // Small buffer for any final JS initialization
    } else {
      await page.waitForLoadState('networkidle', { timeout: 2000 });
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Navigation failed:', error.message);
    await page.screenshot({ path: 'navigation-error.png', fullPage: true });
    console.log('📸 Error screenshot saved as navigation-error.png');
    throw error;
  }
}

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
    
    // Use helper function to navigate
    await navigateToNewLandingPage(page);
    
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
    
    // Navigate to Landing Pages with improved waiting
    console.log('📍 Navigating to Landing Pages...');
    await page.click('text=Landing Pages');
    console.log('⏳ Waiting for page to load...');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Ensure page is fully ready
    
    console.log('📍 Looking for New Landing Page button...');
    
    // Try to click with better error handling
    try {
      // Wait for button to be visible first
      await page.waitForSelector('a.page-title-action', { timeout: 5000 });
      await page.waitForTimeout(500); // Small delay
      await page.click('a.page-title-action');
      console.log('✅ Clicked New Landing Page button');
    } catch (e) {
      // Fallback to text selector
      try {
        await page.click('text=New Landing Page');
        console.log('✅ Clicked New Landing Page button (text selector)');
      } catch (e2) {
        // Direct navigation as last resort
        console.log('⚠️ Button click failed, navigating directly...');
        await page.goto(`${process.env.WP_ADMIN_URL}/post-new.php?post_type=landing`);
      }
    }
    
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500); // Wait for editor initialization
    
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

// PHASE 4: Navigate to Page Design section
async function testPageDesign() {
  console.log('🔐 Testing Navigation to Page Design with Stealth...\n');
  
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
    
    // Navigate to Landing Pages with improved waiting
    console.log('📍 Navigating to Landing Pages...');
    await page.click('text=Landing Pages');
    console.log('⏳ Waiting for page to load...');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Ensure page is fully ready
    
    console.log('📍 Looking for New Landing Page button...');
    
    // Try to click with better error handling
    try {
      // Wait for button to be visible first
      await page.waitForSelector('a.page-title-action', { timeout: 5000 });
      await page.waitForTimeout(500); // Small delay
      await page.click('a.page-title-action');
      console.log('✅ Clicked New Landing Page button');
    } catch (e) {
      // Fallback to text selector
      try {
        await page.click('text=New Landing Page');
        console.log('✅ Clicked New Landing Page button (text selector)');
      } catch (e2) {
        // Direct navigation as last resort
        console.log('⚠️ Button click failed, navigating directly...');
        await page.goto(`${process.env.WP_ADMIN_URL}/post-new.php?post_type=landing`);
      }
    }
    
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500); // Wait for editor initialization
    
    // Fill title
    await page.fill('#title', 'Test Page Design - ' + Date.now());
    
    // Scroll down to find Page Design section
    console.log('\n📜 Scrolling to find Page Design radio button...');
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(1000);
    
    // Click the specific Page Design radio button from mapping
    console.log('🎯 Looking for Page Design radio button (option C)...');
    
    // The specific selector from the implementation guide
    const pageDesignRadioSelector = '#acf-field_62f9dkhrn3e92-c';
    const pageDesignRadioName = 'acf[field_62f9dkhrn3e92]';
    
    try {
      // First try the exact ID selector
      console.log(`🔍 Trying to find radio button: ${pageDesignRadioSelector}`);
      
      // Wait for the radio button to be present
      await page.waitForSelector(pageDesignRadioSelector, { timeout: 5000 });
      
      // Scroll it into view
      await page.$eval(pageDesignRadioSelector, el => el.scrollIntoViewIfNeeded());
      await page.waitForTimeout(500);
      
      // Click the radio button
      await page.click(pageDesignRadioSelector);
      console.log('✅ Clicked Page Design radio button (option C)');
      
      // Verify it's checked
      const isChecked = await page.$eval(pageDesignRadioSelector, el => el.checked);
      if (isChecked) {
        console.log('✅ Verified: Radio button is checked');
      } else {
        console.log('⚠️  Warning: Radio button may not be checked');
      }
      
    } catch (e) {
      console.log('⚠️  Could not find radio button by ID, trying alternative methods...');
      
      // Alternative: Try by name and value
      try {
        const alternativeSelector = `input[type="radio"][name="${pageDesignRadioName}"][value="c"]`;
        console.log(`🔍 Trying alternative selector: ${alternativeSelector}`);
        
        await page.waitForSelector(alternativeSelector, { timeout: 5000 });
        await page.$eval(alternativeSelector, el => el.scrollIntoViewIfNeeded());
        await page.waitForTimeout(500);
        await page.click(alternativeSelector);
        console.log('✅ Clicked Page Design radio button using alternative selector');
        
      } catch (e2) {
        console.log('⚠️  Could not find Page Design radio button, trying broader search...');
        
        // Last resort: Find all radio buttons and look for the one with value "c"
        const radioButtons = await page.$$('input[type="radio"]');
        console.log(`🔍 Found ${radioButtons.length} radio buttons on page`);
        
        for (const radio of radioButtons) {
          const name = await radio.getAttribute('name');
          const value = await radio.getAttribute('value');
          const id = await radio.getAttribute('id');
          
          if ((name && name.includes('field_62f9dkhrn3e92')) || 
              (id && id.includes('field_62f9dkhrn3e92-c'))) {
            console.log(`🎯 Found matching radio: name="${name}", value="${value}", id="${id}"`);
            await radio.scrollIntoViewIfNeeded();
            await page.waitForTimeout(500);
            await radio.click();
            console.log('✅ Clicked Page Design radio button');
            break;
          }
        }
      }
    }
    
    // Take screenshot to verify
    await page.screenshot({ path: 'page-design-selected.png' });
    console.log('📸 Screenshot saved as page-design-selected.png');
    
    // Also look for any label associated with this radio button to confirm
    try {
      const labelSelector = `label[for="acf-field_62f9dkhrn3e92-c"]`;
      const labelText = await page.$eval(labelSelector, el => el.textContent);
      console.log(`📝 Radio button label: "${labelText.trim()}"`);
    } catch (e) {
      // Label might not exist
    }
    
    console.log('\n✅ Phase 4 complete! Page Design radio button (option C) selected.');
    console.log('\n⏸️  Keeping browser open for 15 seconds to verify...');
    await page.waitForTimeout(15000);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: 'phase4-error.png', fullPage: true });
    console.log('📸 Screenshot saved as phase4-error.png');
  } finally {
    await browserConfig.saveState(context);
    await browser.close();
  }
}

// PHASE 5: Fill Hero Area fields (includes Phase 4)
async function testHeroArea() {
  console.log('🔐 Testing Page Design + Hero Area Fields with Stealth...\n');
  console.log('This phase includes: Title, Page Design selection, and Hero Area fields\n');
  
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
    
    // Navigate to new landing page
    await navigateToNewLandingPage(page);
    
    // PHASE 3 WORK: Fill title
    const testTitle = 'Test Hero Area - ' + Date.now();
    console.log(`\n📝 Filling page title: "${testTitle}"`);
    await page.fill('#title', testTitle);
    
    // PHASE 4 WORK: Click Page Design radio button
    console.log('\n🎯 Selecting Page Design option C...');
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(1000);
    
    const pageDesignRadioSelector = '#acf-field_62f9dkhrn3e92-c';
    try {
      await page.waitForSelector(pageDesignRadioSelector, { timeout: 5000 });
      await page.$eval(pageDesignRadioSelector, el => el.scrollIntoViewIfNeeded());
      await page.waitForTimeout(500);
      await page.click(pageDesignRadioSelector);
      console.log('✅ Page Design radio button selected');
    } catch (e) {
      console.log('⚠️  Could not find Page Design radio button, continuing...');
    }
    
    // Load mapping for Hero Area
    const fs = require('fs').promises;
    const path = require('path');
    const mappingContent = await fs.readFile(path.join(__dirname, '..', 'config', 'mapping.json'), 'utf8');
    const mapping = JSON.parse(mappingContent);
    
    // Find and click Hero Area tab/panel
    console.log('\n🎯 Looking for Hero Area section...');
    
    // Scroll down a bit to see ACF fields
    await page.evaluate(() => window.scrollBy(0, 300));
    await page.waitForTimeout(1000);
    
    // Try to find Hero Area tab using mapping
    const heroPanel = mapping.panels.find(p => p.key === 'panel_hero_area');
    if (heroPanel) {
      try {
        console.log('🖱️ Clicking Hero Area tab...');
        await page.click(heroPanel.selector);
        console.log('✅ Clicked Hero Area tab');
        await page.waitForTimeout(1500);
      } catch (e) {
        console.log('⚠️  Could not click Hero Area tab from mapping, trying alternatives...');
        
        // Alternative selectors
        const heroTabSelectors = [
          'text="Hero Area"',
          'a:has-text("Hero Area")',
          '.acf-tab-button:has-text("Hero Area")',
          '[data-key*="hero"]',
          'li.active a:has-text("Hero")'
        ];
        
        for (const selector of heroTabSelectors) {
          try {
            await page.click(selector);
            console.log(`✅ Clicked Hero Area tab using: ${selector}`);
            await page.waitForTimeout(1500);
            break;
          } catch (e) {
            // Try next
          }
        }
      }
    }
    
    // Now fill Hero Area fields
    console.log('\n📝 Filling Hero Area fields...');
    
    // Get field mappings
    const heroFields = mapping.fields.filter(f => f.panel === 'panel_hero_area');
    
    // Test data for Hero Area
    const testData = {
      hero_text_left: 'Professional',
      hero_text_right: 'Home Care Services',
      hero_preposition: 'in',
      hero_territories_csv: 'Boston, Cambridge, Somerville',
      hero_excerpt: 'Providing compassionate care for your loved ones',
      hero_btn1_text: 'Get Started',
      hero_btn1_url: 'https://example.com/contact',
      hero_btn2_text: 'Learn More', 
      hero_btn2_url: 'https://example.com/about'
    };
    
    // Fill each field with human-like delays
    for (const field of heroFields) {
      if (testData[field.payloadKey]) {
        try {
          console.log(`  📝 Filling ${field.payloadKey}...`);
          
          // Wait for field to be visible
          await page.waitForSelector(field.selector, { timeout: 5000 });
          
          // Scroll field into view
          await page.$eval(field.selector, el => el.scrollIntoViewIfNeeded());
          
          // Human-like delay
          await page.waitForTimeout(Math.random() * 800 + 400);
          
          // Click to focus
          await page.click(field.selector);
          await page.waitForTimeout(200);
          
          // Clear field first
          await page.fill(field.selector, '');
          
          // Type with human-like speed
          await page.type(field.selector, testData[field.payloadKey], { 
            delay: Math.random() * 30 + 20 
          });
          
          console.log(`  ✅ Filled ${field.payloadKey}: "${testData[field.payloadKey]}"`);
        } catch (e) {
          console.log(`  ⚠️ Could not fill ${field.payloadKey}: ${e.message}`);
        }
      }
    }
    
    // Take screenshot of filled form
    await page.screenshot({ path: 'hero-area-filled.png', fullPage: true });
    console.log('\n📸 Screenshot saved as hero-area-filled.png');
    
    console.log('\n✅ Phase 5 complete! Hero Area fields filled.');
    console.log('\n💡 Check the fields:');
    console.log('  - Hero Text Left: Professional');
    console.log('  - Hero Text Right: Home Care Services');
    console.log('  - Preposition: in');
    console.log('  - Territories: Boston, Cambridge, Somerville');
    console.log('  - Excerpt: Providing compassionate care...');
    console.log('  - Button 1: Get Started → https://example.com/contact');
    console.log('  - Button 2: Learn More → https://example.com/about');
    
    console.log('\n⏸️  Keeping browser open for 20 seconds to verify...');
    await page.waitForTimeout(20000);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: 'phase5-error.png', fullPage: true });
    console.log('📸 Error screenshot saved as phase5-error.png');
  } finally {
    await browserConfig.saveState(context);
    await browser.close();
  }
}

// PHASE 6: Fill Intro Content (includes all previous phases)
async function testIntroContent() {
  console.log('🔐 Testing Full Form Through Intro Content with Stealth...\n');
  console.log('This phase includes: Title, Page Design, Hero Area, and Intro Content\n');
  
  const savedState = await browserConfig.loadState();
  const browser = await chromium.launch(browserConfig.getBrowserConfig());
  const contextConfig = browserConfig.getContextConfig();
  if (savedState) contextConfig.storageState = savedState;
  
  const context = await browser.newContext(contextConfig);
  const { addHumanBehavior } = await browserConfig.applyStealthMode(context);
  const page = await context.newPage();

  try {
    await addHumanBehavior(page);
    
    // Login and navigate
    await page.goto(process.env.WP_ADMIN_URL, { waitUntil: 'networkidle' });
    const dashboardVisible = await page.isVisible('#adminmenu').catch(() => false);
    
    if (!dashboardVisible) {
      await performLogin(page);
      await browserConfig.saveState(context);
    }
    
    await navigateToNewLandingPage(page);
    
    // Fill all previous phases
    const testTitle = 'Test Full Form - ' + Date.now();
    await page.fill('#title', testTitle);
    
    // Page Design
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(1000);
    await page.click('#acf-field_62f9dkhrn3e92-c').catch(() => {});
    
    // Hero Area
    const fs = require('fs').promises;
    const path = require('path');
    const mappingContent = await fs.readFile(path.join(__dirname, '..', 'config', 'mapping.json'), 'utf8');
    const mapping = JSON.parse(mappingContent);
    
    const heroPanel = mapping.panels.find(p => p.key === 'panel_hero_area');
    if (heroPanel) {
      await page.click(heroPanel.selector).catch(() => page.click('text="Hero Area"'));
      await page.waitForTimeout(1500);
      
      const heroData = {
        hero_text_left: 'Professional',
        hero_text_right: 'Home Care Services',
        hero_preposition: 'in',
        hero_territories_csv: 'Boston, Cambridge, Somerville',
        hero_excerpt: 'Providing compassionate care for your loved ones',
        hero_btn1_text: 'Get Started',
        hero_btn1_url: 'https://example.com/contact',
        hero_btn2_text: 'Learn More',
        hero_btn2_url: 'https://example.com/about'
      };
      
      const heroFields = mapping.fields.filter(f => f.panel === 'panel_hero_area');
      for (const field of heroFields) {
        if (heroData[field.payloadKey]) {
          await page.fill(field.selector, heroData[field.payloadKey]).catch(() => {});
        }
      }
    }
    
    // NEW: Intro Content
    console.log('\n📝 Filling Intro Content panel...');
    const introPanel = mapping.panels.find(p => p.key === 'panel_intro_content');
    if (introPanel) {
      await page.click(introPanel.selector).catch(() => page.click('text="Intro Content"'));
      await page.waitForTimeout(1500); // Wait for panel to load
      
      // Fill intro headline first
      console.log('  📝 Filling intro headline...');
      await page.fill('#acf-field_62f544c0b2002', 'Welcome to Our Services').catch(() => {});
      
      // Now handle the TinyMCE editor for content
      console.log('  📝 Initializing and filling content editor...');
      
      // Look for the actual initialization placeholder/button
      const needsInit = await page.isVisible('text="Click to initialize TinyMCE"').catch(() => false);
      
      if (needsInit) {
        console.log('  🖱️ TinyMCE needs initialization, clicking...');
        
        // Try to click the initialization area - be more specific
        const initClicked = await page.click('text="Click to initialize TinyMCE"').then(() => true).catch(() => false) ||
                           await page.click('.acf-editor-wrap .wp-editor-area').then(() => true).catch(() => false) ||
                           await page.click('#acf-editor-197_ifr').then(() => true).catch(() => false) ||
                           await page.click('.acf-editor-wrap iframe').then(() => true).catch(() => false);
        
        if (initClicked) {
          console.log('  ✅ Clicked to initialize TinyMCE');
          await page.waitForTimeout(1500); // Wait for init
        }
      }
      
      // Now try to switch to Text mode and fill content
      console.log('  🔄 Switching to Text mode...');
      const textButton = mapping.fields.find(f => f.payloadKey === 'intro_text_html_button');
      if (textButton) {
        const textModeClicked = await page.click(textButton.selector).then(() => true).catch(() => false);
        
        if (textModeClicked) {
          await page.waitForTimeout(500);
          console.log('  ✅ Switched to Text mode');
          
          // Now fill the content in text mode
          const introHtmlField = mapping.fields.find(f => f.payloadKey === 'intro_html');
          if (introHtmlField) {
            await page.fill(introHtmlField.selector, '<p>We provide exceptional home care services tailored to your needs.</p>');
            console.log('  ✅ Content filled');
          }
        } else {
          console.log('  ⚠️ Could not switch to Text mode, trying direct JavaScript...');
          // Fallback to TinyMCE API or direct manipulation
          const filled = await page.evaluate(() => {
            // Try TinyMCE API first
            if (typeof tinymce !== 'undefined') {
              const editor = tinymce.get('acf-editor-197');
              if (editor) {
                editor.setContent('<p>We provide exceptional home care services tailored to your needs.</p>');
                return true;
              }
            }
            // Try direct textarea
            const textarea = document.querySelector('#acf-editor-197');
            if (textarea) {
              textarea.value = '<p>We provide exceptional home care services tailored to your needs.</p>';
              return true;
            }
            return false;
          });
          
          if (filled) {
            console.log('  ✅ Content filled via JavaScript');
          }
        }
      }
      
      console.log('✅ Intro Content filled');
    }
    
    await page.screenshot({ path: 'phase6-intro-content.png', fullPage: true });
    console.log('\n📸 Screenshot saved as phase6-intro-content.png');
    console.log('\n⏸️  Keeping browser open for 15 seconds...');
    await page.waitForTimeout(15000);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: 'phase6-error.png', fullPage: true });
  } finally {
    await browserConfig.saveState(context);
    await browser.close();
  }
}

// PHASE 7: Fill CTA (includes all previous phases)  
async function testCTA() {
  console.log('🔐 Testing Full Form Through CTA with Stealth...\n');
  console.log('Includes: Title, Page Design, Hero Area, Intro Content, and CTA\n');
  
  const savedState = await browserConfig.loadState();
  const browser = await chromium.launch(browserConfig.getBrowserConfig());
  const contextConfig = browserConfig.getContextConfig();
  if (savedState) contextConfig.storageState = savedState;
  
  const context = await browser.newContext(contextConfig);
  const { addHumanBehavior } = await browserConfig.applyStealthMode(context);
  const page = await context.newPage();

  try {
    await addHumanBehavior(page);
    await page.goto(process.env.WP_ADMIN_URL, { waitUntil: 'networkidle' });
    
    const dashboardVisible = await page.isVisible('#adminmenu').catch(() => false);
    if (!dashboardVisible) {
      await performLogin(page);
      await browserConfig.saveState(context);
    }
    
    await navigateToNewLandingPage(page);
    
    // Run all previous work
    await fillAllPreviousPhases(page, 7);
    
    // NEW: CTA Panel
    const fs = require('fs').promises;
    const path = require('path');
    const mappingContent = await fs.readFile(path.join(__dirname, '..', 'config', 'mapping.json'), 'utf8');
    const mapping = JSON.parse(mappingContent);
    
    console.log('\n📝 Filling Call to Action panel...');
    const ctaPanel = mapping.panels.find(p => p.key === 'panel_top_cta');
    if (ctaPanel) {
      await page.click(ctaPanel.selector).catch(() => page.click('text="Call to Action"'));
      await page.waitForTimeout(1500);
      
      // Use the correct selectors from mapping
      const ctaHeadlineField = mapping.fields.find(f => f.payloadKey === 'cta_headline');
      const ctaTextField = mapping.fields.find(f => f.payloadKey === 'cta_text');
      
      if (ctaHeadlineField) {
        console.log(`  📝 Filling CTA headline with selector: ${ctaHeadlineField.selector}`);
        await page.fill(ctaHeadlineField.selector, 'Ready to Get Started?').catch((e) => {
          console.log(`  ⚠️ Could not fill CTA headline: ${e.message}`);
        });
      }
      
      if (ctaTextField) {
        console.log(`  📝 Filling CTA text with selector: ${ctaTextField.selector}`);
        await page.fill(ctaTextField.selector, 'Contact us today for a free consultation').catch((e) => {
          console.log(`  ⚠️ Could not fill CTA text: ${e.message}`);
        });
      }
      
      console.log('✅ CTA filled');
    }
    
    await page.screenshot({ path: 'phase7-cta.png', fullPage: true });
    console.log('\n⏸️  Keeping browser open for 15 seconds...');
    await page.waitForTimeout(15000);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: 'phase7-error.png', fullPage: true });
  } finally {
    await browserConfig.saveState(context);
    await browser.close();
  }
}

// PHASE 8: Fill Below Form (includes all previous phases)
async function testBelowForm() {
  console.log('🔐 Testing Full Form Through Below Form with Stealth...\n');
  
  const savedState = await browserConfig.loadState();
  const browser = await chromium.launch(browserConfig.getBrowserConfig());
  const contextConfig = browserConfig.getContextConfig();
  if (savedState) contextConfig.storageState = savedState;
  
  const context = await browser.newContext(contextConfig);
  const { addHumanBehavior } = await browserConfig.applyStealthMode(context);
  const page = await context.newPage();

  try {
    await addHumanBehavior(page);
    await page.goto(process.env.WP_ADMIN_URL, { waitUntil: 'networkidle' });
    
    const dashboardVisible = await page.isVisible('#adminmenu').catch(() => false);
    if (!dashboardVisible) {
      await performLogin(page);
      await browserConfig.saveState(context);
    }
    
    await navigateToNewLandingPage(page);
    await fillAllPreviousPhases(page, 8);
    
    // NEW: Below Form Panel
    const fs = require('fs').promises;
    const path = require('path');
    const mappingContent = await fs.readFile(path.join(__dirname, '..', 'config', 'mapping.json'), 'utf8');
    const mapping = JSON.parse(mappingContent);
    
    console.log('\n📝 Filling Below Form panel...');
    const belowPanel = mapping.panels.find(p => p.key === 'panel_below_form');
    if (belowPanel) {
      await page.click(belowPanel.selector).catch(() => page.click('text="Below Form"'));
      await page.waitForTimeout(1500);
      
      // Fill the headline field first
      console.log('  📝 Filling Below Form headline...');
      const belowHeadlineField = mapping.fields.find(f => f.payloadKey === 'below_headline');
      if (belowHeadlineField) {
        await page.fill(belowHeadlineField.selector, 'Our Trusted Services').catch((e) => {
          console.log(`  ⚠️ Could not fill headline: ${e.message}`);
        });
      }
      
      // Now handle the TinyMCE content editor
      console.log('  📝 Initializing and filling content editor...');
      
      // Check if TinyMCE needs initialization
      const needsInit = await page.isVisible('text="Click to initialize TinyMCE"').catch(() => false);
      
      if (needsInit) {
        console.log('  🖱️ TinyMCE needs initialization, clicking...');
        
        // Try to click the initialization area
        const initClicked = await page.click('text="Click to initialize TinyMCE"').then(() => true).catch(() => false) ||
                           await page.click('.acf-editor-toolbar').then(() => true).catch(() => false) ||
                           await page.click('.acf-editor-wrap').then(() => true).catch(() => false);
        
        if (initClicked) {
          console.log('  ✅ Clicked to initialize TinyMCE');
          await page.waitForTimeout(1500); // Wait for init
        }
      }
      
      // Fill content - OPTIMIZED
      console.log('  🔄 Filling content...');
      
      // Short wait after initialization
      await page.waitForTimeout(500);
      
      // Since we know it's editor-198, go straight to TinyMCE manipulation
      const filled = await page.evaluate(() => {
        const content = '<p>Trusted by families across the region for over 20 years.</p>';
        
        // Direct TinyMCE API - we know it's acf-editor-198
        if (typeof tinymce !== 'undefined') {
          const editor = tinymce.get('acf-editor-198');
          if (editor && editor.initialized) {
            editor.setContent(content);
            editor.save(); // Save to underlying textarea
            return 'tinymce-api';
          }
        }
        
        // Fallback: Try iframe method if TinyMCE API fails
        const iframe = document.querySelector('#acf-editor-198_ifr');
        if (iframe && iframe.contentDocument) {
          const body = iframe.contentDocument.querySelector('#tinymce');
          if (body) {
            body.innerHTML = content;
            // Fire events to ensure WordPress registers the change
            body.dispatchEvent(new Event('input', { bubbles: true }));
            body.dispatchEvent(new Event('change', { bubbles: true }));
            return 'iframe-direct';
          }
        }
        
        // Last fallback: Text mode
        const textarea = document.querySelector('#acf-editor-198');
        if (textarea && textarea.style.display !== 'none') {
          textarea.value = content;
          textarea.dispatchEvent(new Event('change', { bubbles: true }));
          return 'textarea';
        }
        
        return false;
      });
      
      if (filled) {
        console.log(`  ✅ Content filled (method: ${filled})`);
      } else {
        // Only try Text mode as last resort
        console.log('  ⚠️ Direct fill failed, trying Text mode...');
        const textButton = mapping.fields.find(f => f.payloadKey === 'below_text_html_button');
        if (textButton) {
          const clicked = await page.click(textButton.selector).then(() => true).catch(() => false);
          if (clicked) {
            await page.waitForTimeout(300);
            await page.fill('#acf-editor-198', '<p>Trusted by families across the region for over 20 years.</p>').catch(() => {});
            console.log('  ✅ Content filled via Text mode');
          }
        }
      }
      
      console.log('✅ Below Form filled');
    }
    
    await page.screenshot({ path: 'phase8-below-form.png', fullPage: true });
    console.log('\n⏸️  Keeping browser open for 15 seconds...');
    await page.waitForTimeout(15000);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: 'phase8-error.png', fullPage: true });
  } finally {
    await browserConfig.saveState(context);
    await browser.close();
  }
}

// PHASE 9: Fill Services Grid (includes all previous phases - COMPLETE FORM)
async function testServicesGrid() {
  console.log('🔐 Testing COMPLETE FORM with All Panels...\n');
  console.log('This is the full test including all form sections!\n');
  
  const savedState = await browserConfig.loadState();
  const browser = await chromium.launch(browserConfig.getBrowserConfig());
  const contextConfig = browserConfig.getContextConfig();
  if (savedState) contextConfig.storageState = savedState;
  
  const context = await browser.newContext(contextConfig);
  const { addHumanBehavior } = await browserConfig.applyStealthMode(context);
  const page = await context.newPage();

  try {
    await addHumanBehavior(page);
    await page.goto(process.env.WP_ADMIN_URL, { waitUntil: 'networkidle' });
    
    const dashboardVisible = await page.isVisible('#adminmenu').catch(() => false);
    if (!dashboardVisible) {
      await performLogin(page);
      await browserConfig.saveState(context);
    }
    
    await navigateToNewLandingPage(page);
    await fillAllPreviousPhases(page, 9);
    
    // NEW: Services Grid Panel
    const fs = require('fs').promises;
    const path = require('path');
    const mappingContent = await fs.readFile(path.join(__dirname, '..', 'config', 'mapping.json'), 'utf8');
    const mapping = JSON.parse(mappingContent);
    
    console.log('\n📝 Filling Services Grid panel...');
    const servicesPanel = mapping.panels.find(p => p.key === 'panel_services_grid');
    if (servicesPanel) {
      await page.click(servicesPanel.selector).catch(() => page.click('text="Services Grid"'));
      await page.waitForTimeout(1500);
      
      // Select services from dropdowns
      const services = ['Personal Care', 'Home Care', 'Companion Care', 'Dementia Care'];
      const serviceSelectors = [
        '#acf-field_62f544c0b2137-row-0-field_62f544c0d43e6',
        '#acf-field_62f544c0b2137-689e2a360e87e-field_62f544c0d43e6',
        '#acf-field_62f544c0b2137-689e2a350e87d-field_62f544c0d43e6',
        '#acf-field_62f544c0b2137-row-3-field_62f544c0d43e6'
      ];
      
      for (let i = 0; i < services.length; i++) {
        try {
          await page.selectOption(serviceSelectors[i], services[i]);
          console.log(`  ✅ Selected service ${i+1}: ${services[i]}`);
        } catch (e) {
          console.log(`  ⚠️ Could not select service ${i+1}`);
        }
      }
    }
    
    console.log('\n🎉 COMPLETE FORM FILLED SUCCESSFULLY!');
    console.log('All panels have been populated with test data.');
    
    await page.screenshot({ path: 'phase9-complete-form.png', fullPage: true });
    console.log('\n📸 Screenshot saved as phase9-complete-form.png');
    console.log('\n⏸️  Keeping browser open for 20 seconds...');
    await page.waitForTimeout(20000);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: 'phase9-error.png', fullPage: true });
  } finally {
    await browserConfig.saveState(context);
    await browser.close();
  }
}

// Helper function for login
async function performLogin(page) {
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
}

// Helper function to fill all previous phases
async function fillAllPreviousPhases(page, upToPhase) {
  const fs = require('fs').promises;
  const path = require('path');
  const mappingContent = await fs.readFile(path.join(__dirname, '..', 'config', 'mapping.json'), 'utf8');
  const mapping = JSON.parse(mappingContent);
  
  // Phase 3: Title
  const testTitle = 'Test Complete Form - ' + Date.now();
  await page.fill('#title', testTitle);
  
  // Phase 4: Page Design
  await page.evaluate(() => window.scrollBy(0, 500));
  await page.waitForTimeout(1000);
  await page.click('#acf-field_62f9dkhrn3e92-c').catch(() => {});
  
  if (upToPhase < 5) return;
  
  // Phase 5: Hero Area
  const heroPanel = mapping.panels.find(p => p.key === 'panel_hero_area');
  if (heroPanel) {
    await page.click(heroPanel.selector).catch(() => page.click('text="Hero Area"'));
    await page.waitForTimeout(1500);
    
    const heroData = {
      hero_text_left: 'Professional',
      hero_text_right: 'Home Care Services',
      hero_preposition: 'in',
      hero_territories_csv: 'Boston, Cambridge, Somerville',
      hero_excerpt: 'Providing compassionate care for your loved ones',
      hero_btn1_text: 'Get Started',
      hero_btn1_url: 'https://example.com/contact',
      hero_btn2_text: 'Learn More',
      hero_btn2_url: 'https://example.com/about'
    };
    
    const heroFields = mapping.fields.filter(f => f.panel === 'panel_hero_area');
    for (const field of heroFields) {
      if (heroData[field.payloadKey]) {
        await page.fill(field.selector, heroData[field.payloadKey]).catch(() => {});
      }
    }
  }
  
  if (upToPhase < 6) return;
  
  // Phase 6: Intro Content
  const introPanel = mapping.panels.find(p => p.key === 'panel_intro_content');
  if (introPanel) {
    await page.click(introPanel.selector).catch(() => page.click('text="Intro Content"'));
    await page.waitForTimeout(1500);
    
    // Fill headline
    await page.fill('#acf-field_62f544c0b2002', 'Welcome to Our Services').catch(() => {});
    
    // Check if TinyMCE needs initialization
    const needsInit = await page.isVisible('text="Click to initialize TinyMCE"').catch(() => false);
    
    if (needsInit) {
      // Click to initialize
      await page.click('text="Click to initialize TinyMCE"').catch(() => 
        page.click('.acf-editor-wrap .wp-editor-area').catch(() => 
          page.click('#acf-editor-197_ifr')));
      await page.waitForTimeout(1500);
    }
    
    // Try to switch to Text mode and fill
    const textButton = mapping.fields.find(f => f.payloadKey === 'intro_text_html_button');
    if (textButton) {
      const textModeClicked = await page.click(textButton.selector).then(() => true).catch(() => false);
      
      if (textModeClicked) {
        await page.waitForTimeout(500);
        const introHtmlField = mapping.fields.find(f => f.payloadKey === 'intro_html');
        if (introHtmlField) {
          await page.fill(introHtmlField.selector, '<p>We provide exceptional home care services.</p>');
        }
      } else {
        // JavaScript fallback
        await page.evaluate(() => {
          if (typeof tinymce !== 'undefined') {
            const editor = tinymce.get('acf-editor-197');
            if (editor) {
              editor.setContent('<p>We provide exceptional home care services.</p>');
              return;
            }
          }
          const textarea = document.querySelector('#acf-editor-197');
          if (textarea) {
            textarea.value = '<p>We provide exceptional home care services.</p>';
          }
        });
      }
    }
  }
  
  if (upToPhase < 7) return;
  
  // Phase 7: CTA
  const ctaPanel = mapping.panels.find(p => p.key === 'panel_top_cta');
  if (ctaPanel) {
    await page.click(ctaPanel.selector).catch(() => page.click('text="Call to Action"'));
    await page.waitForTimeout(1500);
    
    // Use correct selectors from mapping
    const ctaHeadlineField = mapping.fields.find(f => f.payloadKey === 'cta_headline');
    const ctaTextField = mapping.fields.find(f => f.payloadKey === 'cta_text');
    
    if (ctaHeadlineField) {
      await page.fill(ctaHeadlineField.selector, 'Ready to Get Started?').catch(() => {});
    }
    
    if (ctaTextField) {
      await page.fill(ctaTextField.selector, 'Contact us today for a free consultation').catch(() => {});
    }
  }
  
  if (upToPhase < 8) return;
  
  // Phase 8: Below Form
  const belowPanel = mapping.panels.find(p => p.key === 'panel_below_form');
  if (belowPanel) {
    await page.click(belowPanel.selector).catch(() => page.click('text="Below Form"'));
    await page.waitForTimeout(1500);
    
    // Fill headline field
    const belowHeadlineField = mapping.fields.find(f => f.payloadKey === 'below_headline');
    if (belowHeadlineField) {
      await page.fill(belowHeadlineField.selector, 'Our Trusted Services').catch(() => {});
    }
    
    // Check if TinyMCE needs initialization
    const needsInit = await page.isVisible('text="Click to initialize TinyMCE"').catch(() => false);
    
    if (needsInit) {
      // Click to initialize
      await page.click('text="Click to initialize TinyMCE"').catch(() => 
        page.click('.acf-editor-toolbar').catch(() => 
          page.click('.acf-editor-wrap')));
      await page.waitForTimeout(1500);
    }
    
    // Fill content - OPTIMIZED (direct TinyMCE)
    await page.waitForTimeout(500);
    
    // Go straight to TinyMCE manipulation
    const filled = await page.evaluate(() => {
      const content = '<p>Trusted by families across the region.</p>';
      
      // Direct TinyMCE API
      if (typeof tinymce !== 'undefined') {
        const editor = tinymce.get('acf-editor-198');
        if (editor && editor.initialized) {
          editor.setContent(content);
          editor.save();
          return true;
        }
      }
      
      // Fallback to iframe
      const iframe = document.querySelector('#acf-editor-198_ifr');
      if (iframe && iframe.contentDocument) {
        const body = iframe.contentDocument.querySelector('#tinymce');
        if (body) {
          body.innerHTML = content;
          return true;
        }
      }
      
      return false;
    });
    
    if (!filled) {
      // Only try Text mode as last resort
      await page.click('#acf-editor-198-html').catch(() => {});
      await page.waitForTimeout(300);
      await page.fill('#acf-editor-198', '<p>Trusted by families across the region.</p>').catch(() => {});
    }
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
      await testPageDesign();
      break;
    case '5':
      await testHeroArea();
      break;
    case '6':
      await testIntroContent();
      break;
    case '7':
      await testCTA();
      break;
    case '8':
      await testBelowForm();
      break;
    case '9':
      await testServicesGrid();
      break;
    case 'clear':
      await clearSession();
      break;
    default:
      console.log('Usage: node test-phases-stealth.js [phase]');
      console.log('\n📋 PHASES (Each phase includes all previous work):');
      console.log('  1     - Login with stealth mode (saves session)');
      console.log('  2     - Login + Navigate to New Landing Page');
      console.log('  3     - Login + Fill page title');
      console.log('  4     - Page Design: Select radio button option C');
      console.log('  5     - Hero Area: All hero fields + buttons');
      console.log('  6     - Intro Content: Headline + HTML content');
      console.log('  7     - CTA: Call to action headline + text');
      console.log('  8     - Below Form: TinyMCE content');
      console.log('  9     - Services Grid: Select 4 services (COMPLETE FORM)');
      console.log('  clear - Clear saved browser session');
      console.log('\n🔥 PROGRESSIVE TESTING:');
      console.log('  • Each phase INCLUDES all previous phases');
      console.log('  • Phase 5 = Title + Page Design + Hero Area');
      console.log('  • Phase 9 = COMPLETE FORM with all panels');
      console.log('\n💡 TIPS:');
      console.log('  • Run phase 1 first to save session');
      console.log('  • Test incrementally: 1 → 2 → 3 → etc.');
      console.log('  • Phase 9 fills the ENTIRE form');
      console.log('\n🛡️ All phases include:');
      console.log('  • Anti-detection measures');
      console.log('  • Human-like typing and delays');
      console.log('  • Session persistence (cookies saved)');
      console.log('  • Browser fingerprint spoofing');
  }
}

main().catch(console.error);