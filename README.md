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

## Docs

`docs/dashboard-spec.md`, `docs/requirements/srs.md`, `design/reference/` (original design prototype).
