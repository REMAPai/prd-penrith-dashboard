# Integrations

Constraint IDs C1 to C12 refer to `docs/requirements/srs.md` section 2.3. Status values follow the dashboard data-status system. Owner is the party responsible for access and operation.

| Integration | Purpose | Auth | Endpoints used by the dashboard | Limits and constraints | Owner | Status |
|---|---|---|---|---|---|---|
| Postgres | App data | `DATABASE_URL` | SQL via `pg` pool (max 5) | Shared by local and staging | REMAP | Live |
| Microsoft Entra | SSO | Auth code + PKCE, client secret (`AUTH_ENTRA_*`) | `login.microsoftonline.com/<authority>/oauth2/v2.0/authorize`, `/token`, JWKS `common/discovery/v2.0/keys` | Multi-tenant requires app registration set to any organisational directory; PRD users need guest access or their own registration (Data Sources note) | REMAP (Hamza); PRD IT for PRD tenant | Live (staging) |
| MRI Vault API | Current listings (read-only); the buyer automation also writes contacts | `X-Api-Key` header plus Bearer token (`VAULT_API_*`) | `GET /properties/sale?pagesize=100&sort=modified&sortOrder=desc` (listings), `GET /properties/sale?pagesize=1` (health) | C1 no contact search; C2 webhooks partner-only (poll); C4 messaging is staff chat only; C5 event stream 403; C6 price and beds on the sale-life record; C7 suburbs endpoint huge and unfiltered; C8 contact notes 500; C11 portal IDs differ from Vault IDs; C12 PRD responsible for operating. Daily quota TBC, cached 300 s. Whitelisted fields only: never commission, marketing spend, appraisal, authority dates, vendor details | PRD (agreement, Thomas/Lily); REMAP operates | Live (read) |
| Dashboard database tables `buyer_conversations`, `buyer_turns` | Conversation log for Buyer Sequencing, Listings, Market, Exec | None for reads (server-side query). Writes need `x-ingest-key` (`INGEST_API_KEY`) | `POST /api/ingest/turn` from n8n; page reads Postgres | The old n8n webhook read path (`CONVERSATIONS_WEBHOOK_*`) was removed: no passphrase in URLs, no webhook environment variables | REMAP | Live when rows exist |
| n8n API | Workflow health | `X-N8N-API-KEY` (`N8N_API_KEY`) | `GET /api/v1/workflows?limit=1` | Read-only use | REMAP | Live when configured |
| ClickSend | Two-way SMS for buyer conversations | Basic auth (`CLICKSEND_USERNAME`, `CLICKSEND_API_KEY`) | `GET https://rest.clicksend.com/v3/account` (health only) | C3 Vault SMS cannot receive replies, hence ClickSend. Outbound sending is held. Inbound reply rule must point at the n8n webhook (open). Spam Act: consent, identify, STOP | Thomas (account); REMAP integrates | Waiting on access (outbound held) |
| Anthropic API | Conversation and extraction inside n8n | Key in n8n credentials | Not called by the dashboard | Cross-border processing noted under Privacy Act (SRS 8.3) | REMAP | In n8n |
| Meta (Lead Ads, DMs) | Meta lead funnel | Planned: `META_*` | None yet | C10 `leads_retrieval` needs App Review and business verification (weeks); landing-page route used meanwhile, which does not feed Vault. Ad account compromised in September 2026 (right account TBC) | Thomas (ads); REMAP | Planned; Meta page is Sample |
| Google Sheets | Projects stock, Meta leads, conversation log source | Planned: read-only service account (`GOOGLE_SERVICE_ACCOUNT_JSON`) | None yet (n8n reads the conversation sheet) | Sheet access must be granted by Thomas | Thomas; REMAP | Planned |
| NSW Planning Portal / councils | DA feed, zoning (manual confirm in Spatial Viewer) | Free, no key (TBC) | None yet. Six real DAs seeded from PlanningAlerts; 30 planning items and 25 REA land listings loaded from Suffyan's 7 Oct 2026 file (`scripts/data`) | Zoning must be human-confirmed; paid sources (RP Data, Cordell, Cityscope) Waiting on access | REMAP; Darren (paid sources decision) | Planned |
| Jira | Progress items, ticket links | Planned: `JIRA_*` | None yet | Project keys BLD/AIS per SRS; PRD access not set up | Irfan | Planned |
| Teams | Failure alerts | Webhook, destination TBC | Not used by the dashboard | Destination undecided (Darren) | Irfan | TBC |

Rules for any integration
- Read-only unless explicitly approved; outbound messages to buyers are held.
- Timeouts and caching on every call; failure degrades to Waiting on access plus sample, never to fake Live.
- Whitelist response fields; keep PII masked; never log credentials.
- Credentials stay in PRD's name where applicable and in Dokploy or n8n credential storage only.

## Buyer conversation store (added 6 Oct 2026)

| Piece | Detail |
|---|---|
| Tables | `buyer_conversations`, `buyer_turns`, `buyer_claims` (migration `003_buyer_conversations.sql`) |
| Write path | n8n v2 workflow posts to `POST /api/ingest/turn` and `POST /api/ingest/claim` with header `x-ingest-key` (`INGEST_API_KEY`, min 24 chars; n8n credential "PRD ingest key") |
| Duplicate guard | `claim` refuses the same conversation and message text within 10 minutes; n8n fails open if the store is unreachable |
| Read path | Buyer page reads Postgres only. With no rows it shows Waiting on access and an empty table, never sample data |
| Outbound | `OUTBOUND_SENDING_LIVE` only drives the dashboard notice; sending is controlled by the Outbound Gate node in n8n (held, allowlist empty) |
| Workflow source | `n8n/build-v2.mjs` builds `n8n/prd-buyer-enquiry-assistant-v2.json` from `n8n/original/rl7I6eSBH6ibF0di.json`; code nodes live in `n8n/nodes/` |
