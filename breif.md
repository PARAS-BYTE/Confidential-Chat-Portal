# CCP Portal: Feature-by-Feature Build Prompts (Branch, PR, Merge)

Each feature below gets its own **branch**, its own **prompt**, its own **test checklist**, and its own **pull request that you merge yourself**. Nothing is built ahead of its turn.

---

## Part 0. How the loop works

For every feature, you do the same six steps:

| Step | Who | What |
| --- | --- | --- |
| 1 | You | Start from a clean, updated `main` and create the feature branch |
| 2 | You | Paste the feature prompt into Antigravity (Planning mode) and approve its plan |
| 3 | Agent | Builds only that feature, runs tests, commits, pushes, opens a PR |
| 4 | You | Run the feature's manual checklist (the "Your checks" list) |
| 5 | You | Review the PR diff, wait for CI to go green, then **squash and merge** |
| 6 | You | Pull `main` locally, delete the branch, move to the next feature |

### Your git commands (same every time)

```bash
# Step 1: before each feature
git checkout main
git pull origin main
git checkout -b feat/<branch-name>      # name is given in each feature

# Step 5/6: after you merge the PR on GitHub
git checkout main
git pull origin main
git branch -d feat/<branch-name>
```

If the agent cannot push or open a PR, run these yourself:

```bash
git add -A
git commit -m "<commit message from the feature>"
git push -u origin feat/<branch-name>
gh pr create --base main --title "<PR title>" --body "<paste the agent's summary>"
```

### PR review rules (you)

- Open the PR "Files changed" tab. Look for: leftover `console.log` of message bodies, hard-coded secrets, any route without an auth call, any participant response that spreads a user object.
- CI must be green (set up in Feature 1).
- Use **Squash and merge**. Do not merge a PR with failing checks.
- If a later PR has migration conflicts, ask the agent: *"Rebase this branch on main and resolve Prisma migration conflicts without deleting existing migrations."*

### If a check fails

Do not merge. Send:

```
Check failed: [name of the check].
Expected: [what should happen].
Actual: [what happened, paste the error or response].
Fix only this issue on the current branch, add a test that would have caught it,
re-run tests, push, and update the PR.
```

---

## Part 1. One-time setup (you do this before Feature 1)

1. **GitHub:** create an empty private repository `CCP-portal`. Clone it locally and open the folder in Antigravity.
2. **GitHub CLI:** install `gh`, then run `gh auth login` so the agent can open PRs.
3. **Branch protection (GitHub → Settings → Branches):** protect `main`: require a pull request, require status checks to pass, block direct pushes.
4. **Database:** create a free Neon (or Supabase) PostgreSQL project. Create **two** databases or branches: one for development, one for production. Copy both connection strings.
5. **Local `.env`:** you will fill `DATABASE_URL` and `SESSION_SECRET` (generate with `openssl rand -base64 32`). Never commit this file.
6. **Design reference:** save the WhatsApp Web screenshot you shared as `docs/design-reference.png` in the repo. The agent will use it as the visual reference.
7. **Hosting accounts:** create Vercel (or Render) account. Do not deploy yet.
8. **Brief:** save the assignment text as `docs/BRIEF.md`.
9. In Antigravity, choose **Planning mode** and your strongest available model.

---

## Part 2. Standing Rules (paste once at the very start, also save as `docs/RULES.md`)

```
You are building the "CCP Studio Confidential Communication Portal".
Read docs/BRIEF.md fully. The visual reference is docs/design-reference.png.

STACK
Next.js (App Router) + TypeScript + Tailwind CSS, PostgreSQL, Prisma, Zod,
argon2 for password hashing, cookie sessions stored server-side. Single
full-stack deployment. Text-only chat, polling for updates (no WebSockets).

WORKING RULES (every feature)
1. Work ONLY on the feature I name. Do not build ahead or refactor unrelated code.
2. Before coding, list the files you will create or change and wait for my plan
   approval if in Planning mode.
3. Git: you are already on the feature branch I created. Make small commits with
   clear messages. When finished: run lint, typecheck, tests and build; push the
   branch; open a pull request to main with `gh pr create`. DO NOT merge it. I merge.
4. Every PR description must contain: What changed, How to test manually,
   Security notes, Known limitations, Migrations included (yes/no).
5. Authorization is enforced on the server for every project, conversation and
   message operation. Hiding UI controls is never enough.
6. Participant-facing API responses must never contain real name, email, phone,
   photo, real user IDs, other participants' membership IDs, online status, last
   seen, other projects, or participant lists. Use allow-list serializers,
   never "spread the object then delete fields".
7. Validate all input with Zod. Never log passwords, session tokens, message
   bodies or unnecessary identity data.
8. Secrets only in environment variables. No credentials in source or frontend
   bundles. Keep .env.example current.
9. Fictional demo data only.
10. Write tests for the feature. Do not mark a feature done if tests fail.
11. When done, reply with: (a) what you built, (b) the exact manual test steps,
    (c) limitations, (d) anything I must do manually. Then stop and wait.

DESIGN RULES (every screen)
Follow the "Design System" section below exactly. The look is the calm, muted
dark theme of WhatsApp Web in docs/design-reference.png. It must NOT look neon.
```

---

## Part 3. Design System (reference for every UI feature)

You will paste this into Feature 1 so it becomes shared code. It is also the standard every later UI feature must follow.

**The look in one line:** WhatsApp Web dark mode. Quiet charcoal surfaces, soft grey text, one muted green used sparingly. Nothing glows.

**Colour tokens (CSS variables, dark theme default)**

| Token | Value | Use |
| --- | --- | --- |
| `--bg-app` | `#0b0c0c` | Page background, icon rail |
| `--bg-panel` | `#161717` | Side panels, lists |
| `--bg-surface` | `#1d1f1f` | Cards, inputs, modals |
| `--bg-field` | `#292a2a` | Search bar, composer, pill inputs |
| `--bg-hover` | `#242626` | Row hover |
| `--border` | `#2e2f2f` | Hairline borders, chip outlines |
| `--text-primary` | `#e9edef` | Main text |
| `--text-secondary` | `#8696a0` | Previews, timestamps, labels |
| `--accent` | `#21c063` | Used only for: unread badge, primary button, active chip text, delivered ticks |
| `--accent-soft` | `#103529` | Active chip / selected row background |
| `--bubble-out` | `#005c4b` | Your own message bubble |
| `--bubble-in` | `#202c33` | Other person's bubble |
| `--warn` | `#c9a227` (muted amber) | Held-for-review state |
| `--danger` | `#d9534f` (muted red) | Failed, rejected, destructive |
| `--info` | `#53bdeb` | Read ticks only |

**Rules that keep it from looking neon**

- No glow, no `box-shadow` colour bleed, no gradients, no glassmorphism, no animated borders.
- Green appears in small doses only (see `--accent` row). Never as a large background fill or section colour.
- Shadows, if any, are plain and subtle (`0 1px 2px rgba(0,0,0,.4)`).
- Corners: pill (fully rounded) for search, chips and composer; 12-16px radius for cards and modals; 8px for bubbles with the usual tail-less rounded look.
- Typography: system stack `"Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif`. Body 14-15px, chat text 14.2px, timestamps 11-12px. Sentence case everywhere, no all-caps labels.
- Spacing on a 4px grid. Row height about 72px for list items. Generous but calm.
- Layout: a narrow icon rail on the far left, a list panel (about 400px) next to it, and a main pane on the right (like the screenshot). On mobile: single column, list first, chat opens full screen with a back arrow.
- Filter chips like "All / Unread / Favourites": pill outline, active chip uses `--accent-soft` background with `--accent` text.
- Unread badge: small round `--accent` circle with dark text.
- Empty/placeholder pane: centred card on `--bg-surface` with a simple line illustration and two lines of text (as in the "Voice and video calling" card).
- Icons: one outline icon set (lucide-react), 20-24px, `--text-secondary` by default.
- Motion: only 120-160ms colour/opacity transitions on hover and focus. Respect `prefers-reduced-motion`.
- Accessibility: all text meets WCAG AA contrast on its background, visible 2px focus ring (use `--text-secondary` outline, not neon), full keyboard use.
- Copy: plain and specific. Buttons name the action ("Approve message", "Remove from project"). Errors say what went wrong and how to fix it.

---

## Feature 1. Project foundation, theme and CI

**Branch:** `feat/foundation` **Commit / PR title:** `feat: project foundation, design tokens and CI`

**You do first**

- Complete Part 1 setup. Create the branch. Fill local `.env` with `DATABASE_URL` and `SESSION_SECRET`.

**Prompt**

```
Feature 1: Project foundation, design tokens, CI. Do only this.

1. Initialise Next.js (App Router, TypeScript, Tailwind), Prisma and PostgreSQL.
2. Folders: /src/app, /src/lib (db, auth, authz, serializers, rules, audit),
   /src/components/ui, /prisma, /tests, /docs, /scripts.
3. .env.example with DATABASE_URL, SESSION_SECRET, APP_URL, NODE_ENV and
   DEMO_PASSWORD (all empty or placeholder). Ensure .env is git-ignored.
4. Prisma client singleton in /src/lib/db.ts.
5. Implement the Design System from Part 3 of my document as Tailwind theme
   extensions plus CSS variables in globals.css (dark theme default, tokens
   named exactly as listed). Create base layout with the three-zone shell:
   icon rail, list panel, main pane, responsive down to 375px width.
   Create a placeholder home page showing the empty-pane card.
6. Create basic reusable UI components in /src/components/ui: Button (primary,
   secondary, danger), Input, Chip, Badge, Card, Skeleton, EmptyState,
   ErrorState. All following the muted WhatsApp-style theme. No neon, no glow,
   no gradients.
7. GET /api/health returning {status:"ok", db:"up"|"down"} after a trivial DB
   query. It must never expose secrets, identities or messages.
8. npm scripts: dev, build, start, lint, typecheck, test, db:migrate, db:seed,
   db:reset-demo.
9. Add Vitest. Add one test for /api/health.
10. Add GitHub Actions workflow .github/workflows/ci.yml running install, lint,
    typecheck, test, build on every pull request.
11. Add a short docs/ARCHITECTURE.md skeleton.
Then follow the Git rules: commit, push, open PR, do not merge.
```

**Your checks**

- `npm run dev` opens the app; page looks like a calm dark WhatsApp-style shell, no glowing colours.
- Visit `/api/health`: shows `status ok, db up`. Stop the DB or break `DATABASE_URL` temporarily: shows `db down` without any secret.
- `git status` shows `.env` untracked/ignored.
- Resize to 375px: shell collapses to one column.
- CI runs on the PR and passes.

**Merge:** squash and merge, pull `main`.

---

## Feature 2. Database schema, migrations and seed

**Branch:** `feat/database-schema` **Commit / PR title:** `feat: prisma schema, migrations and demo seed`

**You do first**

- New branch from updated `main`. Make sure `DATABASE_URL` points to the dev database.

**Prompt**

```
Feature 2: Database schema, migrations, seed. Do only this.

Design the Prisma schema with proper relations, enums and indexes:
- User: id, role (ADMIN|CLIENT|EMPLOYEE), realName, email (unique), phone,
  passwordHash, isActive, createdAt.
- Project: id, title, description, status, createdAt.
- Membership: id, userId, projectId, alias, role, status (ACTIVE|REMOVED),
  removedAt. Unique (userId, projectId). Unique (projectId, alias).
- Conversation: one per project.
- Message: id, conversationId, senderMembershipId, body, status
  (SENDING|DELIVERED|HELD|REJECTED|FAILED), clientMessageId, deliveredAt,
  createdAt. Unique (senderMembershipId, clientMessageId).
- Rule: id, name, category (CONTACT|OFF_PLATFORM|COMMERCIAL|ABUSE), pattern,
  patternType (REGEX|KEYWORD), severity (LOW|MEDIUM|HIGH), action
  (ALLOW_FLAG|HOLD), isActive, isLocked.
- Flag: id, messageId, ruleId, category, severity, reason, matchedText,
  status (OPEN|APPROVED|REJECTED|DISMISSED), reviewNote, reviewedById,
  reviewedAt, createdAt.
- Notification: id, recipientUserId or membershipId, type, text, readAt.
- AuditEvent: id, actorId, action, targetType, targetId, metadata Json,
  createdAt.
- ReadState: membershipId, conversationId, lastReadAt.
- Session (for Feature 3): id, userId, tokenHash, expiresAt, createdAt.

Create a migration. Create an idempotent seed script (safe to run repeatedly,
upserts only):
- 1 admin, 2 clients, 2 employees, all fictional.
- Project Alpha: Client 1 + Employee 1. Project Beta: Client 2 + Employee 2.
  These two projects must be fully isolated.
- Each person gets different aliases in different projects (e.g. "Client A" /
  "Project Specialist B" in Alpha, "Client C" / "Project Specialist D" in Beta;
  if one person is later in two projects they get different aliases).
- Demo password read from DEMO_PASSWORD env var (hashed). If missing, generate
  one and print it once to the console only.
- A few ordinary demo messages per project.
Add db:reset-demo that removes only demo data (identified by a demo flag or
email domain like @demo.CCP.test), never other data.
Add tests for schema constraints (unique alias per project, unique
clientMessageId per sender).
```

**Your checks**

- `npx prisma migrate dev` succeeds.
- `npm run db:seed` twice: no errors, no duplicates.
- `npx prisma studio`: 2 projects, 5 users, aliases differ across projects.
- `npm run db:reset-demo` removes demo data; seed brings it back.

**Merge:** squash and merge.

---

## Feature 3. Authentication and sessions

**Branch:** `feat/auth` **Commit / PR title:** `feat: authentication, sessions and login screen`

**Prompt**

```
Feature 3: Authentication. Do only this.

Backend
- POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me.
- Verify password with argon2. Return the same generic error for unknown email
  and wrong password (no user enumeration). Deactivated users cannot log in.
- Rate limit or temporarily lock after repeated failed attempts (per IP + email).
- Sessions: random 32-byte token, store only its hash in the Session table,
  cookie httpOnly, sameSite=lax, secure in production, sensible expiry,
  new session on login, server-side invalidation on logout.
- /api/auth/me returns only what that role needs. For CLIENT/EMPLOYEE return
  role only (no real identity fields needed by the UI).
- Origin/CSRF check on all mutating requests.
- Zod validation. Do not log credentials or tokens.
- Middleware: unauthenticated users go to /login; ADMIN lands on /admin;
  CLIENT/EMPLOYEE land on /projects; a participant opening /admin gets
  an access-denied page.

UI: /login in the muted WhatsApp-style theme: centred card on --bg-surface,
labelled email and password fields, show/hide password, inline validation,
loading state on the button, clear error messages (invalid credentials, account
disabled, too many attempts), keyboard friendly, visible focus ring.
Include the required notice text under the form:
"Your identity is hidden from other participants. CCP Studio administrators
may review conversations for project management and policy compliance."

Tests: login success per role, wrong password generic error, deactivated user,
logout invalidates session, protected route redirects, rate limiting.
```

**Your checks**

- Log in as admin, client, employee (use seeded demo password).
- Wrong password and unknown email show the same message.
- After logout, pressing Back and refreshing does not show protected pages.
- DevTools → Application → Cookies: session cookie is HttpOnly, SameSite Lax.
- Open `/admin` as a client: access denied.

**Merge:** squash and merge.

---

## Feature 4. Authorization layer and safe serializers

**Branch:** `feat/authz-serializers` **Commit / PR title:** `feat: server-side authorization and privacy-safe serializers`

**Prompt**

```
Feature 4: Central security layer. Do only this.

- /src/lib/authz.ts: requireUser(), requireRole(role), and
  assertProjectAccess(userId, projectId) which requires an ACTIVE membership.
  Admin gets access only through admin routes. Return 404 (not 403) for
  resources the user cannot access so existence is not revealed.
- Helper getMembership(userId, projectId) used by chat routes.
- /src/lib/serializers.ts with ALLOW-LIST serializers:
  participantMessageDTO: { id, senderAlias, body, createdAt, deliveredAt,
  status, isMine }. participantProjectDTO: { id, title, myAlias,
  otherAlias, ... }. adminMessageDTO / adminUserDTO may include real identity.
  Never spread-then-delete.
- Tests that fail if any participant DTO ever contains: email, realName, phone,
  userId, other membershipId, passwordHash, role of other user.
- Tests that call a protected function with another user's project, conversation
  and message IDs and expect 404.
- Add a convention doc in docs/SECURITY.md: every route handler calls an auth
  helper first. Add a simple test or script that scans /src/app/api route files
  and fails if a handler lacks an auth helper call (except /api/health and
  /api/auth/login).
```

**Your checks**

- `npm test` is green.
- Temporarily add `email` to a participant DTO: the test must fail. Then revert.

**Merge:** squash and merge.

---

## Feature 5. Admin accounts, projects and assignments

**Branch:** `feat/admin-management` **Commit / PR title:** `feat: admin accounts, projects, assignments and audit events`

**Prompt**

```
Feature 5: Admin management. Do only this.

APIs (all admin-only, verified on the server):
- Users: create, list, update, deactivate/reactivate. Fields: role, real name,
  email, phone, temporary password (hashed; force change is optional).
- Projects: create, list, update status.
- Memberships: assign a CLIENT and an EMPLOYEE to a project. Auto-generate a
  unique alias per project (Client A, Project Specialist B, ...). The same
  person gets a different alias in a different project.
  Remove membership: status REMOVED + removedAt, access revoked immediately
  (existing sessions lose access on the next request). Re-adding creates a
  fresh alias.
- Create the project's conversation automatically when the project is created.
- Every account change, assignment, and removal writes an AuditEvent (actor,
  time, action, target, metadata without passwords).

UI /admin (same muted WhatsApp-style theme, icon rail with Projects, Users,
Flags, Rules, Audit):
- Users table with real identities, role badge, status, create/deactivate.
- Projects list; project detail with member table showing real identity next
  to alias, assign and remove controls with confirmation modal.
- Success/error toasts, loading skeletons, empty states, keyboard access.

Tests: client/employee session calling every admin endpoint gets 403;
removing a membership immediately blocks that user's access; audit rows created.
```

**Your checks**

- As admin: create a new client, a new employee, a new project, assign both.
- Log in as the new client in another browser profile: sees only that project.
- Remove the membership: refresh the client browser: project is gone / access denied.
- Call an admin API from a client session in DevTools or curl: 403.
- Audit table has rows for each action.

**Merge:** squash and merge.

---

## Feature 6. Participant projects inbox

**Branch:** `feat/participant-inbox` **Commit / PR title:** `feat: participant projects inbox with alias previews and unread counts`

**Prompt**

```
Feature 6: Projects / Inbox for CLIENT and EMPLOYEE at /projects. Do only this.

API GET /api/projects returns ONLY projects where the user has an ACTIVE
membership. Per project: id, title, myAlias, otherAlias (the other party's
alias only), last message preview (DELIVERED messages from others, or my own
messages in any state), last activity time, unread count (from ReadState).
No real identities, no participant lists, no other projects.

UI: styled like the WhatsApp Web chat list in docs/design-reference.png:
- Icon rail, search bar (filters the user's own projects only), filter chips
  "All" and "Unread", list rows 72px high with alias avatar (initials on a
  neutral circle, no photos), title, alias-based preview, time, unread badge.
- Right pane shows the empty-pane card until a project is selected.
- Loading skeleton rows, empty state ("No projects assigned yet"), error state
  with Retry, responsive single-column on mobile, keyboard focus styles.
- Header shows only the user's own role label, no real name needed.

Tests: client 1 sees only Alpha, client 2 only Beta; held messages never
appear in the other party's preview or unread count; response contains no
identity fields.
```

**Your checks**

- Client 1 sees Alpha only; Client 2 sees Beta only.
- DevTools → Network → `/api/projects`: no email, name, phone, or ids of other users.
- Compare the screen to your screenshot: similar layout, calm colours, no neon.

**Merge:** squash and merge.

---

## Feature 7. Project chat core (text, history, states, idempotency)

**Branch:** `feat/chat-core` **Commit / PR title:** `feat: alias-based project chat with persisted history and safe retry`

**Prompt**

```
Feature 7: Project chat core. No moderation yet; treat every message as DELIVERED.

API
- GET /api/projects/[projectId]/messages with cursor pagination.
- POST /api/projects/[projectId]/messages { body, clientMessageId }.
- POST /api/projects/[projectId]/read to update ReadState.
- Each handler: requireUser, assertProjectAccess, Zod (trim, 1 to 2000 chars).
  Sender is derived from the session, never from the request body.
- Idempotency: same clientMessageId from same sender returns the existing
  message, never creates a duplicate.
- Recipient sees DELIVERED messages from the other party; the sender sees their
  own messages in any state. Use participantMessageDTO only.

UI: Project Chat styled like WhatsApp Web, muted:
- Header with the other party's alias and a back arrow on mobile.
- Message bubbles (--bubble-out right, --bubble-in left), timestamp inside the
  bubble, status ticks for my messages (sending = clock, delivered = tick,
  failed = red icon with Retry button reusing the same clientMessageId).
- Composer: pill input on --bg-field, Enter to send, Shift+Enter for newline,
  send button disabled when empty.
- Pinned notice card at the top of the chat or under the header with the exact
  text: "Your identity is hidden from other participants. CCP Studio
  administrators may review conversations for project management and policy
  compliance."
- Poll every 3 to 5 seconds, pause when the tab is hidden, mark as read when
  visible. Auto-scroll to newest unless the user scrolled up.
- States: loading skeleton, empty conversation, error with retry, access denied
  (for wrong/unauthorised project IDs), offline/failed send.
- Text rendered safely (no HTML injection).

Tests: send/receive, reload persistence, duplicate clientMessageId, wrong
project ID returns 404, sender spoofing attempt ignored, XSS string is escaped.
```

**Your checks**

- Two browser profiles (client and employee): exchange messages; both show only aliases.
- Reload: history remains.
- Turn on DevTools "Offline", send, see failed state, go online, press Retry: exactly one message arrives.
- Change the project ID in the URL to another project: access denied.
- Send `<script>alert(1)</script>`: shown as plain text.

**Merge:** squash and merge.

---

## Feature 8. Moderation rule engine

**Branch:** `feat/rule-engine` **Commit / PR title:** `feat: configurable moderation rule engine with seeded rules and tests`

**Prompt**

```
Feature 8: Rule engine as a pure, testable module in /src/lib/rules. No send-flow
integration yet.

- evaluateMessage(body, rules) returns an array of matches:
  { ruleId, category, severity, reason, matchedText, action }.
- Normalisation before matching: lowercase, Unicode normalise, strip zero-width
  characters, collapse repeated spaces, handle common obfuscation
  ("name at gmail dot com", "9 8 7 6 ...", digits spelled with dashes/dots).
- Seed these rules (stored in DB, via the seed script):
  CONTACT (isLocked, action HOLD): phone numbers (spaced, hyphenated, with country
  code), email addresses and obfuscated emails, social handles (@name), external
  links and messenger links (wa.me, t.me, instagram, linkedin, etc.).
  OFF_PLATFORM (default HOLD): "let's talk on WhatsApp", "call me", "pay me
  directly", "outside the portal", "move to Telegram".
  COMMERCIAL (default ALLOW_FLAG): price, quote, cost, discount, advance, invoice,
  currency amounts, "pay", "refund".
  ABUSE (default ALLOW_FLAG): insults, threats.
- Final action = strictest of all matches (HOLD beats ALLOW_FLAG).
- Safe regex handling: compile once, guard against catastrophic patterns, and
  time-limit/length-limit inputs.
- Unit tests: at least 8 positive and 8 negative examples per category,
  including false positives ("version 2.0", "meet at 3 pm", "room 4021",
  "the deadline price is on us" where reasonable).
- docs/LIMITATIONS.md: list known misses (spelled-out digits in other
  languages, images of text, creative spacing, code words) and false positives.
```

**Your checks**

- `npm test`: rule tests green.
- Skim the test file: normal sentences like "Please share the draft by Friday" are not flagged.
- Read `docs/LIMITATIONS.md`; it should be honest.

**Merge:** squash and merge.

---

## Feature 9. Moderation in the send flow (hold logic)

**Branch:** `feat/message-hold` **Commit / PR title:** `feat: server-side moderation, held messages and flag creation`

**Prompt**

```
Feature 9: Integrate the rule engine into POST messages. Do only this.

- Evaluate on the server BEFORE delivery.
  No match -> DELIVERED.
  ALLOW_FLAG match -> DELIVERED + Flag + admin alert.
  HOLD match -> status HELD + Flag(s) + admin alert, nothing delivered.
- HELD (and REJECTED) messages are excluded from the recipient's messages API,
  previews, unread counts and notifications.
- The sender sees their held message with a "Held for review" state and the
  review category (e.g. "Contact details"), but not any other user's info.
- The send response returns the final status so the UI shows delivered or held
  immediately.
- Message, flags and alert are created in ONE database transaction.
- Never log message bodies.
- UI: held state in the sender's bubble (amber outline, clock-with-eye icon,
  text "Held for review. An administrator will check this message."), without
  alarming colours. Retry on a HELD message does not create a duplicate.

Tests: phone/email/link held and absent from recipient responses; pricing
message delivered with alert; abusive message handled per rule action; normal
chat unaffected; transaction rollback leaves no half-created data.
```

**Your checks**

- Client sends `call me on 9876543210`: shows held; employee browser (Network tab, `/messages`) never contains that text.
- Client sends `Can you share your price for this?`: delivered; an alert row exists in DB (Prisma Studio).
- Normal message still delivered instantly.

**Merge:** squash and merge.

---

## Feature 10. Admin flag review dashboard and decisions

**Branch:** `feat/flag-review` **Commit / PR title:** `feat: admin flag review queue, decisions and idempotent approval`

**Prompt**

```
Feature 10: /admin/flags. Do only this.

API
- GET /api/admin/flags with filters (status, category, severity, project, date
  range, text search) and pagination. Each item: project, sender alias with
  real identity (admin only), category, severity, timestamp, matched rule,
  reason, status.
- GET /api/admin/flags/[id] returns the flagged message with conversation
  context (about 10 messages before and after) and the audit history.
- POST /api/admin/flags/[id]/decision { decision: APPROVE|REJECT|DISMISS, note }
  - APPROVE delivers a HELD message (sets DELIVERED + deliveredAt).
  - REJECT keeps it undelivered (REJECTED).
  - DISMISS marks a false positive (message stays as is; if it was held, deliver
    it or follow the documented behaviour; state the choice in the PR).
  - Run in a transaction with a row lock; only OPEN flags can transition.
    Repeating the same approval returns the same result and never delivers twice.
    Concurrent clicks are safe.
  - Notify the sender ("Your message was approved" / "was not delivered") with
    no identity information.
  - Write an AuditEvent (actor, time, action, flagId, note).

UI: two-pane layout like WhatsApp Web: left = queue list with filter chips
(Open, Approved, Rejected, Dismissed, categories), right = detail with the
conversation context, flagged message highlighted with a soft amber outline,
note field, buttons Approve message / Reject message / Dismiss as false positive,
confirmation for reject, audit history block. Loading, empty ("No flags to
review"), error states. Muted theme, no neon.

Tests: approve once; approve twice; two simultaneous approvals; reject; dismiss;
non-admin gets 403; sender notified; recipient sees approved message only after
approval.
```

**Your checks**

- Create 3 held/flagged messages. Approve one, reject one, dismiss one.
- Double-click Approve; also re-send the approve request with curl or DevTools: employee sees the message once.
- Participant sees a decision notification with no identity info.
- Audit shows three decisions.

**Merge:** squash and merge.

---

## Feature 11. Rule configuration and audit log view

**Branch:** `feat/rules-audit-ui` **Commit / PR title:** `feat: admin rule configuration and audit log screens`

**Prompt**

```
Feature 11: /admin/rules and /admin/audit. Do only this.

Rules page
- List rules grouped by category. Toggle active. Switch ALLOW_FLAG / HOLD for
  OFF_PLATFORM, COMMERCIAL and ABUSE. CONTACT rules display as locked HOLD
  and cannot be switched to allow.
- Add / edit patterns (regex or keyword) with Zod validation, length limit,
  and rejection of invalid or catastrophic regex.
- "Test a message" box showing which rules match and the resulting action.
- Rule changes apply to new messages immediately and write AuditEvents.

Audit page
- Table of AuditEvents (assignments, access changes, rule changes, moderation
  decisions) with actor, time, action, target. Filters by actor, action type,
  date range. Pagination.
- Admin only, enforced on the server.

Tests: locked rules cannot be downgraded; invalid regex rejected; rule change
affects the next message; audit entries created.
```

**Your checks**

- Switch COMMERCIAL to HOLD: send a pricing message from the client: now held, employee does not see it.
- Switch it back to ALLOW_FLAG.
- Try to change a CONTACT rule to allow: blocked.
- Audit page lists the changes.

**Merge:** squash and merge.

---

## Feature 12. Notifications and unread handling

**Branch:** `feat/notifications` **Commit / PR title:** `feat: admin alerts, participant decision notices and unread handling`

**Prompt**

```
Feature 12: Notifications. Do only this.

- Admin: bell icon on the icon rail with a count of OPEN flags, linking to the
  review item. Lightweight polling endpoint.
- Participants: notification when a held message is approved or rejected,
  shown in the inbox and inside the chat as a quiet system line
  ("Your message was approved"). Mark as read.
- Notification text never reveals identities or other users.
- Unread counts update correctly and never count HELD or REJECTED messages for
  the recipient.
- Endpoints are scoped to the current user only.

Tests: flag creates admin alert; decision creates sender notification only;
no cross-user reads; unread counts exclude held messages.
```

**Your checks**

- Send a flagged message: admin bell count increases without refreshing the full page.
- Approve it: only the sender gets a notice.

**Merge:** squash and merge.

---

## Feature 13. UI polish, responsiveness and accessibility

**Branch:** `feat/ui-polish` **Commit / PR title:** `feat: consistent muted theme, responsive layouts and accessibility pass`

**Prompt**

```
Feature 13: UI polish across all five required screens (Login, Projects/Inbox,
Project Chat, Admin Projects & Assignment, Flag Review). Do only this.

- Compare each screen to docs/design-reference.png. Match its calm structure:
  icon rail, list panel, main pane, pill search and chips, muted charcoal
  surfaces, restrained green accent. Remove anything that looks neon,
  glowing, gradient-heavy or oversaturated.
- Complete shared components: Button, Input, Chip, Badge, Card, Toast, Modal,
  Skeleton, EmptyState, ErrorState, AccessDenied, StatusPill (sending,
  delivered, failed, held).
- Ensure all states exist on every screen: loading, empty, error,
  access-denied, message-held.
- Responsive: test at 375px, 768px, 1280px. On mobile the chat opens full
  screen with a back arrow; admin tables become stacked cards or scroll inside
  their own container.
- Accessibility: WCAG AA contrast, visible focus rings, labelled inputs,
  aria-live for new messages and toasts, full keyboard navigation, logical
  heading order, reduced-motion support.
- Different navigation for admin vs participants so role boundaries are clear.
- Run Lighthouse accessibility and fix issues until 95 or higher.
Report before/after screenshots at 375px and 1280px in the PR.
```

**Your checks**

- Browser DevTools device toolbar at 375px: no horizontal scroll on the page.
- Press Tab through each screen: focus always visible, order sensible.
- Put your screenshot next to the app: colours and layout feel the same family. If any area looks neon or too green, ask for a fix: *"Reduce green usage on \[screen\]; use --accent only for badges, primary button and active chip text."*

**Merge:** squash and merge.

---

## Feature 14. Security hardening audit

**Branch:** `feat/security-hardening` **Commit / PR title:** `chore: security audit, IDOR tests and hardening`

**Prompt**

```
Feature 14: Security audit of the whole codebase. For each item report PASS or
FAIL in the PR description and fix failures.

1. List every API route and the auth/authorization check it performs.
2. IDOR automated tests: another user's project, conversation, message and flag
   IDs return 404/403 for read and write.
3. Removed membership loses access immediately (REST and UI).
4. Participant endpoints never contain real identity, others' user or
   membership IDs, other projects, or participant lists. Add an automated test
   that walks every participant endpoint with a recursive key scan.
5. Zod validation on every input; message length limits; safe rendering (no
   dangerouslySetInnerHTML with user content).
6. CSRF/origin checks on mutating requests; sameSite cookies.
7. Security headers (CSP, X-Content-Type-Options, Referrer-Policy,
   frame-ancestors), HSTS in production.
8. Rate limiting on login and message send.
9. No secrets in repo history or frontend bundles; logs contain no passwords,
   tokens, or message bodies. Run a secret scan.
10. Sender cannot be spoofed via request body; admin-only routes reject
    participant sessions.
11. npm audit: fix or document high/critical issues.
Add all tests to /tests and ensure `npm test` runs them.
```

**Your checks**

- Tamper with IDs manually: in DevTools, copy a chat request as cURL, change the project ID, run while logged in as the wrong user: expect 404.
- Read the PR's PASS/FAIL table. Anything FAIL must be fixed before merge.

**Merge:** squash and merge.

---

## Feature 15. Automated acceptance tests

**Branch:** `feat/acceptance-tests` **Commit / PR title:** `test: end-to-end tests for the 7 acceptance scenarios`

**Prompt**

```
Feature 15: End-to-end tests (Playwright, or API-level tests plus a few UI
tests) for the 7 acceptance scenarios from docs/BRIEF.md:
1. Client and employee exchange ordinary messages using aliases; survives reload.
2. Unrelated user cannot read or send by changing project, conversation or
   message IDs.
3. Participant responses contain no other participant's real identity; aliases
   differ across projects.
4. Contact-sharing message is held and invisible to the recipient until approved.
5. Pricing message creates an admin alert; normal chat remains usable.
6. Admin approves one held message, rejects another, dismisses a false positive;
   all appear in the audit log.
7. Removing membership revokes access; approval retries do not deliver twice.
Use separate browser contexts for admin, client and employee. Reset demo data
before the run. Output a results table. Add the tests to CI if feasible.
```

**Your checks**

- Run `npm run test:e2e` locally; all 7 pass. Watch the browser run once to see it behave like a real user.

**Merge:** squash and merge.

---

## Feature 16. Deployment, health and documentation

**Branch:** `feat/deployment-docs` **Commit / PR title:** `chore: deployment setup, health readiness and documentation`

**You do first**

- Have Vercel (or Render) and the production Neon database ready.
- Be ready to set environment variables in the hosting dashboard yourself: `DATABASE_URL`, `SESSION_SECRET`, `APP_URL`, `DEMO_PASSWORD`, `NODE_ENV=production`.

**Prompt**

```
Feature 16: Deployment and documentation. Do only this.

- Production config: APP_URL, allowed origins, secure cookies, HTTPS only.
- Build/start scripts, `prisma migrate deploy`, safe seed command. Document
  migration order.
- /api/health readiness (DB check only; no secrets, identities or messages).
- A deployment script or pipeline (GitHub Actions or vercel/render config) that
  builds, runs migrations, and redeploys. Include failure recovery: rollback to
  the previous deploy, and what to do when a migration fails.
- DEPLOYMENT.md: prerequisites, variable names (no values), setup/migrate/seed
  commands, deploy and redeploy steps, health URL, demo account roles,
  verification steps including persistence after restart, demo data cleanup
  (db:reset-demo), free-tier limitations (sleep, cold start).
- README.md: setup, architecture and stack rationale, rules and how to
  configure them, privacy boundaries (pseudonymous not anonymous; no
  end-to-end encryption claim; message content can reveal identity; automated
  checks can miss attempts), known limitations, third-party services.
- List clearly everything I must do manually.
```

**Your checks**

- Follow `DEPLOYMENT.md` yourself, step by step, as if you were the reviewer.
- Merge the PR, deploy, run migrations and seed against production.
- Open the live HTTPS URL and `/api/health`.
- Redeploy once and confirm data persists.

**Merge:** squash and merge, then deploy from `main`.

---

## Feature 17. Live verification and submission pack

**Branch:** `docs/verification-pack` **Commit / PR title:** `docs: live verification report and submission pack`

**You do first**

- Have the live URL and all three demo logins ready. Use three separate browser profiles (admin, client, employee).

**Prompt**

```
Feature 17: Live verification and submission pack. Use the live HTTPS URL.

1. Run all 7 acceptance scenarios on the hosted app using separate sessions
   for admin, client and employee. Record result and evidence for each
   (screenshots or notes). Mark honestly anything incomplete.
2. Verify persistence after a redeploy or restart.
3. Verify /api/health reveals no secrets, identities or message content.
4. Produce docs/VERIFICATION_REPORT.md with a pass/fail table.
5. Write docs/WALKTHROUGH_SCRIPT.md: a 3 to 5 minute script following the
   scenarios in order, with timings.
6. Write docs/DESIGN_NOTE.md: short note on architecture, design choices,
   rules, known limitations and third-party services.
7. List what is missing against the brief's submission checklist.
```

**Your checks**

- Record the walkthrough video using the script.
- Share the live URL and three accounts privately with the reviewer.

**Merge:** squash and merge.

---

## Part 4. Final "verify everything" prompt

Run this on branch `chore/final-verification` after all features are merged and deployed. It checks the whole project against the brief, fix by fix.

```
You are a strict QA engineer and security reviewer. Verify the entire CCP
Studio Confidential Communication Portal against docs/BRIEF.md, using the live
URL if I provide it, otherwise the local app. Do not assume anything works:
test it. Do not change code unless a check fails; for each failure, fix it on
this branch, add a regression test, and re-run the check. Output a final report
with PASS / FAIL / PARTIAL for every line below plus evidence.

A. ACCESS CONTROL AND PRIVACY (30%)
1. All three roles can sign in; wrong password gives a generic error.
2. For every API route, list the auth check. Flag any route without one.
3. IDOR: while logged in as an unrelated user, request another project's
   messages, post to it, request another conversation, message and flag ID.
   Expect 404/403 each time.
4. Participant API responses (projects, messages, notifications, me): scan every
   JSON key and value for real name, email, phone, user IDs, other membership
   IDs, other projects, participant lists. None allowed.
5. Aliases differ for the same person across two projects.
6. Participant UIs show no online status, last seen, photos, or real names.
7. Removing a membership revokes access to REST and UI immediately.
8. Participant cannot open /admin or call /api/admin/*.
9. Sender spoofing via request body does not work.

B. CHAT AND BACKEND (25%)
10. Client and employee exchange messages; timestamps shown; history persists
    after reload.
11. States work: sending, delivered, failed, held for review; retry with the
    same clientMessageId creates one message only.
12. Text only; no attachment or call features exposed.
13. Required notice text is shown exactly as in the brief.
14. Health endpoint is safe; secrets absent from repo, logs and frontend bundle.
15. Input validation rejects empty, oversized and malformed input.
16. Messages and decisions survive restart/redeploy (live only).

C. MODERATION WORKFLOW (25%)
17. Contact sharing (phone, email, obfuscated email, @handle, external link) is
    HELD and never appears in recipient responses until approved.
18. Off-platform request flagged per configured action.
19. Pricing message creates an admin alert; normal discussion still delivers.
20. Abusive message handled per configured action.
21. Each flag shows project, alias, category, severity, timestamp, reason,
    matched rule, status, and conversation context.
22. Admin approves one, rejects one, dismisses one false positive, with notes.
    Sender is notified without identities.
23. Approval retry and concurrent double-click deliver the message exactly once.
24. Audit log records assignments, access changes, rule changes and decisions
    with actor, time and action.
25. Rule config: COMMERCIAL, OFF_PLATFORM, ABUSE switchable; CONTACT locked to
    HOLD; invalid regex rejected; changes apply immediately.

D. UI QUALITY (20%)
26. All five screens exist: Login, Projects/Inbox, Project Chat, Admin Projects
    & Assignment, Flag Review.
27. Loading, empty, error, access-denied and message-held states appear.
28. Responsive at 375px, 768px and 1280px with no page-level horizontal scroll.
29. The visual style matches docs/design-reference.png: muted dark charcoal
    surfaces, soft grey text, restrained green accent. Fail anything that looks
    neon: glowing shadows, gradients, saturated large green fills, bright
    borders.
30. Keyboard-only walkthrough works; focus visible; WCAG AA contrast;
    Lighthouse accessibility 95 or higher.

E. DEPLOYMENT AND DOCS
31. Live HTTPS URL works; cookies are Secure and HttpOnly.
32. Documented build, migrate, seed, deploy, redeploy, rollback steps actually
    work when followed literally.
33. README, DEPLOYMENT.md, .env.example, LIMITATIONS and design note exist and
    are accurate; they state: pseudonymous not anonymous, no end-to-end
    encryption, message content can reveal identity, automated checks can miss
    attempts, how to remove demo data.
34. No real personal data anywhere; demo data is fictional.

OUTPUT
Return a table: # | Check | PASS/FAIL/PARTIAL | Evidence | Fix applied.
Then a short list of remaining risks and anything incomplete, stated honestly.
Finish by following the Git rules: commit, push, open a PR, do not merge.
```

**Your checks after it runs**

- Read the table. Every FAIL or PARTIAL needs a fix or an honest note in the submission.
- Do three spot checks yourself: ID tampering with cURL, the held-message flow across two browsers, and the 375px mobile view.
- Merge the PR, redeploy, and record the final walkthrough.

---

## Part 5. Quick reference

**Branch order and merge order**

| # | Branch | Main output |
| --- | --- | --- |
| 1 | `feat/foundation` | App shell, theme, health, CI |
| 2 | `feat/database-schema` | Schema, migrations, seed |
| 3 | `feat/auth` | Login, sessions |
| 4 | `feat/authz-serializers` | Authorization, safe DTOs |
| 5 | `feat/admin-management` | Accounts, projects, assignments, audit |
| 6 | `feat/participant-inbox` | Projects inbox |
| 7 | `feat/chat-core` | Chat, history, retry |
| 8 | `feat/rule-engine` | Rules and tests |
| 9 | `feat/message-hold` | Hold logic, flags |
| 10 | `feat/flag-review` | Review queue, decisions |
| 11 | `feat/rules-audit-ui` | Rule config, audit view |
| 12 | `feat/notifications` | Alerts and notices |
| 13 | `feat/ui-polish` | Theme, responsive, a11y |
| 14 | `feat/security-hardening` | Security audit |
| 15 | `feat/acceptance-tests` | E2E tests |
| 16 | `feat/deployment-docs` | Deploy and docs |
| 17 | `docs/verification-pack` | Live verification |
| 18 | `chore/final-verification` | Final QA prompt |

**Habits that save you time**

- One feature, one branch, one PR. Never stack unmerged branches.
- Never merge with red CI.
- Check participant responses in DevTools yourself every time chat or flag code changes.
- If the agent builds beyond the feature: *"Revert anything outside Feature N and keep only what I asked."*
- If the UI drifts toward neon or heavy green: *"Match docs/design-reference.png: muted charcoal, soft grey text, green only on badges, primary buttons and active chips."*
- Keep `DATABASE_URL` for dev and production separate and never paste secrets into prompts.