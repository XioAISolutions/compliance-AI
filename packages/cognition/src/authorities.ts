/**
 * Seed authorities for Ontario / EMD offering-memo review.
 *
 * These are the core regulatory texts that the OM reviewer persona needs
 * in its context. In production, these would come from a proper authority
 * library with full-text indexing. For the preview, we seed the cognition
 * store with key sections so retrieval actually returns real content.
 *
 * Sources: publicly available Canadian securities legislation and rules.
 */

import type { CognitionItem } from "./types.js";

export const ONTARIO_EMD_AUTHORITIES: CognitionItem[] = [
  {
    id: "auth-ni-45-106-2.9",
    organizationId: "preview",
    title: "NI 45-106 s. 2.9 — Offering Memorandum Exemption",
    source: "National Instrument 45-106 Prospectus Exemptions",
    jurisdiction: "ontario",
    registrationCategories: ["emd", "issuer"],
    content: `Section 2.9 — Offering memorandum
(1) The prospectus requirement does not apply to a distribution of a security to a person if:
(a) the person purchases the security as principal,
(b) the security is distributed in a jurisdiction listed in Appendix D,
(c) at the time of the distribution, an offering memorandum is delivered to the person that contains:
  (i) a description of the issuer's business and affairs,
  (ii) risk factors relating to the issuer's business and the security being offered,
  (iii) the use of the net proceeds to be raised,
  (iv) the rights of action available to the purchaser in the event that the offering memorandum contains a misrepresentation,
  (v) the financial statements required by the instrument,
  (vi) disclosure of compensation paid to sellers and finders.

The offering memorandum must be in the required form (Form 45-106F2 for non-qualifying issuers, Form 45-106F3 for qualifying issuers).`,
  },
  {
    id: "auth-osc-rule-45-501-5.2",
    organizationId: "preview",
    title: "OSC Rule 45-501 s. 5.2 — Rights of Action",
    source: "Ontario Securities Commission Rule 45-501",
    jurisdiction: "ontario",
    registrationCategories: ["emd", "issuer"],
    content: `Section 5.2 — Rights of action for damages and rescission
An offering memorandum delivered under section 2.9 of NI 45-106 must contain:
(a) a statement of the rights of action for damages or rescission available to the purchaser under section 130.1 of the Securities Act (Ontario), and
(b) the statutory language prescribed by the Securities Act (Ontario) for such rights.

The rights of action must be disclosed prominently and must include:
- The right to sue for damages if the offering memorandum contains a misrepresentation
- The right to rescind the purchase within 2 business days
- The limitation period for commencing an action (180 days for rescission, the earlier of 180 days after knowledge of misrepresentation or 3 years after the purchase for damages)`,
  },
  {
    id: "auth-ni-31-103-part-13",
    organizationId: "preview",
    title: "NI 31-103 Part 13 — Dealing with Clients (EMD Obligations)",
    source: "National Instrument 31-103 Registration Requirements",
    jurisdiction: "ontario",
    registrationCategories: ["emd"],
    content: `Part 13 — Dealing with clients

13.2 Know your client (KYC)
A registrant must take reasonable steps to:
(a) establish the identity of a client and, if the registrant has cause for concern, make reasonable inquiries as to the reputation of the client,
(b) establish whether the client is an insider of a reporting issuer or any other issuer whose securities are publicly traded,
(c) ensure that the suitability of a purchase or sale of a security is assessed before making a recommendation or accepting an instruction from the client.

13.3 Suitability
(1) A registrant must take reasonable steps to ensure that, before it makes a recommendation to or accepts an instruction from a client to buy or sell a security, the purchase or sale is suitable for the client.
(2) A registrant must not recommend a security to a client if the registrant's assessment is that the security is not suitable for the client.

13.13 Disclosure to clients — relationship disclosure information
An EMD must deliver to each client relationship disclosure information that includes:
(a) a description of the nature and type of the client's account,
(b) the products and services the registrant offers,
(c) the risks of using borrowed money to finance securities purchases,
(d) a description of the conflicts of interest the registrant is required to disclose,
(e) the fees the client will pay,
(f) a description of the complaint-handling process.`,
  },
  {
    id: "auth-securities-act-130.1",
    organizationId: "preview",
    title: "Securities Act (Ontario) s. 130.1 — Liability for OM Misrepresentation",
    source: "Securities Act, R.S.O. 1990, c. S.5",
    jurisdiction: "ontario",
    registrationCategories: ["emd", "issuer"],
    content: `Section 130.1 — Liability for misrepresentation in an offering memorandum
(1) Where an offering memorandum contains a misrepresentation, a purchaser who purchases a security offered by the offering memorandum during the period of distribution has, without regard to whether the purchaser relied on the misrepresentation:
(a) a right of action for damages against:
  (i) the issuer,
  (ii) every director of the issuer at the date of the offering memorandum, and
  (iii) every person who signed the offering memorandum; and
(b) a right of rescission against the issuer.

(3) No person is liable under subsection (1) if the person proves that the purchaser purchased the security with knowledge of the misrepresentation.

(4) The right of action for rescission is exercisable by the purchaser giving written notice to the issuer not later than 180 days after the date of the transaction that gave rise to the cause of action.`,
  },
  {
    id: "auth-ni-45-106-staff-notice",
    organizationId: "preview",
    title: "CSA Staff Notice 45-309 — Guidance for OM Issuers Using the OM Exemption",
    source: "Canadian Securities Administrators Staff Notice 45-309",
    jurisdiction: "ontario",
    registrationCategories: ["emd", "issuer"],
    content: `Staff Notice 45-309 — Guidance for issuers relying on the OM exemption

Key areas of concern identified by staff reviews:
1. Inadequate risk factor disclosure — risk factors must be specific to the issuer and the offering, not boilerplate. Generic risk factors like "the investment is speculative" are insufficient.
2. Vague use of proceeds — issuers must disclose with reasonable specificity how net proceeds will be used. "General corporate purposes" is not adequate as the sole use.
3. Missing or inadequate financial statements — issuers must include audited financial statements as required by the form, or the specific exemption from audit they are relying upon.
4. Forward-looking statements — any forward-looking information must include:
   (a) appropriate cautionary language identifying the statement as forward-looking,
   (b) a description of the material factors and assumptions used,
   (c) a statement that actual results may vary materially.
5. Conflicts of interest — all material conflicts of interest must be disclosed, including compensation arrangements with dealers and finders.
6. Marketing materials — any marketing materials used in connection with the offering should be consistent with the OM and must not contain a misrepresentation.`,
  },
  {
    id: "auth-ni-81-102-part-15",
    organizationId: "preview",
    title: "NI 81-102 Part 15 — Sales Communications and Prohibited Representations",
    source: "National Instrument 81-102 Investment Funds",
    jurisdiction: "ontario",
    registrationCategories: ["emd", "pm"],
    content: `Part 15 — Sales communications and prohibited representations

15.2 Prohibited representations
(1) An investment fund, its manager, or its principal distributor must not include in any sales communication:
(a) an untrue statement of a material fact,
(b) an omission to state a material fact necessary to prevent a statement from being misleading,
(c) performance data that is not calculated in accordance with Part 15,
(d) a statement that a regulatory authority has passed upon the merits of the securities offered.

15.3 Sales communications — general requirements
(1) Sales communications must not be misleading.
(2) Sales communications must be consistent with the disclosure in the fund's prospectus or offering memorandum.
(3) Performance data in sales communications must be calculated net of fees.

Note: While NI 81-102 applies primarily to investment funds, the principles in Part 15 regarding misleading sales communications are often applied by regulators as a benchmark for marketing materials used in connection with exempt distributions.`,
  },
];
