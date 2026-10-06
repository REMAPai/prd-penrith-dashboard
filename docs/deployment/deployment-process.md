# Deployment Process

Runbook for releasing the PRD Penrith dashboard. Architecture and settings: `docs/architecture/infrastructure.md`. Rollback: `rollback-process.md`.

## 1. Branches and rules

`feature/*` or `fix/*` -> pull request -> `staging` -> pull request -> `production`.
Never push straight to `staging` or `production`; merge a reviewed pull request. GitHub branch protection is OFF by choice (team rule applies). AI-assisted PRs need a second person's review.

## 2. Pipeline (`.github/workflows/pipeline.yml`)

- **Pull request to staging or production:** `ci` (lint, type check, build, plus coverage) and `e2e` (Playwright, Postgres service container).
- **Push (merged PR) to `staging`:** `ci` and `e2e`, then `deploy-staging` calls Dokploy `application.deploy`, then waits until `https://prd.remap.ai/login` returns 200 (up to 10 minutes).
- **Push to `production`:** `ci`, then `deploy-production` only when repository variable `DOKPLOY_PRODUCTION_APP_ID` is set. It is not set, so production does not deploy.

## 3. Dokploy (https://manage.remap.ai)

- Project **PRD Penrith Dashboard**, application `prd-dashboard-staging` (id in `DOKPLOY_STAGING_APP_ID`).
- Source: GitHub `REMAPai/prd-penrith-dashboard`, branch `staging`, Dockerfile build, auto-deploy off (the pipeline deploys).
- Domain `prd.remap.ai`, port 3000, Let's Encrypt.
- Env vars are stored on the Dokploy application, not in Git. `.env.example` lists names.
- Container start runs `scripts/migrate.mjs` then the Next.js server.

GitHub settings: secrets `DOKPLOY_URL`, `DOKPLOY_API_KEY`; variables `DOKPLOY_STAGING_APP_ID`, `STAGING_URL`.

## 4. Release steps (feature to staging)

1. Work on `feature/<name>` or `fix/<name>`; run locally: `npm run lint`, `npx tsc --noEmit`, `npm run build`, tests.
2. Open a PR into `staging`: description with Jira key, plan per phase, test evidence, screenshots, migration and env var notes, rollback note.
3. Wait for `ci` and `e2e` green and a second reviewer's approval.
4. Merge. The `staging` push triggers `ci`, `e2e`, then `deploy-staging`.
5. Watch the run (`gh run list`, `gh pr checks`, or the Actions page) until the health check passes.
6. Run the verification checklist (section 8).
7. Ask Darren/Thomas for UAT where the change is visible (`docs/testing/test-plan.md`).

## 5. Environment variable changes

1. Add the name (no value) to `.env.example` in the same PR and document it in `CLAUDE.md` and `infrastructure.md` if it is a new source.
2. Set the value in the Dokploy application environment before merging code that needs it. Never paste values into PRs, chat or tickets.
3. Redeploy and verify. A variable change alone needs a redeploy to take effect.
4. Removing a variable: ship code that no longer reads it first, then delete it.

## 6. Migration handling

- Add `db/migrations/NNN_name.sql`, idempotent, additive. Never edit an applied file.
- The container runs migrations on every start, in order, each in a transaction. A failing migration stops the container; the previous container keeps serving only if Dokploy has not yet swapped (TBC: confirm Dokploy keeps the old container on failed start).
- Staging shares its database with local development: announce migrations, and review them as production-grade (they are the only protection for the data).
- Destructive changes (drop column or table, type change) use expand and contract: release 1 adds and dual-writes, release 2 stops reading the old shape, release 3 removes it.
- Take a backup before any destructive migration (backups not yet automated, see infra backlog).

## 7. Promotion staging to production (plan)

Production does not exist yet. Prerequisites:
1. Second Dokploy application on branch `production`, own domain, own database, own `AUTH_SECRET`, own Entra redirect URI.
2. Run the migrations on the new database; seed only what production needs (no sample rows marked live).
3. Set `DOKPLOY_PRODUCTION_APP_ID`; add a required reviewer on the GitHub `production` environment.
4. Fallback password disabled (`AUTH_FALLBACK_ENABLED=false`) once SSO works for PRD users.
5. Backups and uptime monitoring in place.

Then: PR `staging` to `production`, approval by Hamza, merge, watch `deploy-production`, run the checklist and smoke tests, tell Darren and Thomas. Production deploy has no health-check step yet (add one, backlog).

## 8. Verification checklist (after every deploy)

- [ ] Actions run green, deployment shows success in Dokploy
- [ ] https://prd.remap.ai/login returns 200 over valid TLS
- [ ] Sign-in works (Microsoft; fallback if enabled)
- [ ] Data Sources page: Postgres Live; other sources match expectations (no unexpected change from Live to Waiting)
- [ ] Container log shows migrations applied or nothing to apply, no errors
- [ ] The changed feature works with a real user role; other roles still see only what they should
- [ ] Data-status badges correct, sample still labelled, Live-only hides sample
- [ ] Audit log records the verification sign-in

## 9. Post-deploy smoke tests

1. Anonymous request to `/progress` redirects to `/login`.
2. Platform admin signs in, lands on `/companies`; company user lands on `/progress`.
3. `/buyer`, `/listings`, `/pipeline`, `/map` render without errors.
4. Move a sample pipeline stage and move it back (writes event and audit rows), then confirm the audit entry.
5. Submit and view a feedback item.
6. Viewer role cannot open `/users` or `/audit` (Denied).

TBC: automate these as an e2e smoke tag run against staging with a dedicated test user.

## 10. When ci or deploy fails

| Symptom | Action |
|---|---|
| `ci` lint, tsc or build fails | Fix on the branch; never disable the check. Reproduce locally with the same command |
| Test fails | Reproduce locally; if a real bug add a regression test; never skip the test |
| `e2e` fails | Open the Playwright report artifact (TBC) and trace; check Postgres service, `TEST_DATABASE_URL`, port 3100 |
| `deploy-staging` HTTP 4xx or 5xx from Dokploy | Check `DOKPLOY_URL`, `DOKPLOY_API_KEY`, `DOKPLOY_STAGING_APP_ID` (rotate if the key was revoked); check Dokploy is up. Do not print the key |
| Health check times out | Open Dokploy deployment logs: build error, migration error, missing env var (for example `AUTH_SECRET` under 32 chars), or database unreachable. Fix forward or roll back |
| Site up but wrong build | Compare commit SHA in the Dokploy deployment title with the merged commit |

If staging is broken for users, roll back first (see `rollback-process.md`), diagnose second.
