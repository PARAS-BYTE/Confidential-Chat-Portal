# Confidential Communication Portal (CCP) — Deployment Guide

This guide describes the complete setup, migration, deployment, verification, and rollback process for the CCP Studio portal.

---

## 1. Prerequisites

- **Node.js**: v20.x or higher
- **PostgreSQL**: PostgreSQL 15+ database (e.g. Neon Serverless Postgres, Supabase, or self-hosted)
  - Recommended: Two separate connection strings (one for development/staging, one for production).
- **Hosting Platform**: Vercel, Render, Railway, or any Node.js container runner.

---

## 2. Environment Variables Configuration

Set these environment variables in your hosting dashboard (e.g. Vercel Project Settings → Environment Variables, or Render Environment):

| Variable Name | Purpose | Example / Format | Required |
|---|---|---|---|
| `DATABASE_URL` | PostgreSQL pooled connection string | `postgresql://user:pass@host/db?sslmode=require` | Yes |
| `SESSION_SECRET` | 32+ byte cryptographic key for sessions | `openssl rand -base64 32` | Yes |
| `APP_URL` | Fully qualified canonical public HTTPS domain | `https://ccp-portal.vercel.app` | Yes |
| `NODE_ENV` | Environment identifier | `production` | Yes |
| `DEMO_PASSWORD` | Shared password for seeded demo accounts | Strong alphanumeric password | Recommended |

> **Security Rule**: Never commit secrets or connection strings to git. Use `.env.example` as a template for local development.

---

## 3. Database Migration & Initialization Order

Execute the database lifecycle scripts in this exact sequence:

```bash
# 1. Generate Prisma Client bindings
npx prisma generate

# 2. Deploy pending migrations safely to production (non-destructive)
npx prisma migrate deploy

# 3. Seed initial demo users, projects, memberships, and baseline moderation rules
npm run db:seed
```

### Migration Failure Recovery
If `prisma migrate deploy` fails due to schema drift or connectivity errors:
1. Review migration logs: `npx prisma migrate status`.
2. To rollback an unapplied migration: Resolve the conflict in migration SQL or run `npx prisma migrate resolve --rolled-back <migration_name>`.
3. Re-run `npx prisma migrate deploy`.

---

## 4. Platform Deployment Instructions

### Option A: Vercel Deployment (Recommended)
1. **Import Repository**: Connect your GitHub repository to Vercel.
2. **Framework Preset**: Next.js (automatically detected).
3. **Environment Variables**: Add `DATABASE_URL`, `SESSION_SECRET`, `APP_URL`, `DEMO_PASSWORD`, `NODE_ENV=production`.
4. **Build Command**: `npx prisma generate && npm run build`
5. **Deploy**: Click Deploy.
6. **Post-deploy DB Seed**: In your terminal with production `DATABASE_URL` set:
   ```bash
   npx prisma migrate deploy
   npm run db:seed
   ```

### Option B: Render Deployment
1. **Blueprints**: Render automatically reads `render.yaml` located in the root.
2. **Build Command**: `npm install && npx prisma generate && npx prisma migrate deploy && npm run build`
3. **Start Command**: `npm run start`
4. **Health Check Path**: `/api/health`

---

## 5. Health Check & Liveness Verification

After deployment, verify the system status endpoint:
- **URL**: `https://<YOUR_APP_DOMAIN>/api/health`
- **Expected Response (HTTP 200)**:
  ```json
  {
    "status": "ok",
    "db": "up"
  }
  ```
- **Security Invariant**: This endpoint executes a minimal `SELECT 1` query and never exposes database credentials, table schemas, stack traces, or identity data.

---

## 6. Seeded Demo Accounts & Credentials

Running `npm run db:seed` establishes the following accounts:

| Role | Email | Default Password | Workspace Scope |
|---|---|---|---|
| **Administrator** | `admin@demo.ccp.test` | Value of `DEMO_PASSWORD` (or `DemoPassword123!`) | Global Admin Console (`/admin`, `/admin/flags`, `/admin/rules`, `/admin/audit`) |
| **Client 1** | `client1@demo.ccp.test` | Value of `DEMO_PASSWORD` | Project Alpha (Alias: *Client A*) |
| **Employee 1** | `employee1@demo.ccp.test` | Value of `DEMO_PASSWORD` | Project Alpha (Alias: *Project Specialist B*) |
| **Client 2** | `client2@demo.ccp.test` | Value of `DEMO_PASSWORD` | Project Beta (Alias: *Client C*) |
| **Employee 2** | `employee2@demo.ccp.test` | Value of `DEMO_PASSWORD` | Project Beta (Alias: *Project Specialist D*) |

---

## 7. Post-Deployment Verification Steps

1. **Sign In**:
   - Log in as `client1@demo.ccp.test` at `/login`.
   - Verify redirection to `/projects`.
   - Confirm only "Project Alpha" is visible.
2. **Send Message & Verify Pseudonymity**:
   - Send: "Hello, reviewing our project deliverables."
   - Confirm sender display is "You" and other participant is "Project Specialist B".
   - Confirm no real names, emails, or user IDs appear in Network payload.
3. **Test Content Moderation (HOLD)**:
   - Send: "Call my phone: 415-555-0199".
   - Confirm sender bubble shows amber outline with "Held for review. An administrator will check this message."
   - Log in as `employee1@demo.ccp.test` in an incognito window: verify the held message does NOT appear in their chat.
4. **Test Flag Queue**:
   - Log in as `admin@demo.ccp.test`.
   - Open `/admin/flags`.
   - Confirm the held message is listed with matched rule, reason, and project context.
   - Click "Approve message".
   - Confirm employee now sees the message delivered in Project Alpha.
5. **Verify Persistence Across Restart**:
   - Restart the server instance or trigger a redeploy in Vercel/Render.
   - Refresh the client chat window: verify messages and read states persist intact.

---

## 8. Demo Data Reset

To reset or purge demo data without affecting system tables or non-demo accounts:
```bash
npm run db:reset-demo
```
This selectively purges users with `@demo.ccp.test` email addresses and demo project scopes ("Project Alpha", "Project Beta") and re-seeds clean fixtures.

---

## 9. Free-Tier Cloud Platform Considerations

- **Database Connection Pooling**: Neon serverless Postgres suspends compute during inactivity. The Prisma connection uses Neon pooled connection strings (`-pooler`) to prevent connection exhaustion.
- **Cold Starts**: On free tiers, initial requests after inactivity may take 1-3 seconds while compute wakes up.
- **Client Polling**: Chat message polling is optimized at 3.5-second intervals and automatically pauses when the browser tab is hidden (`document.visibilityState === "hidden"`), preventing unnecessary background invocations.
