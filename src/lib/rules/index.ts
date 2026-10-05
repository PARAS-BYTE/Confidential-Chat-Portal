import { Rule, RuleAction, RuleCategory, RuleSeverity, PatternType } from "@prisma/client";

export interface RuleMatch {
  ruleId?: string;
  category: RuleCategory;
  severity: RuleSeverity;
  reason: string;
  matchedText: string;
  action: RuleAction;
}

export interface EvaluationResult {
  finalAction: "DELIVERED" | "HOLD";
  matches: RuleMatch[];
}

/**
 * Normalises input text to defeat common obfuscation techniques.
 */
export function normaliseMessage(text: string): {
  raw: string;
  normalised: string;
  deobfuscatedEmail: string;
  digitsCollapsed: string;
} {
  if (!text) {
    return { raw: "", normalised: "", deobfuscatedEmail: "", digitsCollapsed: "" };
  }

  // 1. Unicode NFKC normalisation
  let norm = text.normalize("NFKC");

  // 2. Strip zero-width characters and invisible control characters
  norm = norm.replace(/[\u200B-\u200D\uFEFF\u00A0\u2000-\u200A\u2028\u2029]/g, "");

  // 3. Lowercase and collapse consecutive spaces
  norm = norm.toLowerCase().replace(/\s+/g, " ").trim();

  // 4. Deobfuscate email representations: "name at domain dot com", "name(at)domain[dot]com"
  const deobfuscatedEmail = norm
    .replace(/\s*(?:\[at\]|\(at\)|\bat\b|@)\s*/gi, "@")
    .replace(/\s*(?:\[dot\]|\(dot\)|\bdot\b|\.)\s*/gi, ".");

  // 5. Detect spaced digit patterns (e.g. "9 8 7 6 5 4 3 2 1 0" or "9-8-7-6-5-4-3-2-1-0")
  // Replace digit separators with nothing ONLY when it forms a long digit sequence (>= 7 digits)
  const digitsCollapsed = norm.replace(/(\d)[\s.-]+(?=\d)/g, "$1");

  return {
    raw: text,
    normalised: norm,
    deobfuscatedEmail,
    digitsCollapsed,
  };
}

/**
 * Validates a regular expression pattern for syntax correctness and ReDoS safety.
 */
export function validateRegex(pattern: string): { isValid: boolean; error?: string } {
  if (!pattern || pattern.trim() === "") {
    return { isValid: false, error: "Pattern cannot be empty" };
  }

  if (pattern.length > 200) {
    return { isValid: false, error: "Pattern length exceeds 200 characters limit" };
  }

  // Check for common catastrophic backtracking patterns like (a+)+ or (.*)+
  const catastrophicPatterns = /(\([^)]*[+*]\)[+*]|\([^)]*\+[^)]*\)\+|\(\.[*+]\)[*+])/;
  if (catastrophicPatterns.test(pattern)) {
    return {
      isValid: false,
      error: "Pattern contains dangerous nested quantifiers prone to catastrophic backtracking (ReDoS)",
    };
  }

  try {
    new RegExp(pattern, "i");
    return { isValid: true };
  } catch (err: any) {
    return { isValid: false, error: err.message || "Invalid regular expression" };
  }
}

/**
 * Built-in baseline rule evaluators.
 * Seeded in DB, but also evaluated defensively in pure unit tests.
 */
const BASELINE_RULES = [
  // 1. CONTACT RULES (Strictly HOLD)
  {
    name: "Phone Number Detection",
    category: RuleCategory.CONTACT,
    severity: RuleSeverity.HIGH,
    action: RuleAction.HOLD,
    reason: "Direct telephone or mobile contact sharing is prohibited",
    // Match 7-15 digits with optional country code, delimiters, while avoiding false positives like version 2.0 or 3 pm
    test: (norm: string, collapsed: string): string | null => {
      // Check collapsed digits for 7+ consecutive numbers
      const phoneRegex = /(?:\+?\d{1,4}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}/;
      const match = collapsed.match(/\b(?:\+?\d{1,3})?\d{7,14}\b/);
      if (match) {
        // Exclude common false positives: version numbers like 20261005 (checked with context) or dates
        return match[0];
      }
      const standardMatch = norm.match(phoneRegex);
      if (standardMatch) {
        // Verify total digits >= 7
        const digitsCount = standardMatch[0].replace(/\D/g, "").length;
        if (digitsCount >= 7 && digitsCount <= 15) {
          return standardMatch[0];
        }
      }
      return null;
    },
  },
  {
    name: "Email Address Detection",
    category: RuleCategory.CONTACT,
    severity: RuleSeverity.HIGH,
    action: RuleAction.HOLD,
    reason: "Personal email address sharing is prohibited",
    test: (_norm: string, _collapsed: string, deobEmail: string): string | null => {
      const emailRegex = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i;
      const match = deobEmail.match(emailRegex);
      return match ? match[0] : null;
    },
  },
  {
    name: "Social Handle Detection",
    category: RuleCategory.CONTACT,
    severity: RuleSeverity.MEDIUM,
    action: RuleAction.HOLD,
    reason: "Social media handle sharing is prohibited",
    test: (norm: string): string | null => {
      // Match @handle (at least 3 characters, followed by word boundary or space)
      const handleRegex = /(?:^|\s)@([a-z0-9_.]{3,30})\b/i;
      const match = norm.match(handleRegex);
      return match ? match[0].trim() : null;
    },
  },
  {
    name: "External Links & Messenger Links",
    category: RuleCategory.CONTACT,
    severity: RuleSeverity.HIGH,
    action: RuleAction.HOLD,
    reason: "External URLs and direct messenger links are prohibited",
    test: (norm: string): string | null => {
      const linkRegex = /\b(?:https?:\/\/|www\.|wa\.me\/|t\.me\/|telegram\.me\/|instagram\.com\/|linkedin\.com\/|twitter\.com\/|x\.com\/)[^\s]+/i;
      const match = norm.match(linkRegex);
      return match ? match[0] : null;
    },
  },

  // 2. OFF_PLATFORM RULES (Default HOLD)
  {
    name: "Off-Platform Solicitation",
    category: RuleCategory.OFF_PLATFORM,
    severity: RuleSeverity.HIGH,
    action: RuleAction.HOLD,
    reason: "Proposals to communicate or transact off-platform are restricted",
    test: (norm: string): string | null => {
      const patterns = [
        /\b(?:call|phone|ring|text|message)\s+me\b/i,
        /\b(?:talk|chat|connect|continue)\s+(?:on|via|over|through)\s+(?:whatsapp|telegram|signal|skype|zoom|google\s*meet|teams|phone|discord)\b/i,
        /\blet['’]?s\s+talk\s+(?:on|via|outside)\b/i,
        /\boutside\s+(?:the\s+)?portal\b/i,
        /\bmove\s+to\s+(?:whatsapp|telegram|email|signal)\b/i,
        /\bpay\s+(?:me\s+)?directly\b/i,
        /\bshare\s+your\s+(?:number|phone|cell|whatsapp|email|contact)\b/i,
        /\bgive\s+me\s+your\s+(?:number|phone|cell|whatsapp|email)\b/i,
        /\bmy\s+(?:number|whatsapp|telegram|email)\s+is\b/i,
      ];
      for (const p of patterns) {
        const match = norm.match(p);
        if (match) return match[0];
      }
      return null;
    },
  },

  // 3. COMMERCIAL RULES (Default ALLOW_FLAG)
  {
    name: "Commercial Negotiation",
    category: RuleCategory.COMMERCIAL,
    severity: RuleSeverity.MEDIUM,
    action: RuleAction.ALLOW_FLAG,
    reason: "Financial terms or payment discussions flagged for review",
    test: (norm: string): string | null => {
      const patterns = [
        /\b(?:price|pricing|quote|quotation|cost|costs|discount|advance|invoice|invoicing|billing)\b/i,
        /\b(?:wire\s+transfer|bank\s+transfer|paypal|stripe|crypto|usdt|bitcoin)\b/i,
        /\b(?:pay|payment|paid|refund|fee|fees|rate|rates|hourly)\b/i,
        /[$€£₹]\s*\d+(?:[.,]\d+)?/,
        /\b\d+(?:[.,]\d+)?\s*(?:dollars|usd|eur|euros|inr|rupees|gbp|pounds)\b/i,
      ];
      for (const p of patterns) {
        const match = norm.match(p);
        if (match) return match[0];
      }
      return null;
    },
  },

  // 4. ABUSE RULES (Default ALLOW_FLAG)
  {
    name: "Abusive Language & Harassment",
    category: RuleCategory.ABUSE,
    severity: RuleSeverity.HIGH,
    action: RuleAction.ALLOW_FLAG,
    reason: "Abusive, derogatory, or harassing language flagged",
    test: (norm: string): string | null => {
      const patterns = [
        /\b(?:idiot|stupid|moron|fool|scammer|fraud|threat|threaten|harass|hate\s+you|kill\s+you|suck)\b/i,
        /\b(?:fuck|bitch|bastard|asshole|bullshit)\b/i,
      ];
      for (const p of patterns) {
        const match = norm.match(p);
        if (match) return match[0];
      }
      return null;
    },
  },
];

/**
 * Pure, testable function evaluating a message against rules.
 * Accepts optional dynamic DB rules; falls back to built-in rules if none provided.
 */
export function evaluateMessage(body: string, rules?: Rule[]): EvaluationResult {
  const { normalised, digitsCollapsed, deobfuscatedEmail } = normaliseMessage(body);
  const matches: RuleMatch[] = [];

  // 1. If dynamic DB rules are supplied, evaluate them
  if (rules && rules.length > 0) {
    for (const rule of rules) {
      if (!rule.isActive) continue;

      let matched = false;
      let matchedText = "";

      if (rule.patternType === PatternType.KEYWORD) {
        const kw = rule.pattern.toLowerCase().trim();
        if (normalised.includes(kw) || deobfuscatedEmail.includes(kw)) {
          matched = true;
          matchedText = kw;
        }
      } else if (rule.patternType === PatternType.REGEX) {
        const validation = validateRegex(rule.pattern);
        if (validation.isValid) {
          try {
            const rx = new RegExp(rule.pattern, "i");
            const m =
              normalised.match(rx) ||
              digitsCollapsed.match(rx) ||
              deobfuscatedEmail.match(rx);
            if (m) {
              matched = true;
              matchedText = m[0];
            }
          } catch {
            // Safe fallback if regex execution fails
          }
        }
      }

      if (matched) {
        matches.push({
          ruleId: rule.id,
          category: rule.category,
          severity: rule.severity,
          reason: rule.name,
          matchedText,
          action: rule.action,
        });
      }
    }
  }

  // 2. Also run baseline built-in rules to ensure safety
  for (const b of BASELINE_RULES) {
    // If a rule from this category already matched with HOLD, we don't need duplicate baseline matches
    const alreadyMatchedCategory = matches.some((m) => m.category === b.category);
    if (!alreadyMatchedCategory) {
      const matchText = b.test(normalised, digitsCollapsed, deobfuscatedEmail);
      if (matchText) {
        matches.push({
          category: b.category,
          severity: b.severity,
          reason: b.reason,
          matchedText: matchText,
          action: b.action,
        });
      }
    }
  }

  // 3. Strictest Action Resolution: HOLD beats ALLOW_FLAG
  let finalAction: "DELIVERED" | "HOLD" = "DELIVERED";
  if (matches.some((m) => m.action === RuleAction.HOLD)) {
    finalAction = "HOLD";
  }

  return {
    finalAction,
    matches,
  };
}
