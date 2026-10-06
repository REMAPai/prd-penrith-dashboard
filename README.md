# PRD Penrith Operations Dashboard

Next.js (App Router, TypeScript) dashboard for PRD Penrith: delivery progress, buyer sequencing, development pipeline, map, listings, insights, tasks, feedback, users and audit. Built by REMAP.ai.

Every widget shows where its data comes from: **Live**, **Waiting on access**, **Prototype**, **Planned** or **Sample data**. Use the "Live only" switch in the top bar to hide everything that is not real.

## Run locally

```bash
npm install
cp .env.example .env.local     # fill in values; never commit this file
npm run db:migrate             # creates tables in DATABASE_URL
npm run db:seed                # companies, branches, users, real DAs, progress items
npm run dev                    # http://localhost:3000
```

`SEED_ADMIN_PASSWORD` sets the fallback password of seeded admins. Leave it empty to allow Microsoft sign-in only.

## Sign-in

- **Microsoft Entra** (`AUTH_ENTRA_ENABLED=true`): register the redirect URI `<AUTH_URL>/api/auth/entra/callback` on the app registration, with delegated `openid profile email`. The signed-in email must already exist in the Users page.
- **Fallback password** (`AUTH_FALLBACK_ENABLED=false` turns it off once SSO is live).
- Roles: platform admin, company admin, branch admin, marketing, sales agent, viewer. Enforced on the server in every page and action.

## Data sources

| Source | Needs | Status when missing |
|---|---|---|
| Postgres | `DATABASE_URL` | app does not start |
| Conversation log (n8n webhook `prd-buyer-conversations`) | `N8N_BASE_URL`, `CONVERSATIONS_WEBHOOK_EMAIL`, `CONVERSATIONS_WEBHOOK_KEY` | Sample |
| MRI Vault (current listings) | `VAULT_API_BASE_URL`, `VAULT_API_KEY`, `VAULT_API_TOKEN` | Sample |
| ClickSend, n8n API | keys in `.env.example` | shown on Data Sources |

Only whitelisted Vault fields are read. Commission, marketing spend, appraisal and authority dates are never passed on.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Develop, build, serve |
| `npm run lint` | ESLint on `src` |
| `npm run db:migrate` / `db:seed` | Apply migrations / seed (uses `.env.local`; the database is shared with staging for now) |
| `npm run test:unit`, `test:regression`, `test:e2e`, `test:coverage`, `test:all` | Test suites (see `package.json` for the current set) |

## Testing

Unit and regression tests with Vitest in `tests/unit` and `tests/regression`; Playwright e2e in `tests/e2e` against a throwaway Postgres (`TEST_DATABASE_URL`, port 3100). Every fixed bug gets a regression test. Plan: `docs/testing/test-plan.md`.

## CI/CD

GitHub Actions workflow `pipeline`: CI on pull requests to `staging` and `production`; push to `staging` runs CI and e2e, then deploys through Dokploy. Production is not set up yet. Runbook: `docs/deployment/deployment-process.md`, rollback: `docs/deployment/rollback-process.md`.

## Environments

| Environment | URL | Branch |
|---|---|---|
| Local | http://localhost:3000 | any |
| Staging | https://prd.remap.ai | `staging` |
| Production | planned | `production` |

Details: `docs/architecture/infrastructure.md`.

## Docs

- `CLAUDE.md`, `AGENTS.md`: rules for AI assistants and sub-agents
- `docs/dashboard-spec.md`, `docs/requirements/` (srs, engagement-context, business-requirements, user-flows, acceptance-criteria)
- `docs/architecture/` (system-architecture, infrastructure, integrations, api-design, database-design)
- `docs/deployment/`, `docs/testing/test-plan.md`
- `docs/ai/` (development guidelines, ADR log)
- `design/reference/` (original design prototype)
