/**
 * US securities authority corpus — Regulation D, Rule 144, and the
 * Securities Act sections most often invoked in cross-border private-
 * placement Q&A.
 *
 * Authored by hand from the public text of 17 CFR (the Code of Federal
 * Regulations) and the Securities Act of 1933, current to the most recent
 * CFR publication as of 2026-04. Quoted language is verbatim where the
 * wording matters for compliance (thresholds, definitions, "reasonable
 * steps" formulations); procedural prose is paraphrased for length.
 *
 * This corpus is the US analog to the Canadian NI 45-106 / NI 31-103
 * authorities — it exists so the /api/ask endpoint can cross-check a
 * Canadian question against the US position on the same topic
 * (accredited investor definition, private placement structure, resale
 * holding periods, filing obligations).
 *
 * Each item uses:
 *   id:                      auth-us-{instrument}-{section}
 *   organizationId:          "preview" — re-tagged at bootstrap per tenant
 *   source:                  cited verbatim per-item
 *   jurisdiction:            "US"
 *   registrationCategories:  [] — US Reg D does not map cleanly onto
 *                            Canadian EMD/PM/IIROC/issuer categories. When
 *                            jurisdiction-aware queries filter by category,
 *                            US items deliberately won't match; callers
 *                            doing US-scoped Q&A should not pass a
 *                            registrationCategory filter.
 */

import type { CognitionItem } from "./types.js";

const SOURCE_17_CFR_230 = "17 CFR Part 230 (Regulation D, Securities Act)";
const SOURCE_17_CFR_144 = "17 CFR 230.144 / 144A (Resale)";
const SOURCE_SEC_ACT = "Securities Act of 1933 (15 U.S.C. §§ 77a et seq.)";
const SOURCE_FORM_D = "SEC Form D (17 CFR 239.500)";
const SOURCE_SEC_RELEASE_33 = "SEC Release Nos. 33-9415, 33-9414";

export const US_SECURITIES_AUTHORITIES: CognitionItem[] = [
  // -----------------------------------------------------------------------
  // Securities Act of 1933 — the foundational prohibition and exemption
  // -----------------------------------------------------------------------
  {
    id: "auth-us-secact-5",
    organizationId: "preview",
    title: "Securities Act § 5 — Registration requirement",
    source: SOURCE_SEC_ACT,
    jurisdiction: "US",
    registrationCategories: [],
    content: `Section 5 of the Securities Act of 1933 (15 U.S.C. § 77e) — General Prohibition on Unregistered Offers and Sales

Unless a registration statement is in effect, or an exemption is available, it is unlawful for any person, directly or indirectly:

(a) to sell a security through the mails or in interstate commerce;
(b) to carry or cause to be carried through the mails or in interstate commerce any security for the purpose of sale or delivery after sale; or
(c) to offer to sell or offer to buy any security through a prospectus or other communication in interstate commerce, unless a registration statement has been filed.

Practical effect: every offer and sale of a security in the US must either be registered under Section 5 OR fit within a statutory exemption (most commonly Section 4(a)(2) for private placements, as implemented by Regulation D).

Cross-reference: Section 4(a)(2) (private placement exemption); Regulation D (safe harbor).`,
  },
  {
    id: "auth-us-secact-4-a-2",
    organizationId: "preview",
    title: "Securities Act § 4(a)(2) — Private placement exemption",
    source: SOURCE_SEC_ACT,
    jurisdiction: "US",
    registrationCategories: [],
    content: `Section 4(a)(2) of the Securities Act of 1933 (15 U.S.C. § 77d(a)(2)) — Transactions by an Issuer Not Involving Any Public Offering

The statutory text: "The provisions of section 5 shall not apply to... (2) transactions by an issuer not involving any public offering."

Judicial interpretation (SEC v. Ralston Purina Co., 346 U.S. 119 (1953)): the availability of the exemption turns on whether the offerees "need the protection of the Act" — in practice, whether they have access to the kind of information a registration statement would provide and are able to "fend for themselves."

Because the statutory language is open-ended, issuers in practice rely on Regulation D (Rules 504, 506(b), 506(c)) as a non-exclusive safe harbor that provides bright-line criteria for satisfying § 4(a)(2).

Cross-reference: Rule 506(b) (unlimited accredited + up to 35 sophisticated purchasers); Rule 506(c) (unlimited accredited, verified, with general solicitation).`,
  },

  // -----------------------------------------------------------------------
  // Regulation D — definitions
  // -----------------------------------------------------------------------
  {
    id: "auth-us-regd-501-accredited-investor",
    organizationId: "preview",
    title: "Regulation D Rule 501(a) — Accredited investor definition",
    source: SOURCE_17_CFR_230,
    jurisdiction: "US",
    registrationCategories: [],
    content: `17 CFR § 230.501(a) — Definition of "Accredited Investor"

"Accredited investor" means any person who comes within any of the following categories, or who the issuer reasonably believes comes within any of the following categories, at the time of the sale of the securities to that person:

(1) Any bank as defined in section 3(a)(2) of the Securities Act, or any savings and loan association or other institution as defined in section 3(a)(5)(A) of the Securities Act... any broker or dealer registered pursuant to section 15 of the Securities Exchange Act of 1934; any investment adviser registered pursuant to section 203 of the Investment Advisers Act of 1940 or registered pursuant to the laws of a state; any investment adviser relying on the exemption from registering with the Commission under section 203(l) or (m) of the Investment Advisers Act of 1940...

(3) Any organization described in section 501(c)(3) of the Internal Revenue Code, corporation, Massachusetts or similar business trust, partnership, or limited liability company, not formed for the specific purpose of acquiring the securities offered, with total assets in excess of $5,000,000;

(5) Any natural person whose individual net worth, or joint net worth with that person's spouse or spousal equivalent, exceeds $1,000,000.
  (i) Except as provided in paragraph (a)(5)(ii) of this section, for purposes of calculating net worth under this paragraph (a)(5):
    (A) The person's primary residence shall not be included as an asset;
    (B) Indebtedness that is secured by the person's primary residence, up to the estimated fair market value of the primary residence at the time of the sale of securities, shall not be included as a liability (except that if the amount of such indebtedness outstanding at the time of the sale of securities exceeds the amount outstanding 60 days before such time, other than as a result of the acquisition of the primary residence, the amount of such excess shall be included as a liability); and
    (C) Indebtedness that is secured by the person's primary residence in excess of the estimated fair market value of the primary residence at the time of the sale of securities shall be included as a liability;

(6) Any natural person who had an individual income in excess of $200,000 in each of the two most recent years or joint income with that person's spouse or spousal equivalent in excess of $300,000 in each of those years and has a reasonable expectation of reaching the same income level in the current year;

(9) Any entity, of a type not listed in paragraphs (a)(1), (2), (3), (7), or (8), not formed for the specific purpose of acquiring the securities offered, owning investments in excess of $5,000,000;

(10) Any natural person holding in good standing one or more professional certifications or designations or credentials from an accredited educational institution that the Commission has designated as qualifying an individual for accredited investor status. The Commission has designated the General Securities Representative license (Series 7), the Private Securities Offerings Representative license (Series 82), and the Investment Adviser Representative license (Series 65).

Cross-reference: contrast NI 45-106 s. 1.1 "accredited investor" (Canada) — Canadian thresholds include a C$1M financial-asset test and a C$5M net-asset test, but do not include professional-certification categories.`,
  },
  {
    id: "auth-us-regd-501-other-defs",
    organizationId: "preview",
    title: "Regulation D Rule 501 — Other Regulation D definitions",
    source: SOURCE_17_CFR_230,
    jurisdiction: "US",
    registrationCategories: [],
    content: `17 CFR § 230.501 — Other defined terms used throughout Regulation D

"Purchaser representative" (§ 501(h)): any person who satisfies specified independence and sophistication conditions, and who the purchaser acknowledges in writing. Used by a non-accredited purchaser in a Rule 506(b) offering to satisfy the sophistication requirement.

"Aggregate offering price" (§ 501(c)): the sum of all consideration received by the issuer for issuance of the securities, including cash, services, property, notes, cancellation of debt, or other consideration.

"Number of purchasers" (§ 501(e)): for counting purposes under Rule 506(b), the following are excluded from the 35-purchaser limit: any relative, spouse, or spousal equivalent of a purchaser; any trust or estate of which a purchaser is the beneficial owner of more than 50%; any accredited investor.

"Spousal equivalent" (§ 501(j)): a cohabitant occupying a relationship generally equivalent to that of a spouse.

Cross-reference: Rule 506(b) (uses § 501(e) and § 501(h) to apply the 35-purchaser limit and sophistication requirement).`,
  },

  // -----------------------------------------------------------------------
  // Rule 502 — General conditions
  // -----------------------------------------------------------------------
  {
    id: "auth-us-regd-502-c-general-solicitation",
    organizationId: "preview",
    title: "Regulation D Rule 502(c) — Limitation on general solicitation",
    source: SOURCE_17_CFR_230,
    jurisdiction: "US",
    registrationCategories: [],
    content: `17 CFR § 230.502(c) — Limitation on Manner of Offering

Except as provided in § 230.504(b)(1) or § 230.506(c), neither the issuer nor any person acting on its behalf shall offer or sell the securities by any form of general solicitation or general advertising, including, but not limited to, the following:

(1) Any advertisement, article, notice or other communication published in any newspaper, magazine, or similar media or broadcast over television or radio; and

(2) Any seminar or meeting whose attendees have been invited by any general solicitation or general advertising; Provided, however, that publication by an issuer of a notice in accordance with § 230.135e or filing with the Commission by an issuer of a notice of sales on Form D (17 CFR 239.500) in which the issuer has made a good faith and reasonable attempt to comply with the requirements of such form, shall not be deemed to constitute general solicitation or general advertising for purposes of this section.

Practical effect: Rule 506(b) prohibits any mass-audience marketing. Sales must rely on pre-existing, substantive relationships. Rule 506(c) lifts this ban entirely but substitutes a mandatory verification requirement (see § 230.506(c)(2)(ii)).

Cross-reference: § 230.506(b) (general solicitation prohibited); § 230.506(c) (general solicitation permitted with verification).`,
  },
  {
    id: "auth-us-regd-502-a-integration",
    organizationId: "preview",
    title: "Regulation D Rule 502(a) — Integration of offerings",
    source: SOURCE_17_CFR_230,
    jurisdiction: "US",
    registrationCategories: [],
    content: `17 CFR § 230.502(a) — Integration (as amended by SEC Release 33-10884, effective 2021)

Offers and sales made in reliance on a Regulation D exemption will not be integrated with other offers or sales unless integration is required under the general integration framework in § 230.152.

§ 230.152 integration safe harbors (summary):
- Any offering will not be integrated with another offering if, based on the particular facts and circumstances, the issuer can establish each offering either complies with the registration requirements, or that an exemption from registration is available.

Four non-exclusive safe harbors from integration:
(1) 30-day gap: any offering made more than 30 calendar days before or after another offering is not integrated.
(2) Concurrent § 4(a)(2) / Rule 506(b) with registered offering: permitted if the § 4(a)(2) purchasers were not solicited by the registered offering's general solicitation.
(3) Sequential transition from 506(b) to 506(c): after the issuer terminates or completes the 506(b), it may begin a 506(c) — purchasers in the 506(b) may not be solicited by general solicitation.
(4) Completed offering followed by a new offering: permitted when the earlier offering is completed.

Cross-reference: § 230.506(b); § 230.506(c); NI 45-106 Companion Policy § 1.9 (Canadian integration position).`,
  },
  {
    id: "auth-us-regd-502-b-information",
    organizationId: "preview",
    title: "Regulation D Rule 502(b) — Information requirements for non-accredited purchasers",
    source: SOURCE_17_CFR_230,
    jurisdiction: "US",
    registrationCategories: [],
    content: `17 CFR § 230.502(b) — Information Requirements

When information must be furnished:
- If the issuer sells securities under § 230.506(b) to any purchaser that is not an accredited investor, the issuer shall furnish the information specified in § 230.502(b)(2) to such purchaser a reasonable time prior to sale.
- No specific information need be provided to purchasers in § 230.504, to any accredited investor under § 230.506(b), or to any purchaser in § 230.506(c).

What information (scaled by offering size and issuer type):
(1) Non-reporting issuers offering up to $20M: the non-financial information required by Part II of Form 1-A (Regulation A offering statement), plus audited balance sheet (may be unaudited for offerings up to $20M if the issuer cannot obtain audited statements without unreasonable effort or expense, other than an audited balance sheet for the most recent fiscal year end).

(2) Non-reporting issuers offering more than $20M: information required in a registration statement filed under the Securities Act on the form the issuer would be entitled to use.

(3) Reporting issuers: may deliver the annual report, proxy statement, and any other information delivered to shareholders; or the most recent Form 10-K.

Cross-reference: § 230.506(b) (requires this disclosure to non-accredited purchasers); NI 45-106 s. 2.9 (Canadian OM exemption — disclosure to all purchasers).`,
  },
  {
    id: "auth-us-regd-502-d-resale-limitations",
    organizationId: "preview",
    title: "Regulation D Rule 502(d) — Limitations on resale",
    source: SOURCE_17_CFR_230,
    jurisdiction: "US",
    registrationCategories: [],
    content: `17 CFR § 230.502(d) — Limitations on Resale

Except as provided in § 230.504(b)(1), securities acquired in a transaction under Regulation D shall have the status of securities acquired in a transaction under § 4(a)(2) of the Act and cannot be resold without registration under the Act or an exemption therefrom.

The issuer shall exercise reasonable care to assure that the purchasers of the securities are not underwriters within the meaning of § 2(a)(11) of the Act, which reasonable care may be demonstrated by the following:

(1) Reasonable inquiry to determine if the purchaser is acquiring the securities for himself or for other persons;
(2) Written disclosure to each purchaser prior to sale that the securities have not been registered under the Act and, therefore, cannot be resold unless they are registered under the Act or unless an exemption from registration is available; and
(3) Placement of a legend on the certificate or other document that evidences the securities stating that the securities have not been registered under the Act and setting forth or referring to the restrictions on transferability and sale of the securities.

Practical effect: securities issued under Rules 504 (with limitations), 506(b), or 506(c) are "restricted securities" and cannot be freely resold until one of the § 230.144 holding periods is satisfied.

Cross-reference: § 230.144 (resale safe harbor); NI 45-102 s. 2.5 (Canadian 4-month hold period).`,
  },

  // -----------------------------------------------------------------------
  // Rule 503 — Filing (Form D)
  // -----------------------------------------------------------------------
  {
    id: "auth-us-regd-503-form-d-filing",
    organizationId: "preview",
    title: "Regulation D Rule 503 — Filing of Form D",
    source: SOURCE_17_CFR_230,
    jurisdiction: "US",
    registrationCategories: [],
    content: `17 CFR § 230.503 — Filing of Notice of Sales

(a) Filing requirement: an issuer offering or selling securities in reliance on § 230.504 or § 230.506 shall file with the Commission a notice of sales containing the information required by Form D (17 CFR 239.500) for each new offering no later than 15 calendar days after the first sale of securities in the offering.

(b) Amendments: an issuer shall file an amendment to a previously filed notice of sales on Form D:
  (1) To correct a material mistake of fact or error in the previously filed notice of sales as soon as practicable after discovery of the mistake or error;
  (2) To reflect a change in the information provided in the previously filed notice of sales, except that no amendment is required to reflect a change that occurs after the offering terminates or a change that occurs solely in the following information:
    (i) The address(es) or relationship(s) of a related person identified in Item 3;
    (ii) An issuer's revenues or aggregate net asset value;
    (iii) The minimum investment amount, if the change is an decrease of more than 10%;
    (iv) Any address or state(s) of solicitation shown in response to Item 12; etc.;
  (3) Annually, on or before the first anniversary of the filing of the notice of sales or the most recent amendment, if the offering is continuing at that time.

Practical effect: Form D is filed electronically via EDGAR. Failure to file Form D does not disqualify the Regulation D exemption itself for federal purposes but may disqualify the issuer from using Regulation D in the future (§ 230.507) and can trigger state-level consequences under Blue Sky laws.

Cross-reference: § 230.507 (disqualification for prior non-compliance); NI 45-106 s. 6.1 (Canadian report of exempt distribution — 10 days).`,
  },

  // -----------------------------------------------------------------------
  // Rule 504 — Limited offering exemption
  // -----------------------------------------------------------------------
  {
    id: "auth-us-regd-504",
    organizationId: "preview",
    title: "Regulation D Rule 504 — Exemption for limited offerings up to $10 million",
    source: SOURCE_17_CFR_230,
    jurisdiction: "US",
    registrationCategories: [],
    content: `17 CFR § 230.504 — Exemption for Limited Offerings and Sales of Securities Not Exceeding $10,000,000

(a) Exemption: Offers and sales of securities that satisfy the conditions in paragraph (b) of this section by an issuer that is not: (1) subject to the reporting requirements of § 13 or 15(d) of the Exchange Act; (2) an investment company; or (3) a development stage company that either has no specific business plan or purpose or has indicated that its business plan is to engage in a merger or acquisition with an unidentified company — shall be exempt from the provisions of § 5 of the Act under § 3(b) of the Act.

(b) Conditions:
(1) Aggregate offering price: the aggregate offering price for an offering under Rule 504 shall not exceed $10,000,000, less the aggregate offering price for all securities sold within the 12 months before the start of and during the offering in reliance on any exemption under § 3(b) of the Act, or in violation of § 5(a) of the Act.
(2) General solicitation: general solicitation is permitted only when:
  (i) The offering is registered under state law in a state that requires the public filing and delivery of a substantive disclosure document, and the securities are sold only in those states;
  (ii) The offering is under a state law exemption that permits general solicitation and general advertising so long as sales are made only to accredited investors; or
  (iii) All purchasers meet a state's accredited-investor or sophisticated-investor standard and such standard applies.
(3) Bad actor disqualification (§ 230.506(d)) applies.

Practical effect: Rule 504 is primarily used by very small issuers doing state-regulated intrastate offerings. Federal disclosure obligations are minimal, but state Blue Sky laws do most of the work.

Cross-reference: § 230.506(b) (larger offerings, no solicitation); § 230.506(c) (larger offerings, solicitation with verification).`,
  },

  // -----------------------------------------------------------------------
  // Rule 506 — the core safe harbors
  // -----------------------------------------------------------------------
  {
    id: "auth-us-regd-506-b",
    organizationId: "preview",
    title: "Regulation D Rule 506(b) — Private placement without general solicitation",
    source: SOURCE_17_CFR_230,
    jurisdiction: "US",
    registrationCategories: [],
    content: `17 CFR § 230.506(b) — Conditions to be met (no general solicitation)

(1) General conditions: to qualify for an exemption under this section, offers and sales must satisfy all the terms and conditions of §§ 230.501 and 230.502.

(2) Specific conditions:
  (i) Limitation on number of purchasers: there are no more than 35 purchasers of securities from the issuer in any offering under this section. Accredited investors are excluded from this count (see § 230.501(e)(1)(iv)).
  (ii) Nature of purchasers: each purchaser who is not an accredited investor either alone or with his purchaser representative(s) has such knowledge and experience in financial and business matters that he is capable of evaluating the merits and risks of the prospective investment, or the issuer reasonably believes immediately prior to making any sale that such purchaser comes within this description.

Practical summary:
- Unlimited accredited investors.
- Up to 35 sophisticated (but non-accredited) investors.
- NO general solicitation (see § 230.502(c)).
- Full information delivery to non-accredited purchasers per § 230.502(b)(2).
- Form D filing within 15 days (§ 230.503).
- Securities are restricted (§ 230.502(d)).

Cross-reference: § 230.506(c) (allows solicitation, requires verification); NI 45-106 s. 2.3 (Canadian accredited-investor exemption — no general-solicitation prohibition in the same form).`,
  },
  {
    id: "auth-us-regd-506-c",
    organizationId: "preview",
    title: "Regulation D Rule 506(c) — General solicitation with accredited verification",
    source: SOURCE_17_CFR_230,
    jurisdiction: "US",
    registrationCategories: [],
    content: `17 CFR § 230.506(c) — Conditions to be met (general solicitation permitted)

(1) An issuer may offer securities by general solicitation or general advertising, provided that:
  (i) All terms and conditions of § 230.501 and §§ 230.502(a) and (d) are satisfied;
  (ii) All purchasers of securities are accredited investors because:
    (A) They come within one of the categories of accredited investor, or
    (B) The issuer reasonably believes they come within one of the categories, at the time of the sale of securities; and
  (iii) The issuer has taken reasonable steps to verify that the purchasers of securities sold in any offering under this section are accredited investors.

(2) Reasonable steps to verify — non-exclusive methods (§ 230.506(c)(2)(ii)):
  (A) Income verification: reviewing IRS forms W-2, 1099, K-1, 1040 for the two most recent years, plus a written representation that the purchaser reasonably expects to reach the income level in the current year.
  (B) Net worth verification: reviewing bank statements, brokerage statements, certificates of deposit, tax assessments, appraisal reports, plus a consumer credit report, all dated within 3 months, plus a written representation that all liabilities have been disclosed.
  (C) Third-party verification: written confirmation from a registered broker-dealer, SEC-registered investment adviser, licensed attorney, or CPA that the third party has taken reasonable steps to verify accredited status within the prior 3 months.
  (D) Prior-investor status: for an existing investor who qualified as accredited prior to the effective date of § 230.506(c) and remains an investor, a certification at the time of sale is sufficient.

Practical summary:
- Unlimited accredited investors only — NO non-accredited, even sophisticated, purchasers allowed.
- Unlimited general solicitation (websites, seminars, mass media, social media) IS permitted.
- Verification is mandatory — self-certification alone is NOT enough (this is the key difference from Rule 506(b)).
- Form D filing within 15 days (§ 230.503).
- Securities remain restricted (§ 230.502(d)).

Cross-reference: § 230.506(b) (no solicitation, self-certification acceptable); SEC Release 33-9415 (adopting 506(c)).`,
  },
  {
    id: "auth-us-regd-506-d-bad-actor",
    organizationId: "preview",
    title: "Regulation D Rule 506(d) — Bad actor disqualification",
    source: SOURCE_17_CFR_230,
    jurisdiction: "US",
    registrationCategories: [],
    content: `17 CFR § 230.506(d) — Disqualifying events

(1) The Rule 506 exemption is not available if the issuer, any predecessor, any affiliated issuer, any director, executive officer, other officer participating in the offering, general partner or managing member of the issuer, any beneficial owner of 20% or more of the issuer's outstanding voting equity securities, any promoter, any investment manager of an issuer that is a pooled investment fund, any person compensated for solicitation of purchasers, and any general partner or managing member of any such investment manager or solicitor has been subject to any of the following "disqualifying events":

(i) A criminal conviction in connection with the purchase or sale of any security or any felony within the last 5 years (10 years for issuers, predecessors, and affiliated issuers);
(ii) Any court injunction or restraining order entered within the last 5 years in connection with the purchase or sale of any security;
(iii) A final order of a state securities commission, federal banking agency, or similar regulator that bars the person from association with any entity regulated by such commission or engaging in the business of securities, insurance, or banking, or constitutes a final order based on fraudulent conduct;
(iv) An SEC disciplinary order;
(v) An SEC cease-and-desist order within the last 5 years;
(vi) Suspension or expulsion from membership in, or suspension or bar from association with a member of, a registered national securities exchange or registered national or affiliated securities association;
(vii) An SEC stop order or order suspending the Regulation A exemption within the last 5 years;
(viii) A US Postal Service false representation order within the last 5 years.

(2) Transition / reasonable care exception: the exemption remains available if the issuer establishes that it did not know and, in the exercise of reasonable care, could not have known that a disqualification existed. Reasonable care generally requires factual inquiry of covered persons.

Cross-reference: SEC Compliance and Disclosure Interpretations 260.14–260.30.`,
  },

  // -----------------------------------------------------------------------
  // Rule 144 — resale safe harbor
  // -----------------------------------------------------------------------
  {
    id: "auth-us-rule-144-holding-period",
    organizationId: "preview",
    title: "Rule 144 — Holding period for restricted securities",
    source: SOURCE_17_CFR_144,
    jurisdiction: "US",
    registrationCategories: [],
    content: `17 CFR § 230.144(d) — Holding Period for Restricted Securities

(d)(1) Reporting issuers: restricted securities of an issuer that is, and has been for a period of at least 90 days immediately before the sale, subject to the reporting requirements of § 13 or 15(d) of the Exchange Act may be sold after a minimum holding period of 6 months has elapsed between the date of acquisition of the securities from the issuer or from an affiliate of the issuer and any resale of such securities.

(d)(2) Non-reporting issuers: restricted securities of an issuer that is not subject to the reporting requirements of § 13 or 15(d) of the Exchange Act may be sold after a minimum holding period of 1 year has elapsed.

Volume limitations (§ 230.144(e)) — apply to sales by affiliates only:
- During any 3-month period, the amount of securities sold shall not exceed the greater of (i) 1% of the outstanding securities of that class, or (ii) the average weekly trading volume during the 4 weeks preceding the filing of the Form 144 notice.

Current public information (§ 230.144(c)) — available only if the issuer has made current public disclosure (Form 10-K, 10-Q, etc. for reporting issuers; comparable disclosure for non-reporting issuers).

Manner of sale (§ 230.144(f)): brokers' transactions or directly with a market maker, no solicitation by the selling security holder.

Practical summary: after the holding period, a non-affiliate may sell restricted securities freely (only the current-public-information condition applies for the first year after becoming a non-affiliate). An affiliate is subject to volume, manner-of-sale, current-information, and Form 144 filing requirements continuously.

Cross-reference: § 230.144A (Qualified Institutional Buyer resales); § 230.502(d) (restricted-security status); NI 45-102 s. 2.5 (Canadian 4-month hold — materially shorter).`,
  },
  {
    id: "auth-us-rule-144a",
    organizationId: "preview",
    title: "Rule 144A — Resales to Qualified Institutional Buyers",
    source: SOURCE_17_CFR_144,
    jurisdiction: "US",
    registrationCategories: [],
    content: `17 CFR § 230.144A — Private Resales of Securities to Qualified Institutional Buyers ("QIBs")

Rule 144A provides a non-exclusive safe harbor from the registration requirements of § 5 for resales of restricted securities to "qualified institutional buyers" (QIBs).

"QIB" definition (§ 230.144A(a)(1)): generally, an entity that owns and invests on a discretionary basis at least $100 million in securities of issuers not affiliated with the QIB. Registered broker-dealers qualify at a $10 million threshold. Banks and savings and loans must also meet a $25 million net-worth test.

Resale conditions (§ 230.144A(d)):
(1) The securities are sold only to a QIB or to a purchaser that the seller reasonably believes is a QIB.
(2) The seller takes reasonable steps to ensure the purchaser is aware it is relying on Rule 144A.
(3) The securities are not, when issued, of the same class as securities listed on a US national securities exchange or quoted in an automated inter-dealer quotation system ("fungibility restriction").
(4) In the case of securities of foreign issuers that are not reporting companies, the holder and prospective purchaser have the right to obtain specified information from the issuer.

Practical effect: Rule 144A underpins the US private-placement institutional market. It is the dominant resale mechanism for Reg D 506 securities sold to institutions.

Cross-reference: § 230.144 (public resale after holding period); NI 45-106 s. 2.3 (Canadian AI exemption — no direct QIB analog).`,
  },

  // -----------------------------------------------------------------------
  // Rule 507 — disqualification for non-compliance
  // -----------------------------------------------------------------------
  {
    id: "auth-us-regd-507-disqualification",
    organizationId: "preview",
    title: "Regulation D Rule 507 — Disqualifying provisions relating to Rules 504 and 506",
    source: SOURCE_17_CFR_230,
    jurisdiction: "US",
    registrationCategories: [],
    content: `17 CFR § 230.507 — Disqualifying Provisions

(a) No exemption under § 230.504 or § 230.506 shall be available for any issuer if such issuer, any of its predecessors or affiliates have been subject to any order, judgment, or decree of any court of competent jurisdiction temporarily, preliminarily or permanently enjoining such person for failure to comply with § 230.503 (failure to file Form D).

(b) The provisions of paragraph (a) shall not apply upon a showing of good cause that it is not necessary under the circumstances that the exemption be denied.

Practical effect: if the SEC or a court enjoins an issuer for failure to timely file Form D, that issuer loses the ability to use the Rules 504 / 506 safe harbors going forward (subject to the good-cause waiver). This is a company-level disqualification, distinct from the bad-actor disqualification in § 230.506(d).

Cross-reference: § 230.503 (Form D filing requirement); § 230.506(d) (bad-actor disqualification).`,
  },

  // -----------------------------------------------------------------------
  // Form D itself
  // -----------------------------------------------------------------------
  {
    id: "auth-us-form-d",
    organizationId: "preview",
    title: "Form D — Notice of Exempt Offering of Securities",
    source: SOURCE_FORM_D,
    jurisdiction: "US",
    registrationCategories: [],
    content: `Form D (17 CFR 239.500) — Notice of Exempt Offering of Securities

What it is: a one-page federal notice filing (with schedules) required within 15 calendar days of first sale in any offering relying on Rule 504 or Rule 506. Filed electronically via EDGAR using EDGAR filer credentials (Form ID for first-time filers).

Required information includes:
- Issuer identity, year of incorporation, industry group, revenue range, aggregate net asset value range.
- Related persons — executive officers, directors, promoters.
- Federal exemption(s) claimed (Rule 504, 506(b), 506(c), § 4(a)(5), etc.).
- Type of filing (new notice / amendment).
- Date of first sale, duration, minimum investment.
- Sales compensation recipients.
- Offering and sales amounts (total offering amount, total amount sold, remaining, total number of investors, types).
- Use of proceeds (categorized).

State notice filings: most states also require a notice filing (often a copy of Form D plus a fee) under Blue Sky laws; the federal filing does not preempt state notice requirements.

Amendments (see § 230.503(b)): material changes, annual amendments while offering continues, and corrections of errors.

Cross-reference: § 230.503 (filing obligation); NI 45-106 Form 45-106F1 (Canadian Report of Exempt Distribution — materially more detailed).`,
  },

  // -----------------------------------------------------------------------
  // SEC releases — context
  // -----------------------------------------------------------------------
  {
    id: "auth-us-sec-release-33-9415",
    organizationId: "preview",
    title: "SEC Release 33-9415 — Rule 506(c) adopting release",
    source: SOURCE_SEC_RELEASE_33,
    jurisdiction: "US",
    registrationCategories: [],
    content: `SEC Release No. 33-9415 (effective September 23, 2013) — Eliminating the Prohibition Against General Solicitation and General Advertising in Rule 506 and Rule 144A Offerings

Background: Section 201(a) of the Jumpstart Our Business Startups ("JOBS") Act directed the SEC to remove the prohibition on general solicitation in Rule 506 offerings, provided all purchasers are accredited investors and the issuer takes reasonable steps to verify accredited status.

Key interpretive points from the release:
- "Reasonable steps to verify" is a principles-based standard requiring consideration of: (i) the nature of the purchaser and the type of accredited investor they claim to be; (ii) the amount and type of information the issuer has about the purchaser; and (iii) the nature of the offering, including solicitation method and investor commitment size.
- Self-certification by the purchaser alone is NOT sufficient verification. Documentary review or third-party confirmation is generally required.
- Issuers may rely on the safe-harbor verification methods in § 230.506(c)(2)(ii) but are not required to.
- Issuers choosing to rely on 506(c) lose access to the sophisticated-but-non-accredited category that Rule 506(b) permits.

Practical effect: this release is the interpretive anchor for almost every compliance question about how to conduct 506(c) verification in practice.

Cross-reference: § 230.506(c); SEC Release 33-9414 (bad-actor disqualification adopting release).`,
  },

  // -----------------------------------------------------------------------
  // Procedural / cross-cutting
  // -----------------------------------------------------------------------
  {
    id: "auth-us-regd-505-repealed",
    organizationId: "preview",
    title: "Regulation D Rule 505 — Repealed",
    source: SOURCE_17_CFR_230,
    jurisdiction: "US",
    registrationCategories: [],
    content: `17 CFR § 230.505 — Repealed effective May 22, 2017

Former Rule 505 provided an exemption for offerings up to $5 million per 12-month period, with up to 35 non-accredited investors permitted (without the sophistication requirement that Rule 506(b) imposes), but prohibited general solicitation.

The SEC repealed Rule 505 in 2017 (SEC Release 33-10238), concluding that its utility was largely duplicated by Rule 506(b) (which has no dollar cap and permits more flexibility), and that the increase in the Rule 504 cap to $5M (later raised to $10M) rendered Rule 505 redundant.

Practical effect: any reference to "Rule 505" in a modern Reg D analysis is stale and should be replaced with Rule 504 (for small offerings up to $10M) or Rule 506(b) (for larger offerings or where the sophistication requirement is workable).

Cross-reference: § 230.504 (current small-offering exemption); § 230.506(b) (current private-placement safe harbor).`,
  },
  {
    id: "auth-us-regd-508-insubstantial-deviations",
    organizationId: "preview",
    title: "Regulation D Rule 508 — Insubstantial deviations",
    source: SOURCE_17_CFR_230,
    jurisdiction: "US",
    registrationCategories: [],
    content: `17 CFR § 230.508 — Insubstantial Deviations From a Term, Condition or Requirement of Regulation D

(a) A failure to comply with a term, condition or requirement of § 230.504 or § 230.506 will not result in the loss of the exemption for any offer or sale to a particular individual or entity, if the person relying on the exemption shows:

(1) The failure to comply did not pertain to a term, condition or requirement directly intended to protect that particular individual or entity; and

(2) The failure to comply was insignificant with respect to the offering as a whole, provided that any failure to comply with paragraphs (c), (d)(1)(i) and (iii) of § 230.502, § 230.504(b)(2) and paragraphs (b)(2)(i) and (ii) of § 230.506 shall be deemed to be significant to the offering as a whole; and

(3) A good faith and reasonable attempt was made to comply with all applicable terms, conditions and requirements of § 230.504 or § 230.506.

What failures are ALWAYS significant (and therefore fatal):
- General solicitation prohibition (§ 230.502(c)) for a 506(b) offering.
- Limitations on resale (§ 230.502(d)(1)(i) and (iii)).
- Dollar limits for Rule 504.
- 35-purchaser limit and sophistication requirement in Rule 506(b).

Practical effect: minor procedural slips (a missed address update on Form D, an inadvertent failure to deliver a disclosure copy to an accredited investor who didn't need one) can be cured. Core structural failures (using general solicitation in a 506(b) offering, exceeding the 35-purchaser limit) cannot be cured under Rule 508.

Cross-reference: § 230.506(b) (structural conditions); § 230.506(c) (structural conditions).`,
  },
];
