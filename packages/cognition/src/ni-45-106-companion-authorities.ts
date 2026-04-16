/**
 * Companion authorities for NI 45-106 OM review.
 *
 * When a securities lawyer reviews an offering memorandum under NI 45-106,
 * they never cite the instrument alone. These are the cross-references that
 * appear in essentially every OM review opinion:
 *
 *   - NI 45-102 Resale of Securities — 4-month hold period, first-trade
 *     restrictions, resale into accredited-investor markets. Every OM
 *     must disclose resale restrictions; this is the source.
 *   - Companion Policy 45-106CP — CSA's published interpretive guidance
 *     for NI 45-106 (how staff read the rules in practice).
 *   - CSA Staff Notice 45-318 — current guidance for issuers relying on
 *     the OM exemption, superseding prior staff notices on recurring
 *     deficiency themes.
 *   - OSC Staff Notice 45-716 (Ontario Compliance and Registrant Regulation)
 *     — Ontario-specific OM review findings and expected practices.
 *
 * These items complement NI_45_106_AUTHORITIES and are spread into the
 * Ontario EMD authority seed.
 *
 * All text here is drawn from publicly available Canadian securities
 * legislation, rules, and CSA staff notices. Excerpts are summarized for
 * retrieval-augmented reasoning; they are not the operative instrument
 * and should not be cited verbatim in a legal opinion without first
 * checking the current published version.
 */

import type { CognitionItem } from "./types.js";

export const NI_45_102_RESALE_AUTHORITIES: CognitionItem[] = [
  {
    id: "auth-ni-45-102-2.5",
    organizationId: "preview",
    title: "NI 45-102 s. 2.5 — Restricted period (four-month hold)",
    source: "National Instrument 45-102 Resale of Securities",
    jurisdiction: "ontario",
    registrationCategories: ["emd", "issuer"],
    content: `Section 2.5 — Restricted period (four-month hold)

A trade of a security is subject to a restricted period if the security was distributed under a prospectus exemption (including NI 45-106 s. 2.9 Offering Memorandum, s. 2.3 Accredited Investor, s. 2.10 Minimum Amount, s. 2.5 Family/Friends, and s. 2.4 Private Issuer).

Core rule: the resale of a security acquired under an exempt distribution is subject to a restricted period of 4 months from the distribution date. The resale is only permitted if:
(a) the issuer is a reporting issuer in a jurisdiction of Canada for the 4 months immediately preceding the trade,
(b) at least 4 months have elapsed from the distribution date,
(c) any certificate representing the security carries a legend in the form set out in subsection 2.5(2)(b) ("Unless permitted under securities legislation, the holder of this security must not trade the security before [insert date]"),
(d) the trade is not a control distribution,
(e) no unusual effort is made to prepare the market or create a demand for the security, and
(f) no extraordinary commission or consideration is paid.

If the issuer is NOT a reporting issuer, the security is subject to an indefinite hold — the first trade is a distribution unless another prospectus exemption is available (for example, resale to an accredited investor under NI 45-102 s. 2.8, or resale 4 months after the issuer becomes a reporting issuer).

OM-review implication: an OM must disclose the resale restriction clearly. Lawyers look for a "Resale Restrictions" section stating (i) the 4-month hold period, (ii) the legend language, and (iii) whether the issuer is currently a reporting issuer (which governs whether the 4-month clock even starts).

Source: NI 45-102 unofficial consolidation; interpretation cross-references NI 45-106 Appendix D listing jurisdictions.`,
  },
  {
    id: "auth-ni-45-102-2.8",
    organizationId: "preview",
    title: "NI 45-102 s. 2.8 — Resale into accredited-investor markets",
    source: "National Instrument 45-102 Resale of Securities",
    jurisdiction: "ontario",
    registrationCategories: ["emd", "issuer"],
    content: `Section 2.8 — Resale to accredited investors and other exempt purchasers

The first trade of a security acquired under a prospectus exemption is itself a distribution — but the seller can avoid a prospectus by relying on another prospectus exemption at the time of resale. The most commonly cited resale exemption for OM purchasers:

(1) Resale to an accredited investor: the seller may rely on NI 45-106 s. 2.3 (Accredited Investor) to resell to another AI. The resale must independently satisfy the AI exemption — the new purchaser must qualify as an AI at the time of resale, the seller must obtain AI certification, and the resale must be made as principal (not through an agent).

(2) Resale to the issuer: NI 45-106 s. 2.15 (Issuer acquisition) allows sale back to the issuer without a prospectus.

(3) Resale in connection with a take-over bid / issuer bid: NI 45-106 s. 2.16 applies.

(4) Resale under a control-block distribution: NI 45-102 Part 2.12 permits resale by an insider subject to filing Form 45-102F1 and observing dribble-out rules.

OM-review implication: the OM should explain that resale is restricted but not impossible — it may be resold into the same exempt markets (primarily AI) subject to the same diligence requirements as an initial AI distribution. Lawyers flag OMs that state "the securities cannot be resold" without qualification, since this misstates the law.

Source: NI 45-102; cross-references NI 45-106 ss. 2.3, 2.15, 2.16, and 2.10.`,
  },
  {
    id: "auth-ni-45-102-2.6",
    organizationId: "preview",
    title: "NI 45-102 s. 2.6 — Seasoning period (issuer becomes reporting issuer)",
    source: "National Instrument 45-102 Resale of Securities",
    jurisdiction: "ontario",
    registrationCategories: ["emd", "issuer"],
    content: `Section 2.6 — Seasoning period — non-reporting issuer becoming a reporting issuer

When an issuer was not a reporting issuer at the time of the exempt distribution but subsequently becomes one, the restricted period under NI 45-102 runs 4 months from the later of (a) the distribution date and (b) the date the issuer becomes a reporting issuer in a Canadian jurisdiction.

The 4-month seasoning period exists to ensure that continuous disclosure has been available to the market long enough to season the security — only after that period does the normal 4-month hold end.

OM-review implication: OMs for non-reporting issuers (the common case for private placements) must disclose that the resale-restriction clock does NOT start until the issuer becomes a reporting issuer, if ever. Many OMs mis-disclose this by quoting only the 4-month hold without the seasoning qualifier. Lawyers insist on corrective language.

Source: NI 45-102 s. 2.6; companion guidance in CP 45-102.`,
  },
];

export const CP_45_106_COMPANION_POLICY_AUTHORITIES: CognitionItem[] = [
  {
    id: "auth-cp-45-106-2.9",
    organizationId: "preview",
    title: "Companion Policy 45-106CP — Guidance on s. 2.9 Offering Memorandum exemption",
    source: "Companion Policy 45-106CP — Prospectus Exemptions",
    jurisdiction: "ontario",
    registrationCategories: ["emd", "issuer"],
    content: `CP 45-106CP — Guidance on the Offering Memorandum exemption (s. 2.9)

The Companion Policy is the CSA's published interpretation of NI 45-106. While not binding, staff expect compliance with the positions set out in the CP and OMs are reviewed against this guidance.

Key CP 45-106CP positions on the OM exemption:

1. Risk factor adequacy — the CP states risk factors must be specific to the issuer, specific to the security, and specific to the offering. Boilerplate risk factors ("the securities are speculative and should only be purchased by investors who can afford a total loss") are, on their own, insufficient. Staff expect issuer-specific risks (e.g., concentration risk if revenue depends on a single customer; regulatory risk for a named pending regulation; liquidity risk for securities of an issuer with no trading market).

2. Use of proceeds specificity — "general corporate purposes" as the sole use is NOT adequate. CP expects an itemized allocation (e.g., "50% working capital, 30% property acquisition, 20% marketing and sales"), with dollar amounts where possible. Contingencies ("if we raise more than $X") should be addressed.

3. Forward-looking information — any FLI must include (a) a statement identifying the information as forward-looking, (b) the material factors and assumptions used, and (c) a statement that actual results may vary materially. Unsupported projections or "target returns" without reasonable basis disclosure are treated as potentially misleading.

4. Marketing materials — marketing pieces used in connection with an OM offering are deemed incorporated by reference into the OM (NI 45-106 s. 2.9(2.1)). Any misrepresentation in a marketing piece is a misrepresentation in the OM and triggers s. 130.1 Securities Act (Ontario) liability. Staff expect issuers to file marketing materials with regulators on or before delivery to purchasers.

5. Related-party transactions — all material related-party transactions must be disclosed with sufficient detail to assess fairness. Staff expect (a) identification of the related party, (b) the nature of the relationship, (c) the terms of the transaction, and (d) the basis for pricing (independent valuation, comparable transactions, etc.).

6. Financial statements — OMs from non-qualifying issuers (Form 45-106F2) must include audited annual financial statements for the most recent 2 completed financial years, or the transition period equivalent. Stub-period interims are required if the OM is delivered more than 90 days after year-end.

OM-review implication: this CP is the lawyer's road map for recurring deficiency themes. Most OM redline cycles focus on these six items.

Source: CP 45-106CP; most recently updated alongside NI 45-106 consolidation.`,
  },
];

export const CSA_STAFF_NOTICES_45: CognitionItem[] = [
  {
    id: "auth-csa-sn-45-318",
    organizationId: "preview",
    title: "CSA Staff Notice 45-318 — Guidance for Issuers Using the OM Exemption",
    source: "CSA Staff Notice 45-318",
    jurisdiction: "ontario",
    registrationCategories: ["emd", "issuer"],
    content: `CSA Staff Notice 45-318 — Guidance for Issuers Using the Offering Memorandum Exemption

Staff notice summarizing recurring OM deficiencies observed in CSA compliance reviews and setting out staff's expectations for the next review cycle.

Top deficiency themes (reorganized in the lawyer's review order):

A. Disclosure deficiencies
1. Risk factors generic or missing issuer-specific risks.
2. Use of proceeds vague; no itemization; "general corporate purposes" with no further detail.
3. Forward-looking statements without cautionary language, without identifying material assumptions, and without a statement that actual results may vary.
4. Compensation to dealers and finders incomplete or not disclosed at all.
5. Related-party transactions not disclosed or disclosed without pricing rationale.
6. Missing or inadequate cover-page disclosure (issuer name, offered security, price, offering size).

B. Form-compliance deficiencies
7. Financial statements missing the required stub-period interims.
8. Auditor's report omitted or on prior year's statements only.
9. Risk acknowledgement form (Form 45-106F4) not delivered OR not signed before purchase (NI 45-106 s. 2.9(4)).
10. Report of exempt distribution (Form 45-106F1) not filed, or filed beyond the 10-day window under NI 45-106 s. 6.1(2).

C. Eligibility and suitability
11. Purchasers not meeting the "eligible investor" or "accredited investor" definitions — some issuers misclassify.
12. Investment exceeding the $10,000 / $30,000 investment limits under NI 45-106 s. 2.9(2.1) for eligible investors who do not qualify as AIs.
13. Suitability assessment by EMD not documented (NI 31-103 s. 13.3 cross-reference).

D. Marketing and sales conduct
14. Marketing materials containing performance "forecasts" without the forecast-support disclosure required by NI 81-102 Part 15 (to the extent applicable) and Companion Policy 45-106CP.
15. Marketing to a broader audience than the AI/eligible-investor base — any dissemination beyond the exempt class risks distribution to non-exempt purchasers and creates statutory liability.

Staff expectation: issuers cure these themes BEFORE delivering OMs to purchasers. After delivery, cure requires rescission offer under NI 45-102 and potential s. 130.1 damages liability.

Source: CSA Staff Notice 45-318 (current version as of the 2025-12-04 NI 45-106 consolidation).`,
  },
  {
    id: "auth-osc-sn-45-716",
    organizationId: "preview",
    title: "OSC Staff Notice 45-716 — Ontario-specific OM review findings and practices",
    source: "Ontario Securities Commission Staff Notice 45-716",
    jurisdiction: "ontario",
    registrationCategories: ["emd", "issuer"],
    content: `OSC Staff Notice 45-716 — Ontario OM Review Findings

Ontario-specific staff notice documenting OM review findings by OSC Corporate Finance. Applies in addition to CSA SN 45-318 for any OM distributed into Ontario.

Ontario-specific expectations:

1. Rights of action — the OM must contain the statutory rights of action set out in section 5.2 of OSC Rule 45-501 (Ontario Prospectus and Registration Exemptions) and track the language of section 130.1 of the Securities Act (Ontario). Staff will flag any deviation from the prescribed language.

2. Eligibility disclosure — NI 45-106 s. 2.9 is not available in Ontario for Ontario purchasers unless the special Ontario eligibility test is met. For Ontario distributions, the OM must disclose which Ontario exemption is relied upon and must be delivered concurrently with a Form 45-106F4 risk acknowledgement where the exemption requires it.

3. Form 45-106F4 delivery — in Ontario, the risk acknowledgement must be completed and signed by the purchaser before or at the time of purchase. Post-purchase signing is treated as a failure to comply with the exemption condition, making the distribution a distribution without a prospectus (and triggering rescission rights).

4. Insider and related-issuer disclosure — any connection between the issuer and the dealer (e.g., common directors, common control, promoter of both) must be disclosed. OSC staff pay particular attention to related-issuer disclosure in real-estate and MIC offerings.

5. Concentration and leverage warnings — for offerings by issuers whose capital structure involves significant leverage or a single underlying asset, staff expect enhanced risk disclosure including sensitivity analysis to interest rate or property-value changes.

6. Financial statement exemption — Ontario does not automatically grant the Alberta-style two-year-only financial statement exemption; the standard NI 45-106 requirement (2 most recent completed financial years + applicable stub period) applies.

OM-review implication: Ontario OMs must include BOTH the CSA-wide requirements (under NI 45-106 + CSA SN 45-318) AND these Ontario-specific items. Lawyers who focus only on the NI often miss the Ontario layer.

Source: OSC Staff Notice 45-716; current version applicable to OMs distributed into Ontario as of the 2025-12-04 NI 45-106 consolidation.`,
  },
];

/**
 * Combined export — spread into ONTARIO_EMD_AUTHORITIES alongside the
 * NI_45_106_AUTHORITIES generated corpus.
 */
export const NI_45_106_COMPANION_AUTHORITIES: CognitionItem[] = [
  ...NI_45_102_RESALE_AUTHORITIES,
  ...CP_45_106_COMPANION_POLICY_AUTHORITIES,
  ...CSA_STAFF_NOTICES_45,
];
