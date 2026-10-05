# CCP Confidential Communication Portal — Security Conventions & Audit Matrix

## 1. Golden Rule: Server-Side Authorization First
Hiding UI controls is never an authorization strategy. Every single API route handler and server action MUST explicitly verify authentication and authorization before performing any business logic or database query.

```typescript
// Required pattern on every protected route:
import { requireUser, requireRole, assertProjectAccess } from "@/lib/authz";

export async function GET(request: NextRequest) {
  // 1. Authenticate session
  const user = await requireUser(request);

  // 2. Authorize role (if admin-only)
  // await requireRole(UserRole.ADMIN, request);

  // 3. Authorize project access (for chat/project endpoints)
  // const membership = await assertProjectAccess(user.id, projectId);

  // 4. Continue with strictly scoped logic
}
```

---

## 2. API Authorization & Audit Matrix

| Route | Method | Auth / Authorization Check | Response on Unauthorized |
|---|---|---|---|
| `/api/health` | GET | Public DB ping only (no secrets/data) | N/A |
| `/api/auth/login` | POST | Public login; Zod validation; Argon2id; rate limited (5/15m) | 400 / 401 / 429 |
| `/api/auth/logout` | POST | `requireUser(request)` + session deletion | 401 |
| `/api/auth/me` | GET | `requireUser(request)` | 401 |
| `/api/projects` | GET | `requireUser(request)` (scoped to active memberships) | 401 |
| `/api/projects/[projectId]/messages` | GET | `requireProjectMember(projectId, request)` | 404 (Anti-enumeration) |
| `/api/projects/[projectId]/messages` | POST | `requireProjectMember(projectId, request)` + rate limit (30/min) | 404 (Anti-enumeration) |
| `/api/projects/[projectId]/read` | POST | `requireProjectMember(projectId, request)` | 404 (Anti-enumeration) |
| `/api/notifications` | GET | `requireUser(request)` (scoped to `recipientUserId`) | 401 |
| `/api/notifications/read` | POST | `requireUser(request)` (scoped to `recipientUserId`) | 401 |
| `/api/admin/users` | GET, POST | `requireRole(UserRole.ADMIN, request)` | 401 / 403 |
| `/api/admin/users/[id]` | GET | `requireRole(UserRole.ADMIN, request)` | 401 / 403 |
| `/api/admin/users/[id]/toggle-active` | PATCH | `requireRole(UserRole.ADMIN, request)` | 401 / 403 |
| `/api/admin/projects` | GET, POST | `requireRole(UserRole.ADMIN, request)` | 401 / 403 |
| `/api/admin/projects/[id]` | GET | `requireRole(UserRole.ADMIN, request)` | 401 / 403 |
| `/api/admin/projects/[id]/memberships` | POST, PATCH | `requireRole(UserRole.ADMIN, request)` | 401 / 403 |
| `/api/admin/flags` | GET | `requireRole(UserRole.ADMIN, request)` | 401 / 403 |
| `/api/admin/flags/[id]` | GET | `requireRole(UserRole.ADMIN, request)` | 401 / 403 |
| `/api/admin/flags/[id]/decision` | POST | `requireRole(UserRole.ADMIN, request)` | 401 / 403 |
| `/api/admin/rules` | GET, POST | `requireRole(UserRole.ADMIN, request)` | 401 / 403 |
| `/api/admin/rules/[id]` | PATCH | `requireRole(UserRole.ADMIN, request)` | 401 / 403 |
| `/api/admin/rules/test` | POST | `requireRole(UserRole.ADMIN, request)` | 401 / 403 |
| `/api/admin/audit` | GET | `requireRole(UserRole.ADMIN, request)` | 401 / 403 |
| `/api/admin/notifications/unread-count` | GET | `requireRole(UserRole.ADMIN, request)` | 401 / 403 |

---

## 3. Anti-Enumeration & IDOR Protection (404 over 403)
When a user attempts to access a project, conversation, message, or flag to which they do not have active membership:
- The server MUST respond with **`404 Not Found`** rather than `403 Forbidden`.
- This ensures an attacker cannot determine whether an entity ID exists in the database.
- Tested and verified in `tests/security-idor.test.ts`.

---

## 4. Privacy-Safe Allow-List Serialization
Participant-facing API responses MUST never use `...object` spreading combined with field deletion (`delete obj.email`).
Instead, use the strict allow-list serializers defined in `src/lib/serializers.ts`:
- `serializeParticipantMessage`: returns only `{ id, senderAlias, body, createdAt, deliveredAt, status, isMine }`.
- `serializeParticipantProject`: returns only `{ id, title, myAlias, otherAlias, lastMessagePreview, lastActivityAt, unreadCount }`.
- `serializeNotification`: returns only `{ id, type, text, readAt, createdAt }`.
- Under NO circumstance should a participant response contain real names, personal email addresses, phone numbers, avatars, raw user IDs, or other participants' membership IDs.
- Verified by recursive key scanning in `tests/security-idor.test.ts`.

---

## 5. Session & Credential Safeguards
- Passwords MUST be hashed using **Argon2id**.
- Sessions are 32-byte cryptographically random tokens stored in the database as SHA-256 hashes (`tokenHash`).
- Session cookies MUST be `HttpOnly`, `SameSite=Lax`, and `Secure` in production.
- Rate limiting enforces:
  - Authentication: temporary lockout after 5 consecutive failed login attempts per `(IP, Email)` pair.
  - Message Sending: maximum 30 messages per minute per user.
- Zero credential logging: passwords, plain session tokens, and message bodies must never appear in `console.log` or error logs.

---

## 6. HTTP Security Headers
Configured in `next.config.ts` on all routes:
- **`Content-Security-Policy`**: `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self';`
- **`X-Frame-Options`**: `DENY` (blocks clickjacking)
- **`X-Content-Type-Options`**: `nosniff` (blocks MIME-type sniffing)
- **`Referrer-Policy`**: `strict-origin-when-cross-origin`
- **`Permissions-Policy`**: `camera=(), microphone=(), geolocation=(), interest-cohort=()`
- **`Strict-Transport-Security`**: `max-age=63072000; includeSubDomains; preload`

---

## 7. CSRF & Origin Validation
All state-mutating requests (`POST`, `PATCH`, `DELETE`) validate the incoming `Origin` and `Referer` headers against the server host (`src/lib/auth/csrf.ts`). Mismatched origins return HTTP 403 Forbidden.

---

## 8. Dependency Security Audit (`npm audit`)
- Runtime application dependencies (`argon2`, `@prisma/client`, `zod`, `next`, `lucide-react`) are vetted and secure.
- Build-time and test-time tooling advisories:
  - `braces` / `chokidar`: Transitive dependency of Tailwind CSS 3 / ESLint globbing. Mitigated by isolated developer-only invocation.
  - `postcss`: Transitive bundler dependency within Next.js compiler. Mitigated by production asset minimization and server-side rendering isolation.
  - `esbuild` / `vite`: Vite and Vitest test runner dev server. Dev/CI only; not exposed in production web builds.
