# CCP Confidential Communication Portal — Security Conventions

## 1. Golden Rule: Server-Side Authorization First
Hiding UI controls is never an authorization strategy. Every single API route handler and server action MUST explicitly verify authentication and authorization before performing any business logic or database query.

```typescript
// Required pattern on every protected route:
import { requireUser, requireRole, assertProjectAccess } from "@/lib/authz";

export async function GET(request: NextRequest) {
  // 1. Authenticate session
  const user = await requireUser();

  // 2. Authorize role (if admin-only)
  // await requireRole("ADMIN");

  // 3. Authorize project access (for chat/project endpoints)
  // const membership = await assertProjectAccess(user.id, projectId);

  // 4. Continue with strictly scoped logic
}
```

## 2. Exempt Public Routes
Only two endpoints in `/src/app/api` are exempt from `requireUser` / auth checks:
- `GET /api/health` — liveness check (must never expose secrets or errors)
- `POST /api/auth/login` — authentication entry point (rate-limited, generic error)

All other route files under `/src/app/api` MUST call an authorization helper (`requireUser`, `requireRole`, `assertProjectAccess`, `getCurrentUser`, or `validateSessionToken`).

## 3. Anti-Enumeration & IDOR Protection (404 over 403)
When a user attempts to access a project, conversation, message, or flag to which they do not have active membership:
- The server MUST respond with **`404 Not Found`** rather than `403 Forbidden`.
- This ensures an attacker cannot determine whether an entity ID exists in the database.

## 4. Privacy-Safe Allow-List Serialization
Participant-facing API responses MUST never use `...object` spreading combined with field deletion (`delete obj.email`).
Instead, use the strict allow-list serializers defined in `src/lib/serializers.ts`:
- `serializeParticipantMessage`: returns only `{ id, senderAlias, body, createdAt, deliveredAt, status, isMine }`.
- `serializeParticipantProject`: returns only `{ id, title, myAlias, otherAlias, lastMessagePreview, lastActivityAt, unreadCount }`.
- Under NO circumstance should a participant response contain real names, personal email addresses, phone numbers, avatars, raw user IDs, or other participants' membership IDs.

## 5. Session & Credential Safeguards
- Passwords MUST be hashed using **Argon2id**.
- Sessions are 32-byte cryptographically random tokens stored in the database as SHA-256 hashes (`tokenHash`).
- Session cookies MUST be `HttpOnly`, `SameSite=Lax`, and `Secure` in production.
- Rate limiting enforces a temporary lockout after 5 consecutive failed login attempts per `(IP, Email)` pair.
- Zero credential logging: passwords, plain session tokens, and message bodies must never appear in `console.log` or error logs.
