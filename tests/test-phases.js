const { chromium } = require('playwright');
require('dotenv').config();

// PHASE 1: Just test login
async function testLoginOnly() {
  console.log('🔐 Testing WordPress Login ONLY...\n');
  
  const browser = await chromium.launch({
    headless: false,  // Keep browser visible
    slowMo: 1000      // Slow down actions so you can see them
  });

  const page = await browser.newPage();

  try {
    // Navigate to login page
    console.log('📍 Going to: ' + process.env.WP_ADMIN_URL + '/wp-login.php');
    await page.goto(`${process.env.WP_ADMIN_URL}/wp-login.php`);
    
    // Fill login form
    console.log('📝 Filling username...');
    await page.fill('#user_login', process.env.WP_USERNAME);
    
    console.log('📝 Filling password...');
    await page.fill('#user_pass', process.env.WP_PASSWORD);
    
    console.log('🖱️ Clicking login button...');
    await page.click('#wp-submit');
    
    // Wait for navigation
    console.log('⏳ Waiting for dashboard to load...');
    await page.waitForNavigation({ waitUntil: 'networkidle' });
    
    // Check if we're logged in
    const dashboardVisible = await page.isVisible('#adminmenu');
    if (dashboardVisible) {
      console.log('✅ SUCCESS! Logged in to WordPress!\n');
      console.log('You should see the WordPress dashboard.');
    } else {
      console.log('❌ FAILED! Could not see dashboard menu.');
      console.log('Check your credentials in .env file');
    }
    
    console.log('\n⏸️  Keeping browser open for 10 seconds...');
    await page.waitForTimeout(10000);
    
  } catch (error) {
    console.error('❌ Error during login:', error.message);
  } finally {
    await browser.close();
  }
}

// PHASE 2: Login + Navigate to new landing page
async function testLoginAndNavigate() {
  console.log('🔐 Testing Login + Navigation to Landing Page...\n');
  
  const browser = await chromium.launch({
    headless: false,
    slowMo: 500
  });

  const page = await browser.newPage();

  try {
    // Login
    console.log('📍 Logging in...');
    await page.goto(`${process.env.WP_ADMIN_URL}/wp-login.php`);
    await page.fill('#user_login', process.env.WP_USERNAME);
    await page.fill('#user_pass', process.env.WP_PASSWORD);
    await page.click('#wp-submit');
    await page.waitForNavigation({ waitUntil: 'networkidle' });
    console.log('✅ Logged in successfully');
    
    // Navigate to new landing page
    console.log('\n📍 Navigating to new landing page...');
    await page.goto(`${process.env.WP_ADMIN_URL}/post-new.php?post_type=landing`);
    await page.waitForLoadState('networkidle');
    
    // Check if editor is visible
    const editorVisible = await page.isVisible('#title');
    if (editorVisible) {
      console.log('✅ SUCCESS! Landing page editor loaded!');
      console.log('You should see the landing page creation form.');
    } else {
      console.log('❌ FAILED! Could not find title field.');
      console.log('Check if "landing" post type exists.');
    }
    
    console.log('\n⏸️  Keeping browser open for 10 seconds...');
    await page.waitForTimeout(10000);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

// PHASE 3: Login + Fill Header/Title
async function testFillHeader() {
  console.log('🔐 Testing Login + Fill Page Title...\n');
  
  const browser = await chromium.launch({
    headless: false,
    slowMo: 500
  });

  const page = await browser.newPage();

  try {
    // Login
    console.log('📍 Logging in...');
    await page.goto(`${process.env.WP_ADMIN_URL}/wp-login.php`);
    await page.fill('#user_login', process.env.WP_USERNAME);
    await page.fill('#user_pass', process.env.WP_PASSWORD);
    await page.click('#wp-submit');
    await page.waitForNavigation({ waitUntil: 'networkidle' });
    
    // Navigate to new landing page
    console.log('📍 Going to new landing page...');
    await page.goto(`${process.env.WP_ADMIN_URL}/post-new.php?post_type=landing`);
    await page.waitForLoadState('networkidle');
    
    // Fill the title
    const testTitle = 'Test Landing Page - ' + new Date().toLocaleString();
    console.log(`\n📝 Filling page title: "${testTitle}"`);
    await page.fill('#title', testTitle);
    
    console.log('✅ SUCCESS! Title filled!');
    console.log('You should see the title in the page title field.');
    
    console.log('\n⏸️  Keeping browser open for 15 seconds...');
    await page.waitForTimeout(15000);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

// PHASE 4: Full test with Hero Area fields
async function testHeroArea() {
  console.log('🔐 Testing Full Hero Area Panel...\n');
  
  const browser = await chromium.launch({
    headless: false,
    slowMo: 500
  });

  const page = await browser.newPage();

  try {
    // Login and navigate
    console.log('📍 Logging in and navigating...');
    await page.goto(`${process.env.WP_ADMIN_URL}/wp-login.php`);
    await page.fill('#user_login', process.env.WP_USERNAME);
    await page.fill('#user_pass', process.env.WP_PASSWORD);
    await page.click('#wp-submit');
    await page.waitForNavigation({ waitUntil: 'networkidle' });
    
    await page.goto(`${process.env.WP_ADMIN_URL}/post-new.php?post_type=landing`);
    await page.waitForLoadState('networkidle');
    
    // Fill title
    await page.fill('#title', 'Test Page with Hero - ' + Date.now());
    
    // Click Hero Area tab
    console.log('\n🖱️ Clicking Hero Area tab...');
    // Try different selectors for the Hero tab
    const heroSelectors = [
      '#acf-group_62f544c0a7ba2 > div.inside.acf-fields.-top.-sidebar > div.acf-tab-wrap.-left > ul > li:first-child > a',
      'a[data-key="field_62f54631a1cf0"]',  // Alternative selector
      '.acf-tab-button:first-child'          // Another alternative
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
    
    // Fill Hero fields
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
    // Take screenshot on error
    await page.screenshot({ path: 'error-screenshot.png', fullPage: true });
    console.log('📸 Screenshot saved as error-screenshot.png');
  } finally {
    await browser.close();
  }
}

// Choose which test to run based on command line argument
async function main() {
  const testPhase = process.argv[2] || '1';
  
  console.log('='.repeat(50));
  console.log('WP FILLER - PHASE TESTING');
  console.log('='.repeat(50) + '\n');
  
  switch(testPhase) {
    case '1':
      await testLoginOnly();
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
    default:
      console.log('Usage: node test-phases.js [phase]');
      console.log('Phases:');
      console.log('  1 - Test login only');
      console.log('  2 - Test login + navigate to landing page');
      console.log('  3 - Test login + fill page title');
      console.log('  4 - Test Hero Area panel and fields');
  }
}

main().catch(console.error);