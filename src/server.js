const express = require('express');
const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');
const winston = require('winston');
const Joi = require('joi');
const browserConfig = require('./browser-config');
const WordPressFormFiller = require('./form-filler');
require('dotenv').config();

// Configure Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    }),
    new winston.transports.File({ 
      filename: process.env.LOG_FILE || 'logs/wp-filler.log' 
    })
  ]
});

// Initialize queue variable
let queue;

// Initialize queue with dynamic import for ESM compatibility
async function initializeQueue() {
  if (!queue) {
    const PQueue = (await import('p-queue')).default;
    queue = new PQueue({ 
      concurrency: 3,  // Max 3 browser instances running simultaneously
    });

    // Add queue event logging for debugging
    queue.on('add', () => {
      logger.info(`Job added to queue. Size: ${queue.size}, Running: ${queue.pending}`);
    });

    queue.on('idle', () => {
      logger.info('Queue is idle - all jobs completed');
    });
    
    logger.info('Queue initialized successfully');
  }
  return queue;
}

// Validation schema for incoming payload
const payloadSchema = Joi.object({
  header_headline: Joi.string().required(),
  page_design: Joi.string().valid('a', 'b', 'c').allow(''),
  hero_text_left: Joi.string().allow(''),
  hero_text_right: Joi.string().allow(''),
  hero_preposition: Joi.string().max(2).allow(''),
  hero_territories_csv: Joi.string().allow(''),
  hero_excerpt: Joi.string().allow(''),
  hero_btn1_text: Joi.string().allow(''),
  hero_btn1_url: Joi.string().allow(''),
  hero_btn2_text: Joi.string().allow(''),
  hero_btn2_url: Joi.string().allow(''),
  intro_headline: Joi.string().allow(''),
  intro_html: Joi.string().allow(''),
  cta_headline: Joi.string().allow(''),
  cta_text: Joi.string().allow(''),
  below_headline: Joi.string().allow('', null).default(''),
  below_content: Joi.string().allow('', null).default(''),
  below_text: Joi.string().allow('', null).default(''), // Support both field names
  svc1_name: Joi.string().allow(''),
  svc2_name: Joi.string().allow(''),
  svc3_name: Joi.string().allow(''),
  svc4_name: Joi.string().allow(''),
  bottom_cta_headline: Joi.string().allow(''),
  bottom_cta_url: Joi.string().allow(''),
  bottom_cta_text: Joi.string().allow(''),
  bottom_cta_link_text: Joi.string().allow(''),
  bottom_cta_link_url: Joi.string().allow(''),
  // Extra fields that may be present but are ignored
  nc_order: Joi.number().allow(null),
  Status: Joi.string().allow('', null),
  DraftURL: Joi.string().allow('', null)
});

const app = express();
app.use(express.json({ limit: '10mb' }));

// Load mapping configuration
let mapping;
(async () => {
  try {
    const mappingPath = path.join(__dirname, '..', 'config', 'mapping.json');
    const mappingContent = await fs.readFile(mappingPath, 'utf8');
    mapping = JSON.parse(mappingContent);
    logger.info('Mapping configuration loaded successfully');
  } catch (error) {
    logger.error('Failed to load mapping configuration:', error);
    process.exit(1);
  }
})();

// Helper function to take screenshots
async function takeScreenshot(page, name) {
  if (process.env.SCREENSHOT_ON_ERROR === 'true') {
    const screenshotPath = path.join(
      process.env.SCREENSHOT_PATH || 'logs/screenshots',
      `${name}-${Date.now()}.png`
    );
    await page.screenshot({ path: screenshotPath, fullPage: true });
    logger.info(`Screenshot saved: ${screenshotPath}`);
  }
}

// Helper function to wait and click safely
async function safeClick(page, selector, name) {
  try {
    await page.waitForSelector(selector, { 
      timeout: parseInt(process.env.NAVIGATION_TIMEOUT) || 30000 
    });
    await page.click(selector);
    logger.debug(`Clicked: ${name}`);
  } catch (error) {
    logger.error(`Failed to click ${name}: ${error.message}`);
    await takeScreenshot(page, `error-click-${name}`);
    throw error;
  }
}

// Helper function to fill fields safely
async function safeFill(page, selector, value, name) {
  if (!value) return;
  try {
    await page.waitForSelector(selector, { 
      timeout: parseInt(process.env.NAVIGATION_TIMEOUT) || 30000 
    });
    await page.fill(selector, value);
    logger.debug(`Filled ${name}: ${value.substring(0, 50)}...`);
  } catch (error) {
    logger.error(`Failed to fill ${name}: ${error.message}`);
    await takeScreenshot(page, `error-fill-${name}`);
    throw error;
  }
}

// Main automation function - UPDATED to use modular form filler
async function createLandingPage(data) {
  // Use stealth browser configuration
  const browser = await chromium.launch(browserConfig.getBrowserConfig());

  // Load saved state if exists for session persistence
  const savedState = await browserConfig.loadState();
  const contextConfig = browserConfig.getContextConfig();
  if (savedState) {
    contextConfig.storageState = savedState;
    logger.info('Using saved browser session');
  }

  const context = await browser.newContext(contextConfig);
  
  // Apply stealth mode to context before creating page
  const { addHumanBehavior } = await browserConfig.applyStealthMode(context);
  
  const page = await context.newPage();
  
  // Initialize form filler
  const formFiller = new WordPressFormFiller();
  
  try {
    logger.info('Starting WordPress automation');
    
    // Add human-like behavior
    await addHumanBehavior(page);

    // Step 1: Check if already logged in (using saved session)
    logger.info('Navigating to WordPress admin...');
    await page.goto(process.env.WP_ADMIN_URL, { 
      waitUntil: 'domcontentloaded',
      timeout: 20000 
    });
    
    // Wait a bit for page to settle
    await page.waitForTimeout(2000);
    
    // Check if we're already logged in from saved session
    let dashboardVisible = await page.isVisible('#adminmenu').catch(() => false);
    
    // If not visible, check if we're on a different admin page
    if (!dashboardVisible) {
      const currentUrl = page.url();
      if (currentUrl.includes('/wp-admin/') && !currentUrl.includes('wp-login.php')) {
        dashboardVisible = true;
        logger.info('Already logged in via saved session');
      }
    }
    
    if (!dashboardVisible) {
      // Need to login
      logger.info('Logging in to WordPress');
      
      // Check if we're on login page or need to navigate there
      const currentUrl = page.url();
      if (!currentUrl.includes('wp-login.php') && !currentUrl.includes('wp-admin')) {
        await page.goto(`${process.env.WP_ADMIN_URL.replace('/wp-admin/index.php', '')}/wp-login.php`, {
          waitUntil: 'domcontentloaded',
          timeout: 20000
        });
        await page.waitForTimeout(2000);
      }
      
      // Clear any existing input first
      const userField = await page.$('#user_login');
      if (userField) {
        await userField.click({ clickCount: 3 });
        await page.keyboard.press('Backspace');
      }
      
      // Add more human-like delays and behavior
      await page.waitForTimeout(Math.random() * 1500 + 1000);
      
      // Move mouse randomly first
      await page.mouse.move(500, 300);
      await page.waitForTimeout(500);
      
      // Type username with human-like speed and variations
      await page.click('#user_login');
      await page.waitForTimeout(Math.random() * 500 + 300);
      
      for (const char of process.env.WP_USERNAME) {
        await page.keyboard.type(char);
        await page.waitForTimeout(Math.random() * 100 + 50);
      }
      
      await page.waitForTimeout(Math.random() * 800 + 400);
      
      // Move to password field
      await page.click('#user_pass');
      await page.waitForTimeout(Math.random() * 500 + 300);
      
      for (const char of process.env.WP_PASSWORD) {
        await page.keyboard.type(char);
        await page.waitForTimeout(Math.random() * 100 + 50);
      }
      
      // Check "Remember Me" checkbox
      const rememberMe = await page.$('#rememberme');
      if (rememberMe) {
        const isChecked = await rememberMe.isChecked();
        if (!isChecked) {
          await page.waitForTimeout(Math.random() * 300 + 200);
          await rememberMe.click();
        }
      }
      
      // Wait before submitting
      await page.waitForTimeout(Math.random() * 1000 + 500);
      
      // Submit the form
      await page.click('#wp-submit');
      
      // Wait for navigation or verification
      let loginSuccess = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          // Wait for either successful login or verification page
          await Promise.race([
            page.waitForSelector('#adminmenu', { timeout: 10000 }),
            page.waitForURL('**/wp-admin/**', { timeout: 10000 })
          ]);
          loginSuccess = true;
          break;
        } catch (e) {
          logger.warn(`Login attempt ${attempt + 1} checking page state...`);
          
          // Check current URL to see if we're actually logged in
          const currentUrl = page.url();
          if (currentUrl.includes('/wp-admin/') && !currentUrl.includes('wp-login.php')) {
            logger.info('Already in admin area, proceeding...');
            loginSuccess = true;
            break;
          }
          
          // Check if verification is blocking us
          const verificationVisible = await page.isVisible('text="VERIFICATION REQUIRED"').catch(() => false);
          if (verificationVisible) {
            logger.warn('Verification required - attempting to bypass...');
            
            // Try to find and click any verification bypass link
            const bypassLink = await page.$('a[href*="continue"]').catch(() => null);
            if (bypassLink) {
              await bypassLink.click();
              await page.waitForTimeout(3000);
              continue;
            }
            
            // Check if we can navigate directly to admin
            await page.goto(process.env.WP_ADMIN_URL.replace('index.php', 'post-new.php?post_type=landing_page'), {
              waitUntil: 'domcontentloaded',
              timeout: 10000
            }).catch(() => {});
            
            await page.waitForTimeout(2000);
            
            // Check if direct navigation worked
            const adminCheck = await page.isVisible('#adminmenu').catch(() => false);
            if (adminCheck) {
              logger.info('Direct navigation successful');
              loginSuccess = true;
              break;
            }
          }
          
          await page.waitForTimeout(3000);
        }
      }
      
      if (!loginSuccess) {
        // Try one more time with direct navigation to the new landing page URL
        logger.warn('Standard login failed, attempting direct navigation...');
        await page.goto(process.env.WP_ADMIN_URL.replace('index.php', 'post-new.php?post_type=landing_page'), {
          waitUntil: 'domcontentloaded',
          timeout: 15000
        }).catch(() => {});
        
        await page.waitForTimeout(3000);
        
        const finalCheck = await page.isVisible('#adminmenu').catch(() => false);
        if (!finalCheck) {
          // Last resort - check if we have any admin elements
          const hasAdminBar = await page.isVisible('#wpadminbar').catch(() => false);
          const hasPostForm = await page.isVisible('#post').catch(() => false);
          
          if (!hasAdminBar && !hasPostForm) {
            throw new Error('Failed to login - verification required. Please login manually once to complete verification.');
          }
        }
      }
    }
    
    logger.info('Successfully logged in');

    // Step 2: Use the modular form filler to complete the entire form
    const result = await formFiller.fillCompleteForm(page, data);
    
    logger.info('WordPress automation completed successfully');
    return { 
      success: true, 
      url: result.previewUrl,
      message: result.message
    };

  } catch (error) {
    logger.error('Automation failed:', error);
    await takeScreenshot(page, 'final-error');
    throw error;
  } finally {
    // Save browser state for future sessions
    try {
      await browserConfig.saveState(context);
      logger.info('Browser state saved for future sessions');
    } catch (e) {
      logger.warn('Could not save browser state:', e.message);
    }
    
    await browser.close();
  }
}

// API Endpoints
app.post('/create-landing', async (req, res) => {
  try {
    // Validate webhook secret if configured
    if (process.env.WEBHOOK_SECRET) {
      const providedSecret = req.headers['x-webhook-secret'];
      if (providedSecret !== process.env.WEBHOOK_SECRET) {
        logger.warn('Invalid webhook secret provided');
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    // Extract data from N8N payload structure
    let data = req.body;
    if (data.rows && Array.isArray(data.rows) && data.rows.length > 0) {
      data = data.rows[0];
    }

    // Log the raw data to debug
    logger.info('Raw data received:', JSON.stringify(data, null, 2));
    logger.info('Data keys:', Object.keys(data || {}));
    
    // Normalize field names before validation
    if ('below_text' in data && !('below_content' in data)) {
      data.below_content = data.below_text;
      delete data.below_text;
    }
    
    // Also handle below_form field name variation
    if ('below_form' in data && !('below_content' in data)) {
      data.below_content = data.below_form;
      delete data.below_form;
    }

    // Validate payload
    const { error, value } = payloadSchema.validate(data);
    if (error) {
      logger.error('Payload validation failed:', error.details);
      return res.status(400).json({ 
        error: 'Invalid payload', 
        details: error.details 
      });
    }

    logger.info('Received valid payload for landing page creation');
    
    // Initialize queue and queue the job with timeout protection
    await initializeQueue();
    const result = await queue.add(
      async () => await createLandingPage(value)
    );
    
    res.status(200).json({
      success: true,
      message: 'Landing page created and saved as draft successfully',
      url: result.url,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Request failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  const queueStats = queue ? {
    size: queue.size,           // Number of jobs waiting
    pending: queue.pending,      // Number of jobs currently running
    totalJobsProcessed: queue.size + queue.pending, // Quick stat
    concurrency: queue.concurrency,
    isPaused: queue.isPaused
  } : {
    status: 'not_initialized'
  };

  res.status(200).json({
    status: 'healthy',
    version: '1.0.0',
    queue: queueStats,
    system: {
      memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
      uptime: Math.round(process.uptime()) + ' seconds'
    },
    timestamp: new Date().toISOString()
  });
});

// Test endpoint for development
app.post('/test', async (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(404).send('Not found');
  }

  // Generate test data
  const testData = {
    header_headline: 'Test Landing Page ' + Date.now(),
    page_design: 'c',  // Select option C for page design
    hero_text_left: 'Professional',
    hero_text_right: 'Home Care Services',
    hero_preposition: 'in',
    hero_territories_csv: 'New York, Brooklyn, Queens',
    hero_excerpt: 'Quality care when you need it most',
    hero_btn1_text: 'Get Started',
    hero_btn1_url: 'https://example.com/contact',
    hero_btn2_text: 'Learn More',
    hero_btn2_url: 'https://example.com/about',
    intro_headline: 'Welcome to Our Services',
    intro_html: '<p>We provide exceptional home care services.</p>',
    cta_headline: 'Ready to Get Started?',
    cta_text: 'Contact us today for a free consultation',
    below_headline: 'Our Trusted Services',
    below_content: '<p>Trusted by families across the region for over 20 years.</p>',
    svc1_name: 'Companion Care',
    svc2_name: 'Respite Care',
    svc3_name: 'Dementia Care',
    svc4_name: 'Elite Care',
    bottom_cta_headline: 'Start Your Journey Today',
    bottom_cta_url: 'https://example.com/schedule-consultation',
    bottom_cta_text: 'Schedule Your Free Consultation'
  };

  try {
    // Initialize queue and queue the test job with timeout protection
    await initializeQueue();
    const result = await queue.add(
      async () => await createLandingPage(testData)
    );
    res.status(200).json({
      success: true,
      message: 'Test page created and saved as draft successfully',
      url: result.url,
      timestamp: new Date().toISOString(),
      testData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`WP Filler server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Headless mode: ${process.env.HEADLESS === 'true'}`);
});