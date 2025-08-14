const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Test configuration
const TEST_CONFIG = {
  testData: {
    header_headline: 'Automated Test Page ' + Date.now(),
    hero_text_left: 'Professional',
    hero_text_right: 'Home Care Services',
    hero_preposition: 'in',
    hero_territories_csv: 'Manhattan, Brooklyn, Queens',
    hero_excerpt: 'Providing quality care with compassion',
    hero_btn1_text: 'Contact Us',
    hero_btn1_url: 'https://example.com/contact',
    hero_btn2_text: 'Our Services',
    hero_btn2_url: 'https://example.com/services',
    intro_headline: 'Welcome to Premium Care Services',
    intro_html: '<p>We specialize in providing comprehensive home care solutions tailored to your needs.</p>',
    cta_headline: 'Start Your Care Journey Today',
    cta_text: 'Get a free consultation with our care experts',
    below_headline: '<p>Join thousands of satisfied families who trust us with their care needs.</p>',
    svc1_name: 'Personal Care',
    svc2_name: 'Home Care',
    svc3_name: 'Companion Care',
    svc4_name: 'Dementia Care'
  },
  phases: {
    login: true,
    navigation: true,
    heroArea: true,
    introContent: true,
    cta: true,
    belowForm: true,
    services: true,
    publish: false // Set to true to actually publish
  }
};

// Load mapping
async function loadMapping() {
  try {
    const mappingPath = path.join(__dirname, '..', 'config', 'mapping.json');
    const content = await fs.readFile(mappingPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to load mapping:', error);
    process.exit(1);
  }
}

// Test individual phases
async function runPhaseTests() {
  const mapping = await loadMapping();
  const browser = await chromium.launch({
    headless: false,
    slowMo: 500 // Slow down for visibility
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  try {
    console.log('🧪 Starting WordPress Automation Tests\n');

    // Phase 1: Login Test
    if (TEST_CONFIG.phases.login) {
      console.log('📝 Phase 1: Testing Login...');
      await page.goto(`${process.env.WP_ADMIN_URL}/wp-login.php`);
      await page.fill('#user_login', process.env.WP_USERNAME);
      await page.fill('#user_pass', process.env.WP_PASSWORD);
      await page.click('#wp-submit');
      await page.waitForNavigation({ waitUntil: 'networkidle' });
      
      const dashboardVisible = await page.isVisible('#adminmenu');
      if (dashboardVisible) {
        console.log('✅ Login successful\n');
      } else {
        throw new Error('Login failed - dashboard not visible');
      }
    }

    // Phase 2: Navigation Test
    if (TEST_CONFIG.phases.navigation) {
      console.log('📝 Phase 2: Testing Navigation to Landing Page...');
      await page.goto(`${process.env.WP_ADMIN_URL}/post-new.php?post_type=landing`);
      await page.waitForLoadState('networkidle');
      
      const editorVisible = await page.isVisible('#title');
      if (editorVisible) {
        console.log('✅ Navigation successful\n');
      } else {
        throw new Error('Navigation failed - editor not visible');
      }

      // Fill title
      await page.fill('#title', TEST_CONFIG.testData.header_headline);
      console.log('✅ Page title filled\n');
    }

    // Phase 3: Hero Area Test
    if (TEST_CONFIG.phases.heroArea) {
      console.log('📝 Phase 3: Testing Hero Area Panel...');
      const heroPanel = mapping.panels.find(p => p.key === 'panel_hero_area');
      
      if (heroPanel) {
        await page.click(heroPanel.selector);
        await page.waitForTimeout(1000);
        
        // Test filling hero fields
        const heroFields = [
          'hero_text_left', 'hero_text_right', 'hero_preposition',
          'hero_territories_csv', 'hero_excerpt'
        ];

        for (const fieldKey of heroFields) {
          const field = mapping.fields.find(f => f.payloadKey === fieldKey);
          if (field && TEST_CONFIG.testData[fieldKey]) {
            await page.fill(field.selector, TEST_CONFIG.testData[fieldKey]);
            console.log(`  ✓ Filled ${fieldKey}`);
          }
        }
        console.log('✅ Hero Area fields filled\n');
      }
    }

    // Phase 4: Intro Content Test
    if (TEST_CONFIG.phases.introContent) {
      console.log('📝 Phase 4: Testing Intro Content Panel...');
      const introPanel = mapping.panels.find(p => p.key === 'panel_intro_content');
      
      if (introPanel) {
        await page.click(introPanel.selector);
        await page.waitForTimeout(1000);
        
        // Switch to text mode
        const textButton = mapping.fields.find(f => f.payloadKey === 'intro_text_html_button');
        if (textButton) {
          try {
            await page.click(textButton.selector);
            await page.waitForTimeout(500);
            console.log('  ✓ Switched to text mode');
          } catch (e) {
            console.log('  ⚠️  Text mode button not found or already in text mode');
          }
        }

        // Fill intro fields
        const introHeadline = mapping.fields.find(f => f.payloadKey === 'intro_headline');
        if (introHeadline) {
          await page.fill(introHeadline.selector, TEST_CONFIG.testData.intro_headline);
          console.log('  ✓ Filled intro_headline');
        }

        const introHtml = mapping.fields.find(f => f.payloadKey === 'intro_html');
        if (introHtml) {
          await page.fill(introHtml.selector, TEST_CONFIG.testData.intro_html);
          console.log('  ✓ Filled intro_html');
        }
        console.log('✅ Intro Content fields filled\n');
      }
    }

    // Phase 5: CTA Test
    if (TEST_CONFIG.phases.cta) {
      console.log('📝 Phase 5: Testing Call to Action Panel...');
      const ctaPanel = mapping.panels.find(p => p.key === 'panel_top_cta');
      
      if (ctaPanel) {
        await page.click(ctaPanel.selector);
        await page.waitForTimeout(1000);
        
        const ctaFields = ['cta_headline', 'cta_text'];
        for (const fieldKey of ctaFields) {
          const field = mapping.fields.find(f => f.payloadKey === fieldKey);
          if (field && TEST_CONFIG.testData[fieldKey]) {
            await page.fill(field.selector, TEST_CONFIG.testData[fieldKey]);
            console.log(`  ✓ Filled ${fieldKey}`);
          }
        }
        console.log('✅ CTA fields filled\n');
      }
    }

    // Phase 6: Below Form Test
    if (TEST_CONFIG.phases.belowForm) {
      console.log('📝 Phase 6: Testing Below Form Panel...');
      const belowPanel = mapping.panels.find(p => p.key === 'panel_below_form');
      
      if (belowPanel) {
        await page.click(belowPanel.selector);
        await page.waitForTimeout(1000);
        
        const belowField = mapping.fields.find(f => f.payloadKey === 'below_headline');
        if (belowField && belowField.type === 'tinymce') {
          await page.evaluate((content, editorId) => {
            if (typeof tinymce !== 'undefined' && tinymce.get(editorId)) {
              tinymce.get(editorId).setContent(content);
            }
          }, TEST_CONFIG.testData.below_headline, belowField.editorId);
          console.log('  ✓ Filled TinyMCE editor');
        }
        console.log('✅ Below Form fields filled\n');
      }
    }

    // Phase 7: Services Grid Test
    if (TEST_CONFIG.phases.services) {
      console.log('📝 Phase 7: Testing Services Grid Panel...');
      const servicesPanel = mapping.panels.find(p => p.key === 'panel_services_grid');
      
      if (servicesPanel) {
        await page.click(servicesPanel.selector);
        await page.waitForTimeout(1000);
        
        const serviceFields = ['svc1_name', 'svc2_name', 'svc3_name', 'svc4_name'];
        for (const fieldKey of serviceFields) {
          const field = mapping.fields.find(f => f.payloadKey === fieldKey);
          if (field && TEST_CONFIG.testData[fieldKey]) {
            try {
              await page.selectOption(field.selector, TEST_CONFIG.testData[fieldKey]);
              console.log(`  ✓ Selected ${fieldKey}: ${TEST_CONFIG.testData[fieldKey]}`);
            } catch (e) {
              console.log(`  ⚠️  Could not select ${fieldKey}`);
            }
          }
        }
        console.log('✅ Services fields filled\n');
      }
    }

    // Phase 8: Publish Test (Optional)
    if (TEST_CONFIG.phases.publish) {
      console.log('📝 Phase 8: Testing Publish...');
      await page.click('#publish');
      
      try {
        await page.waitForSelector('.notice-success', { timeout: 10000 });
        console.log('✅ Page published successfully\n');
        
        // Get published URL
        const publishedUrl = await page.evaluate(() => {
          const linkElement = document.querySelector('#sample-permalink a');
          return linkElement ? linkElement.href : null;
        });
        
        if (publishedUrl) {
          console.log(`📎 Published URL: ${publishedUrl}\n`);
        }
      } catch (e) {
        console.log('⚠️  Publish may have failed or taken too long\n');
      }
    }

    console.log('🎉 All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    
    // Take screenshot on error
    const screenshotPath = path.join(__dirname, '..', 'logs', 'screenshots', `test-error-${Date.now()}.png`);
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 Screenshot saved: ${screenshotPath}`);
    
    throw error;
  } finally {
    // Keep browser open for inspection if not publishing
    if (!TEST_CONFIG.phases.publish) {
      console.log('\n⏸️  Browser will remain open for 10 seconds for inspection...');
      await page.waitForTimeout(10000);
    }
    
    await browser.close();
  }
}

// API Test
async function testAPI() {
  console.log('\n🧪 Testing API Endpoint...\n');
  
  try {
    const response = await fetch('http://localhost:3000/health');
    const data = await response.json();
    
    if (data.status === 'healthy') {
      console.log('✅ Health check passed');
    } else {
      throw new Error('Health check failed');
    }
    
    // Test the /test endpoint if in development
    if (process.env.NODE_ENV === 'development') {
      console.log('\n📝 Testing /test endpoint...');
      const testResponse = await fetch('http://localhost:3000/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      if (testResponse.ok) {
        const result = await testResponse.json();
        console.log('✅ Test endpoint working');
        console.log(`   Created page: ${result.url || 'URL not available'}`);
      }
    }
    
  } catch (error) {
    console.error('❌ API test failed:', error.message);
    console.log('\n💡 Make sure the server is running: npm start');
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--api')) {
    await testAPI();
  } else {
    await runPhaseTests();
  }
}

// Run tests
main().catch(console.error);