# Full Implementation Document for WordPress Landing Page Automation

## Overview
This document provides a complete implementation guide for automating the creation of new landing pages on your WordPress site using Playwright, based on the provided JSON payload from NocoDB via N8N. The solution runs on your VM in a Docker container for isolation, receives data via a POST endpoint, logs in to WordPress, navigates to the new post creation page for the "landing" custom post type, interacts with tabs (by clicking to switch panels), fills text fields, switches editors to text mode where needed, selects dropdown options for services, and publishes the page.

Key updates based on your latest input:
- **Mapping Centralization**: I've created a dedicated table below for all field mappings. This can be copied into a static file (e.g., `mapping.json` or `mapping.csv`) for easy reference, debugging, and updates if the page changes (e.g., selectors evolve). In code, we'll load this as a JSON object for flexibility.
- **Interactions**:
  - **Tabs/Panels**: Click on specific tab links to switch sections (e.g., Hero Area, Intro Content).
  - **Text Inputs**: Simple `fill()`.
  - **Textareas/HTML Editors**: Click the "Text" switch button if needed, then fill the textarea.
  - **Dropdowns (Selects)**: Use `selectOption()` with the exact value from the payload (e.g., "Personal Care").
  - **Radio Buttons**: There's a partial radio example (e.g., for "acf-field_62f9dkhrn3e92-c"), but it's not mapped to a specific payload field. If needed, add it to the mapping table; for now, assumed optional.
  - **Services Grid**: Up to 4 services (svc1_name to svc4_name in payload); selectors provided for each. An "add_service_button" is listed but appears to be another select—interpret as dynamically adding rows if more than default, but since payload has fixed 4, we'll fill the existing ones. If rows need adding, click the ACF repeater add button (selector not provided; add if needed).
  - **TinyMCE for Some Fields**: For fields like "below_headline", it references a TinyMCE body. We'll assume filling the textarea after switching modes.
- **Payload Handling**: Extract from `data.rows[0]` in N8N or server code. Fields like "header_headline" map directly.
- **Phased Rollout**: As before, develop in phases (login → tab clicks → field filling → full).
- **Headless**: `false` for dev; `true` for prod.
- **Error Handling**: Added try-catch, logging, and waits for stability.
- **Resources**: Minimal; each run ~200-500MB RAM.

## Field Mapping Table
This table centralizes the payload-to-element mapping. Save as `mapping.json` in your project for code to load (e.g., via `require('./mapping.json')`). Format:
```json
{
  "panels": [
    {"key": "panel_hero_area", "selector": "#acf-group_62f544c0a7ba2 > div.inside.acf-fields.-top.-sidebar > div.acf-tab-wrap.-left > ul > li.active > a"},
    // ... other panels
  ],
  "fields": [
    {"payloadKey": "header_headline", "type": "text", "selector": "#title"},
    // ... other fields
  ]
}
```
| Payload Key          | Element Type | Selector / Action                                                                 | Notes / Interaction |
|----------------------|--------------|-----------------------------------------------------------------------------------|---------------------|
| panel_hero_area     | Tab Click   | #acf-group_62f544c0a7ba2 > div.inside.acf-fields.-top.-sidebar > div.acf-tab-wrap.-left > ul > li.active > a | Click to activate Hero Area tab. Note: Selector has "li.active", but to select specific, may need adjustment if not first; test and refine. |
| panel_intro_content | Tab Click   | #acf-group_62f544c0a7ba2 > div.inside.acf-fields.-top.-sidebar > div.acf-tab-wrap.-left > ul > li:nth-child(4) > a | Click for Intro Content. |
| panel_top_cta       | Tab Click   | #acf-group_62f544c0a7ba2 > div.inside.acf-fields.-top.-sidebar > div.acf-tab-wrap.-left > ul > li:nth-child(5) > a | Click for Call to Action. |
| panel_below_form    | Tab Click   | #acf-group_62f544c0a7ba2 > div.inside.acf-fields.-top.-sidebar > div.acf-tab-wrap.-left > ul > li:nth-child(6) > a | Click for Below Form. |
| panel_services_grid | Tab Click   | #acf-group_62f544c0a7ba2 > div.inside.acf-fields.-top.-sidebar > div.acf-tab-wrap.-left > ul > li:nth-child(7) > a | Click for Services Grid. |
| header_headline     | Text Input  | #title                                                                           | Fill directly (likely page title). |
| hero_text_left      | Text Input  | #acf-field_62f5463fa1cf1                                                        | Fill after Hero tab click. |
| hero_text_right     | Text Input  | #acf-field_62f5464ea1cf2                                                        | Fill. |
| hero_preposition    | Text Input  | #acf-field_62f5464ea1cf4                                                        | Fill (maxlength=2). |
| hero_territories_csv| Text Input  | #acf-field_66alf5mrd3g5                                                         | Fill. |
| hero_excerpt        | Text Input  | #acf-field_66alf5mrd3g6                                                         | Fill. |
| hero_btn1_text      | Text Input  | #acf-field_62f545595114c                                                        | Fill. |
| hero_btn1_url       | Text Input  | #acf-field_62f5458f5114f                                                        | Fill. |
| hero_btn2_text      | Text Input  | #acf-field_62f5458f5114f                                                        | Fill (note: same selector as btn1_url; possible typo—verify). |
| hero_btn2_url       | Text Input  | #acf-field_62f545895114e                                                        | Fill. |
| intro_text_html_button | Button Click | #acf-editor-197-html                                                            | Click to switch to Text mode for intro_html. |
| intro_headline      | Text Input  | #acf-field_62f544c0b2002                                                        | Fill after Intro tab. |
| intro_html          | Textarea    | #acf-editor-197                                                                  | Fill after clicking Text button. |
| cta_headline        | Text Input  | #acf-field_62f544c0b21ea                                                        | Fill after CTA tab (note: selector might be typo; listed as #acf-field_62f544c0b2226 in input—use latter). |
| cta_text            | Text Input  | #acf-field_62f544c0b2226                                                        | Fill. |
| below_headline      | Rich Editor | #tinymce                                                                         | For TinyMCE body; may need page.evaluate to set content: `tinymce.get('acf-editor-198').setContent(data.below_headline);` (adjust ID). Or switch to text mode if textarea available. |
| svc1_name           | Select      | #acf-field_62f544c0b2137-row-0-field_62f544c0d43e6                             | Select option by value after Services tab. |
| svc2_name           | Select      | #acf-field_62f544c0b2137-689e2a360e87e-field_62f544c0d43e6                     | Select. |
| svc3_name           | Select      | #acf-field_62f544c0b2137-689e2a350e87d-field_62f544c0d43e6                     | Select. |
| svc4_name           | Select      | #acf-field_62f544c0b2137-689e2a350e87d-field_62f544c0d43e6                     | Select (note: same as svc3; possible typo—verify). |
| add_service_button  | Select      | #acf-field_62f544c0b2137-row-1-field_62f544c0d43e6                             | If this adds a row, click ACF add button first (selector needed); then select. Assuming fixed 4, treat as optional. |
| (Radio example)     | Radio       | #acf-field_62f9dkhrn3e92-c                                                      | Not mapped to payload; add if needed (e.g., click if value="c"). |

**Maintenance Tip**: If selectors change (e.g., due to WP updates), update the table/JSON and restart the container. Test with `page.waitForSelector()` to ensure visibility.

## Code Implementation
### server.js (Main Script)
This integrates all: Receives POST, loads mapping, launches browser, logs in, navigates, clicks tabs in sequence, fills/selects based on type, publishes.

```javascript
const express = require('express');
const { chromium } = require('playwright');
const fs = require('fs');
require('dotenv').config();

const app = express();
app.use(express.json());

// Load mapping from static file
const mapping = JSON.parse(fs.readFileSync('./mapping.json', 'utf8'));
const panels = mapping.panels;
const fields = mapping.fields.reduce((acc, f) => { acc[f.payloadKey] = f; return acc; }, {});

app.post('/create-landing', async (req, res) => {
  const data = req.body; // Parsed from N8N (e.g., { header_headline: 'Sample', ... })
  const browser = await chromium.launch({ headless: false }); // Dev mode
  const page = await browser.newPage();

  try {
    // Login
    await page.goto(`${process.env.WP_ADMIN_URL}/wp-login.php`);
    await page.fill('#user_login', process.env.WP_USERNAME);
    await page.fill('#user_pass', process.env.WP_PASSWORD);
    await page.click('#wp-submit');
    await page.waitForNavigation();

    // Navigate to new landing page
    await page.goto(`${process.env.WP_ADMIN_URL}/post-new.php?post_type=landing`);
    await page.waitForLoadState('networkidle');

    // Sequence: Click panels and fill related fields
    // Hero Area
    await page.click(panels.find(p => p.key === 'panel_hero_area').selector);
    await page.waitForTimeout(500); // Short wait for tab load
    await page.fill(fields.header_headline.selector, data.header_headline || '');
    await page.fill(fields.hero_text_left.selector, data.hero_text_left || '');
    await page.fill(fields.hero_text_right.selector, data.hero_text_right || '');
    await page.fill(fields.hero_preposition.selector, data.hero_preposition || '');
    await page.fill(fields.hero_territories_csv.selector, data.hero_territories_csv || '');
    await page.fill(fields.hero_excerpt.selector, data.hero_excerpt || '');
    await page.fill(fields.hero_btn1_text.selector, data.hero_btn1_text || '');
    await page.fill(fields.hero_btn1_url.selector, data.hero_btn1_url || '');
    await page.fill(fields.hero_btn2_text.selector, data.hero_btn2_text || '');
    await page.fill(fields.hero_btn2_url.selector, data.hero_btn2_url || '');

    // Intro Content
    await page.click(panels.find(p => p.key === 'panel_intro_content').selector);
    await page.waitForTimeout(500);
    await page.click(fields.intro_text_html_button.selector); // Switch to Text
    await page.fill(fields.intro_headline.selector, data.intro_headline || '');
    await page.fill(fields.intro_html.selector, data.intro_html || '');

    // Call to Action
    await page.click(panels.find(p => p.key === 'panel_top_cta').selector);
    await page.waitForTimeout(500);
    await page.fill(fields.cta_headline.selector, data.cta_headline || '');
    await page.fill(fields.cta_text.selector, data.cta_text || '');

    // Below Form
    await page.click(panels.find(p => p.key === 'panel_below_form').selector);
    await page.waitForTimeout(500);
    // For below_headline (TinyMCE): Use evaluate if direct fill fails
    await page.evaluate((content) => {
      tinymce.get('acf-editor-198').setContent(content); // Adjust ID if needed
    }, data.below_headline || '');

    // Services Grid
    await page.click(panels.find(p => p.key === 'panel_services_grid').selector);
    await page.waitForTimeout(500);
    if (data.svc1_name) await page.selectOption(fields.svc1_name.selector, data.svc1_name);
    if (data.svc2_name) await page.selectOption(fields.svc2_name.selector, data.svc2_name);
    if (data.svc3_name) await page.selectOption(fields.svc3_name.selector, data.svc3_name);
    if (data.svc4_name) await page.selectOption(fields.svc4_name.selector, data.svc4_name);
    // If add_service_button needed: await page.click('ACF add row selector'); then select

    // Publish
    await page.click('#publish');
    await page.waitForSelector('.notice-success');

    res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await browser.close();
  }
});

app.listen(3000, () => console.log('Server on 3000'));
```

## Dockerfile
Same as before:
```dockerfile
FROM node:18-slim
WORKDIR /app
COPY . .
RUN npm install
RUN npx playwright install --with-deps chromium
CMD ["node", "server.js"]
```

## Deployment and Testing
1. Create `mapping.json` from table.
2. Build/Run: `docker build -t wp-auto . && docker run -p 3000:3000 --env-file .env wp-auto`.
3. Test Phases: Run standalone versions (e.g., extract login/tab clicks into separate scripts).
4. N8N: POST to `http://localhost:3000/create-landing` with transformed payload.
5. Debug: Add `await page.screenshot({ path: 'step.png' });` after each action.

If issues (e.g., selector inaccuracies), provide logs/screenshots for refinements!