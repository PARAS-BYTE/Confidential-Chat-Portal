import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

function getRouteFiles(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getRouteFiles(filePath));
    } else if (file === "route.ts" || file === "route.js") {
      results.push(filePath);
    }
  }
  return results;
}

describe("Security Scanner: API Route Authorization Guard Verification", () => {
  const apiDir = path.resolve(__dirname, "../src/app/api");

  const exemptRoutes = [
    path.normalize("src/app/api/health/route.ts"),
    path.normalize("src/app/api/auth/login/route.ts"),
  ];

  const authHelpers = [
    "requireUser",
    "requireRole",
    "assertProjectAccess",
    "getCurrentUser",
    "validateSessionToken",
    "invalidateSession",
    "clearSessionCookie",
  ];

  it("ensures every non-exempt API route handler invokes a server-side auth helper", () => {
    const routeFiles = getRouteFiles(apiDir);
    expect(routeFiles.length).toBeGreaterThan(0);

    const violations: { file: string; reason: string }[] = [];

    for (const file of routeFiles) {
      const normalizedRelativePath = path.normalize(path.relative(path.resolve(__dirname, ".."), file));

      // Skip exempt routes
      if (exemptRoutes.some((exempt) => normalizedRelativePath.endsWith(exempt))) {
        continue;
      }

      const content = fs.readFileSync(file, "utf8");

      // Verify that at least one auth helper is imported and called
      const hasAuthHelper = authHelpers.some((helper) => content.includes(helper));

      if (!hasAuthHelper) {
        violations.push({
          file: normalizedRelativePath,
          reason: `Missing required server-side authorization call (${authHelpers.join(" | ")})`,
        });
      }
    }

    expect(
      violations,
      `API routes found without authorization checks: ${JSON.stringify(violations, null, 2)}`
    ).toHaveLength(0);
  });
});
