import { describe, it, expect } from "vitest";
import {
  ONTARIO_EMD_AUTHORITIES,
  FINTRAC_KYC_AUTHORITIES,
  MARKETING_AUTHORITIES,
  REGULATOR_INQUIRY_AUTHORITIES,
} from "../authorities";

describe("ONTARIO_EMD_AUTHORITIES seed data", () => {
  it("contains the expected number of authority items (OM + KYC + marketing + regulator patterns)", () => {
    // 6 original OM authorities + 4 FINTRAC/KYC + 3 marketing + 3 regulator patterns = 16
    expect(ONTARIO_EMD_AUTHORITIES.length).toBe(16);
  });

  it("every item has required fields", () => {
    for (const item of ONTARIO_EMD_AUTHORITIES) {
      expect(item.id).toBeTruthy();
      expect(item.title).toBeTruthy();
      expect(item.content).toBeTruthy();
      expect(item.source).toBeTruthy();
      expect(item.organizationId).toBe("preview");
      expect(item.jurisdiction).toBe("ontario");
      expect(item.registrationCategories).toBeDefined();
      expect(item.registrationCategories!.length).toBeGreaterThan(0);
    }
  });

  it("includes NI 45-106 s. 2.9", () => {
    const ni45106 = ONTARIO_EMD_AUTHORITIES.find((a) => a.id === "auth-ni-45-106-2.9");
    expect(ni45106).toBeDefined();
    expect(ni45106!.title).toContain("NI 45-106");
    expect(ni45106!.content).toContain("offering memorandum");
  });

  it("includes OSC Rule 45-501", () => {
    const osc = ONTARIO_EMD_AUTHORITIES.find((a) => a.id === "auth-osc-rule-45-501-5.2");
    expect(osc).toBeDefined();
    expect(osc!.content).toContain("rights of action");
  });

  it("includes NI 31-103 Part 13 (EMD obligations)", () => {
    const ni31103 = ONTARIO_EMD_AUTHORITIES.find((a) => a.id === "auth-ni-31-103-part-13");
    expect(ni31103).toBeDefined();
    expect(ni31103!.registrationCategories).toContain("emd");
    expect(ni31103!.content).toContain("Know your client");
  });

  it("includes Securities Act s. 130.1", () => {
    const secAct = ONTARIO_EMD_AUTHORITIES.find((a) => a.id === "auth-securities-act-130.1");
    expect(secAct).toBeDefined();
    expect(secAct!.content).toContain("misrepresentation");
  });

  it("includes CSA Staff Notice 45-309", () => {
    const staffNotice = ONTARIO_EMD_AUTHORITIES.find((a) => a.id === "auth-ni-45-106-staff-notice");
    expect(staffNotice).toBeDefined();
    expect(staffNotice!.content).toContain("risk factor");
  });

  it("includes NI 81-102 Part 15", () => {
    const ni81102 = ONTARIO_EMD_AUTHORITIES.find((a) => a.id === "auth-ni-81-102-part-15");
    expect(ni81102).toBeDefined();
    expect(ni81102!.content).toContain("sales communication");
  });

  it("all EMD-applicable items include 'emd' in registrationCategories", () => {
    const emdItems = ONTARIO_EMD_AUTHORITIES.filter(
      (a) => a.registrationCategories!.includes("emd"),
    );
    // At minimum: NI 45-106, OSC 45-501, NI 31-103, Securities Act 130.1, Staff Notice
    expect(emdItems.length).toBeGreaterThanOrEqual(5);
  });
});

describe("FINTRAC_KYC_AUTHORITIES", () => {
  it("contains PCMLTFA identification rule", () => {
    expect(FINTRAC_KYC_AUTHORITIES.find((a) => a.id === "auth-pcmltfa-6.2")).toBeDefined();
  });

  it("contains suitability rule and OSC SN 33-316 guidance", () => {
    expect(FINTRAC_KYC_AUTHORITIES.find((a) => a.id === "auth-ni-31-103-13.3-suitability")).toBeDefined();
    expect(FINTRAC_KYC_AUTHORITIES.find((a) => a.id === "auth-osc-sn-33-316-suitability")).toBeDefined();
  });

  it("applies to EMD, PM, and IIROC categories", () => {
    const pcmltfa = FINTRAC_KYC_AUTHORITIES.find((a) => a.id === "auth-pcmltfa-6.2")!;
    expect(pcmltfa.registrationCategories).toContain("emd");
    expect(pcmltfa.registrationCategories).toContain("pm");
    expect(pcmltfa.registrationCategories).toContain("iiroc");
  });
});

describe("MARKETING_AUTHORITIES", () => {
  it("contains NI 31-103 s. 13.18 misleading communications", () => {
    expect(MARKETING_AUTHORITIES.find((a) => a.id === "auth-ni-31-103-13.18")).toBeDefined();
  });

  it("contains NI 81-102 Part 15 prohibited representations and standards", () => {
    expect(MARKETING_AUTHORITIES.find((a) => a.id === "auth-ni-81-102-15.2")).toBeDefined();
    expect(MARKETING_AUTHORITIES.find((a) => a.id === "auth-ni-81-102-15.3")).toBeDefined();
  });
});

describe("REGULATOR_INQUIRY_AUTHORITIES", () => {
  it("contains OSC, CIRO, and FINTRAC deficiency patterns", () => {
    expect(REGULATOR_INQUIRY_AUTHORITIES.find((a) => a.id?.includes("osc-deficiency"))).toBeDefined();
    expect(REGULATOR_INQUIRY_AUTHORITIES.find((a) => a.id?.includes("ciro"))).toBeDefined();
    expect(REGULATOR_INQUIRY_AUTHORITIES.find((a) => a.id?.includes("fintrac-deficiency"))).toBeDefined();
  });
});
