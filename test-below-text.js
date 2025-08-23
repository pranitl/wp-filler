const { chromium } = require('playwright');
const WordPressFormFiller = require('./src/form-filler');
const browserConfig = require('./src/browser-config');
require('dotenv').config();

async function testBelowTextFilling() {
  console.log('🧪 Testing Below Text Field HTML Mode Switch\n');
  
  // Simple test data focusing on the below_text field
  const testData = {
    "header_headline": "Test Page - HTML Mode Switch",
    "below_headline": "Test Below Headline",
    "below_text": "<p>This is <strong>HTML content</strong> with <em>formatting</em> and <a href='/test'>links</a>.</p><ul><li>Item 1</li><li>Item 2</li></ul>",
    "page_design": "c"
  };

  const browser = await chromium.launch({
    headless: true, // Run in headless mode for server environment
    slowMo: 100 // Slight delay for stability
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  
  const page = await context.newPage();

  try {
    // Login
    console.log('📝 Logging in...');
    await page.goto(`${process.env.WP_ADMIN_URL.replace('/index.php', '')}/wp-login.php`);
    await page.fill('#user_login', process.env.WP_USERNAME);
    await page.fill('#user_pass', process.env.WP_PASSWORD);
    await page.click('#wp-submit');
    await page.waitForLoadState('networkidle');
    
    console.log('✓ Logged in successfully\n');
    
    // Navigate to new landing page
    const formFiller = new WordPressFormFiller();
    await formFiller.navigateToNewLandingPage(page);
    console.log('✓ Navigated to new landing page\n');
    
    // Fill page title
    await formFiller.fillPageTitle(page, testData.header_headline);
    console.log('✓ Filled page title\n');
    
    // Select page design
    await formFiller.selectPageDesign(page, testData.page_design);
    console.log('✓ Selected page design\n');
    
    // Now test the Below Form panel specifically
    console.log('📋 Testing Below Form panel with HTML mode switch...\n');
    await formFiller.fillBelowForm(page, testData);
    
    // Wait a bit to see the result
    await page.waitForTimeout(3000);
    
    // Check if the content was filled correctly
    const filledContent = await page.evaluate(() => {
      const textarea = document.querySelector('#acf-editor-199');
      if (textarea) {
        return {
          isVisible: textarea.style.display !== 'none',
          content: textarea.value,
          wrapperClasses: document.querySelector('#wp-acf-editor-199-wrap')?.className
        };
      }
      return null;
    });
    
    if (filledContent) {
      console.log('\n✅ Test Results:');
      console.log('- Textarea visible:', filledContent.isVisible);
      console.log('- Editor mode:', filledContent.wrapperClasses?.includes('html-active') ? 'HTML' : 'Visual');
      console.log('- Content filled:', filledContent.content?.length > 0 ? 'Yes' : 'No');
      console.log('- Content preview:', filledContent.content?.substring(0, 100) + '...');
    } else {
      console.log('\n❌ Could not verify the filled content');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    await page.screenshot({ path: 'test-below-text-error.png' });
    console.log('📸 Error screenshot saved as test-below-text-error.png');
  } finally {
    // Close browser after test
    await browser.close();
    console.log('\n✅ Test completed');
  }
}

testBelowTextFilling().catch(console.error);