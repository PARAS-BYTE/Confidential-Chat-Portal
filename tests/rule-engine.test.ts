import { describe, it, expect } from "vitest";
import {
  evaluateMessage,
  normaliseMessage,
  validateRegex,
} from "@/lib/rules";
import { RuleCategory, RuleAction } from "@prisma/client";

describe("Feature 8: Pure Moderation Rule Engine", () => {
  describe("Text Normalisation & De-obfuscation", () => {
    it("collapses zero-width and invisible characters", () => {
      const input = "call\u200B me\u200C on\uFEFF whatsapp";
      const { normalised } = normaliseMessage(input);
      expect(normalised).toBe("call me on whatsapp");
    });

    it("de-obfuscates email representations with (at) and [dot]", () => {
      const input = "reach out at john (at) secret [dot] com for details";
      const { deobfuscatedEmail } = normaliseMessage(input);
      expect(deobfuscatedEmail).toContain("john@secret.com");
    });

    it("collapses spaced and hyphenated digits", () => {
      const input = "dial 9 8 7 6 5 4 3 2 1 0";
      const { digitsCollapsed } = normaliseMessage(input);
      expect(digitsCollapsed).toContain("9876543210");
    });
  });

  describe("ReDoS & Regex Pattern Validation", () => {
    it("accepts valid and safe regular expressions", () => {
      expect(validateRegex("wa\\.me\\/[0-9]+").isValid).toBe(true);
      expect(validateRegex("[a-z0-9._%+-]+@company\\.com").isValid).toBe(true);
    });

    it("rejects catastrophic backtracking patterns (nested quantifiers)", () => {
      expect(validateRegex("(a+)+").isValid).toBe(false);
      expect(validateRegex("(.*)+").isValid).toBe(false);
      expect(validateRegex("(a*)*").isValid).toBe(false);
    });

    it("rejects empty or overly long expressions", () => {
      expect(validateRegex("").isValid).toBe(false);
      expect(validateRegex("a".repeat(250)).isValid).toBe(false);
    });
  });

  describe("Category 1: CONTACT Detection (Strict HOLD)", () => {
    const positiveContactExamples = [
      "Here is my number: +1-555-234-5678",
      "Reach me directly on 9876543210",
      "My cell is 9 8 7 6 5 4 3 2 1 0 call anytime",
      "Email me at secret.agent@gmail.com",
      "My address is partner (at) domain [dot] com",
      "Ping me on wa.me/15551234567",
      "Check my telegram profile t.me/confidential_alias",
      "You can find me on instagram.com/secret_handle",
    ];

    const negativeContactExamples = [
      "We will deploy version 2.0.1 next week",
      "Let's meet in room 4021 at 3 pm",
      "The order code is SKU-8849",
      "The report contains 42 charts and 15 tables",
      "Port 8080 is open for health checks",
      "Please review page 12 of the documentation",
      "The meeting will last about 45 minutes",
      "We completed sprint number 14 today",
    ];

    positiveContactExamples.forEach((text, i) => {
      it(`detects positive contact attempt #${i + 1}: "${text}"`, () => {
        const result = evaluateMessage(text);
        expect(result.finalAction).toBe("HOLD");
        expect(result.matches.some((m) => m.category === RuleCategory.CONTACT)).toBe(true);
      });
    });

    negativeContactExamples.forEach((text, i) => {
      it(`does not falsely hold standard technical text #${i + 1}: "${text}"`, () => {
        const result = evaluateMessage(text);
        expect(result.matches.some((m) => m.category === RuleCategory.CONTACT)).toBe(false);
      });
    });
  });

  describe("Category 2: OFF_PLATFORM Detection (HOLD)", () => {
    const positiveOffPlatform = [
      "Let's talk on WhatsApp instead",
      "Can you call me right now?",
      "Move to telegram for faster replies",
      "We should take this outside the portal",
      "Please pay me directly to my bank",
      "Share your phone so we can discuss offline",
      "Give me your whatsapp so I can send updates",
      "My number is ready if you want to chat outside",
    ];

    const negativeOffPlatform = [
      "We should communicate through the confidential portal",
      "I have submitted the deliverables for your review",
      "Let's schedule our project kickoff call next week",
      "The specialist completed the migration successfully",
      "All project requirements are documented in the specification",
      "Thank you for the detailed feedback on the wireframes",
      "I will follow up inside this thread tomorrow",
      "The client approved the initial milestone",
    ];

    positiveOffPlatform.forEach((text, i) => {
      it(`detects off-platform solicitation #${i + 1}: "${text}"`, () => {
        const result = evaluateMessage(text);
        expect(result.finalAction).toBe("HOLD");
        expect(result.matches.some((m) => m.category === RuleCategory.OFF_PLATFORM)).toBe(true);
      });
    });

    negativeOffPlatform.forEach((text, i) => {
      it(`allows normal project coordination #${i + 1}: "${text}"`, () => {
        const result = evaluateMessage(text);
        expect(result.matches.some((m) => m.category === RuleCategory.OFF_PLATFORM)).toBe(false);
      });
    });
  });

  describe("Category 3: COMMERCIAL Detection (ALLOW_FLAG)", () => {
    const positiveCommercial = [
      "Can you provide a price for the additional scope?",
      "Please send over the updated quote",
      "What is the total cost for this deliverable?",
      "We need a discount on the final milestone",
      "The invoice has been sent to accounting",
      "We require an advance payment before beginning",
      "The service fee is $500 per month",
      "Can we issue a refund for the cancelled sprint?",
    ];

    const negativeCommercial = [
      "The design revision looks very clean and professional",
      "We are on track to meet the deadline on Friday",
      "Please share the latest draft when available",
      "The team is ready for the sprint review",
      "I appreciate the thorough test coverage provided",
      "Let's focus on user authentication and session security",
      "The server response latency has improved significantly",
      "We verified the bug fix in development",
    ];

    positiveCommercial.forEach((text, i) => {
      it(`flags commercial discussion #${i + 1}: "${text}"`, () => {
        const result = evaluateMessage(text);
        // Default COMMERCIAL action is ALLOW_FLAG (not HOLD unless coupled with contact info)
        expect(result.matches.some((m) => m.category === RuleCategory.COMMERCIAL)).toBe(true);
      });
    });

    negativeCommercial.forEach((text, i) => {
      it(`does not flag non-financial technical discussions #${i + 1}: "${text}"`, () => {
        const result = evaluateMessage(text);
        expect(result.matches.some((m) => m.category === RuleCategory.COMMERCIAL)).toBe(false);
      });
    });
  });

  describe("Category 4: ABUSE Detection (ALLOW_FLAG)", () => {
    const positiveAbuse = [
      "You are such an idiot and incompetent fool",
      "This is complete bullshit",
      "You are a scammer and a fraud",
      "I will threaten you and make you pay",
      "Stop acting like a moron",
      "You stupid person, fix this right now",
      "This service is absolute garbage and asshole design",
      "I hate you and want to cancel everything",
    ];

    const negativeAbuse = [
      "Please address this critical bug as soon as possible",
      "There was an error in the deployment pipeline",
      "The performance did not meet our expectations",
      "We need to revise the architecture strategy",
      "I disagree with the proposed database schema design",
      "Let's find a constructive solution to this blocker",
      "The deadline was missed due to unexpected downtime",
      "We noticed a regression in the login flow",
    ];

    positiveAbuse.forEach((text, i) => {
      it(`flags abusive language #${i + 1}: "${text}"`, () => {
        const result = evaluateMessage(text);
        expect(result.matches.some((m) => m.category === RuleCategory.ABUSE)).toBe(true);
      });
    });

    negativeAbuse.forEach((text, i) => {
      it(`does not flag constructive critical feedback #${i + 1}: "${text}"`, () => {
        const result = evaluateMessage(text);
        expect(result.matches.some((m) => m.category === RuleCategory.ABUSE)).toBe(false);
      });
    });
  });

  describe("Action Precedence: HOLD beats ALLOW_FLAG", () => {
    it("resolves to HOLD when message contains both commercial (ALLOW_FLAG) and contact (HOLD)", () => {
      const message = "The price is $500, please call me on 9876543210 to confirm.";
      const result = evaluateMessage(message);
      expect(result.finalAction).toBe("HOLD");
      expect(result.matches.some((m) => m.action === RuleAction.HOLD)).toBe(true);
      expect(result.matches.some((m) => m.action === RuleAction.ALLOW_FLAG)).toBe(true);
    });

    it("resolves to DELIVERED when message triggers only ALLOW_FLAG rules", () => {
      const message = "What is the total price and invoice amount for this scope?";
      const result = evaluateMessage(message);
      expect(result.finalAction).toBe("DELIVERED");
      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.matches.every((m) => m.action === RuleAction.ALLOW_FLAG)).toBe(true);
    });

    it("resolves to DELIVERED with zero matches for ordinary polite communication", () => {
      const message = "Good morning, I have uploaded the deliverables for your review.";
      const result = evaluateMessage(message);
      expect(result.finalAction).toBe("DELIVERED");
      expect(result.matches).toHaveLength(0);
    });
  });
});
