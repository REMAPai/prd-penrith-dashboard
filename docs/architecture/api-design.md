# API Design

The app exposes very little HTTP API. Pages and server actions do the work; only the Entra routes are HTTP endpoints. There is no public data API.

## 1. Route handlers

| Route | Method | Auth | Validation and controls | Result |
|---|---|---|---|---|
| `/api/auth/entra/login` | GET | Public (path allowed by proxy) | Checks `entraEnabled()`; creates `state`, `nonce`, PKCE verifier; sets httpOnly `prd_oidc` cookie (SameSite=Lax, Secure in production, path `/api/auth/entra`, 10 min) | 302 to Entra, or to `/login?error=` |
| `/api/auth/entra/callback` | GET | Public | Requires `prd_oidc` cookie and `code`; `state` must match; ID token verified (JWKS, issuer from `tid`, audience, nonce); `resolveUser` tenant and user rules; denials audited | 302 to `/companies` (platform admin) or `/progress`, sets `prd_session`; errors to `/login?error=` |

| `/api/ingest/playbook` | POST | Header `x-ingest-key` (`INGEST_API_KEY`) | zod: Monday `weekStart`, council in Penrith or Blue Mountains, DA or CDC, at most 3,000 rows and 2,000 companies; parameterised SQL in one transaction | `{ ok, rows, flagged, companies }`; 400 invalid, 401 bad key, 503 not configured, 500 store failed (generic) |

Page routes (all under the proxy cookie gate except `/login`): `/`, `/login`, `/progress`, `/exec`, `/buyer`, `/listings`, `/pipeline`, `/map`, `/projects`, `/meta`, `/pm`, `/comm`, `/market`, `/finance`, `/tasks`, `/alerts`, `/feedback`, `/sources`, `/users`, `/audit`, `/companies`. Visibility per role is defined in `src/lib/roles.ts` (`PAGES`).

## 2. Server actions

Every action re-checks the session and role server-side (`access()` or `getSession()`); the cookie gate is never relied on.

| Action | File | Roles | Validation | Effects |
|---|---|---|---|---|
| `passwordLogin` | `src/app/login/actions.ts` | Public | zod email and password; fallback flag; 5 attempts per 10 minutes per email (in memory) | Session cookie, audit sign-in or failure |
| `signOut` | same | Signed in | none | Deletes cookie, audit |
| `setLiveOnly` | `src/app/(app)/actions.ts` | Anyone with the cookie | boolean | Sets `liveOnly` cookie (30 days). Preference only (note: does not call `access()`) |
| `setScope` | same | Signed in | branch must be in the user's allowed branches | Sets `scope` cookie |
| `moveStage` | `pipeline/page.tsx` | platform, company, branch admin, marketing (`canEditPipeline`) | integer stage 0 to 9; site must belong to the current branch | Updates site, inserts `pipeline_events`, audit |
| `confirmZoning` | same | same | non-empty zoning, max 80 chars; branch-scoped | Sets zoning and `zoning_confirmed`, event, audit |
| `toggleAsk` | `progress/page.tsx` | any role except viewer | numeric id; only items of kind `ask` (not scoped by company: known gap) | Toggles open/done, audit |
| `addTask`, `toggleTask` | `tasks/page.tsx` | page roles `pcbma` | zod text 2 to 200, assignee max 80, due max 40; toggle is branch-scoped | Inserts task / toggles done (no audit row) |
| `addUser` | `users/page.tsx` | platform, company, branch admin | zod email, name, role, branch; role must be grantable by actor (never above own level) | Inserts user (on conflict nothing), audit |
| `toggleUser` | same | same | cannot deactivate self; target must be in actor's scope and grantable | Sets status, audit |
| `submit` (feedback) | `feedback/page.tsx` | all roles | zod body 3 to 1000, page max 60, rating enum | Inserts feedback |
| `vote` | same | all roles | numeric id | Increments votes (no per-user de-duplication: known gap) |
| `setStatus` | same | platform admin only | status in fixed list | Updates status, audit |

## 3. Outbound calls and webhooks

| Direction | Endpoint | Auth | Validation |
|---|---|---|---|
| App to n8n | `GET /webhook/prd-buyer-conversations?email&key` | Passphrase in query | Response must contain a `conversations` array, else treated as failure |
| App to n8n | `GET /api/v1/workflows?limit=1` | `X-N8N-API-KEY` | Status 200 check |
| App to Vault | `GET /properties/sale...` | `X-Api-Key` and Bearer | Status check, fields whitelisted in `toListing` |
| App to ClickSend | `GET /v3/account` | Basic | Status 200 check |
| Inbound webhooks | None exist in the app. ClickSend inbound replies go to n8n, not the dashboard | n/a | n/a |

## 4. Conventions for new endpoints

- Prefer a server action or server component over a new route handler.
- A new route handler must authenticate (session) and authorize by role and branch, validate input with zod, use parameterised SQL, return minimal JSON, and write `audit()` for sensitive reads and writes.
- Webhooks that receive data must verify a shared secret or signature in a header, never a query string, and be idempotent.
- Errors return generic messages; details go to server logs without PII or secrets.
