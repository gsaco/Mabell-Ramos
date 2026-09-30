import { validateAttentionRule } from './contract.mjs';
import { ReceiverError } from './core.mjs';

function configError() { throw new ReceiverError('configuration_unavailable'); }
function list(value, validator) {
  try { const result = JSON.parse(value); if (!Array.isArray(result) || !result.length || result.length > 20 || !result.every(validator)) configError(); return result; } catch { configError(); }
}
export function readConfiguration(env) {
  if (env.RECEIVER_ENABLED !== 'true') throw new ReceiverError('receiver_disabled');
  const origins = list(env.ALLOWED_ORIGINS, value => {
    try { const url = new URL(value); return url.protocol === 'https:' && url.origin === value && !url.username && !url.password; } catch { return false; }
  });
  const hostnames = list(env.TURNSTILE_HOSTNAMES, value => typeof value === 'string' && /^[a-z0-9.-]+$/i.test(value) && !value.includes('..'));
  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(env.GITHUB_REPOSITORY ?? '') || typeof env.GITHUB_TOKEN !== 'string' || env.GITHUB_TOKEN.length < 20 || typeof env.TURNSTILE_SECRET !== 'string' || env.TURNSTILE_SECRET.length < 10 || typeof env.RATE_HASH_SECRET !== 'string' || env.RATE_HASH_SECRET.length < 32) configError();
  const branch = env.GITHUB_BRANCH || 'main';
  if (!/^[a-zA-Z0-9._/-]{1,160}$/.test(branch) || branch.includes('..') || branch.startsWith('/') || branch.endsWith('/')) configError();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,95}$/.test(env.PRIVACY_NOTICE_VERSION ?? '') || !Number.isInteger(Number(env.RETENTION_DAYS)) || Number(env.RETENTION_DAYS) < 1 || Number(env.RETENTION_DAYS) > 3650 || !env.PRIVACY_CONTACT || env.PRIVACY_CONTACT.length > 254) configError();
  if (Boolean(env.PUBLIC_CATALOG_JSON) === Boolean(env.PUBLIC_CATALOG_URL)) configError();
  let catalogUrl = null;
  if (env.PUBLIC_CATALOG_URL) {
    try { const url = new URL(env.PUBLIC_CATALOG_URL); if (url.protocol !== 'https:' || url.username || url.password || url.hash) configError(); catalogUrl = url.href; } catch { configError(); }
  }
  let attentionRule = null;
  try { if (env.ATTENTION_RULE_JSON) attentionRule = validateAttentionRule(JSON.parse(env.ATTENTION_RULE_JSON)); } catch { configError(); }
  const perSource = Number(env.RATE_PER_SOURCE || 6), global = Number(env.RATE_GLOBAL || 60), windowSeconds = Number(env.RATE_WINDOW_SECONDS || 600);
  if (![perSource, global, windowSeconds].every(Number.isSafeInteger) || perSource < 1 || perSource > 1000 || global < perSource || global > 10000 || windowSeconds < 60 || windowSeconds > 3600) configError();
  return { origins, hostnames, repository: env.GITHUB_REPOSITORY, token: env.GITHUB_TOKEN, branch, turnstileSecret: env.TURNSTILE_SECRET, hashSecret: env.RATE_HASH_SECRET, privacyNoticeVersion: env.PRIVACY_NOTICE_VERSION, attentionRule, catalogUrl, catalogJson: env.PUBLIC_CATALOG_JSON || null, rate: { perSource, global, windowSeconds } };
}
export async function loadConfiguredCatalog(config, fetcher = fetch) {
  let catalog;
  try {
    if (config.catalogJson) catalog = JSON.parse(config.catalogJson);
    else {
      const response = await fetcher(config.catalogUrl, { headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' }, redirect: 'error', signal: AbortSignal.timeout(10000) });
      if (!response.ok) configError();
      const text = await response.text();
      if (new TextEncoder().encode(text).length > 1024 * 1024) configError();
      catalog = JSON.parse(text);
    }
    if (catalog?.schemaVersion !== 1 || typeof catalog.version !== 'string' || !Array.isArray(catalog.options)) configError();
    return catalog;
  } catch { configError(); }
}

export async function verifyTurnstile(token, requestId, config, fetcher = fetch) {
  try {
    // New bot tokens for the same logical inquiry need a distinct verification key.
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${requestId}:${token}`)));
    digest[6] = digest[6] & 0x0f | 0x40; digest[8] = digest[8] & 0x3f | 0x80;
    const hex = [...digest.subarray(0, 16)].map(x => x.toString(16).padStart(2, '0')).join('');
    const verificationId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    const response = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ secret: config.turnstileSecret, response: token, idempotency_key: verificationId }), redirect: 'error', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Anti-abuse service unavailable');
    const result = await response.json();
    return result.success === true && config.hostnames.includes(result.hostname) && result.action === 'public_inquiry';
  } catch { throw new ReceiverError('anti_abuse_unavailable'); }
}

export async function hashRateSource(value, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const hash = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash), x => x.toString(16).padStart(2, '0')).join('');
}
