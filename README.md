# CCP Studio — Confidential Communication Portal

A secure, pseudonymous web portal designed for high-stakes client-contractor collaboration. Built to enforce confidentiality, prevent off-platform disintermediation, and intercept unauthorized contact exchanges before delivery.

The visual design is inspired by the calm, muted dark theme of WhatsApp Web (quiet charcoal surfaces, soft grey typography, restrained green accent, zero neon/glow).

---

## Key Features

1. **Strict Pseudonymity & Zero Identity Leakage**:
   - Participants interact solely through project-scoped unique aliases (e.g. *Client Alpha*, *Project Specialist B*).
   - Real names, email addresses, phone numbers, and raw user IDs are stripped by server-side allow-list serializers before payloads leave the server.
   - Distinct aliases across different projects prevent cross-project correlation.

2. **Automated Content Moderation Engine**:
   - Pre-delivery interception using Unicode normalisation (NFKC), zero-width stripping, and obfuscation detection.
   - Four policy categories:
     - `CONTACT`: Phone numbers, email addresses, obfuscated emails ("name at gmail dot com"), social handles, and external messenger links. Locked to **HOLD**.
     - `OFF_PLATFORM`: Solicitation phrases ("let's talk on WhatsApp", "move to Telegram"). Configurable (default **HOLD**).
     - `COMMERCIAL`: Pricing negotiations, invoices, quotes, currency amounts. Configurable (default **ALLOW_FLAG**).
     - `ABUSE`: Profanity and threatening language. Configurable (default **ALLOW_FLAG**).
   - Precedence: `HOLD` always supersedes `ALLOW_FLAG`.

3. **Administrative Queue & Safe Idempotent Decisions**:
   - Two-pane review queue with live unread badge and background polling.
   - Contextual message audit: admins see surrounding conversation context (10 messages before/after).
   - Idempotent decision actions (`APPROVE`, `REJECT`, `DISMISS`): row locks prevent duplicate deliveries or double clicks.
   - Sender-only privacy notices ("Your held message was approved by CCP Studio").

4. **Security Hardened by Default**:
   - **Anti-Enumeration (404 over 403)**: Non-members attempting to access projects, messages, or conversations receive HTTP 404 to prevent ID enumeration.
   - **Argon2id Hashing & Hashed Sessions**: Passwords hashed with Argon2id; session tokens stored in DB as SHA-256 hashes (`tokenHash`).
   - **Rate Limiting**: 5 attempts per 15 minutes for authentication; 30 messages per minute for chat sending.
   - **Strict CSP & Security Headers**: Full CSP, frame-ancestors 'none', X-Frame-Options DENY, X-Content-Type-Options nosniff, HSTS.
   - **CSRF & Origin Validation**: All mutating requests validate `Origin` and `Referer` headers.

---

## Technology Stack Rationale

| Layer | Technology | Rationale |
|---|---|---|
| **Framework** | Next.js 15 (App Router) | Unified TypeScript full-stack deployment, edge middleware session gating, robust server actions and route handlers. |
| **Styling** | Tailwind CSS + CSS Variables | 15 curated design tokens matching WhatsApp Web muted dark mode (`--bg-app: #0b0c0c`, `--accent: #21c063`). Zero neon, zero bright gradients. |
| **Database** | PostgreSQL (Neon Serverless) | ACID transactions for atomic message + flag creation; connection pooling; schema integrity with foreign keys. |
| **ORM** | Prisma ORM | Strict compile-time typing, migrations, relation management, and row-level updates. |
| **Authentication** | Argon2id + Cookie Sessions | Memory-hard password hashing; 32-byte cryptographically secure tokens in `HttpOnly`, `SameSite=Lax` cookies. |
| **Validation** | Zod | Runtime schema validation on every single API endpoint. |
| **Testing** | Vitest | High-speed unit, integration, IDOR, and acceptance test execution. |

---

## Privacy Boundaries & Honest Security Claims

> [!IMPORTANT]
> **Pseudonymous, NOT Anonymous**:
> Users are identified to each other by contextual project aliases. However, CCP Studio administrators maintain real identity records for contractual compliance and project governance.

> [!NOTE]
> **No End-to-End Encryption Claim**:
> All communication is encrypted in transit (TLS 1.3/HTTPS) and securely stored in PostgreSQL. However, this system **does NOT implement end-to-end encryption (E2EE)**. Portal administrators inspect flagged messages to ensure compliance with anti-disintermediation and content policies.

> [!WARNING]
> **Message Content Can Reveal Identity**:
> If a participant manually writes contextual personal details (e.g. "I'm the director who spoke at the 2025 Austin summit"), automated filters cannot infer the real-world connection. Participants are advised to communicate strictly within the scope of work.

> [!CAUTION]
> **Automated Checks Can Miss Creative Obfuscation**:
> While the rule engine normalizes Unicode and catches common spacing and phonetic obfuscations, determined users may attempt novel bypasses (e.g., spelled-out foreign words, stenographic code words). All flagged items are subject to human review. See [docs/LIMITATIONS.md](docs/LIMITATIONS.md) for a comprehensive list.

---

## Local Setup & Development

### 1. Clone & Install
```bash
git clone <REPO_URL>
cd "Chat Portal"
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in:
```env
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"
SESSION_SECRET="your-32-byte-base64-secret"
APP_URL="http://localhost:3000"
NODE_ENV="development"
DEMO_PASSWORD="DemoPassword123!"
```

### 3. Migrate and Seed
```bash
npx prisma generate
npm run db:migrate
npm run db:seed
```

### 4. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

---

## Seeded Demo Credentials

| Role | Email | Password | Scope |
|---|---|---|---|
| **Admin** | `admin@demo.ccp.test` | `DemoPassword123!` | `/admin`, `/admin/flags`, `/admin/rules`, `/admin/audit` |
| **Client 1** | `client1@demo.ccp.test` | `DemoPassword123!` | Project Alpha (*Client A*) |
| **Employee 1** | `employee1@demo.ccp.test` | `DemoPassword123!` | Project Alpha (*Project Specialist B*) |
| **Client 2** | `client2@demo.ccp.test` | `DemoPassword123!` | Project Beta (*Client C*) |
| **Employee 2** | `employee2@demo.ccp.test` | `DemoPassword123!` | Project Beta (*Project Specialist D*) |

---

## Running Automated Tests

```bash
# Run all test suites
npm test

# Run the 7 end-to-end acceptance scenarios
npm run test:acceptance

# Run security and IDOR audit test suite
npx vitest run tests/security-idor.test.ts

# Run rule engine test suite (73 test cases)
npx vitest run tests/rule-engine.test.ts
```

---

## Third-Party Services & Dependencies

- **Neon / Supabase**: Serverless PostgreSQL database with connection pooling.
- **Argon2**: Native binary implementation for Argon2id password hashing.
- **Lucide React**: Muted, accessible outline icon library.
- **Vercel / Render**: Production hosting platforms.
