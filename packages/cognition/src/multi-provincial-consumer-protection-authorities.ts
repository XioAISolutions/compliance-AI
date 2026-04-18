/**
 * Multi-provincial consumer protection authorities.
 *
 * This file captures the harmonised pan-Canadian frameworks developed by
 * the Consumer Measures Committee (CMC) — a federal, provincial, and
 * territorial committee under the Agreement on Internal Trade — and the
 * Canadian Council of Insurance Regulators / provincial securities and
 * insurance harmonisation projects.
 *
 * These instruments apply in multiple jurisdictions simultaneously. Each
 * item's jurisdiction field is set to "multi-provincial" so matters
 * flagged as cross-border, or as covering a jurisdiction not otherwise
 * seeded in depth, can still retrieve the shared framework text.
 *
 * Covered:
 *   - Internet Sales Contract Harmonization Template (ISCHT)
 *   - Consumer Product Warranty Harmonization Template
 *   - Cost of Credit Disclosure Harmonization Template
 *   - Consumer Measures Committee: Code of Practice for Consumer Debit
 *     Card Services
 *   - CSA multi-jurisdictional instruments that govern retail clients
 *     (references only — the substantive securities corpus lives in
 *     ni-45-106-authorities.ts / ni-45-106-companion-authorities.ts)
 *   - Competition Bureau Deceptive Marketing Practices Digest (federal
 *     authority, but applied in lockstep with provincial unfair-practice
 *     statutes)
 */

import type { CognitionItem } from "./types.js";

export const MULTI_PROVINCIAL_CONSUMER_PROTECTION_AUTHORITIES: CognitionItem[] = [
  {
    id: "auth-mp-ischt-2001",
    organizationId: "preview",
    title: "Internet Sales Contract Harmonization Template (ISCHT, 2001)",
    source: "Consumer Measures Committee, Internet Sales Contract Harmonization Template (May 2001)",
    jurisdiction: "multi-provincial",
    registrationCategories: ["consumer-protection", "supplier", "distance-seller"],
    content: `Internet Sales Contract Harmonization Template

Developed in 2001 by the federal/provincial/territorial Consumer Measures Committee (CMC), the template has been adopted in substantially identical form by every province and territory other than Quebec (which has its own distance-contract rules in arts. 54.1-54.16 CPA). Implementations include:
- Ontario: Consumer Protection Act, 2002, ss. 38-40 and O. Reg. 17/05
- British Columbia: BPCPA ss. 46-54
- Alberta: Internet Sales Contract Regulation, Alta. Reg. 81/2001
- Saskatchewan: CPBPA Part III Division 3
- Manitoba: CPA Part XXI
- Nova Scotia: CPA ss. 21A-21H
- New Brunswick: Consumer Product Warranty and Liability Act / Direct Sellers Act
- Newfoundland and Labrador: CPBPA Part III
- Prince Edward Island: Consumer Protection Act Regulations (internet sales)
- Yukon/NWT: via Consumer Protection Act regulations

Core harmonised elements:

1. Scope — text-based electronic communications forming a consumer contract where the total exceeds $50 (threshold may vary by jurisdiction: $50 in most, higher in some).

2. Pre-contract disclosure — supplier must disclose:
(a) identity and contact information;
(b) fair and accurate description of the goods or services;
(c) itemised price (including related charges);
(d) total price in a specific currency;
(e) terms of payment;
(f) date of delivery/performance;
(g) cancellation, return, exchange, and refund policies;
(h) any other material restrictions.

3. Express opportunity to accept, decline, or correct errors before submission.

4. Copy of the contract — must be delivered within 15 days of the contract being formed, on any medium the consumer can access (email, downloadable PDF, customer-account portal).

5. Cancellation rights:
(a) 7 days after receiving the copy — if pre-contract disclosure was not given or the express-opportunity requirement was not met;
(b) 30 days after the contract date — if no copy was delivered;
(c) until delivery — if the supplier fails to deliver within 30 days of the specified date.

6. Credit-card chargeback — where the supplier fails to refund after a valid cancellation, the consumer may demand the card issuer reverse the charge.

Drafting implication: a single ISCHT-compliant online checkout flow satisfies the distance-contract rules in every Canadian jurisdiction except Quebec. Quebec requires additional French-language delivery, 15-day paper copy, and 7-day cancellation right under CPA arts. 54.8-54.9.`,
  },
  {
    id: "auth-mp-credit-disclosure-template",
    organizationId: "preview",
    title: "Cost of Credit Disclosure Harmonization Template (CCDHT)",
    source: "Consumer Measures Committee, Cost of Credit Disclosure Harmonization Agreement (1998, revised)",
    jurisdiction: "multi-provincial",
    registrationCategories: ["consumer-protection", "credit-grantor"],
    content: `Cost of Credit Disclosure Harmonization Template

Adopted by all Canadian jurisdictions except Quebec (Quebec has its own parallel CPA rules in arts. 66-150). The harmonised disclosure elements are:

APR (Annual Percentage Rate) — a single measure including all charges the borrower is required to pay in connection with the credit (interest, administration fees, origination fees, mandatory insurance), calculated using the prescribed formula. The APR is the comparability metric required in all pre-contract and periodic disclosures.

Fixed credit disclosure — initial disclosure statement must show:
(a) principal amount;
(b) cost of borrowing;
(c) APR;
(d) total amount of all payments;
(e) amount, schedule, and number of payments;
(f) any default charges;
(g) description of any security taken;
(h) consequences of default.

Open credit disclosure — periodic statement (at least monthly if there is activity or a balance above a minimum) must show:
(a) balance at the beginning and end of the period;
(b) each advance, payment, and credit applied during the period;
(c) interest charged during the period;
(d) APR applied to each portion of the balance;
(e) minimum payment, due date, and consequences of late payment;
(f) any fees charged during the period.

Prepayment rights — the borrower may prepay all or part of the balance at any time; lenders may charge only the actual loss on a closed credit agreement as compensation.

Advertising disclosure — if an ad mentions any one of: an interest rate, a payment amount, or a term, the ad must also disclose the APR and certain other elements calculated in a manner that is truly comparable across lenders.

Quebec variation: CPA art. 72 requires disclosure of "credit charges" rather than APR, with similar substantive elements and stricter disclosure of any administration fee bundled into the total. Lenders operating nationally typically produce dual-format disclosures.`,
  },
  {
    id: "auth-mp-direct-seller-harmonization",
    organizationId: "preview",
    title: "Pan-Canadian direct-sales cooling-off framework",
    source: "Consumer Measures Committee — Direct Sellers Harmonization (2004, with jurisdiction-by-jurisdiction implementation)",
    jurisdiction: "multi-provincial",
    registrationCategories: ["consumer-protection", "supplier", "door-to-door-seller"],
    content: `Pan-Canadian direct-sales framework

While each province administers its own direct-sellers licensing regime, the substantive rules have converged on a common template through the Consumer Measures Committee's work:

1. Licensing — direct sellers operating business-to-consumer outside their fixed place of business must be licensed by the provincial/territorial regulator. Individual salespeople are also licensed (by endorsement or separately).

2. Written contract — must include:
(a) parties' full names, addresses, telephone numbers;
(b) date of signing;
(c) itemised description of goods or services;
(d) total price with tax, shipping, and other charges specifically called out;
(e) delivery date and terms;
(f) conspicuous statement of the consumer's cancellation rights (form varies by province; text usually in 10 pt bold or equivalent).

3. 10-day cooling-off period — from the date the consumer receives a signed copy of the contract, the consumer may cancel for any reason.

4. Extended 1-year cancellation — where the supplier (a) does not provide a signed copy of the contract, (b) omits any mandatory contract element, (c) was not licensed, or (d) fails to deliver on time.

5. Refund on cancellation — within 15 days; the supplier is responsible for collecting goods (at supplier's expense) within 21 days.

6. Prohibited unsolicited door-to-door sales of home energy products — in force in Ontario (2018), Alberta (2018), British Columbia (via BPCPA regulations, 2019), Nova Scotia, New Brunswick, and Newfoundland/Labrador. Consumers must initiate the contact before a home-energy (HVAC, water heater, water treatment, energy audit) sale can be made at the consumer's home.

Practical compliance note: national direct sellers typically issue a single "most-restrictive" contract template that satisfies every province's required contents and cancellation text, with French-language parallel for Quebec and additional Quebec-specific CPA Part 2 elements.`,
  },
  {
    id: "auth-mp-debit-card-code",
    organizationId: "preview",
    title: "Canadian Code of Practice for Consumer Debit Card Services",
    source: "Electronic Funds Transfer Working Group / Financial Consumer Agency of Canada",
    jurisdiction: "multi-provincial",
    registrationCategories: ["consumer-protection", "financial-institution"],
    content: `Canadian Code of Practice for Consumer Debit Card Services

A voluntary code developed by the Electronic Funds Transfer Working Group (federal/provincial consumer ministries, card issuers, Interac, consumer groups) and endorsed by the Financial Consumer Agency of Canada. Adopted by all major deposit-taking institutions in Canada.

Key provisions:

Part 1 — Liability allocation. The consumer is not liable for losses resulting from:
(a) technical problems, system failures, or errors by the card issuer;
(b) unauthorised use of a card before the consumer receives it;
(c) forced withdrawal under duress;
(d) transactions after the consumer reports a lost or stolen card.

The consumer IS responsible for losses where the consumer has:
(a) voluntarily disclosed the PIN or permitted another person to see it;
(b) written the PIN on the card or on a document kept with the card; or
(c) contributed to the unauthorised use through demonstrable negligence.

Part 2 — Dispute resolution. The institution must:
(a) investigate the consumer's claim promptly;
(b) attempt to resolve within 10 business days of the complaint;
(c) if more time is needed, issue a provisional credit and complete the investigation within 45 days (90 days for cross-border);
(d) if not resolved to the consumer's satisfaction, escalate to an external complaints body (ombudsman).

Part 3 — Card issuance and information. Cards must be delivered unactivated; the PIN must be transmitted separately; the cardholder agreement must be written in plain language and provided before activation. Terms material to the consumer's liability (especially Part 1 conditions) must be highlighted.

Part 4 — Monitoring. FCAC monitors adherence through its periodic compliance reports under the Financial Consumer Protection Framework (Bank Act ss. 627 et seq.).

Relationship to provincial consumer law: the Code coexists with provincial consumer-protection legislation that applies to non-bank card issuers (payment card networks, prepaid card issuers). Provincial legislation provides enforcement backstops (e.g. Manitoba CPA Part XXII on prepaid purchase cards) where the federal Code is not enforceable against the non-bank issuer.`,
  },
  {
    id: "auth-mp-competition-bureau-digest",
    organizationId: "preview",
    title: "Competition Bureau Deceptive Marketing Practices Digest",
    source: "Competition Bureau (Canada), Deceptive Marketing Practices Digest (ongoing publication)",
    jurisdiction: "multi-provincial",
    registrationCategories: ["consumer-protection", "supplier"],
    content: `Competition Bureau — Deceptive Marketing Practices Digest

Published continuously since 2015, the Digest is the Bureau's non-binding guidance on how it applies Part VI.1 and Part VII.1 of the Competition Act (s. 52 criminal track, s. 74.01 civil track) to modern marketing issues. It is not law but is heavily cited by provincial consumer regulators applying their own unfair-practice statutes to parallel fact patterns.

Key topic areas:

1. Drip pricing and partitioned pricing — since 2022, the Bureau's position is that any mandatory fee imposed by the supplier must appear in the advertised price. Incidental taxes imposed by government are the only permissible exclusion.

2. Performance claims and environmental claims (greenwashing) — the supplier bears the burden of proving the claim was based on an "adequate and proper test" existing at the time the claim was first made. The 2024 Competition Act amendments (S.C. 2024, c. 15) added specific reverse-onus greenwashing provisions (s. 74.01(1)(b.1) and (b.2)).

3. Influencer and testimonial disclosure — any material connection between an endorser and a supplier must be disclosed clearly and conspicuously at the point the consumer encounters the endorsement (e.g. "#ad", "#sponsored", "#ambassador" in the first line of a social media post, not buried in hashtags).

4. "Free" claims — a product or service offered as "free" or "no charge" must truly be free to the consumer. Bundled or conditional "free" offers require clear disclosure of all conditions in immediate proximity to the "free" claim.

5. Ordinary price representations — a supplier advertising a savings from an "ordinary" or "regular" price must meet the statutory volume test or time test in s. 74.01(2). The Bureau's enforcement position on the time test is that the product must have been offered at that price in good faith, not token availability.

6. Dark patterns in online checkout — the Bureau has publicly identified deceptive design patterns (pre-checked upsells, forced-action flows, hidden unsubscribe) as reviewable conduct under s. 74.01 where the design would reasonably mislead the consumer.

Enforcement parallels: provincial regulators applying "unfair practices" statutes routinely cite the Digest as persuasive authority. A practice held deceptive by the Bureau under s. 74.01 is almost always deceptive under Ontario CPA s. 14, BC BPCPA s. 4, Quebec CPA arts. 219-221, and parallel provisions across Canada.`,
  },
  {
    id: "auth-mp-ccir-mga-framework",
    organizationId: "preview",
    title: "CCIR / CISRO Fair Treatment of Customers Guidance",
    source: "Canadian Council of Insurance Regulators and Canadian Insurance Services Regulatory Organizations, Guidance: Conduct of Insurance Business and Fair Treatment of Customers (2018, updated)",
    jurisdiction: "multi-provincial",
    registrationCategories: ["consumer-protection", "insurer", "financial-institution"],
    content: `CCIR/CISRO Fair Treatment of Customers (FTC) Guidance

Joint guidance issued by the Canadian Council of Insurance Regulators (CCIR) and the Canadian Insurance Services Regulatory Organizations (CISRO). Adopted by all provincial and territorial insurance regulators as a supervisory expectation. While not statutory, FTC breaches are typically prosecuted under the provincial Insurance Act's "unfair or deceptive acts" provisions.

Ten FTC outcomes insurers and intermediaries must achieve:

1. Fair treatment is a core business strategy embedded in corporate culture, governance, and conduct risk management.

2. Conflicts of interest are identified, managed, and disclosed.

3. Insurance products are designed to meet the needs of identified customer groups and are distributed accordingly.

4. Promotional material is accurate, clear, not misleading, and consistent with the product's target market.

5. Customers receive appropriate advice before and at the point of sale, including information about the product's features, risks, and costs.

6. Customer expectations about product performance and service are properly managed.

7. Claims, complaints, and disputes are handled in a fair, timely, and transparent manner.

8. Customer information is collected, used, and retained in accordance with privacy law and customer expectations.

9. Complaints are recorded and the insurer uses complaint data to identify and address root causes.

10. Suitability and affordability are considered throughout the product lifecycle (not just at sale).

Relationship with consumer law: insurance consumer protection is primarily provincial (via each province's Insurance Act) but the FTC framework is pan-Canadian. The federal Bank Act Financial Consumer Protection Framework applies additionally where federally regulated banks sell or promote insurance products (s. 418 and following).`,
  },
];
