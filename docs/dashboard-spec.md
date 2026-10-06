# PRD Penrith Operations Dashboard: Build Specification

| | |
|---|---|
| Version | 0.1, 2026-10-06 |
| Audience | Claude design / Claude Code (builder), Hamza, Irfan, Suffyan |
| Purpose | One authenticated dashboard where Darren, Thomas, agents and ops see every REMAP project at a glance, real data where it exists, clearly labelled sample data where it does not |
| Related | [requirements/srs.md](requirements/srs.md), [requirements/engagement-context.md](requirements/engagement-context.md) |

## 1. Principles

1. **Honest by construction.** Every module, widget and number carries its data status. Nothing sample ever looks real (see 3).
2. **Show progress, not updates.** Darren asked to "see it working". The landing page answers: what is done, what is next, what we need from you.
3. **Plain language.** Written for a real-estate principal, not an IT manager. No jargon in labels, tooltips explain terms.
4. **Compact, soft, light.** Dense but calm. Light backgrounds, soft shadows, generous rounding, Poppins.
5. **Build once, swap data later.** Every widget reads from a data-provider interface with `live` and `sample` implementations. Claude Code replaces sample providers with live ones without touching the UI.
6. **Secure by default.** Authenticated, role-scoped, audited. No public URLs, no secrets in the repo.

## 2. Brand and visual design

Extracted from prd.com.au (global stylesheet): font Poppins; brand red about `#E41E26` (also `#F30000` in places); neutral grey `#747374`; page greys `#EFEFEF`, `#FAFAFA`, `#F5F6FA`, `#DCDEE2`. Logo not fetched: use the official PRD Penrith logo supplied by Thomas or Lily, text wordmark placeholder until then.

### 2.1 Tokens (light theme, default)

| Token | Value | Use |
|---|---|---|
| `--bg` | `#FAFAFB` | page background |
| `--surface` | `#FFFFFF` | cards |
| `--surface-soft` | `#F5F6FA` | table stripes, inputs |
| `--border` | `#EAEAEF` | hairlines |
| `--text` | `#2B2B33` | body |
| `--text-soft` | `#747374` | secondary (PRD grey) |
| `--brand` | `#E41E26` | primary actions, active nav, key accents (sparingly) |
| `--brand-tint` | `#FDECEC` | selected row, active nav background |
| `--brand-ink` | `#B3141B` | text on tint |
| `--live` | `#1F9D6B` / tint `#E6F6EF` | Live |
| `--prototype` | `#E8A100` / tint `#FFF5DB` | Prototype or waiting on access |
| `--planned` | `#8A8F9C` / tint `#EEF0F4` | Planned |
| `--sample` | `#6C5CE7` / tint `#EFEDFD` | Sample data ribbon |
| `--danger` | `#D64545` | errors, blockers |

Dark theme optional (nice-to-have): invert surfaces, keep tokens as CSS variables from day one.

### 2.2 Type and shape
- Poppins (400, 500, 600), tabular numerals for KPIs. Base 14 px, tables 13 px, KPI figures 28 px / 600.
- Radius 12 px cards, 8 px controls, 999 px pills. Shadow `0 1px 2px rgba(20,20,40,.04), 0 4px 16px rgba(20,20,40,.04)`. Spacing 4/8 px grid.
- Charts: soft pastel fills, one accent colour per series, thin axes, no gridline clutter; sequential map ramp from `#FDECEC` to `#E41E26`.
- Icons: Lucide, 1.5 px stroke.
- Motion: 150 ms ease; subtle count-up on KPIs; "pulse" dot on Live badges; skeleton loaders. Respect `prefers-reduced-motion`.
- Responsive: desktop first, usable on tablet; phone shows Delivery Progress and Alerts only.

### 2.3 Layout
Left sidebar (collapsible, 232 px / 64 px icons), top bar (global search, date range, data-status filter, notifications, user menu), content area on a 12-column grid with compact cards. "Catchy" for upcoming projects: gradient-outlined "Coming next" cards with a progress ring, target date and a "What you'll get" teaser; hover reveals a mock screenshot.

## 3. Data-status system (the honesty layer)

| Badge | Meaning | Where shown |
|---|---|---|
| Live (green, pulsing dot) | Reads from the real system now. Tooltip names the source and last refresh time. | Module header, each widget corner |
| Waiting on access (amber) | Built, needs a credential/approval. Tooltip says exactly what and who. | same |
| Prototype (amber outline) | Working UI, data partly sample. | same |
| Planned (grey) | Not started. Teaser only. | same |
| Sample data (violet ribbon, diagonal on corner + footer text "Sample data: not PRD figures") | Invented for layout. | every widget using the sample provider |

Rules:
- A widget's badge is derived from its provider (`provider.status`), never set by hand in the UI.
- Global filter "Show: All / Live only" lets Darren hide everything that isn't real.
- Sample numbers are visibly synthetic (round-ish, ribbon on, no real names or addresses of buyers). Never use real people's names in sample data.
- A "Data sources" page lists each source, status, last sync, owner, and what is needed to go live.
- Revenue, expense and forecast widgets are Sample until a finance feed exists; no figures presented as PRD's.

## 4. Information architecture

Sidebar groups:

**Overview**
- Delivery Progress (landing page)
- Executive Overview

**Departments**
- Sales: Buyer Sequencing (Live), Listings and Demand
- Site Acquisition: Development Pipeline (Live/Prototype), Map
- Project Marketing: Projects and Stock, Meta Lead Funnel
- Property Management (Planned)
- Commercial (Planned)

**Insights**
- Market Insights (traction by suburb and type)
- Finance (Sample)

**Operate**
- Activity and Tasks
- Alerts and Logs
- Feedback
- Data Sources

**Admin** (role-gated): Users and Roles, Audit Log, Settings

### 4.1 Delivery Progress (landing page)
Purpose: neutralise the "we can't see progress" complaint.
- Header strip: engagement day count, next call (Wed 2pm AEST) with agenda link.
- Project cards (BS, DP, MS, VA, GR): status badge, progress ring (% of requirements Done from the SRS), one-line plain summary, "next milestone + date", "what we need from PRD" (max 3 items, each with owner and a Done button for PRD users).
- Timeline: 30-day milestones (from the milestone plan) with done/next/at-risk.
- "This week we shipped" feed (sourced from Jira or manual entries), each with screenshot/recording link.
- Blockers panel: ClickSend inbound rule, contact category, alert destination, etc., with owner and age.
- Source: Jira API (BLD/AIS) or admin-editable `progress` table. Initially admin-edited.

### 4.2 Executive Overview
KPI row: enquiries (7d), median first-response time, qualified buyers, Hot buyers handed over, sites in pipeline, project stock available, Meta leads this week vs target. Below: pipeline funnel (site to sale), enquiry trend, top suburbs by demand, alerts, revenue/expenses/forecast (Sample, ribbon on).

### 4.3 Buyer Sequencing (Live)
Tabs: Conversations, Funnel, Handovers, Quality, Settings.
- **Conversations:** table from the conversation log: time, buyer (name, masked phone), property, source (REA/Domain/website/Meta), classification (Hot/Warm/New), status (replying, handed over, stopped, escalated, opted out), agent. Click opens a thread drawer with both sides, extracted fields, consent, reason for handover, and Vault contact link. Filters: classification, source, agent, date, test vs real. Real vs test is a column and filter; test conversations carry a "Test" tag and are excluded by default.
- **Funnel:** enquiries, in-scope, replied, buyer responded, inspection offered/booked, handed over, in Vault. Median and 90th percentile response time; after-hours share.
- **Handovers:** per agent queue with age and "why escalated"; mark contacted (feeds a feedback loop on quality).
- **Quality:** flags from automatic checks (duplicate reply, postcode-as-message, price quoted on non-live listing, preference question asked, empty reply) with counts and examples. Re-runs the NFR-QUAL-01 regression set status.
- **Settings (read-only for PRD):** scope rules, hours, hot-buyer definition (editable by Principal once confirmed).
- Source: external conversation store (n8n log), Vault API (listings, contact creation status), ClickSend (delivery). Badge Live per source; if outbound is still held, show "Outbound send: held" amber chip.

### 4.4 Listings and Demand
Active listings from Vault with enquiries per listing (7/30 days), response time, Hot count, days on market, price band, open home next. Heat colouring. Source: Vault sale-life records + conversation log. Live when Vault key is connected; Sample until then.

### 4.5 Development Pipeline (site detection to sale)
Kanban plus table plus timeline views. Stages (configurable):
1. Detected (DA/CDC/listing signal)
2. Qualified (zoning confirmed plus second signal)
3. Owner traced
4. Approached
5. Negotiation
6. Acquired / under contract
7. Approved for development (DA)
8. Marketing (project launched)
9. Selling
10. Sold out / settled

Card: address, suburb, zoning chip (confirmed vs TBC), lot size, signal chips (refusal under review, adjoining lots, expired listing), priority H/M/L, owner/assignee, days in stage, next step. Drag between stages writes an activity event. Detail drawer: DA info, zoning/FSR/height/overlays with source and confirm button, owner-trace chain (ABN, ASIC, Cordell, iD4Me states), notes, documents, activity history, linked project when it reaches stage 8.
Data: tracker v2 rows (Live: six real DAs), NSW Planning Portal DA feed (Live when connected), zoning via Spatial Viewer (manual confirm), paid sources (Waiting on access: RP Data, Cordell, Cityscope). Weekly snapshot widget mirrors the workbook tab. Rows with TBC zoning show an amber "Confirm before acting" tag and are excluded from priority lists.

### 4.6 Map
MapLibre GL with OpenStreetMap-based tiles (no paid key needed; style in soft light grey).
- Layers: pipeline sites (pin colour = stage), farm suburbs (polygons shaded by priority), buyer demand heat (enquiries by listing suburb), project locations, listings, optional LGA boundary.
- Panel: layer toggles, stage filter, click-through to pipeline card.
- Data: geocoded addresses (store lat/lng at ingest via a geocoder; cache), suburb polygons from ABS/Data NSW open boundaries.
- Sample points allowed only with the Sample ribbon.

### 4.7 Projects and Stock (project marketing)
Six projects (Perle, Havenwood Estate, Rodley Square, Sky Gardens, Eden, 75 Great Western Highway): units total/available/sold, stock value, enquiries, price band. Real headline figures from the Business Analysis (65 units, $46.6m available, 1 sold) seed this as Live-from-document until the projects stock sheet is connected. Source: the Google Sheet "projects stock dashboard" (read-only API) when granted.

### 4.8 Meta Lead Funnel
Weekly enquiries vs target of 100, source campaign, time to first contact, promoted to Vault (manual step shown as a stage: Sheet, Thomas call, approved, Thea adds to Vault), drop-off. Source: Thomas's Google Sheet (read-only) when granted. Until then Sample, with the 45-in-10-days figure shown as a real reference marker.

### 4.9 Property Management and Commercial (Planned)
Teaser cards only: "Coming next", what you'll get (arrears tracker, inspection and renewal deadlines, lost-management survey, landlord health-check pipeline), indicative timeline, request-priority button that posts to Feedback. Sample preview behind a "Preview with sample data" toggle.

### 4.10 Market Insights
Answers: what is gaining traction, what is not, where to focus buying and selling.
- Demand by suburb and property type (enquiries per listing, inspections, Hot ratio, days on market).
- Gaining / cooling lists with trend arrows over 30/90 days.
- Focus suggestions: rule-based scoring from demand, supply (listings), pipeline sites and DA activity per suburb, shown with the inputs ("why"). Not AI claims: transparent score.
- Source: Vault enquiries and listings (Live once keyed), pipeline, council DA feed.

### 4.11 Finance (Sample)
Revenue in, expenses out, expected settlements, commission forecast, project sales revenue, by department. Always ribbon-on Sample until a finance feed exists (Vault sales, PropertyMe, Xero/MYOB: unknown, ask Darren). Layout shows what would appear. CSV import widget (admin) so real figures can replace sample without code.

### 4.12 Activity and Tasks
Cross-department activity stream (events from all modules: stage moves, handovers, approvals, deployments) plus tasks assigned to people (e.g. "Confirm zoning: 18 Sydney St"), due dates, owners, status. Assignable to PRD users. Task source: internal table; optional Jira link for REMAP items.

### 4.13 Alerts and Logs
- Alerts: workflow failures, Vault/ClickSend/Meta errors, opted-out buyers, duplicate detections, quality flags, expiring credentials. Severity, acknowledge, assign, link to log.
- Logs: structured integration log (timestamp, source, event, correlation ID, redacted payload), searchable, retention 90 days. PRD users see business-level events; REMAP admins see technical.
- Delivery of alerts: in-app, plus email/Teams webhook (destination TBC with Darren).

### 4.14 Feedback loop
Goal: make it easy for PRD to correct us early.
- Floating "Feedback" button on every page captures page, widget, screenshot (optional), and a one-click rating (useful / confusing / wrong), then a short note.
- Per-conversation "This reply was good / not good" with reason chips (wrong fact, wrong order, too pushy, repeated, missed inspection); feeds Quality metrics and the regression set.
- Feedback page: list with status (New, Planned, In progress, Done, Won't do), votes, owner, linked Jira key, and a "You said, we did" changelog visible to all users.
- Weekly digest to Irfan and the Wednesday call agenda.

### 4.15 Data Sources
Table of sources: Vault, ClickSend, n8n log, Meta, Google Sheets (projects, Meta leads), NSW Planning Portal, councils, RP Data/Cordell (Waiting on access), Entra, Jira. Columns: status, last sync, owner, scope, what's needed. Test connection button (admin).

## 5. Authentication and authorisation

### 5.1 Authentication
- OpenID Connect SSO with **Microsoft Entra ID** (PRD uses Microsoft 365). Use Auth.js (or equivalent) with the Entra provider, authorisation code flow with PKCE, tenant-restricted, ID-token group/role claims mapped to app roles.
- REMAP staff sign in with REMAP tenant (multi-tenant or guest) or a separate Entra app registration, mapped to REMAP roles.
- Bootstrap and fallback (until PRD IT registers the app, which Hamza controls for REMAP's own tenant): email magic link or password with MFA for seeded accounts. A feature flag `AUTH_ENTRA_ENABLED` switches Entra on without a redeploy. Fallback must be disabled for PRD users once Entra works.
- Sessions: secure, httpOnly, SameSite=Lax cookies, 8 h idle timeout, re-auth for admin actions.
- Required Entra setup (document for Lily/PRD IT): app registration, redirect URIs, tenant ID, client ID, client secret via secure credential link (never email), group-to-role mapping, optional conditional access.

### 5.2 Roles and permissions

| Role | Who | Can see | Can do |
|---|---|---|---|
| `principal` | Darren | everything incl. Finance | approve, edit definitions, manage PRD users |
| `exec` | other directors | everything | view, comment |
| `sales_agent` | agents | Buyer Sequencing (own handovers and all conversations read), Listings, Pipeline read | mark contacted, feedback |
| `marketing` | Thomas, Thea | Project Marketing, Meta funnel, Pipeline, Buyer Sequencing | edit pipeline, tasks, promote leads |
| `acquisitions` | Darren, Thomas | Development Pipeline, Map | move stages, confirm zoning, edit criteria |
| `ops` | Lily | Data Sources, Users (PRD), Alerts | manage access, acknowledge alerts |
| `remap_admin` | Hamza, Irfan, Suffyan | everything incl. technical logs | configure, connect sources, user admin |
| `viewer` | read-only guests | Delivery Progress, Overview | none |

Rules: server-side enforcement on every API route (never UI-only); row-level filters for agent scope; Finance restricted to `principal`/`exec`/`remap_admin`; buyer personal data masked (phone, email) except for roles that need it; reveal action is logged.

### 5.3 Audit
Log: sign-ins, role changes, data reveals, exports, stage moves, config changes, feedback status changes. Immutable append-only table, shown in Admin > Audit Log with filters and CSV export.

## 6. Technical design

### 6.1 Suggested stack
Next.js (App Router, TypeScript), Tailwind with the tokens above, shadcn/ui primitives, Recharts or ECharts for charts, MapLibre GL, Postgres (Drizzle or Prisma), Auth.js, Zod for validation, TanStack Query. Deploy via the existing REMAP pipeline (Dokploy or Vercel); staging before production per the Development Pipeline Plan. If Claude design proposes another stack, keep the provider interface (6.2) and the contracts below.

### 6.2 Data providers
```
interface Provider<T> { status: 'live'|'waiting'|'prototype'|'planned'|'sample'; lastSync?: Date; owner: string; get(params): Promise<T> }
```
Each widget declares which provider it uses; the registry selects live if configured and healthy, else sample. Providers: `conversations`, `listings`, `enquiries`, `vaultContacts`, `pipelineSites`, `daFeed`, `projectsStock`, `metaLeads`, `finance`, `progress`, `feedback`, `activity`, `alerts`.

### 6.3 Core data model (Postgres)
`users`, `roles`, `user_roles`, `audit_log`, `data_sources`, `sync_runs`, `conversations`, `conversation_turns`, `buyers` (masked refs), `listings_cache`, `pipeline_sites` (stage, zoning, zoning_source, zoning_confirmed_by, lot_size, signals[], priority, assignee, lat, lng), `pipeline_events`, `owner_traces`, `farm_suburbs`, `projects`, `project_units_summary`, `meta_leads`, `finance_entries`, `tasks`, `activity_events`, `alerts`, `feedback`, `feedback_votes`, `progress_items`, `settings`. All with created/updated stamps; `is_sample` boolean on any seeded row.

### 6.4 Integrations (go-live order after design)
1. n8n conversation log store (read), the real chats.
2. n8n/automation stats: executions, success rate, failures.
3. MRI Vault API (key supplied later via secure credential service, stored in env/secret manager): listings and sale-life records, enquiries, contact creation status. Respect daily quota, cache aggressively (poll every 10 min, listings every 30 min), whitelist fields (never vendor commission, marketing spend, appraisal, authority expiry).
4. Entra ID (SSO).
5. NSW Planning Portal DA feed (free) plus tracker v2 import.
6. ClickSend delivery/inbound stats (read).
7. Google Sheets (projects stock, Meta leads), read-only service account.
8. Jira (progress items), optional.
9. Later: RP Data/Cordell/Cityscope when access and cost are confirmed.

### 6.5 Security and privacy
- No secrets in Git; `.env.example` only; keys in secret manager. The Vault key and any credentials are shared through the secure credentials service, not chat or email.
- Buyer PII minimised and masked by default; retention configurable; export/delete on request; Australian Privacy Act aware; privacy notice in the app footer.
- Strict CSP, CSRF protection, rate limiting, input validation (Zod) at every boundary, parameterised queries only.
- The existing public conversation dashboard URL must be retired or put behind this app's auth.
- Separate staging and production data; seeded sample data never loaded in production tables marked live.

## 7. Seed and sample data

- Seed script generates synthetic data flagged `is_sample`: about 40 pipeline sites across 12 suburbs (St Marys, Kingswood, Oxley Park, Mulgoa, Werrington, Penrith, Cambridge Park, Cranebrook, Glenmore Park, Emu Plains, Caddens, Jamisontown) spread over stages; 12 weeks of enquiry and revenue series; property-management arrears/inspection items; Meta funnel weeks.
- Real data loaded as Live-from-document where it exists: six tracker DAs (with zoning TBC), farm list, six project names, 65 units / $46.6m / 1 sold, 45 Meta leads per 10 days vs 100/week target, milestone plan, SRS requirement statuses.
- Sample buyers use obviously fictional names ("Sample Buyer 01") and invented numbers.
- Replacement path: each sample provider has a documented switch to a live provider; Claude Code replaces them module by module; the UI does not change.

## 8. Functional acceptance criteria

1. Unauthenticated requests to any page or API redirect to sign-in; role matrix enforced server-side (tested per role).
2. Entra SSO works end to end for a tenant user; fallback sign-in disabled by flag when SSO is on.
3. Every widget shows a data-status badge derived from its provider; sample widgets show the violet ribbon; "Live only" filter hides all sample widgets.
4. Delivery Progress shows all five projects with progress rings, next milestone, PRD-owned asks and blockers.
5. Buyer Sequencing lists real conversations from the log (test excluded by default); thread drawer shows both sides and extracted fields; response-time and funnel metrics match the source within 1%.
6. Pipeline supports all ten stages, drag-and-drop with event history, zoning "confirm before acting" rule, filters, and the weekly snapshot view.
7. Map renders pipeline sites, farm suburbs and demand heat with layer toggles and click-through.
8. Market Insights shows gaining/cooling suburbs and each suggestion lists its inputs.
9. Finance renders only with the Sample ribbon until a finance provider is live; CSV import replaces sample values.
10. Feedback button on every page works with page/widget context; conversation reply rating is stored; "You said, we did" changelog visible.
11. Alerts and logs page shows integration events with redaction; acknowledge and assign work.
12. Audit log records sign-ins, role changes, PII reveals and stage moves.
13. Lighthouse performance and accessibility at least 90 on key pages; WCAG AA contrast on tokens; keyboard navigable; no horizontal scroll at 768 px.
14. No secret or PII in the repository; sample and live rows are never mixed in a single aggregate unless clearly labelled.

## 9. Build order for Claude Code

1. App shell, tokens, sidebar, auth (fallback first, Entra behind flag), roles, audit, data-status system.
2. Provider registry, seed script, Data Sources page.
3. Delivery Progress and Executive Overview.
4. Buyer Sequencing against the real conversation store.
5. Pipeline and Map with tracker import.
6. Projects and Stock, Meta funnel, Listings and Demand, Market Insights.
7. Finance (Sample), Property Management/Commercial teasers.
8. Activity, Alerts and Logs, Feedback.
9. Vault integration (key from secure channel), NSW DA feed, ClickSend stats, Sheets.
10. Hardening: tests, security review, staging UAT, production deploy with rollback notes.

## 10. Inputs still needed

| Item | From |
|---|---|
| PRD logo and any brand guide | Thomas/Lily |
| Vault API key (via secure credential service) | Hamza |
| Entra app registration (REMAP tenant now; PRD tenant for their users) | Hamza / PRD IT |
| Read access to projects stock sheet and Meta leads sheet | Thomas |
| Finance source (Vault, PropertyMe, accounting system) and permission | Darren |
| Hot-buyer definition, contact category, alert destination | Darren |
| Hosting target and domain for the app | Hamza |
