#!/usr/bin/env node
/** Local preview only: writes real receipts to private local files, never simulates production saves. */
import http from 'node:http';
import { mkdir, readFile, open, realpath, link, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ContractError, MAX_REQUEST_BYTES, validatePublicInquiryInput } from './src/contract.mjs';
import { ReceiverError, SerialWriter, StoredRateLimiter, receiveInquiry } from './src/core.mjs';
import { errorResponse, jsonResponse } from './src/worker.mjs';

const serviceDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryDirectory = path.resolve(serviceDirectory, '../..');
export class LocalInboxRepository {
  constructor(directory) { this.directory = path.resolve(directory); }
  async assertPrivate() {
    const publicDirectory = path.join(repositoryDirectory, 'docs');
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const resolved = await realpath(this.directory);
    if (resolved === publicDirectory || resolved.startsWith(`${publicDirectory}${path.sep}`)) throw new ReceiverError('configuration_unavailable');
  }
  file(relative) {
    if (!/^data\/inbox\/[a-f0-9]{2}\/[a-f0-9-]{36}\.json$/.test(relative)) throw new ReceiverError('configuration_unavailable');
    return path.join(this.directory, relative);
  }
  async read(relative) {
    try { return JSON.parse(await readFile(this.file(relative), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return null; throw new ReceiverError('stored_record_invalid'); }
  }
  async create(relative, record) {
    const file = this.file(relative); await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    const temporary = `${file}.${crypto.randomUUID()}.tmp`;
    let handle;
    try {
      handle = await open(temporary, 'wx', 0o600);
      await handle.writeFile(JSON.stringify(record, null, 2) + '\n', 'utf8'); await handle.sync();
      await handle.close(); handle = null;
      // Atomic immutable publish: partial writes are never visible at the final receipt path.
      await link(temporary, file);
      const directory = await open(path.dirname(file), 'r');
      try { await directory.sync(); } finally { await directory.close(); }
    }
    catch (error) { if (error.code === 'EEXIST') { const conflict = new ReceiverError('repository_conflict', 409); conflict.upstreamStatus = 409; throw conflict; } throw error; }
    finally { if (handle) await handle.close(); await rm(temporary, { force: true }); }
  }
}
export class MemoryRateStorage {
  constructor() { this.values = new Map(); }
  async transaction(task) { return task(this); }
  async get(key) { return this.values.get(key); }
  async put(key, value) { this.values.set(key, value); }
}

export function createLocalReceiver({ directory = path.join(serviceDirectory, '.local-data'), catalogPath, privacyNoticeVersion = 'local-preview-v1', origins = ['http://127.0.0.1:4173', 'http://localhost:4173'], now = () => new Date() } = {}) {
  if (!catalogPath) throw new Error('Local preview needs an explicit --catalog JSON path.');
  if (!origins.every(value => { try { const url = new URL(value); return ['127.0.0.1', 'localhost'].includes(url.hostname) && url.protocol === 'http:' && url.origin === value; } catch { return false; } })) throw new Error('Local preview only accepts configured loopback origins.');
  const repository = new LocalInboxRepository(directory), writer = new SerialWriter(), rateLimiter = new StoredRateLimiter(new MemoryRateStorage(), { perSource: 60, global: 120, windowSeconds: 600 });
  return http.createServer(async (req, res) => {
    let origin = null;
    const send = async response => { res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer())); };
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname === '/health' && req.method === 'GET') return await send(jsonResponse({ status: 'local_preview', persistence: 'private_local_files' }));
      if (url.pathname !== '/v1/consultas') return await send(jsonResponse({ error: 'not_found' }, 404));
      if (!origins.includes(req.headers.origin)) throw new ReceiverError('origin_not_allowed', 403);
      origin = req.headers.origin;
      if (req.method === 'OPTIONS') {
        if (req.headers['access-control-request-method'] !== 'POST' || (req.headers['access-control-request-headers'] || '').split(',').some(header => header.trim() && header.trim().toLowerCase() !== 'content-type')) throw new ReceiverError('origin_not_allowed', 403);
        const headers = new Headers(jsonResponse({}, 200, { origin }).headers); return await send(new Response(null, { status: 204, headers }));
      }
      if (req.method !== 'POST') throw new ReceiverError('method_not_allowed', 405);
      if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new ReceiverError('unsupported_media_type', 415);
      if (Number(req.headers['content-length']) > MAX_REQUEST_BYTES) throw new ReceiverError('request_too_large', 413);
      const chunks = []; let size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > MAX_REQUEST_BYTES) throw new ReceiverError('request_too_large', 413); chunks.push(chunk); }
      let raw;
      try { raw = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new ReceiverError('invalid_input', 400); }
      const input = validatePublicInquiryInput(raw);
      const result = await writer.run(() => receiveInquiry(input, { repository, verifyAntiAbuse: async token => token === 'local-development-only', loadCatalog: async () => JSON.parse(await readFile(catalogPath, 'utf8')), rateLimiter, rateKey: 'local-preview', privacyNoticeVersion, now }));
      await send(jsonResponse(result.receipt, result.statusCode, { origin }));
    } catch (error) { await send(errorResponse(error, origin)); }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (!args.includes('--enable-local')) { process.stderr.write('Use --enable-local explicitly. This receiver is only a private local preview.\n'); process.exit(1); }
  const flag = (name, fallback) => { const index = args.indexOf(name); if (index < 0) return fallback; if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`Missing ${name} value.`); return args[index + 1]; };
  const catalogPath = path.resolve(flag('--catalog', path.join(repositoryDirectory, 'site-src/content/catalog-public.json')));
  const origins = flag('--origins', 'http://127.0.0.1:4173,http://localhost:4173').split(',');
  const port = Number(flag('--port', '8787'));
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid local port.');
  const server = createLocalReceiver({ directory: flag('--data-dir', path.join(serviceDirectory, '.local-data')), catalogPath, privacyNoticeVersion: flag('--privacy-version', 'local-preview-v1'), origins });
  server.listen(port, '127.0.0.1', () => process.stdout.write(`Local receiver http://127.0.0.1:${port}/v1/consultas · persistent private local files; production GitHub reception is not enabled.\n`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
}
