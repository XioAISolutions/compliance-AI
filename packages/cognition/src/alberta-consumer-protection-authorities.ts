/**
 * Alberta consumer protection authorities.
 *
 * Alberta's Consumer Protection Act, R.S.A. 2000, c. C-26.3 (formerly the
 * Fair Trading Act, renamed 2017) is the primary consumer protection
 * instrument. It is supplemented by the Cost of Credit Disclosure Act
 * (now consolidated into the CPA) and a series of designated-business
 * regulations (direct sales, retailers selling time-share contracts,
 * collection and debt repayment, etc.).
 *
 * Regulator: Consumer Investigations Unit, Service Alberta and Red Tape
 * Reduction. Designated business licensing is administered through the
 * same ministry.
 *
 * Source: King's Printer Alberta consolidation, section numbering current
 * to 2025.
 */

import type { CognitionItem } from "./types.js";

export const ALBERTA_CPA_AUTHORITIES: CognitionItem[] = [
  {
    id: "auth-ab-cpa-6",
    organizationId: "preview",
    title: "Alberta CPA s. 6 — Unfair practices",
    source: "Consumer Protection Act (Alberta), R.S.A. 2000, c. C-26.3",
    jurisdiction: "alberta",
    registrationCategories: ["consumer-protection", "supplier"],
    content: `Section 6 — Unfair practices

(1) It is an offence for a supplier to engage in an unfair practice.

(2) It is an unfair practice for a supplier, in a consumer transaction or a proposed consumer transaction, to do or say anything, or fail to do or say anything, if, as a result, a consumer might reasonably be deceived or misled.

(3) Without limiting subsection (2), it is an unfair practice for a supplier to:
(a) exert undue pressure or influence on the consumer to enter into the transaction;
(b) take advantage of the consumer as a result of the consumer's inability to understand the character, nature, language or effect of the transaction or any matter related to it;
(c) use exaggeration, innuendo or ambiguity about a material fact or not state a material fact if the effect is misleading;
(d) make a representation that the goods or services have approval, performance characteristics, accessories, ingredients, quantities, components, uses, benefits, sponsorship or affiliation they do not have;
(e) represent that goods are of a particular standard, quality, grade, style or model, if they are not;
(f) represent that goods are new or unused, if they are not, or are of a particular year of model, if they are not;
(g) represent that goods have been used to an extent that is materially different from the fact;
(h) represent that a specific price advantage exists, if it does not;
(i) represent that a part, repair, replacement or service is needed, if it is not;
(j) represent that the supplier or any other person has a particular sponsorship, approval, status, affiliation or connection that the supplier or other person does not have;
(k) represent that the transaction involves or does not involve rights, remedies or obligations if the representation is deceptive or misleading;
(l) use a subterfuge or trick to obtain the consumer's agreement to the transaction.

(4) A consumer transaction entered into after the commission of an unfair practice is voidable at the election of the consumer within 1 year after the transaction.

Section 7 — Unconscionable act. It is an unconscionable act for a supplier to knowingly take advantage of a consumer who is unable to protect their own interest due to disability, ignorance, illiteracy, age or inability to understand, or to enter a transaction where the terms are so harsh or adverse as to be inequitable.`,
  },
  {
    id: "auth-ab-cpa-direct-sales",
    organizationId: "preview",
    title: "Alberta CPA Part 3 + Direct Sales Regulation — Direct sales contracts",
    source: "Consumer Protection Act (Alberta), R.S.A. 2000, c. C-26.3; Designation of Trades and Businesses Regulation, Alta. Reg. 178/1999",
    jurisdiction: "alberta",
    registrationCategories: ["consumer-protection", "supplier", "door-to-door-seller"],
    content: `Alberta direct sales framework

Licensing: Direct selling businesses (door-to-door sales and in-home sales) must hold a direct seller's licence under the Designation of Trades and Businesses Regulation. Sales representatives must be individually licensed and carry their salesperson's licence ID when soliciting consumers.

2017 amendments (in force January 2018): prohibited unsolicited door-to-door sale of specified household goods and services — HVAC systems, water heaters, furnaces, air conditioners, water treatment, energy audits, energy-generation systems. A supplier is prohibited from initiating contact at a consumer's home for any of these listed products; the consumer must initiate the contact. Contracts entered into in contravention of the prohibition are void and any payments must be refunded.

Contract content requirements (s. 30):
(a) written form;
(b) name, address, phone of supplier and salesperson;
(c) itemised description of goods or services;
(d) itemised price and total amount payable;
(e) terms of payment;
(f) date and delivery/performance terms;
(g) statement of cancellation rights in the prescribed form.

Cancellation right: 10 days from the later of (a) date the contract is entered into, or (b) date the consumer receives a copy of the contract. Extended cancellation of 1 year where disclosure requirements are not met (s. 32). Cancellation by notice in any form expressing intent.

Refund: supplier must refund within 15 days and has no claim against the consumer for goods used or damaged during the cancellation period (s. 35).`,
  },
  {
    id: "auth-ab-cpa-internet-sales",
    organizationId: "preview",
    title: "Alberta Internet Sales Contract Regulation — Online consumer contracts",
    source: "Internet Sales Contract Regulation, Alta. Reg. 81/2001 (under the Consumer Protection Act)",
    jurisdiction: "alberta",
    registrationCategories: ["consumer-protection", "supplier", "distance-seller"],
    content: `Internet Sales Contract Regulation (Alta. Reg. 81/2001)

Scope: applies to contracts formed by text-based internet communications where the total consideration is greater than $50, excluding specified categories (e.g. securities, tickets to a specific event, financial services).

Required pre-contract disclosure (s. 2): the supplier must disclose the following and ensure the consumer has an express opportunity to accept, decline, or correct errors:
(a) supplier name and business name;
(b) supplier telephone number and address;
(c) fair description of goods or services;
(d) itemised list of price, related costs (including shipping, handling, insurance), and total price;
(e) currency;
(f) terms of payment;
(g) delivery date and method;
(h) cancellation, return, exchange and refund policies;
(i) any other restrictions material to the consumer's decision.

Section 3 — Express opportunity. Before submitting the offer, the consumer must have an express opportunity to (a) accept or decline, and (b) correct errors. "Click-through" flows that combine acceptance with final-price disclosure on the same screen are deficient.

Section 4 — Post-contract copy. Within 15 days of the contract being entered into, the supplier must provide a copy on any medium the consumer can access (typically email with PDF or a login-accessible account page).

Section 5 — Cancellation. The consumer may cancel the contract within:
(a) 7 days after receiving the copy — if the pre-contract disclosure under s. 2 was not provided, OR the consumer did not have an express opportunity to correct errors under s. 3;
(b) 30 days after entering into the contract — if the supplier fails to deliver the copy required by s. 4;
(c) at any time before the goods/services are delivered/performed — if the supplier fails to deliver within 30 days of the date specified.

Credit card chargeback: the cardholder may demand the issuer reverse the charge where the supplier fails to refund after a valid cancellation.`,
  },
  {
    id: "auth-ab-cpa-future-performance",
    organizationId: "preview",
    title: "Alberta CPA Part 10 — Future performance contracts",
    source: "Consumer Protection Act (Alberta), R.S.A. 2000, c. C-26.3",
    jurisdiction: "alberta",
    registrationCategories: ["consumer-protection", "supplier"],
    content: `Part 10 — Future performance contracts (ss. 30-37)

Scope: a future performance contract is a consumer transaction where (a) the supplier has not provided all of the goods or services at the time the transaction is entered into, or (b) the consumer has not paid in full at the time the transaction is entered into, and (c) the total price exceeds $50.

Section 30 — Required contents:
(a) supplier's name, business name, address, phone;
(b) consumer's name and address;
(c) date the contract is entered into and location;
(d) description of the goods or services sufficient to identify them;
(e) itemised price, total amount, currency;
(f) terms of payment and balance owing;
(g) date of delivery or start of performance;
(h) any restrictions, limitations or conditions that apply;
(i) statement of the consumer's cancellation rights in the prescribed form.

Section 33 — Right to cancel on supplier default. The consumer may cancel a future performance contract at any time before the goods or services are delivered if the supplier has not begun performance within 30 days of the date specified (or a reasonable time, if no date is specified).

Section 34 — Extended cancellation. The consumer may cancel within 1 year if (a) the contract does not comply with the content requirements in s. 30, or (b) the copy of the contract was not provided within 15 days after the consumer signed.

Section 37 — Refund on cancellation. The supplier must refund all consideration received within 15 days of cancellation.`,
  },
  {
    id: "auth-ab-cpa-payday-loans",
    organizationId: "preview",
    title: "Alberta CPA Part 12 — Payday loans",
    source: "Consumer Protection Act (Alberta), R.S.A. 2000, c. C-26.3; Payday Loans Regulation, Alta. Reg. 157/2009",
    jurisdiction: "alberta",
    registrationCategories: ["consumer-protection", "credit-grantor"],
    content: `Part 12 — Payday loans

Section 124 — Licence required. A person must not offer, arrange or provide a payday loan unless they hold a payday loans licence.

Section 131 — Maximum total cost of borrowing. The total cost of borrowing (all fees, interest, and charges combined) may not exceed the maximum prescribed by regulation. As of 2025, the cap is $15 per $100 lent — one of the lowest in Canada after legislative amendments in 2016.

Prohibited practices (s. 134):
(a) rollover loans (extending a payday loan by entering a new payday loan to pay off the first);
(b) concurrent loans (providing a second payday loan while a first is outstanding);
(c) charging fees for early repayment;
(d) using post-dated cheques or pre-authorised debits for amounts greater than the total payable under the loan;
(e) charging default fees in excess of the prescribed limit.

Section 136 — Cancellation right. A borrower may cancel a payday loan without cost or reason within 2 business days after receiving the cash. The lender must fully refund all charges on cancellation.

Section 137 — Cooling-off period for default. A lender may not commence collection or repossession until at least 5 business days have passed after the due date.

Disclosure (s. 129): the lender must display the total cost of borrowing as both a dollar amount and an annual percentage rate (APR), in the contract and in-store signage. The APR calculation must follow the Cost of Credit Disclosure rules in Part 9.`,
  },
  {
    id: "auth-ab-cpa-remedies",
    organizationId: "preview",
    title: "Alberta CPA Part 14 — Enforcement, offences and penalties",
    source: "Consumer Protection Act (Alberta), R.S.A. 2000, c. C-26.3",
    jurisdiction: "alberta",
    registrationCategories: ["consumer-protection", "supplier"],
    content: `Part 14 — Enforcement

Section 162 — Civil action. A person who suffers damages as a result of an unfair practice, an unconscionable act, or a contravention of the Act, may bring an action for damages, including punitive damages, in the Court of Justice or the Court of King's Bench.

Section 163 — Class actions permitted. Alberta's Class Proceedings Act applies; CPA claims may be certified as class proceedings.

Section 164 — Restitution orders. On application by the Director, the court may order the supplier to restore to affected consumers any money, property or other consideration received in connection with a contravention, or pay compensation for loss.

Section 167 — Offences and penalties:
(a) individual — fine up to $100,000 per offence, and/or imprisonment up to 2 years;
(b) corporation — fine up to $300,000 per offence;
(c) for repeat offenders, fines and imprisonment terms are doubled;
(d) every day an offence continues is a separate offence for penalty purposes.

Section 168 — Director's orders. The Director may issue orders to stop an unfair practice, disclose information to consumers, compensate affected consumers, post a bond, or suspend or cancel a licence.

Section 172 — Voluntary compliance undertakings. The Director may accept a written undertaking from a supplier to stop conduct, provide restitution, or comply with the Act. Undertakings are published on the Service Alberta consumer affairs website.

Two-year limitation — civil actions under the Act generally must be commenced within 2 years of discoverability (Alberta Limitations Act), although the 1-year cancellation window is itself a special statutory limit.`,
  },
];
