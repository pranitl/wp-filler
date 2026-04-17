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

  normalizeText(value) {
    return (value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  async openEditor(page, data) {
    if (data.edit_url) {
      logger.info(`Opening existing landing page editor: ${data.edit_url}`);
      await page.goto(data.edit_url, {
        waitUntil: 'domcontentloaded',
        timeout: 20000
      });
      await page.waitForTimeout(1500);
      return;
    }

    await this.navigateToNewLandingPage(page);
  }

  async clickPanelByName(page, panelName) {
    logger.info(`Opening panel: ${panelName}`);
    const opened = await page.evaluate((name) => {
      const normalize = (value) => (value || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const links = Array.from(document.querySelectorAll('.acf-tab-wrap a, a.acf-tab-button, .acf-tab-wrap li a'));
      const target = links.find((link) => normalize(link.textContent).includes(normalize(name)));
      if (target) {
        target.scrollIntoView({ behavior: 'instant', block: 'center' });
        target.click();
        return true;
      }
      return false;
    }, panelName);

    if (!opened) {
      await page.click(`text="${panelName}"`);
    }

    await page.waitForTimeout(800);
  }

  async fillFieldByLabel(page, labelText, value) {
    if (!value) return false;

    return page.evaluate(({ labelText, value }) => {
      const normalize = (input) => (input || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const fields = Array.from(document.querySelectorAll('.acf-field'));
      const field = fields.find((candidate) => {
        const label = candidate.querySelector('.acf-label label, .acf-label');
        return label && normalize(label.textContent).includes(normalize(labelText));
      });

      if (!field) return false;

      const input = field.querySelector('input[type="text"], input[type="url"], textarea');
      if (!input) return false;

      input.value = value;
      ['input', 'change', 'blur'].forEach((eventName) => {
        input.dispatchEvent(new Event(eventName, { bubbles: true }));
      });

      if (typeof jQuery !== 'undefined') {
        jQuery(input).trigger('input').trigger('change').trigger('blur');
      }

      return true;
    }, { labelText, value });
  }

  async fillRichTextFieldByLabel(page, labelText, html) {
    if (!html) return false;

    await page.evaluate((labelText) => {
      const normalize = (input) => (input || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const fields = Array.from(document.querySelectorAll('.acf-field'));
      const field = fields.find((candidate) => {
        const label = candidate.querySelector('.acf-label label, .acf-label');
        return label && normalize(label.textContent).includes(normalize(labelText));
      });

      if (!field) return false;

      const initTrigger = Array.from(field.querySelectorAll('*')).find((node) =>
        normalize(node.textContent).includes('click to initialize tinymce')
      );

      if (initTrigger && typeof initTrigger.click === 'function') {
        initTrigger.click();
        return true;
      }

      return false;
    }, labelText);

    await page.waitForTimeout(1200);

    return page.evaluate(({ labelText, html }) => {
      const normalize = (input) => (input || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const fields = Array.from(document.querySelectorAll('.acf-field'));
      const field = fields.find((candidate) => {
        const label = candidate.querySelector('.acf-label label, .acf-label');
        return label && normalize(label.textContent).includes(normalize(labelText));
      });

      if (!field) return false;

      const wrap = field.querySelector('[id$="-wrap"].wp-editor-wrap, .wp-editor-wrap');
      const htmlTab = field.querySelector('.switch-html, [id$="-html"]');
      if (wrap) {
        wrap.classList.remove('tmce-active');
        wrap.classList.add('html-active');
      }
      if (htmlTab && typeof htmlTab.click === 'function') {
        htmlTab.click();
      }

      const textarea = field.querySelector('textarea');
      if (textarea) {
        textarea.value = html;
        textarea.style.display = 'block';
        textarea.removeAttribute('aria-hidden');
        ['input', 'change', 'blur'].forEach((eventName) => {
          textarea.dispatchEvent(new Event(eventName, { bubbles: true }));
        });

        if (typeof tinymce !== 'undefined' && textarea.id && tinymce.get(textarea.id)) {
          const editor = tinymce.get(textarea.id);
          if (editor) {
            editor.setContent(html);
            editor.save();
          }
        }

        if (typeof jQuery !== 'undefined') {
          jQuery(textarea).trigger('input').trigger('change').trigger('blur');
        }
      }

      const editable = field.querySelector('[contenteditable="true"]');
      if (editable) {
        editable.innerHTML = html;
        editable.dispatchEvent(new Event('input', { bubbles: true }));
      }

      const iframe = field.querySelector('iframe');
      if (iframe && iframe.contentDocument?.body) {
        iframe.contentDocument.body.innerHTML = html;
      }

      return true;
    }, { labelText, html });
  }

  async clickVisibleSelectLink(page, index = 0) {
    const clicked = await page.evaluate((targetIndex) => {
      const normalize = (input) => (input || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const fields = Array.from(document.querySelectorAll('.acf-field')).filter((field) => field.offsetParent !== null);
      const servicesField = fields.find((field) => {
        const label = field.querySelector('.acf-label label, .acf-label');
        return label && normalize(label.textContent) === 'services';
      });
      if (!servicesField) return false;

      const links = Array.from(servicesField.querySelectorAll('a')).filter((link) => {
        const text = normalize(link.textContent);
        return text === 'select link';
      });

      const target = links[targetIndex];
      if (!target) return false;

      if (typeof target.scrollIntoView === 'function') {
        target.scrollIntoView({ behavior: 'instant', block: 'center' });
      }
      target.click();
      return true;
    }, index);

    if (!clicked) {
      throw new Error(`Could not find visible Select Link button at index ${index}`);
    }

    await page.waitForTimeout(400);
  }

  async fillPantelopeServiceRow(page, index, service) {
    return page.evaluate(({ index, service }) => {
      const normalize = (input) => (input || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const fields = Array.from(document.querySelectorAll('.acf-field')).filter((field) => field.offsetParent !== null);
      const servicesField = fields.find((field) => {
        const label = field.querySelector('.acf-label label, .acf-label');
        return label && normalize(label.textContent) === 'services';
      });
      if (!servicesField) return false;

      const rows = Array.from(servicesField.querySelectorAll('tr.acf-row:not(.acf-clone)'))
        .filter((row) => row.offsetParent !== null);
      const row = rows[index];
      if (!row) return false;

      const titleInput = row.querySelector('input[type="text"]');
      if (titleInput) {
        titleInput.value = service.title || '';
        ['input', 'change', 'blur'].forEach((eventName) => {
          titleInput.dispatchEvent(new Event(eventName, { bubbles: true }));
        });
      }

      const textarea = row.querySelector('textarea');
      if (textarea) {
        textarea.value = service.description || '';
        ['input', 'change', 'blur'].forEach((eventName) => {
          textarea.dispatchEvent(new Event(eventName, { bubbles: true }));
        });

        if (typeof tinymce !== 'undefined' && textarea.id && tinymce.get(textarea.id)) {
          const editor = tinymce.get(textarea.id);
          if (editor) {
            editor.setContent(service.description || '');
            editor.save();
          }
        }
      }

      if (typeof jQuery !== 'undefined') {
        jQuery(row).find('input, textarea').trigger('input').trigger('change').trigger('blur');
      }

      return true;
    }, { index, service });
  }

  async setLinkModal(page, url, text) {
    await page.waitForSelector('#wp-link-url', { timeout: 5000 });
    await page.fill('#wp-link-url', url);
    await page.fill('#wp-link-text', text || 'Learn More');
    await page.click('#wp-link-submit');
    await page.waitForTimeout(600);
  }

  async setLinkFieldByLabel(page, labelText, url, text) {
    if (!url) return false;

    return page.evaluate(({ labelText, url, text }) => {
      const normalize = (input) => (input || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const fields = Array.from(document.querySelectorAll('.acf-field'));
      const field = fields.find((candidate) => {
        const label = candidate.querySelector('.acf-label label, .acf-label');
        return label && normalize(label.textContent).includes(normalize(labelText));
      });

      if (!field) return false;

      const titleInput = field.querySelector('input.input-title');
      const urlInput = field.querySelector('input.input-url');
      const targetInput = field.querySelector('input.input-target');

      if (titleInput) {
        titleInput.value = text || 'Learn More';
        ['input', 'change', 'blur'].forEach((eventName) => {
          titleInput.dispatchEvent(new Event(eventName, { bubbles: true }));
        });
      }

      if (urlInput) {
        urlInput.value = url;
        ['input', 'change', 'blur'].forEach((eventName) => {
          urlInput.dispatchEvent(new Event(eventName, { bubbles: true }));
        });
      }

      if (targetInput && !targetInput.value) {
        targetInput.value = '';
        targetInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      if (typeof jQuery !== 'undefined') {
        jQuery(field).find('input').trigger('input').trigger('change').trigger('blur');
      }

      return Boolean(urlInput);
    }, { labelText, url, text });
  }

  async setRepeaterCtaLink(page, index, url, text) {
    if (!url) return;
    const updated = await page.evaluate(({ targetIndex, url, text }) => {
      const normalize = (input) => (input || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const fields = Array.from(document.querySelectorAll('.acf-field')).filter((field) => field.offsetParent !== null);
      const servicesField = fields.find((field) => {
        const label = field.querySelector('.acf-label label, .acf-label');
        return label && normalize(label.textContent) === 'services';
      });
      if (!servicesField) return false;

      const rows = Array.from(servicesField.querySelectorAll('tr.acf-row:not(.acf-clone)'))
        .filter((row) => row.offsetParent !== null);
      const row = rows[targetIndex];
      if (!row) return false;

      const titleInput = row.querySelector('input.input-title');
      const urlInput = row.querySelector('input.input-url');
      const targetInput = row.querySelector('input.input-target');

      if (titleInput) {
        titleInput.value = text || 'Learn More';
        ['input', 'change', 'blur'].forEach((eventName) => {
          titleInput.dispatchEvent(new Event(eventName, { bubbles: true }));
        });
      }

      if (urlInput) {
        urlInput.value = url;
        ['input', 'change', 'blur'].forEach((eventName) => {
          urlInput.dispatchEvent(new Event(eventName, { bubbles: true }));
        });
      }

      if (targetInput && !targetInput.value) {
        targetInput.value = '';
        targetInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      if (typeof jQuery !== 'undefined') {
        jQuery(row).find('input').trigger('input').trigger('change').trigger('blur');
      }

      return Boolean(urlInput);
    }, { targetIndex: index, url, text });

    if (!updated) {
      await this.clickVisibleSelectLink(page, index);
      await page.waitForTimeout(400);
      await this.setLinkModal(page, url, text);
    }
  }

  getPantelopeServices(data) {
    if (Array.isArray(data.pantelope_services) && data.pantelope_services.length > 0) {
      return data.pantelope_services;
    }

    return [
      {
        title: data.svc1_title || data.svc1_name,
        description: data.svc1_description || '',
        ctaText: data.svc1_cta_text || 'Learn More',
        ctaUrl: data.svc1_cta_url || ''
      },
      {
        title: data.svc2_title || data.svc2_name,
        description: data.svc2_description || '',
        ctaText: data.svc2_cta_text || 'Learn More',
        ctaUrl: data.svc2_cta_url || ''
      },
      {
        title: data.svc3_title || data.svc3_name,
        description: data.svc3_description || '',
        ctaText: data.svc3_cta_text || 'Learn More',
        ctaUrl: data.svc3_cta_url || ''
      },
      {
        title: data.svc4_title || data.svc4_name,
        description: data.svc4_description || '',
        ctaText: data.svc4_cta_text || 'Learn More',
        ctaUrl: data.svc4_cta_url || ''
      }
    ].filter((service) => service.title);
  }

  async fillPantelopeHero(page, data) {
    await this.clickPanelByName(page, 'Hero Area');

    await this.fillFieldByLabel(page, 'Hero Headline', data.pantelope_hero_headline || data.hero_text_left);
    await this.fillFieldByLabel(page, 'Hero Excerpt', data.hero_excerpt);
    await this.fillFieldByLabel(page, 'Button 1 Text', data.hero_btn1_text);
    await this.fillFieldByLabel(page, 'Button 1 URL', data.hero_btn1_url);
  }

  async fillPantelopeServices(page, data) {
    await this.clickPanelByName(page, 'Services');
    await this.fillFieldByLabel(page, 'Services Headline', data.pantelope_services_headline);

    const services = this.getPantelopeServices(data);
    if (services.length === 0) return;

    let rowCount = await page.evaluate(() => {
      const normalize = (input) => (input || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const fields = Array.from(document.querySelectorAll('.acf-field')).filter((field) => field.offsetParent !== null);
      const servicesField = fields.find((field) => {
        const label = field.querySelector('.acf-label label, .acf-label');
        return label && normalize(label.textContent) === 'services';
      });
      if (!servicesField) return 0;

      return Array.from(servicesField.querySelectorAll('tr.acf-row:not(.acf-clone)'))
        .filter((row) => row.offsetParent !== null).length;
    });
    while (rowCount < services.length) {
      const added = await page.evaluate(() => {
        const normalize = (input) => (input || '').replace(/\s+/g, ' ').trim().toLowerCase();
        const fields = Array.from(document.querySelectorAll('.acf-field')).filter((field) => field.offsetParent !== null);
        const servicesField = fields.find((field) => {
          const label = field.querySelector('.acf-label label, .acf-label');
          return label && normalize(label.textContent) === 'services';
        });
        if (!servicesField) return false;

        const target = Array.from(servicesField.querySelectorAll('a'))
          .find((link) => normalize(link.textContent) === 'add a service');
        if (!target) return false;
        target.click();
        return true;
      });
      if (!added) {
        throw new Error('Could not trigger Add a Service button');
      }
      await page.waitForTimeout(500);
      rowCount = await page.evaluate(() => {
        const normalize = (input) => (input || '').replace(/\s+/g, ' ').trim().toLowerCase();
        const fields = Array.from(document.querySelectorAll('.acf-field')).filter((field) => field.offsetParent !== null);
        const servicesField = fields.find((field) => {
          const label = field.querySelector('.acf-label label, .acf-label');
          return label && normalize(label.textContent) === 'services';
        });
        if (!servicesField) return 0;

        return Array.from(servicesField.querySelectorAll('tr.acf-row:not(.acf-clone)'))
          .filter((row) => row.offsetParent !== null).length;
      });
    }

    for (let i = 0; i < services.length; i += 1) {
      await this.fillPantelopeServiceRow(page, i, services[i]);
    }

    for (let i = 0; i < services.length; i += 1) {
      await this.setRepeaterCtaLink(page, i, services[i].ctaUrl, services[i].ctaText || 'Learn More');
    }
  }

  async fillPantelopeOwnerArea(page, data) {
    await this.clickPanelByName(page, 'Owner Area');

    await this.fillFieldByLabel(page, 'Area Headline', data.owner_area_headline);
    await this.fillFieldByLabel(page, 'Phone Number Text', data.owner_area_phone_text);
    await this.fillRichTextFieldByLabel(page, 'Area Content', data.owner_area_html);

    if (data.owner_area_cta_url) {
      const updated = await this.setLinkFieldByLabel(
        page,
        'CTA Button',
        data.owner_area_cta_url,
        data.owner_area_cta_text || 'Learn More'
      );

      if (!updated) {
        await this.clickVisibleSelectLink(page, 0);
        await this.setLinkModal(page, data.owner_area_cta_url, data.owner_area_cta_text || 'Learn More');
      }
    }
  }

  async savePage(page, options = {}) {
    const existing = Boolean(options.existing);

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    const saveSelectors = existing
      ? ['#publish', 'input#publish', 'button:has-text("Update")', 'input[value="Update"]']
      : ['#save-post', 'input#save-post', 'button:has-text("Save Draft")', 'input[value="Save Draft"]'];

    let saved = false;
    for (const selector of saveSelectors) {
      try {
        await page.click(selector, { timeout: 3000 });
        saved = true;
        break;
      } catch (error) {
        // Try next selector
      }
    }

    if (!saved) {
      throw new Error(existing ? 'Could not find Update button' : 'Could not find Save Draft button');
    }

    await page.waitForTimeout(3000);

    if (existing) {
      return {
        previewUrl: page.url()
      };
    }

    return {
      previewUrl: await this.getPreviewUrl(page)
    };
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

    const selectors = [
      `input[name="acf[field_62f9dkhrn3e92]"][value="${design}"]`,
      `#acf-field_62f9dkhrn3e92-${design}`
    ];

    for (const selector of selectors) {
      try {
        await page.waitForSelector(selector, { timeout: 3000 });
        await page.check(selector);
        logger.info(`Page Design radio button selected: ${design}`);
        return;
      } catch (error) {
        // Try next selector
      }
    }

    logger.warn(`Could not select Page Design radio button for design "${design}"`);
  }

  /**
   * Fill Hero Area panel
   */
  async fillHeroArea(page, data) {
    logger.info('Filling Hero Area panel');
    const mapping = await this.loadMapping();
    const heroPanel = mapping.panels.find(p => p.key === 'panel_hero_area');
    
    if (heroPanel) {
      // Try the specific selector first, with proper wait and scroll
      try {
        await page.waitForSelector(heroPanel.selector, { timeout: 5000 });
        await page.locator(heroPanel.selector).scrollIntoViewIfNeeded();
        await page.click(heroPanel.selector);
      } catch (error) {
        logger.warn('Could not click Hero Area tab with selector, trying text selector');
        await page.click('text="Hero Area"');
      }
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
      try {
        await page.waitForSelector(introPanel.selector, { timeout: 5000 });
        await page.locator(introPanel.selector).scrollIntoViewIfNeeded();
        await page.click(introPanel.selector);
      } catch (error) {
        logger.warn('Could not click Intro Content tab with selector, trying text selector');
        await page.click('text="Intro Content"');
      }
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
      try {
        await page.waitForSelector(ctaPanel.selector, { timeout: 5000 });
        await page.locator(ctaPanel.selector).scrollIntoViewIfNeeded();
        await page.click(ctaPanel.selector);
      } catch (error) {
        logger.warn('Could not click Call to Action tab with selector, trying text selector');
        await page.click('text="Call to Action"');
      }
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
      try {
        await page.waitForSelector(belowPanel.selector, { timeout: 5000 });
        await page.locator(belowPanel.selector).scrollIntoViewIfNeeded();
        await page.click(belowPanel.selector);
      } catch (error) {
        logger.warn('Could not click Below Form tab with selector, trying text selector');
        await page.click('text="Below Form"');
      }
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
      logger.info('Checking for below content fields:', {
        has_below_content: !!data.below_content,
        has_below_text: !!data.below_text,
        below_content_value: data.below_content ? data.below_content.substring(0, 50) + '...' : 'undefined',
        below_text_value: data.below_text ? data.below_text.substring(0, 50) + '...' : 'undefined'
      });
      
      const belowContent = data.below_content || data.below_text;
      if (belowContent) {
        logger.info(`Attempting to fill below content (${belowContent.length} chars)`);
        
        // Wait for the editor to load after expanding the panel
        await page.waitForTimeout(1000);
        
        // Try to initialize TinyMCE if needed (specifically for Below Form section)
        let editorInitialized = false;
        try {
          const initButtons = await page.locator('text="Click to initialize TinyMCE"').all();
          for (const button of initButtons) {
            if (await button.isVisible()) {
              logger.info('Initializing TinyMCE editor for below content');
              await button.click();
              await page.waitForTimeout(2000); // Wait for TinyMCE to fully initialize
              editorInitialized = true;
              break;
            }
          }
        } catch (e) {
          // No init button found or error clicking, continue
        }
        
        // Wait for editor elements to be created after initialization
        if (editorInitialized) {
          try {
            // Wait for any ACF editor wrapper to appear (handles both patterns)
            await page.waitForSelector('[id^="wp-acf-editor-"][id$="-wrap"], [id*="wp-acf-editor-"][id$="-wrap"]', { timeout: 5000 });
            logger.info('TinyMCE editor initialized successfully');
          } catch (e) {
            logger.warn('TinyMCE editor elements did not appear after initialization');
          }
        }
        
        // Find the Below Form content editor dynamically
        const editorInfo = await page.evaluate(() => {
          // Look for ACF editor wrapper divs - they can start with either pattern
          const editorWraps = document.querySelectorAll('[id^="wp-acf-editor-"][id$="-wrap"], [id*="wp-acf-editor-"][id$="-wrap"]');
          
          for (let wrap of editorWraps) {
            const textarea = wrap.querySelector('textarea[id^="acf-editor-"], textarea[id*="acf-editor-"]');
            if (textarea) {
              // Check if this is in the Below Form section
              const fieldContainer = textarea.closest('.acf-field');
              if (fieldContainer) {
                const fieldName = fieldContainer.getAttribute('data-name');
                const fieldKey = fieldContainer.getAttribute('data-key');
                const label = fieldContainer.querySelector('.acf-label label');
                
                // Look for below-related content field by multiple indicators
                const isBelow = 
                  (fieldName && fieldName.toLowerCase().includes('below')) ||
                  (fieldKey && fieldKey === 'field_091kfmjg85g4g') || // The specific field key
                  (label && label.textContent && label.textContent.toLowerCase().includes('below')) ||
                  // Also check if the textarea name attribute matches
                  (textarea.name === 'acf[field_091kfmjg85g4g]');
                
                if (isBelow) {
                  // Extract the numeric ID from the textarea ID (e.g., "acf-editor-201" -> "201")
                  const editorNum = textarea.id.match(/acf-editor-(\d+)/)?.[1] || textarea.id.replace('acf-editor-', '');
                  
                  return {
                    editorId: editorNum,
                    textareaId: textarea.id,
                    wrapId: wrap.id,
                    htmlTabId: `${textarea.id}-html`,
                    iframeId: `${textarea.id}_ifr`
                  };
                }
              }
            }
          }
          
          // Fallback: Look for textarea by name attribute directly
          const textareaByName = document.querySelector('textarea[name="acf[field_091kfmjg85g4g]"]');
          if (textareaByName) {
            const wrap = textareaByName.closest('[id$="-wrap"]');
            if (wrap) {
              const editorNum = textareaByName.id.match(/acf-editor-(\d+)/)?.[1] || textareaByName.id.replace('acf-editor-', '');
              return {
                editorId: editorNum,
                textareaId: textareaByName.id,
                wrapId: wrap.id,
                htmlTabId: `${textareaByName.id}-html`,
                iframeId: `${textareaByName.id}_ifr`
              };
            }
          }
          
          return null;
        });
        
        if (!editorInfo) {
          logger.error('Could not find below_text editor');
          return;
        }
        
        logger.info(`Found below content editor: ${editorInfo.textareaId}`);
        
        // Switch editor to HTML mode to properly handle HTML content
        logger.info('Switching editor to HTML mode for below_text field');
        const switchedToHtml = await page.evaluate((editorInfo) => {
          // Find the wrapper div using dynamic ID
          const wrapperDiv = document.querySelector(`#${editorInfo.wrapId}`);
          if (wrapperDiv) {
            // Remove tmce-active class and add html-active class
            wrapperDiv.classList.remove('tmce-active');
            wrapperDiv.classList.add('html-active');
            
            // Try to trigger the HTML tab if it exists
            const htmlTab = document.querySelector(`#${editorInfo.htmlTabId}`);
            if (htmlTab) {
              htmlTab.click();
            }
            
            // Make sure the textarea is visible
            const textarea = document.querySelector(`#${editorInfo.textareaId}`);
            if (textarea) {
              textarea.style.display = 'block';
              textarea.removeAttribute('aria-hidden');
            }
            
            // Hide the iframe and TinyMCE editor completely
            const iframe = document.querySelector(`#${editorInfo.textareaId}_ifr`);
            if (iframe) {
              iframe.style.display = 'none';
            }
            const mceContainer = document.querySelector('.mce-tinymce');
            if (mceContainer) {
              mceContainer.style.display = 'none';
            }
            
            return true;
          }
          return false;
        }, editorInfo);
        
        if (switchedToHtml) {
          logger.info('Successfully switched to HTML mode');
          
          // Now fill the textarea directly with HTML content using evaluate to avoid double encoding
          try {
            const filled = await page.evaluate(({textareaId, content}) => {
              const textarea = document.querySelector(`#${textareaId}`);
              if (textarea) {
                // Clean the content - remove any escaped quotes
                let cleanContent = content.replace(/\\"/g, '"').replace(/\\'/g, "'");
                
                // Set the value directly without encoding
                textarea.value = cleanContent;
                
                // Trigger multiple events to ensure WordPress recognizes the HTML
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                textarea.dispatchEvent(new Event('change', { bubbles: true }));
                textarea.dispatchEvent(new Event('blur', { bubbles: true }));
                
                // Trigger jQuery events for ACF
                if (typeof jQuery !== 'undefined' && jQuery(textarea).length) {
                  jQuery(textarea).trigger('change').trigger('input').trigger('blur');
                }
                
                // CRITICAL: Also update TinyMCE if it exists
                if (typeof tinymce !== 'undefined' && tinymce.get(textareaId)) {
                  const editor = tinymce.get(textareaId);
                  if (editor) {
                    editor.setContent(cleanContent);
                    editor.save(); // This syncs TinyMCE content back to the textarea
                  }
                }
                
                // Trigger ACF field update if available
                if (window.acf) {
                  const $field = jQuery(textarea).closest('.acf-field');
                  if ($field.length) {
                    const field = acf.getField($field);
                    if (field) {
                      field.val(cleanContent);
                      field.trigger('change');
                    }
                  }
                }
                
                return true;
              }
              return false;
            }, {textareaId: editorInfo.textareaId, content: belowContent});
            
            if (filled) {
              logger.info('Successfully filled below content in HTML mode');
              // Give WordPress/ACF time to process the change
              await page.waitForTimeout(500);
            } else {
              throw new Error('Could not find textarea element');
            }
          } catch (e) {
            logger.error(`Could not fill below content: ${e.message}`);
          }
        } else {
          // Fallback to original TinyMCE method if switching failed
          logger.warn('Could not switch to HTML mode, trying TinyMCE fallback');
          const filled = await page.evaluate(({editorId, content}) => {
            // Clean the content first
            let cleanContent = content.replace(/\\"/g, '"').replace(/\\'/g, "'");
            
            // Try TinyMCE first
            if (typeof tinymce !== 'undefined') {
              const editor = tinymce.get(editorId);
              if (editor && editor.initialized) {
                // Set content as HTML
                editor.setContent(cleanContent);
                editor.save(); // Sync to textarea
                
                // Also update the textarea directly
                const textarea = document.querySelector(`#${editorId}`);
                if (textarea) {
                  textarea.value = cleanContent;
                  
                  // Trigger events
                  if (typeof jQuery !== 'undefined') {
                    jQuery(textarea).trigger('change').trigger('input');
                  }
                }
                return true;
              }
            }
            
            // If TinyMCE failed, update textarea directly
            const textarea = document.querySelector(`#${editorId}`);
            if (textarea) {
              textarea.value = cleanContent;
              textarea.dispatchEvent(new Event('change', { bubbles: true }));
              return true;
            }
            
            return false;
          }, {editorId: editorInfo.textareaId, content: belowContent});
          
          if (filled) {
            logger.info('Successfully filled below content via TinyMCE');
          } else {
            logger.warn('TinyMCE fill failed, trying comprehensive fill approach');
            try {
              await page.evaluate(({textareaId, content}) => {
                // Clean the content
                let cleanContent = content.replace(/\\"/g, '"').replace(/\\'/g, "'");
                
                const textarea = document.querySelector(`#${textareaId}`);
                if (textarea) {
                  // Set the value
                  textarea.value = cleanContent;
                  
                  // Trigger all possible events
                  textarea.dispatchEvent(new Event('input', { bubbles: true }));
                  textarea.dispatchEvent(new Event('change', { bubbles: true }));
                  textarea.dispatchEvent(new Event('blur', { bubbles: true }));
                  
                  // jQuery triggers
                  if (typeof jQuery !== 'undefined') {
                    jQuery(textarea).trigger('change').trigger('input').trigger('blur');
                  }
                  
                  // One more attempt at TinyMCE
                  if (typeof tinymce !== 'undefined' && tinymce.get(textareaId)) {
                    tinymce.get(textareaId).setContent(cleanContent);
                    tinymce.get(textareaId).save();
                  }
                }
              }, {textareaId: editorInfo.textareaId, content: belowContent});
              logger.info('Executed comprehensive fill approach for below content');
            } catch (e) {
              logger.error(`Could not fill below content: ${e.message}`);
            }
          }
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
      try {
        await page.waitForSelector(servicesPanel.selector, { timeout: 5000 });
        await page.locator(servicesPanel.selector).scrollIntoViewIfNeeded();
        await page.click(servicesPanel.selector);
      } catch (error) {
        logger.warn('Could not click Services Grid tab with selector, trying text selector');
        await page.click('text="Services Grid"');
      }
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
      try {
        await page.waitForSelector(bottomCTAPanel.selector, { timeout: 5000 });
        await page.locator(bottomCTAPanel.selector).scrollIntoViewIfNeeded();
        await page.click(bottomCTAPanel.selector);
      } catch (error) {
        logger.warn('Could not click Bottom CTA tab with selector, trying text selector');
        await page.click('a:has-text("Bottom CTA")');
      }
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

  async getPreviewUrl(page) {
    try {
      await page.waitForSelector('a:has-text("Preview post")', { timeout: 10000 });

      const previewUrl = await page.evaluate(() => {
        const previewLink = document.querySelector('a[target="_blank"]');
        if (previewLink && previewLink.textContent.includes('Preview post')) {
          return previewLink.href;
        }
        const links = document.querySelectorAll('a[href*="preview=true"]');
        if (links.length > 0) {
          return links[0].href;
        }
        return null;
      });

      if (previewUrl) {
        logger.info(`Preview URL captured: ${previewUrl}`);
        return previewUrl;
      }

      logger.warn('Could not capture preview URL');
      return null;
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
      
      // Open the target editor
      await this.openEditor(page, data);
      
      // Fill page title
      await this.fillPageTitle(page, data.header_headline);
      
      // Select page design
      await this.selectPageDesign(page, data.page_design);

      let previewUrl;

      if (data.page_design === 'e') {
        // Existing pages need one save/reload cycle before Pantelope-specific
        // fields render in the DOM.
        if (data.edit_url) {
          logger.info('Saving existing page after selecting Pantelope design to refresh ACF layout');
          await this.savePage(page, { existing: true });
          await page.goto(data.edit_url, {
            waitUntil: 'domcontentloaded',
            timeout: 20000
          });
          await page.waitForTimeout(1500);
        }

        await this.fillPantelopeHero(page, data);
        await this.fillPantelopeServices(page, data);
        await this.fillPantelopeOwnerArea(page, data);
        ({ previewUrl } = await this.savePage(page, { existing: Boolean(data.edit_url) }));
      } else {
        // Fill all panels
        await this.fillHeroArea(page, data);
        await this.fillIntroContent(page, data);
        await this.fillCallToAction(page, data);
        await this.fillBelowForm(page, data);
        await this.fillServicesGrid(page, data);
        await this.fillBottomCTA(page, data);

        ({ previewUrl } = await this.savePage(page, { existing: Boolean(data.edit_url) }));
      }
      
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
