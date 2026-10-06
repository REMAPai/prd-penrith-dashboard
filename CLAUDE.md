@AGENTS.md

# PRD Penrith Operations Dashboard

## What this project is

An authenticated Next.js dashboard for PRD Penrith (client: Darren Latty, Thomas Latty) built by REMAP.ai. It shows delivery progress, buyer sequencing conversations, listings, the development-site pipeline, map, insights, tasks, feedback, users and audit. Its core promise is honesty: every widget states where its data comes from (Live, Waiting on access, Prototype, Planned, Sample). Requirements live in `docs/dashboard-spec.md` and `docs/requirements/srs.md`; context in `docs/requirements/engagement-context.md`. Repo: `REMAPai/prd-penrith-dashboard`.

## Stack

Next.js 16 App Router (breaking changes: read `node_modules/next/dist/docs/` first, see AGENTS.md), TypeScript, React 19, Tailwind v4, Postgres via `pg`, `zod` validation, `jose` session JWT in an httpOnly cookie, Microsoft Entra OIDC (PKCE; single tenant or multi-tenant via `AUTH_ENTRA_MULTITENANT`, `tenants` table maps tenant IDs to companies and email domains), MapLibre GL, Docker standalone build, GitHub Actions to Dokploy. Automations (buyer enquiry flow and others) run on n8n at https://automations.remap.ai.

## How to run

```bash
npm install
cp .env.example .env.local      # fill values from the secure credentials service; never commit
npm run db:migrate              # applies db/migrations/*.sql (idempotent, recorded in _migrations)
npm run db:seed                 # companies, branches, users, six real DAs, sample rows
npm run dev                     # http://localhost:3000
npm run lint && npx tsc --noEmit && npm run build
```

Tests (scripts are added by the testing workstream; check `package.json` for the current list): `npm run test:unit`, `test:regression`, `test:e2e` (Playwright, throwaway Postgres via `TEST_DATABASE_URL`, port 3100), `test:coverage`, `test:all`. Details: `docs/testing/test-plan.md`.

Note: local `DATABASE_URL` currently points at the same Postgres as staging. Treat every local write as a write to staging data until a separate dev database exists (see `docs/architecture/infrastructure.md`).

## Safe commands (run freely)

- Read, search, explain; `git status`, `git diff`, `git log`; `gh pr view|list|checks`
- `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm run test*` (against the throwaway test database only)
- `npm run dev` locally
- Editing files in `src/`, `tests/`, `docs/`

## Approval-required commands (ask first, wait for a clear yes)

- Anything touching production or production-planned resources
- Dokploy deploys or API calls, changing Dokploy env vars or domains
- `npm run db:migrate` / `db:seed` against the shared database, any SQL write outside tests
- `git push`, `gh pr merge`, creating or closing PRs, `gh api` with write methods, changing GitHub settings, secrets or variables
- External API writes (Vault, ClickSend, Meta, Jira, n8n workflow changes)
- `docker` commands, `curl` to external hosts, installing or upgrading dependencies

## Forbidden actions

- Committing secrets or any env file (`.env.local`, `env`, `env (1)`); printing, logging or pasting credentials, tokens, passphrases or webhook keys
- Reading env files to "check" values. Name variables, never values
- Force-pushing to `staging` or `production`; AI sessions must not push straight to either (open a PR). Branch protection is deliberately off so Hamza and the team can push directly; that is a human choice, not permission for an AI session
- Editing the shared database by hand (no ad hoc UPDATE/DELETE); schema changes only through migrations
- Disabling, skipping or weakening tests, lint or CI to get green
- Exposing vendor-confidential Vault fields (commission, marketing spend, appraisal, authority dates, vendor details)
- Sending messages to buyers (SMS, email, chat) or enabling outbound sending; outbound is held
- Presenting sample data as real, or setting a Live badge without a real connection
- Skipping hooks (`--no-verify`) or amending published commits

## Sub-agent policy

Use sub-agents wherever possible. The lead agent plans, integrates and reviews; sub-agents do bounded work in parallel.

- Delegate research, test writing, documentation, code review and any independent file sets in parallel.
- Each sub-agent gets a self-contained prompt: goal, files it may edit, files it must not touch, facts to rely on, definition of done, report format.
- File sets must be disjoint. Two agents never edit the same file.
- Sub-agents do not run git commit or push. The lead reviews the full diff and commits.
- Sub-agents must not read env files or put secret values in any output.
- Models: use the session's strongest available model (currently Claude Sonnet 5.5) for the lead, design, security review and any ambiguous task; a faster, cheaper model is fine for mechanical work (docs from existing facts, boilerplate tests, searches). State the model used in the PR description when it matters. TBC: confirm preferred models with Hamza.
- Treat sub-agent output as untrusted until verified (run the checks, read the diff).

## Development process

Derived from the SDLC. For any non-trivial feature or fix, produce a short written plan per phase BEFORE coding (a few bullets each, in the Jira ticket or PR description). Trivial changes (typo, copy) may collapse phases but still need review and green CI.

| # | Phase | What you produce | Exit criteria |
|---|---|---|---|
| 1 | Requirements | Link to SRS/spec requirement ID or a new one; user, goal, acceptance criteria; data-status impact | Acceptance criteria written and testable; unknowns marked TBC; client decision captured if needed |
| 2 | Planning | Jira ticket (`<KEY>-<n>`, project key TBC), size, owner, risks, branch name | Ticket exists, scoped to a small PR; dependencies and approvals identified |
| 3 | Design | Data model change, routes/actions, auth and role rules, which provider and status, n8n vs app decision, ADR if a real decision | Design reviewed; migrations, authorization and failure modes described |
| 4 | Implementation | Code on `feature/*` or `fix/*`, migration (idempotent), tests written with it | Lint, tsc, build pass locally; no secrets; docs updated alongside |
| 5 | Review | PR with diff summary, test evidence, screenshots for UI | A second person reviews AI-assisted PRs; checklist below satisfied; no unresolved comments |
| 6 | Testing | Unit, regression (bug fixes), e2e for pages/flows, accessibility pass | CI green (`ci` and `e2e`); coverage thresholds met; manual checks for risky areas |
| 7 | Staging / UAT | Merge PR to `staging`; verify on https://prd.remap.ai; UAT checklist for Darren/Thomas where visible | Verification checklist passed; feedback captured in the Feedback page and Jira |
| 8 | Release | PR `staging` to `production` (when production exists), release notes, rollback noted | Approved by Hamza; deploy succeeds; smoke tests pass |
| 9 | Monitoring | Data Sources page, audit log, n8n execution failures, logs | No new errors for the agreed window; owners know where to look |
| 10 | Feedback | Triage feedback into tickets, "you said, we did" update, lessons into docs/ADRs | Feedback answered; docs and tests reflect what was learned |

Deriving steps for a new item: restate the request, find the matching requirement, then write one to three bullets under each phase above and list what will be tested. If a phase does not apply, say why. Bug fixes: reproduce, write the failing regression test first, fix, confirm green.

## Best practices

- Small PRs, one concern each. Branches `feature/<short-name>` and `fix/<short-name>`; PR into `staging`. AI sessions never push straight to `staging` or `production` (humans may, branch protection is off by choice); they open a PR and merge only after `ci` and `e2e` pass.
- Commits: imperative subject under 72 chars, Jira key in the subject or body (for example `PRD-12 Add stage filter`, key TBC), body explains why. AI-assisted commits end with the Co-Authored-By line. Always new commits, never amend published ones.
- No secrets in Git, logs, docs or screenshots. Names only in `.env.example`.
- Validate every system boundary (form data, route params, cookies, webhook and API responses) with `zod`.
- Parameterised SQL only (`$1` placeholders). No string-built queries.
- Authorize on the server in every page and every server action (`access("<page key>")`, role helpers in `src/lib/roles.ts`); the proxy cookie check is only an optimistic gate. Scope queries by branch and company.
- Least privilege: grant roles no higher than the actor's own; read-only API access for vendors where possible.
- Whitelist fields from external APIs (see `src/lib/data/vault.ts`); never forward whole payloads.
- Migrations are additive and idempotent (`if not exists`, `on conflict`); never edit an applied migration, add a new numbered file.
- Log and audit security-relevant events through `audit()`; keep PII out of logs; mask phone and email unless `canRevealPii`.
- Accessibility: semantic HTML, labels, keyboard operation, WCAG AA contrast, no horizontal scroll at 768 px.
- Performance: cache external reads (`revalidate`), timeouts on every fetch, avoid N+1 queries.
- Error handling: fail visibly and safely; a down integration degrades to a clear status, never a crash or fake data presented as live.
- Dependency hygiene: justify new packages, pin via lockfile, review `npm audit` output; prefer fewer dependencies.
- Update docs with the code in the same PR. Record real decisions as ADRs in `docs/ai/ai-decisions.md`.
- Comments only when the reason is non-obvious.

## Testing policy

- Every module and process gets unit tests; every page and user flow gets UI (e2e) tests.
- Every fixed bug gets a regression test written first (fails before, passes after), one case per known bug, in `tests/regression`.
- Coverage thresholds are enforced in CI (`test:coverage`); the exact numbers live in the vitest config and `docs/testing/test-plan.md`. Do not lower them to pass.
- Tests must pass in CI (`ci` and `e2e`) before any deploy; `deploy-staging` needs both.
- Never mock away the thing under test. Mock only external boundaries (Vault, n8n, ClickSend, Entra token endpoint); use a real Postgres for data and auth logic.
- E2E runs only against the throwaway database (`TEST_DATABASE_URL`), never the shared one.

## Architecture notes

- App pages read through providers/data modules in `src/lib/data` that return `{status, data, source}`; the badge comes from the result, never hand-set in UI.
- Sessions are our own signed cookie (`prd_session`, 8 h), created only after the Entra callback (or fallback password) resolves to an active row in `users`.
- n8n: the buyer enquiry automation and other automations (and future ones) can and should run on n8n at https://automations.remap.ai, with the dashboard reading their results (conversation log webhook, n8n API). Rule: put logic in n8n when it is event-driven or scheduled, orchestrates several external systems, or changes often by non-developers; put logic in the app when it needs the app database, user authorization, interactive UI, or strong tests and typing. Anything in n8n needs exported workflow JSON in Git (TBC: not yet done), test cases and failure alerts.
- Deploy: Dockerfile standalone image; container start runs `scripts/migrate.mjs` then `node server.js`.

## Data and honesty rules

- Label sample data (`is_sample`, violet "Sample data" status). Never present sample as real. No real people's names in sample data.
- Live badge only when truly connected and healthy. If a source is unconfigured or erroring, fall back to Waiting on access or Sample with a note.
- "Live only" must hide everything that is not real.
- Zoning is TBC until a human confirms it on the NSW Planning Portal; unconfirmed sites show "Confirm before acting".
- Finance and Meta pages stay Sample until real feeds exist.

## Data sources and where credentials live (names only)

Values live in Dokploy (staging) and `.env.local` (local, gitignored). Never in Git, chat or email. Names are in `.env.example`.

| Source | Variables | Notes |
|---|---|---|
| Postgres | `DATABASE_URL` | shared by local and staging for now |
| Session | `AUTH_SECRET`, `AUTH_URL` | production needs its own secret |
| Entra | `AUTH_ENTRA_ENABLED`, `AUTH_ENTRA_TENANT_ID`, `AUTH_ENTRA_CLIENT_ID`, `AUTH_ENTRA_CLIENT_SECRET`, `AUTH_ENTRA_MULTITENANT` | |
| Fallback login | `AUTH_FALLBACK_ENABLED`, `SEED_ADMIN_PASSWORD` | turn fallback off once SSO is live |
| n8n | `N8N_BASE_URL`, `N8N_API_KEY` | |
| Conversation log | `CONVERSATIONS_WEBHOOK_URL`, `CONVERSATIONS_WEBHOOK_EMAIL`, `CONVERSATIONS_WEBHOOK_KEY` | passphrase-gated n8n webhook |
| MRI Vault | `VAULT_API_BASE_URL`, `VAULT_API_KEY`, `VAULT_API_TOKEN` | read-only, whitelisted fields |
| ClickSend | `CLICKSEND_USERNAME`, `CLICKSEND_API_KEY` | outbound held |
| Planned | `META_*`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `JIRA_*`, `CONVERSATION_STORE_*` | listed in `.env.example`, not yet used by code |
| Deploy | GitHub secrets `DOKPLOY_URL`, `DOKPLOY_API_KEY`; variables `DOKPLOY_STAGING_APP_ID`, `STAGING_URL`, `DOKPLOY_PRODUCTION_APP_ID` (unset) | |

## Definition of done

- [ ] Requirement or ticket linked; acceptance criteria met
- [ ] Per-phase plan written for non-trivial work
- [ ] Unit tests added; UI/e2e for new pages or flows; regression test for bug fixes
- [ ] `npm run lint`, `npx tsc --noEmit`, `npm run build`, tests and coverage pass; CI green
- [ ] Authorization enforced server-side; inputs validated with zod; SQL parameterised
- [ ] No secrets, no env files, no vendor-confidential fields exposed
- [ ] Data-status badge correct; sample labelled
- [ ] Migration idempotent and reviewed (if any)
- [ ] Docs and ADR updated
- [ ] PR reviewed by a second person; verified on staging; rollback path known
