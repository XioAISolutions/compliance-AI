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

/**
 * FINTRAC / KYC authorities — applicable to EMDs, PMs, and IIROC members.
 */
export const FINTRAC_KYC_AUTHORITIES: CognitionItem[] = [
  {
    id: "auth-pcmltfa-6.2",
    organizationId: "preview",
    title: "PCMLTFA s. 6.2 — Ascertaining the Identity of Clients",
    source: "Proceeds of Crime (Money Laundering) and Terrorist Financing Act",
    jurisdiction: "ontario",
    registrationCategories: ["emd", "pm", "iiroc"],
    content: `Section 6.2 — Identification requirements
A reporting entity shall ascertain the identity of every person with whom it enters into a business relationship, in accordance with the prescribed methods and within the prescribed timeframes.

Required information for individuals:
(a) Name, address, date of birth
(b) Occupation
(c) Nature of the principal business

Ascertaining methods (Regulation s. 64):
1. Government-issued photo ID method — see the ID in person or through accepted verification methods
2. Credit file method — verify name, address, and date of birth match an existing credit file
3. Dual-process method — two independent reliable sources

Timing: identity must be ascertained at or before the first transaction, and in any event no later than 30 days after the account is opened.`,
  },
  {
    id: "auth-fintrac-guideline-6",
    organizationId: "preview",
    title: "FINTRAC Guideline 6G — Record Keeping and Client Identification for Securities Dealers",
    source: "FINTRAC Guideline 6G",
    jurisdiction: "ontario",
    registrationCategories: ["emd", "pm", "iiroc"],
    content: `Client records to be kept by securities dealers:
- Client information record (CIR) including all PCMLTFA s. 6.2 fields
- Beneficial ownership information for corporate/trust clients — 25% threshold
- Politically Exposed Person (PEP) determination — domestic, foreign, or head of international organization
- Source of funds and source of wealth documentation
- Ongoing monitoring records — transaction reviews, KYC updates
- Enhanced Due Diligence (EDD) for high-risk clients

PEP requirements:
- Screen at onboarding and periodically thereafter
- Senior officer approval required for account opening when a PEP is identified
- EDD including source of wealth verification and ongoing enhanced monitoring

Retention: all records must be kept for at least 5 years from last activity.`,
  },
  {
    id: "auth-ni-31-103-13.3-suitability",
    organizationId: "preview",
    title: "NI 31-103 s. 13.3 — Suitability Determination",
    source: "National Instrument 31-103 Registration Requirements",
    jurisdiction: "ontario",
    registrationCategories: ["emd", "pm", "iiroc"],
    content: `Section 13.3 — Suitability determination
(1) Before a registrant makes a recommendation or accepts an instruction to buy, sell, or hold a security, the registrant must determine, on a reasonable basis, that the action is suitable for the client by reference to the client's:
(a) personal circumstances (age, financial circumstances, investment objectives, time horizon, liquidity needs)
(b) investment knowledge
(c) financial situation (net worth, net income, net financial assets)
(d) risk profile (willingness AND ability to accept risk)
(e) concentration of holdings
(f) liquidity of holdings

(4) A registrant must revisit the suitability determination:
(a) when the client transfers assets in
(b) at least once every 36 months for a managed account
(c) at least once every 12 months for an advisory account if the registrant is aware of material changes
(d) promptly after becoming aware of a material change in client circumstances or the account

(5) The "put client's interest first" principle applies: where two otherwise suitable options exist, the registrant must put the client's interest ahead of its own or its affiliates'.`,
  },
  {
    id: "auth-osc-sn-33-316-suitability",
    organizationId: "preview",
    title: "OSC Staff Notice 33-316 — Suitability Best Practices",
    source: "Ontario Securities Commission Staff Notice 33-316",
    jurisdiction: "ontario",
    registrationCategories: ["emd", "pm"],
    content: `Staff Notice 33-316 — Common suitability deficiencies observed in compliance reviews

1. Generic KYC information: "conservative" without basis, "professional" as occupation, "moderate" risk tolerance without supporting factors.

2. Inconsistency between KYC factors: e.g., "low risk tolerance" with "growth" investment objective and "speculative" product purchased.

3. Inadequate suitability reviews: especially after KYC updates suggesting a less aggressive profile.

4. Concentration not assessed: holdings over 25% in a single issuer or illiquid product without documented rationale.

5. Put-client's-interest-first failures: choosing higher-commission products over otherwise-suitable lower-cost alternatives.

Best practices:
- Document the suitability analysis per trade (not just "suitable")
- Refresh KYC when the client reports material changes
- Escalate unusual client direction to compliance rather than executing blindly
- Keep contemporaneous notes of client conversations`,
  },
];

/**
 * NI 81-102 Part 15 sales-communication and marketing authorities.
 */
export const MARKETING_AUTHORITIES: CognitionItem[] = [
  {
    id: "auth-ni-31-103-13.18",
    organizationId: "preview",
    title: "NI 31-103 s. 13.18 — Misleading Communications",
    source: "National Instrument 31-103 Registration Requirements",
    jurisdiction: "ontario",
    registrationCategories: ["emd", "pm", "iiroc", "issuer"],
    content: `Section 13.18 — Misleading communications
(1) A registrant must not make a statement to a client, or in a sales communication, that:
(a) is untrue or misleading
(b) omits a material fact the omission of which makes the statement misleading
(c) would reasonably be considered to mislead

(2) A registrant must not offer any inducement to a client to enter into a transaction other than a temporary investment in an asset.

(3) No registrant shall represent or imply that:
(a) a security or investment is guaranteed or will achieve a particular result unless the guarantee is clearly disclosed in writing and the guarantor is identified
(b) a regulatory authority has endorsed or approved any security or product`,
  },
  {
    id: "auth-ni-81-102-15.2",
    organizationId: "preview",
    title: "NI 81-102 s. 15.2 — Prohibited Representations",
    source: "National Instrument 81-102 Investment Funds",
    jurisdiction: "ontario",
    registrationCategories: ["emd", "pm"],
    content: `Section 15.2 — Prohibited representations in sales communications

A sales communication must not:
(a) contain an untrue statement of material fact
(b) omit a material fact necessary to prevent a statement from being misleading
(c) present performance data not calculated per Part 15
(d) state or imply that a securities regulatory authority has passed upon the merits of the securities offered
(e) include unsubstantiated performance claims or predictions
(f) compare performance of two products without adjusting for material differences (fees, risk, time period)

Note: Part 15 principles are routinely applied by securities regulators to marketing materials in exempt distributions, not only to investment funds.`,
  },
  {
    id: "auth-ni-81-102-15.3",
    organizationId: "preview",
    title: "NI 81-102 s. 15.3 — Sales Communication Standards",
    source: "National Instrument 81-102 Investment Funds",
    jurisdiction: "ontario",
    registrationCategories: ["emd", "pm"],
    content: `Section 15.3 — Sales communication standards

(1) A sales communication must not be misleading.

(2) A sales communication must be consistent with the disclosure in the fund's prospectus or offering memorandum.

(3) Performance data presented in a sales communication must be:
(a) calculated using the total return formula in s. 15.9
(b) presented net of all fees and expenses
(c) accompanied by performance for each of the 1-, 3-, 5-, and 10-year periods (where available)
(d) accompanied by the statement: "Past performance does not guarantee future results"

(4) If performance data is shown for a period shorter than 1 year, a statement that the data is for a period less than 1 year and should not be annualized must accompany the performance.

(5) Forward-looking information must include cautionary language identifying the statement as forward-looking, a description of material factors and assumptions, and a statement that actual results may vary materially.`,
  },
];

/**
 * Exemplar regulator deficiency letter snippets for the response-memo drafter.
 * These are paraphrased patterns, not actual letters — they give the drafter
 * concrete language to cite against.
 */
export const REGULATOR_INQUIRY_AUTHORITIES: CognitionItem[] = [
  {
    id: "auth-osc-deficiency-pattern-suitability",
    organizationId: "preview",
    title: "OSC Compliance Field Review — Suitability Deficiencies (Pattern)",
    source: "OSC Staff Notice 33-747 Compliance Field Reviews (summary)",
    jurisdiction: "ontario",
    registrationCategories: ["emd", "pm"],
    content: `Common OSC deficiency patterns in suitability reviews:

1. KYC-KYP mismatch:
"Our review found that trades in high-risk securities were executed in accounts where the client's documented risk tolerance was 'low' or 'moderate'. Please explain how suitability was determined in these cases and describe your remediation."

2. Stale KYC:
"We identified N accounts where the KYC information had not been updated for more than 12 months despite material changes in the client's circumstances (e.g., retirement, job change). Please provide your policy for refreshing KYC and evidence of compliance."

3. Inadequate suitability documentation:
"The trade tickets we reviewed did not contain contemporaneous suitability documentation. Please describe the firm's policy and provide a sample of recent trade documentation showing the suitability analysis."

4. Concentration risk:
"Accounts A, B, and C held more than 40% in a single illiquid security without any documented concentration-risk analysis. Please explain."

Expected response elements:
- Admission or factual disagreement (with supporting documentation)
- Remedial plan with timeline (usually 60-90 days)
- Ongoing monitoring process
- Training commitment`,
  },
  {
    id: "auth-ciro-finding-trade-surveillance",
    organizationId: "preview",
    title: "CIRO (IIROC) Compliance Examination — Trade Surveillance Findings (Pattern)",
    source: "CIRO/IIROC dealer member examination reports (summary)",
    jurisdiction: "ontario",
    registrationCategories: ["iiroc"],
    content: `Common CIRO (formerly IIROC) findings in trade surveillance examinations:

1. Inadequate alert triage:
"The firm's trade-surveillance system generated N alerts in the review period. Of these, M were not reviewed within the firm's stated SLA. Please describe your alert-triage process and proposed remediation."

2. Insufficient written rationale for closed alerts:
"Alerts closed as 'false positive' or 'no action' did not contain sufficient contemporaneous rationale for the closure decision. Please update the firm's surveillance procedures."

3. Missing escalation:
"Alerts indicating potential market manipulation (layering, spoofing, wash trades) were closed without documented escalation to compliance or legal. Please describe your escalation criteria."

4. Policy-practice gap:
"The firm's written surveillance policy references systems and thresholds that are no longer in use. Please reconcile the policy with current practice."`,
  },
  {
    id: "auth-fintrac-deficiency-kyc",
    organizationId: "preview",
    title: "FINTRAC Compliance Examination — KYC Record Deficiencies (Pattern)",
    source: "FINTRAC compliance examination report summaries",
    jurisdiction: "ontario",
    registrationCategories: ["emd", "pm", "iiroc"],
    content: `Common FINTRAC findings in securities-dealer examinations:

1. Incomplete client identification:
"Of N files sampled, M did not contain evidence that identity was ascertained using one of the prescribed methods within 30 days of account opening. Please provide remediation."

2. Missing PEP determination:
"No documented PEP screening was on file for N accounts opened in the review period. FINTRAC expects documented evidence of screening at onboarding and periodic re-screening."

3. Inadequate beneficial ownership:
"For N corporate accounts, the beneficial ownership information obtained was either not current, not to the 25% threshold, or missing directors."

4. No ongoing monitoring records:
"The firm did not maintain evidence of ongoing monitoring or periodic KYC reviews for existing clients."

Standard FINTRAC remediation expectations:
- Full file re-papering within 60-120 days
- Updated written compliance program referencing deficiencies
- Training refresh for customer-facing staff
- Internal testing/audit of remediation effectiveness`,
  },
];

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
  ...FINTRAC_KYC_AUTHORITIES,
  ...MARKETING_AUTHORITIES,
  ...REGULATOR_INQUIRY_AUTHORITIES,
];
