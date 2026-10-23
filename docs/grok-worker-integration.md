# Grok Worker integration

## Status

This integration is intentionally dormant. The database migration is not applied, no worker or credential is provisioned, and all application/database gates default to off. The design does not grant Grok Supabase, Vercel, GitHub, CMS-user, or service-role credentials.

## Trust boundary

The worker receives an opaque, expiring bearer token scoped to the private server API. It can lease one private job, read only that job's candidate/evidence snapshot, submit schema-validated artifacts, heartbeat/release/complete its lease, and report exceptions. All database access and publication decisions stay inside GTAVIWorldio's trusted server.

Plaintext worker tokens are returned once by the server-side credential issuer. Only an HMAC digest, a non-secret prefix, scopes, expiry, version, and audit metadata are stored. Rotation revokes the replaced credential in the same transaction. Worker revocation invalidates all credentials and increments the worker token version.

Required server-only environment variables, if separately approved later:

- `GROK_WORKER_API_ENABLED=true` enables the HTTP boundary. Unset is off.
- `GROK_AUTO_PUBLISH_ENABLED=true` is one of several independent automatic-publication gates. Unset is off.
- `GROK_WORKER_TOKEN_PEPPER` is a randomly generated secret of at least 32 characters used only for credential digesting.

These values must never use a `NEXT_PUBLIC_` prefix. The API and publication gates must be Production-scoped only if activation is approved.

## Private API v1

All routes are dynamic Node.js Route Handlers under `/api/private/grok/v1`:

| Method | Route | Required scope | Purpose |
| --- | --- | --- | --- |
| `GET` | `/capabilities` | `worker:status` | Return protocol capabilities and safety state, never secrets. |
| `POST` | `/queue/lease` | `queue:lease` | Atomically lease one eligible job and return a one-time lease token. |
| `GET` | `/work/{id}/context` | `candidate:read-leased` | Return only the leased candidate, source, and stored evidence snapshot. |
| `POST` | `/work/{id}/heartbeat` | `job:complete` | Extend a live lease within its hard two-hour limit. |
| `PUT` | `/work/{id}/artifacts/{kind}` | `artifact:submit` | Submit one strict, immutable artifact revision. |
| `POST` | `/work/{id}/validate` | `artifact:submit` | Run trusted server-side grounding, provenance, rights, SEO, and fact-check validation. |
| `POST` | `/work/{id}/complete` | `job:complete` | Complete a job that has at least one accepted artifact. |
| `POST` | `/work/{id}/release` | `job:complete` | Release work for bounded retry without a catch-up burst. |
| `POST` | `/work/{id}/exception` | `exception:write` | Record a private operational/editorial alert. |

Mutating requests require an `Idempotency-Key`. Leased-work requests also require the opaque `x-grok-lease-token`. Payloads are limited to 1 MB. Rate limits are enforced atomically in Postgres per worker, scope, and minute. Concurrent idempotent deliveries are claimed before the side effect; failures remain fail-closed for manual reconciliation.

Lease capabilities are derived server-side from the credential identity, claimed idempotency-record identity, and secret pepper. Only their digest is stored with the lease; the idempotency response stores a redacted placeholder and reconstructs the same capability for an exact replay.

## Artifact model

Accepted structured artifacts are research packets, claim/evidence mappings, quote provenance, article drafts, grounding results, independent fact-check results, SEO packages, primary-video packages, and exactly 13-second Quick Hit packages. Payload schemas reject unknown shapes before storage. The server recomputes validation and never treats a worker's self-reported grounding result as proof.

Fact checking must be performed by a different worker in a separate `FACT_CHECK` work item, reference that independent work-item ID, use the same evidence snapshot, and cover every claim in the draft bundle. Every auto-publishable claim must exactly match a stored extracted fact or quotation from linked Tier 1 first-party evidence.

## Automatic-publication policy

Publication remains impossible unless every independent gate passes at evaluation time and again inside one database transaction:

1. HTTP API environment gate is on.
2. Database API and automatic-publication gates are on.
3. `GROK_AUTO_PUBLISH_ENABLED=true` is present server-side.
4. Emergency stop is off.
5. Source is Tier 1 and first party.
6. Candidate is `CONFIRMED` with confidence at least 95.
7. Candidate is `NEW_STORY`, has no conflicting evidence, and has no unresolved official-source gap.
8. Every claim and quote passes server evidence/provenance validation.
9. Grounding and an independent fact check pass against the current immutable evidence snapshot.
10. Media/copyright rights and SEO validations pass.
11. A real default author is configured.
12. The atomic daily publication counter has remaining capacity.

Rumors, speculation, alleged leaks, secondary reports, community discoveries, conflicts, duplicates, and uncertain media rights cannot pass this policy. They can remain private for human review.

## Database changes

Migration `0010_grok_worker_gateway.sql` is additive. It creates:

- one fail-closed automation-control record;
- worker and credential registries;
- private work items and leases;
- immutable submissions and validation runs;
- atomic publication counters and decision records;
- idempotency and rate-limit records;
- append-only audit events and internal alerts;
- a restricted `private.grok_lease_work` function using row locking and `SKIP LOCKED`.

RLS is enabled on every new public table and all privileges are revoked from `PUBLIC`, `anon`, and `authenticated`. There are no direct client policies. The server database connection is the only intended data path.

## Deployment and activation plan

Each step requires separate approval:

1. Review/merge the code and migration without deploying.
2. Back up and record Production counts; apply only migration `0010`; run schema, RLS, anonymous/direct-API, and role-boundary tests.
3. Deploy the application with all Grok environment gates absent/false and the database emergency stop still on.
4. Generate a token pepper and one short-lived scoped credential in the Production secret manager; do not expose either in chat or logs.
5. Create one disabled Production worker, issue the minimum scopes, and validate authentication while the queue stays off.
6. Enable API access and the private queue for a no-publication pilot. Leave automatic publication off and the emergency stop available.
7. Run a controlled candidate through research/revision while verifying audit, rate limit, idempotency, rotation, and revocation behavior.
8. Only after editorial/security approval, set a small nonzero daily publication cap and independently approve both automatic-publication gates. Start with a single Tier 1 test case and verify the public result before expanding.

Rollback is immediate: enable the database emergency stop, disable the API/queue/automatic-publication controls, revoke the worker, and remove the server environment gates. Existing immutable audit records remain for investigation.
