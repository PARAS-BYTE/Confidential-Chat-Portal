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
