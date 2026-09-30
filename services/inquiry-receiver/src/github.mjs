import { ReceiverError } from './core.mjs';

const HEADERS = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'Mabell-Ramos-inquiry-receiver' };
export function encodeBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 4096) binary += String.fromCharCode(...bytes.subarray(index, index + 4096));
  return btoa(binary);
}
function decodeBase64(value) { return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(value.replace(/\s/g, '')), x => x.charCodeAt(0))); }
const safePath = value => /^data\/inbox\/[a-f0-9]{2}\/[a-f0-9-]{36}\.json$/.test(value);
function upstreamError(response) {
  const error = new ReceiverError('repository_unavailable', 503);
  error.upstreamStatus = response.status;
  const retry = Number(response.headers.get('retry-after'));
  if (Number.isFinite(retry) && retry > 0) error.retryAfter = Math.min(Math.ceil(retry), 3600);
  return error;
}
export class GitHubInboxRepository {
  constructor({ repository, token, branch = 'main', fetcher = fetch }) { this.repository = repository; this.token = token; this.branch = branch; this.fetcher = fetcher; }
  async request(path, { method = 'GET', body } = {}) {
    try {
      return await this.fetcher(`https://api.github.com/repos/${this.repository}${path}`, { method, headers: { ...HEADERS, Authorization: `Bearer ${this.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, redirect: 'error', signal: AbortSignal.timeout(12000) });
    } catch { throw new ReceiverError('repository_unavailable', 503, null, 30); }
  }
  async assertPrivate() {
    const response = await this.request('');
    if (!response.ok) throw upstreamError(response);
    const metadata = await response.json();
    if (metadata.private !== true || metadata.archived || metadata.disabled || metadata.full_name?.toLowerCase() !== this.repository.toLowerCase()) throw new ReceiverError('repository_not_private');
  }
  async read(path) {
    if (!safePath(path)) throw new ReceiverError('configuration_unavailable');
    const response = await this.request(`/contents/${path}?ref=${encodeURIComponent(this.branch)}`);
    if (response.status === 404) return null;
    if (!response.ok) throw upstreamError(response);
    const file = await response.json();
    if (file.type !== 'file' || file.encoding !== 'base64' || typeof file.content !== 'string' || !Number.isSafeInteger(file.size) || file.size > 32768 || file.path !== path) throw new ReceiverError('stored_record_invalid');
    try { return JSON.parse(decodeBase64(file.content)); } catch { throw new ReceiverError('stored_record_invalid'); }
  }
  async create(path, record) {
    if (!safePath(path)) throw new ReceiverError('configuration_unavailable');
    const content = JSON.stringify(record, null, 2) + '\n';
    if (new TextEncoder().encode(content).length > 32768) throw new ReceiverError('stored_record_invalid');
    const response = await this.request(`/contents/${path}`, { method: 'PUT', body: { message: `Receive inquiry ${record.requestId}`, content: encodeBase64(content), branch: this.branch } });
    if (response.status !== 201) throw upstreamError(response);
    // The core verifies the persisted record with a subsequent independent read.
  }
}
