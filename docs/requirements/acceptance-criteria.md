# Acceptance Criteria

Collected from `docs/dashboard-spec.md` section 8 and `docs/requirements/srs.md` (AC-BS, NFR). Status column is TBC unless verified; update it as tests land (`docs/testing/test-plan.md`).

## 1. Dashboard (spec section 8)

| ID | Criterion | Status |
|---|---|---|
| AC-D1 | Unauthenticated requests to any page redirect to sign-in; role matrix enforced server-side and tested per role | TBC |
| AC-D2 | Entra SSO works end to end for a tenant user; fallback sign-in disabled by flag when SSO is on | TBC |
| AC-D3 | Every widget shows a data-status badge derived from its provider; sample widgets show the Sample marking; "Live only" hides sample widgets | TBC |
| AC-D4 | Delivery Progress shows all five projects with progress, next milestone, PRD-owned asks and blockers | TBC |
| AC-D5 | Buyer Sequencing lists real conversations (test excluded by default); thread view shows both sides and extracted fields; metrics match source within 1 percent | TBC |
| AC-D6 | Pipeline supports ten stages, move with event history, "confirm zoning before acting" rule, filters, weekly snapshot | TBC (weekly snapshot not built) |
| AC-D7 | Map renders pipeline sites, farm suburbs and demand heat with layer toggles and click-through | TBC |
| AC-D8 | Market Insights lists gaining and cooling suburbs and each suggestion lists its inputs | TBC |
| AC-D9 | Finance renders only with Sample marking until a provider is live; CSV import replaces sample values | TBC |
| AC-D10 | Feedback works with page context; conversation reply rating stored; "You said, we did" visible | Partial (rating and changelog TBC) |
| AC-D11 | Alerts and logs show integration events with redaction; acknowledge and assign work | TBC |
| AC-D12 | Audit log records sign-ins, role changes, PII reveals and stage moves | Partial (PII reveals TBC) |
| AC-D13 | Lighthouse performance and accessibility at least 90 on key pages; WCAG AA contrast; keyboard navigable; no horizontal scroll at 768 px | TBC |
| AC-D14 | No secret or PII in the repository; sample and live rows never mixed in one aggregate unless labelled | TBC |

## 2. Buyer Sequencing (SRS 3.5)

| ID | Criterion |
|---|---|
| AC-BS-1 | A real enquiry outside business hours gets a substantive, fact-correct reply within 10 minutes naming the right agent and next inspection |
| AC-BS-2 | No reply states a price for a withdrawn, sold or conditional listing; no vendor-confidential field reaches a buyer |
| AC-BS-3 | The conversation follows answer, inspect, then position-to-transact; no preference questions |
| AC-BS-4 | A buyer SMS reply continues the same conversation; STOP halts all messaging |
| AC-BS-5 | A qualified buyer appears in Vault under the agreed category (TBC category); actionable buyers are emailed to the listing agent once with the reason |
| AC-BS-6 | Every turn is visible on the dashboard; failures reach the alert channel (TBC destination) |
| AC-BS-7 | No duplicate replies, no postcode-as-message, no duplicate agent emails across a 20-enquiry test |

Other projects: AC for Development Site Playbook and Meta are in SRS sections 4.5 and 5.4.

## 3. Non-functional (SRS 8.4, extract)

| ID | Criterion |
|---|---|
| NFR-PERF-01 | First reply within 15 minutes of arrival; website chat within 10 seconds |
| NFR-PERF-02 | At least 100 enquiries a day without dropped or duplicated replies |
| NFR-REL-01 | No silent failures; every failed step alerts; retries idempotent |
| NFR-REL-02 | Durable state in external storage; no reliance on n8n static data |

## 4. Engineering acceptance (this repo)

- CI green (`ci`, `e2e`), coverage thresholds met, bug fixes have regression tests
- Authorization server-side on every page and action; zod validation; parameterised SQL
- Vendor-confidential Vault fields never forwarded
- Docs updated; verification checklist in `docs/deployment/deployment-process.md` passed on staging
