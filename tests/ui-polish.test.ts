import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as UI from "@/components/ui";

describe("Feature 13: UI Polish, Design Tokens, Components & Accessibility", () => {
  it("1. Verifies all required shared UI components are exported", () => {
    expect(UI.Button).toBeDefined();
    expect(UI.Input).toBeDefined();
    expect(UI.Chip).toBeDefined();
    expect(UI.Badge).toBeDefined();
    expect(UI.Card).toBeDefined();
    expect(UI.Skeleton).toBeDefined();
    expect(UI.EmptyState).toBeDefined();
    expect(UI.ErrorState).toBeDefined();
    expect(UI.Modal).toBeDefined();
    expect(UI.useToast).toBeDefined();
    expect(UI.AccessDenied).toBeDefined();
    expect(UI.StatusPill).toBeDefined();
  });

  it("2. Verifies CSS color tokens in globals.css strictly match WhatsApp Web dark theme", () => {
    const globalsCssPath = path.join(process.cwd(), "src", "app", "globals.css");
    const content = fs.readFileSync(globalsCssPath, "utf-8");

    const requiredTokens = [
      "--bg-app: #0b0c0c;",
      "--bg-panel: #161717;",
      "--bg-surface: #1d1f1f;",
      "--bg-field: #292a2a;",
      "--bg-hover: #242626;",
      "--border: #2e2f2f;",
      "--text-primary: #e9edef;",
      "--text-secondary: #8696a0;",
      "--accent: #21c063;",
      "--accent-soft: #103529;",
      "--bubble-out: #005c4b;",
      "--bubble-in: #202c33;",
      "--warn: #c9a227;",
      "--danger: #d9534f;",
      "--info: #53bdeb;",
    ];

    for (const token of requiredTokens) {
      expect(content).toContain(token);
    }

    // Verify absence of neon / oversaturated styling rules
    expect(content.toLowerCase()).not.toContain("neon");
  });

  it("3. Verifies StatusPill supports all required message and flag states", () => {
    const requiredStatuses = [
      "SENDING",
      "DELIVERED",
      "HELD",
      "REJECTED",
      "FAILED",
      "APPROVED",
      "DISMISSED",
    ];

    for (const st of requiredStatuses) {
      const element = UI.StatusPill({ status: st });
      expect(element).toBeDefined();
      expect(element.props.className).toContain("rounded-full");
    }
  });

  it("4. Verifies AccessDenied component defaults and styling", () => {
    const element = UI.AccessDenied({});
    expect(element).toBeDefined();
    expect(element.props.className).toContain("min-h-[340px]");
  });
});
