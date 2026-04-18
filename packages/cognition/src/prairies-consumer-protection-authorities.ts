/**
 * Prairie provinces consumer protection authorities — Saskatchewan and
 * Manitoba. Each province has its own distinct statutory regime.
 *
 * Saskatchewan: Consumer Protection and Business Practices Act, S.S.
 * 2013, c. C-30.2 (CPBPA). Replaces three earlier statutes and is
 * administered by the Consumer Protection Division of the Financial and
 * Consumer Affairs Authority of Saskatchewan (FCAA).
 *
 * Manitoba: Two primary statutes —
 *   (a) The Consumer Protection Act, C.C.S.M. c. C200 (CPA) — retail
 *       sales, credit sales, direct sales, distance sales.
 *   (b) The Business Practices Act, C.C.S.M. c. B120 (BPA) — unfair
 *       business practices (general anti-deception).
 * Administered by the Consumer Protection Office, Manitoba Justice.
 *
 * Source: official provincial consolidations current to 2025.
 */

import type { CognitionItem } from "./types.js";

export const SASKATCHEWAN_CPBPA_AUTHORITIES: CognitionItem[] = [
  {
    id: "auth-sk-cpbpa-6",
    organizationId: "preview",
    title: "Saskatchewan CPBPA s. 6 — Unfair practices",
    source: "The Consumer Protection and Business Practices Act (Saskatchewan), S.S. 2013, c. C-30.2",
    jurisdiction: "saskatchewan",
    registrationCategories: ["consumer-protection", "supplier"],
    content: `Section 6 — Unfair practices

(1) Every supplier shall deal fairly and honestly with consumers.

(2) A supplier commits an unfair practice if, by any means, the supplier:
(a) represents that the goods or services have sponsorship, approval, performance characteristics, accessories, uses, ingredients, benefits or quantities they do not have;
(b) represents that the supplier has a sponsorship, approval, status, affiliation, connection or identity they do not have;
(c) represents that goods are new or unused when they are not;
(d) represents that goods have been used to an extent that is materially different from the fact;
(e) represents that goods or services are available for a reason that does not exist;
(f) represents a price advantage that does not exist;
(g) represents that a part, repair, replacement or maintenance is needed when it is not;
(h) represents a particular need for the goods or services when no such need exists;
(i) fails to state a material fact if the failure would mislead a consumer;
(j) uses exaggeration, innuendo or ambiguity about a material fact;
(k) makes a representation or engages in conduct that is false, misleading or deceptive in respect of a consumer transaction.

Section 7 — Unconscionable acts. A supplier engages in an unconscionable act if the supplier knowingly takes advantage of a consumer because of the consumer's physical infirmity, ignorance, illiteracy, inability to understand, age, or inability to protect the consumer's own interests; or uses undue pressure, or imposes harsh or adverse terms that are inequitable.

Section 93 — Consumer remedies. A consumer who enters into a transaction after an unfair practice or unconscionable act may rescind within 1 year, and is entitled to damages, including punitive damages, and recovery of all payments made. Class actions are permitted; the Class Actions Act (Saskatchewan) applies.`,
  },
  {
    id: "auth-sk-cpbpa-direct-sales",
    organizationId: "preview",
    title: "Saskatchewan CPBPA Part III Division 1 — Direct sales contracts",
    source: "The Consumer Protection and Business Practices Act (Saskatchewan), S.S. 2013, c. C-30.2",
    jurisdiction: "saskatchewan",
    registrationCategories: ["consumer-protection", "supplier", "door-to-door-seller"],
    content: `Part III Division 1 — Direct sales contracts (ss. 29-36)

Scope: a direct sales contract is a contract made between a supplier and a consumer at a location other than the supplier's permanent place of business where the total price exceeds $50. Includes door-to-door sales, in-home sales, temporary booths, and kiosks outside the supplier's regular business premises.

Section 30 — Required contents. The contract must be in writing, signed by both parties, and contain:
(a) supplier's name, business name, address and phone;
(b) consumer's name and address;
(c) date and place of signing;
(d) detailed description of goods or services;
(e) itemised price (goods, services, taxes, shipping, any other charges) and total;
(f) terms of payment;
(g) delivery or performance date and place;
(h) statement of the consumer's cancellation rights in prescribed form.

Section 32 — Right to cancel without cause. The consumer may cancel a direct sales contract for any reason within 10 days after receiving a copy of the contract.

Section 33 — Extended cancellation. The consumer may cancel within 1 year if:
(a) the contract does not contain the required information under s. 30;
(b) the goods or services are not delivered within 30 days of the specified delivery date; or
(c) the supplier commits an unfair practice in connection with the contract.

Section 34 — Refund and return. The supplier must refund all money received within 15 days of cancellation. The consumer must make the goods available for return; the supplier bears the cost of pick-up.

Licensing: certain direct sellers (alarm sales, home renovation contractors, water treatment sellers) must be individually licensed under the CPBPA's designated business regime.`,
  },
  {
    id: "auth-sk-cpbpa-internet-sales",
    organizationId: "preview",
    title: "Saskatchewan CPBPA Part III Division 3 — Internet sales contracts",
    source: "The Consumer Protection and Business Practices Act (Saskatchewan), S.S. 2013, c. C-30.2",
    jurisdiction: "saskatchewan",
    registrationCategories: ["consumer-protection", "supplier", "distance-seller"],
    content: `Part III Division 3 — Internet sales contracts

Scope: a consumer transaction formed by the exchange of text-based electronic communications where the total consideration exceeds $50. Mirrors the pan-Canadian Internet Sales Contract Harmonization Template.

Mandatory pre-contract disclosure (s. 43): the supplier must disclose, in a way that is clear, comprehensible and prominent:
(a) supplier's name, business name, address, and contact information;
(b) fair and accurate description of goods or services;
(c) itemised list of the price, including related costs (shipping, handling);
(d) total price;
(e) currency;
(f) terms, conditions and method of payment;
(g) date of delivery, performance, or both;
(h) cancellation, return, exchange, and refund policies;
(i) any other restrictions material to the consumer's decision.

Section 44 — Express opportunity to accept, decline, and correct errors. The contract is not formed unless the consumer is given this express opportunity.

Section 45 — Copy of the contract. The supplier must provide a copy of the contract to the consumer within 15 days of the contract being entered into.

Section 46 — Cancellation right:
(a) 7 days after receiving the copy, if pre-contract disclosure or the express-opportunity requirement was not met;
(b) 30 days after the contract date, if the copy was not delivered;
(c) any time before goods/services are delivered/performed, if the supplier fails to deliver within 30 days of the specified date.

Section 47 — Credit-card chargeback. Where the supplier fails to refund after a valid cancellation, the consumer may demand the card issuer reverse the charge.`,
  },
  {
    id: "auth-sk-cpbpa-future-performance",
    organizationId: "preview",
    title: "Saskatchewan CPBPA Part III Division 2 — Future performance contracts",
    source: "The Consumer Protection and Business Practices Act (Saskatchewan), S.S. 2013, c. C-30.2",
    jurisdiction: "saskatchewan",
    registrationCategories: ["consumer-protection", "supplier"],
    content: `Part III Division 2 — Future performance contracts (ss. 37-42)

Scope: a future performance contract is a consumer contract where payment is not made in full at the time of contract, or the goods or services are not delivered in full at that time, and the total exceeds $50.

Section 38 — Required written contract with same information elements as direct sales (supplier identity, goods/services description, itemised pricing, delivery/performance dates, cancellation rights).

Section 40 — Cancellation on supplier default. The consumer may cancel if the supplier fails to begin performance within 30 days of the date specified in the contract, or fails to deliver the goods within 30 days of the date specified.

Section 41 — Cancellation for non-compliance. The consumer may cancel within 1 year if the contract does not comply with s. 38 or the copy is not provided within 15 days.

Section 42 — Refund. The supplier must refund within 15 days of cancellation.`,
  },
];

export const MANITOBA_CONSUMER_PROTECTION_AUTHORITIES: CognitionItem[] = [
  {
    id: "auth-mb-bpa-2",
    organizationId: "preview",
    title: "Manitoba Business Practices Act s. 2 — Unfair business practices",
    source: "The Business Practices Act (Manitoba), C.C.S.M. c. B120",
    jurisdiction: "manitoba",
    registrationCategories: ["consumer-protection", "supplier"],
    content: `Section 2 — Unfair business practices

(1) No supplier shall engage in an unfair business practice.

(2) "Unfair business practice" means any of the following, in relation to a consumer transaction or proposed consumer transaction:
(a) a representation that goods or services have sponsorship, approval, performance characteristics, accessories, ingredients, uses, quantities, benefits or affiliation they do not have;
(b) a representation that the supplier has a sponsorship, approval, status, affiliation or connection they do not have;
(c) a representation that goods are of a particular standard, quality, grade, style or model if they are not;
(d) a representation that the goods are new or unused if they are not, or are of a particular year if they are not;
(e) a representation that a specific price advantage exists if it does not;
(f) a representation that a part, repair or service is needed if it is not;
(g) a representation that the goods are available where they are not;
(h) using exaggeration, innuendo or ambiguity about a material fact or failing to state a material fact if the failure misleads;
(i) entering into a consumer transaction if the supplier knows or ought to know that the consumer is unable to receive a substantial benefit because of the consumer's physical or mental infirmity, ignorance, illiteracy, age or inability to understand the nature of the transaction;
(j) entering into a consumer transaction on terms so harsh or adverse as to be inequitable;
(k) a false or misleading statement about the price of goods or services.

Section 23 — Consumer remedies. A consumer who has suffered loss as a result of an unfair business practice may rescind the transaction within 1 year and recover damages. The court may also award exemplary damages. Class actions are permitted under the Manitoba Class Proceedings Act.`,
  },
  {
    id: "auth-mb-cpa-retail-sales",
    organizationId: "preview",
    title: "Manitoba CPA Part XVI — Retail sales (implied conditions and warranties)",
    source: "The Consumer Protection Act (Manitoba), C.C.S.M. c. C200",
    jurisdiction: "manitoba",
    registrationCategories: ["consumer-protection", "supplier", "retailer"],
    content: `Part XVI — Retail sales

Section 58 — Implied conditions and warranties. In every retail sale, notwithstanding any agreement to the contrary, the following conditions and warranties are implied:

(a) Title — the seller has the right to sell the goods.

(b) Description — where goods are sold by description, the goods will correspond with the description.

(c) Merchantable quality — where goods are sold in the course of the seller's business, the goods will be of merchantable quality, except as to defects specifically drawn to the buyer's attention before the contract is made.

(d) Fitness for purpose — where the buyer expressly or by implication makes known to the seller the particular purpose for which the goods are required, there is an implied condition that the goods will be reasonably fit for that purpose.

(e) Sample — where goods are sold by sample, the bulk will correspond with the sample in quality.

(f) Durability — goods will be durable for a reasonable period of time having regard to all the relevant circumstances including the nature of the goods, the price, and the express terms of the contract.

Section 58.1 — No contracting out. A term in a consumer transaction that purports to negative or vary any of the implied conditions or warranties, or any of the rights of a buyer under this Part, is void.

Section 58.3 — Manufacturer liability. The manufacturer is jointly liable with the retail seller for breach of an express warranty made by the manufacturer, and for breach of the implied conditions of merchantable quality and durability.`,
  },
  {
    id: "auth-mb-cpa-direct-sales",
    organizationId: "preview",
    title: "Manitoba CPA Part V — Direct sales",
    source: "The Consumer Protection Act (Manitoba), C.C.S.M. c. C200",
    jurisdiction: "manitoba",
    registrationCategories: ["consumer-protection", "supplier", "door-to-door-seller"],
    content: `Part V — Direct sales (ss. 37-51)

Licensing: every direct seller and direct seller's salesperson must be licensed under Part V. Operating without a licence is an offence.

Section 43 — Contract requirements. A direct sale contract must be in writing and signed by both parties, and must contain:
(a) the names and addresses of the direct seller, the salesperson, and the consumer;
(b) the date of signing;
(c) a description of the goods or services;
(d) itemised price;
(e) any trade-in allowance;
(f) terms of payment;
(g) delivery date and place;
(h) a statement of the consumer's 10-day cancellation right in the prescribed form, printed in bold type.

Section 44 — Right to cancel. A consumer may cancel a direct sales contract within 10 days after receiving the contract, for any reason. Cancellation may be communicated by any means that clearly indicates the consumer's intent.

Extended cancellation (s. 45): up to 1 year where (a) the contract does not contain the required elements of s. 43; (b) the contract is not signed by both parties; (c) delivery is not made within 30 days of the specified date; or (d) the goods or services delivered differ materially from those contracted for.

Section 46 — Effect of cancellation. The contract is void and the consumer is entitled to a full refund within 15 days. The consumer must make the goods available for collection at their expense to the direct seller.`,
  },
  {
    id: "auth-mb-cpa-internet",
    organizationId: "preview",
    title: "Manitoba CPA Part XXI — Internet and mail-order contracts",
    source: "The Consumer Protection Act (Manitoba), C.C.S.M. c. C200",
    jurisdiction: "manitoba",
    registrationCategories: ["consumer-protection", "supplier", "distance-seller"],
    content: `Part XXI — Internet agreements (ss. 127-136)

Scope: a consumer agreement formed by text-based internet communications where the total amount payable exceeds $50. Tracks the Internet Sales Contract Harmonization Template.

Pre-contract disclosure (s. 128) includes all standard ISCH elements — supplier identification, goods/services description, itemised pricing and total, currency, payment terms, delivery, cancellation/return policies.

Section 129 — Express opportunity to accept, decline and correct errors before submission.

Section 130 — Copy of the agreement must be delivered within 15 days.

Section 132 — Cancellation right. The consumer may cancel:
(a) within 7 days after receiving the copy, if pre-contract disclosure was not made or the express-opportunity requirement was not met;
(b) within 30 days of entering into the agreement, if the copy was not delivered;
(c) any time before delivery/performance, if the supplier fails to deliver within 30 days of the specified date.

Section 133 — Credit-card chargeback. The consumer may demand the credit card issuer reverse the charge where the supplier does not refund after a valid cancellation.

Section 134 — Offences. A supplier that contravenes Part XXI commits an offence and is liable on summary conviction to a fine of up to $300,000 (corporation) or $100,000 (individual).`,
  },
  {
    id: "auth-mb-cpa-prepaid-purchase-cards",
    organizationId: "preview",
    title: "Manitoba CPA Part XXII — Prepaid purchase cards (gift cards)",
    source: "The Consumer Protection Act (Manitoba), C.C.S.M. c. C200",
    jurisdiction: "manitoba",
    registrationCategories: ["consumer-protection", "supplier", "retailer"],
    content: `Part XXII — Prepaid purchase cards

Section 160 — Scope. A "prepaid purchase card" means a card, gift certificate, written certificate or electronic credit issued in exchange for consideration that can be used to purchase goods or services from one or more suppliers.

Section 161 — No expiry date. An expiry date cannot be imposed on the cash value of a prepaid purchase card, except for single-use promotional cards issued at no cost or awarded as part of a loyalty program, or cards for a specific service with inherent time limits (e.g. a spa day package).

Section 162 — Fees prohibited:
(a) no activation fee;
(b) no dormancy or inactivity fee;
(c) no fee for replacing a lost card where the card is registered;
(d) no fee for checking the balance.
Exception: multi-store "open-loop" cards (such as Visa/Mastercard gift cards) may charge a dormancy fee only after 15 months of inactivity and only if clearly disclosed on the card and at the point of sale.

Section 163 — Low-balance redemption. If the remaining balance on a prepaid purchase card is less than $5 (or as prescribed), the consumer may redeem the balance in cash. This prevents small residual balances from becoming breakage revenue.

Section 164 — Replacement. A consumer who registered a prepaid card with the supplier and subsequently loses it must be provided a replacement for the remaining balance without charge.`,
  },
];
