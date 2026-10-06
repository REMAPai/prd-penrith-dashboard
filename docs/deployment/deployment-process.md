# Deployment Process

## Branches
`feature/*` -> pull request -> `staging` -> pull request -> `production`.
Never push straight to `staging` or `production`; merge a reviewed pull request. (GitHub branch protection is not available on this private repo plan, so this is a team rule until the plan or visibility changes.)

## Pipeline (`.github/workflows/pipeline.yml`)
- **Pull request to staging or production:** `ci` job runs lint, type check and production build.
- **Push (merged PR) to `staging`:** `ci`, then `deploy-staging` calls the Dokploy API (`application.deploy`) and waits until `https://prd.remap.ai/login` returns 200.
- **Push to `production`:** `ci`, then `deploy-production` runs only when the repository variable `DOKPLOY_PRODUCTION_APP_ID` is set. It is not set yet, so production does not deploy.

## Dokploy (https://manage.remap.ai)
- Project **PRD Penrith Dashboard**, application `prd-dashboard-staging` (id in the repo variable `DOKPLOY_STAGING_APP_ID`).
- Source: GitHub `REMAPai/prd-penrith-dashboard`, branch `staging`, Dockerfile build, auto-deploy off (the pipeline deploys).
- Domain `prd.remap.ai` (port 3000, Let's Encrypt).
- Environment variables are stored on the Dokploy application, not in Git. `.env.example` lists the names.
- Container start runs `scripts/migrate.mjs` (idempotent), then the Next.js server.

## GitHub settings
Secrets: `DOKPLOY_URL`, `DOKPLOY_API_KEY`. Variables: `DOKPLOY_STAGING_APP_ID`, `STAGING_URL`.

## Production (to do)
Create a second Dokploy application on branch `production` with its own domain, database and `AUTH_SECRET`, then set `DOKPLOY_PRODUCTION_APP_ID`.

## Rollback
Redeploy the previous deployment from the Dokploy application's Deployments tab, or revert the merge commit on `staging` and let the pipeline redeploy.
