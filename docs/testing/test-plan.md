# Test Plan

## 1. Strategy

| Level | Tool | Location | Scope |
|---|---|---|---|
| Unit | Vitest | `tests/unit` | Every module in `src/lib` (roles, stages, entra resolution, session, data providers, whitelisting, masking, quality flags, time, geo) and pure helpers |
| Regression | Vitest | `tests/regression` | One case per known bug, named after the bug or ticket, written before the fix |
| UI / e2e | Playwright | `tests/e2e` | Every page and user flow, against a real app on port 3100 and a throwaway Postgres (`TEST_DATABASE_URL`) |
| Manual UAT | Checklist (section 6) | Staging | Darren and Thomas confirm what they see is correct and useful |
| Security checks | Targeted e2e and review | | Auth redirects, role denial per page, branch scoping, no vendor fields in output |

Principles: do not mock the thing under test; mock only external boundaries (Vault, n8n, ClickSend, Entra token endpoint, time); use real Postgres for data and auth logic; deterministic tests with their own data; never run against the shared staging database.

Scripts (exact set is owned by `package.json`): `test`, `test:unit`, `test:regression`, `test:e2e`, `test:coverage`, `test:all`.

## 2. Coverage thresholds

Enforced in the Vitest config and CI. Target for `src/lib`: lines 80 percent, branches 70 percent (TBC: confirm against the configured numbers). Thresholds never decrease; a PR that lowers them needs Hamza's approval and a reason.

## 3. Environments

| Environment | Used for | Data |
|---|---|---|
| CI | Unit, regression, e2e | `postgres:16` service container, migrated and seeded fresh per run |
| Local | Same suites | Throwaway local or container Postgres; `TEST_DATABASE_URL` only |
| Staging | Manual UAT, post-deploy smoke tests | Shared Postgres (see infrastructure doc); sample rows flagged |

## 4. Test data rules

- Synthetic only: fictional names ("Sample Buyer 01"), invented numbers, no real buyers, vendors or PRD staff data in fixtures.
- Seeded real DAs may be used as reference rows but zoning stays TBC.
- No secrets in fixtures; test credentials are generated in the test setup and not committed to docs.
- Each test creates and cleans its own rows; sample rows keep `is_sample = true`.
- Vendor-confidential fields must appear in at least one fixture (Vault payload) to prove the whitelist drops them.

## 5. Entry and exit criteria

Entry for testing a change: code compiles, lint and tsc pass, acceptance criteria written, test data available.
Exit for merge: `ci` green (unit, regression, build), and `e2e` green for production releases and UI-affecting changes, thresholds met, new and changed behaviour tested, bug fixes have a regression test, no open blocker defects.
Exit for release: staging verification checklist and smoke tests pass, UAT items signed off (or deferred with a ticket), rollback path known.

## 6. Manual UAT checklist (Darren, Thomas)

Plain-language checks, done on https://prd.remap.ai in a morning AEST slot (Darren's preference).

- [ ] I can sign in with my Microsoft account and see my pages
- [ ] Delivery Progress tells me what is done, what is next, and what is needed from me
- [ ] Every number or card says whether it is Live, Prototype, Planned or Sample; Sample looks clearly different
- [ ] "Live only" hides everything that is not real
- [ ] Buyer Sequencing shows real conversations; reply order feels right (answer, inspection, then buyer details)
- [ ] Phone and email are masked as expected
- [ ] Listings match what I see in Vault; no private vendor details appear anywhere
- [ ] Development Pipeline: I can move a site and its history is recorded; unconfirmed zoning shows "Confirm before acting"
- [ ] Map shows sites and listings in the right places
- [ ] I can leave feedback from any page and see it listed
- [ ] Users page: I can add and deactivate a user in my own company only
- [ ] Anything confusing or wrong is written in Feedback, with the page name

## 7. Defect process

1. Report (Feedback page, PR comment or Jira bug) with page, role, steps, expected and actual, screenshot, severity.
2. Triage by REMAP within one working day: Blocker (security, data exposure, outage), High, Medium, Low.
3. Reproduce with a failing regression test first, then fix on `fix/*`.
4. Verify on staging; close the Jira ticket and update "you said, we did".
5. Blockers and data exposure stop releases and follow `rollback-process.md`.
6. Known bugs from the engagement (for example postcode read as a message, duplicate replies, unpriced listing handling) are tracked as regression cases for the quality checks in `src/lib/data/conversations.ts` (`qualityFlags`).
