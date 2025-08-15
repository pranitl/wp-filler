const fs = require('fs').promises;
const path = require('path');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

/**
 * Comprehensive WordPress landing page form filler
 * Extracted from test phases and productionized
 */
class WordPressFormFiller {
  constructor() {
    this.mapping = null;
  }

  async loadMapping() {
    if (!this.mapping) {
      const mappingPath = path.join(__dirname, '..', 'config', 'mapping.json');
      const mappingContent = await fs.readFile(mappingPath, 'utf8');
      this.mapping = JSON.parse(mappingContent);
    }
    return this.mapping;
  }

  /**
   * Navigate to the new landing page editor
   */
  async navigateToNewLandingPage(page) {
    logger.info('Starting navigation to New Landing Page...');
    
    const mapping = await this.loadMapping();
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
    
    // Click New Landing Page button with optimized timing
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
    
    // Optimized wait for editor to load
    await Promise.race([
      page.waitForLoadState('domcontentloaded'),
      page.waitForTimeout(1000)
    ]);
    
    logger.info('Successfully navigated to new landing page editor');
  }

  /**
   * Fill the page title
   */
  async fillPageTitle(page, title) {
    logger.info(`Filling page title: ${title}`);
    await page.fill('#title', title);
  }

  /**
   * Select page design option
   */
  async selectPageDesign(page, design = 'c') {
    if (!design) return;
    
    logger.info(`Selecting page design: ${design}`);
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(1000);
    
    const mapping = await this.loadMapping();
    const pageDesignField = mapping.fields.find(f => f.payloadKey === 'page_design');
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

  /**
   * Fill Hero Area panel
   */
  async fillHeroArea(page, data) {
    logger.info('Filling Hero Area panel');
    const mapping = await this.loadMapping();
    const heroPanel = mapping.panels.find(p => p.key === 'panel_hero_area');
    
    if (heroPanel) {
      await page.click(heroPanel.selector).catch(() => page.click('text="Hero Area"'));
      await page.waitForTimeout(1500);
      
      const heroFields = [
        'hero_text_left', 'hero_text_right', 'hero_preposition',
        'hero_territories_csv', 'hero_excerpt', 'hero_btn1_text',
        'hero_btn1_url', 'hero_btn2_text', 'hero_btn2_url'
      ];
      
      for (const fieldKey of heroFields) {
        const field = mapping.fields.find(f => f.payloadKey === fieldKey);
        if (field && data[fieldKey]) {
          try {
            await page.fill(field.selector, data[fieldKey]);
            logger.debug(`Filled ${fieldKey}: ${data[fieldKey]}`);
          } catch (error) {
            logger.warn(`Failed to fill ${fieldKey}: ${error.message}`);
          }
        }
      }
    }
  }

  /**
   * Fill Intro Content panel
   */
  async fillIntroContent(page, data) {
    logger.info('Filling Intro Content panel');
    const mapping = await this.loadMapping();
    const introPanel = mapping.panels.find(p => p.key === 'panel_intro_content');
    
    if (introPanel) {
      await page.click(introPanel.selector).catch(() => page.click('text="Intro Content"'));
      await page.waitForTimeout(1500);
      
      // Fill headline
      if (data.intro_headline) {
        await page.fill('#acf-field_62f544c0b2002', data.intro_headline).catch(() => {});
      }
      
      // Check if TinyMCE needs initialization
      const needsInit = await page.isVisible('text="Click to initialize TinyMCE"').catch(() => false);
      
      if (needsInit) {
        await page.click('text="Click to initialize TinyMCE"').catch(() => 
          page.click('.acf-editor-toolbar').catch(() => 
            page.click('.acf-editor-wrap')));
        await page.waitForTimeout(1500);
      }
      
      // Fill content
      if (data.intro_html) {
        const filled = await page.evaluate((content) => {
          if (typeof tinymce !== 'undefined') {
            const editor = tinymce.get('acf-editor-197');
            if (editor && editor.initialized) {
              editor.setContent(content);
              editor.save();
              return true;
            }
          }
          return false;
        }, data.intro_html);
        
        if (!filled) {
          // Fallback to Text mode
          await page.click('#acf-editor-197-html').catch(() => {});
          await page.waitForTimeout(300);
          await page.fill('#acf-editor-197', data.intro_html).catch(() => {});
        }
      }
    }
  }

  /**
   * Fill Call to Action panel
   */
  async fillCallToAction(page, data) {
    logger.info('Filling Call to Action panel');
    const mapping = await this.loadMapping();
    const ctaPanel = mapping.panels.find(p => p.key === 'panel_top_cta');
    
    if (ctaPanel) {
      await page.click(ctaPanel.selector).catch(() => page.click('text="Call to Action"'));
      await page.waitForTimeout(1500);
      
      // Fill CTA headline
      if (data.cta_headline) {
        const ctaHeadlineField = mapping.fields.find(f => f.payloadKey === 'cta_headline');
        if (ctaHeadlineField) {
          await page.fill(ctaHeadlineField.selector, data.cta_headline).catch(() => {});
        }
      }
      
      // Fill CTA text
      if (data.cta_text) {
        const ctaTextField = mapping.fields.find(f => f.payloadKey === 'cta_text');
        if (ctaTextField) {
          await page.fill(ctaTextField.selector, data.cta_text).catch(() => {});
        }
      }
    }
  }

  /**
   * Fill Below Form panel
   */
  async fillBelowForm(page, data) {
    logger.info('Filling Below Form panel');
    const mapping = await this.loadMapping();
    const belowPanel = mapping.panels.find(p => p.key === 'panel_below_form');
    
    if (belowPanel) {
      await page.click(belowPanel.selector).catch(() => page.click('text="Below Form"'));
      await page.waitForTimeout(1500);
      
      // Fill headline
      if (data.below_headline) {
        logger.info(`Attempting to fill below_headline: "${data.below_headline}"`);
        const belowHeadlineField = mapping.fields.find(f => f.payloadKey === 'below_headline');
        if (belowHeadlineField) {
          logger.info(`Found below_headline field with selector: ${belowHeadlineField.selector}`);
          await page.fill(belowHeadlineField.selector, data.below_headline).catch((e) => {
            logger.error(`Failed to fill below_headline: ${e.message}`);
          });
        } else {
          logger.warn('below_headline field not found in mapping');
        }
      } else {
        logger.info('No below_headline in data');
      }
      
      // Fill content if provided (support both below_content and below_text)
      const belowContent = data.below_content || data.below_text;
      if (belowContent) {
        logger.info(`Attempting to fill below content (${belowContent.length} chars)`);
        
        // Check if TinyMCE needs initialization
        const needsInit = await page.isVisible('text="Click to initialize TinyMCE"').catch(() => false);
        
        if (needsInit) {
          logger.info('TinyMCE needs initialization, clicking...');
          await page.click('text="Click to initialize TinyMCE"').catch(() => 
            page.click('.acf-editor-toolbar').catch(() => 
              page.click('.acf-editor-wrap')));
          await page.waitForTimeout(500);
        }
        
        // Just paste the content directly into TinyMCE visual editor
        // The below_text field only has visual editor, no text mode option
        const filled = await page.evaluate((content) => {
          if (typeof tinymce !== 'undefined') {
            const editor = tinymce.get('acf-editor-198');
            if (editor && editor.initialized) {
              // Use insertContent for plain text to preserve formatting
              editor.setContent(''); // Clear first
              editor.insertContent(content);
              editor.save();
              return true;
            } else {
              console.log('TinyMCE editor not initialized for acf-editor-198');
              return false;
            }
          } else {
            console.log('TinyMCE not defined');
            return false;
          }
        }, belowContent);
        
        if (filled) {
          logger.info('Successfully filled below content via TinyMCE');
        } else {
          logger.warn('TinyMCE fill failed, trying fallback...');
          // Fallback: try direct fill into the textarea
          await page.fill('#acf-editor-198', belowContent).catch((e) => {
            logger.error(`Could not fill below content: ${e.message}`);
          });
        }
      } else {
        logger.info('No below_content or below_text in data');
      }
    }
  }

  /**
   * Fill Services Grid panel
   */
  async fillServicesGrid(page, data) {
    logger.info('Filling Services Grid panel');
    const mapping = await this.loadMapping();
    const servicesPanel = mapping.panels.find(p => p.key === 'panel_services_grid');
    
    if (servicesPanel) {
      await page.click(servicesPanel.selector).catch(() => page.click('text="Services Grid"'));
      await page.waitForTimeout(1500);
      
      // Get services from data
      const services = [data.svc1_name, data.svc2_name, data.svc3_name, data.svc4_name].filter(Boolean);
      
      if (services.length > 0) {
        // Check existing rows
        const existingRows = await page.$$('.acf-repeater tbody > tr.acf-row:not(.acf-clone)');
        const existingCount = existingRows.length;
        const servicesToAdd = Math.max(0, services.length - existingCount);
        
        // Add new service rows if needed
        if (servicesToAdd > 0) {
          for (let i = 0; i < servicesToAdd; i++) {
            await page.click('a.acf-repeater-add-row[data-event="add-row"]')
              .catch(() => page.click('a:has-text("Add a Service")'))
              .catch(() => page.click('.acf-button.button-primary[href="#"]'));
            await page.waitForTimeout(800);
          }
        }
        
        // Fill service dropdowns
        const serviceSelects = await page.$$('.acf-repeater tbody > tr.acf-row:not(.acf-clone) select[name*="field_62f544c0d43e6"]');
        
        for (let i = 0; i < Math.min(services.length, serviceSelects.length); i++) {
          try {
            const selectId = await serviceSelects[i].getAttribute('id');
            const selectName = await serviceSelects[i].getAttribute('name');
            
            if (selectId) {
              await page.selectOption(`#${selectId}`, services[i]);
            } else if (selectName) {
              await page.selectOption(`select[name="${selectName}"]`, services[i]);
            }
            logger.debug(`Selected service ${i+1}: ${services[i]}`);
          } catch (e) {
            logger.warn(`Could not select service ${i+1}: ${services[i]}`);
          }
        }
      }
    }
  }

  /**
   * Fill Bottom CTA panel
   */
  async fillBottomCTA(page, data) {
    logger.info('Filling Bottom CTA panel');
    const mapping = await this.loadMapping();
    const bottomCTAPanel = mapping.panels.find(p => p.key === 'panel_bottom_cta');
    
    if (bottomCTAPanel) {
      await page.click(bottomCTAPanel.selector).catch(() => page.click('a:has-text("Bottom CTA")'));
      await page.waitForTimeout(1500);
      
      // Fill headline
      if (data.bottom_cta_headline) {
        logger.info(`Attempting to fill bottom_cta_headline: "${data.bottom_cta_headline}"`);
        await page.fill('#acf-field_62f568766405e', data.bottom_cta_headline).catch((e) => {
          logger.error(`Failed to fill bottom_cta_headline: ${e.message}`);
        });
      } else {
        logger.info('No bottom_cta_headline in data');
      }
      
      // Fill link if URL and text are provided (support both field name formats)
      const ctaUrl = data.bottom_cta_url || data.bottom_cta_link_url;
      const ctaText = data.bottom_cta_text || data.bottom_cta_link_text;
      
      logger.info(`Bottom CTA URL: ${ctaUrl || 'none'}, Text: ${ctaText || 'none'}`);
      
      if (ctaUrl && ctaText) {
        await page.waitForTimeout(500);
        
        // Click Select Link button
        logger.info('Looking for Select Link button...');
        const selectLinkClicked = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a'));
          for (const link of links) {
            if (link.textContent.trim() === 'Select Link' && link.offsetParent !== null) {
              console.log('Found and clicking Select Link button');
              link.click();
              return true;
            }
          }
          console.log('Select Link button not found');
          return false;
        });
        
        if (selectLinkClicked) {
          logger.info('Select Link button clicked, filling link details...');
          await page.waitForTimeout(1000);
          
          // Fill link details
          try {
            await page.fill('#wp-link-url', ctaUrl);
            logger.info(`Filled URL: ${ctaUrl}`);
            await page.fill('#wp-link-text', ctaText);
            logger.info(`Filled text: ${ctaText}`);
            await page.waitForTimeout(500);
            await page.click('#wp-link-submit');
            await page.waitForTimeout(1000);
            logger.info('Bottom CTA link added successfully');
          } catch (error) {
            logger.error('Could not complete Bottom CTA link setup:', error.message);
          }
        } else {
          logger.warn('Select Link button was not clicked');
        }
      } else {
        logger.info('Missing Bottom CTA URL or text, skipping link setup');
      }
    }
  }

  /**
   * Save the landing page as draft and get preview URL
   */
  async saveDraftAndGetPreviewUrl(page) {
    logger.info('Saving landing page as draft');
    
    // Scroll to top to find the save button
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    
    // Click Save Draft button
    await page.click('#save-post');
    logger.info('Clicked Save Draft button');
    
    // Wait for save to complete
    await page.waitForTimeout(3000);
    
    // Get preview URL
    try {
      await page.waitForSelector('a:has-text("Preview post")', { timeout: 10000 });
      
      const previewUrl = await page.evaluate(() => {
        const previewLink = document.querySelector('a[target="_blank"]');
        if (previewLink && previewLink.textContent.includes('Preview post')) {
          return previewLink.href;
        }
        // Alternative: look for any link with preview=true in the URL
        const links = document.querySelectorAll('a[href*="preview=true"]');
        if (links.length > 0) {
          return links[0].href;
        }
        return null;
      });
      
      if (previewUrl) {
        logger.info(`Preview URL captured: ${previewUrl}`);
        return previewUrl;
      } else {
        logger.warn('Could not capture preview URL');
        return null;
      }
    } catch (error) {
      logger.warn('Preview link not found within timeout');
      return null;
    }
  }

  /**
   * Main form filling function that orchestrates all the steps
   */
  async fillCompleteForm(page, data) {
    try {
      logger.info('Starting complete form filling process');
      
      // Navigate to new landing page
      await this.navigateToNewLandingPage(page);
      
      // Fill page title
      await this.fillPageTitle(page, data.header_headline);
      
      // Select page design
      await this.selectPageDesign(page, data.page_design);
      
      // Fill all panels
      await this.fillHeroArea(page, data);
      await this.fillIntroContent(page, data);
      await this.fillCallToAction(page, data);
      await this.fillBelowForm(page, data);
      await this.fillServicesGrid(page, data);
      await this.fillBottomCTA(page, data);
      
      // Save draft and get preview URL
      const previewUrl = await this.saveDraftAndGetPreviewUrl(page);
      
      logger.info('Complete form filling process finished successfully');
      
      return {
        success: true,
        previewUrl: previewUrl,
        message: 'Landing page created and saved as draft successfully'
      };
      
    } catch (error) {
      logger.error('Form filling failed:', error);
      throw error;
    }
  }
}

module.exports = WordPressFormFiller;