const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const browserConfig = require('./browser-config');

const AUTH_SESSION_TTL_MINUTES = parseInt(process.env.AUTH_SESSION_TTL_MINUTES, 10) || 15;
const AUTH_SESSION_TTL_MS = AUTH_SESSION_TTL_MINUTES * 60 * 1000;

const BLOCKING_AUTH_STATUSES = new Set([
  'verification_required',
  'polling_gmail',
  'poll_timeout'
]);

function getAuthSessionsDir() {
  return path.join(browserConfig.getStateRootDir(), 'auth-sessions');
}

function getAuthSessionPath(token) {
  return path.join(getAuthSessionsDir(), `${token}.json`);
}

async function ensureAuthSessionsDir() {
  await fs.mkdir(getAuthSessionsDir(), { recursive: true });
}

function isExpired(record) {
  if (!record?.expiresAt) return true;
  return Date.now() > Date.parse(record.expiresAt);
}

function toPublicAuthSession(record) {
  if (!record) return null;

  const {
    storageState,
    verificationUrl,
    ...safeRecord
  } = record;

  return safeRecord;
}

async function writeAuthSession(record) {
  await ensureAuthSessionsDir();
  await fs.writeFile(
    getAuthSessionPath(record.token),
    JSON.stringify(record, null, 2)
  );
  return record;
}

async function pruneExpiredAuthSessions() {
  await ensureAuthSessionsDir();

  const entries = await fs.readdir(getAuthSessionsDir()).catch(() => []);
  await Promise.all(entries.filter((entry) => entry.endsWith('.json')).map(async (entry) => {
    const sessionPath = path.join(getAuthSessionsDir(), entry);

    try {
      const content = await fs.readFile(sessionPath, 'utf8');
      const record = JSON.parse(content);
      if (isExpired(record)) {
        await fs.unlink(sessionPath).catch(() => {});
      }
    } catch (error) {
      await fs.unlink(sessionPath).catch(() => {});
    }
  }));
}

async function createAuthSession(record = {}) {
  await pruneExpiredAuthSessions();

  const now = Date.now();
  const authSession = {
    token: crypto.randomBytes(24).toString('hex'),
    status: record.status || 'verification_required',
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + AUTH_SESSION_TTL_MS).toISOString(),
    ...record
  };

  return writeAuthSession(authSession);
}

async function readAuthSession(token) {
  try {
    const content = await fs.readFile(getAuthSessionPath(token), 'utf8');
    const record = JSON.parse(content);

    if (isExpired(record)) {
      await deleteAuthSession(token);
      return null;
    }

    return record;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function updateAuthSession(token, updates = {}) {
  const current = await readAuthSession(token);
  if (!current) return null;

  const updated = {
    ...current,
    ...updates
  };

  return writeAuthSession(updated);
}

async function deleteAuthSession(token) {
  try {
    await fs.unlink(getAuthSessionPath(token));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

async function listAuthSessions() {
  await pruneExpiredAuthSessions();
  const entries = await fs.readdir(getAuthSessionsDir()).catch(() => []);
  const sessions = await Promise.all(entries.filter((entry) => entry.endsWith('.json')).map(async (entry) => {
    const content = await fs.readFile(path.join(getAuthSessionsDir(), entry), 'utf8');
    return JSON.parse(content);
  }));

  return sessions.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

async function findLatestBlockingAuthSession() {
  const sessions = await listAuthSessions();
  return sessions.find((record) => BLOCKING_AUTH_STATUSES.has(record.status)) || null;
}

module.exports = {
  AUTH_SESSION_TTL_MS,
  BLOCKING_AUTH_STATUSES,
  createAuthSession,
  deleteAuthSession,
  findLatestBlockingAuthSession,
  getAuthSessionsDir,
  pruneExpiredAuthSessions,
  readAuthSession,
  toPublicAuthSession,
  updateAuthSession
};
