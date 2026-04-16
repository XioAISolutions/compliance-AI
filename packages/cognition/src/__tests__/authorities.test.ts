import { describe, it, expect } from "vitest";
import {
  ONTARIO_EMD_AUTHORITIES,
  FINTRAC_KYC_AUTHORITIES,
  MARKETING_AUTHORITIES,
  REGULATOR_INQUIRY_AUTHORITIES,
} from "../authorities";

describe("ONTARIO_EMD_AUTHORITIES seed data", () => {
  it("includes the full NI 45-106 corpus + companion instruments + legacy entries", () => {
    // Full NI 45-106 corpus (~112 items) + companion (~6) + OSC Rule 45-501,
    // Securities Act s. 130.1, NI 31-103 Part 13, CSA SN 45-309, NI 81-102 Part 15
    // plus the FINTRAC/KYC, marketing, and regulator-pattern blocks that are
    // also spread into ONTARIO_EMD_AUTHORITIES.
    expect(ONTARIO_EMD_AUTHORITIES.length).toBeGreaterThanOrEqual(120);
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

  it("all item ids are unique", () => {
    const ids = ONTARIO_EMD_AUTHORITIES.map((a) => a.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("includes NI 45-106 s. 2.9 (Offering Memorandum exemption)", () => {
    // Section 2.9 may be split into -a / -b / -c chunks when it exceeds the
    // token-size budget. Accept any item whose id starts with the section.
    const ni45106_29 = ONTARIO_EMD_AUTHORITIES.filter((a) =>
      a.id?.startsWith("auth-ni-45-106-2.9"),
    );
    expect(ni45106_29.length).toBeGreaterThanOrEqual(1);
    const content = ni45106_29.map((a) => a.content).join("\n");
    expect(content.toLowerCase()).toContain("offering memorandum");
  });

  it("includes NI 45-106 s. 2.3 (Accredited Investor)", () => {
    const s23 = ONTARIO_EMD_AUTHORITIES.filter((a) => a.id?.startsWith("auth-ni-45-106-2.3"));
    expect(s23.length).toBeGreaterThanOrEqual(1);
    const content = s23
      .map((a) => a.content)
      .join("\n")
      .toLowerCase();
    expect(content).toContain("accredited investor");
  });

  it("includes NI 45-106 s. 2.10 (Minimum Amount Investment)", () => {
    const s210 = ONTARIO_EMD_AUTHORITIES.find((a) => a.id === "auth-ni-45-106-2.10");
    expect(s210).toBeDefined();
    expect(s210!.title.toLowerCase()).toContain("minimum amount");
  });

  it("includes NI 45-106 Part 6 reporting requirements (s. 6.1, 6.4, 6.5)", () => {
    expect(ONTARIO_EMD_AUTHORITIES.find((a) => a.id === "auth-ni-45-106-6.1")).toBeDefined();
    expect(ONTARIO_EMD_AUTHORITIES.find((a) => a.id === "auth-ni-45-106-6.4")).toBeDefined();
    expect(ONTARIO_EMD_AUTHORITIES.find((a) => a.id === "auth-ni-45-106-6.5")).toBeDefined();
  });

  it("includes NI 45-102 resale restrictions (s. 2.5 and s. 2.8)", () => {
    expect(ONTARIO_EMD_AUTHORITIES.find((a) => a.id === "auth-ni-45-102-2.5")).toBeDefined();
    expect(ONTARIO_EMD_AUTHORITIES.find((a) => a.id === "auth-ni-45-102-2.8")).toBeDefined();
  });

  it("includes Companion Policy 45-106CP guidance on s. 2.9", () => {
    const cp = ONTARIO_EMD_AUTHORITIES.find((a) => a.id === "auth-cp-45-106-2.9");
    expect(cp).toBeDefined();
    expect(cp!.content.toLowerCase()).toContain("risk factor");
  });

  it("includes CSA Staff Notice 45-318 (current OM deficiency guidance)", () => {
    const sn = ONTARIO_EMD_AUTHORITIES.find((a) => a.id === "auth-csa-sn-45-318");
    expect(sn).toBeDefined();
    expect(sn!.content.toLowerCase()).toContain("deficienc");
  });

  it("includes OSC Staff Notice 45-716 (Ontario OM review findings)", () => {
    const osn = ONTARIO_EMD_AUTHORITIES.find((a) => a.id === "auth-osc-sn-45-716");
    expect(osn).toBeDefined();
    expect(osn!.content.toLowerCase()).toContain("ontario");
  });

  it("includes legacy OSC Rule 45-501 s. 5.2 (Rights of Action)", () => {
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

  it("includes Securities Act s. 130.1 (OM misrepresentation liability)", () => {
    const secAct = ONTARIO_EMD_AUTHORITIES.find((a) => a.id === "auth-securities-act-130.1");
    expect(secAct).toBeDefined();
    expect(secAct!.content).toContain("misrepresentation");
  });

  it("includes CSA Staff Notice 45-309 (legacy OM guidance)", () => {
    const staffNotice = ONTARIO_EMD_AUTHORITIES.find((a) => a.id === "auth-ni-45-106-staff-notice");
    expect(staffNotice).toBeDefined();
    expect(staffNotice!.content).toContain("risk factor");
  });

  it("includes NI 81-102 Part 15 sales-communication rules", () => {
    const ni81102 = ONTARIO_EMD_AUTHORITIES.find((a) => a.id === "auth-ni-81-102-part-15");
    expect(ni81102).toBeDefined();
    expect(ni81102!.content).toContain("sales communication");
  });

  it("all EMD-applicable items include 'emd' in registrationCategories", () => {
    const emdItems = ONTARIO_EMD_AUTHORITIES.filter((a) =>
      a.registrationCategories!.includes("emd"),
    );
    // NI 45-106 Parts 2/4/5/6 + NI 45-102 + companion notices + legacy entries
    expect(emdItems.length).toBeGreaterThanOrEqual(80);
  });
});

describe("FINTRAC_KYC_AUTHORITIES", () => {
  it("contains PCMLTFA identification rule", () => {
    expect(FINTRAC_KYC_AUTHORITIES.find((a) => a.id === "auth-pcmltfa-6.2")).toBeDefined();
  });

  it("contains suitability rule and OSC SN 33-316 guidance", () => {
    expect(
      FINTRAC_KYC_AUTHORITIES.find((a) => a.id === "auth-ni-31-103-13.3-suitability"),
    ).toBeDefined();
    expect(
      FINTRAC_KYC_AUTHORITIES.find((a) => a.id === "auth-osc-sn-33-316-suitability"),
    ).toBeDefined();
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
    expect(
      REGULATOR_INQUIRY_AUTHORITIES.find((a) => a.id?.includes("osc-deficiency")),
    ).toBeDefined();
    expect(REGULATOR_INQUIRY_AUTHORITIES.find((a) => a.id?.includes("ciro"))).toBeDefined();
    expect(
      REGULATOR_INQUIRY_AUTHORITIES.find((a) => a.id?.includes("fintrac-deficiency")),
    ).toBeDefined();
  });
});
