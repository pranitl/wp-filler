const express = require('express');
const { chromium } = require('playwright');
const winston = require('winston');
const Joi = require('joi');
const browserConfig = require('./browser-config');
const WordPressFormFiller = require('./form-filler');
const authStore = require('./auth-store');
const gmailClient = require('./gmail-client');
require('dotenv').config();

const GMAIL_POLL_INTERVAL_MS = parseInt(process.env.GMAIL_POLL_INTERVAL_MS, 10) || 5000;
const GMAIL_POLL_TIMEOUT_MS = parseInt(process.env.GMAIL_POLL_TIMEOUT_MS, 10) || 90000;

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

class ApiError extends Error {
  constructor(statusCode, code, message, extra = {}) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.extra = extra;
  }
}

let queue;
const gmailPollers = new Map();

const pantelopeServiceSchema = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().allow('').required(),
  ctaText: Joi.string().required(),
  ctaUrl: Joi.string().required()
});

const legacySchema = Joi.object({
  header_headline: Joi.string().required(),
  page_design: Joi.string().valid('a', 'b', 'c').allow(''),
  edit_url: Joi.string().uri().allow(''),
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
  below_text: Joi.string().allow('', null).default(''),
  svc1_name: Joi.string().allow(''),
  svc2_name: Joi.string().allow(''),
  svc3_name: Joi.string().allow(''),
  svc4_name: Joi.string().allow(''),
  bottom_cta_headline: Joi.string().allow(''),
  bottom_cta_url: Joi.string().allow(''),
  bottom_cta_text: Joi.string().allow(''),
  bottom_cta_link_text: Joi.string().allow(''),
  bottom_cta_link_url: Joi.string().allow(''),
  nc_order: Joi.number().allow(null),
  Status: Joi.string().allow('', null),
  DraftURL: Joi.string().allow('', null)
}).unknown(true);

const pantelopeSchema = Joi.object({
  page_design: Joi.string().valid('e').default('e'),
  create_new: Joi.boolean().default(false),
  edit_url: Joi.string().uri().allow(''),
  source_markdown: Joi.string().allow(''),
  slug: Joi.string().allow(''),
  town: Joi.string().allow(''),
  header_headline: Joi.string().required(),
  seo_title: Joi.string().allow(''),
  seo_meta_description: Joi.string().allow(''),
  seo_h1: Joi.string().allow(''),
  pantelope_hero_headline: Joi.string().required(),
  hero_excerpt: Joi.string().required(),
  hero_btn1_text: Joi.string().required(),
  hero_btn1_url: Joi.string().required(),
  pantelope_services_headline: Joi.string().allow(''),
  pantelope_services: Joi.array().items(pantelopeServiceSchema).length(4).required(),
  owner_area_headline: Joi.string().required(),
  owner_area_phone_text: Joi.string().allow('').required(),
  owner_area_html: Joi.string().required(),
  owner_area_cta_text: Joi.string().required(),
  owner_area_cta_url: Joi.string().required(),
  notes: Joi.alternatives().try(Joi.string(), Joi.object(), Joi.array()).allow(null)
}).unknown(true);

const app = express();
app.use(express.json({ limit: '10mb' }));

async function initializeQueue() {
  if (!queue) {
    try {
      const PQueue = (await import('p-queue')).default;
      queue = new PQueue({
        concurrency: 3
      });
    } catch (error) {
      logger.warn(`p-queue unavailable, using inline queue fallback: ${error.message}`);
      queue = {
        size: 0,
        pending: 0,
        concurrency: 1,
        isPaused: false,
        async add(task) {
          this.pending += 1;
          try {
            return await task();
          } finally {
            this.pending -= 1;
          }
        },
        on() {}
      };
    }

    queue.on?.('add', () => {
      logger.info(`Job added to queue. Size: ${queue.size}, Running: ${queue.pending}`);
    });

    queue.on?.('idle', () => {
      logger.info('Queue is idle - all jobs completed');
    });

    logger.info('Queue initialized successfully');
  }

  return queue;
}

function getProvidedSecret(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length);
  }
  return req.headers['x-webhook-secret'];
}

function assertRequestAuthorized(req) {
  if (!process.env.WEBHOOK_SECRET) {
    return;
  }

  const providedSecret = getProvidedSecret(req);
  if (providedSecret !== process.env.WEBHOOK_SECRET) {
    throw new ApiError(401, 'unauthorized', 'Unauthorized');
  }
}

function getLoginUrl() {
  return process.env.WP_ADMIN_URL.replace(/\/wp-admin(?:\/index\.php)?$/, '/wp-login.php');
}

function normalizePayload(input) {
  let data = input;
  if (data?.rows && Array.isArray(data.rows) && data.rows.length > 0) {
    data = data.rows[0];
  }

  if (data && typeof data === 'object') {
    data = { ...data };

    if ('below_text' in data && !('below_content' in data)) {
      data.below_content = data.below_text;
      delete data.below_text;
    }

    if ('below_form' in data && !('below_content' in data)) {
      data.below_content = data.below_form;
      delete data.below_form;
    }
  }

  return data;
}

function parseBooleanFlag(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value !== 'string') return false;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function applyRequestOptions(req, payload) {
  const queryDryRun = parseBooleanFlag(req.query?.dryRun || req.query?.dry_run);
  const headerDryRun = parseBooleanFlag(req.headers['x-dry-run']);
  const bodyDryRun = parseBooleanFlag(payload?.dry_run || payload?.dryRun);

  return {
    ...payload,
    dry_run: queryDryRun || headerDryRun || bodyDryRun
  };
}

function acceptedButNotApplied(payload) {
  const accepted = ['seo_title', 'seo_meta_description', 'seo_h1', 'notes'];
  return accepted.filter((key) => payload[key] !== undefined);
}

function authRequiredError(message = 'WordPress authentication is required before page automation can run.') {
  return new ApiError(412, 'auth_required', message, {
    next: '/auth/init'
  });
}

function verificationRequiredError(record, message) {
  const next = record.status === 'poll_timeout' ? '/auth/complete' : `/auth/status/${record.token}`;

  return new ApiError(409, 'verification_required', message || 'WordPress login verification is still pending.', {
    next,
    authToken: record.token,
    auth: authStore.toPublicAuthSession(record)
  });
}

async function createBrowserSession(storageState) {
  const browser = await chromium.launch(browserConfig.getBrowserConfig());
  const contextConfig = browserConfig.getContextConfig();
  if (storageState) {
    contextConfig.storageState = storageState;
  }

  const context = await browser.newContext(contextConfig);
  const { addHumanBehavior } = await browserConfig.applyStealthMode(context);
  const page = await context.newPage();

  return {
    browser,
    context,
    page,
    addHumanBehavior
  };
}

async function closeBrowserSession(session) {
  await session.browser.close();
}

async function isAuthenticated(page) {
  const dashboardVisible = await page.locator('#adminmenu').isVisible().catch(() => false);
  if (dashboardVisible) return true;

  const currentUrl = page.url();
  return currentUrl.includes('/wp-admin/') && !currentUrl.includes('wp-login.php');
}

async function detectVerificationRequired(page) {
  const bodyText = (await page.locator('body').textContent().catch(() => '')) || '';
  const currentUrl = page.url();

  return (
    /verification required/i.test(bodyText) ||
    /verify a login attempt/i.test(bodyText) ||
    /verify and log in/i.test(bodyText) ||
    currentUrl.includes('wfls-email-verification=')
  );
}

async function openWordPressAdmin(page) {
  await page.goto(process.env.WP_ADMIN_URL, {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });
  await page.waitForTimeout(1500);
}

async function fillLoginForm(page) {
  await page.goto(getLoginUrl(), {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });
  await page.waitForTimeout(1000);

  await page.fill('#user_login', process.env.WP_USERNAME);
  await page.fill('#user_pass', process.env.WP_PASSWORD);

  const rememberMe = page.locator('#rememberme');
  if (await rememberMe.count()) {
    const checked = await rememberMe.isChecked().catch(() => false);
    if (!checked) {
      await rememberMe.check().catch(() => {});
    }
  }

  await page.click('#wp-submit');
}

async function completeAuthVerification(record, verificationUrl, meta = {}) {
  const session = await createBrowserSession(record.storageState);

  try {
    await session.page.goto(verificationUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await session.page.waitForTimeout(2500);
    await openWordPressAdmin(session.page);

    if (!(await isAuthenticated(session.page))) {
      throw new ApiError(500, 'auth_failed', 'Verification link did not produce an authenticated WordPress session.');
    }

    await browserConfig.saveState(session.context);
    const updatedRecord = await authStore.updateAuthSession(record.token, {
      status: 'authenticated',
      authenticatedAt: new Date().toISOString(),
      verificationSource: meta.source || 'manual',
      verificationMessageId: meta.messageId || null,
      lastError: null
    });

    return updatedRecord;
  } catch (error) {
    await authStore.updateAuthSession(record.token, {
      status: 'auth_failed',
      lastError: error.message
    });
    throw error;
  } finally {
    await closeBrowserSession(session);
  }
}

function startGmailPolling(authToken) {
  if (!gmailClient.isConfigured() || gmailPollers.has(authToken)) {
    return gmailPollers.get(authToken);
  }

  const poller = (async () => {
    const record = await authStore.readAuthSession(authToken);
    if (!record) return;

    await authStore.updateAuthSession(authToken, {
      status: 'polling_gmail',
      pollStartedAt: new Date().toISOString(),
      lastError: null
    });

    try {
      const result = await gmailClient.pollForVerificationEmail({
        afterTimestamp: Date.parse(record.loginAttemptedAt || record.createdAt),
        timeoutMs: GMAIL_POLL_TIMEOUT_MS,
        intervalMs: GMAIL_POLL_INTERVAL_MS,
        logger
      });

      if (!result) {
        const latestRecord = await authStore.readAuthSession(authToken);
        if (!latestRecord || latestRecord.status === 'authenticated') return;

        await authStore.updateAuthSession(authToken, {
          status: 'poll_timeout',
          lastError: 'Timed out waiting for the WordPress verification email.'
        });
        return;
      }

      const latestRecord = await authStore.readAuthSession(authToken);
      if (!latestRecord || latestRecord.status === 'authenticated') return;

      await authStore.updateAuthSession(authToken, {
        verificationSource: 'gmail',
        verificationMessageId: result.messageId,
        verificationUrlRetrievedAt: new Date().toISOString()
      });

      await completeAuthVerification(latestRecord, result.verificationUrl, {
        source: 'gmail',
        messageId: result.messageId
      });
    } catch (error) {
      logger.error(`Gmail polling failed for auth token ${authToken}: ${error.message}`);
      await authStore.updateAuthSession(authToken, {
        status: 'auth_failed',
        lastError: error.message
      }).catch(() => {});
    } finally {
      gmailPollers.delete(authToken);
    }
  })();

  gmailPollers.set(authToken, poller);
  return poller;
}

async function initiateAuthentication() {
  const existingState = await browserConfig.loadState();
  const session = await createBrowserSession(existingState);

  try {
    await session.addHumanBehavior(session.page);
    await openWordPressAdmin(session.page);

    if (await isAuthenticated(session.page)) {
      await browserConfig.saveState(session.context);
      return {
        status: 'authenticated'
      };
    }

    await fillLoginForm(session.page);
    await session.page.waitForTimeout(2500);

    if (await isAuthenticated(session.page)) {
      await browserConfig.saveState(session.context);
      return {
        status: 'authenticated'
      };
    }

    const storageState = await session.context.storageState();
    if (await detectVerificationRequired(session.page)) {
      const record = await authStore.createAuthSession({
        status: gmailClient.isConfigured() ? 'polling_gmail' : 'verification_required',
        loginAttemptedAt: new Date().toISOString(),
        storageState
      });

      if (gmailClient.isConfigured()) {
        startGmailPolling(record.token);
      }

      return {
        status: gmailClient.isConfigured() ? 'polling_gmail' : 'verification_required',
        authToken: record.token,
        expiresAt: record.expiresAt,
        pollIntervalMs: gmailClient.isConfigured() ? GMAIL_POLL_INTERVAL_MS : undefined
      };
    }

    throw new ApiError(500, 'auth_failed', 'WordPress login failed before verification could be completed.');
  } finally {
    await closeBrowserSession(session);
  }
}

async function getBlockingAuthSessionOrNull() {
  await authStore.pruneExpiredAuthSessions();
  return authStore.findLatestBlockingAuthSession();
}

async function runLandingJob(payload) {
  const savedState = await browserConfig.loadState();
  const blockingAuth = await getBlockingAuthSessionOrNull();
  if (!savedState) {
    if (blockingAuth) {
      throw verificationRequiredError(
        blockingAuth,
        blockingAuth.status === 'poll_timeout'
          ? 'WordPress verification email polling timed out. Complete verification manually or restart authentication.'
          : 'WordPress login verification is still pending.'
      );
    }

    throw authRequiredError();
  }

  const session = await createBrowserSession(savedState);
  const formFiller = new WordPressFormFiller();

  try {
    await session.addHumanBehavior(session.page);
    await openWordPressAdmin(session.page);

    if (!(await isAuthenticated(session.page))) {
      if (blockingAuth) {
        throw verificationRequiredError(
          blockingAuth,
          blockingAuth.status === 'poll_timeout'
            ? 'WordPress verification email polling timed out. Complete verification manually or restart authentication.'
            : 'WordPress login verification is still pending.'
        );
      }

      throw authRequiredError('Saved WordPress session is missing or expired. Re-run /auth/init.');
    }

    if (blockingAuth) {
      await authStore.deleteAuthSession(blockingAuth.token);
    }

    const result = await formFiller.fillCompleteForm(session.page, payload);
    await browserConfig.saveState(session.context);
    return result;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw error;
  } finally {
    await closeBrowserSession(session);
  }
}

function validatePayload(schema, data) {
  const { error, value } = schema.validate(data, {
    abortEarly: false
  });

  if (error) {
    throw new ApiError(400, 'invalid_payload', 'Invalid payload', {
      details: error.details
    });
  }

  return value;
}

function validatePantelopeEditPayload(data) {
  const value = validatePayload(pantelopeSchema, {
    ...data,
    page_design: 'e',
    create_new: false
  });

  if (!value.edit_url && !value.source_markdown && !value.slug && !value.town) {
    throw new ApiError(
      400,
      'invalid_payload',
      'Pantelope edit requests require edit_url or enough fallback discovery input (source_markdown, slug, or town).'
    );
  }

  return value;
}

function validatePantelopeNewPayload(data) {
  if (data.edit_url) {
    throw new ApiError(400, 'invalid_payload', 'Pantelope new requests do not accept edit_url.');
  }

  return validatePayload(pantelopeSchema, {
    ...data,
    page_design: 'e',
    create_new: true,
    edit_url: ''
  });
}

function validateLegacyPayload(data) {
  return validatePayload(legacySchema, {
    ...data,
    page_design: 'c'
  });
}

function buildPageResponse(result, payload) {
  return {
    success: true,
    message: result.message,
    editUrl: result.editUrl || null,
    publicUrl: result.publicUrl || null,
    previewUrl: result.previewUrl || null,
    dryRun: Boolean(result.dryRun),
    savePerformed: typeof result.savePerformed === 'boolean' ? result.savePerformed : !result.dryRun,
    saveSkippedReason: result.saveSkippedReason || null,
    acceptedButNotApplied: acceptedButNotApplied(payload),
    timestamp: new Date().toISOString()
  };
}

function handleApiError(res, error) {
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: error.code || 'internal_error',
    message: error.message,
    ...(error.extra || {})
  });
}

async function queueLandingJob(payload, res) {
  await initializeQueue();
  const result = await queue.add(() => runLandingJob(payload));
  res.status(200).json(buildPageResponse(result, payload));
}

app.post('/auth/init', async (req, res) => {
  try {
    assertRequestAuthorized(req);
    const result = await initiateAuthentication();

    if (result.status === 'authenticated') {
      return res.status(200).json({
        success: true,
        status: 'authenticated',
        timestamp: new Date().toISOString()
      });
    }

    return res.status(202).json({
      success: true,
      ...result,
      next: result.status === 'polling_gmail' ? `/auth/status/${result.authToken}` : '/auth/complete',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Auth init failed:', error);
    handleApiError(res, error);
  }
});

app.post('/auth/complete', async (req, res) => {
  try {
    assertRequestAuthorized(req);

    const authToken = req.body?.authToken;
    const verificationUrl = req.body?.verificationUrl;

    if (!authToken || !verificationUrl) {
      throw new ApiError(400, 'invalid_payload', 'authToken and verificationUrl are required.');
    }

    const record = await authStore.readAuthSession(authToken);
    if (!record) {
      throw new ApiError(404, 'auth_not_found', 'Auth token not found or expired.');
    }

    const updated = await completeAuthVerification(record, verificationUrl, {
      source: 'manual'
    });

    res.status(200).json({
      success: true,
      status: 'authenticated',
      authToken,
      auth: authStore.toPublicAuthSession(updated),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Auth completion failed:', error);
    handleApiError(res, error);
  }
});

app.get('/auth/status/:authToken', async (req, res) => {
  try {
    assertRequestAuthorized(req);
    const record = await authStore.readAuthSession(req.params.authToken);
    if (!record) {
      throw new ApiError(404, 'auth_not_found', 'Auth token not found or expired.');
    }

    if (gmailClient.isConfigured() && (record.status === 'verification_required' || record.status === 'polling_gmail')) {
      startGmailPolling(record.token);
    }

    res.status(200).json({
      success: true,
      auth: authStore.toPublicAuthSession(record),
      pollIntervalMs: record.status === 'polling_gmail' ? GMAIL_POLL_INTERVAL_MS : undefined,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Auth status failed:', error);
    handleApiError(res, error);
  }
});

app.post('/pages/pantelope/edit', async (req, res) => {
  try {
    assertRequestAuthorized(req);
    const payload = validatePantelopeEditPayload(applyRequestOptions(req, normalizePayload(req.body)));
    await queueLandingJob(payload, res);
  } catch (error) {
    logger.error('Pantelope edit request failed:', error);
    handleApiError(res, error);
  }
});

app.post('/pages/pantelope/new', async (req, res) => {
  try {
    assertRequestAuthorized(req);
    const payload = validatePantelopeNewPayload(applyRequestOptions(req, normalizePayload(req.body)));
    await queueLandingJob(payload, res);
  } catch (error) {
    logger.error('Pantelope new request failed:', error);
    handleApiError(res, error);
  }
});

app.post('/pages/legacy/new', async (req, res) => {
  try {
    assertRequestAuthorized(req);
    const payload = validateLegacyPayload(applyRequestOptions(req, normalizePayload(req.body)));
    await queueLandingJob(payload, res);
  } catch (error) {
    logger.error('Legacy request failed:', error);
    handleApiError(res, error);
  }
});

// Backwards-compatible alias for the original generic route.
app.post('/create-landing', async (req, res) => {
  try {
    assertRequestAuthorized(req);
    const payload = validateLegacyPayload(applyRequestOptions(req, normalizePayload(req.body)));
    await queueLandingJob(payload, res);
  } catch (error) {
    logger.error('Legacy alias request failed:', error);
    handleApiError(res, error);
  }
});

app.get('/health', async (req, res) => {
  const blockingAuth = await getBlockingAuthSessionOrNull();
  const queueStats = queue ? {
    size: queue.size,
    pending: queue.pending,
    concurrency: queue.concurrency,
    isPaused: queue.isPaused
  } : {
    status: 'not_initialized'
  };

  res.status(200).json({
    status: 'healthy',
    version: '2.0.0',
    queue: queueStats,
    auth: {
      blockingStatus: blockingAuth?.status || null,
      gmailConfigured: gmailClient.isConfigured()
    },
    system: {
      memoryUsage: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
      uptime: `${Math.round(process.uptime())} seconds`
    },
    timestamp: new Date().toISOString()
  });
});

app.post('/test', async (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(404).send('Not found');
  }

  try {
    assertRequestAuthorized(req);

    const payload = validateLegacyPayload({
      header_headline: `Test Landing Page ${Date.now()}`,
      page_design: 'c',
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
      bottom_cta_text: 'Schedule Your Free Consultation',
      dry_run: parseBooleanFlag(req.query?.dryRun || req.query?.dry_run || req.headers['x-dry-run'])
    });

    await queueLandingJob(payload, res);
  } catch (error) {
    logger.error('Test request failed:', error);
    handleApiError(res, error);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`WP Filler server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Headless mode: ${process.env.HEADLESS === 'true'}`);
});
