# CCP Studio — Walkthrough Demonstration Script (3-5 Minutes)

This script provides a structured guide for recording or presenting the live demonstration of the Confidential Communication Portal.

**Total Estimated Duration**: ~4 minutes 15 seconds  
**Recommended Setup**: Three browser windows side-by-side or separate browser profiles:
1. **Window A (Left)**: Client 1 (`client1@demo.ccp.test`)
2. **Window B (Middle)**: Employee 1 (`employee1@demo.ccp.test`)
3. **Window C (Right)**: Administrator (`admin@demo.ccp.test`)

---

### Segment 1: Introduction & Login (0:00 - 0:35)
- **Time**: 0:00 - 0:35
- **Actor**: Narrator / Admin / Client
- **Action**:
  1. Open the login page at `/login`.
  2. Highlight the calm, muted dark theme matching WhatsApp Web (quiet charcoal, soft grey text, no glowing colors).
  3. Sign in on Window A as `client1@demo.ccp.test`. Show redirection to `/projects`.
  4. Sign in on Window B as `employee1@demo.ccp.test`. Show redirection to `/projects`.
- **Narration**:
  > *"Welcome to the CCP Studio Confidential Communication Portal. The portal enforces strict confidentiality between clients and project specialists, preventing accidental contact exchange and off-platform disintermediation. As we log in as Client 1 and Employee 1, notice the calm charcoal surfaces and absence of saturated colors."*

---

### Segment 2: Scenario 1 — Ordinary Message Exchange & Pseudonymity (0:35 - 1:15)
- **Time**: 0:35 - 1:15
- **Actor**: Client 1 & Employee 1
- **Action**:
  1. On Window A (Client), open "Project Alpha". Note the pinned compliance notice at the top: *"Your identity is hidden from other participants."*
  2. Note the user alias: Client is speaking as **"Client Alpha"**, counterpart is **"Project Specialist B"**.
  3. Client types and sends: *"Draft review is ready for your feedback."*
  4. Show Window B (Employee): The message appears automatically via polling.
  5. Employee replies: *"Thank you. Reviewing now."*
  6. Refresh the page on Window A: show that conversation history persists cleanly.
- **Narration**:
  > *"Participants communicate solely using project-scoped aliases. Client 1 sees only 'Project Specialist B', and Employee 1 sees only 'Client Alpha'. Real names, email addresses, and phone numbers are completely stripped server-side. Messages are exchanged and persist securely across reloads."*

---

### Segment 3: Scenario 4 & 5 — Contact Interception (HOLD) vs. Pricing Flag (1:15 - 2:20)
- **Time**: 1:15 - 2:20
- **Actor**: Client 1 & Administrator
- **Action**:
  1. On Window A (Client), send a contact-sharing message:
     *"Please call my direct line 415-555-0199 tomorrow."*
  2. Show sender bubble: Amber outline with a clock icon and message: *"Held for review. An administrator will check this message."*
  3. Show Window B (Employee): The message does NOT appear. Employee's unread badge remains 0.
  4. On Window A (Client), send a pricing discussion message:
     *"The quote for Phase 2 is $15,000 with a 10% advance."*
  5. Show that the pricing message delivers immediately to Employee 1 on Window B.
  6. Switch to Window C (Admin): In the icon rail, the Bell notification badge immediately displays **1** open review item.
- **Narration**:
  > *"Our server-side rule engine evaluates messages before delivery. The phone number triggers our locked CONTACT policy and is held in quarantine—Employee 1 never receives it. Meanwhile, the pricing message is delivered normally without disruption, but alerts administrators as a commercial event."*

---

### Segment 4: Scenario 6 — Admin Review Queue & Idempotent Decisions (2:20 - 3:20)
- **Time**: 2:20 - 3:20
- **Actor**: Administrator
- **Action**:
  1. On Window C (Admin), click the Bell icon / Flag queue to navigate to `/admin/flags`.
  2. In the two-pane queue, click the held contact message.
  3. Show the detailed pane:
     - Project: *Project Alpha*
     - Sender Alias: *Client Alpha*
     - Privileged Admin Identity: *Client Alice Real (client1@demo.ccp.test)*
     - Intercepted Reason: *Phone number match*
     - Conversation Context: surrounding messages displayed.
  4. Enter review note: *"Approved client telephone for scheduled interview."*
  5. Click **"Approve message"**.
  6. Show Window B (Employee): The previously held message now appears as delivered with its original timestamp.
  7. Show Window A (Client): A quiet system line appears: *"Your held message was approved by CCP Studio."*
  8. Click "Approve message" again on Admin: Note that duplicate deliveries are blocked (idempotent row lock).
- **Narration**:
  > *"In the admin review queue, administrators can review surrounding conversation context and sender identities. Upon approval, the message is released to the recipient, and the sender receives a quiet confirmation notice without leaking administrative details. Duplicate clicks are completely idempotent."*

---

### Segment 5: Scenario 7, Audit Log & Health Probe (3:20 - 4:15)
- **Time**: 3:20 - 4:15
- **Actor**: Administrator
- **Action**:
  1. On Window C, navigate to `/admin/rules` to show active moderation patterns.
  2. Navigate to `/admin/audit` to display the immutable audit trail of the approval decision and actor timestamp.
  3. Open `/api/health` in a browser tab: show `{ "status": "ok", "db": "up" }` proving zero credentials or internal data leaks.
  4. Wrap up with summary of security invariants.
- **Narration**:
  > *"Every administrative action is immutably recorded in the audit log. The health probe confirms database readiness without exposing system internals. This concludes our walkthrough of the CCP Studio portal."*
