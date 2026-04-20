const axios = require('axios');

const GMAIL_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_API_BASE_URL = 'https://gmail.googleapis.com/gmail/v1';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isConfigured() {
  return Boolean(
    process.env.GMAIL_CLIENT_ID &&
    process.env.GMAIL_CLIENT_SECRET &&
    process.env.GMAIL_REFRESH_TOKEN &&
    process.env.GMAIL_USER
  );
}

function decodeBase64Url(value) {
  if (!value) return '';
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, 'base64').toString('utf8');
}

function flattenBodies(part, collector = { textPlain: [], textHtml: [] }) {
  if (!part) return collector;

  if (part.mimeType === 'text/plain' && part.body?.data) {
    collector.textPlain.push(decodeBase64Url(part.body.data));
  }

  if (part.mimeType === 'text/html' && part.body?.data) {
    collector.textHtml.push(decodeBase64Url(part.body.data));
  }

  if (Array.isArray(part.parts)) {
    part.parts.forEach((child) => flattenBodies(child, collector));
  }

  return collector;
}

function extractDirectVerificationUrl(text) {
  if (!text) return null;
  const match = text.match(/https:\/\/[^\s"'<>)]*wfls-email-verification=[^\s"'<>)]+/i);
  return match ? match[0].replace(/&amp;/g, '&') : null;
}

function extractFromMandrillTrackedUrl(html) {
  if (!html) return null;

  const trackedLinks = html.match(/https:\/\/mandrillapp\.com\/track\/click\/[^\s"'<>]+/gi) || [];
  for (const trackedLink of trackedLinks) {
    try {
      const url = new URL(trackedLink);
      const payload = url.searchParams.get('p');
      if (!payload) continue;

      const outer = JSON.parse(decodeBase64Url(payload));
      const inner = typeof outer.p === 'string' ? JSON.parse(outer.p) : outer.p;
      const directUrl = inner?.url;
      if (directUrl && directUrl.includes('wfls-email-verification=')) {
        return directUrl.replace(/\\\//g, '/');
      }
    } catch (error) {
      // Keep scanning other tracked links.
    }
  }

  return null;
}

async function fetchAccessToken() {
  const response = await axios.post(
    GMAIL_TOKEN_URL,
    new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID,
      client_secret: process.env.GMAIL_CLIENT_SECRET,
      refresh_token: process.env.GMAIL_REFRESH_TOKEN,
      grant_type: 'refresh_token'
    }).toString(),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );

  return response.data.access_token;
}

async function listRecentMessages(accessToken) {
  const userId = encodeURIComponent(process.env.GMAIL_USER);
  const query = process.env.GMAIL_VERIFICATION_QUERY || 'from:wordpress@firstlighthomecare.com subject:"Login Verification Required" newer_than:1d';

  const response = await axios.get(`${GMAIL_API_BASE_URL}/users/${userId}/messages`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    params: {
      q: query,
      maxResults: parseInt(process.env.GMAIL_VERIFICATION_MAX_RESULTS, 10) || 10
    }
  });

  return response.data.messages || [];
}

async function getMessage(accessToken, messageId) {
  const userId = encodeURIComponent(process.env.GMAIL_USER);

  const response = await axios.get(`${GMAIL_API_BASE_URL}/users/${userId}/messages/${messageId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    params: {
      format: 'full'
    }
  });

  return response.data;
}

async function findVerificationEmail(afterTimestamp) {
  if (!isConfigured()) return null;

  const accessToken = await fetchAccessToken();
  const messages = await listRecentMessages(accessToken);

  for (const candidate of messages) {
    const message = await getMessage(accessToken, candidate.id);
    const internalDate = parseInt(message.internalDate, 10);
    if (Number.isFinite(afterTimestamp) && internalDate < afterTimestamp) {
      continue;
    }

    const flattened = flattenBodies(message.payload);
    const plainText = flattened.textPlain.join('\n');
    const html = flattened.textHtml.join('\n');

    const verificationUrl =
      extractDirectVerificationUrl(plainText) ||
      extractDirectVerificationUrl(html) ||
      extractFromMandrillTrackedUrl(html);

    if (!verificationUrl) {
      continue;
    }

    return {
      messageId: message.id,
      internalDate,
      verificationUrl
    };
  }

  return null;
}

async function pollForVerificationEmail({ afterTimestamp, timeoutMs, intervalMs, logger }) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const result = await findVerificationEmail(afterTimestamp);
    if (result) {
      return result;
    }

    logger?.debug?.('Verification email not found yet; polling Gmail again');
    await sleep(intervalMs);
  }

  return null;
}

module.exports = {
  findVerificationEmail,
  isConfigured,
  pollForVerificationEmail
};
