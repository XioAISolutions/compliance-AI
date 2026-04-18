/**
 * British Columbia consumer protection authorities.
 *
 * BC's primary consumer statute is the Business Practices and Consumer
 * Protection Act, S.B.C. 2004, c. 2 (BPCPA). It consolidates BC's former
 * Trade Practice Act, Consumer Protection Act, and Cost of Consumer
 * Credit Disclosure Act into a single instrument regulated by Consumer
 * Protection BC (a delegated administrative authority).
 *
 * Coverage:
 *   - Part 2 — Unfair practices (deceptive and unconscionable acts)
 *   - Part 3 — Credit reporting
 *   - Part 4 — Consumer contracts (direct, future-performance, distance,
 *     time share, continuing services)
 *   - Part 5 — Consumer transactions — cost of credit disclosure
 *   - Remedies — court orders, undertakings, AMPs, restitution
 *
 * Source: BC consolidated statutes as published on bclaws.gov.bc.ca,
 * section numbering current to the 2025 consolidation.
 */

import type { CognitionItem } from "./types.js";

export const BC_BPCPA_AUTHORITIES: CognitionItem[] = [
  {
    id: "auth-bc-bpcpa-4",
    organizationId: "preview",
    title: "BC BPCPA s. 4 — Deceptive acts or practices",
    source: "Business Practices and Consumer Protection Act, S.B.C. 2004, c. 2",
    jurisdiction: "british-columbia",
    registrationCategories: ["consumer-protection", "supplier"],
    content: `Section 4 — Deceptive acts or practices

(1) In this Act, "deceptive act or practice" means, in relation to a consumer transaction,
(a) an oral, written, visual, descriptive or other representation by a supplier, or
(b) any conduct by a supplier,
that has the capability, tendency or effect of deceiving or misleading a consumer or guarantor.

(3) Without limiting subsection (1), a deceptive act or practice includes:
(a) a representation that the goods or services have sponsorship, approval, performance characteristics, accessories, ingredients, quantities, components, uses or benefits they do not have;
(b) a representation that the supplier has a sponsorship, approval, status, affiliation or connection the supplier does not have;
(c) a representation that the goods are new, or unused, if they are not;
(d) a representation that the goods have been used to an extent that is materially different from the fact;
(e) a representation that the goods or services are available for a reason that differs from the fact;
(f) a representation that the goods or services have been supplied in accordance with a previous representation if they have not;
(g) a representation that the goods or services are available in greater quantity than the supplier intends to make available;
(h) a representation that specific price benefits or advantages exist if they do not;
(i) a representation that a part, replacement, service or repair is needed if it is not;
(j) a representation that discloses an intention not to sell goods or services as advertised;
(k) a representation that the transaction involves or does not involve rights, remedies or obligations that is false, deceptive or misleading;
(l) using exaggeration, innuendo or ambiguity respecting a material fact;
(m) failing to state a material fact if the effect of the failure is deceptive.

Burden of proof (s. 5): if a deceptive act or practice is alleged in a proceeding, the burden is on the supplier to prove that the act or practice was not deceptive.`,
  },
  {
    id: "auth-bc-bpcpa-8",
    organizationId: "preview",
    title: "BC BPCPA s. 8 — Unconscionable acts or practices",
    source: "Business Practices and Consumer Protection Act, S.B.C. 2004, c. 2",
    jurisdiction: "british-columbia",
    registrationCategories: ["consumer-protection", "supplier"],
    content: `Section 8 — Unconscionable acts or practices

(1) An unconscionable act or practice by a supplier may occur before, during or after the consumer transaction.

(2) In determining whether an act or practice is unconscionable, a court must consider all of the surrounding circumstances of which the supplier knew or ought to have known. Circumstances that the court must consider include the following:
(a) that the supplier subjected the consumer to undue pressure to enter into the consumer transaction;
(b) that the supplier took advantage of the consumer's inability or incapacity to reasonably protect his or her own interest because of the consumer's physical or mental infirmity, ignorance, illiteracy, age or inability to understand the character, nature or language of the consumer transaction, or any other matter related to the transaction;
(c) that, at the time the consumer transaction was entered into, the total price grossly exceeded the total price at which similar subjects of similar consumer transactions were readily obtainable by similar consumers;
(d) that, at the time the consumer transaction was entered into, there was no reasonable probability of full payment of the total price by the consumer;
(e) that the terms or conditions on, or subject to, which the consumer entered into the consumer transaction were so harsh or adverse to the consumer as to be inequitable;
(f) a prescribed circumstance.

(3) If an unconscionable act or practice occurred in respect of a consumer transaction, that consumer transaction is not binding on the consumer or guarantor.

Effect: s. 8 is a statutory super-set of common-law unconscionability — grossly excessive pricing alone (s. 8(2)(c)) or inequitable terms alone (s. 8(2)(e)) can ground relief. The consumer transaction is automatically void (s. 8(3)), not merely voidable.`,
  },
  {
    id: "auth-bc-bpcpa-part4-direct-sales",
    organizationId: "preview",
    title: "BC BPCPA Part 4 Division 2 — Direct sales contracts",
    source: "Business Practices and Consumer Protection Act, S.B.C. 2004, c. 2",
    jurisdiction: "british-columbia",
    registrationCategories: ["consumer-protection", "supplier", "door-to-door-seller"],
    content: `Part 4 Division 2 — Direct sales contracts (ss. 17-20)

Scope: a "direct sales contract" is a contract between a supplier and a consumer for the supply of goods or services that is negotiated or concluded in person at a place other than (a) the supplier's place of business, or (b) a market place, auction, trade fair, agricultural fair or exhibition. Captures door-to-door sales, in-home sales, and presentations at rented public spaces.

Section 19 — Required contents. A direct sales contract must:
(a) be in writing;
(b) be dated the date the consumer signs;
(c) contain the names, addresses and telephone numbers of the supplier and consumer;
(d) contain an itemised list of the goods or services supplied, the total price, the terms of payment;
(e) contain a statement of the consumer's cancellation rights in the prescribed form, set out conspicuously;
(f) be signed by the consumer and supplier; and
(g) be given to the consumer at the time it is signed.

Section 21 — Cancellation right. A consumer may cancel a direct sales contract at any time from the date the contract is entered into until 10 days after the consumer receives a copy of the contract.

Extended cancellation (s. 23): if the supplier fails to include any of the mandatory elements in s. 19, the consumer may cancel for up to 1 year after entering into the contract. If the supplier commits a deceptive or unconscionable act or practice in connection with the contract, the consumer may cancel at any time after entering into the contract.

Effect of cancellation (s. 27): the supplier must refund in full within 15 days of cancellation. The consumer must return the goods (at the supplier's expense) within 21 days of giving notice.`,
  },
  {
    id: "auth-bc-bpcpa-part4-distance-sales",
    organizationId: "preview",
    title: "BC BPCPA Part 4 Division 4 — Distance sales contracts",
    source: "Business Practices and Consumer Protection Act, S.B.C. 2004, c. 2",
    jurisdiction: "british-columbia",
    registrationCategories: ["consumer-protection", "supplier", "distance-seller"],
    content: `Part 4 Division 4 — Distance sales contracts (ss. 46-54)

Scope: a "distance sales contract" is a contract for the supply of goods or services between a supplier and a consumer that is not entered into in person. BC's distance-sales rules track the Internet Sales Contract Harmonization Template adopted by most Canadian jurisdictions.

Section 47 — Pre-contract disclosure (threshold: contracts with total price greater than $50). Before the consumer enters into the contract, the supplier must disclose:
(a) supplier's name and, if different, the name under which business is carried on;
(b) supplier's telephone number and address at which it carries on business;
(c) fair and accurate description of the goods or services;
(d) itemised list of the price and related costs (taxes, shipping);
(e) total price;
(f) currency in which the prices are payable;
(g) terms of payment;
(h) date and terms of delivery, performance or both;
(i) cancellation, return, exchange and refund policies;
(j) any other terms material to the consumer's decision.

Section 48 — Express opportunity to accept, decline, and correct errors — the supplier must give the consumer the express opportunity to accept or decline the proposed contract and correct errors before submitting it.

Section 49 — Copy of the contract — supplier must provide the consumer with a copy within 15 days after the contract is entered into, containing the disclosures in s. 47 and the consumer's cancellation rights.

Section 52 — Cancellation. The consumer may cancel the contract within 7 days of receiving the copy if the supplier failed to disclose information required by s. 47 or failed to deliver the copy under s. 49. If the goods are not delivered within 30 days of the date specified, the consumer may cancel until delivery.

Credit card chargeback (s. 99): where a supplier fails to reimburse after a valid cancellation, the consumer may demand a chargeback from the credit card issuer, which must reverse the charge within prescribed time limits.`,
  },
  {
    id: "auth-bc-bpcpa-part4-future-performance",
    organizationId: "preview",
    title: "BC BPCPA Part 4 Division 5 — Future performance contracts",
    source: "Business Practices and Consumer Protection Act, S.B.C. 2004, c. 2",
    jurisdiction: "british-columbia",
    registrationCategories: ["consumer-protection", "supplier"],
    content: `Part 4 Division 5 — Future performance contracts (ss. 17-23, 56-57)

Definition: "future performance contract" is a contract between a supplier and a consumer for the supply of goods or services, where the supply or payment in full is not made at the time the contract is made, and the total price exceeds $50.

Section 19 (applied via s. 56) — Required contents of a future performance contract:
(a) name, business and mailing address, telephone number, and if available, fax and email of supplier;
(b) consumer's name;
(c) date contract is entered into and the supplier's obligations;
(d) itemised list of goods or services with particulars;
(e) itemised price, total price, currency;
(f) terms and times of payment;
(g) date and terms of delivery or performance;
(h) any cancellation, return or refund policies;
(i) any other terms material to the consumer's decision.

Section 23 — Extended cancellation: if the supplier fails to provide the copy required by s. 22 within 15 days, OR fails to include the mandatory contents in s. 19, the consumer may cancel within 1 year.

Additional cancellation rights (s. 25): if the supplier fails to begin performance within 30 days of the date specified in the contract, or the goods have not been delivered within 30 days of the date specified, the consumer may cancel until the goods are delivered or the services begin.`,
  },
  {
    id: "auth-bc-bpcpa-part4-continuing-services",
    organizationId: "preview",
    title: "BC BPCPA Part 4 Division 6 — Continuing services contracts",
    source: "Business Practices and Consumer Protection Act, S.B.C. 2004, c. 2",
    jurisdiction: "british-columbia",
    registrationCategories: ["consumer-protection", "supplier"],
    content: `Part 4 Division 6 — Continuing services contracts (ss. 25-29)

Scope: a "continuing services contract" is a contract for services that are to be provided on a recurring basis over a defined period of more than 2 months. Examples: gym memberships, dating services, weight-loss programs, tutoring services, some home alarm monitoring.

Section 25 — Required contents. In addition to the Division 5 future performance contract contents, the contract must include:
(a) the date services are to commence;
(b) a schedule or timetable of the services;
(c) a statement of the consumer's right to cancel.

Section 26 — Ongoing cancellation right. At any time during the term of a continuing services contract, the consumer may cancel if:
(a) the consumer moves more than 30 km further from the facility where services are provided;
(b) the consumer has a health condition certified by a doctor that prevents use of the services;
(c) the services are no longer offered or the facility is materially changed;
(d) the supplier materially breaches the contract.

Section 27 — Automatic renewal prohibitions. A continuing services contract cannot automatically renew for a term of more than 1 year unless the consumer separately consents to the renewal within 1 month before the renewal date.

Section 28 — Refunds on cancellation. The supplier must refund the prorated balance within 15 days of cancellation.

Consumer Protection BC enforcement: continuing-services non-compliance is a frequent subject of CPBC investigations and the basis of many consent undertakings published annually.`,
  },
  {
    id: "auth-bc-bpcpa-part5-credit",
    organizationId: "preview",
    title: "BC BPCPA Part 5 — Consumer credit disclosure",
    source: "Business Practices and Consumer Protection Act, S.B.C. 2004, c. 2",
    jurisdiction: "british-columbia",
    registrationCategories: ["consumer-protection", "credit-grantor"],
    content: `Part 5 — Cost of credit disclosure

BC's credit disclosure rules are harmonised with the pan-Canadian Consumer Measures Committee template (adopted by all provinces except Quebec). Key obligations:

Section 66 — Initial disclosure statement. Before a consumer enters into a credit agreement, the credit grantor must provide a written initial disclosure statement that includes:
(a) principal amount;
(b) cost of borrowing (expressed as an annual percentage rate, APR);
(c) total amount of all payments;
(d) schedule of payments;
(e) description of any security interest;
(f) charges for default;
(g) any optional services and their costs.

Section 68 — Subsequent disclosure. For open-end credit (credit cards, lines of credit), the credit grantor must issue monthly statements with (a) balance at beginning and end of the period, (b) itemised advances and payments, (c) interest charged, (d) the minimum payment due and due date, (e) the total of any fees.

Section 71 — Maximum interest rate. The credit grantor cannot charge a rate higher than that disclosed. A subsequent increase requires a new disclosure statement and the consumer's consent.

Section 72 — Prepayment rights. The consumer may prepay the outstanding balance of a fixed credit agreement at any time without penalty (other than compensation for the actual loss to the credit grantor as prescribed).

Section 112.1 — Payday loans. BC has a separate payday loans regulation capping total charges at 15% of the principal, prohibiting rollovers, and requiring a signed contract with specific disclosures (Business Practices and Consumer Protection Regulation, B.C. Reg. 57/2009).`,
  },
  {
    id: "auth-bc-bpcpa-remedies",
    organizationId: "preview",
    title: "BC BPCPA ss. 171-172, 189-194 — Consumer and regulator remedies",
    source: "Business Practices and Consumer Protection Act, S.B.C. 2004, c. 2",
    jurisdiction: "british-columbia",
    registrationCategories: ["consumer-protection", "supplier"],
    content: `Sections 171-172, 189-194 — Remedies

Section 171 — Court orders on application by a consumer, the Director of Consumer Protection BC, or a consumer group. Available orders:
(a) declaration that an act or practice contravenes the Act;
(b) interim or permanent injunction restraining the conduct;
(c) order requiring the supplier to restore to any affected person any money or other property or thing;
(d) order requiring the supplier to pay damages, including punitive or exemplary damages, to affected persons;
(e) order freezing assets of the supplier;
(f) any other order the court considers appropriate.

Section 172 — Civil liability for deceptive or unconscionable acts or practices. A consumer who suffers damages as a result of a deceptive or unconscionable act or practice is entitled to damages, and need not prove that they relied on the practice in entering the transaction.

Section 189 — Undertakings. The Director may accept a written undertaking from a supplier to cease a practice, make restitution, pay an administrative penalty, or comply with the Act. Undertakings are published on the Consumer Protection BC website.

Section 190 — Administrative penalties. The Director may impose an administrative penalty of up to $50,000 per contravention for corporations ($5,000 for individuals). Amounts are cumulative per day of continuing contravention.

Section 194 — Offences and offence penalties. On summary conviction, a corporation is liable to a fine of up to $100,000 per offence; an individual to a fine of up to $10,000 and/or 12 months imprisonment.

Section 195 — Class actions. Remedies under s. 171 and s. 172 may be pursued as class actions; the BC Class Proceedings Act applies. BC courts have certified consumer-protection class actions on misleading pricing, unfair contract terms, and failure to honour advertised cancellation policies.`,
  },
];
