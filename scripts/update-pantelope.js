#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { chromium } = require('playwright');
const browserConfig = require('../src/browser-config');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function normalize(value) {
  return (value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function collectJsonFiles(inputPath) {
  const stats = await fs.stat(inputPath);
  if (stats.isDirectory()) {
    const entries = await fs.readdir(inputPath);
    return entries
      .filter((entry) => entry.endsWith('.json') && entry !== 'template.json')
      .map((entry) => path.join(inputPath, entry))
      .sort();
  }
  return [inputPath];
}

function getSiteRootFromAdminUrl() {
  return process.env.WP_ADMIN_URL.replace(/\/wp-admin\/index\.php$/, '');
}

function slugFromPayload(payload) {
  if (payload.slug) return payload.slug;
  if (payload.source_markdown) {
    return path.basename(payload.source_markdown, path.extname(payload.source_markdown));
  }
  if (payload.town) {
    return normalize(payload.town).replace(/\s+/g, '-');
  }
  return null;
}

function publicLandingUrlFromPayload(payload) {
  const slug = slugFromPayload(payload);
  if (!slug) return null;
  return `${getSiteRootFromAdminUrl()}/landing/${slug}/`;
}

async function ensureLoggedIn(page) {
  await page.goto(process.env.WP_ADMIN_URL, {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });
  await page.waitForTimeout(1500);

  const alreadyLoggedIn = await page.locator('#adminmenu').isVisible().catch(() => false);
  if (alreadyLoggedIn) return;

  const loginUrl = process.env.WP_ADMIN_URL.replace('/wp-admin/index.php', '/wp-login.php');
  await page.goto(loginUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });
  await page.waitForTimeout(1000);

  await page.fill('#user_login', process.env.WP_USERNAME);
  await page.fill('#user_pass', process.env.WP_PASSWORD);
  const rememberMe = page.locator('#rememberme');
  if (await rememberMe.count()) {
    const checked = await rememberMe.isChecked().catch(() => false);
    if (!checked) await rememberMe.check().catch(() => {});
  }
  await page.click('#wp-submit');
  await page.waitForTimeout(2500);

  const success = await page.locator('#adminmenu').isVisible().catch(() => false);
  if (!success) {
    throw new Error('Login failed or requires manual verification');
  }
}

async function openEditPage(page, payload) {
  if (payload.edit_url) {
    await page.goto(payload.edit_url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);
    return page.url();
  }

  const publicUrl = publicLandingUrlFromPayload(payload);
  if (!publicUrl) {
    throw new Error('Missing edit_url and could not infer landing-page slug');
  }

  await page.goto(publicUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);

  const adminEditSelectors = [
    '#wp-admin-bar-edit a',
    'a:has-text("Edit Landing Page")',
    'a:has-text("Edit")'
  ];

  for (const selector of adminEditSelectors) {
    const locator = page.locator(selector);
    if (await locator.count()) {
      await locator.first().click();
      await page.waitForTimeout(1500);
      return page.url();
    }
  }

  throw new Error(`Could not open editor from public page: ${publicUrl}`);
}

async function clickVisibleTab(page, tabName) {
  const clicked = await page.evaluate((name) => {
    const normalizeInner = (value) => (value || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const tabs = Array.from(document.querySelectorAll('.acf-tab-wrap a, a.acf-tab-button, .acf-tab-wrap li a'));
    const visible = tabs.find((tab) => normalizeInner(tab.textContent) === normalizeInner(name) && tab.offsetParent !== null);
    const target = visible || tabs.find((tab) => normalizeInner(tab.textContent) === normalizeInner(name));
    if (!target) return false;
    target.scrollIntoView({ behavior: 'instant', block: 'center' });
    target.click();
    return true;
  }, tabName);

  if (!clicked) {
    throw new Error(`Could not open tab: ${tabName}`);
  }
  await page.waitForTimeout(800);
}

async function fillVisibleFieldByLabel(page, labelText, value) {
  if (value === undefined || value === null || value === '') return false;

  return page.evaluate(({ labelText, value }) => {
    const normalizeInner = (input) => (input || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const fields = Array.from(document.querySelectorAll('.acf-field')).filter((field) => field.offsetParent !== null);
    const field = fields.find((candidate) => {
      const label = candidate.querySelector('.acf-label label, .acf-label');
      return label && normalizeInner(label.textContent).includes(normalizeInner(labelText));
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

async function fillVisibleRichTextByLabel(page, labelText, html) {
  if (!html) return false;

  return page.evaluate(({ labelText, html }) => {
    const normalizeInner = (input) => (input || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const fields = Array.from(document.querySelectorAll('.acf-field')).filter((field) => field.offsetParent !== null);
    const field = fields.find((candidate) => {
      const label = candidate.querySelector('.acf-label label, .acf-label');
      return label && normalizeInner(label.textContent).includes(normalizeInner(labelText));
    });

    if (!field) return false;

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

    return true;
  }, { labelText, html });
}

async function selectPantelopeDesign(page) {
  const selectors = [
    'input[name="acf[field_62f9dkhrn3e92]"][value="e"]',
    '#acf-field_62f9dkhrn3e92-e'
  ];

  for (const selector of selectors) {
    const locator = page.locator(selector);
    if (await locator.count()) {
      await locator.first().check().catch(async () => {
        await locator.first().click();
      });
      await page.waitForTimeout(600);
      return;
    }
  }

  throw new Error('Could not select Pantelope page design');
}

async function savePage(page, existing = true) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);

  const selectors = existing
    ? ['#publish', 'input#publish', 'input[value="Update"]', 'button:has-text("Update")']
    : ['#save-post', 'input#save-post', 'input[value="Save Draft"]', 'button:has-text("Save Draft")'];

  for (const selector of selectors) {
    const locator = page.locator(selector);
    if (await locator.count()) {
      await locator.first().click();
      await page.waitForTimeout(3000);
      return;
    }
  }

  throw new Error(existing ? 'Could not find Update button' : 'Could not find Save Draft button');
}

async function ensurePantelopeLayout(page, editUrl) {
  await selectPantelopeDesign(page);
  await savePage(page, true);
  await page.goto(editUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
}

async function fillServices(page, payload) {
  await clickVisibleTab(page, 'Services');
  await fillVisibleFieldByLabel(page, 'Services Headline', payload.pantelope_services_headline);

  const servicesFieldReady = await page.waitForFunction(() => {
    const normalizeInner = (input) => (input || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const fields = Array.from(document.querySelectorAll('.acf-field')).filter((field) => field.offsetParent !== null);
    const servicesField = fields.find((field) => {
      const label = field.querySelector('.acf-label');
      return label &&
        normalizeInner(label.textContent) === 'services' &&
        field.querySelector('table.acf-table, .acf-repeater');
    });
    return Boolean(servicesField && servicesField.querySelector('table.acf-table, .acf-repeater'));
  }, {}, { timeout: 5000 }).catch(() => null);

  if (!servicesFieldReady) {
    throw new Error('Visible Pantelope services repeater not found');
  }

  const serviceCount = payload.pantelope_services.length;

  await page.evaluate((targetCount) => {
    const normalizeInner = (input) => (input || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const fields = Array.from(document.querySelectorAll('.acf-field')).filter((field) => field.offsetParent !== null);
    const servicesField = fields.find((field) => {
      const label = field.querySelector('.acf-label');
      return label &&
        normalizeInner(label.textContent) === 'services' &&
        field.querySelector('table.acf-table, .acf-repeater');
    });
    if (!servicesField) throw new Error('Services field not found');

    const getRows = () => Array.from(servicesField.querySelectorAll('tr.acf-row:not(.acf-clone)')).filter((row) => row.offsetParent !== null);
    let rows = getRows();
    while (rows.length < targetCount) {
      const addLink = Array.from(servicesField.querySelectorAll('a')).find((link) => normalizeInner(link.textContent) === 'add a service');
      if (!addLink) throw new Error('Add a Service button not found');
      addLink.click();
      rows = getRows();
    }
  }, serviceCount);

  await page.waitForTimeout(800);

  await page.evaluate((services) => {
    const normalizeInner = (input) => (input || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const fields = Array.from(document.querySelectorAll('.acf-field')).filter((field) => field.offsetParent !== null);
    const servicesField = fields.find((field) => {
      const label = field.querySelector('.acf-label');
      return label &&
        normalizeInner(label.textContent) === 'services' &&
        field.querySelector('table.acf-table, .acf-repeater');
    });
    if (!servicesField) throw new Error('Services field not found');

    const rows = Array.from(servicesField.querySelectorAll('tr.acf-row:not(.acf-clone)')).filter((row) => row.offsetParent !== null);

    services.forEach((service, index) => {
      const row = rows[index];
      if (!row) return;

      const textInputs = Array.from(row.querySelectorAll('input[type="text"]'));
      const titleInput = textInputs.find((input) => !input.classList.contains('input-title')) || textInputs[0];
      if (titleInput) {
        titleInput.value = service.title || '';
        ['input', 'change', 'blur'].forEach((eventName) => titleInput.dispatchEvent(new Event(eventName, { bubbles: true })));
      }

      const textarea = row.querySelector('textarea');
      if (textarea) {
        textarea.value = service.description || '';
        ['input', 'change', 'blur'].forEach((eventName) => textarea.dispatchEvent(new Event(eventName, { bubbles: true })));
        if (typeof tinymce !== 'undefined' && textarea.id && tinymce.get(textarea.id)) {
          const editor = tinymce.get(textarea.id);
          if (editor) {
            editor.setContent(service.description || '');
            editor.save();
          }
        }
      }

      const ctaTitle = row.querySelector('input.input-title');
      const ctaUrl = row.querySelector('input.input-url');
      const ctaTarget = row.querySelector('input.input-target');
      if (ctaTitle) {
        ctaTitle.value = service.ctaText || 'Learn More';
        ['input', 'change', 'blur'].forEach((eventName) => ctaTitle.dispatchEvent(new Event(eventName, { bubbles: true })));
      }
      if (ctaUrl) {
        ctaUrl.value = service.ctaUrl || '';
        ['input', 'change', 'blur'].forEach((eventName) => ctaUrl.dispatchEvent(new Event(eventName, { bubbles: true })));
      }
      if (ctaTarget && !ctaTarget.value) {
        ctaTarget.value = '';
        ctaTarget.dispatchEvent(new Event('change', { bubbles: true }));
      }

      if (typeof jQuery !== 'undefined') {
        jQuery(row).find('input, textarea').trigger('input').trigger('change').trigger('blur');
      }
    });
  }, payload.pantelope_services);
}

async function fillOwnerArea(page, payload) {
  await clickVisibleTab(page, 'Owner Area');
  await fillVisibleFieldByLabel(page, 'Area Headline', payload.owner_area_headline);
  await fillVisibleFieldByLabel(page, 'Phone Number Text', payload.owner_area_phone_text);
  await fillVisibleRichTextByLabel(page, 'Area Content', payload.owner_area_html);

  await page.evaluate(({ ctaText, ctaUrl }) => {
    const normalizeInner = (input) => (input || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const fields = Array.from(document.querySelectorAll('.acf-field')).filter((field) => field.offsetParent !== null);
    const ctaField = fields.find((field) => {
      const label = field.querySelector('.acf-label');
      return label && normalizeInner(label.textContent).includes('cta button');
    });
    if (!ctaField) return;

    const titleInput = ctaField.querySelector('input.input-title');
    const urlInput = ctaField.querySelector('input.input-url');
    const targetInput = ctaField.querySelector('input.input-target');
    if (titleInput) {
      titleInput.value = ctaText || 'Learn More';
      ['input', 'change', 'blur'].forEach((eventName) => titleInput.dispatchEvent(new Event(eventName, { bubbles: true })));
    }
    if (urlInput) {
      urlInput.value = ctaUrl || '';
      ['input', 'change', 'blur'].forEach((eventName) => urlInput.dispatchEvent(new Event(eventName, { bubbles: true })));
    }
    if (targetInput && !targetInput.value) {
      targetInput.value = '';
      targetInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (typeof jQuery !== 'undefined') {
      jQuery(ctaField).find('input').trigger('input').trigger('change').trigger('blur');
    }
  }, {
    ctaText: payload.owner_area_cta_text,
    ctaUrl: payload.owner_area_cta_url
  });
}

async function applyPantelopePayload(page, payload) {
  const editUrl = await openEditPage(page, payload);

  await page.fill('#title', payload.header_headline);
  await ensurePantelopeLayout(page, editUrl);
  await clickVisibleTab(page, 'Hero Area');
  await fillVisibleFieldByLabel(page, 'Hero Headline', payload.pantelope_hero_headline);
  await fillVisibleFieldByLabel(page, 'Hero Excerpt', payload.hero_excerpt);
  await fillVisibleFieldByLabel(page, 'Button 1 Text', payload.hero_btn1_text);
  await fillVisibleFieldByLabel(page, 'Button 1 URL', payload.hero_btn1_url);
  await fillServices(page, payload);
  await fillOwnerArea(page, payload);
  await savePage(page, true);
}

async function runFile(browser, payloadPath) {
  const payload = await readJson(payloadPath);
  if (!payload.edit_url && !slugFromPayload(payload)) {
    throw new Error(`Missing edit_url and no inferable slug in ${payloadPath}`);
  }

  const contextConfig = browserConfig.getContextConfig();
  const storageState = await browserConfig.loadState();
  if (storageState) contextConfig.storageState = storageState;
  const context = await browser.newContext(contextConfig);
  await browserConfig.applyStealthMode(context);
  const page = await context.newPage();

  try {
    console.log(`Updating ${payload.town} from ${payloadPath}`);
    await ensureLoggedIn(page);
    await applyPantelopePayload(page, payload);
    await browserConfig.saveState(context);
    console.log(`Finished ${payload.town}`);
  } finally {
    await context.close();
  }
}

async function main() {
  const input = process.argv[2];
  if (!input) {
    console.error('Usage: node scripts/update-pantelope.js <json-file-or-directory>');
    process.exit(1);
  }

  const targetPath = path.resolve(input);
  const files = await collectJsonFiles(targetPath);
  const browser = await chromium.launch(browserConfig.getBrowserConfig());

  try {
    for (const file of files) {
      await runFile(browser, file);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
