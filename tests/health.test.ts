import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/health/route";
import { db } from "@/lib/db";

// Mock the db client
vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: vi.fn(),
  },
}));

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns status ok and db up when database query succeeds", async () => {
    vi.mocked(db.$queryRaw).mockResolvedValueOnce([{ 1: 1 }]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      status: "ok",
      db: "up",
    });

    // Ensure no sensitive fields or extra properties are exposed
    expect(Object.keys(data).sort()).toEqual(["db", "status"]);
  });

  it("returns status ok and db down when database query fails without exposing error details", async () => {
    vi.mocked(db.$queryRaw).mockRejectedValueOnce(
      new Error("FATAL: connection to server at localhost:5432 failed, password authentication failed for user 'secret'")
    );

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data).toEqual({
      status: "ok",
      db: "down",
    });

    // Critical security invariant: never expose error messages, stack traces, or credentials
    const jsonString = JSON.stringify(data);
    expect(jsonString).not.toContain("password");
    expect(jsonString).not.toContain("localhost");
    expect(jsonString).not.toContain("connection");
    expect(jsonString).not.toContain("secret");
  });
});
