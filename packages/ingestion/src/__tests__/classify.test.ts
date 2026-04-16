import { describe, it, expect } from "vitest";
import { classifyDocument } from "../classify";

describe("classifyDocument", () => {
  it("returns default when neither filename nor content match", () => {
    const r = classifyDocument({ filename: "random.bin" });
    expect(r.type).toBe("other");
    expect(r.signal).toBe("default");
    expect(r.confidence).toBe(0);
  });

  it("picks content signal over filename when both fire", () => {
    const r = classifyDocument({
      filename: "random.pdf",
      firstPagePreview: "This OFFERING MEMORANDUM is being furnished on a confidential basis.",
    });
    expect(r.type).toBe("offering-memo");
    expect(r.signal).toBe("content");
    expect(r.confidence).toBeGreaterThan(0);
  });

  it("identifies an OM from filename alone when preview is empty", () => {
    const r = classifyDocument({ filename: "ABC-OFFERING-MEMO-draft.pdf" });
    expect(r.type).toBe("offering-memo");
    expect(r.signal).toBe("filename");
  });

  it("identifies a KYC file by content", () => {
    const r = classifyDocument({
      filename: "client-intake.pdf",
      firstPagePreview: "Know your client questionnaire — residence, occupation, source of funds.",
    });
    expect(r.type).toBe("kyc-aml-file");
  });

  it("identifies KYC via FINTRAC reference", () => {
    const r = classifyDocument({
      filename: "intake.pdf",
      firstPagePreview: "FINTRAC identification verification record, dated 2026-04-10.",
    });
    expect(r.type).toBe("kyc-aml-file");
  });

  it("identifies marketing material", () => {
    const r = classifyDocument({
      filename: "product-sheet.pdf",
      firstPagePreview:
        "Sales communication: Fund fact sheet — Q1 2026 — past performance not indicative of future results.",
    });
    expect(r.type).toBe("marketing-material");
  });

  it("identifies authority rule text", () => {
    const r = classifyDocument({
      filename: "ni-31-103.pdf",
      firstPagePreview:
        "NI 31-103 Registration Requirements, Exemptions and Ongoing Registrant Obligations — Part 13 — Dealing with clients.",
    });
    expect(r.type).toBe("authority-rule");
  });

  it("identifies regulatory guidance from staff notice keyword", () => {
    const r = classifyDocument({
      filename: "guidance.pdf",
      firstPagePreview: "CSA Staff Notice 81-330 provides guidance on hypothetical performance.",
    });
    // Authority rule wins by content-rule priority since NI 81-330 doesn't
    // match, but "staff notice" is the regulatory-guidance anchor.
    expect(r.type).toBe("regulatory-guidance");
  });
});
