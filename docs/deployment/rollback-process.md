# Rollback Process

Decide fast: if users are affected, roll back first and diagnose afterwards.

## 1. Option A: redeploy a previous deployment in Dokploy (fastest)

1. Open https://manage.remap.ai, project "PRD Penrith Dashboard", application `prd-dashboard-staging`, Deployments tab.
2. Pick the last known-good deployment (the title is the short commit SHA) and redeploy/rollback it.
3. Run the verification checklist in `deployment-process.md`.
4. Note: the app on `staging` still contains the bad commit. The next merge or deploy from `staging` will redeploy it, so follow with Option B or pause merges until fixed.
5. Whether Dokploy's rollback re-runs migrations or keeps old images: TBC, confirm in Dokploy settings. Rolled-back code must work with the already-migrated schema (migrations are additive, see section 3).

## 2. Option B: git revert (permanent)

1. `git revert -m 1 <merge commit SHA>` on a `fix/revert-<name>` branch from `staging`.
2. PR into `staging`, let CI run, get approval (an emergency may use a single reviewer, record it).
3. Merge; the pipeline redeploys the previous behaviour.
4. Never force-push or reset `staging` or `production`.
5. Reopen the Jira ticket, add a regression test before re-attempting the change.

## 3. Database migration rollback policy

- Migrations are forward-only. There are no down scripts.
- Write migrations additive and backwards compatible so the previous app version keeps working after a code rollback (expand and contract).
- If a migration itself is wrong: ship a new corrective migration (fix forward). Do not delete rows from `_migrations` or edit applied files.
- Data damage or a destructive migration: restore from backup. Automated backups do not exist yet (TODO, infra backlog P0), so take a manual `pg_dump` before any destructive change.
- The database is shared by local dev and staging, so a restore affects both; announce it.
- Never run ad hoc UPDATE or DELETE on the shared database to "undo"; use a reviewed migration or restore.

## 4. Secrets and configuration rollback

- Bad env var change: restore the previous value from the secure credentials service and redeploy.
- Leaked or wrong secret: rotate (see `infrastructure.md` section 3), do not just roll back.
- GitHub pipeline problem: revert the workflow change by PR; if deploys must be stopped, unset `DOKPLOY_STAGING_APP_ID` (approval required).

## 5. Communication

| Who | When | Message |
|---|---|---|
| Hamza and Irfan | Immediately | What broke, impact, action (rollback in progress) |
| Darren and Thomas (via Irfan, plain language) | If PRD users were affected or UAT was in progress | What happened, current state, when to retry. No jargon |
| Jira | Always | Ticket with timeline, root cause, regression test link |
| `docs/ai/ai-decisions.md` or runbooks | If process changed | Update the docs |

Post-incident: short write-up (what, why, fix, prevention) within two working days; add the regression test and any alerting gap to the backlog.
