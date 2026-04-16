import { describe, it, expect } from "vitest";
import { isValidOrgId, withOrg } from "../with-org";

describe("isValidOrgId", () => {
  it("accepts valid UUIDs", () => {
    expect(isValidOrgId("12345678-1234-1234-1234-123456789abc")).toBe(true);
    expect(isValidOrgId("AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE")).toBe(true);
  });

  it("accepts the 'preview' tenant", () => {
    expect(isValidOrgId("preview")).toBe(true);
  });

  it("accepts slug-style tenant ids", () => {
    expect(isValidOrgId("acme-corp")).toBe(true);
    expect(isValidOrgId("test-tenant-123")).toBe(true);
  });

  it("rejects SQL injection attempts", () => {
    expect(isValidOrgId("'; DROP TABLE matters; --")).toBe(false);
    expect(isValidOrgId("x' OR '1'='1")).toBe(false);
    expect(isValidOrgId("preview'; SELECT * FROM users; --")).toBe(false);
  });

  it("rejects empty string and whitespace", () => {
    expect(isValidOrgId("")).toBe(false);
    expect(isValidOrgId(" ")).toBe(false);
    expect(isValidOrgId("   preview   ")).toBe(false);
  });

  it("rejects ids starting with a digit (per slug rules)", () => {
    expect(isValidOrgId("1preview")).toBe(false);
  });
});

describe("withOrg", () => {
  it("rejects invalid org ids synchronously without touching the DB", async () => {
    await expect(
      withOrg("'; DROP TABLE matters; --", async () => "never"),
    ).rejects.toThrow(/Invalid organizationId/);
    await expect(withOrg("", async () => "never")).rejects.toThrow(/Invalid organizationId/);
  });
});
