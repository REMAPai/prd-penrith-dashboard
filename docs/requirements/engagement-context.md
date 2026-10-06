# PRD Penrith: Engagement Context

Compiled 2026-10-06 from Hamza's Gmail (main thread "Getting Your AI Specialist Suffyan Started", Gemini/Read AI meeting notes, Jira notifications). Credentials that appear in the source emails are deliberately not copied here.

## Client

- **PRD Penrith**: Latty and Partners Real Estate Pty Ltd t/as PRD Penrith. Latty Enterprises Pty Ltd t/as PRD Glenmore Park and PRD Blue Mountains. NSW, Australia.
- **Darren Latty**: Principal/Director, decision maker, signs MRI agreement. Prefers plain language, mornings (AEST) for meetings and strategy, afternoons are appointments.
- **Thomas Latty**: Project Marketing, licensed sales agent. Owns Meta ads, ClickSend account, Power Automate experiments, Google Sheet for project enquiries.
- **Lily Masters**: Operations Manager. Handles access and accounts.
- **Thea**: PRD's VA, adds approved project enquiries into Vault.
- **REMAP side**: Irfan Farhatullah (Technical PM, leading delivery), Suffyan Ahmed (AI Specialist, hands-on builder), Zimal Aziz (Delivery Support), Hamza (technical oversight), Umar and Andrew Herbert (sales/founder, cc'd).
- Time zone: 1:00-5:00pm AEST = 8:00am-12:00pm PKT.

## Timeline

| Date | Event |
|---|---|
| 2026-08-18 | Kickoff and scoping call. Incoming Buyer Sequencing = priority 1, Development Site Playbook = priority 2, Google reviews project parked (after realestate.com.au conversation). |
| 2026-08-19 | Target-setting call. Goal: market traction within 1 week, prototype in 10-15 days, daily standups. Irfan to propose 30-day targets. Darren sent briefs for both projects and a Claude chat for the playbook. |
| 2026-08-25 | Access granted: Outlook/Teams (suffyan@prd.net.au), Vault login, website admin, sample web book, Meta Business invites. First buyer-enquiry workflow reviewed by Darren ("a good start"). |
| 2026-08-27 | MRI Vault API needs Partner Connect program: $500/yr plus signed agreement by an ABN entity. Signed in PRD Penrith's name; head office later if proven. Darren raised Beleef (competitor AI product) and ChatGPT REA monitoring. |
| 2026-09-07 | MRI agreement details submitted (Darren signatory, Thomas primary contact, Lily IT security contact). |
| 2026-09-11 | Agreement signed, integration provisioned. Voice-agent prototype pitched (after-hours inbound calls). |
| 2026-09-19 | MRI API key issued, Vault connection live, tested on real enquiries. Blocker found: Vault texts send from agent's own mobile so replies can't be read. ClickSend proposed. Meta scope sent. |
| 2026-09-25 | Conversation dashboard built and live (automations.remap.ai/webhook/prd-conversations). |
| 2026-09-29 | Thomas created ClickSend account (messaging went live this day). |
| 2026-09-30 | Darren's feedback on bot conversations (see Issues). Irfan replied that the agent was not live, so the 47 transcripts may not be from Suffyan's agent: needs verifying. |
| 2026-10-01 | Darren: month three being paid, but "on current performance we wouldn't go into month four". Internal check-in call (Hamza, Suffyan, Irfan). Irfan sent recovery plan. |
| 2026-10-07 | **Projects Update and Strategy Discussion**, Wed 2pm AEST (7am PKT), Darren + Thomas + Irfan, Hamza, Suffyan. Weekly standing slot. |

## Projects

### 1. Incoming Buyer Sequencing (priority 1, live)
Automated first response and qualification of buyer enquiries, written back to MRI Vault.
- Sources: website chat, Meta, and REA/Domain (REA already lands in Vault in real time; plan is a third trigger off new Vault contacts tagged with an REA source).
- Flow: check contact in Vault (incl. per-channel unsubscribe flags) -> pull property details from Vault -> AI conversation -> consent to callback -> write qualified buyer back to Vault -> alert on failure.
- Stack: n8n workflows, MRI Vault API (Partner Connect), ClickSend for two-way SMS, Teams for alerts, conversation dashboard on automations.remap.ai.
- Goal from kickoff: lift database sales conversion to 20%.
- Consent rule: inbound enquiries are exempt from Do Not Call, but future communications need an opt-out.
- Meta project ads do NOT feed Vault today. They land in Thomas's Google Sheet plus an email. Thomas approves, then Thea adds to Vault. About 45 enquiries per 10 days; target about 100 per week.

### 2. Development Site Playbook (priority 2, no visible progress)
Weekly report of development sites in the Penrith LGA (about 30 suburbs): scoring model, zoning/FSR/height/lot size, weekly change detection ("what's new each Monday"). Inputs: Darren's ChatGPT/Claude prompt (scoring model, constraint categories, assemblage logic), public planning data, Vault CRM developer updates, government API or alternative. Suffyan's position: monitoring with change detection is a system, not a prompt, and a human must verify zoning before anyone acts. Darren said he's heard nothing on this since the start.

### Parked / ideas
- Google review processing (parked after REA conversation).
- Meta DM and comment assistant (scope sent; needs Meta business verification, weeks). Landing-page ads bypass this.
- After-hours voice calling agent (prototype pitched, needs approval).
- Beleef/Propic/iRealty buy-vs-build comparison (Suffyan to deliver).
- Darren has other projects queued behind these two.

## First-month commitments (what we said we'd deliver)
- Both priority projects started in week 1, buyer sequencing first.
- Daily short written update from Suffyan; 20-minute weekly check-in with Irfan; scoping calls as needed.
- Working demo/link for each deliverable rather than only written updates.
- Everything tracked in Jira with PRD access (PRD needs coaching).
- Targets: traction within 1 week, prototype in 10-15 days (from 19 Aug call). Irfan promised proposed 30-day targets "shortly": the actual targets document and the weekly update attachments (Aug 28, Sep 4, Sep 19, Sep 25) were not readable from email and should be added here.
- Delivered so far: buyer enquiry workflow (Aug 24-28), Vault live connection (Sep 19), conversation dashboard (Sep 25). Hamza's assessment on 1 Oct: about 140 hours produced two n8n workflows with no tangible material shared with the client.

## Current issues (as of 2026-10-06)

**Commercial**
1. Month four is conditional on both projects being active and fully functional. Darren has other projects ready behind them.
2. Darren's complaints: little achieved in two months, requests too technical, time-zone gap, Playbook silent.

**Buyer-conversation quality (Darren, 30 Sep, from dashboard of 47 conversations)**
3. No handoffs to agents, no permission asked, about 11 people asked to inspect and got no time or booking.
4. Wrong order. Required order: (1) answer what they asked about that property properly, (2) get them to an inspection (open home in next 48 hours or private viewing), (3) only then learn about the buyer (finance, need to sell first). Stop asking bedrooms/property type at enquiry stage.
5. "Agent will call next business morning" is wrong for Friday enquiries with Saturday open homes.
6. Unpriced listings (77 Sheppard Road): bot says no price then asks budget. Needs a better answer.
7. Bug: REA postcode field read as a buyer message ("$2148 or a postcode?").
8. Bug: duplicate replies (3 near-identical) to the same message, likely multiple triggers (Ethan Jung, Danielle Sheen).
9. Listings with no agent assigned: 14 Woodlands Drive, 1/123A Evan Street, 2/6 Arakoon Avenue (PRD to fix).
10. Verify whether the 47 transcripts came from our agent (Irfan says it was not live).

**Process and delivery**
11. Documentation gaps (Hamza, 1 Oct): no central dated scope/change log (ClickSend change missing), no per-workflow test cases, n8n project not in GitHub, SRS needs updating.
12. ClickSend: awaiting a phone number to test (Suffyan to chase Thomas).
13. Dashboard design is a first pass, location/format not confirmed by Darren.
14. Contact category for qualified buyers undecided (Prospective Buyers / Current Buyers / BUYER HIT LIST).
15. Meta landing-page form: confirm it feeds Vault (it currently does not; see above).
16. Meta ad account was hacked in September (fraudulent solar campaigns); Suffyan needs the right ad account.
17. Credentials were shared in plain email (Vault, website admin, Outlook, ClickSend API key). Rotate them and use credentials.useprivate.ai.
18. Jira access for PRD not set up; PRD team has no one owning requests.

## Recovery plan committed by Irfan (1 Oct)
- REMAP takes direct charge of delivery; follow-ups owned by us, not PRD.
- Suffyan works PRD hours; weekly call Wednesdays 2pm AEST; plain-language written updates; Teams for quick questions.
- Second developer added at no extra cost.
- Alignment call, then written plan; revised buyer conversations ready for review within a week (about 8 Oct).

## Internal action items (from 1 Oct check-in)
- Suffyan: scope doc plus change log, workflow test cases, files in GitHub, change workflow schedule, update SRS, chase ClickSend number.
- Irfan: reply to client (done), meet Suffyan on deliverables, assign internal teammate, invite Hamza to client call and send transcript.
- Hamza: build lightweight client dashboard, adapt existing policy for the real-estate client.
