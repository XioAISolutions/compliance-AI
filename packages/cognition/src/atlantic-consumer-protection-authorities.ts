/**
 * Atlantic provinces consumer protection authorities — Nova Scotia, New
 * Brunswick, Newfoundland and Labrador, and Prince Edward Island.
 *
 * Atlantic consumer protection statutes are smaller than the central/
 * western provincial regimes. They share a common ancestry in the 1970s
 * Canadian consumer-rights push and generally cover the same ground —
 * unfair practices, direct sales, distance sales, implied warranties,
 * cost-of-credit disclosure — with shorter and less-amended statutory
 * texts.
 *
 * Statutes covered:
 *   - Nova Scotia: Consumer Protection Act, R.S.N.S. 1989, c. 92;
 *     Direct Sellers' Regulation Act, R.S.N.S. 1989, c. 129.
 *   - New Brunswick: Consumer Product Warranty and Liability Act, S.N.B.
 *     1978, c. C-18.1 (CPWLA); Direct Sellers Act, R.S.N.B. 2011, c. 156;
 *     Commissioner's Standards Act (misleading practices, 2023
 *     amendments).
 *   - Newfoundland and Labrador: Consumer Protection and Business
 *     Practices Act, S.N.L. 2009, c. C-31.1; Direct Sellers Act, R.S.N.L.
 *     1990, c. D-20.
 *   - Prince Edward Island: Consumer Protection Act, R.S.P.E.I. 1988, c.
 *     C-19; Business Practices Act, R.S.P.E.I. 1988, c. B-7.
 */

import type { CognitionItem } from "./types.js";

export const NOVA_SCOTIA_CPA_AUTHORITIES: CognitionItem[] = [
  {
    id: "auth-ns-cpa-26",
    organizationId: "preview",
    title: "Nova Scotia CPA s. 26 — Unfair practices",
    source: "Consumer Protection Act (Nova Scotia), R.S.N.S. 1989, c. 92",
    jurisdiction: "nova-scotia",
    registrationCategories: ["consumer-protection", "supplier"],
    content: `Section 26 — Unfair practices

(1) In this Section, "unfair practice" means a practice referred to in this Section, whether occurring before, during, or after a consumer transaction.

(2) The following are unfair practices:
(a) a representation that goods or services have sponsorship, approval, performance characteristics, accessories, uses, ingredients, benefits or quantities they do not have;
(b) a representation that a person has a sponsorship, approval, status, affiliation or connection the person does not have;
(c) a representation that goods are new or unused when they are not;
(d) a representation that goods have been used to an extent that is materially different from the fact;
(e) a representation that a price advantage exists if it does not;
(f) a representation that a part, repair, replacement or service is needed if it is not;
(g) exerting undue pressure on the consumer to enter into the transaction;
(h) taking advantage of the consumer by reason of the consumer's inability to reasonably protect their own interest because of disability, ignorance, illiteracy, age, or inability to understand the language or character of the transaction;
(i) entering into a transaction on terms so harsh or adverse as to be inequitable;
(j) using exaggeration, innuendo, or ambiguity about a material fact, or failing to state a material fact.

(3) A consumer has a right to rescind a transaction entered into on the basis of an unfair practice within 1 year after the transaction. The court may grant damages, including exemplary or punitive damages.

Enforcement: Service Nova Scotia and Internal Services (Consumer Affairs Branch) investigates complaints and may issue undertakings, prosecute, or apply for injunctive relief.`,
  },
  {
    id: "auth-ns-direct-sellers-act",
    organizationId: "preview",
    title: "Nova Scotia Direct Sellers' Regulation Act — Licensing and cancellation",
    source: "Direct Sellers' Regulation Act (Nova Scotia), R.S.N.S. 1989, c. 129",
    jurisdiction: "nova-scotia",
    registrationCategories: ["consumer-protection", "supplier", "door-to-door-seller"],
    content: `Direct Sellers' Regulation Act — key provisions

Section 3 — Licence required. No person shall engage in the business of direct selling without a direct seller's licence, and no person shall act as a salesperson for a direct seller unless licensed as a direct salesperson.

Section 21 — Cooling-off period. A consumer may cancel a direct sales contract within 10 days of receiving a copy of the contract by giving notice to the direct seller. Cancellation may be given by any means and takes effect upon the notice being sent.

Section 22 — Required contents. A direct sales contract must be in writing and include:
(a) the names and addresses of the consumer, direct seller and salesperson;
(b) the date of the transaction;
(c) a description of the goods or services;
(d) the itemised total price and terms of payment;
(e) the prescribed statement of the consumer's cancellation rights.

Extended cancellation: where the contract does not include the mandatory content, or the copy is not provided to the consumer at the time of signing, the cancellation right extends to 1 year.

Section 25 — Effect of cancellation. The contract is void, the direct seller must refund all money received within 10 days, and the consumer must make the goods available for pickup.

Prohibited products (amendments, 2022): sale of HVAC equipment, water heaters, and home-energy products through unsolicited door-to-door contact is prohibited in Nova Scotia, mirroring the Ontario and Alberta bans.`,
  },
];

export const NEW_BRUNSWICK_CPA_AUTHORITIES: CognitionItem[] = [
  {
    id: "auth-nb-cpwla-warranties",
    organizationId: "preview",
    title: "New Brunswick CPWLA ss. 10-15 — Statutory warranties",
    source: "Consumer Product Warranty and Liability Act (New Brunswick), S.N.B. 1978, c. C-18.1",
    jurisdiction: "new-brunswick",
    registrationCategories: ["consumer-protection", "supplier", "retailer"],
    content: `Consumer Product Warranty and Liability Act — Part II Statutory warranties

The CPWLA is unique among Canadian consumer statutes in creating a unified statutory-warranty and product-liability regime that applies to every consumer transaction — retail, distance, or direct sales. Contracting out is prohibited (s. 25).

Section 10 — Warranty of title. The seller warrants that the seller has the right to sell the product and that the product is free from encumbrances not disclosed to the buyer.

Section 11 — Warranty of description. Where the buyer relies on a description of the product, the seller warrants that the product conforms to the description.

Section 12 — Warranty of acceptable quality. The seller warrants that the product is of such quality, in such state or condition, and as fit for the purposes for which products of that kind are normally used, as it is reasonable to expect having regard to the nature of the product, the price paid, and all other relevant circumstances.

Section 13 — Warranty of fitness for particular purpose. Where the buyer expressly or by implication makes known to the seller the particular purpose for which the product is required, the seller warrants that the product is reasonably fit for that purpose.

Section 14 — Warranty of conformity to sample. Where a sale is by sample, the seller warrants that the bulk conforms to the sample.

Section 15 — Warranty of durability. The seller warrants that the product will be durable for a reasonable period, having regard to all the relevant circumstances.

Section 23 — Manufacturer liability. The warranties apply as against the manufacturer as well as the seller, where the manufacturer knew or ought to have known that the product would be offered to consumers. Privity of contract is abolished for consumer claims under the Act.

Section 27 — Damages. A buyer is entitled to recover damages for any loss naturally resulting from a breach of warranty, including consequential damages for personal injury or property damage.`,
  },
  {
    id: "auth-nb-direct-sellers-act",
    organizationId: "preview",
    title: "New Brunswick Direct Sellers Act — Licensing, contract requirements, cancellation",
    source: "Direct Sellers Act (New Brunswick), R.S.N.B. 2011, c. 156",
    jurisdiction: "new-brunswick",
    registrationCategories: ["consumer-protection", "supplier", "door-to-door-seller"],
    content: `Direct Sellers Act — New Brunswick

Section 3 — Licence required. A direct seller must be licensed by the Director of Consumer Affairs. Direct salespersons must be licensed individually.

Section 19 — Contract form. A direct sales contract must be in writing, signed by the buyer and seller, dated, and must contain:
(a) the name and address of the direct seller and salesperson;
(b) a description of the goods or services;
(c) the itemised total price and payment terms;
(d) the delivery date;
(e) the buyer's cancellation rights in the prescribed form printed conspicuously.

Section 20 — Cooling-off period. The buyer may cancel a direct sales contract for any reason within 10 days after receiving a copy of the contract, by giving written notice.

Section 21 — Extended cancellation — 1 year — applies where the contract does not comply with s. 19 or the copy is not delivered.

Section 22 — Refund. Upon cancellation, all consideration must be returned within 15 days and the buyer must make the goods available for collection at the direct seller's expense.

NB specific: the 2022 amendments added a prohibition on unsolicited door-to-door sale of furnaces, air conditioners, heat pumps, water heaters, water treatment systems, and air purification products — mirroring Ontario and Alberta.`,
  },
];

export const NEWFOUNDLAND_CPBPA_AUTHORITIES: CognitionItem[] = [
  {
    id: "auth-nl-cpbpa-7",
    organizationId: "preview",
    title: "Newfoundland CPBPA s. 7 — Unfair practices",
    source: "Consumer Protection and Business Practices Act (Newfoundland and Labrador), S.N.L. 2009, c. C-31.1",
    jurisdiction: "newfoundland",
    registrationCategories: ["consumer-protection", "supplier"],
    content: `Section 7 — Unfair practices

(1) A supplier shall not engage in an unfair practice.

(2) "Unfair practice" means, in relation to a consumer transaction or proposed consumer transaction:
(a) representing that goods or services have sponsorship, approval, performance characteristics, accessories, ingredients, components, uses, quantities or benefits that they do not have;
(b) representing that a person has a sponsorship, approval, status, affiliation or connection the person does not have;
(c) representing that goods are new or unused if they are not;
(d) representing that goods have been used to an extent materially different from the fact;
(e) representing that a specific price advantage exists if it does not;
(f) representing that a part, replacement or service is needed if it is not;
(g) using exaggeration, innuendo or ambiguity as to a material fact or failing to state a material fact;
(h) taking advantage of a consumer who, for reasons of physical or mental infirmity, illiteracy, inability to understand, or age, is incapable of appreciating the nature of the transaction;
(i) exerting undue pressure;
(j) entering into a transaction on terms so harsh or adverse to the consumer as to be inequitable;
(k) representing that rights, remedies or obligations exist or do not exist where the representation is false, deceptive or misleading.

Section 8 — Consumer remedy. Where a supplier engages in an unfair practice, the consumer has:
(a) a right to rescind the transaction within 1 year, and
(b) a right to damages, including exemplary or punitive damages.

Part III — Internet Sales Contracts. The Newfoundland and Labrador regime fully adopts the pan-Canadian ISCH template (disclosure, express acceptance, 15-day copy, 7-day/30-day cancellation rights, credit-card chargeback). Administrative enforcement: Consumer Affairs Division, Digital Government and Service NL.`,
  },
  {
    id: "auth-nl-direct-sellers-act",
    organizationId: "preview",
    title: "Newfoundland Direct Sellers Act — Licensing and cooling-off period",
    source: "Direct Sellers Act (Newfoundland and Labrador), R.S.N.L. 1990, c. D-20",
    jurisdiction: "newfoundland",
    registrationCategories: ["consumer-protection", "supplier", "door-to-door-seller"],
    content: `Direct Sellers Act — Newfoundland and Labrador

Section 3 — Licence. No person shall carry on the business of direct selling without a licence issued by the Registrar of Direct Sellers. Every direct sales representative must also be individually licensed.

Section 20 — Cancellation right. A buyer may cancel a direct sales contract by giving written notice to the seller:
(a) within 10 days after a copy of the contract is delivered to the buyer; or
(b) within 1 year after the transaction, where the contract is not in writing, is not signed by both parties, does not contain the mandatory contents, or was not delivered to the buyer.

Section 21 — Required contents. A direct sales contract must contain:
(a) the names and addresses of the direct seller and the buyer;
(b) the date and place of the contract;
(c) a description of the goods or services;
(d) itemised total price, terms of payment, and delivery terms;
(e) the statement of cancellation rights in the prescribed form.

Section 22 — Refund. On cancellation, the direct seller must refund all payments within 15 days; the buyer must make the goods available for pickup at the seller's expense.

Prohibited products: unsolicited door-to-door sales of home energy products (furnaces, water heaters, air conditioners, water treatment devices) are prohibited pursuant to regulations under the Consumer Protection and Business Practices Act (harmonised 2022).`,
  },
];

export const PEI_CPA_AUTHORITIES: CognitionItem[] = [
  {
    id: "auth-pei-bpa-2",
    organizationId: "preview",
    title: "PEI Business Practices Act s. 2 — Unfair practices",
    source: "Business Practices Act (PEI), R.S.P.E.I. 1988, c. B-7",
    jurisdiction: "pei",
    registrationCategories: ["consumer-protection", "supplier"],
    content: `Section 2 — Unfair practices

(1) For the purposes of this Act, the following shall be deemed to be unfair practices:
(a) any false, misleading or deceptive consumer representation, including:
  (i) a representation that goods or services have sponsorship, approval, performance characteristics, accessories, ingredients, uses, quantities or benefits they do not have;
  (ii) a representation that a person has a sponsorship, approval, status, affiliation, or connection that person does not have;
  (iii) a representation that the goods are new or unused if they are not;
  (iv) a representation that the goods have been used to an extent materially different from the fact;
  (v) a representation that a specific price advantage exists if it does not;
  (vi) a representation that a part, replacement or repair is needed if it is not;
  (vii) a representation that goods or services are available for a reason that does not exist;
  (viii) a representation that misrepresents the consumer's obligations, rights, remedies or authority;

(b) any unconscionable consumer representation, including:
  (i) taking advantage of the inability or incapacity of a consumer to reasonably protect their own interest;
  (ii) imposing terms on a consumer that are so adverse as to be inequitable;
  (iii) inducing a consumer to enter a transaction through undue pressure.

Section 4 — Prohibition. No person shall engage in an unfair practice.

Section 4(3) — Rescission. A consumer agreement entered into by a consumer after an unfair practice may be rescinded by the consumer. Written notice of rescission must be given within 1 year.

Section 4(5) — Damages. In addition to rescission, the consumer may recover damages, including exemplary damages. Class proceedings are available under PEI's Class Proceedings Act.`,
  },
  {
    id: "auth-pei-cpa-direct-sales",
    organizationId: "preview",
    title: "PEI Consumer Protection Act Part II — Direct sellers",
    source: "Consumer Protection Act (PEI), R.S.P.E.I. 1988, c. C-19",
    jurisdiction: "pei",
    registrationCategories: ["consumer-protection", "supplier", "door-to-door-seller"],
    content: `Part II — Direct Sellers (ss. 24-32)

Section 25 — Licence. A direct seller must be licensed. A salesperson for a licensed direct seller is also licensed by endorsement.

Section 28 — Contract contents. A direct sales contract must be in writing, signed, and contain:
(a) the names and addresses of the direct seller and the buyer;
(b) date and place of signing;
(c) description of goods or services;
(d) itemised total price;
(e) payment terms;
(f) delivery date;
(g) statement of the buyer's 10-day cancellation rights in the prescribed form.

Section 29 — Cancellation right. A buyer may cancel the contract by written notice within 10 days after receiving a copy of the contract. The supplier must refund all payments within 15 days of cancellation.

Section 30 — Extended cancellation. The buyer may cancel within 1 year if (a) the contract does not meet s. 28 contents requirements, (b) the copy was not delivered, or (c) the direct seller or salesperson was not licensed at the time of the transaction.

Section 32 — Return of goods. On cancellation, the buyer shall make the goods available at their residence; the direct seller must collect at the direct seller's expense within 21 days.

PEI has also adopted the pan-Canadian Internet Sales Contract Harmonization Template via the Consumer Protection Act Regulations (ISCH-equivalent disclosure and cancellation rules).`,
  },
];
