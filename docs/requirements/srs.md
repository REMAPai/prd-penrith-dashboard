# Software Requirements Specification: PRD Penrith AI Programme

| | |
|---|---|
| Client | PRD Penrith (Latty and Partners Real Estate Pty Ltd), Darren Latty, Principal |
| Delivery | REMAP.ai / AIS: Hamza (technical lead), Irfan (PM), Suffyan (delivery), second developer TBC |
| Version | 0.1 draft, 2026-10-06 |
| Status | For internal review (Hamza/Irfan), then validation with Darren and Thomas at the 7 Oct strategy call |
| Sources | Shared Drive folder (Business Analysis report 2 Oct, Buyer Enquiry Requirements, Buyer Enquiry Workflow Documentation, Development Site Sourcing Tracker v2, 2-Week/30-Day Milestone Plan, AI-Assisted Development Pipeline Plan), PRD email thread Aug-Oct 2026, Gemini/Read AI meeting notes. See [engagement-context.md](engagement-context.md). |

Conventions: requirement IDs are `PROJECT-AREA-nn`. "Shall" = required. Status is one of **Done** (verified against live data per the Buyer Enquiry Requirements document), **Partial**, **Blocked**, **Open** (not built), **TBC** (needs client decision). Items I inferred rather than found in a source are marked *(inferred)*; confirm before building.

---

## 1. Introduction

### 1.1 Purpose
Specify the software requirements for every project in the PRD Penrith engagement so that design, build, testing and acceptance are traceable to client needs and to the Jira tickets that will be raised from this document.

### 1.2 Scope
Five projects, in priority order:

| ID | Project | Priority | State |
|---|---|---|---|
| BS | Incoming Buyer Sequencing (incl. messaging and conversation dashboard) | 1 | Built against live Vault data, outbound send held |
| DP | Development Site Playbook | 2 | Spreadsheet workbook v2 built, automation not built |
| MS | Meta and Social Enquiries | 3 | Scoped, not started |
| VA | After-Hours Voice Calling Agent | 4 | Prototype only, client cautious |
| GR | Google Reviews Processing | Parked | Parked after realestate.com.au conversation |

Cross-cutting: client reporting dashboard (CD), delivery documentation and process (DOC), compliance (CMP), non-functional requirements (NFR).

Out of scope: property management (leasing) enquiries, PropertyMe/RentPay, vendor-side prospecting automation, commercial sales. The Business Analysis lists property-management automation as a possible later initiative but it is not part of this engagement.

### 1.3 Definitions
- **Vault / VaultRE**: MRI's real-estate CRM, the system of record for sales contacts and listings.
- **Holding Area**: Vault's queue where portal/website enquiries land before a human creates a contact.
- **Partner Connect**: MRI's program under which PRD holds API access ($500/yr, agreement signed Sep 2026).
- **REA / Domain**: realestate.com.au and Domain portals, the main enquiry sources.
- **Web book**: Designly property info pack linked from each listing.
- **DA / CDC**: Development Application / Complying Development Certificate (NSW planning).
- **LGA**: Local Government Area (Penrith City, Blue Mountains).
- **ClickSend**: Australian SMS provider chosen for two-way messaging.
- **Hot / Warm / New**: buyer classifications defined in BS-CLS.
- **DNC**: Do Not Call register; **STOP**: SMS opt-out keyword (Spam Act 2003).

### 1.4 Stakeholders and users

| Role | Who | Interest |
|---|---|---|
| Sponsor / decision maker | Darren Latty | Priorities, approval, renewal (month four) |
| Technical contact, project marketing | Thomas Latty | Meta ads, ClickSend, Power Automate, Google Sheet leads |
| Operations / access | Lily Masters | Accounts and access |
| Sales agents | Jeremy Moss, Ryan Hatch, Joe Masters, Angelina Latty, Cristina Bartuccio | Receive qualified buyers |
| Sales admin | Leonie Holland | Holding Area review |
| Project marketing admin | Thea Buenvenida | Promotes approved Meta leads into Vault |
| Acquisitions / BD | Darren, Thomas | Playbook output |
| Buyers | public | Receive replies; must not be spammed or misled |
| REMAP delivery | Hamza, Irfan, Suffyan, Zimal | Build, run, report |

### 1.5 References
Source documents listed above; NSW Planning Portal; MRI VaultRE API; ClickSend API; Meta Graph API; Spam Act 2003 (Cth); Do Not Call Register Act 2006 (Cth); Privacy Act 1988 (Cth).

---

## 2. Overall description

### 2.1 Business context
PRD Penrith is a full-service Western Sydney agency (sales, property management, project marketing, site acquisition, commercial). The principal estimates its 74,541-contact database generates under 5% of sales against a 20% target. Enquiries arrive in a queue with no automated response, no conversation record and no systematic qualification, so the first-responder advantage is lost (BA friction points 1-7). Month-four renewal depends on Buyer Sequencing and the Development Site Playbook both being live and working.

### 2.2 System context

```
 REA / Domain / website forms ──> Vault Holding Area ──poll──> [n8n: Buyer Sequencing] ──> Vault (contact, category)
 Website chat widget ───────────────────────────────────────> [n8n: Buyer Sequencing]      │
 Meta landing-page forms ──> Google Sheet ──(manual)──> Vault                              ├──> ClickSend (outbound SMS/email)
 Meta Lead Ads / DMs (future) ──> [n8n: Meta flow]                                         │<── ClickSend inbound webhook
                                                                                           ├──> Anthropic API (conversation, extraction)
 Council DA trackers, NSW Planning Portal, aggregators ──> [Playbook] ──> weekly report    ├──> External store (conversation log, memory)
                                                                                           ├──> Agent notification email
                                                                                           ├──> Failure alerts (Teams, destination TBC)
                                                                                           └──> Conversation dashboard (automations.remap.ai)
```

### 2.3 Platform constraints (design drivers)
Discovered during build; each forced a design decision and must be respected by any change.

| ID | Constraint | Consequence |
|---|---|---|
| C1 | Vault has no contact search endpoint | Local email/phone index; opt-out cannot be checked for contacts we have not seen; duplicates possible for old contacts |
| C2 | Vault webhooks only for approved partners | Scheduled polling (10 min) |
| C3 | Vault SMS sends from the agent's personal mobile | Replies cannot reach the system; dedicated ClickSend number required |
| C4 | Vault messaging endpoints are staff chat only | Not usable for buyer conversations |
| C5 | Vault event-stream endpoint returns 403 (scope not granted) | Requested from MRI; not blocking |
| C6 | Listing detail (price, beds, description) is on the sale-life record, not the property | Fetch from sale-life path |
| C7 | Suburbs endpoint has about 19,650 records over 393 pages with no filter | Structured requirements deferred until cached lookup exists |
| C8 | Contact notes endpoint returns 500 | Conversation note write blocked; agent email carries the content |
| C9 | n8n workflow static storage is not safe across concurrent executions | All durable state in external storage |
| C10 | Meta Lead Ads retrieval needs `leads_retrieval` permission via App Review; business verification takes weeks | Landing-page route used for current campaigns |
| C11 | Portal listing numbers differ from Vault property IDs | Translation layer (sale-life ID, fallback address) |
| C12 | MRI treats the integration as PRD's responsibility to develop, operate and support | Support sits with REMAP under the engagement |

### 2.4 Assumptions and dependencies
- A1: Vault API credentials and ClickSend account stay in PRD's name; REMAP holds working credentials in n8n credential storage only.
- A2: Darren names an owner on the PRD side (acknowledged gap). Without one, client-side items stall.
- A3: Month-four continuation is conditional on both priority projects being live; this governs prioritisation.
- A4: Working hours overlap: PRD mornings AEST for meetings; weekly call Wednesday 2pm AEST (7am PKT); Suffyan works PRD hours.

### 2.5 Constraints
- Stack in use: n8n, Anthropic API, ClickSend, MRI Vault API, external datastore, Teams for alerts, Jira (BLD/AIS projects), GitHub (n8n exports to be stored there).
- AI use follows the AI-Assisted Development Pipeline Plan: developer reviews every AI-generated change; secrets never in Git; only `.env.example` committed; staging before production.
- Client communication in plain, non-technical language; actions discussed on the weekly call, not only in writing.

---

## 3. Project BS: Incoming Buyer Sequencing

### 3.1 Objective
Answer every buyer enquiry within minutes using verified listing facts, move the buyer to an inspection, establish whether they are in a position to transact, and hand qualified buyers to an agent with context, while writing every buyer into Vault. Long-term target: database-sourced sales from under 5% to 20%. 30-day leading indicators: response latency, qualification completeness, category migration, permission-capture rate.

### 3.2 Conversation policy (client-mandated, 30 Sep)
Order of priority in every conversation:
1. Answer what the buyer asked about that property, properly (no holding response).
2. Get them to an inspection: offer the next open home within 48 hours or a private viewing.
3. Only then learn about the buyer: need to sell first, finance arranged, timeframe. Do not ask what type of property they want (disrespectful to the vendor who pays for the marketing).

### 3.3 Functional requirements

**BS-IN: Enquiry intake**

| ID | Requirement | Status |
|---|---|---|
| BS-IN-01 | The system shall poll Vault for new enquiries every 10 minutes with an overlapping window wider than the interval. | Done |
| BS-IN-02 | The system shall parse property ID, address and agent from the enquiry subject string. | Done |
| BS-IN-03 | The system shall strip portal boilerplate (postcode, market status, finance pre-approval) from the message body so it is never treated as buyer text, and extract those values as structured data. | Done |
| BS-IN-04 | The system shall handle enquiries with no typed message by responding to the buyer, not to a stray label. | Done |
| BS-IN-05 | The system shall normalise REA, Domain, PRD website and chat enquiries to one schema: conversationId, message, conversationHistory, propertyId, contactPhone, contactEmail, contactName, source. | Done |
| BS-IN-06 | The system shall be idempotent: one reply per enquiry ID and per message hash (no triple replies). | Done |
| BS-IN-07 | The website chat shall accept POST `/buyer-enquiry` and return the AI reply, updated history and captured fields. | Done (per workflow doc) |
| BS-IN-08 | REA-sourced enquiries shall enter via Vault (a trigger on new contacts/enquiries tagged REA), not a direct REA integration. | Done |

**BS-CMP: Compliance and scope**

| ID | Requirement | Status |
|---|---|---|
| BS-CMP-01 | The system shall honour separate SMS and email unsubscribe flags before replying on that channel. | Done |
| BS-CMP-02 | The system shall honour an inbound STOP and cease messaging, checked before any reply is generated. | Done |
| BS-CMP-03 | The system shall exclude leasing enquiries. | Done |
| BS-CMP-04 | The system shall filter non-buyer enquiries (sponsorship, job applications, vendor "curious about selling", rental) before any reply. | Done |
| BS-CMP-05 | A reply to our own message shall pass the scope check without re-applying the new-enquiry property test. | Done |
| BS-CMP-06 | The system shall fail closed: where consent or scope cannot be established, it shall not send. | Done |
| BS-CMP-07 | Every message to a buyer shall carry an opt-out instruction. | TBC (Darren to confirm DNC and consent rules; inbound enquiries are exempt from DNC per Darren 2 Sep) |
| BS-CMP-08 | The exact Vault unsubscribe field names shall be confirmed against the live schema. | Open (requested from Thomas) |

**BS-PR: Property resolution**

| ID | Requirement | Status |
|---|---|---|
| BS-PR-01 | The system shall translate portal listing numbers to Vault property IDs (sale-life ID, falling back to address). | Done |
| BS-PR-02 | The system shall fetch about 5,000 listings per run inline, not from workflow static storage. | Done |
| BS-PR-03 | The system shall read price, bedrooms, description and other listing detail from the sale-life record. | Done |
| BS-PR-04 | The system shall trust a property match only when the enquiry address corroborates it. | Done |
| BS-PR-05 | The system shall suppress all facts (especially price) for withdrawn, sold or conditional listings and say the property is off the market. | Done |
| BS-PR-06 | The resolved property ID shall persist per conversation. | Done |
| BS-PR-07 | Only whitelisted fields shall reach the model. Vendor marketing spend, commission rate, internal appraisal and authority expiry shall never be exposed. | Done |
| BS-PR-08 | If the enquiry has no agent, the listing agent shall be read from the property record. | Open |
| BS-PR-09 | For unpriced (launch-stage) listings the assistant shall say honestly that no price guide is published and offer the inspection, not ask for budget as a reply. | Done |

**BS-CV: Conversation**

| ID | Requirement | Status |
|---|---|---|
| BS-CV-01 | The assistant shall answer the buyer's actual question first using only supplied facts; where there are none, defer to the agent. | Done |
| BS-CV-02 | The assistant shall drive towards an inspection, naming the next open home day and time or offering a private viewing, instead of promising a "next business morning" callback. | Done |
| BS-CV-03 | The assistant shall not ask about property type, location, bedrooms or size preferences. (Supersedes the original five-question qualification list in the Workflow Documentation.) | Done |
| BS-CV-04 | The assistant shall qualify on position to transact: need to sell first, finance, timeframe. Deeper financial questions are asked only if the conversation continues naturally. | Done |
| BS-CV-05 | The assistant shall never state an unverified fact. | Done |
| BS-CV-06 | The assistant shall escalate complaints to a human and not attempt to resolve them. | Done |
| BS-CV-07 | The assistant shall maintain multi-turn memory reconstructed from the conversation log. | Partial (needs multi-turn test with property carried through) |
| BS-CV-08 | Replies shall be short, warm, professional and varied (no identical openers across turns). | Done |
| BS-CV-09 | The assistant shall not reply twice to the same inbound message. | Done (see BS-IN-06) |

**BS-CLS: Buyer classification and handover**

| ID | Requirement | Status |
|---|---|---|
| BS-CLS-01 | Buyer type (first home buyer, investor, upgrader, buy-and-sell) shall be derived from REA data, not asked. | Done |
| BS-CLS-02 | Buyers shall be classified Hot / Warm / New. Hot requires pre-approval plus at least one of: fixed deadline, offer on another property, booked inspection. | Done; definition TBC with Darren (his original wording: offer elsewhere, pre-approval, or fixed date) |
| BS-CLS-03 | The system shall hand off to the listing agent on any actionable signal (booked inspection, contract request, explicit consent) without waiting for separate consent. | Done |
| BS-CLS-04 | Each handover shall state why the buyer was escalated. | Done |
| BS-CLS-05 | Agent notifications shall be sent once per buyer event (no duplicates) from a PRD sending address. | Partial (four duplicate emails seen in test; address still a REMAP one) |

**BS-CRM: Vault write-back**

| ID | Requirement | Status |
|---|---|---|
| BS-CRM-01 | The system shall create a Vault contact for every in-scope buyer. | Done (201 verified) |
| BS-CRM-02 | The system shall avoid duplicate contacts using a local email/phone index. | Partial (only buyers seen via this workflow) |
| BS-CRM-03 | The contact shall be categorised. Working assumption "Prospective Buyers"; options are Prospective Buyers, Current Buyers, BUYER HIT LIST, and the original design named "Qualified Buyer Enquiry". | Done; category TBC with Darren |
| BS-CRM-04 | A conversation note shall be written to the contact. | Blocked (Vault 500, raised with MRI) |
| BS-CRM-05 | Buying requirements shall be written as structured fields so Vault can match against new listings. | Deferred (needs suburb and property-type lookup cache; about one day) |
| BS-CRM-06 | Test contacts created in the live CRM shall be removed before client review. | Open |

**BS-MSG: Messaging (ClickSend)**

| ID | Requirement | Status |
|---|---|---|
| BS-MSG-01 | The system shall send replies from a dedicated office number that does not appear on advertising; the agent's direct line is included in the message. | Built, held |
| BS-MSG-02 | The system shall receive buyer replies via a ClickSend inbound webhook. | Built; PRD must point the inbound rule at our webhook |
| BS-MSG-03 | A reply shall be matched to its conversation by outbound tag, falling back to phone number. | Done |
| BS-MSG-04 | The first outbound send shall go to a number we control before any buyer. | Open |
| BS-MSG-05 | The system shall use email for buyers without a mobile (about 25%). | Done (per design; verify) |

**BS-DSH: Visibility**

| ID | Requirement | Status |
|---|---|---|
| BS-DSH-01 | Every turn of every conversation shall be logged. | Done |
| BS-DSH-02 | A dashboard shall list every live conversation: enquirer, property, both sides of the exchange, buyer details captured, consent status, assigned agent; full thread readable. | Done (first pass) |
| BS-DSH-03 | The dashboard shall be reviewed with Darren and its location and layout confirmed. | TBC |
| BS-DSH-04 | The dashboard shall be in place and reviewed before any live buyer message is sent. | Agreed with client |
| BS-DSH-05 | The dashboard shall be access-controlled (currently a public webhook URL; see NFR-SEC-04). | Open |
| BS-DSH-06 | The dashboard shall visually distinguish real conversations from test data. | Open *(inferred, from the 47-transcript confusion)* |

**BS-ALR: Alerts**

| ID | Requirement | Status |
|---|---|---|
| BS-ALR-01 | Failures (AI call, AI parse, Vault write, send failure) shall alert an operations channel so nothing fails silently. | Partial (node built, destination not supplied; likely Teams) |

### 3.4 Release checklist before go-live
Revert test settings (hardcoded notification recipient, widened poll window); controlled first send; inbound webhook URL given to Thomas; duplicate notifications fixed; agent fallback; test records cleared; alert destination set; rotate credentials shared in email.

### 3.5 Acceptance criteria
- AC-BS-1: A real enquiry arriving outside business hours receives a substantive, fact-correct reply within 10 minutes (poll interval) naming the right agent and the next inspection.
- AC-BS-2: No reply states a price for a withdrawn/sold/conditional listing; no vendor-confidential field reaches a buyer.
- AC-BS-3: The conversation follows answer, inspect, then position-to-transact; no preference questions.
- AC-BS-4: A buyer SMS reply is received and continues the same conversation; STOP halts all messaging.
- AC-BS-5: Qualified buyer appears in Vault under the agreed category; actionable buyers are emailed to the listing agent once with the reason.
- AC-BS-6: Every turn is visible on the dashboard; failures reach the alert channel.
- AC-BS-7: No duplicate replies, no postcode-as-message, no duplicate agent emails across a 20-enquiry test.

---

## 4. Project DP: Development Site Playbook

### 4.1 Objective
Automate the site identification Darren does by hand: surface development-relevant DA/CDC activity and open-market signals in target zones across Penrith and Blue Mountains LGAs, qualify them, identify owners, and deliver a weekly report that a nominated team member can run without Darren (about 15 minutes a week). Darren's definition of success: it works without him. Stage 1 closes with a documented, delegatable Monday process.

### 4.2 Current state
Workbook "Development Site Sourcing Tracker v2" (tabs: Weekly Snapshot, DA & CDC Tracker, Zoning Farm List, Director & Company Lookup, Criteria, Sourcing Cheat Sheet, Automation Runbook, Legend). Manual weekly cycle exists. Tracker rows from the 23 Jul test run, all zoning TBC. Alerts land in an inbox and are logged by hand. Phase 2 (alert to row to Teams/Slack ping) not built. Darren has seen nothing since kickoff.

### 4.3 Functional requirements

**DP-SRC: Sourcing**

| ID | Requirement | Status |
|---|---|---|
| DP-SRC-01 | The system shall ingest new DAs and CDCs for configured suburbs from free sources: NSW Planning Portal API (free, daily, back to 2019), Penrith and Blue Mountains council DA trackers, PlanningAlerts. | Open (API dry run planned) |
| DP-SRC-02 | The system shall support paid/aggregator sources behind a source-adapter boundary: DA Leads, Lodgd, Landchecker, Archistar, Cordell Connect, RP Data, Cityscope. | Open; access and cost TBC with Cotality |
| DP-SRC-03 | The system shall run on a weekly schedule (Monday) and support on-demand runs. | Open |
| DP-SRC-04 | The system shall log each new application as one tracker row: date identified, council, address, suburb, zoning, type (DA/CDC), status, application number, applicant/company, source portal, ACN/ABN, contact found, action taken, notes, priority H/M/L, last status update. | Open (fields exist in workbook) |
| DP-SRC-05 | The system shall detect status changes (lodged, approved, refused, withdrawn) and update Last Status Update; a refusal under review or appeal is a motivated-seller signal. | Open |
| DP-SRC-06 | The system shall also detect new open-market listings meeting the development criteria and show only what changed since the previous week. | Open (Darren's REA monitoring wish; REA data access TBC) |

**DP-QUA: Qualification**

| ID | Requirement | Status |
|---|---|---|
| DP-QUA-01 | The system shall confirm zoning, height, FSR, minimum lot size and overlays via the NSW Planning Portal Spatial Viewer or equivalent authoritative source; no row shall be marked actionable while zoning is TBC. | Open |
| DP-QUA-02 | The system shall apply the Criteria rules: target zones R3, R4; employment/mixed use E1-E4, MU1 (codes in force per council to confirm); C4 low priority; SP3/SP4 case-by-case. | Draft |
| DP-QUA-03 | Lot-size thresholds: subdivision R3 at least 450 m2, R2 at least 650 m2 (battle-axe: at least 15 m frontage); multi-dwelling R3/R4 at least 1,200 m2 (Penrith LEP; confirm current figure and Blue Mountains LEP separately). | Draft |
| DP-QUA-04 | Zoning match alone shall not qualify a lead. At least one additional signal (lot-size fit, DA activity, ownership signal) is required. | Open (rule agreed in principle) |
| DP-QUA-05 | Ownership signals: multiple adjoining lots with the same owner, previously withdrawn/expired listing, hold-period threshold. Hold-period threshold is undefined. | OPEN: workshop with acquisitions team |
| DP-QUA-06 | Every automated zoning/FSR/height/lot-size value shall carry its source and be presented for human confirmation before outreach (the tool searches and flags; a person decides). | Open |

**DP-OWN: Ownership and contact**

| ID | Requirement | Status |
|---|---|---|
| DP-OWN-01 | The system shall support the owner-trace chain: ABN Lookup, ASIC Connect, Cordell Connect (check first), iD4Me for phone/email, logged in the Director & Company Lookup. | Manual in workbook; automation Open |
| DP-OWN-02 | Privacy: personal contact data shall be handled per the Privacy Act; use must be for the stated acquisition purpose and subject to DNC rules for any cold outreach. | Open *(inferred)*; confirm with Darren |

**DP-FRM: Farming and reporting**

| ID | Requirement | Status |
|---|---|---|
| DP-FRM-01 | The system shall maintain a Zoning Farm List per suburb with priority, RP Data territory set up, iD4Me list built, owners in list, contacted this month, owner assigned. | Workbook exists |
| DP-RPT-01 | The system shall produce a weekly snapshot: new DAs, new CDCs, approved, refused, owner/contact still needed, approaches made, farm suburbs with active leads, top three priorities. | Workbook formulas exist |
| DP-RPT-02 | The report shall be delivered by email and spreadsheet, and optionally as a Teams message. | Open |
| DP-RPT-03 | The Vault CRM developer updates (weekly) feed the report. | Open (Suffyan's design; API dependency unclear) |
| DP-RPT-04 | The field list shall be reduced to must-have fields agreed with Darren (his "too much, missing some" complaint). | Open (due days 10-14 of plan) |

**DP-OPS: Handover**

| ID | Requirement | Status |
|---|---|---|
| DP-OPS-01 | The process shall be documented as a written runbook and run once with a nominated PRD team member (Thomas or other). | Open |
| DP-OPS-02 | Monthly review of farm list and criteria shall be part of the runbook. | In workbook |

### 4.4 Open decisions
RP Data and Cordell Connect API access and cost (Cotality account manager; head-office escalation option); employment zone codes per council; hold-period threshold; Blue Mountains LEP values; whether REA listings can be monitored; whether Phase 2 automation is justified by volume; who owns the weekly run.

### 4.5 Acceptance criteria
- AC-DP-1: A Monday run produces a tracker update and weekly snapshot without manual data entry for free-source DAs.
- AC-DP-2: Every row has confirmed zoning or is flagged unconfirmed and excluded from the priority list.
- AC-DP-3: Weekly output shows only changes since last week.
- AC-DP-4: A named PRD team member runs it once, unassisted, from the runbook.
- AC-DP-5: Darren confirms the field list is the right size.

---

## 5. Project MS: Meta and Social Enquiries

### 5.1 Objective
Bring Facebook and Instagram enquiries (lead ads, direct messages, post comments) through the same qualification flow as BS and into Vault. Target volume from the two live project campaigns: about 100 enquiries a week (currently about 45 per 10 days).

### 5.2 Current state
Project campaigns send people to landing pages, not Meta native lead forms. Per Darren (1 Oct), landing-page enquiries do not feed Vault: they go to Thomas's Google Sheet and an automated email; Thomas calls, approves, and Thea adds them to Vault. This contradicts Suffyan's 25 Sep assumption and must be resolved. Meta business verification and App Review (for `leads_retrieval` and messaging permissions) take weeks. Meta ad account was compromised in September. The detailed scope document sent by Suffyan (19 Sep) was not readable in this review; confirm this section against it.

### 5.3 Functional requirements

| ID | Requirement | Status |
|---|---|---|
| MS-IN-01 | Landing-page form submissions shall be captured into the BS flow and written to Vault (via webhook from the form or the Google Sheet), replacing the manual Sheet to Thomas to Thea path. | Open; Thomas to confirm form wiring |
| MS-IN-02 | Meta Lead Ads webhook `/meta-lead-webhook` shall receive a lead ID and retrieve details via Graph API. | Built in workflow; blocked on `leads_retrieval` approval |
| MS-IN-03 | Facebook/Instagram DMs and comments shall be answered by the assistant, respecting the 24-hour messaging window. | Open; blocked on Meta approval |
| MS-IN-04 | Unanswered historic DMs/comments on the Penrith page are lost beyond 24 hours; flag only, no retroactive send. | Information |
| MS-QUA-01 | Project enquiries shall be qualified for the project (stock, price band, inspection or consultation booking) rather than for a specific resale listing; policy to be agreed with Thomas. | TBC *(inferred)* |
| MS-HND-01 | Thomas shall retain the human call step; the system shall hand over each project lead with conversation context and a Hot/Warm/New label. | TBC |
| MS-CMP-01 | Consent, opt-out and Spam Act rules apply as in BS-CMP. | Open |
| MS-SEC-01 | Confirm which ad account runs the campaigns; the compromised account must be secured before API access is granted. | Open (Thomas) |
| MS-DSH-01 | Meta-sourced conversations shall appear on the same dashboard, filterable by source/campaign. | Open |

### 5.4 Acceptance criteria
- AC-MS-1: A landing-page enquiry reaches Vault and the dashboard within the poll interval without manual re-keying.
- AC-MS-2: Weekly Meta volume and speed-to-first-response are reported to Darren.
- AC-MS-3: DMs/comments are in scope only after Meta approval; date for approval tracked in Jira.

---

## 6. Project VA: After-Hours Voice Calling Agent

### 6.1 Objective
Answer inbound buyer calls outside business hours (instead of voicemail), capture the same position-to-transact information, and hand to an agent. Mentioned by Darren at kickoff; prototyped by Suffyan; Darren is cautious and suggested trialling on rental enquiries first. Not approved for build. Overview document with scope, technology and running costs was emailed 11 Sep but was not readable in this review.

### 6.2 Requirements (draft, for decision, not for build)

| ID | Requirement | Status |
|---|---|---|
| VA-01 | The agent shall answer inbound calls on a designated number outside configured hours and hand off during hours. | Prototype |
| VA-02 | The agent shall disclose it is an AI, follow BS-CV conversation policy and use only verified listing facts. | Open *(inferred)* |
| VA-03 | Calls shall be recorded/transcribed per Australian recording-consent law; retention defined. | Open *(inferred)*; legal check |
| VA-04 | Transcript and outcome shall be written to Vault and shown on the dashboard. | Open |
| VA-05 | Pilot scope shall be agreed with Darren (rental enquiries first would also place leasing in scope, which BS currently excludes). | TBC |
| VA-06 | Running cost per minute/month shall be approved by the client before build. | TBC |

Gate: no build until BS is live and stable and Darren approves scope and cost.

---

## 7. Project GR: Google Reviews Processing
Parked at kickoff after Darren's realestate.com.au conversation. Listed as an official project in the 1 Oct meeting. No requirements until reactivated. Placeholder: monitor and respond to Google reviews for the three offices, draft replies for human approval *(inferred)*.

---

## 8. Cross-cutting requirements

### 8.1 CD: Client dashboard and reporting
Hamza committed (1 Oct) to a lightweight client dashboard as an additional deliverable if resources allow, after the two priority projects.

| ID | Requirement | Status |
|---|---|---|
| CD-01 | A single client-facing view shall show per-project status in plain language: what is done, what is next, what we need from PRD, with owners and dates. | Open |
| CD-02 | It shall show the 30-day leading indicators: response latency, qualification completeness, category migration, permission-capture rate, plus enquiry and conversation counts. | Open |
| CD-03 | It shall link to demos/recordings so progress is seen working, not only described. | Open |
| CD-04 | The weekly written update shall be written for a non-technical reader and act as a record of the Wednesday call. | Process |

### 8.2 DOC: Documentation and delivery process (Hamza's 1 Oct requests)

| ID | Requirement | Status |
|---|---|---|
| DOC-01 | A dated scope document and change log shall record every client-requested change (the ClickSend change was missing). | Open |
| DOC-02 | Test cases shall exist per workflow with recorded results. | Open |
| DOC-03 | n8n workflow exports shall be stored in GitHub, with `.env.example` only. | Open |
| DOC-04 | This SRS and the SRS planning material shall be kept current; the repo `docs/` tree is the source of truth, Jira tracks delivery. | In progress |
| DOC-05 | Every client request shall be tracked in Jira with PRD access; PRD to nominate an owner. | Open |
| DOC-06 | A second developer shall onboard from these documents without relying on one person's memory. | Open |

### 8.3 CMP: Compliance
Spam Act 2003 (consent, identification, unsubscribe), Do Not Call Register Act 2006 (inbound enquiries exempt per Darren; outbound cold contact is not), Privacy Act 1988 (collection notice, data use, retention, cross-border processing by Anthropic/ClickSend/n8n host), call-recording law for VA. A privacy notice on the chat widget and a retention policy for conversation logs are required *(inferred)*. Legal review of the Spam Act and consent wording is an open item from Darren.

### 8.4 Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-PERF-01 | First reply to an in-scope enquiry within 15 minutes of arrival (10-minute poll plus processing); website chat within 10 seconds. |
| NFR-PERF-02 | Handle at least 100 enquiries a day without dropped or duplicated replies (current load 5-7/day plus Meta). |
| NFR-REL-01 | No silent failures: every failed step alerts. Retries must be idempotent. |
| NFR-REL-02 | Durable state in external storage; no reliance on n8n static data. |
| NFR-SEC-01 | Secrets only in n8n credential storage or the secure credentials service; none in Git, docs or email. |
| NFR-SEC-02 | All credentials previously sent in plain email (Vault, website admin, Outlook, ClickSend) shall be rotated and shared via credentials.useprivate.ai. |
| NFR-SEC-03 | Least privilege: use a PRD-issued account for Suffyan; remove access at end of engagement. |
| NFR-SEC-04 | The dashboard shall require authentication; no buyer personal data on a public URL. |
| NFR-SEC-05 | Model input is whitelist-only (BS-PR-07); prompt injection from buyer text shall not be able to reveal vendor-confidential data or send arbitrary messages. |
| NFR-DATA-01 | Buyer personal data minimised, retention period defined, exportable and deletable on request. |
| NFR-OBS-01 | Logs and conversation records retained for review; test and production data separated. |
| NFR-AVAIL-01 | Business-hours support aligned to AEST; weekly call Wednesday 2pm AEST. |
| NFR-QUAL-01 | AI output quality is reviewed by a human via the dashboard; regression test set of known problem conversations (Tamara C, Emma Conway, Szyfer, 77 Sheppard Road, postcode bug, Ethan Jung/Danielle Sheen) must pass before each release. |
| NFR-DEPLOY-01 | Local, staging and production separated; staging/UAT validation before production; rollback steps documented (per the Development Pipeline Plan). |

---

## 9. Release plan (from the 30-day plan and 1 Oct recovery plan)

| Window | BS | DP | Cross-cutting |
|---|---|---|---|
| Week of 7 Oct | Alignment call; fix duplicates and agent fallback; controlled first send; inbound webhook given to Thomas; revised conversations reviewed by Darren within a week | Review workbook and sources with Darren; confirm must-have fields; status update | Rotate credentials; scope/change log; GitHub backup; test cases; Jira access |
| +2 weeks | Go live on REA via Vault with dashboard monitored; alert destination live | Free-source ingestion (Planning Portal API) producing Monday report | Plain-language weekly report; second developer onboarded |
| +30 days | After-hours handling shown end-to-end with baseline vs current numbers | Delegatable Monday process run by PRD team member; RP Data costing presented | Client dashboard v1 |
| After | Meta landing-page flow; structured requirements to Vault | Phase 2 automation if volume justifies | Voice pilot decision; GR reactivation decision |

## 10. Traceability to client statements

| Client statement | Requirement |
|---|---|
| "Answer what they asked about that property. Properly" (Darren, 30 Sep) | BS-CV-01 |
| Inspection is the goal (30 Sep) | BS-CV-02 |
| No property-preference questions (30 Sep) | BS-CV-03 |
| Open home in next 48 hours (30 Sep) | BS-CV-02 |
| Better answer for unpriced listings (30 Sep) | BS-PR-09 |
| Postcode field bug; triple replies (30 Sep) | BS-IN-03, BS-IN-06 |
| Single dashboard to review conversations (21 Sep) | BS-DSH-01..03 |
| Hot buyer categorisation (Darren, Sep) | BS-CLS-02 |
| Number not on advertising; agents still reachable (21 Sep) | BS-MSG-01 |
| Inbound enquiries exempt from DNC; opt-out for future comms (2 Sep) | BS-CMP-01, 02, 07 |
| 100 Meta enquiries per week (1 Oct) | MS section |
| Playbook works without Darren; delegatable (plan) | DP-OPS-01 |
| See it working: link, demo or recording (25 Aug) | CD-03 |
| Everything tracked in Jira (25 Aug) | DOC-05 |
| Language we understand; actions on the weekly call (1 Oct) | CD-04, section 9 |

## 11. Open items and risks

| # | Item | Owner |
|---|---|---|
| 1 | Month four conditional on BS and DP both live | Hamza/Irfan |
| 2 | Were the 47 transcripts from our agent? (Irfan says the agent was not live) | Suffyan |
| 3 | Do landing-page enquiries reach Vault? (Darren says no) | Thomas |
| 4 | Contact category and Hot definition | Darren |
| 5 | Alert destination (Teams) and PRD sending address | Darren, Lily |
| 6 | Inbound SMS rule pointed at our webhook | Thomas |
| 7 | MRI fixes: contact notes 500, event stream scope | Suffyan with MRI |
| 8 | RP Data and Cordell API cost and access | Darren with Cotality |
| 9 | Criteria rows marked OPEN, hold-period threshold | Darren, acquisitions |
| 10 | Credentials exposed in email; rotate | Irfan, PRD |
| 11 | Buy-vs-build comparison (Beleef, Propic, iRealty) promised to Darren | Suffyan |
| 12 | Weekly update attachments and Meta/voice scope docs not reviewed for this draft | Hamza |
| 13 | Voice agent scope and cost approval | Darren |
| 14 | A PRD-side owner for the engagement | Darren |
