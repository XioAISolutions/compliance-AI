import { describe, it, expect } from "vitest";
import {
  countPrivileged,
  defaultRedactionFor,
  isPrivileged,
  isPrivilegeLevel,
  privilegeBadge,
  privilegeLabel,
  redactAuditEntry,
  redactCitation,
  REDACTED_PLACEHOLDER,
  resolveRedactionPolicy,
} from "../privilege";

describe("isPrivilegeLevel / isPrivileged", () => {
  it("accepts the five canonical values + rejects everything else", () => {
    for (const v of [
      "none",
      "solicitor-client",
      "litigation",
      "work-product",
      "common-interest",
    ]) {
      expect(isPrivilegeLevel(v)).toBe(true);
    }
    for (const v of ["", "private", null, undefined, 1, {}, "Solicitor-Client"]) {
      expect(isPrivilegeLevel(v)).toBe(false);
    }
  });

  it("'none' + absent field are NOT privileged; any other canonical value IS", () => {
    expect(isPrivileged("none")).toBe(false);
    expect(isPrivileged(undefined)).toBe(false);
    expect(isPrivileged(null)).toBe(false);
    expect(isPrivileged("solicitor-client")).toBe(true);
    expect(isPrivileged("litigation")).toBe(true);
    expect(isPrivileged("work-product")).toBe(true);
    expect(isPrivileged("common-interest")).toBe(true);
  });
});

describe("resolveRedactionPolicy + per-endpoint defaults", () => {
  it("defaults: internal endpoints show, external endpoints redact", () => {
    expect(defaultRedactionFor("internal")).toBe(false);
    expect(defaultRedactionFor("external")).toBe(true);
  });

  it("picks up defaults when no query params are set", () => {
    const internal = resolveRedactionPolicy(
      new URL("http://x/api/export"),
      "internal",
    );
    expect(internal).toEqual({ redactPrivileged: false, source: "default" });

    const external = resolveRedactionPolicy(
      new URL("http://x/api/audit-export"),
      "external",
    );
    expect(external).toEqual({ redactPrivileged: true, source: "default" });
  });

  it("?redact=privilege flips internal endpoints to redact", () => {
    const p = resolveRedactionPolicy(
      new URL("http://x/api/export?redact=privilege"),
      "internal",
    );
    expect(p).toEqual({ redactPrivileged: true, source: "override-redact" });
  });

  it("?show=privilege flips external endpoints to show", () => {
    const p = resolveRedactionPolicy(
      new URL("http://x/api/audit-export?show=privilege"),
      "external",
    );
    expect(p).toEqual({ redactPrivileged: false, source: "override-show" });
  });

  it("?show wins over ?redact when both are present (operator takes responsibility)", () => {
    const p = resolveRedactionPolicy(
      new URL("http://x/api/audit-export?show=privilege&redact=privilege"),
      "external",
    );
    expect(p.redactPrivileged).toBe(false);
    expect(p.source).toBe("override-show");
  });

  it("ignores unrelated ?redact / ?show values", () => {
    const p = resolveRedactionPolicy(
      new URL("http://x/api/export?redact=something-else"),
      "internal",
    );
    expect(p.redactPrivileged).toBe(false);
    expect(p.source).toBe("default");
  });
});

describe("redactCitation", () => {
  it("is a no-op when redact=false", () => {
    const c = { id: "c1", quote: "secret quote", privilege: "solicitor-client" };
    expect(redactCitation(c, false)).toBe(c);
  });

  it("is a no-op on non-privileged citations even when redact=true", () => {
    const c = { id: "c1", quote: "public text", privilege: "none" };
    expect(redactCitation(c, true).quote).toBe("public text");
  });

  it("strips the quote on privileged citations", () => {
    const c = {
      id: "c1",
      quote: "confidential client communication",
      privilege: "solicitor-client" as const,
    };
    const out = redactCitation(c, true);
    expect(out.quote).toBe(REDACTED_PLACEHOLDER);
    expect(out.id).toBe("c1"); // id preserved so the citation marker still resolves
    expect(c.quote).toBe("confidential client communication"); // original untouched (copy, not mutation)
  });

  it("tolerates null / undefined privilege fields", () => {
    expect(redactCitation({ quote: "x" }, true).quote).toBe("x");
    expect(redactCitation({ quote: "x", privilege: null }, true).quote).toBe("x");
    expect(redactCitation({ quote: "x", privilege: undefined }, true).quote).toBe("x");
  });
});

describe("redactAuditEntry", () => {
  it("strips inputContent + outputContent when privileged + redact=true", () => {
    const entry = {
      inputContent: "client told us the backdated contract was intentional",
      outputContent: "memo on strategy to disclose vs not",
      privilege: "solicitor-client" as const,
    };
    const out = redactAuditEntry(entry, true);
    expect(out.inputContent).toBe(REDACTED_PLACEHOLDER);
    expect(out.outputContent).toBe(REDACTED_PLACEHOLDER);
  });

  it("is a no-op on non-privileged entries even when redact=true", () => {
    const entry = {
      inputContent: "public statute lookup",
      outputContent: "citation list",
      privilege: "none" as const,
    };
    expect(redactAuditEntry(entry, true).inputContent).toBe("public statute lookup");
  });

  it("is a no-op when redact=false regardless of privilege", () => {
    const entry = {
      inputContent: "secret",
      outputContent: "more secret",
      privilege: "litigation" as const,
    };
    const out = redactAuditEntry(entry, false);
    expect(out.inputContent).toBe("secret");
    expect(out.outputContent).toBe("more secret");
  });
});

describe("countPrivileged", () => {
  it("counts items whose privilege field is set to any non-none canonical value", () => {
    const items = [
      { privilege: "none" },
      { privilege: "solicitor-client" },
      { privilege: "work-product" },
      {}, // absent = not privileged
      { privilege: null },
      { privilege: "litigation" },
    ];
    expect(countPrivileged(items)).toBe(3);
  });

  it("returns 0 for an empty list", () => {
    expect(countPrivileged([])).toBe(0);
  });
});

describe("privilegeBadge / privilegeLabel", () => {
  it("returns null badge when not privileged; 'PRIV' otherwise", () => {
    expect(privilegeBadge("none")).toBeNull();
    expect(privilegeBadge(null)).toBeNull();
    expect(privilegeBadge(undefined)).toBeNull();
    expect(privilegeBadge("solicitor-client")).toBe("PRIV");
    expect(privilegeBadge("work-product")).toBe("PRIV");
  });

  it("returns a human label for every level", () => {
    expect(privilegeLabel("solicitor-client")).toMatch(/solicitor/i);
    expect(privilegeLabel("litigation")).toMatch(/litigation/i);
    expect(privilegeLabel("work-product")).toMatch(/work product/i);
    expect(privilegeLabel("common-interest")).toMatch(/common-interest/i);
    expect(privilegeLabel("none")).toBe("Not privileged");
    expect(privilegeLabel(undefined)).toBe("Not privileged");
  });
});
