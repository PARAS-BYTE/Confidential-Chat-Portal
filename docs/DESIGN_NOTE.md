# CCP Studio — Design & Architectural Note

This document summarizes the core architectural principles, trade-offs, and design choices behind the Confidential Communication Portal (CCP).

---

## 1. Architectural Principles

### Defense-in-Depth & Anti-Enumeration
- **Server-Side Authorization Everywhere**: Client-side component hiding is strictly a presentation convenience. Every route validates session token validity, role requirements, and project membership status.
- **Anti-Enumeration via HTTP 404**: Unauthorized requests targeting projects, conversations, or messages to which the caller does not belong return `404 Not Found` rather than `403 Forbidden`. Attackers cannot discover existing IDs through response differentiation.
- **Strict Allow-List Serialization**: Database model objects are never spread or filtered using field deletion (`delete user.email`). Serializers explicitly construct DTOs containing only permitted properties.

### Pre-Delivery Quarantine vs. Post-Delivery Flagging
- In traditional chat applications, moderation operates asynchronously post-delivery.
- For confidential client-contractor platforms, contact sharing cannot be recalled once delivered to the counterparty. CCP Studio evaluates moderation rules **synchronously within the send transaction**. If a message matches a `HOLD` rule, it is quarantined in the database and never dispatched to recipient endpoints.

---

## 2. Design System & Aesthetics

- **Reference**: WhatsApp Web Dark Mode.
- **Color Discipline**:
  - Backgrounds: Calm charcoal hierarchy (`#0b0c0c` app base, `#161717` panels, `#1d1f1f` cards, `#292a2a` input fields).
  - Accents: Restrained green (`#21c063`) restricted to unread badges, primary call-to-action buttons, active filter chips, and read ticks.
  - Zero neon, zero glowing box-shadows, zero gradients, and zero glassmorphism.
- **Layout Structure**: Three-zone desktop layout (Icon rail, list panel, active pane) adapting to single-column full-screen chat with back navigation on mobile viewports down to 375px.

---

## 3. Moderation Rule Engine Architecture

- **Normalization Pipeline**:
  1. Unicode NFKC normalisation (unifying full-width, circled, and mathematical alphanumeric glyphs).
  2. Removal of invisible and zero-width characters (`\u200B`, `\u200C`, `\uFEFF`, etc.).
  3. Whitespace collapsing and delimiter stripping.
  4. Obfuscation expansion (e.g. converting `" at "` to `"@"`, `" dot "` to `"."`).
- **Rule Categorization**:
  - `CONTACT`: Phone numbers, email addresses, social handles, external URLs. Locked to `HOLD`.
  - `OFF_PLATFORM`: Explicit solicitation to bypass the portal ("call me", "move to Telegram"). Defaults to `HOLD`.
  - `COMMERCIAL`: Price quotes, invoices, fee discussions. Defaults to `ALLOW_FLAG`.
  - `ABUSE`: Profanity and threatening language. Defaults to `ALLOW_FLAG`.
- **Precedence Rule**: `HOLD` always supersedes `ALLOW_FLAG`.

---

## 4. Known Limitations & Edge Cases

- **Foreign Spelled-Out Numerals**: Spelled-out numbers in non-English languages are caught primarily by contextual triggers (`OFF_PLATFORM`) rather than digit reconstruction.
- **Strict Text-Only Invariant**: File attachments, voice notes, and images are intentionally omitted from the protocol layer to eliminate image-based contact exchange.
- Detailed analysis is documented in [docs/LIMITATIONS.md](docs/LIMITATIONS.md).

---

## 5. Third-Party Services & Dependencies

- **Neon PostgreSQL**: Serverless PostgreSQL with connection pooling.
- **Argon2**: Cryptographically verified password hashing implementation.
- **Next.js 15 App Router**: Full-stack framework handling SSR, API route handlers, and middleware.
- **Prisma ORM**: Type-safe database queries and automated schema migrations.
