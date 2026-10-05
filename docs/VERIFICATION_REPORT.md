# CCP Studio — Live Verification Report

This document records the empirical verification and evidence for all 7 acceptance scenarios, persistence readiness, and security endpoints of the Confidential Communication Portal (CCP).

---

## 1. Acceptance Scenarios Verification Table

| Scenario # | Acceptance Scenario | Status | Verified Evidence & Behavior |
|---|---|---|---|
| **Scenario 1** | **Client & Employee Exchange Ordinary Messages** | **PASS** | Client and employee exchanged alias-only messages in *Project Alpha* ("Draft review is ready for your feedback." / "Thank you. Reviewing now."). Displayed sender as "You" / "Project Specialist B". Messages persisted across page reload and re-query. |
| **Scenario 2** | **IDOR & Cross-Project Isolation** | **PASS** | An unrelated user authenticated in Project Beta attempted to: (a) fetch Project Alpha messages, (b) post to Project Alpha, (c) mark Project Alpha read. All requests returned **HTTP 404 Not Found** (anti-enumeration invariant upheld). |
| **Scenario 3** | **Zero Identity Leakage & Distinct Project Aliases** | **PASS** | Serializer responses for `/api/projects`, `/api/projects/[id]/messages`, and `/api/notifications` recursively scanned. Strictly zero forbidden keys (`realName`, `email`, `phone`, `userId`, `senderMembershipId`). The same client in two projects possesses distinct aliases (*Client Alpha* vs. *Research Sponsor Z*). |
| **Scenario 4** | **Contact-Sharing Interception (HOLD)** | **PASS** | Client sent a phone number (`415-555-8901`). Evaluated server-side before delivery. Message assigned `status: HELD`. Sender bubble displayed amber outline and notice "Held for review". Recipient messages API completely excluded the held message; unread count remained 0. |
| **Scenario 5** | **Pricing Flag with Uninterrupted Delivery** | **PASS** | Client sent a message containing pricing terms (`$15,000 quote`). Status assigned `DELIVERED`. `Flag` record generated in database with category `COMMERCIAL`. Admin alert created (`FLAG_ALERT`). Counterpart employee received the message immediately without disruption. |
| **Scenario 6** | **Admin Review & Decision Audit Trail** | **PASS** | Administrator opened `/admin/flags`: (1) Approved held message 1 → delivered to recipient with timestamp, (2) Rejected held message 2 → marked `REJECTED`, (3) Dismissed flag 3 as false positive → flag marked `DISMISSED`. All three decisions written to `AuditEvent` table with actor, timestamp, and review notes. |
| **Scenario 7** | **Access Revocation & Decision Idempotency** | **PASS** | (a) Setting membership to `REMOVED` instantly revoked access; subsequent message queries returned HTTP 404. (b) Re-submitting an approval decision for an already-approved flag returned `alreadyDecided: true` with zero duplicate messages delivered. |

---

## 2. Server Persistence & Restart Verification

- **Procedure**: Simulated service restart / container redeployment.
- **Verification**:
  - PostgreSQL records (Users, Projects, Memberships, Conversations, Messages, ReadStates, Flags, AuditEvents) persisted without loss.
  - Active session tokens stored in PostgreSQL (`Session` model with SHA-256 hashed token) remained valid until expiration.
  - Unread indicators accurately re-computed from `ReadState` timestamp relative to delivered message creation timestamps.

---

## 3. Health & Readiness Probe Safety Audit

- **Endpoint**: `GET /api/health`
- **Output**:
  ```json
  {
    "status": "ok",
    "db": "up"
  }
  ```
- **Security Check**:
  - No database connection string or credentials revealed.
  - No user identities, table counts, or internal error traces exposed on database failure (`status: 503` with `{ status: "ok", db: "down" }`).

---

## 4. Submission Checklist Status

- [x] Full-stack single deployment using Next.js App Router, TypeScript, Tailwind CSS, Prisma, PostgreSQL.
- [x] Calm, muted dark mode strictly adhering to WhatsApp Web visual reference (`#0b0c0c` app bg, `#161717` panel bg, `#21c063` restrained accent, zero neon).
- [x] Pre-delivery moderation rule engine with Unicode normalisation and ReDoS protection.
- [x] Admin flag review dashboard with 2-pane context inspection and idempotent decisions.
- [x] Comprehensive test suites (Health, Schema, Auth, Admin, Chat Core, Rule Engine, Hold Logic, Flag Review, Rules/Audit, Notifications, UI Polish, IDOR & Security, Acceptance).
- [x] Deployment documentation (`DEPLOYMENT.md`), user manual (`README.md`), and engine limitations (`docs/LIMITATIONS.md`).
