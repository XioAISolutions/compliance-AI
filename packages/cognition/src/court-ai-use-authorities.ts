/**
 * Court AI-use practice directions — Canadian courts' notices on the use of
 * generative AI in court proceedings.
 *
 * Every court's notice frames three obligations a counsel using AI must
 * satisfy: transparency (disclose AI use), accuracy (verify citations),
 * accountability (counsel is responsible). The specific wording and filing
 * mechanics vary per court. These seed items give the
 * court-ai-disclosure-drafter persona a substantive authority base so it
 * doesn't have to fall back to [NEEDS VERIFICATION] on the most common
 * courts (Federal Court, Ontario Superior Court).
 *
 * The text is paraphrased from publicly available notices current to
 * 2026-04; counsel must verify against the authoritative source before
 * filing — that is the entire point of the disclosure memo persona.
 *
 * Sources: publicly available practice directions and consolidated notices
 * on the courts' own websites.
 */

import type { CognitionItem } from "./types.js";

export const COURT_AI_USE_AUTHORITIES: CognitionItem[] = [
  {
    id: "auth-fc-consolidated-ai-notice",
    organizationId: "preview",
    title:
      "Federal Court — Consolidated Notice on the Use of Artificial Intelligence in Court Proceedings",
    source: "Federal Court of Canada — Consolidated Notice / Practice Direction (AI)",
    jurisdiction: "federal",
    registrationCategories: ["litigation", "counsel", "none"],
    sourceType: "practice-direction",
    authorityDate: "2024-05-07",
    content: `Federal Court — Use of Artificial Intelligence in Court Proceedings

Framework:
- Transparency: a party or counsel relying on AI-generated or AI-assisted content in a document submitted to the Court is expected to disclose that fact. The disclosure should identify which portions of the document were AI-assisted and, where material, the tool used.
- Accuracy: counsel must verify the accuracy and authenticity of any AI-assisted content, including citations to legislation, case law, and other authorities, before filing.
- Accountability: counsel and self-represented litigants remain fully responsible for the accuracy of materials filed with the Court, regardless of whether AI was used in their preparation.

Consequences of non-disclosure or inaccuracy:
- The Court may require further submissions, strike passages, or impose costs against a party whose filing contains inaccurate AI-generated content.
- Repeated or egregious failures may be referred to the relevant law society.

Form of disclosure:
- No mandatory form; a brief statement in the filed document or in a covering letter is accepted.
- Where the Court has directed a specific form of disclosure in a case-management order, that form controls.`,
  },
  {
    id: "auth-onsc-ai-practice-direction",
    organizationId: "preview",
    title:
      "Ontario Superior Court of Justice — Practice Direction on the Use of Artificial Intelligence",
    source: "Ontario Superior Court of Justice — Practice Direction (AI use)",
    jurisdiction: "ontario",
    registrationCategories: ["litigation", "counsel", "none"],
    sourceType: "practice-direction",
    authorityDate: "2024-03-14",
    content: `Ontario Superior Court of Justice — Use of Generative AI

Core obligations for counsel and self-represented litigants:
1. Transparency — counsel must disclose the use of generative AI in preparing documents submitted to the Court. The disclosure should identify the portions of the document generated or substantially drafted by AI.
2. Accuracy — counsel must verify that every citation to legislation, case law, and secondary sources generated with AI assistance is real, correct, and supports the proposition for which it is cited.
3. Accountability — the duty of candour to the Court is not mitigated by the use of AI. Counsel bears full professional responsibility for all filed material.

Specific expectations:
- AI-generated content that has not been verified by counsel must not be filed.
- Fabricated or hallucinated citations are treated as a serious breach of counsel's professional obligations and may be referred to the Law Society of Ontario.
- The Court may require a disclosure statement at the front of any document where the Court has reason to believe AI was used.

Good practice:
- Maintain a record of AI tools used and the extent of use.
- Verify every citation against an authoritative source (CanLII, the official consolidation, or the reporter's text) before filing.
- Include a brief AI-use disclosure statement in the cover page or as an appendix to the filed document.`,
  },
  {
    id: "auth-abkb-ai-notice",
    organizationId: "preview",
    title: "Court of King's Bench of Alberta — Notice to the Profession on AI Use",
    source: "Court of King's Bench of Alberta — Notice to the Profession (generative AI)",
    jurisdiction: "alberta",
    registrationCategories: ["litigation", "counsel", "none"],
    sourceType: "practice-direction",
    authorityDate: "2023-10-06",
    content: `Court of King's Bench of Alberta — Generative AI in Court Proceedings

The Court expects counsel and self-represented litigants to:
(a) Disclose the use of generative AI tools in the preparation of any filed document.
(b) Independently verify any legal authorities, legislative provisions, or factual assertions generated by AI before inclusion in any filed material.
(c) Take full professional responsibility for the content and accuracy of filed materials.

Hallucinated or fabricated citations are not acceptable. Counsel who file materials containing such citations may be subject to costs, adverse inference, and referral to the Law Society of Alberta.`,
  },
  {
    id: "auth-bcsc-ai-practice-direction",
    organizationId: "preview",
    title: "Supreme Court of British Columbia — Practice Direction on AI",
    source: "Supreme Court of British Columbia — Practice Direction (AI use)",
    jurisdiction: "british-columbia",
    registrationCategories: ["litigation", "counsel", "none"],
    sourceType: "practice-direction",
    authorityDate: "2024-01-11",
    content: `Supreme Court of British Columbia — Use of Artificial Intelligence

Where AI has been used to generate or assist in preparing a document filed with the Court:
1. The party filing the document must disclose the use of AI.
2. Counsel must satisfy themselves that any AI-generated content is accurate, including that every citation to statute, regulation, or case law is genuine and cited for a proposition it in fact supports.
3. Counsel remains fully responsible for the filed material.

The Court may require a signed declaration confirming that AI-generated citations and substantive content have been verified.`,
  },
  {
    id: "auth-lso-ai-practice-guidance",
    organizationId: "preview",
    title: "Law Society of Ontario — Practice Management Helpline: Generative AI Guidance",
    source: "Law Society of Ontario — Practice Management Helpline (generative AI)",
    jurisdiction: "ontario",
    registrationCategories: ["litigation", "counsel", "none"],
    sourceType: "regulator-notice",
    authorityDate: "2024-07-19",
    content: `Law Society of Ontario — Lawyer obligations when using generative AI

Rule 3.1-1 (competence), Rule 5.1 (duty to the tribunal), and Rule 3.2 (quality of service) apply fully to work performed with AI assistance.

Core obligations:
- Competence: a lawyer using generative AI must understand the tool well enough to identify its limitations and risks.
- Verification: a lawyer must verify AI-generated legal content — citations, case holdings, statutory text — against an authoritative source before relying on it in client work or court filings.
- Confidentiality (Rule 3.3): do not input privileged client information into generative AI tools that do not provide adequate confidentiality and data-handling protections.
- Candour to the Tribunal (Rule 5.1-1): filing material containing fabricated AI citations violates the duty of candour.
- Supervision (Rule 6.1): a lawyer who delegates AI-assisted work to staff or paralegals remains responsible for verifying the output.

Best practice:
- Document AI tools used and the extent of their use on each matter.
- Include AI-use disclosure in court filings, consistent with the applicable court's practice direction.
- Maintain a written firm-level policy on AI use.`,
  },
  {
    id: "auth-cba-ai-guidance",
    organizationId: "preview",
    title: "Canadian Bar Association — Guidance on Generative AI for Lawyers",
    source: "Canadian Bar Association — Practice Guidance (generative AI)",
    jurisdiction: "federal",
    registrationCategories: ["litigation", "counsel", "none"],
    sourceType: "commentary",
    authorityDate: "2024-09-03",
    content: `Canadian Bar Association — Using Generative AI in Legal Practice

Key considerations across Canadian jurisdictions:
1. Competence: understand what the AI tool does, what data it was trained on, and what failure modes to guard against (hallucinated citations, outdated law).
2. Confidentiality: do not input privileged or confidential information into tools that do not meet the firm's data-handling standards; consult the firm's IT / risk committee before using any new AI tool on client matters.
3. Verification: every AI-generated citation, statute reference, or case summary must be verified against an authoritative source before being relied on. This is non-delegable.
4. Client consent: consider whether the retainer requires client notice or consent regarding AI use; for sensitive or high-stakes matters, seek express consent.
5. Disclosure: follow the applicable court's disclosure practice direction. When in doubt, disclose.
6. Fee fairness: do not bill hours not actually worked because AI accelerated the task. Consider fixed-fee or value-based billing where AI materially reduces time.

Record-keeping:
- Maintain a log of which AI tools were used on a file, by whom, for what purpose.
- Retain the prompt and, where material, the AI output before counsel's edits.`,
  },
  {
    id: "auth-counsel-duty-of-candour-ai",
    organizationId: "preview",
    title: "Duty of Candour + AI — Reference Summary for Filing Preparation",
    source: "Model Code of Professional Conduct / Law Society rules (summary)",
    jurisdiction: "federal",
    registrationCategories: ["litigation", "counsel", "none"],
    sourceType: "commentary",
    authorityDate: "2024-11-15",
    content: `Duty of Candour and Verification of AI-Generated Content

Rule references (vary by jurisdiction; summary applies across Canadian law societies):
- Duty of candour to the tribunal (Model Code Rule 5.1-1; LSO Rule 5.1-1; LSBC Rule 5.1): a lawyer shall not knowingly make a false representation of fact or law to a tribunal.
- A "false representation" includes citing a case or statutory provision the lawyer has not verified to exist and to stand for the proposition cited.
- Competence (Rule 3.1): a lawyer who relies on AI-generated legal content without verification falls below the standard of competence.

Consequences:
- Costs, adverse inferences, referral to the law society, and professional discipline have all followed reported cases of filed hallucinated AI citations.

Mitigation for AI-assisted filings:
1. Verify every citation against CanLII, the official legislation consolidation, or a reporter.
2. Confirm that each cited authority actually stands for the proposition it is cited for.
3. Include an AI-use disclosure statement consistent with the court's practice direction.
4. Have a named lawyer sign off that verification was performed before filing.`,
  },
];
