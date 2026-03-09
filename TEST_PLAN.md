# Boarding Connect — Test Plan

## 1. Document Control

- **Project:** Boarding Connect
- **Version:** 1.0
- **Date:** 2026-03-06
- **Prepared by:** QA / Engineering
- **Scope baseline:** Current workspace structure (`frontend` + `backend`)

## 2. Purpose

This test plan defines how to validate the Boarding Connect platform end-to-end, including:

- User authentication and role-based access
- Listing lifecycle (create, browse, edit, verify)
- Applications, agreements, and renter-owner workflows
- Messaging, reviews, concerns, reports, and admin actions
- API stability, security, and core non-functional requirements

## 3. Test Objectives

1. Verify all critical user journeys function correctly for **renter**, **owner**, and **admin** roles.
2. Prevent regressions on high-risk flows (auth, listing/applications/agreements state transitions).
3. Confirm backend API contracts and frontend integration behavior.
4. Validate access control, input validation, and error handling.
5. Provide release confidence through repeatable smoke, functional, and regression testing.

## 4. In Scope

### Functional

- Backend endpoints under:
  - `/api/auth`
  - `/api/listings`
  - `/api/applications`
  - `/api/agreements`
  - `/api/messages`
  - `/api/admin`
  - `/api/reviews`
  - `/api/concerns`
  - `/api/reports`
  - `/api/stats`
- Frontend routes/pages and role dashboards
- RBAC and protected-route behavior
- Upload-related flows (avatar/listing images)

### Non-Functional

- Basic performance checks on critical APIs
- Security checks (auth, authorization, input validation, basic abuse cases)
- Cross-browser sanity

## 5. Out of Scope (Initial)

- Full-scale load/performance certification
- Penetration testing by external security team
- Native mobile clients (if not part of this repo)

## 6. Test Strategy

A layered approach:

1. **Static checks**
   - Linting + formatting consistency
   - Build checks (`frontend` Vite build, `backend` startup)

2. **Unit tests**
   - Backend controller/service logic with mocked Supabase
   - Frontend utility/context/component logic with mocked API

3. **Integration/API tests**
   - Endpoint-level tests for auth, listings, applications, agreements, admin
   - Validate request/response schemas, status codes, and RBAC constraints

4. **UI tests (component + E2E)**
   - Core page interactions (login/register, create listing, apply, confirm/cancel flows)
   - Route protection and role redirects

5. **Manual exploratory + smoke**
   - Role-specific smoke checklist before deployment

## 7. Recommended Tooling

> Current repository does not yet define test scripts in `package.json`; this plan includes recommended tooling to implement.

### Backend (Node/Express)

- **Test runner:** Vitest or Jest
- **HTTP integration:** Supertest
- **Mocking:** Vitest/Jest mocks for Supabase and JWT helpers
- **Coverage target:**
  - Statements: 80%
  - Branches: 70%
  - Functions: 80%

### Frontend (React/Vite)

- **Unit/Component:** Vitest + React Testing Library
- **E2E:** Playwright (preferred) or Cypress
- **Coverage target:**
  - Critical modules (auth context, protected routes, key pages): 85%+

## 8. Environments

- **Local Dev:** Windows + Node LTS
- **Test DB/Backend Services:** Supabase test project (isolated from production)
- **Frontend Base URL:** `VITE_API_URL` pointing to test backend
- **Backend Env:** `.env` with test keys only

### Required Environment Variables (minimum)

Backend:

- `PORT`
- `FRONTEND_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` or service key (test-only)
- `JWT_SECRET`

Frontend:

- `VITE_API_URL`

## 9. Test Data Strategy

- Seed users per role:
  - `admin_user`
  - `owner_user`
  - `renter_user`
- Seed listing states:
  - unverified, verified, rejected
- Seed workflow states:
  - application pending/accepted/rejected/cancelled
  - agreement draft/confirmed/cancelled
- Use deterministic fixtures for repeatable tests
- Clean up test artifacts after E2E runs

## 10. Feature Test Matrix

### 10.1 Authentication & Profile

- Register (JSON + multipart path if used)
- Login/logout token persistence
- Forgot/reset password flows
- `/auth/me` profile retrieval/update
- Avatar upload endpoints
- Invalid credential and expired token handling

### 10.2 Listings

- Public listing retrieval + filters
- Owner create/update/delete listing
- Image upload validations (type/size)
- Admin verify/reject listing flow
- Listing details page rendering and error states

### 10.3 Applications

- Renter apply to listing
- Owner view listing applicants/renters
- Owner updates application status
- Renter confirm/cancel application
- Prevent duplicate applications and unauthorized status changes

### 10.4 Agreements

- Agreement creation from accepted application
- Owner/renter confirm and cancel operations
- Rent status updates and date updates
- Activity log retrieval
- Admin aggregate views (`all`, `summary`)

### 10.5 Messaging

- Conversation list retrieval
- Message history retrieval
- Send message and mark-as-read
- Unauthorized conversation access prevention

### 10.6 Reviews & Concerns

- Create/update/delete review authorization checks
- Paginated admin review list
- Concern create/list/filter/status handling

### 10.7 Reports & Stats

- Site stats endpoint correctness
- Report pages load and display expected aggregates

### 10.8 RBAC / Protected Routes

- Route guard behavior for renter/owner/admin
- Attempted direct URL access to unauthorized pages
- Token missing/invalid/expired behavior

## 11. API Quality Gates

For each endpoint category, verify:

- Status codes are correct (`2xx`, `4xx`, `5xx`)
- Response body shape is consistent and documented
- Input validation errors are meaningful
- Unauthorized/forbidden behavior is correct
- No sensitive data leakage in error payloads

## 12. Non-Functional Checks

### Performance (baseline)

- `/api/health` < 200ms (local median)
- Core read endpoints (listings/stats) acceptable under light concurrency (e.g., 10 VUs)

### Security

- JWT validation and tampering tests
- RBAC bypass attempts
- Basic injection payload checks in user inputs
- File upload validation for disallowed file types

### Compatibility

- Browser sanity: Chrome, Edge, Firefox latest versions
- Responsive layout sanity on common viewport sizes

## 13. Entry / Exit Criteria

### Entry

- Buildable backend and frontend
- Test environment variables configured
- Seed/fixture data available
- Known blockers documented

### Exit

- 100% pass on smoke suite
- No open P0/P1 defects
- P2 defects accepted by product owner
- Regression suite pass rate >= 95%
- Coverage thresholds met (or formally waived)

## 14. Defect Management

- Track defects with severity and priority:
  - **P0:** Production stop / security critical
  - **P1:** Critical business flow broken
  - **P2:** Major feature degradation
  - **P3:** Minor UI/UX/low impact
- Include repro steps, environment, expected vs actual, and evidence (logs/screenshots)

## 15. Regression & Release Plan

- **Per PR:** Targeted unit/integration tests + lint/build checks
- **Pre-release:** Full regression (API + UI + role-based smoke)
- **Post-release:** Production smoke and monitoring checks

## 16. Suggested Initial Smoke Suite (Must Pass)

1. User registration/login for renter and owner
2. Owner creates listing; listing visible in listings page
3. Renter submits application to listing
4. Owner reviews application and updates status
5. Agreement created and confirmed by both parties
6. Messaging send/receive basic flow
7. Admin can verify listing and view dashboard stats
8. Unauthorized user is blocked from admin routes

## 17. Risks & Mitigations

- **Risk:** Supabase dependency instability in tests  
  **Mitigation:** Mock at unit layer; isolate integration tests using test project.

- **Risk:** RBAC regressions across many pages/routes  
  **Mitigation:** Add route-level automated tests + role-based E2E matrix.

- **Risk:** Workflow state transitions become inconsistent  
  **Mitigation:** Add integration tests covering full state machines.

## 18. Deliverables

- Automated test suites (unit/integration/E2E)
- Test data seed scripts/fixtures
- CI test report with coverage and pass/fail summary
- Manual smoke checklist results for each release

---

## Appendix A — Proposed Test Case IDs (Starter)

- AUTH-001: Valid renter login
- AUTH-002: Invalid password rejection
- LIST-001: Owner creates listing with valid payload
- LIST-002: Non-owner cannot edit listing
- APP-001: Renter applies to verified listing
- APP-002: Duplicate apply blocked
- AGR-001: Owner confirms agreement
- AGR-002: Renter cancels agreement with reason
- MSG-001: Send message in valid conversation
- ADM-001: Admin verifies listing
- RBAC-001: Renter denied admin route
- STAT-001: Stats endpoint returns expected keys

## Appendix B — CI Pipeline Recommendation

- Stage 1: Install + lint + build (frontend/backend)
- Stage 2: Backend unit + integration tests
- Stage 3: Frontend unit/component tests
- Stage 4: E2E smoke tests (headless)
- Stage 5: Coverage publish + quality gate
