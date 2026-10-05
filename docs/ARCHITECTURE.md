# CCP Confidential Communication Portal — Architecture

## 1. System Overview
The Confidential Communication Portal (CCP) is a text-based, high-security communication system designed for sensitive interactions. It strictly enforces participant anonymity, multi-tenant project isolation, server-side authorization, and message compliance review.

## 2. Technology Stack
- **Framework**: Next.js (App Router) + TypeScript
- **Styling**: Tailwind CSS with custom WhatsApp Web muted dark tokens (`globals.css`)
- **Database & ORM**: PostgreSQL + Prisma ORM
- **Validation**: Zod (strict schema validation at API boundaries)
- **Authentication**: Argon2 for password hashing, server-side cookie sessions
- **Real-time updates**: Polling for updates (no WebSockets)
- **Testing**: Vitest for unit & integration tests

## 3. Directory Layout
```
/
├── .github/workflows/    # CI/CD pipelines (install, lint, typecheck, test, build)
├── docs/                 # Architecture, specifications, and project documentation
├── prisma/               # Database schema and migration files
├── scripts/              # Database seeding and demo reset scripts
├── src/
│   ├── app/              # Next.js App Router (pages and API routes)
│   │   ├── api/health/   # Liveness and database connectivity endpoint
│   │   ├── globals.css   # WhatsApp Web dark theme CSS custom properties
│   │   └── page.tsx      # Main application entry point
│   ├── components/
│   │   ├── layout/       # Three-zone shell (icon rail, list panel, main pane)
│   │   └── ui/           # Muted design system components (Button, Input, Badge, etc.)
│   └── lib/
│       ├── audit/        # Audit logging (safe metadata, no credentials or message bodies)
│       ├── auth/         # Password hashing & session lifecycle management
│       ├── authz/        # Server-side project and conversation authorization guards
│       ├── db.ts         # Prisma client singleton
│       ├── rules/        # Content policy & message rules evaluation
│       └── serializers/  # Participant-facing allow-list serializers (zero leakage)
└── tests/                # Automated test suites
```

## 4. Key Invariants & Security Principles
1. **Server-Side Authorization**: Hiding UI controls is never enough. Every project, conversation, and message query verifies the authenticated session and project membership.
2. **Strict Allow-List Serialization**: Participant-facing APIs must never expose real names, emails, phone numbers, avatars, raw user IDs, or other participants' membership IDs.
3. **Zero Secrets in Frontend or Logs**: Credentials, session secrets, and message bodies are never logged or exposed in client bundles or error stacks.
4. **Resilient Liveness & Error Handling**: Health and API endpoints never leak connection strings or database internals.
