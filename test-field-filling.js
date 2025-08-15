const { chromium } = require('playwright');
const WordPressFormFiller = require('./src/form-filler');
const browserConfig = require('./src/browser-config');
require('dotenv').config();

async function testFieldFilling() {
  console.log('🧪 Testing Field Filling with Your JSON Data\n');
  
  // Your exact JSON data
  const testData = {
    "nc_order": 10,
    "header_headline": "Cost of In‑Home Dementia Care in Belmont",
    "hero_text_left": "Dementia Care Cost Guide",
    "hero_text_right": "Belmont, MA",
    "hero_preposition": "in",
    "hero_territories_csv": "",
    "hero_excerpt": "Transparent rates and guidance for home-based dementia care in Belmont. No weekly minimums, 24/7 support, and dementia‑trained caregivers.",
    "hero_btn1_text": "Call for a Quote",
    "hero_btn1_url": "[fl_landing_phone]",
    "hero_btn2_text": "Compare Care Options",
    "hero_btn2_url": "/home-care-services/dementia-care/",
    "intro_headline": "What Does Dementia Care Cost in Belmont?",
    "intro_html": "<p>Planning for Dementia Care in Belmont starts with clear numbers and honest guidance. We make costs predictable with <strong>no weekly minimums</strong>, <strong>24/7 availability</strong>, and <strong>dementia‑trained</strong> caregivers. Most families choose hourly support at first, then add <a href=\"/home-care-services/respite-care/\">respite care</a> or transition to <a href=\"/home-care-services/live-in-care/\">live‑in care</a> as needs change. We'll design a plan around your budget and goals—from a few hours a week to round‑the‑clock support—with transparent rates and no surprises. Care can include discreet <a href=\"/home-care-services/personal-care/\">personal care</a>, medication reminders, and cognitive activities within our personalized <a href=\"/home-care-services/dementia-care/\">dementia care</a> approach.</p>",
    "cta_headline": "Get Your Custom Quote Today",
    "cta_text": "Call [fl_landing_phone] for your free in‑home consultation and custom quote. Fast estimates, 24/7 availability, and start of service in days.",
    "below_headline": "Transparent Pricing, Local Expertise",
    "below_text": "You deserve straight answers on cost. In-home dementia care in Belmont/Middlesex County typically ranges from $45–$55 per hour, based on care level, hours per week, and overnights. Live-in support is available at a flat daily rate. Compared with memory care facilities ($8,000–$12,000/month), home care can be a flexible, affordable path.\n\nWhat's included in our rate:\n- *Fully insured, dementia-trained caregivers*\n- *Care plan oversight and scheduling support*\n- *No hidden fees and no weekly minimums*\n- *24/7 on-call coverage*\n\nHow to pay for in-home dementia care in MA: Most families use private pay. We accept and help manage Long-Term Care Insurance benefits. Medicare does not cover non-medical long-term home care [extlink:Medicare.gov]. For a broader view of the cost of dementia care in Massachusetts, see the annual state data in the [extlink:Genworth Cost of Care Survey]. Veterans may qualify for benefits—learn more about our [intlink:Veteran care|/home-care-services/veteran-care/]. Explore [intlink:dementia care|/home-care-services/dementia-care/], [intlink:respite care|/home-care-services/respite-care/], and [intlink:live-in care|/home-care-services/live-in-care/] to fit your budget for private dementia care in Belmont.",
    "bottom_cta_headline": "See How Care Fits Your Budget",
    "bottom_cta_link_text": "Explore Dementia Care",
    "bottom_cta_link_url": "/home-care-services/dementia-care/",
    "svc1_name": "Dementia Care",
    "svc2_name": "Personal Care",
    "svc3_name": "Respite Care",
    "svc4_name": "Live-In Care",
    "Status": "New",
    "DraftURL": null,
    "page_design": "c"
  };

  const savedState = await browserConfig.loadState();
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
      await page.goto(`${process.env.WP_ADMIN_URL}/wp-login.php`);
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
    
    // Use the form filler
    const formFiller = new WordPressFormFiller();
    
    console.log('\n📋 Starting form filling with your exact JSON data...\n');
    console.log('Fields to be filled:');
    console.log('✓ Title: ' + testData.header_headline);
    console.log('✓ Page Design: Option C');
    console.log('✓ Hero Area: All fields');
    console.log('✓ Intro Content: Headline + HTML');
    console.log('✓ CTA: ' + testData.cta_headline);
    console.log('✓ Below Form Headline: ' + testData.below_headline);
    console.log('✓ Below Form Text: ' + (testData.below_text ? 'Yes (plain text)' : 'No'));
    console.log('✓ Services: ' + [testData.svc1_name, testData.svc2_name, testData.svc3_name, testData.svc4_name].filter(Boolean).join(', '));
    console.log('✓ Bottom CTA: ' + testData.bottom_cta_headline);
    console.log('✓ Bottom CTA Link: ' + testData.bottom_cta_link_url);
    console.log('\n');
    
    const result = await formFiller.fillCompleteForm(page, testData);
    
    if (result.success) {
      console.log('\n✅ SUCCESS! Form filled successfully!');
      if (result.previewUrl) {
        console.log('📄 Preview URL: ' + result.previewUrl);
      }
      
      // Take a screenshot to verify
      await page.screenshot({ path: 'filled-form-verification.png', fullPage: true });
      console.log('📸 Screenshot saved as filled-form-verification.png');
      
      // Verify specific fields were filled
      console.log('\n🔍 Verifying critical fields...');
      
      // Check Below Form fields specifically
      const belowHeadlineValue = await page.$eval('#acf-field_091kfmjg85g1g', el => el.value).catch(() => null);
      if (belowHeadlineValue === testData.below_headline) {
        console.log('✅ Below Form Headline: VERIFIED');
      } else {
        console.log(`❌ Below Form Headline: Expected "${testData.below_headline}", got "${belowHeadlineValue}"`);
      }
      
      // Check Below Form content
      const belowContentValue = await page.$eval('#acf-editor-198', el => el.value).catch(() => null);
      if (belowContentValue && belowContentValue.includes('Transparent Pricing')) {
        console.log('✅ Below Form Text: VERIFIED (contains expected content)');
        console.log('   Content preview:', belowContentValue.substring(0, 100) + '...');
      } else {
        console.log('❌ Below Form Text: NOT VERIFIED');
        console.log('   Got:', belowContentValue ? belowContentValue.substring(0, 100) + '...' : 'null');
      }
      
      // Check Bottom CTA headline
      const bottomCTAValue = await page.$eval('#acf-field_62f568766405e', el => el.value).catch(() => null);
      if (bottomCTAValue === testData.bottom_cta_headline) {
        console.log('✅ Bottom CTA Headline: VERIFIED');
      } else {
        console.log(`❌ Bottom CTA Headline: Expected "${testData.bottom_cta_headline}", got "${bottomCTAValue}"`);
      }
      
    } else {
      console.log('❌ Form filling failed!');
    }
    
    console.log('\n⏸️  Keeping browser open for 30 seconds to inspect...');
    await page.waitForTimeout(30000);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: 'test-error.png', fullPage: true });
    console.log('📸 Error screenshot saved as test-error.png');
  } finally {
    await browserConfig.saveState(context);
    await browser.close();
  }
}

testFieldFilling().catch(console.error);