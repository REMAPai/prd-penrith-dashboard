# AI Decisions (ADR log)

Format: Context, Decision, Consequences. Status: Accepted unless noted. Dates are not recorded for historical decisions (TBC); add the date when a new ADR is written. Reasons below are inferred from the repo and spec where marked.

## ADR-001: Next.js App Router with TypeScript

- Context: The spec suggests Next.js (App Router, TypeScript), Tailwind, Postgres, MapLibre, zod (`docs/dashboard-spec.md` 6.1).
- Decision: Next.js 16 App Router, server components and server actions, Tailwind v4, `pg`, `zod`.
- Consequences: Authorization lives in server code; fewer API routes; Next.js 16 has breaking changes so docs in `node_modules/next/dist/docs/` must be read before coding.

## ADR-002: Own session handling instead of Auth.js

- Context: The spec proposed Auth.js "or equivalent". We need tenant-to-company mapping, identity pinning (`entra_oid`) and a fallback login, with the user row re-checked on every request.
- Decision: A small custom implementation: Entra OIDC with PKCE using `jose`, session JWT in an httpOnly cookie, user reloaded from `users` each request (`src/lib/session.ts`, `src/lib/entra.ts`).
- Consequences: Full control of tenant rules and revocation (deactivating a user takes effect immediately). We own the security of the code: needs tests and review. Rate limiting for fallback login is in memory only. (Reason partly inferred.)

## ADR-003: Dockerfile standalone build deployed by Dokploy

- Context: REMAP hosts apps on Dokploy; the spec allowed Dokploy or Vercel.
- Decision: `output: "standalone"`, three-stage Dockerfile, GitHub Actions calls Dokploy `application.deploy`; Dokploy auto-deploy off so CI gates deploys; migrations run at container start.
- Consequences: Image built on the Dokploy host, no registry or artifact; deploy rollback via Dokploy history; production deploy needs a second app and `DOKPLOY_PRODUCTION_APP_ID`.

## ADR-004: n8n for automations, dashboard reads results

- Context: The buyer enquiry flow and other automations already run on n8n (https://automations.remap.ai). The dashboard must show their results.
- Decision: Automations (current and future, including new ones) run on n8n; the dashboard reads results via a passphrase-gated webhook and the n8n API. Rule: n8n for event-driven or scheduled orchestration across systems that changes often; the app for logic needing its database, user authorization, interactive UI or strict tests.
- Consequences: Two places to operate and test. Workflow exports must be stored in Git and each workflow needs test cases and alerts (SRS DOC-02, DOC-03, NFR-REL-01). The webhook passphrase should move from query string to header.

## ADR-005: Provider and sample-data model with visible data status

- Context: Darren needs to see progress; many sources are not connected. Trust requires honesty.
- Decision: Data modules return `{status, data, source}`; sample data is flagged and labelled; Live only when truly connected; "Live only" filter hides the rest (`docs/dashboard-spec.md` section 3).
- Consequences: UI never decides status; failures degrade to Waiting on access with a note; every provider needs tests for live, failing and unconfigured states.

## ADR-006: Multi-tenant Entra with tenant-to-company mapping

- Context: REMAP staff (REMAP tenant) and PRD staff (PRD tenant) must sign in to one app and see only what they should.
- Decision: `AUTH_ENTRA_MULTITENANT` uses the `organizations` authority; the `tenants` table maps tenant IDs to platform or company, with allowed email domains; users must be pre-created; the first sign-in pins the Microsoft object ID. Platform tenants admit only platform admins; company tenants admit only matching company users.
- Consequences: Adding a client requires a tenants row and users; PRD users need guest access or their own app registration (open). Denials are audited.

## ADR-007: One shared Postgres for local development and staging (temporary)

- Context: No separate dev database yet; one Postgres runs on the Dokploy host.
- Decision: Accepted as a temporary trade-off for speed. Tests use a separate throwaway database (`TEST_DATABASE_URL`). Production gets its own database and `AUTH_SECRET`.
- Consequences: Local seed runs and experiments can affect staging data; migrations need production-grade care; backups are needed (P0). Revisit by creating a dev database (infra backlog P1).
- Status: Accepted, to be superseded.

## ADR-008: Branch protection off, team rules and CI gates instead

- Context: The repo is public for now and branch protection is not enabled by choice.
- Decision: Enforce PR-only merges, CI green and second-person review by convention and documented process.
- Consequences: Risk of accidental direct pushes; revisit when visibility or plan changes (infra backlog P1). Status: Accepted, to be revisited.
