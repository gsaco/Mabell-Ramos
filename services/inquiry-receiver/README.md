# Receiver for consumer inquiries

The consumer website remains in `gsaco/Mabell-Ramos` on GitHub Pages. The production receiver is a small server-side gateway that **stores the data in a separate private GitHub repository**, then returns a receipt. The management website reads that private inbox through its authenticated connector. GitHub Pages does not execute a server or protect a GitHub write token in a public form; the optional Worker supplies that server function and does not replace the website hosting.

The complete receiver, contract, private-file local preview and tests are implemented. Production is deliberately disabled until the business sets the private inbox, server credentials, privacy notice and anti-abuse configuration. These are setup values, not invented working credentials. The public site must keep `receiverEndpoint: null` until actual configuration and deployment; an unavailable receiver never reports a saved inquiry.

## Files and commands

| File | Purpose |
|---|---|
| `src/contract.mjs`, `src/contract.d.mts` | Dependency-free runtime contract and TypeScript types shared with the website and management app |
| `src/core.mjs` | Idempotent receipt processing and explicit serial writer |
| `src/github.mjs` | Private repository check, immutable GitHub Contents writes and independent persistence verification |
| `src/worker.mjs` | HTTPS endpoint, exact CORS, bounded input, Durable Object coordinator and rate limits |
| `src/config.mjs` | Server configuration, approved public snapshot and server-side Turnstile verification |
| `local-server.mjs` | Loopback-only development endpoint with real private local files |
| `wrangler.jsonc` | Worker and SQLite-backed Durable Object deployment definition; receiver disabled by default |
| `check-config.mjs` | Configuration checker; optional read-only check of private GitHub access |

From the repository root, `node --test tests/receiver/*.test.mjs` runs the meaningful receiver tests without installing a runtime dependency. The Worker itself has no third-party runtime dependency. Its deployment tool is pinned in this service's `package.json` and `package-lock.json`.

## Local preview with real persistence

Use an explicit development mode:

```sh
node services/inquiry-receiver/local-server.mjs --enable-local \
  --catalog site-src/content/catalog-public.json \
  --origins http://127.0.0.1:4173,http://localhost:4173 \
  --privacy-version local-preview-v1
```

The server binds only to `127.0.0.1:8787`. Additional flags: `--port`, `--data-dir`, `--privacy-version`, `--origins` (comma-separated loopback origins). The consumer development configuration uses that endpoint, `privacyNoticeVersion: "local-preview-v1"` and the development-only `antiAbuseToken: "local-development-only"`. This token has no meaning in production and production Turnstile will reject it.

The receipt is real **local persistence**, not a simulated GitHub write. JSON files are created privately beneath `services/inquiry-receiver/.local-data/data/inbox/`, with restricted file permissions. The directory is ignored by Git and never copied to `docs/`. A restart keeps the receipt and a retry recovers the same reference. The development UI must label this preview; it must not claim that a local inquiry reached the production management site. A public origin cannot call this loopback receiver through its allowed CORS configuration.

The receiver has no read/list endpoint, including in local preview. `GET /health` exists only on the loopback server and reports `local_preview`/`private_local_files`; it exposes no records or directory. If desired, remove local preview files explicitly after testing. No sample contact is included in the source repository.

## Production setup

1. Create or select the **private reception repository**. It must be separate from the public consumer repository and preferably from the private financial/management repository. Use an existing branch, e.g. `main`; initialize an empty private repository with a README if the branch does not exist. All receipts stay in GitHub as requested.
2. Give the receiver its own fine-grained GitHub token with repository contents read/write permission for **only the private reception repository**. Keep the management reader's read-only credentials separate from its operational writer. Set controlled expiry and rotation. Never store these tokens in the consumer site, `VITE_*`, public assets, commits or browser storage.
3. Configure a Turnstile widget for the exact consumer hostname. The browser sends a widget token with action `public_inquiry`; the server independently verifies both hostname and action. The public site key is public configuration. The verification secret is server-only. Token failure cannot produce a receipt.
4. Set a documented notice version, privacy contact and retention policy before accepting real contacts. Provide an agreed attention rule only when Mabel and Ana have defined it; otherwise `attentionRule` remains `null` and management shows the response deadline as pending scheduling.
5. Set the server variables below. The public catalog URL must return the approved versioned JSON, including `schemaVersion: 1`, `version`, `options`, `products` and `catalog: { version, pages }`. General inquiries work with an empty approved option list. Price, availability and variants of option inquiries always come from this server-selected public snapshot. An externally supplied offer or repository path is rejected.
6. In this service directory run `npm ci`, then `npm run bundle` to validate the Worker bundle without deployment. Authenticate the deployment tool to the selected server account and store secrets with `npx wrangler secret put NAME`. Keep `RECEIVER_ENABLED=false` while configuring. Set it to `true` only when the following real configuration is complete and tested.
7. Deploy the receiver using `npm run deploy` in this service directory. This step changes only the form-receiver gateway; GitHub Pages continues to host the consumer web. Test with a separate private staging inbox first.
8. Run an actual inquiry end to end, verify the private JSON, then synchronize the management app and confirm one unconfirmed inquiry appears. Only after this actual test should the public `receiverEndpoint` and Turnstile site key be published.

### Variables and server secrets

| Name | Type | Rule |
|---|---|---|
| `RECEIVER_ENABLED` | Variable | Exact string `true` to enable; defaults to `false` |
| `ALLOWED_ORIGINS` | Variable | JSON list of exact HTTPS origins, e.g. `["https://gsaco.github.io"]`; no wildcard |
| `TURNSTILE_HOSTNAMES` | Variable | JSON list of exact widget hostnames, e.g. `["gsaco.github.io"]` |
| `GITHUB_REPOSITORY` | Variable | `owner/private-inbox` selected by the server |
| `GITHUB_BRANCH` | Variable | Existing private branch; `main` default |
| `GITHUB_TOKEN` | **Secret** | Repository-scoped token for reception only |
| `TURNSTILE_SECRET` | **Secret** | Server verification key |
| `RATE_HASH_SECRET` | **Secret** | At least 32 characters of cryptographically random secret material, independent of other tokens |
| `PUBLIC_CATALOG_URL` | Variable | Exact trusted HTTPS JSON URL; fetched for new inquiries with cache bypass |
| `PUBLIC_CATALOG_JSON` | Alternative variable | Complete JSON snapshot, mutually exclusive with `PUBLIC_CATALOG_URL`; useful for staging |
| `PRIVACY_NOTICE_VERSION` | Variable | Published version ID; new submissions must match it |
| `PRIVACY_CONTACT` | Variable | Responsible contact approved by the business; required configuration, not leaked in receipt |
| `RETENTION_DAYS` | Variable | Business's retention policy, 1–3650 days; not an automatic Git-history erasure setting |
| `RATE_PER_SOURCE` | Variable | New receipts per hashed network source/window; default 6 |
| `RATE_GLOBAL` | Variable | New receipts for the business/window; default 60 |
| `RATE_WINDOW_SECONDS` | Variable | 60–3600 seconds; default 600 |
| `ATTENTION_RULE_JSON` | Optional variable | Complete received-time rule described below; omit until agreed |
| `INQUIRY_WRITER` | Durable Object binding | Automatically bound by the supplied deployment definition |

Copy `.dev.vars.example` to `.dev.vars` only for private local deployment-tool configuration. It is ignored. `node --env-file=.dev.vars check-config.mjs --check-github` checks configuration, fetches the public snapshot and reads repository metadata **without writing**. The checker never prints secret values. Production variables are edited in server configuration; secrets are installed separately. The public endpoint exposes no introspection of missing secrets.

Example complete attention-rule **shape** (the hours are an example, not a commitment by the business):

```json
{"version":"attention-v1","responsible":"Ana","timezone":"America/Lima","responseHours":24,"workDays":[1,2,3,4,5],"workStart":"09:00","workEnd":"18:00"}
```

Days use ISO numbering: Monday 1 to Sunday 7. The rule is included as an immutable receipt-time snapshot. Management derives its deadline according to this rule, keeping it separate from current settings. A subsequent rule change does not change old receipts.

## API and exact contract

`POST /v1/consultas`, with `Content-Type: application/json` and an allowed browser `Origin`. The strict input contract is exported by `src/contract.d.mts`. Body limit: **16 KiB**; message max **500 characters**; district max **80**. Unknown fields at any level are rejected. The optional empty `website` field is the honeypot; it is never stored. A filled trap is rejected. There are no attachments or public reads.

`requestId` is generated once with `crypto.randomUUID()` for one immutable logical submission. The browser keeps that snapshot in memory during retries. Contact changes after an ambiguous submission must first resolve the original receipt, then make a new communication. Dates use `YYYY-MM-DD` in Lima. Unknown dates/attendee counts are `null`; quantity is an integer in the actual sale unit. WhatsApp contact must use a country prefix (`+...`); email can be chosen without a phone. No business WhatsApp number is assumed.

Allowed `source.page`: `/`, `/productos/`, `/catering/`, `/catalogo/`. The frontend removes the GitHub Pages project base before choosing these route labels. `source.campaignCode` is an optional non-personal code; full URLs, arbitrary query strings and personal data in the source field are rejected.

Required relationships:

- `kind: "product_option"` requires `option: {id, revision, quantity}` and no event/catalog object.
- `kind: "catalog_page"` requires `catalog: {version, page}` and no option/event object.
- `kind: "event"` requires the structured event object and no option/catalog object.
- `kind: "product_general"` has no option, event or catalog object.
- `occasion` is optional **declared need**; when absent, an offer's occasion remains inferred navigation context in `offerSnapshot` and does not become a confirmed motive.

### Success

`201` for a new privately persisted file; `200` for a recovered identical receipt:

```json
{"receiptId":"MR-ADF9C8D1-A8C2-4CE1-9EE0-351A33D6297D","receivedAt":"2026-09-29T18:00:00.000Z","status":"received"}
```

The full UUID avoids reference collisions. A receipt is **only an inquiry**, never a reservation, accepted order, sale or payment. The public response never includes a GitHub path, SHA, token, contact echo or another person's record. Responses are `Cache-Control: no-store`.

### Errors

`{"error":"code","field":"optional.field"}`. No raw upstream response or private repository identifier is returned.

| Code | Status | Consumer behavior |
|---|---|---|
| `invalid_input` | 400 | Preserve fields; show error at the indicated field |
| `request_too_large` | 413 | Shorten input without discarding contact data |
| `unsupported_media_type` | 415 | Technical configuration error |
| `origin_not_allowed` | 403 | Technical configuration error; no wildcard fallback |
| `anti_abuse_failed` | 403 | Refresh widget token and retry the same logical ID |
| `anti_abuse_unavailable` | 503 | Preserve data and allow retry |
| `offer_updated`, `option_unavailable`, `catalog_updated` | 409 | Reload commercial data; retain contact fields; resolve already-saved retry first |
| `privacy_updated` | 409 | Present the current notice and ask the visitor to review |
| `request_id_conflict` | 409 | Do not overwrite the previous communication; keep the original immutable snapshot |
| `rate_limited` | 429 | Respect `Retry-After` |
| `receiver_disabled`, `configuration_unavailable`, `repository_not_private` | 503 | Contact alternative; no fake success |
| `repository_unavailable`, `receipt_unconfirmed`, `stored_record_invalid` | 503 | Reception is not confirmed; retry the same ID to check |

## Persistence and concurrency

The server validates/normalizes input, then calculates SHA-256 of the canonical logical content without the anti-abuse token or honeypot. It checks `data/inbox/{first-two-UUID-characters}/{requestId}.json` first. An identical saved record returns its original receipt even after its option, price, date or privacy notice changes. A conflicting payload cannot overwrite it. The bot token is verified only for a new receipt and is never saved.

One named Durable Object uses an explicit mutex around the **complete private check → read → validate new receipt → create → independently read** operation. A global Worker variable does not supply coordination. The GitHub file is the durable source of truth, including after a coordinator restart. Separate files and all IDs are stable; write conflicts retry at most three attempts with bounded waits. Failed or lost upstream replies trigger a re-read. Success depends on verifying the persisted envelope and its hash.

The receiver checks repository metadata before any read/write and refuses public, archived or disabled repositories. A create uses GitHub Contents with no existing-file SHA, so it cannot intentionally replace a received record. The commit message and filename contain only the UUID. No query data is written in the public repository.

Two rate counters limit new writes by hashed technical network source and globally. A wider ingress limit also bounds repeated attempts. IP is not treated as customer identity and never stored raw, forwarded to Turnstile or logged. HMAC uses a server secret. Durable Object rate counters are pruned by alarms; contacts stay only in the private GitHub inbox. Recovered receipts do not consume new-write quota. Logs never include form bodies. CORS constrains browsers but is not authentication; server-side Turnstile and rate limits independently control abuse.

## Management integration

Use the shared runtime `verifyStoredPublicInquiry()` for exhaustive structure and hash validation. The management code is maintained in the sibling `Mabell-Ramos-CRM` repository; copy the unchanged `contract.mjs`/`contract.d.mts` to its domain contract during updates and keep its tests verifying equivalence. Import by `web_${requestId}` and command `import-web:${requestId}`. Receipt files remain immutable. A failed operational save is retried later, without deleting or moving its inbox source.

Read authenticated private Git trees recursively and traverse non-recursive subtrees if the recursive response is truncated; do not rely on Contents directory listings, which can omit files beyond their limit. Import historic receipts, not just today's files. Malformed records remain isolated for technical review, while other valid receipts can be imported. `food_only` maps to Products/event need, `food_and_service` to Catering, `unsure` to undefined scope. No automatically verified phone, joined client, sale, payment, marketing permission or accepted order is created.

## Retention and deletion from Git history

`RETENTION_DAYS` records the agreed retention policy as configuration; it does **not** pretend that deleting a current JSON erases Git history. The owner must schedule review and keep an access register for the private repository. When erasure is required:

1. Verify the request through the responsible contact privately; locate the exact receipt IDs and related management records. Avoid searching or disclosing records through a public endpoint.
2. Pause intake/import while reconciling the specific records and take an access-controlled operational backup only when permitted by the retention policy.
3. Remove the relevant operational contact/receipt references and rewrite the affected private repository history with an established tool such as `git filter-repo`, for the exact receipt paths. Coordinate the history change with every collaborator, then replace affected clones; a simple current-tree delete is insufficient.
4. Address accessible backups, mirrors, local previews, working copies and management history that also contain the personal data. Revoke stale access as required.
5. Verify absence from current and retained histories/copies, record the completed procedure without the erased personal text, and resume reception with a reviewed notice/version when needed.

No automatic destructive history rewrite is built into a public form. Exported artifacts contain only approved commercial data. Public-site deployments never publish the inbox or private operational state.

## Verification and references

Tests cover strict nested validation and Unicode; immutable receipt recovery after offer withdrawal; payload conflicts; lost responses; private-repository refusal; concurrent logical submissions; invalid variants/versions; failed anti-abuse; persisted-rate quotas; Lima calendar dates; bounded branch-conflict retries; precise CORS; stream size; no public reads; server-side hostname/action verification; and local HTTP persistence across restart with restricted permissions.

Source references: [GitHub Contents API](https://docs.github.com/en/rest/repos/contents), [Durable Object coordination](https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/), [Turnstile server validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/), [Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/). The root master plan's consumer content and web design remain authoritative; this document specifies only receipt storage and integration.
