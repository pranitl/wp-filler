const express = require('express');
const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');
const winston = require('winston');
const Joi = require('joi');
const browserConfig = require('./browser-config');
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
  hero_btn1_url: Joi.string().uri().allow(''),
  hero_btn2_text: Joi.string().allow(''),
  hero_btn2_url: Joi.string().uri().allow(''),
  intro_headline: Joi.string().allow(''),
  intro_html: Joi.string().allow(''),
  cta_headline: Joi.string().allow(''),
  cta_text: Joi.string().allow(''),
  below_headline: Joi.string().allow(''),
  svc1_name: Joi.string().allow(''),
  svc2_name: Joi.string().allow(''),
  svc3_name: Joi.string().allow(''),
  svc4_name: Joi.string().allow('')
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

// Main automation function
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
  
  try {
    logger.info('Starting WordPress automation');
    
    // Add human-like behavior
    await addHumanBehavior(page);

    // Step 1: Check if already logged in
    await page.goto(process.env.WP_ADMIN_URL, { waitUntil: 'networkidle' });
    
    const dashboardVisible = await page.isVisible('#adminmenu').catch(() => false);
    
    if (!dashboardVisible) {
      // Need to login
      logger.info('Logging in to WordPress');
      
      // Check if we're on login page
      const loginFormVisible = await page.isVisible('#user_login').catch(() => false);
      if (!loginFormVisible) {
        await page.goto(`${process.env.WP_ADMIN_URL}/wp-login.php`);
      }
      
      // Add human-like delays
      await page.waitForTimeout(Math.random() * 1000 + 500);
      
      // Type with human-like speed
      await page.click('#user_login');
      await page.waitForTimeout(Math.random() * 300 + 200);
      await page.type('#user_login', process.env.WP_USERNAME, { delay: Math.random() * 50 + 50 });
      
      await page.waitForTimeout(Math.random() * 500 + 200);
      await page.click('#user_pass');
      await page.waitForTimeout(Math.random() * 300 + 200);
      await page.type('#user_pass', process.env.WP_PASSWORD, { delay: Math.random() * 50 + 50 });
      
      // Check "Remember Me"
      const rememberMe = await page.$('#rememberme');
      if (rememberMe) {
        const isChecked = await rememberMe.isChecked();
        if (!isChecked) {
          await rememberMe.click();
        }
      }
      
      await page.waitForTimeout(Math.random() * 500 + 300);
      await safeClick(page, '#wp-submit', 'login button');
      
      // Wait for dashboard to load
      await page.waitForNavigation({ waitUntil: 'networkidle' });
    }
    
    logger.info('Successfully logged in');

    // Step 2: Navigate to new landing page via sidebar
    logger.info('Navigating to Landing Pages menu');
    
    // Load navigation selectors from mapping
    const navMapping = mapping.navigation || {};
    
    // Click Landing Pages in sidebar
    if (navMapping.landing_page_main_sidebar) {
      const landingPageSelectors = [
        navMapping.landing_page_main_sidebar.selector,
        ...navMapping.landing_page_main_sidebar.alternativeSelectors,
        'text=Landing Pages'
      ];
      
      let clicked = false;
      for (const selector of landingPageSelectors) {
        try {
          await page.click(selector);
          clicked = true;
          logger.info('Clicked Landing Pages menu');
          break;
        } catch (e) {
          // Try next selector
        }
      }
      
      if (!clicked) {
        logger.warn('Could not click Landing Pages menu, trying direct navigation');
        await page.goto(`${process.env.WP_ADMIN_URL}/edit.php?post_type=landing`);
      }
    } else {
      await page.goto(`${process.env.WP_ADMIN_URL}/edit.php?post_type=landing`);
    }
    
    await page.waitForLoadState('networkidle');
    
    // Click New Landing Page button
    logger.info('Clicking New Landing Page button');
    if (navMapping.new_landing_page_button) {
      const newPageSelectors = [
        navMapping.new_landing_page_button.selector,
        ...navMapping.new_landing_page_button.alternativeSelectors,
        'text=New Landing Page'
      ];
      
      let clicked = false;
      for (const selector of newPageSelectors) {
        try {
          await page.click(selector);
          clicked = true;
          logger.info('Clicked New Landing Page button');
          break;
        } catch (e) {
          // Try next selector
        }
      }
      
      if (!clicked) {
        logger.warn('Could not click New Landing Page button, trying direct navigation');
        await page.goto(`${process.env.WP_ADMIN_URL}/post-new.php?post_type=landing`);
      }
    } else {
      await page.goto(`${process.env.WP_ADMIN_URL}/post-new.php?post_type=landing`);
    }
    
    await page.waitForLoadState('networkidle');

    // Step 3: Fill page title
    await safeFill(page, '#title', data.header_headline, 'page title');

    // Step 4: Select Page Design option (if provided)
    if (data.page_design) {
      logger.info('Selecting Page Design option');
      await page.evaluate(() => window.scrollBy(0, 500));
      await page.waitForTimeout(1000);
      
      // Find the page_design field in mapping
      const pageDesignField = fields.find(f => f.payloadKey === 'page_design');
      if (pageDesignField) {
        try {
          await page.waitForSelector(pageDesignField.selector, { timeout: 5000 });
          await page.$eval(pageDesignField.selector, el => el.scrollIntoViewIfNeeded());
          await page.waitForTimeout(500);
          await page.click(pageDesignField.selector);
          logger.info('Page Design radio button selected');
        } catch (e) {
          logger.warn('Could not select Page Design radio button');
        }
      }
    }

    // Step 5: Process each panel
    const panels = mapping.panels;
    const fields = mapping.fields;

    // Hero Area Panel
    logger.info('Filling Hero Area panel');
    const heroPanel = panels.find(p => p.key === 'panel_hero_area');
    if (heroPanel) {
      await safeClick(page, heroPanel.selector, 'Hero Area tab');
      await page.waitForTimeout(500);

      const heroFields = [
        'hero_text_left', 'hero_text_right', 'hero_preposition',
        'hero_territories_csv', 'hero_excerpt', 'hero_btn1_text',
        'hero_btn1_url', 'hero_btn2_text', 'hero_btn2_url'
      ];

      for (const fieldKey of heroFields) {
        const field = fields.find(f => f.payloadKey === fieldKey);
        if (field && data[fieldKey]) {
          await safeFill(page, field.selector, data[fieldKey], fieldKey);
        }
      }
    }

    // Intro Content Panel
    logger.info('Filling Intro Content panel');
    const introPanel = panels.find(p => p.key === 'panel_intro_content');
    if (introPanel) {
      await safeClick(page, introPanel.selector, 'Intro Content tab');
      await page.waitForTimeout(500);

      // Switch to text mode for HTML editor
      const textButton = fields.find(f => f.payloadKey === 'intro_text_html_button');
      if (textButton) {
        await safeClick(page, textButton.selector, 'Text mode button');
        await page.waitForTimeout(500);
      }

      // Fill intro fields
      const introHeadline = fields.find(f => f.payloadKey === 'intro_headline');
      if (introHeadline && data.intro_headline) {
        await safeFill(page, introHeadline.selector, data.intro_headline, 'intro_headline');
      }

      const introHtml = fields.find(f => f.payloadKey === 'intro_html');
      if (introHtml && data.intro_html) {
        await safeFill(page, introHtml.selector, data.intro_html, 'intro_html');
      }
    }

    // Call to Action Panel
    logger.info('Filling Call to Action panel');
    const ctaPanel = panels.find(p => p.key === 'panel_top_cta');
    if (ctaPanel) {
      await safeClick(page, ctaPanel.selector, 'CTA tab');
      await page.waitForTimeout(500);

      // Get the correct selectors from mapping
      const ctaHeadlineField = fields.find(f => f.payloadKey === 'cta_headline');
      const ctaTextField = fields.find(f => f.payloadKey === 'cta_text');
      
      // Fill CTA headline
      if (ctaHeadlineField && data.cta_headline) {
        logger.debug(`Filling CTA headline with selector: ${ctaHeadlineField.selector}`);
        await safeFill(page, ctaHeadlineField.selector, data.cta_headline, 'cta_headline');
      }
      
      // Fill CTA text
      if (ctaTextField && data.cta_text) {
        logger.debug(`Filling CTA text with selector: ${ctaTextField.selector}`);
        await safeFill(page, ctaTextField.selector, data.cta_text, 'cta_text');
      }
    }

    // Below Form Panel
    logger.info('Filling Below Form panel');
    const belowPanel = panels.find(p => p.key === 'panel_below_form');
    if (belowPanel) {
      await safeClick(page, belowPanel.selector, 'Below Form tab');
      await page.waitForTimeout(500);

      const belowField = fields.find(f => f.payloadKey === 'below_headline');
      if (belowField && data.below_headline) {
        // Handle TinyMCE editor
        if (belowField.type === 'tinymce') {
          await page.evaluate((content, editorId) => {
            if (typeof tinymce !== 'undefined' && tinymce.get(editorId)) {
              tinymce.get(editorId).setContent(content);
            }
          }, data.below_headline, belowField.editorId);
          logger.debug('Filled TinyMCE editor for below_headline');
        } else {
          await safeFill(page, belowField.selector, data.below_headline, 'below_headline');
        }
      }
    }

    // Services Grid Panel
    logger.info('Filling Services Grid panel');
    const servicesPanel = panels.find(p => p.key === 'panel_services_grid');
    if (servicesPanel) {
      await safeClick(page, servicesPanel.selector, 'Services Grid tab');
      await page.waitForTimeout(500);

      const serviceFields = ['svc1_name', 'svc2_name', 'svc3_name', 'svc4_name'];
      for (const fieldKey of serviceFields) {
        const field = fields.find(f => f.payloadKey === fieldKey);
        if (field && data[fieldKey]) {
          try {
            await page.selectOption(field.selector, data[fieldKey]);
            logger.debug(`Selected ${fieldKey}: ${data[fieldKey]}`);
          } catch (error) {
            logger.error(`Failed to select ${fieldKey}: ${error.message}`);
          }
        }
      }
    }

    // Step 5: Publish the page
    logger.info('Publishing the page');
    await safeClick(page, '#publish', 'Publish button');
    
    // Wait for success message
    await page.waitForSelector('.notice-success', { timeout: 10000 });
    logger.info('Page published successfully');

    // Get the published URL
    const publishedUrl = await page.evaluate(() => {
      const linkElement = document.querySelector('#sample-permalink a');
      return linkElement ? linkElement.href : null;
    });

    return { success: true, url: publishedUrl };

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
    
    // Create the landing page
    const result = await createLandingPage(value);
    
    res.status(200).json({
      success: true,
      message: 'Landing page created successfully',
      url: result.url
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
  res.status(200).json({
    status: 'healthy',
    version: '1.0.0',
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
    below_headline: '<p>Trusted by families across the region.</p>',
    svc1_name: 'Personal Care',
    svc2_name: 'Home Care',
    svc3_name: 'Companion Care',
    svc4_name: 'Dementia Care'
  };

  try {
    const result = await createLandingPage(testData);
    res.status(200).json({
      success: true,
      message: 'Test page created successfully',
      url: result.url,
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