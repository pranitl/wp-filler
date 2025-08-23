const { chromium } = require('playwright');
const WordPressFormFiller = require('./src/form-filler');
const browserConfig = require('./src/browser-config');
require('dotenv').config();

async function testBelowTextFilling() {
  console.log('🧪 Testing Below Text Field HTML Mode Switch\n');
  
  // Check required environment variables
  if (!process.env.WP_ADMIN_URL || !process.env.WP_USERNAME || !process.env.WP_PASSWORD) {
    console.error('❌ Missing required environment variables. Please create a .env file with:');
    console.error('WP_ADMIN_URL=your-wordpress-site-url/wp-admin');
    console.error('WP_USERNAME=your-username');
    console.error('WP_PASSWORD=your-password');
    return;
  }
  
  // Simple test data focusing on the below_text field
  const testData = {
    "header_headline": "Test Page - HTML Mode Switch",
    "below_headline": "Test Below Headline",
    "below_text": "<p>This is <strong>HTML content</strong> with <em>formatting</em> and <a href='/test'>links</a>.</p><ul><li>Item 1</li><li>Item 2</li></ul>",
    "page_design": "c"
  };

  const browser = await chromium.launch({
    headless: false, // Run with visible browser
    slowMo: 100 // Slight delay for stability
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  
  const page = await context.newPage();
  
  // Listen to console messages from the browser
  page.on('console', msg => {
    if (msg.type() === 'log') {
      console.log('Browser:', msg.text());
    }
  });

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
    
    // Check if the content was filled correctly - use the same detection logic as form filler
    const filledContent = await page.evaluate(() => {
      console.log('Test verification: Looking for filled content...');
      
      // Use the same logic as the form filler to find the editor
      const editorWraps = document.querySelectorAll('[id*="wp-acf-editor-"][id$="-wrap"]');
      console.log(`Test: Found ${editorWraps.length} wp-editor-wrap elements`);
      
      for (let wrap of editorWraps) {
        console.log(`Test: Checking wrap: ${wrap.id}`);
        const textarea = wrap.querySelector('textarea[id*="acf-editor-"]');
        if (textarea) {
          console.log(`Test: Found textarea: ${textarea.id}`);
          
          const fieldContainer = textarea.closest('.acf-field');
          if (fieldContainer) {
            const fieldName = fieldContainer.getAttribute('data-name');
            console.log(`Test: Field name: ${fieldName}`);
            
            if (fieldName && fieldName.includes('below')) {
              console.log(`Test: This is the below form editor`);
              return {
                isVisible: textarea.style.display !== 'none',
                content: textarea.value,
                wrapperClasses: wrap.className,
                editorId: textarea.id,
                fieldName: fieldName
              };
            }
          }
        }
      }
      
      console.log('Test: No suitable editor found for verification');
      return null;
    });
    
    if (filledContent) {
      console.log('\n✅ Test Results:');
      console.log('- Editor ID found:', filledContent.editorId);
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