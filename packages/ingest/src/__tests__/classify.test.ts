import { describe, it, expect } from "vitest";
import { classifyDocument } from "../classify";

describe("classifyDocument", () => {
  it("classifies an OM by 'offering memorandum' + risk factors + use of proceeds", () => {
    const text = `
      OFFERING MEMORANDUM

      Acme Capital Inc. (the "Issuer") is offering Class A preferred shares
      to accredited investors in Ontario pursuant to Form 45-106F2.

      Risk Factors

      The investment involves substantial risks...

      Use of Proceeds

      The net proceeds of the offering will be used for working capital...

      Rights of Action

      If this offering memorandum contains a misrepresentation, purchasers
      have rights of action under section 130.1 of the Securities Act.
    `;
    const result = classifyDocument({ text });
    expect(result.documentType).toBe("offering-memo");
    expect(result.taskType).toBe("om-review");
    expect(result.jurisdiction).toBe("ontario");
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it("classifies a KYC file by KYC + PEP + client identification", () => {
    const text = `
      Client File — Jane Doe

      Know-Your-Client Information

      Client identification verified per PCMLTFA. Government-issued ID (driver's
      licence) examined in person. Occupation: software engineer.

      Politically Exposed Person (PEP) Screening: No matches.

      Source of Funds: Salary from employer.

      Suitability Assessment: Investment objective — growth. Time horizon 10+ years.
    `;
    const result = classifyDocument({ text });
    expect(result.documentType).toBe("kyc-aml-file");
    expect(result.taskType).toBe("kyc-gap-check");
  });

  it("classifies marketing material by pitch deck / performance language", () => {
    const text = `
      Acme Capital Fund — Investor Presentation

      Why invest now: We present a compelling opportunity in Canadian real estate.

      Track Record: Past performance of 12% annualized returns over the last 5 years.

      Target Return: 15% IRR projected over the fund life.
    `;
    const result = classifyDocument({ text });
    expect(result.documentType).toBe("marketing-material");
    expect(result.taskType).toBe("marketing-signoff");
  });

  it("classifies a regulator inquiry by deficiency / staff review language", () => {
    const text = `
      Ontario Securities Commission — Compliance Field Review

      Dear Registrant,

      Further to our compliance field review dated March 2026, this notice of
      deficiency identifies findings that require your response.

      1. Please explain the suitability determination for accounts A, B, and C.
      2. Please provide your documented KYC refresh policy.

      Response is required by April 15, 2026.
    `;
    const result = classifyDocument({ text });
    expect(result.documentType).toBe("regulator-inquiry");
    expect(result.taskType).toBe("response-memo");
    expect(result.jurisdiction).toBe("ontario");
  });

  it("classifies an authority rule by NI references", () => {
    const text = `
      NATIONAL INSTRUMENT 45-106 — PROSPECTUS EXEMPTIONS

      Section 2.9 Offering memorandum

      (1) The prospectus requirement does not apply to a distribution of a
      security to a person if the person purchases the security as principal,
      subject to the conditions prescribed in this section.
    `;
    const result = classifyDocument({ text });
    expect(result.documentType).toBe("authority-rule");
    // Authorities don't map to a task type (they're context, not subjects).
    expect(result.taskType).toBeNull();
  });

  it("classifies NI 45-106 unofficial consolidation high-confidence even with OM-adjacent vocabulary", () => {
    // Synthesized from the actual CSA consolidation cover page. The text
    // contains "Offering memorandum" (in a table of contents) and
    // "Accredited investor" — terms that used to tie the classifier between
    // authority-rule and offering-memo, sending it to "other" with
    // confidence 0. Authority-specific markers ("Prospectus Exemptions",
    // "unofficial consolidation", "this Instrument", "Part 1", "Division 1")
    // should now win decisively.
    const text = `
      Ontario Securities Commission
      National Instrument 45-106
      Unofficial consolidation current to 2025-12-04.

      NATIONAL INSTRUMENT 45-106
      PROSPECTUS EXEMPTIONS

      Text boxes in this Instrument located above sections 2.1 to 2.5 refer to
      National Instrument 45-102 Resale of Securities.

      Contents
      Part 1 Definitions and Interpretation
      Part 2 Prospectus Exemptions
      Division 1: Capital Raising Exemptions
      Accredited investor
      Private issuer
      Offering memorandum
      Minimum amount investment
    `;
    const result = classifyDocument({ text });
    expect(result.documentType).toBe("authority-rule");
    expect(result.taskType).toBeNull();
    // Classifier must be *confident* — the quick-review route rejects uploads
    // of the regulations themselves only when confidence >= 0.33.
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it("classifies CSA staff notice as regulatory guidance", () => {
    const text = `
      CSA Staff Notice 33-316 — Marketing Practices Review

      This guidance summarizes best practices observed during marketing
      examinations of portfolio managers.
    `;
    const result = classifyDocument({ text });
    expect(result.documentType).toBe("regulatory-guidance");
    expect(result.taskType).toBeNull();
  });

  it("falls back to 'other' when no strong signal", () => {
    const text = `
      Meeting notes from last Tuesday. We discussed the upcoming quarterly
      planning session and the holiday schedule. Jane will follow up on the
      venue booking. Mark will order lunch. Reminder: offsite is next month.
    `;
    const result = classifyDocument({ text });
    expect(result.documentType).toBe("other");
    expect(result.confidence).toBe(0);
  });

  it("detects Quebec jurisdiction from AMF reference", () => {
    const text = `
      OFFERING MEMORANDUM

      Pursuant to Form 45-106F2. Risk factors include illiquidity.
      Autorité des marchés financiers (AMF) Quebec filings current.
      Use of proceeds: working capital.
    `;
    const result = classifyDocument({ text });
    expect(result.jurisdiction).toBe("quebec");
  });

  it("detects EMD registration category", () => {
    const text = `
      Exempt Market Dealer — Compliance Manual

      Know-Your-Client obligations apply to all accounts. PEP screening at
      onboarding. Source of funds verified.
    `;
    const result = classifyDocument({ text });
    expect(result.registrationCategory).toBe("emd");
  });

  it("extracts a title from the first non-trivial line", () => {
    const text = `
      OFFERING MEMORANDUM
      Acme Capital Inc. — Series B Preferred Shares

      Risk factors, use of proceeds, and accredited investor representation follow.
    `;
    const result = classifyDocument({ text });
    expect(result.suggestedTitle).toBe("OFFERING MEMORANDUM");
  });

  it("accepts chunks as input", () => {
    const result = classifyDocument({
      chunks: [
        {
          id: "ch-1",
          docId: "d",
          ordinal: 0,
          content:
            "OFFERING MEMORANDUM. Risk factors. Use of proceeds. Rights of action. Form 45-106F2. Accredited investor.",
          charStart: 0,
          charEnd: 100,
          tokenCount: 20,
        },
      ],
    });
    expect(result.documentType).toBe("offering-memo");
  });
});
