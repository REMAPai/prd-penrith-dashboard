# Business Requirements

Summary of `engagement-context.md`, `srs.md` and `dashboard-spec.md`. Not a new source: when this disagrees with those, they win. Unknowns are TBC.

## 1. Client and goals

PRD Penrith (Latty and Partners Real Estate Pty Ltd), a full-service Western Sydney agency. Principal Darren Latty. The principal estimates the 74,541-contact database generates under 5 percent of sales against a 20 percent target. Enquiries had no automated response, conversation record or systematic qualification.

| Goal | Measure | Source |
|---|---|---|
| Lift database-sourced sales from under 5 to 20 percent (long term) | Sales conversion | SRS 3.1 |
| Reply to every buyer enquiry within minutes with correct facts | Response latency, first reply within 15 min (NFR-PERF-01) | SRS 3.1 |
| Move buyers to inspections; hand qualified buyers to agents with context | Inspection offered/booked, handovers, permission capture | SRS 3.1, 3.2 |
| Make progress visible ("see it working") | Single dashboard with honest data status | Spec 1 |
| Source development sites weekly with human-verified zoning | Pipeline and Playbook | SRS 4 |
| Keep the engagement: month four depends on both priority projects being active and fully functional | Darren's decision (TBC outcome) | Engagement context |

## 2. Projects in scope

| ID | Project | Priority | State |
|---|---|---|---|
| BS | Incoming Buyer Sequencing | 1 | Built on live Vault data, outbound held |
| DP | Development Site Playbook | 2 | Workbook built, automation not built |
| MS | Meta and Social Enquiries | 3 | Scoped, not started |
| VA | After-hours voice agent | 4 | Prototype only |
| GR | Google reviews | Parked | Parked |
| CD | Client dashboard (this application) | Additional | Staging live, prototype |

Out of scope: property management (leasing) enquiries, vendor prospecting automation, commercial sales (SRS 1.2). Property Management and Commercial appear in the dashboard only as Planned teasers.

## 3. Stakeholders

Darren Latty (sponsor, decision maker, plain language, mornings AEST), Thomas Latty (marketing, ClickSend, Meta, Google Sheet), Lily Masters (operations, access), Thea (adds Meta enquiries to Vault), sales agents, REMAP delivery (Irfan, Suffyan, Zimal, Hamza). Wednesday 2pm AEST weekly call.

## 4. Business requirements for the dashboard

| ID | Requirement | Spec ref |
|---|---|---|
| BR-1 | One authenticated view of every REMAP project for Darren, Thomas, agents and ops | Spec 1 |
| BR-2 | Show progress, not updates: done, next, what we need from PRD, with owners and dates | Spec 4.1, CD-01 |
| BR-3 | Every widget shows its data status (Live, Waiting on access, Prototype, Planned, Sample); sample is never presented as real; Live-only switch | Spec 3 |
| BR-4 | Plain language, no jargon | Spec 1 |
| BR-5 | Buyer Sequencing shows real conversations, quality flags and handovers | Spec 4.3 |
| BR-6 | Listings and demand from Vault, vendor-confidential fields never exposed | Spec 4.4, 6.4 |
| BR-7 | Development pipeline with ten stages, history and a "confirm zoning before acting" rule | Spec 4.5 |
| BR-8 | Map of sites, listings and demand | Spec 4.6 |
| BR-9 | Role-based access, server-side, audited; company and branch scoping | Spec 5 |
| BR-10 | Feedback loop so PRD can correct REMAP early; "you said, we did" | Spec 4.14 |
| BR-11 | Data Sources page showing source status, owner and what is needed | Spec 4.15 |
| BR-12 | Finance and Meta stay Sample until real feeds exist | Spec 4.8, 4.11 |
| BR-13 | Delivery follows documented process: dated scope and change log, per-workflow tests, n8n exports in GitHub, Jira tracking | SRS 8.2 |

## 5. Compliance and constraints

Spam Act 2003 (consent, identification, unsubscribe), Do Not Call Register Act 2006 (inbound enquiries exempt per Darren), Privacy Act 1988 (collection notice, retention, cross-border processing). Legal review of consent wording is open. Platform constraints C1 to C12 in SRS 2.3. Time zone gap: 1 to 5pm AEST is 8am to 12pm PKT.

## 6. Open items (TBC)

Hot-buyer definition, contact category for qualified buyers, alert destination (Teams), finance data source, owner on the PRD side, month-four decision, official PRD logo, access to the projects stock and Meta leads sheets, Jira access for PRD.
