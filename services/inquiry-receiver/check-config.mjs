#!/usr/bin/env node
import { readConfiguration, loadConfiguredCatalog } from './src/config.mjs';
import { GitHubInboxRepository } from './src/github.mjs';

// Values are never printed. Node --env-file=.dev.vars can supply server configuration.
const required = ['ALLOWED_ORIGINS', 'TURNSTILE_HOSTNAMES', 'GITHUB_REPOSITORY', 'GITHUB_TOKEN', 'TURNSTILE_SECRET', 'RATE_HASH_SECRET', 'PRIVACY_NOTICE_VERSION', 'PRIVACY_CONTACT', 'RETENTION_DAYS'];
const missing = required.filter(key => !process.env[key]);
if (missing.length || !process.env.PUBLIC_CATALOG_URL && !process.env.PUBLIC_CATALOG_JSON) {
  process.stderr.write(`Receiver configuration is incomplete: ${[...missing, ...(!process.env.PUBLIC_CATALOG_URL && !process.env.PUBLIC_CATALOG_JSON ? ['PUBLIC_CATALOG_URL or PUBLIC_CATALOG_JSON'] : [])].join(', ')}.\n`);
  process.exitCode = 1;
} else if (process.env.RECEIVER_ENABLED !== 'true') {
  process.stdout.write('Receiver is deliberately disabled. No production inquiry can be accepted.\n');
} else {
  try {
    const config = readConfiguration(process.env);
    await loadConfiguredCatalog(config);
    if (process.argv.includes('--check-github')) await new GitHubInboxRepository(config).assertPrivate();
    process.stdout.write(`Receiver configuration valid; commercial snapshot readable.${process.argv.includes('--check-github') ? ' Private reception repository confirmed.' : ' GitHub access not checked (add --check-github).'} No writes performed.\n`);
  } catch {
    process.stderr.write('Receiver validation failed. Review configuration, published commercial JSON and private GitHub access; no writes performed.\n');
    process.exitCode = 1;
  }
}
