# Smart Ads Platform — Workspace

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Product

Smart Ads Platform — an AI-managed advertising platform integrated with Salla and Zid (Saudi e-commerce). The merchant installs once, connects ad accounts, tops up budget, and the AI handles store analysis, ad generation, audience building, budget allocation, and daily optimization. Cumulative network data strengthens targeting across all merchants.

Dashboard UI is Arabic-only (RTL).

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM (Replit built-in)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Logging**: pino + pino-http (no `console.*` in server code)

## Backend foundation (Phase 1, in progress)

Implemented:

- Database schema (`lib/db/src/schema/`): `merchants`, `sessions`, `oauth_states`, `processed_webhooks`, `events`, `audiences`, `campaigns`, `ad_creatives`, `seasonal_notifications`, `audit_log`.
- Salla OAuth install + callback flow (`/api/auth/salla/install`, `/api/auth/salla/callback`):
  - State stored in DB with TTL + bound to a browser nonce cookie (defense against login CSRF).
  - One-time state consumption.
  - Strict relative-path redirect validation (rejects protocol-relative `//host`).
  - On callback: tokens encrypted (AES-256-GCM) and stored, merchant upserted, session cookie issued.
- Salla webhook receiver (`/api/webhooks/salla`):
  - Raw-body parsing (excluded from global JSON middleware).
  - HMAC-SHA256 signature verification with `timingSafeEqual`.
  - Idempotency: dedupe by event id header → external id → SHA-256 of full raw body.
  - Customer email/phone hashed (SHA-256) before storage; never stored in plaintext.
- Cookie-based session middleware (`requireSession`).
- `/api/auth/me`, `/api/auth/logout` endpoints.
- Audit log entries on connect/reconnect and every accepted webhook.

Required secrets:

- `SALLA_CLIENT_ID`, `SALLA_CLIENT_SECRET`, `SALLA_WEBHOOK_SECRET` — set as Replit secrets.
- `ENCRYPTION_KEY` — 32-byte key for AES-256-GCM token encryption (auto-generated as a shared env var; hex-encoded).
- `DATABASE_URL` — provisioned by Replit DB.

Salla configuration (in the Salla Partners dashboard):

- Authorized callback URL: `https://<your-replit-domain>/api/auth/salla/callback`
- Webhook URL: `https://<your-replit-domain>/api/webhooks/salla` (signed with `SALLA_WEBHOOK_SECRET`)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run typecheck:libs` — build composite lib types (run before api typecheck after schema changes)
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/db run push-force` — destructive push, used only when adding non-null columns to existing tables
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
