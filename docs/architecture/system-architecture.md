# System Architecture

## 1. Components

```mermaid
flowchart TB
  subgraph Browser
    ui[Pages: React server + client components]
  end
  subgraph App[Next.js 16 app, Docker standalone]
    proxy[src/proxy.ts: cookie gate]
    pages[src/app/(app)/*: pages + server actions]
    auth[src/app/login, src/app/api/auth/entra/*]
    lib[src/lib: session, entra, ctx, roles, db, health, stages]
    data[src/lib/data: conversations, vault, sample, types]
  end
  pg[(Postgres)]
  n8n[n8n]
  vault[MRI Vault API]
  entra[Microsoft Entra]
  ui --> proxy --> pages
  ui --> auth
  pages --> lib --> pg
  pages --> data
  data -->|webhook, passphrase| n8n
  data -->|read-only| vault
  auth --> entra
  lib -->|health checks| n8n & vault
```

| Component | Responsibility |
|---|---|
| `src/proxy.ts` | Optimistic redirect to `/login` when the `prd_session` cookie is missing. Not a security boundary |
| `src/lib/session.ts` | Sign and verify the session JWT, re-check the user row on every request, `audit()` |
| `src/lib/entra.ts` | OIDC authorize URL (PKCE), code exchange, ID token verification, tenant and user resolution |
| `src/lib/ctx.ts`, `roles.ts` | Per-request context (branch scope, Live-only), page role matrix, `canSee`, `canEditPipeline`, `canRevealPii` |
| `src/lib/data/*` | Providers returning `{status, data, source, note, asOf}`; fall back to sample data |
| `src/lib/health.ts` | Data Sources checks |
| `scripts/migrate.mjs`, `seed.mjs` | Migrations and seed |

Pages are grouped: Overview (Delivery Progress, Executive Overview), Departments (Buyer Sequencing, Listings, Pipeline, Map, Projects, Meta, Property Management, Commercial), Insights (Market, Finance), Operate (Tasks, Alerts, Feedback, Data Sources), Admin (Users, Audit), Platform (Companies).

## 2. Request flow

1. Browser requests a page. `proxy.ts` redirects to `/login` if no session cookie.
2. The server component calls `access("<page key>")`: loads the session (verifies the JWT, reloads the user from `users`, rejects non-active), builds the context (branches the role may see, selected branch from the `scope` cookie, `liveOnly` cookie), and checks the role matrix. No session returns null (redirect via layout), wrong role renders Denied.
3. The page reads Postgres (always scoped by branch or company) and data providers.
4. Providers call n8n or Vault with timeouts and `revalidate` caching. On failure they return status `waiting` with sample data and a note. When unconfigured they return `sample`.
5. Mutations are server actions: re-run `access()`, validate input, parameterised SQL, write an event or `audit()` row, `revalidatePath`.

## 3. Authentication flow

```mermaid
sequenceDiagram
  participant U as User
  participant A as App
  participant E as Entra
  participant D as Postgres
  U->>A: GET /api/auth/entra/login
  A->>A: state, nonce, PKCE verifier; set prd_oidc cookie (10 min, path-scoped)
  A-->>U: redirect to Entra authorize (organizations if multi-tenant, else tenant ID)
  U->>E: sign in
  E-->>U: redirect with code and state
  U->>A: GET /api/auth/entra/callback
  A->>A: check state matches cookie
  A->>E: exchange code (client secret + verifier)
  A->>A: verify ID token (JWKS, issuer from tid, audience, nonce)
  A->>D: resolveUser(tid, oid, email)
  A->>D: signInUser: last_login, audit
  A-->>U: set prd_session (HS256, 8 h), redirect (/companies for platform admin, else /progress)
```

Multi-tenant mapping (`resolveUser`)
1. The token's `tid` must exist in `tenants`, otherwise "organisation not set up".
2. If a user is already bound to the `oid` it is used. Otherwise the email domain must be in `tenants.domains`, a `users` row must exist for that email (admins add users first), and it must not be bound to a different `oid`.
3. The user must be active. Tenant `kind = platform` allows only `platform_admin`; `kind = company` allows only users whose `company_id` matches and who are not platform admins.
4. On first successful sign-in the `oid` is stored in `users.entra_oid` (identity pinning).
5. Denials are written to `audit_log` as "Sign-in denied".

Fallback: `passwordLogin` (zod, bcrypt, 5 attempts per 10 minutes in memory), disabled by `AUTH_FALLBACK_ENABLED=false`. Entra is gated by `AUTH_ENTRA_ENABLED` plus client ID and secret.

## 4. Data-status provider model

Every data module returns `Result<T> = { status, data, source, note?, asOf? }` with `status` in `live | waiting | prototype | planned | sample`. Rules:
- Live only when the integration is configured and the call succeeded.
- Configured but failing returns `waiting` and sample data with an explanatory note.
- Not configured returns `sample`.
- Page-level status comes from `PAGES` in `src/lib/roles.ts`; widget-level status comes from the provider result.
- Pipeline rows carry `is_sample`; the Live-only switch filters them out.
- Spec reference: `docs/dashboard-spec.md` section 3 and 6.2.

Current providers: conversations (n8n webhook) and listings (Vault) are live-capable; projects, Meta, finance, alerts and parts of the executive view are sample.

## 5. n8n role

n8n at https://automations.remap.ai runs the buyer enquiry automation (intake, Vault lookups, AI conversation, ClickSend, write-back, alerting) and any other automations, present and future. The dashboard does not run those workflows; it reads their results:
- conversation log through the passphrase-gated webhook `prd-buyer-conversations`
- workflow health through the n8n API (Data Sources)

Decision rule for new logic: use n8n for event-driven or scheduled orchestration across several systems that changes often; use the app for anything needing the app database, user authorization, interactive UI or strict typing and tests. See `docs/ai/ai-decisions.md` (ADR-004). Workflow exports are not yet in Git (TBC, SRS DOC-03).

## 6. Related documents

`integrations.md`, `api-design.md`, `database-design.md`, `infrastructure.md`.
