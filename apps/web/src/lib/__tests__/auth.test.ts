import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { getSession, requireSession, isAuthConfigured } from "../auth";

describe("auth abstraction", () => {
  const originalSecret = process.env.NEXTAUTH_SECRET;

  beforeEach(() => {
    delete process.env.NEXTAUTH_SECRET;
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.NEXTAUTH_SECRET;
    } else {
      process.env.NEXTAUTH_SECRET = originalSecret;
    }
  });

  it("reports auth as not configured when NEXTAUTH_SECRET is unset", () => {
    expect(isAuthConfigured()).toBe(false);
  });

  it("reports auth as configured when NEXTAUTH_SECRET is set", () => {
    process.env.NEXTAUTH_SECRET = "a".repeat(32);
    expect(isAuthConfigured()).toBe(true);
  });

  it("returns the preview session when auth is not configured", async () => {
    const session = await getSession();
    expect(session).not.toBeNull();
    expect(session!.organizationId).toBe("preview");
    expect(session!.user.role).toBe("owner");
    expect(session!.user.email).toContain("@");
  });

  it("requireSession returns a session in preview mode", async () => {
    const session = await requireSession();
    expect(session.organizationId).toBe("preview");
  });

  it("preview session user has stable id across calls", async () => {
    const s1 = await getSession();
    const s2 = await getSession();
    expect(s1!.user.id).toBe(s2!.user.id);
  });
});
