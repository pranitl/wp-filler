const { chromium } = require('playwright');
require('dotenv').config();

async function diagnoseLogin() {
  console.log('🔍 WordPress Login Diagnostics\n');
  console.log('='.repeat(50));
  console.log('This tool will help identify why WordPress might be');
  console.log('requiring additional verification.\n');
  
  const browser = await chromium.launch({
    headless: false,
    slowMo: 500
  });

  const page = await browser.newPage();
  
  console.log('📊 Browser Information:');
  
  try {
    // Navigate to a test page that shows browser info
    await page.goto('https://bot.sannysoft.com/', { waitUntil: 'networkidle' });
    
    // Check various detection points
    const results = await page.evaluate(() => {
      const tests = {};
      
      // Check for webdriver
      tests.webdriver = navigator.webdriver;
      
      // Check user agent
      tests.userAgent = navigator.userAgent;
      
      // Check plugins
      tests.pluginsLength = navigator.plugins.length;
      
      // Check Chrome
      tests.hasChrome = !!window.chrome;
      
      // Check permissions
      tests.hasPermissions = !!navigator.permissions;
      
      // Check languages
      tests.languages = navigator.languages;
      
      // Check hardware concurrency
      tests.hardwareConcurrency = navigator.hardwareConcurrency;
      
      // Check screen resolution
      tests.screen = {
        width: screen.width,
        height: screen.height,
        colorDepth: screen.colorDepth
      };
      
      return tests;
    });
    
    console.log('\nDetection Test Results:');
    console.log('------------------------');
    console.log(`✓ Webdriver Flag: ${results.webdriver === undefined ? '✅ Hidden' : '❌ Exposed (' + results.webdriver + ')'}`);
    console.log(`✓ User Agent: ${results.userAgent.includes('HeadlessChrome') ? '❌ Headless detected' : '✅ Normal browser'}`);
    console.log(`✓ Plugins: ${results.pluginsLength > 0 ? '✅ ' + results.pluginsLength + ' plugins' : '❌ No plugins (suspicious)'}`);
    console.log(`✓ Chrome Object: ${results.hasChrome ? '✅ Present' : '❌ Missing'}`);
    console.log(`✓ Languages: ${results.languages.length > 0 ? '✅ ' + results.languages.join(', ') : '❌ Empty'}`);
    console.log(`✓ CPU Cores: ${results.hardwareConcurrency || 'Not detected'}`);
    console.log(`✓ Screen: ${results.screen.width}x${results.screen.height} @ ${results.screen.colorDepth}bit`);
    
    // Now test WordPress login
    console.log('\n📍 Testing WordPress Login Page...\n');
    await page.goto(`${process.env.WP_ADMIN_URL}/wp-login.php`, { waitUntil: 'networkidle' });
    
    // Check for security plugins or verification
    const pageContent = await page.content();
    const pageText = await page.innerText('body');
    
    console.log('🔒 Security Detection:');
    console.log('---------------------');
    
    // Check for common security plugins
    const securityPlugins = [
      { name: 'Wordfence', patterns: ['wordfence', 'wf-', 'wflogin'] },
      { name: 'Sucuri', patterns: ['sucuri', 'sucuriscan'] },
      { name: 'iThemes Security', patterns: ['itsec', 'ithemes-security'] },
      { name: 'All In One WP Security', patterns: ['aiowps', 'aio-wp-security'] },
      { name: 'Jetpack', patterns: ['jetpack', 'jp-'] },
      { name: 'WP Cerber', patterns: ['cerber', 'wp-cerber'] },
      { name: 'Shield Security', patterns: ['shield', 'icwp'] },
      { name: 'Cloudflare', patterns: ['cloudflare', 'cf-'] }
    ];
    
    const detectedPlugins = [];
    for (const plugin of securityPlugins) {
      const detected = plugin.patterns.some(pattern => 
        pageContent.toLowerCase().includes(pattern) || 
        pageText.toLowerCase().includes(pattern)
      );
      if (detected) {
        detectedPlugins.push(plugin.name);
      }
    }
    
    if (detectedPlugins.length > 0) {
      console.log(`⚠️  Detected Security: ${detectedPlugins.join(', ')}`);
    } else {
      console.log('✅ No obvious security plugins detected');
    }
    
    // Check for verification messages
    const verificationKeywords = [
      'verification', 'verify', 'authenticate', 'captcha', 'recaptcha',
      'two-factor', '2fa', 'security check', 'human', 'robot', 'bot'
    ];
    
    const foundKeywords = verificationKeywords.filter(keyword => 
      pageText.toLowerCase().includes(keyword)
    );
    
    if (foundKeywords.length > 0) {
      console.log(`⚠️  Verification Keywords Found: ${foundKeywords.join(', ')}`);
    } else {
      console.log('✅ No verification keywords found');
    }
    
    // Check for hidden fields (honeypots)
    const hiddenInputs = await page.$$eval('input[type="hidden"]', inputs => 
      inputs.map(input => ({ name: input.name, id: input.id }))
    );
    
    if (hiddenInputs.length > 2) { // More than just wpnonce and redirect
      console.log(`⚠️  ${hiddenInputs.length} hidden fields found (possible honeypots)`);
    }
    
    // Check cookies
    const cookies = await page.context().cookies();
    console.log(`\n🍪 Cookies: ${cookies.length} cookies set`);
    
    // Check for rate limiting messages
    if (pageText.toLowerCase().includes('too many') || 
        pageText.toLowerCase().includes('rate limit') ||
        pageText.toLowerCase().includes('try again')) {
      console.log('⚠️  Possible rate limiting detected');
    }
    
    console.log('\n💡 Recommendations:');
    console.log('------------------');
    
    if (results.webdriver !== undefined) {
      console.log('1. Use stealth mode script (test-phases-stealth.js)');
    }
    
    if (detectedPlugins.length > 0) {
      console.log('2. Security plugins detected. You may need to:');
      console.log('   - Whitelist your IP address in the security plugin');
      console.log('   - Temporarily disable bot protection');
      console.log('   - Add your server IP to trusted sources');
    }
    
    if (foundKeywords.includes('captcha') || foundKeywords.includes('recaptcha')) {
      console.log('3. CAPTCHA detected. Options:');
      console.log('   - Disable CAPTCHA for admin users');
      console.log('   - Whitelist your IP from CAPTCHA');
      console.log('   - Use CAPTCHA solving service (advanced)');
    }
    
    if (foundKeywords.includes('two-factor') || foundKeywords.includes('2fa')) {
      console.log('4. Two-Factor Authentication detected:');
      console.log('   - Create application-specific password');
      console.log('   - Temporarily disable 2FA for testing');
      console.log('   - Use backup codes if available');
    }
    
    console.log('\n📝 WordPress Admin Settings to Check:');
    console.log('------------------------------------');
    console.log('1. Settings → General → Membership (should be unchecked)');
    console.log('2. Users → Your Profile → Application Passwords');
    console.log('3. Security Plugin Settings → Whitelisted IPs');
    console.log('4. Security Plugin Settings → Bot Protection');
    console.log('5. .htaccess file for IP restrictions');
    
    console.log('\n⏸️  Browser will remain open for inspection...');
    await page.waitForTimeout(30000);
    
  } catch (error) {
    console.error('❌ Error during diagnosis:', error.message);
  } finally {
    await browser.close();
  }
}

diagnoseLogin().catch(console.error);