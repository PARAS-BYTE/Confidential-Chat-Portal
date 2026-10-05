# CCP Confidential Communication Portal — Development Log

## Part 1: Project Foundation, Design Tokens, CI

### 1. Project Initialization & Tooling
- Initialized Next.js App Router with TypeScript, Tailwind CSS, Prisma, and PostgreSQL configuration.
- Configured `.gitignore` to strictly exclude `.env`, `.env*.local`, `node_modules`, `.next`, and build artifacts.
- Created `.env.example` with empty/placeholder keys: `DATABASE_URL`, `SESSION_SECRET`, `APP_URL`, `NODE_ENV`, `DEMO_PASSWORD`.
- Configured `tsconfig.json` with strict typing and `@/*` alias mapping to `./src/*`.
- Configured `postcss.config.mjs` and `tailwind.config.ts`.
- Configured Vitest in `vitest.config.ts` with path aliasing.
- Configured `.eslintrc.json` for Next.js core web vitals linting.
- Added all required npm scripts:
  - `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `db:migrate`, `db:seed`, `db:reset-demo`.

### 2. Folder Structure Created
- `/src/app/` — Application routes (`layout.tsx`, `page.tsx`, `globals.css`)
- `/src/lib/`
  - `db.ts` — Prisma client singleton with `globalThis` development caching
  - `auth/index.ts` — Session & hashing placeholder
  - `authz/index.ts` — Server-side authorization placeholder
  - `serializers/index.ts` — Allow-list serializers placeholder
  - `rules/index.ts` — Content policy rules placeholder
  - `audit/index.ts` — Safe audit logging placeholder
- `/src/components/ui/` — Muted WhatsApp-style reusable UI components
- `/src/components/layout/` — Three-zone shell layout
- `/prisma/` — `schema.prisma` with PostgreSQL datasource and baseline models
- `/tests/` — Automated test suites
- `/docs/` — Architecture documentation (`ARCHITECTURE.md`)
- `/scripts/` — Database scripts (`seed.ts`, `reset-demo.ts`)

### 3. Design System & Tokens
- Implemented the 15 exact CSS custom properties in `src/app/globals.css`:
  - `--bg-app: #0b0c0c`
  - `--bg-panel: #161717`
  - `--bg-surface: #1d1f1f`
  - `--bg-field: #292a2a`
  - `--bg-hover: #242626`
  - `--border: #2e2f2f`
  - `--text-primary: #e9edef`
  - `--text-secondary: #8696a0`
  - `--accent: #21c063`
  - `--accent-soft: #103529`
  - `--bubble-out: #005c4b`
  - `--bubble-in: #202c33`
  - `--warn: #c9a227`
  - `--danger: #d9534f`
  - `--info: #53bdeb`
- Extended `tailwind.config.ts` mapping all tokens.
- Custom muted scrollbars matching WhatsApp Web dark theme.

### 4. Layout & UI Components
- **Three-Zone Shell (`Shell.tsx`)**:
  - Zone 1: Icon Rail (left sidebar on `--bg-app` with portal icon, chats icon, settings, session lock)
  - Zone 2: List Panel (chats panel on `--bg-panel`, search input, filter chips for All/Unread/Archived)
  - Zone 3: Main Pane (active pane on `--bg-app` with subtle WhatsApp dark doodle background)
  - Responsive down to 375px mobile viewport with responsive switching.
- **Reusable UI Components (`src/components/ui/`)**:
  - `Button`: Primary (`--accent`), Secondary (`--bg-field`), Danger (`--danger`), Ghost; sizes sm, md, lg, icon.
  - `Input`: Muted field with `--bg-field`, `--border`, and focus states.
  - `Chip`: Filter chips with active state (`--accent-soft` bg, `--accent` text).
  - `Badge`: Variants for unread (`--accent`), warn (`--warn`), danger (`--danger`), neutral.
  - `Card`: Surface container on `--bg-surface` with `--border`.
  - `Skeleton`: Muted pulsing placeholder on `--bg-hover`.
  - `EmptyState`: WhatsApp Web empty chat pane card with security notice.
  - `ErrorState`: Muted danger card with retry trigger.
  - `index.ts`: Barrel export.

### 5. API & Testing
- **`GET /api/health`**:
  - Queries database via `prisma.$queryRaw`SELECT 1``.
  - Returns strictly `{ status: "ok", db: "up" | "down" }`.
  - Zero leakage of secrets, stack traces, database credentials, or internal details.
- **Vitest Suite (`tests/health.test.ts`)**:
  - Verifies healthy database returns 200 `{ status: "ok", db: "up" }`.
  - Verifies database error returns 503 `{ status: "ok", db: "down" }` without leaking error details.

### 6. CI/CD & Architecture
- **`.github/workflows/ci.yml`**: Triggers on pull requests and pushes to validate install, lint, typecheck, test, and build.
- **`docs/ARCHITECTURE.md`**: Outlines system layers, security invariants, directory structure, and allow-list serialization.

---

## Part 2: Database Schema, Migrations, and Demo Seed

### 1. Data Model & Architecture
- Designed and synchronized complete Prisma schema in `prisma/schema.prisma`:
  - **Enums**: `UserRole` (ADMIN, CLIENT, EMPLOYEE), `MembershipStatus` (ACTIVE, REMOVED), `MessageStatus` (SENDING, DELIVERED, HELD, REJECTED, FAILED), `RuleCategory` (CONTACT, OFF_PLATFORM, COMMERCIAL, ABUSE), `PatternType` (REGEX, KEYWORD), `RuleSeverity` (LOW, MEDIUM, HIGH), `RuleAction` (ALLOW_FLAG, HOLD), `FlagStatus` (OPEN, APPROVED, REJECTED, DISMISSED).
  - **Models**:
    - `User`: realName, email (unique), phone, passwordHash, isActive, createdAt.
    - `Project`: title, description, status, createdAt.
    - `Membership`: userId, projectId, alias, role, status, removedAt with constraints `@@unique([userId, projectId])` and `@@unique([projectId, alias])`.
    - `Conversation`: projectId (unique), messages relation, readStates relation.
    - `Message`: conversationId, senderMembershipId, body, status, clientMessageId, deliveredAt, createdAt with constraint `@@unique([senderMembershipId, clientMessageId])`.
    - `Rule`: name, category, pattern, patternType, severity, action, isActive, isLocked.
    - `Flag`: messageId, ruleId, category, severity, reason, matchedText, status, reviewNote, reviewedById, reviewedAt, createdAt.
    - `Notification`: recipientUserId, recipientMembershipId, type, text, readAt, createdAt.
    - `AuditEvent`: actorId, action, targetType, targetId, metadata (Json), createdAt.
    - `ReadState`: membershipId, conversationId, lastReadAt with `@@unique([membershipId, conversationId])`.
    - `Session`: userId, tokenHash (unique), expiresAt, createdAt.
- Installed `argon2` for password hashing.
- Added `directUrl` in datasource configuration for direct migration and pooling support.
- Generated migration SQL in `prisma/migrations/20261005121900_init_schema/migration.sql`.

### 2. Idempotent Demo Seed (`scripts/seed.ts`)
- Implemented `npm run db:seed`:
  - Uses `argon2.hash` for password security. Reads `DEMO_PASSWORD` from environment or generates one and logs once.
  - Fictional users: 1 Admin (`admin@demo.ccp.test`), 2 Clients (`client1@demo.ccp.test`, `client2@demo.ccp.test`), 2 Employees (`employee1@demo.ccp.test`, `employee2@demo.ccp.test`).
  - Isolated projects:
    - **Project Alpha**: Client 1 ("Client A") + Employee 1 ("Project Specialist B").
    - **Project Beta**: Client 2 ("Client C") + Employee 2 ("Project Specialist D").
  - Seeded conversations, read states, and ordinary demo messages with unique clientMessageIds.
  - Seeded baseline moderation rules (Phone Number, Email Address, Off-Platform Solicitation, Commercial Negotiation, Abusive Language).
  - Verified 100% idempotent: running repeatedly creates no duplicates or errors.

### 3. Demo Reset Script (`scripts/reset-demo.ts`)
- Implemented `npm run db:reset-demo`:
  - Safely filters strictly by `@demo.ccp.test` domain and demo projects ("Project Alpha", "Project Beta").
  - Deletes in transactional order: demo notifications, audit events, flags, messages, read states, conversations, memberships, projects, sessions, and users.
  - Never touches non-demo user data or projects.

### 4. Schema Constraint Tests (`tests/schema.test.ts`)
- Added Vitest tests verifying:
  - Unique alias per project (`@@unique([projectId, alias])`).
  - Unique clientMessageId per sender (`@@unique([senderMembershipId, clientMessageId])`).
  - Unique email per user.
  - Unique conversation per project.

### Verification Results
- Lint: `npm run lint` PASSED (0 warnings, 0 errors).
- Typecheck: `npm run typecheck` PASSED (0 errors).
- Tests: `npm run test` PASSED (6/6 tests passing across health and schema suites).
- Build: `npm run build` PASSED.
- Seed: `npm run db:seed` twice succeeded without duplicates; `npm run db:reset-demo` safely removed demo data and re-seeding cleanly restored it.

---

## Part 3: Authentication & Sessions (Feature 3)
- Implemented `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.
- Password verification using Argon2id.
- Rate limiting: max 5 failed attempts per 15-minute window per (IP, Email) returning HTTP 429.
- Cryptographically secure 32-byte session tokens stored as SHA-256 hashes (`tokenHash`).
- `HttpOnly`, `SameSite=Lax`, and `Secure` cookies (`ccp_session`, `ccp_role`).
- Generic error messages preventing account enumeration.
- Login screen at `/login` adhering to WhatsApp Web dark mode.
- Test suite: `tests/auth.test.ts` (6/6 passing).

---

## Part 4: Authorization, Serializers & Edge Middleware (Feature 4)
- Server-side authorization helpers in `src/lib/authz.ts` (`requireUser`, `requireRole`, `assertProjectAccess`, `requireProjectMember`).
- Anti-enumeration invariant: returns HTTP 404 (not 403) for non-member project or message access.
- Strict allow-list serializers in `src/lib/serializers.ts` (`serializeParticipantMessage`, `serializeParticipantProject`, `serializeNotification`, `serializeAdminMessage`, `serializeAdminUser`).
- Next.js Edge Middleware (`src/middleware.ts`) enforcing role-based route gating (`/admin` restricted to ADMIN, unauthenticated redirected to `/login`).
- Documented conventions in `docs/SECURITY.md`.
- Test suite: `tests/authz-serializers.test.ts` (7/7 passing).

---

## Part 5: Admin Project & User Management (Feature 5)
- REST APIs:
  - `GET /api/admin/users`, `POST /api/admin/users`, `GET /api/admin/users/[id]`, `PATCH /api/admin/users/[id]/toggle-active`.
  - `GET /api/admin/projects`, `POST /api/admin/projects`, `GET /api/admin/projects/[id]`, `POST /api/admin/projects/[id]/memberships`, `PATCH /api/admin/projects/[id]/memberships`.
- Collision-free alias generation engine in `src/lib/alias.ts` (Role-specific professional prefixes + NATO/Phonetic identifiers).
- Immutable security audit logger in `src/lib/audit/index.ts`.
- Reusable UI primitives: `Modal.tsx`, `Toast.tsx`.
- Two-tab Admin Dashboard at `/admin` (Projects & Assignments, User Directory).
- Test suite: `tests/admin.test.ts` (6/6 passing).

---

## Part 6: Participant Inbox & Core Chat Engine (Feature 6 & 7)
- REST APIs:
  - `GET /api/projects`: participant project list with safe previews and unread badges.
  - `GET /api/projects/[projectId]/messages`: conversation history, cursor-based pagination.
  - `POST /api/projects/[projectId]/messages`: client-side idempotency (`clientMessageId`), active membership enforcement.
  - `POST /api/projects/[projectId]/read`: updates participant `ReadState.lastReadAt`.
- Responsive Three-Zone WhatsApp Web Dark UI at `/projects`:
  - Narrow Icon Rail.
  - 400px Conversations List Panel with search and All/Unread filter chips.
  - Active Chat Pane with dark doodle background, pinned compliance notice, speech bubbles (`#005c4b` out, `#202c33` in), double check ticks, and rounded pill composer.
  - Single-column responsive layout down to 375px mobile viewports with back navigation.
  - Lightweight client polling loop (3.5s interval, pauses when tab is hidden).
- Test suite: `tests/chat-core.test.ts` (7/7 passing).

---

## Part 7: Moderation Rule Engine & Send-Flow Hold Logic (Feature 8 & 9)
- Pure rule engine in `src/lib/rules/index.ts`:
  - Normalisation pipeline: Unicode NFKC, zero-width stripping, whitespace collapse, phonetic/delimiter obfuscation detection.
  - Categories: `CONTACT` (locked `HOLD`), `OFF_PLATFORM` (default `HOLD`), `COMMERCIAL` (default `ALLOW_FLAG`), `ABUSE` (default `ALLOW_FLAG`).
  - Precedence: `HOLD` strictly supersedes `ALLOW_FLAG`.
  - ReDoS immunity via regex static safety checks.
- Pre-delivery interception inside `POST /api/projects/[projectId]/messages`:
  - Evaluated before delivery.
  - `HOLD` matches quarantined as `status: HELD`, excluded from recipient APIs/previews, sender shown amber review indicator.
  - Atomic `$transaction` creating message, flags, and admin alerts simultaneously.
- Documented trade-offs in `docs/LIMITATIONS.md`.
- Test suites: `tests/rule-engine.test.ts` (73/73 passing), `tests/message-hold.test.ts` (3/3 passing).

---

## Part 8: Admin Flag Review Dashboard & Decisions (Feature 10)
- REST APIs:
  - `GET /api/admin/flags`: filtered, paginated moderation queue.
  - `GET /api/admin/flags/[id]`: flagged message with 20 surrounding conversation messages for context.
  - `POST /api/admin/flags/[id]/decision`: `APPROVE`, `REJECT`, `DISMISS`. Row-level atomic idempotency.
- Two-pane review interface at `/admin/flags`:
  - Left: queue list with status chips (Open, Approved, Rejected, Dismissed).
  - Right: detailed conversation inspection with flagged message softly outlined in amber, decision note input, and action triggers.
- Test suite: `tests/flag-review.test.ts` (6/6 passing).

---

## Part 9: Rule Configuration & Audit Log View (Feature 11)
- REST APIs:
  - `GET /api/admin/rules`, `POST /api/admin/rules`, `PATCH /api/admin/rules/[id]` (blocks downgrading locked rules).
  - `POST /api/admin/rules/test`: live simulation sandbox.
  - `GET /api/admin/audit`: filtered and paginated audit events.
- Administrative UIs:
  - `/admin/rules`: rule toggles, action threshold switches, pattern addition modal, interactive rule tester.
  - `/admin/audit`: filterable, paginated immutable security audit log.
- Test suite: `tests/rules-audit.test.ts` (5/5 passing).

---

## Part 10: Notifications & Unread Handling (Feature 12)
- Lightweight admin unread polling endpoint: `GET /api/admin/notifications/unread-count`.
- Reusable `AdminNavRail.tsx` with Bell icon and live unread open flags badge.
- Participant notification endpoints: `GET /api/notifications` and `POST /api/notifications/read` (scoped strictly to current user).
- Quiet in-chat system notices ("Your held message was approved by CCP Studio") and dismissible system banners.
- Recipient unread counts verified strictly excluding HELD and REJECTED messages.
- Test suite: `tests/notifications.test.ts` (4/4 passing).

---

## Part 11: UI Polish, Responsiveness & Accessibility (Feature 13)
- WhatsApp Web dark theme styling verified across all 5 core screens.
- Created and exported reusable UI components: `AccessDenied.tsx` and `StatusPill.tsx`.
- Mobile responsive enhancements across all panels with back navigation at 375px.
- Accessibility improvements: WCAG AA contrast, visible focus rings, labelled inputs, `aria-live="polite"` on chat message logs.
- Test suite: `tests/ui-polish.test.ts` (4/4 passing).

---

## Part 12: Security Hardening & IDOR Audit (Feature 14)
- Verified server-side authorization checks on all 28 API routes.
- Configured HTTP security headers in `next.config.ts`: CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, HSTS.
- Implemented message send rate limiter (max 30 msgs/min per user).
- Origin and CSRF validation on mutating requests.
- Updated `docs/SECURITY.md` with complete API authorization matrix.
- Test suite: `tests/security-idor.test.ts` (7/7 passing).

---

## Part 13: Automated Acceptance Tests (Feature 15)
- Automated end-to-end test suite in `tests/acceptance.test.ts` covering all 7 core brief scenarios:
  - Scenario 1: Ordinary Message Exchange & Reload Persistence -> **PASS**
  - Scenario 2: IDOR & Tamper Isolation -> **PASS**
  - Scenario 3: Zero Identity Leakage & Distinct Project Aliases -> **PASS**
  - Scenario 4: Contact-Sharing Interception (HOLD) -> **PASS**
  - Scenario 5: Pricing Flag with Uninterrupted Delivery -> **PASS**
  - Scenario 6: Admin Review & Decision Audit Trail -> **PASS**
  - Scenario 7: Immediate Access Revocation & Decision Idempotency -> **PASS**
- Script `"test:acceptance"` added to `package.json`.

---

## Part 14: Deployment, Health & Documentation (Feature 16)
- Created `render.yaml` for zero-downtime containerized deployment.
- Created `.github/workflows/deploy.yml` pipeline validating lint, typecheck, tests, and build.
- Authored comprehensive `DEPLOYMENT.md` deployment runbook.
- Authored comprehensive `README.md` with architectural rationale, honest privacy boundaries, and setup guide.

---

## Part 15: Verification Pack & Submission Deliverables (Feature 17)
- Produced `docs/VERIFICATION_REPORT.md` with live verification evidence.
- Authored `docs/WALKTHROUGH_SCRIPT.md` (3-5 minute scenario recording runbook with timings).
- Authored `docs/DESIGN_NOTE.md` detailing architectural trade-offs.

---

## Summary of Test Verification
- All test suites passing (Health, Schema, Auth, Admin, Chat Core, Rule Engine, Hold Logic, Flag Review, Rules/Audit, Notifications, UI Polish, IDOR & Security, Acceptance).
- Production build `npm run build` compiled successfully (14 static and dynamic routes).
- Zero lint or typecheck errors.

