# CCP Confidential Communication Portal — Moderation Engine Limitations & Edge Cases

## Overview
The CCP Studio portal implements a deterministic, multi-stage rule engine designed to prevent off-platform disintermediation, protect confidential identities, and intercept prohibited communications before delivery.

While the engine handles standard formats, unicode variations, zero-width strippings, and common obfuscations (such as `"name at gmail dot com"` or spaced digits `"9 8 7 6 5 4 3 2 1 0"`), deterministic text processing has structural boundaries. This document outlines known limitations, trade-offs, and design boundaries.

---

## 1. Known Evasion Techniques & Detection Misses

### Spelled-Out Numbers and Multilingual Homophones
- **Limitation:** Numbers written phonetically in natural language words (e.g., *"nine eight seven six..."*, *"zero six twelve..."*, or multilingual equivalents like *"neuf huit sept..."*) are not parsed into numerical digits.
- **Mitigation:** Contextual trigger phrases like *"call me"*, *"my number is"*, or *"reach out on"* are caught by the `OFF_PLATFORM` detection rules regardless of digit representation.

### Image and Document Attachments
- **Limitation:** CCP Studio is strictly a text-only communication portal. No file attachments, image uploads, or voice clips are permitted or supported by design.
- **Mitigation:** Attack vectors relying on screenshots or handwritten phone numbers are completely eliminated at the protocol layer because the application does not accept multipart file uploads.

### Creative Delimiters and Code Words
- **Limitation:** Extreme letter-level delimiter insertion (e.g., *"w.h.a.t.s.a.p.p"* or coded slang like *"the green chat app"*) may bypass keyword matching if not matched by standard normalisation.
- **Mitigation:** Administrators can add dynamic regex patterns and keywords via the `/admin/rules` dashboard without restarting the service or redeploying code.

### Base64 and Hexadecimal Encodings
- **Limitation:** Deliberately encoded strings (e.g., Base64 strings representing email addresses or phone numbers) will not trigger regex checks unless recognized as alphanumeric patterns.
- **Mitigation:** Unusually long alphanumeric strings without spaces can be flagged by custom administrator patterns.

---

## 2. Potential False Positives & Mitigations

### Legitimate Technical & Architectural Numbers
- **Examples:**
  - *"We are releasing version 2.0.1 on Tuesday."*
  - *"Please meet in conference room 4021 at 3 pm."*
  - *"Port 8080 is configured for the health probe."*
- **Mitigation:** The phone detection rule requires a minimum sequence of 7 to 15 digits (standard international and domestic telephone numbering plans). Isolated small integers (e.g., 2, 3, 2026) are not flagged as phone numbers.

### Deadlines and Project Estimates
- **Examples:**
  - *"The deadline is Friday afternoon."*
  - *"The cost of delays is too high for our sprint."*
- **Mitigation:** The `COMMERCIAL` category defaults to `ALLOW_FLAG` rather than `HOLD`. This ensures ordinary conversational discussions with terms like "cost" or "rates" continue uninterrupted without holding messages from the recipient, while alerting administrators in the flag review queue.

---

## 3. Security & Operational Guarantees

1. **ReDoS Immunity:**
   All user-supplied patterns in the administrator dashboard are validated before persistence via `validateRegex()`. Nested quantifiers (e.g., `(a+)+`) are strictly rejected.
2. **Deterministic Hold Priority:**
   `HOLD` action strictly supersedes `ALLOW_FLAG`. If a message triggers both a commercial keyword and a phone number, the message is immediately held and not delivered.
3. **Atomic Transactions:**
   Message creation, flag generation, and administrator notifications are executed inside a single database transaction, ensuring no partial or corrupted states exist.
