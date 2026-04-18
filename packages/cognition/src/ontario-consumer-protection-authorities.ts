/**
 * Ontario consumer protection authorities — Consumer Protection Act, 2002.
 *
 * The existing Ontario authority corpus in this package is securities-
 * focused (NI 45-106, NI 31-103, OSC rules). Consumer protection in
 * Ontario is governed by an entirely separate statute: the Consumer
 * Protection Act, 2002, S.O. 2002, c. 30, Sched. A (CPA 2002), administered
 * by Consumer Services, Ministry of Public and Business Service Delivery
 * and Procurement.
 *
 * We keep this file separate from `authorities.ts` (securities) so a
 * "consumer protection" matter in Ontario retrieves consumer-protection
 * items, not offering-memorandum review items. Both are tagged
 * jurisdiction: "ontario"; distinction is by registrationCategories:
 * securities items use ["emd", "pm", "iiroc", "issuer"]; consumer-
 * protection items use ["consumer-protection", "supplier", "retailer",
 * etc.].
 *
 * Source: CPA 2002 consolidation (ontario.ca/laws), section numbering
 * current to 2025 including the Strengthening Consumer Protection and
 * Electricity System Oversight Act, 2023 (which enacted the successor
 * Consumer Protection Act, 2023 — not yet in force as of April 2026; the
 * 2002 Act remains operative).
 */

import type { CognitionItem } from "./types.js";

export const ONTARIO_CONSUMER_PROTECTION_AUTHORITIES: CognitionItem[] = [
  {
    id: "auth-on-cpa-2002-14",
    organizationId: "preview",
    title: "Ontario CPA, 2002 s. 14 — False, misleading, or deceptive representations",
    source: "Consumer Protection Act, 2002 (Ontario), S.O. 2002, c. 30, Sched. A",
    jurisdiction: "ontario",
    registrationCategories: ["consumer-protection", "supplier"],
    content: `Section 14 — False, misleading or deceptive representation

(1) It is an unfair practice for a person to make a false, misleading or deceptive representation.

(2) Without limiting the generality of what constitutes a false, misleading or deceptive representation, the following are included:
1. A representation that the goods or services have sponsorship, approval, performance characteristics, accessories, uses, ingredients, benefits or quantities they do not have.
2. A representation that the person who is to supply the goods or services has sponsorship, approval, status, affiliation or connection the person does not have.
3. A representation that the goods or services are of a particular standard, quality, grade, style or model, if they are not.
4. A representation that the goods are new, or unused, if they are not, or are reconditioned or reclaimed, excluding goods rebuilt to a certified standard.
5. A representation that the goods have been used to an extent that is materially different from the fact.
6. A representation that the goods or services are available for a reason that does not exist.
7. A representation that the goods or services have been supplied in accordance with a previous representation, if they have not.
8. A representation that the goods or services or any part of them are available or can be delivered or performed when the person making the representation knows or ought to know they are not available or cannot be delivered or performed.
9. A representation that a service, part, replacement or repair is needed or advisable, if it is not.
10. A representation that a specific price advantage exists, if it does not.
11. A representation that misrepresents the authority of a salesperson, representative, employee or agent to negotiate the final terms of the agreement.
12. A representation that the transaction involves or does not involve rights, remedies or obligations if the representation is false, misleading or deceptive.
13. A representation using exaggeration, innuendo or ambiguity as to a material fact or failing to state a material fact if such use or failure deceives or tends to deceive.
14. A representation that misrepresents the purpose or intent of any solicitation of or any communication with a consumer.
15. A representation that misrepresents the purpose of any charge or proposed charge.
16. A representation that misrepresents or exaggerates the benefits that are likely to flow to a consumer if the consumer helps a person obtain new or potential customers.

(3) Unconscionable representation. It is an unfair practice to make an unconscionable representation, taking into account (a) that the person making the representation knows or ought to know the consumer is unable to protect their interests because of disability, ignorance, illiteracy, inability to understand the language, or age; (b) that the price grossly exceeds the price at which similar goods or services are readily available; (c) that the consumer is unable to receive a substantial benefit from the subject-matter; (d) that there is no reasonable probability of payment in full; (e) that the proposed transaction is excessively one-sided.`,
  },
  {
    id: "auth-on-cpa-2002-18",
    organizationId: "preview",
    title: "Ontario CPA, 2002 s. 18 — Remedies for unfair practices",
    source: "Consumer Protection Act, 2002 (Ontario), S.O. 2002, c. 30, Sched. A",
    jurisdiction: "ontario",
    registrationCategories: ["consumer-protection", "supplier"],
    content: `Section 18 — Rescission and damages for unfair practice

(1) Any consumer agreement, whether written, oral or implied, entered into by a consumer after or while a person has engaged in an unfair practice may be rescinded by the consumer and the consumer is entitled to any remedy that is available in law, including damages.

(2) Time limit — a consumer is entitled to rescind an agreement for unfair practice by giving notice in writing or any other way in which the consumer's intention to rescind is clear, within 1 year after entering into the agreement.

(3) If rescission is not possible because restitution is no longer possible or would be inequitable, or because the consumer elects not to rescind, the consumer is entitled to recover the amount by which the amount paid exceeds the value that the goods or services have to the consumer.

(11) Exemplary damages. A court may award exemplary or punitive damages in addition to any other remedy. Ontario courts have awarded substantial punitive damages where the unfair practice was deliberate or institutional (e.g. $100,000 in a high-pressure time-share sale, six-figure amounts in roofing-fraud class actions).

Section 8 — Consumer waiver void. Any waiver or release by a consumer of a right, benefit or protection provided under the CPA 2002 is void.

Section 6 — Class proceedings. A consumer may commence a proceeding in the Superior Court of Justice under the Class Proceedings Act, 1992 on behalf of members of a class of consumers. Consumer class actions may pierce mandatory arbitration and class-action-waiver clauses pursuant to s. 7(2) (Seidel v. TELUS Communications Inc., 2011 SCC 15, applied in Ontario via s. 7).`,
  },
  {
    id: "auth-on-cpa-2002-part-iv",
    organizationId: "preview",
    title: "Ontario CPA, 2002 Part IV — Rights and warranties in consumer agreements",
    source: "Consumer Protection Act, 2002 (Ontario), S.O. 2002, c. 30, Sched. A",
    jurisdiction: "ontario",
    registrationCategories: ["consumer-protection", "supplier", "retailer"],
    content: `Part IV — Rights and warranties in consumer agreements

Section 9(1) — Quality. The supplier is deemed to warrant that the services supplied under a consumer agreement are of a reasonably acceptable quality. This is additional to, not a replacement of, the implied conditions and warranties in the Sale of Goods Act applicable to consumer goods.

Section 9(2) — Implied conditions from Sale of Goods Act preserved. For consumer agreements involving goods, the implied conditions and warranties under the Sale of Goods Act apply and cannot be excluded.

Section 10 — Estimates. If a consumer receives an estimate, the supplier shall not charge the consumer an amount that exceeds the estimate by more than 10 per cent. A consumer may require the supplier to perform the services at or below the estimated price; if the supplier fails to do so, the consumer is entitled to damages and may refuse payment of the excess.

Section 11 — Written agreement binds. If an agreement is one required under the Act to be in writing, the supplier's failure to reduce it to writing renders the agreement unenforceable against the consumer but the consumer may enforce it against the supplier.

Section 13 — Ambiguities. Any ambiguity that allows for more than one reasonable interpretation is to be interpreted to the benefit of the consumer.`,
  },
  {
    id: "auth-on-cpa-2002-future-performance",
    organizationId: "preview",
    title: "Ontario CPA, 2002 ss. 22-26 — Future performance agreements",
    source: "Consumer Protection Act, 2002 (Ontario), S.O. 2002, c. 30, Sched. A",
    jurisdiction: "ontario",
    registrationCategories: ["consumer-protection", "supplier"],
    content: `Part IV Div. 2 — Future performance agreements (ss. 22-26)

Scope: a "future performance agreement" is a consumer agreement where delivery, performance, or payment in full does not occur at the time the agreement is made, and the total price exceeds $50 (s. 22).

Section 23 — Required contents. A future performance agreement shall include:
(a) the name of the consumer and supplier;
(b) the telephone number, fax number and address of the supplier, and of the person, if different, who is to receive notice of cancellation;
(c) the date the agreement was entered into;
(d) a fair and accurate description of the goods or services including technical requirements related to their use;
(e) itemised prices including taxes and shipping;
(f) a description of each additional charge;
(g) the total amount payable;
(h) terms and methods of payment;
(i) date of commencement of the services or delivery of the goods, and period of time for completion;
(j) the rights, responsibilities and obligations of the parties;
(k) any other prescribed information.

Section 25 — Delivery of copy. The supplier shall deliver a copy of the agreement to the consumer within 15 days of entering into the agreement.

Section 26 — Cancellation. A consumer may cancel a future performance agreement within 1 year if the supplier does not meet the content requirements of s. 23 or fails to deliver a copy under s. 25. The consumer may also cancel if the supplier fails to begin delivery within 30 days of the specified date.`,
  },
  {
    id: "auth-on-cpa-2002-distance",
    organizationId: "preview",
    title: "Ontario CPA, 2002 ss. 37-40 — Internet agreements",
    source: "Consumer Protection Act, 2002 (Ontario), S.O. 2002, c. 30, Sched. A; O. Reg. 17/05",
    jurisdiction: "ontario",
    registrationCategories: ["consumer-protection", "supplier", "distance-seller"],
    content: `Part IV Div. 4 — Internet agreements (ss. 37-40)

Scope: Ontario's adoption of the Internet Sales Contract Harmonization Template. Applies to consumer agreements formed by text-based internet communications where the total amount exceeds $50 (O. Reg. 17/05 s. 31(1)).

Section 38 — Pre-agreement disclosure. Before a consumer enters into an internet agreement, the supplier must disclose in a clear, comprehensible and prominent manner:
(a) supplier's name and contact information;
(b) fair and accurate description of the goods or services;
(c) itemised list of prices including taxes and shipping;
(d) total amount payable;
(e) terms and method of payment;
(f) currency;
(g) date of delivery/performance;
(h) restrictions, limitations, conditions of purchase;
(i) any information prescribed.

Section 38(3) — Express opportunity. The supplier must give the consumer an express opportunity to accept or decline the agreement and to correct errors immediately before entering into the agreement.

Section 39 — Copy. The supplier must deliver to the consumer a copy of the agreement in writing within 15 days after entering into the agreement.

Section 40 — Cancellation. The consumer may cancel an internet agreement:
(a) within 7 days after the later of (i) the day the consumer receives the copy of the agreement, or (ii) the day the goods or services are delivered/performed, if the supplier did not make the pre-agreement disclosure;
(b) within 30 days after entering into the agreement, if the supplier failed to provide the copy.

Section 99 — Credit card chargeback. Where the supplier fails to refund the consumer after a valid cancellation, the consumer may demand the card issuer reverse the charge. The card issuer must process the chargeback within prescribed time limits.`,
  },
  {
    id: "auth-on-cpa-2002-direct",
    organizationId: "preview",
    title: "Ontario CPA, 2002 ss. 42-43 + Direct Agreement rules — Door-to-door",
    source: "Consumer Protection Act, 2002 (Ontario), S.O. 2002, c. 30, Sched. A; O. Reg. 17/05",
    jurisdiction: "ontario",
    registrationCategories: ["consumer-protection", "supplier", "door-to-door-seller"],
    content: `Direct agreements (ss. 41-43, O. Reg. 17/05 ss. 34-38)

Scope: a "direct agreement" is a consumer agreement that is negotiated or concluded in person at a place other than the supplier's place of business or a marketplace, auction, trade fair, agricultural fair or exhibition, and the total exceeds $50.

Content requirements (O. Reg. 17/05 s. 35): name and address of consumer and supplier, date and place of signing, description of goods/services, itemised price, terms of payment, delivery/performance dates, and a statement of cancellation rights in the prescribed form set out conspicuously.

Section 43 — 10-day cancellation right. A consumer may cancel a direct agreement at any time from the date of entering into the agreement until 10 days after receiving the written copy.

Extended cancellation (O. Reg. 17/05 s. 38): 1 year where the supplier fails to meet any content requirement, fails to deliver the copy, or engages in an unfair practice.

Prohibited unsolicited home-energy sales (since 1 March 2018): Ontario Regulation 89/18 under the CPA 2002 prohibits unsolicited door-to-door sale of air conditioners, furnaces, heat pumps, water heaters, water treatment devices, water filters and water purifiers, and duct-cleaning services. A supplier that initiates the contact cannot sell, lease, or finance any of these products at the consumer's home. Contracts formed in violation of the prohibition are unenforceable against the consumer, and any payment made by the consumer must be refunded.

Section 99 — Chargeback rights apply to direct agreements cancelled under s. 43 on the same terms as internet agreements.`,
  },
  {
    id: "auth-on-cpa-2002-credit",
    organizationId: "preview",
    title: "Ontario CPA, 2002 Part VII — Cost of credit disclosure and credit agreements",
    source: "Consumer Protection Act, 2002 (Ontario), S.O. 2002, c. 30, Sched. A",
    jurisdiction: "ontario",
    registrationCategories: ["consumer-protection", "credit-grantor"],
    content: `Part VII — Credit Agreements (ss. 66-85)

Ontario's adoption of the pan-Canadian Cost of Credit Disclosure Harmonization Template (CMC, 1998). Core obligations on lenders:

Section 79 — Initial disclosure statement. Before entering into a fixed credit agreement, the lender must provide an initial disclosure statement containing:
(a) principal;
(b) cost of borrowing as an annual percentage rate (APR) calculated per s. 68;
(c) total amount payable;
(d) number, amount, and timing of payments;
(e) description of any security taken;
(f) charges on default;
(g) any optional services and their costs.

Section 80 — Statements for open credit. For open credit (credit cards, lines of credit), the lender must provide periodic statements showing opening balance, advances, payments, interest charges, and the minimum payment and due date.

Section 74 — Calculation of cost of borrowing. The APR must reflect all charges the borrower is required to pay in connection with the credit. Optional charges paid at the borrower's discretion (e.g., late fees if they are truly contingent, credit insurance if truly optional) may be excluded.

Section 71 — Deferred payment advertising. Advertising for deferred-payment plans must disclose in a comparable manner the cost of borrowing and all conditions. "No interest until [date]" advertising must disclose any cost that accrues if the balance is not paid in full.

Section 72 — Prepayment. The borrower may prepay the outstanding balance at any time. The lender is entitled to a reasonable charge to recover actual loss on certain closed-credit products (mortgages), but not on ordinary consumer credit.

Consumer remedies: breach of Part VII gives rise to a right of rescission and damages. The Financial Services Regulatory Authority (FSRA) supervises payday lenders; other credit grantors are supervised by Consumer Services within the Ministry of Public and Business Service Delivery and Procurement.`,
  },
];
