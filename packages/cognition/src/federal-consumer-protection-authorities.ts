/**
 * Federal Canadian consumer protection authorities.
 *
 * This file covers federal statutes of general application that apply in
 * every province and territory alongside provincial consumer protection
 * legislation. The tag `jurisdiction: "federal"` restricts retrieval to
 * matters explicitly flagged federal, while matters flagged
 * "multi-provincial" and "federal" both surface these items via the
 * matter-scoped retrieval path.
 *
 * Sources: publicly available federal statutes and regulations
 * (justice.gc.ca). Excerpts are summarized; operative text should always
 * be checked against the current consolidation before being cited in a
 * formal opinion.
 *
 * Coverage:
 *   - Competition Act (misleading advertising, drip pricing, performance
 *     claims, ordinary-price representations)
 *   - Consumer Packaging and Labelling Act (CPLA)
 *   - Textile Labelling Act
 *   - Canada Consumer Product Safety Act (CCPSA)
 *   - Food and Drugs Act (labelling subset)
 *   - PIPEDA (consent, privacy breach reporting)
 *   - Canada's Anti-Spam Legislation (CASL)
 *   - Bank Act Financial Consumer Protection Framework
 *   - Financial Consumer Agency of Canada Act
 */

import type { CognitionItem } from "./types.js";

export const FEDERAL_CONSUMER_PROTECTION_AUTHORITIES: CognitionItem[] = [
  // ---------------------------------------------------------------------
  // Competition Act
  // ---------------------------------------------------------------------
  {
    id: "auth-ca-competition-act-52",
    organizationId: "preview",
    title: "Competition Act s. 52 — False or misleading representations (criminal)",
    source: "Competition Act, R.S.C. 1985, c. C-34",
    jurisdiction: "federal",
    registrationCategories: ["consumer-protection", "supplier"],
    content: `Section 52 — False or misleading representations (criminal track)

(1) No person shall, for the purpose of promoting, directly or indirectly, the supply or use of a product, or for the purpose of promoting, directly or indirectly, any business interest, by any means whatever, knowingly or recklessly make a representation to the public that is false or misleading in a material respect.

(1.1) For greater certainty, in establishing that a representation is false or misleading, it is not necessary to prove that:
(a) any person was actually deceived or misled;
(b) any member of the public to whom the representation was made was within Canada; or
(c) the representation was made in a place to which the public had access.

(4) General impression test — in a prosecution, the court shall consider (a) the general impression conveyed, and (b) the literal meaning. Both must be assessed; the general impression governs if it differs from the literal text.

Penalties: on indictment, fine in the court's discretion and/or imprisonment up to 14 years; on summary conviction, fine up to $200,000 and/or imprisonment up to 1 year (s. 52(5)).

Practical effect: the criminal track requires mens rea ("knowingly or recklessly"). Most advertising cases proceed under s. 74.01 (civil track, strict liability) instead.`,
  },
  {
    id: "auth-ca-competition-act-74.01",
    organizationId: "preview",
    title: "Competition Act s. 74.01 — Misleading advertising (civil)",
    source: "Competition Act, R.S.C. 1985, c. C-34",
    jurisdiction: "federal",
    registrationCategories: ["consumer-protection", "supplier"],
    content: `Section 74.01 — Deceptive marketing practices (reviewable conduct, civil track)

(1) A person engages in reviewable conduct who, for the purpose of promoting, directly or indirectly, the supply or use of a product, or any business interest, by any means whatever:
(a) makes a representation to the public that is false or misleading in a material respect;
(b) makes a representation to the public in the form of a statement, warranty or guarantee of the performance, efficacy or length of life of a product that is not based on an adequate and proper test thereof, the proof of which lies on the person making the representation; or
(c) makes a representation to the public in a form that purports to be a warranty or guarantee of a product or a promise to replace, maintain or repair an article and that is materially misleading or if there is no reasonable prospect of being carried out.

(2) Ordinary-price representations — a supplier shall not represent a savings or discount from an "ordinary price" unless a substantial volume of the product was sold at that price (or a higher price) within a reasonable period before or after the representation (volume test, s. 74.01(2)(a)), OR the product was offered in good faith for sale at that price for a substantial period within such reasonable time (time test, s. 74.01(2)(b)).

(6) General impression test — as with s. 52, the court considers both the general impression conveyed and the literal meaning.

Remedies (s. 74.1): Competition Tribunal may order the person to stop the conduct, publish corrective notice, pay an administrative monetary penalty (AMP), and, since the 2022 and 2024 amendments, pay restitution to purchasers. Maximum AMPs for corporations: the greater of $10 million ($15 million for repeat conduct) or three times the benefit derived — or, if that cannot be determined, 3% of the corporation's annual worldwide gross revenues.`,
  },
  {
    id: "auth-ca-competition-act-74.011",
    organizationId: "preview",
    title: "Competition Act s. 74.011 — Drip pricing",
    source: "Competition Act, R.S.C. 1985, c. C-34",
    jurisdiction: "federal",
    registrationCategories: ["consumer-protection", "supplier", "distance-seller"],
    content: `Section 74.011 — Drip pricing (added by S.C. 2022, c. 10, s. 259)

(1) The making of a representation of a price that is not attainable due to fixed obligatory charges or fees is a false or misleading representation.

(2) Subsection (1) does not apply to the extent that the obligatory charges or fees represent only an amount imposed on a purchaser by an Act of Parliament or the legislature of a province (e.g., GST/HST, PST).

Effect: headline prices must include every mandatory fee except government-imposed taxes. "Resort fees," "service fees," "processing fees," "booking fees" imposed by the supplier must be included in the advertised price. Separately disclosing the fee later in the purchase flow does not cure the violation.

Enforcement: the Competition Bureau has publicly signalled drip pricing as an enforcement priority since 2022. AMPs and restitution under s. 74.1 apply. The Bureau's 2024 Cineplex decision ($38.9M AMP) is the leading authority on what is "obligatory" for drip-pricing purposes.`,
  },
  {
    id: "auth-ca-competition-act-74.02",
    organizationId: "preview",
    title: "Competition Act s. 74.02 — Untested performance claims",
    source: "Competition Act, R.S.C. 1985, c. C-34",
    jurisdiction: "federal",
    registrationCategories: ["consumer-protection", "supplier"],
    content: `Section 74.02 — Representations as to performance, efficacy or length of life

A person engages in reviewable conduct who makes a representation to the public in the form of a statement, warranty or guarantee of the performance, efficacy or length of life of a product unless the representation is based on an adequate and proper test.

Burden of proof: the burden is on the person making the representation to prove that the test was adequate and proper, and that the test was conducted before the representation was made (reverse onus).

"Adequate and proper test" — the test must:
(a) reflect the real-world conditions in which the product will be used;
(b) be designed and executed in a manner that would reasonably support the representation (sample size, methodology, control for variables);
(c) have been performed before the claim was made publicly (pre-substantiation).

Health claims, environmental claims (greenwashing), and comparative performance claims are all caught. The 2024 amendments added specific s. 74.01(1)(b.1) and (b.2) rules requiring adequate and proper testing for environmental and business-representation claims — reverse onus applies.`,
  },
  {
    id: "auth-ca-competition-act-74.03",
    organizationId: "preview",
    title: "Competition Act s. 74.03 — Testimonials and bait-and-switch",
    source: "Competition Act, R.S.C. 1985, c. C-34",
    jurisdiction: "federal",
    registrationCategories: ["consumer-protection", "supplier"],
    content: `Section 74.03 — Other deceptive practices

(1) Testimonials — publishing a testimonial not in the form given by the person making it, or published without the person's authorization, is reviewable conduct. The supplier bears the burden of proving authorization.

(2) Influencer endorsements — undisclosed material connection between an endorser and the supplier is treated as a misleading representation. CSA-equivalent guidance (Competition Bureau's Deceptive Marketing Practices Digest) requires clear and conspicuous disclosure (#ad, #sponsored) of any "material connection."

Section 74.04 — Bait-and-switch selling
No person shall advertise a product at a bargain price that the person does not supply in reasonable quantities having regard to the nature of the market, the nature and size of the person's business, and the nature of the advertisement. Defences: the supplier took reasonable steps to obtain sufficient quantity, or the advertisement disclosed a specific quantity limit.

Section 74.05 — Sale above advertised price
No supplier shall sell a product at a price higher than its advertised price within the market to which the advertisement relates. Defence: prompt correction of an in-store error.`,
  },
  // ---------------------------------------------------------------------
  // Consumer Packaging and Labelling Act (CPLA)
  // ---------------------------------------------------------------------
  {
    id: "auth-ca-cpla-7",
    organizationId: "preview",
    title: "Consumer Packaging and Labelling Act s. 7 — Prohibition on misleading packaging",
    source: "Consumer Packaging and Labelling Act, R.S.C. 1985, c. C-38",
    jurisdiction: "federal",
    registrationCategories: ["consumer-protection", "supplier", "retailer"],
    content: `Section 7 — Prohibition

(1) No dealer shall apply to any prepackaged product or sell, import into Canada or advertise any prepackaged product that has applied to it a label containing any false or misleading representation that relates to or may reasonably be regarded as relating to that product.

(2) A false or misleading representation includes:
(a) any representation in which expressions, words, figures, depictions or symbols are used, arranged or shown in a manner that may reasonably be regarded as qualifying the declared net quantity of a prepackaged product or as likely to deceive a consumer with respect to the net quantity of a prepackaged product;
(b) any expression, word, figure, depiction or symbol that implies or may reasonably be regarded as implying that a prepackaged product contains any matter not contained in it or does not contain any matter in fact contained in it; and
(c) any description or illustration of the type, quality, performance, function, origin or method of manufacture or production of a prepackaged product that may reasonably be regarded as likely to deceive a consumer with respect to the matter so described or illustrated.

Required label elements (s. 4 and Regulations):
- Product identity declaration
- Net quantity (metric, with imperial optional)
- Dealer's name and principal place of business
- Bilingual presentation (English and French) for mandatory information`,
  },
  // ---------------------------------------------------------------------
  // Canada Consumer Product Safety Act
  // ---------------------------------------------------------------------
  {
    id: "auth-ca-ccpsa-7",
    organizationId: "preview",
    title: "Canada Consumer Product Safety Act s. 7-8 — Prohibited conduct and Schedule 2",
    source: "Canada Consumer Product Safety Act, S.C. 2010, c. 21",
    jurisdiction: "federal",
    registrationCategories: ["consumer-protection", "supplier", "retailer"],
    content: `Section 7 — General prohibition

No person shall manufacture, import, advertise, sell or label a consumer product that:
(a) is a danger to human health or safety;
(b) is the subject of a recall order under s. 31 or a voluntary recall notice referenced in s. 15;
(c) does not meet the requirements under the Regulations; or
(d) is listed in Schedule 2 (items such as baby walkers, lawn darts, polycarbonate baby bottles containing BPA, jequirity beans).

Section 8 — Advertising or selling for consideration — it is also prohibited to advertise or sell a consumer product that is manufactured, imported, packaged or labelled in contravention of the Act.

Section 14 — Incident reporting: suppliers must report to the Minister and provide information about:
(a) any incident involving the product within 2 days of becoming aware of it; and
(b) a full written report within 10 days describing the incident, the affected product, and any corrective measures.

Section 31 — Recall power: the Minister may order a recall if the Minister believes on reasonable grounds that a consumer product is a danger to human health or safety.

Maximum penalties: on indictment, fine up to $5 million per day of contravention for corporations; on summary conviction, $250,000 fine and/or 6 months imprisonment; knowingly/recklessly prohibited conduct attracts fines in the court's discretion.`,
  },
  // ---------------------------------------------------------------------
  // PIPEDA
  // ---------------------------------------------------------------------
  {
    id: "auth-ca-pipeda-principle-3",
    organizationId: "preview",
    title: "PIPEDA — Schedule 1 Principle 3 (Consent)",
    source: "Personal Information Protection and Electronic Documents Act, S.C. 2000, c. 5",
    jurisdiction: "federal",
    registrationCategories: ["consumer-protection", "supplier", "distance-seller"],
    content: `Schedule 1, Principle 4.3 — Consent

4.3 The knowledge and consent of the individual are required for the collection, use or disclosure of personal information, except where inappropriate.

4.3.2 Consent is required before or at the time of collection. Consent is also required for any new purpose of use or disclosure that was not identified at the time of collection.

4.3.4 The form of consent required depends on the sensitivity of the information and the reasonable expectations of the individual. Express consent is generally required for sensitive information (financial details, health information, personal profiling for advertising purposes) and for secondary uses not reasonably expected.

4.3.5 Consent may not be obtained through deception. An organization shall not, as a condition of the supply of a product or service, require an individual to consent to the collection, use or disclosure of information beyond that required to fulfil the explicitly specified and legitimate purposes (s. 5(3) — "only for purposes that a reasonable person would consider appropriate in the circumstances").

4.3.8 An individual may withdraw consent at any time, subject to legal or contractual restrictions and reasonable notice.

Consumer-protection overlap: dark patterns that coerce or mislead the user into over-consent (pre-checked boxes, forced unbundled consents, layered dialogs hiding decline options) are deficient under Principle 4.3 and under the "reasonable person" test in s. 5(3).`,
  },
  {
    id: "auth-ca-pipeda-breach-reporting",
    organizationId: "preview",
    title: "PIPEDA s. 10.1 — Mandatory breach reporting",
    source: "Personal Information Protection and Electronic Documents Act, S.C. 2000, c. 5",
    jurisdiction: "federal",
    registrationCategories: ["consumer-protection", "supplier"],
    content: `Section 10.1 — Report to the Privacy Commissioner and notification to affected individuals

(1) An organization shall report to the Privacy Commissioner any breach of security safeguards involving personal information under its control if it is reasonable in the circumstances to believe that the breach creates a real risk of significant harm to an individual.

(3) Notification to the individual is required if the breach creates a real risk of significant harm. Notification must be given as soon as feasible after the organization determines that the breach has occurred.

(5) "Significant harm" includes bodily harm, humiliation, damage to reputation or relationships, loss of employment, business or professional opportunities, financial loss, identity theft, negative effects on the credit record, and damage to or loss of property.

(6) Factors relevant to whether a breach creates a real risk of significant harm:
(a) the sensitivity of the personal information involved; and
(b) the probability that the information has been, is being or will be misused.

Section 10.3 — Records: the organization shall keep and maintain a record of every breach of security safeguards involving personal information under its control.

Breach Regulations (SOR/2018-64) — the notification must contain a description of the circumstances, the date (or period), the information involved, the steps the organization has taken to reduce risk, and contact information for further questions.`,
  },
  // ---------------------------------------------------------------------
  // CASL
  // ---------------------------------------------------------------------
  {
    id: "auth-ca-casl-6",
    organizationId: "preview",
    title: "CASL s. 6 — Commercial electronic messages (consent + ID + unsubscribe)",
    source: "An Act to promote the efficiency and adaptability of the Canadian economy (CASL), S.C. 2010, c. 23",
    jurisdiction: "federal",
    registrationCategories: ["consumer-protection", "supplier", "distance-seller"],
    content: `Section 6 — Prohibition on sending commercial electronic messages (CEMs)

(1) No person shall send, cause or permit to be sent to an electronic address a commercial electronic message unless:
(a) the person to whom the message is sent has consented to receiving it (express or implied), and
(b) the message complies with subsection (2).

(2) A CEM must contain:
(a) the name and contact information of the person sending the message (or on whose behalf it is sent);
(b) information enabling the recipient to readily contact the sender (valid for at least 60 days after the message is sent); and
(c) an unsubscribe mechanism that:
  (i) can be readily performed,
  (ii) is included in the message itself or a link that is accessible without difficulty or delay, and
  (iii) is given effect within 10 business days.

Implied consent (s. 10(9)): a pre-existing business relationship within the prior 2 years (purchase, contract, lease, inquiry) or a pre-existing non-business relationship (membership, donation, volunteering) within the prior 2 years. Conspicuously published business email addresses can support implied consent where (a) consent is not refused and (b) the message relates to the recipient's business role.

Express consent: must be informed, specific, and opt-in. Pre-checked boxes are not valid express consent. The organization bears the burden of proving consent (s. 13).

Penalties: AMPs up to $10 million per violation for corporations, $1 million for individuals (s. 20). Private right of action provisions were repealed in 2017 and replaced with CRTC enforcement.`,
  },
  // ---------------------------------------------------------------------
  // Bank Act Financial Consumer Protection Framework
  // ---------------------------------------------------------------------
  {
    id: "auth-ca-bank-act-fcpf",
    organizationId: "preview",
    title: "Bank Act — Financial Consumer Protection Framework (s. 627.01 et seq.)",
    source: "Bank Act, S.C. 1991, c. 46 (as amended by the Budget Implementation Act 2018, No. 2)",
    jurisdiction: "federal",
    registrationCategories: ["consumer-protection", "financial-institution"],
    content: `Division 2 of Part XII.2 — Financial Consumer Protection Framework (in force 30 June 2022)

Key obligations applicable to federally regulated banks and authorized foreign banks:

s. 627.04 — Fair and equitable dealing: a bank must deal with its customers and the public fairly, equitably, honestly and in good faith.

s. 627.06 — Appropriate products and services: a bank must establish and implement policies and procedures to ensure that the products and services in Canada that it offers or sells to a natural person are appropriate for the person having regard to their circumstances, including their financial needs.

s. 627.08 — Electronic alerts: banks must send electronic alerts to warn customers when their balance is below a threshold set by the customer or, failing that, a $100 default.

s. 627.12 — Clear disclosure: all information provided to a customer must be in language that is clear, simple and not misleading.

s. 627.17-627.21 — Complaint handling: banks must establish procedures for dealing with complaints, acknowledge receipt in writing, provide a final written response within 56 days, and inform the complainant of the right to escalate to an external complaints body designated under s. 627.48 (now the Ombudsman for Banking Services and Investments, OBSI, sole designated body as of 1 November 2024).

s. 627.22 — Cancellation periods: customers have 14 business days to cancel certain retail banking products without charge.

s. 627.64-627.66 — Restrictions on unsolicited products, negative-option marketing, and unsolicited credit card limit increases without express consent.

FCAC enforcement: violations attract AMPs up to $10 million per violation, and the FCAC is required to publish the names of banks that commit violations (s. 31 FCAC Act).`,
  },
  {
    id: "auth-ca-fcac-act",
    organizationId: "preview",
    title: "Financial Consumer Agency of Canada Act — Supervisory framework",
    source: "Financial Consumer Agency of Canada Act, S.C. 2001, c. 9",
    jurisdiction: "federal",
    registrationCategories: ["consumer-protection", "financial-institution"],
    content: `The Financial Consumer Agency of Canada (FCAC) supervises federally regulated financial entities — banks, trust and loan companies, insurance companies, retail payment service providers — for compliance with the consumer-protection provisions in the Bank Act, Insurance Companies Act, Trust and Loan Companies Act, and Cooperative Credit Associations Act.

Key powers:
- Compliance monitoring and examinations
- Public naming of non-compliant entities (s. 31)
- Administrative monetary penalties (up to $10 million per violation for corporations since 2022)
- Required consumer provisions audits under the Financial Consumer Protection Framework

Commissioner's public guidance:
- FCAC Guideline on Complaint-Handling Procedures (2022)
- FCAC Guideline on Appropriate Products and Services (2022)
- FCAC Guideline on Whistleblowing Procedures

Coordination: FCAC works with provincial consumer protection regulators where banks sell products that have both federal and provincial consumer-protection dimensions (e.g., retail investment products sold through bank branches, which can also trigger provincial securities and consumer protection rules).`,
  },
];
