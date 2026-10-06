# User Flows

Derived from `srs.md`, `dashboard-spec.md` and the code. Items not confirmed are marked TBC.

## 1. Sign-in

```mermaid
flowchart TD
  A[Open any page] --> B{prd_session cookie?}
  B -- no --> L[/login/]
  B -- yes --> V{Valid JWT and active user row?}
  V -- yes --> P[Page, role checked server-side]
  V -- no --> L
  L --> M[Sign in with Microsoft]
  L --> F[Fallback email and password, if enabled]
  M --> E[Entra sign-in]
  E --> T{Tenant known, domain allowed, user exists and active, tenant kind matches role?}
  T -- no --> D[Denied message on /login, audit entry]
  T -- yes --> S[Session cookie, audit sign-in]
  F --> R{Valid, under 5 attempts per 10 min?}
  R -- no --> D
  R -- yes --> S
  S --> H{Platform admin?}
  H -- yes --> C[/companies/]
  H -- no --> G[/progress/]
```

## 2. Buyer enquiry (runs on n8n; dashboard reads results)

```mermaid
flowchart TD
  Q[Enquiry: REA/Domain via Vault, website chat, Meta] --> W{In scope and contact checked in Vault, incl. unsubscribe flags?}
  W -- no --> X[Stop or skip, log]
  W -- yes --> I[Pull property details from Vault]
  I --> AI[AI conversation: 1 answer their question, 2 offer inspection within 48h or private viewing, 3 position to transact]
  AI --> K{Consent to callback and qualified?}
  K -- yes --> VW[Write buyer to Vault, email listing agent once with reason]
  K -- no --> AI
  AI --> LOG[Conversation log]
  LOG --> DB[Dashboard Buyer Sequencing: conversations, quality flags, handovers]
  AI -. failure .-> AL[Alert, destination TBC]
```

Notes: outbound SMS is held until ClickSend inbound is set up; STOP halts all messaging; Meta project ads do not feed Vault yet (Sheet, Thomas approves, Thea adds to Vault).

## 3. Pipeline stage movement

```mermaid
flowchart TD
  U[User opens /pipeline] --> R{Role can edit: platform, company, branch admin, marketing?}
  R -- no --> RO[Read only]
  R -- yes --> S[Select site in current branch]
  S --> Z{Zoning confirmed?}
  Z -- no --> CZ[Confirm zoning on NSW Planning Portal, enter zoning] --> EV1[Event + audit: Zoning confirmed]
  Z -- yes --> M[Move to stage 0 to 9]
  CZ --> M
  M --> EV2[Update stage, event row, audit entry: Stage move]
  EV2 --> RF[Page refreshes with new stage and days in stage]
```

Stages: 1 Detected, 2 Qualified, 3 Owner traced, 4 Approached, 5 Negotiation, 6 Acquired or under contract, 7 Approved for development, 8 Marketing, 9 Selling, 10 Sold out or settled (stored as 0 to 9). Whether zoning must be confirmed before moving stage is not enforced in code today (TBC).

## 4. Feedback loop

```mermaid
flowchart LR
  U[PRD or REMAP user, any page] --> F[Submit feedback: page, rating useful/confusing/wrong, note]
  F --> L[Feedback list with votes]
  L --> V[Other users vote]
  L --> T[REMAP triages: New, Planned, In progress, Done, Won't do]
  T --> J[Jira ticket, TBC link field]
  T --> C[You said, we did changelog, TBC]
  T --> W[Wednesday call agenda, weekly digest to Irfan, TBC]
```

Per-conversation "good / not good" ratings from the spec (4.14) are not built yet (TBC).
