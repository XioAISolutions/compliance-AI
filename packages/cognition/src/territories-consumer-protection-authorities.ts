/**
 * Territorial consumer protection authorities — Yukon, Northwest
 * Territories, and Nunavut.
 *
 * Territorial consumer protection is modest in scope compared to the
 * provinces, reflecting smaller retail markets and the historical use of
 * federal statutes to fill gaps. Each territory has a core Consumer
 * Protection Act and a direct-sales statute; none has comprehensive
 * modern distance-sales or online-contract legislation, so the federal
 * Competition Act, PIPEDA, CASL, and CCPSA do more heavy lifting in the
 * territories than they do in the provinces.
 *
 * Statutes covered:
 *   - Yukon: Consumer Protection Act, R.S.Y. 2002, c. 40.
 *   - Northwest Territories: Consumer Protection Act, R.S.N.W.T. 1988,
 *     c. C-17.
 *   - Nunavut: Consumer Protection Act (Nunavut), as the duplicated NWT
 *     Act — Nunavut adopted NWT legislation on 1 April 1999 under the
 *     Nunavut Act (Canada) s. 29. Subsequent Nunavut-specific amendments
 *     are tracked in the consolidations of Nunavut law (Department of
 *     Justice, Government of Nunavut).
 *
 * Regulators:
 *   - Yukon: Consumer Services, Department of Community Services.
 *   - NWT: Consumer Affairs, Department of Municipal and Community
 *     Affairs.
 *   - Nunavut: Consumer Affairs Division, Department of Community and
 *     Government Services.
 */

import type { CognitionItem } from "./types.js";

export const YUKON_CPA_AUTHORITIES: CognitionItem[] = [
  {
    id: "auth-yt-cpa-58",
    organizationId: "preview",
    title: "Yukon CPA Part VI — Direct sales cancellation",
    source: "Consumer Protection Act (Yukon), R.S.Y. 2002, c. 40",
    jurisdiction: "yukon",
    registrationCategories: ["consumer-protection", "supplier", "door-to-door-seller"],
    content: `Yukon Consumer Protection Act — Direct sales

Section 58 — Licensing. A person carrying on the business of direct selling must be licensed under the Act.

Section 60 — Contract requirements. A direct sales contract must be in writing, signed by both parties, and must include:
(a) the names and addresses of the buyer, the direct seller, and the salesperson;
(b) date of the contract;
(c) a reasonable description of the goods or services;
(d) itemised total price and terms of payment;
(e) delivery date and place;
(f) a notice of cancellation rights in the prescribed form.

Section 62 — Cooling-off period. A buyer may cancel a direct sales contract without cost, penalty, or reason within 10 days after receiving a copy of the contract by giving notice to the direct seller.

Section 64 — Extended cancellation. The buyer may cancel within 1 year if:
(a) the contract does not comply with s. 60;
(b) the buyer did not receive a copy of the contract; or
(c) the direct seller or salesperson was not licensed at the time of the transaction.

Section 65 — Refund. On cancellation, the direct seller must refund all payments within 15 days. The buyer must make the goods available for collection at the seller's expense; the buyer is not liable for ordinary wear during the cooling-off period.`,
  },
  {
    id: "auth-yt-cpa-warranties",
    organizationId: "preview",
    title: "Yukon CPA Part I — Implied warranties in consumer sales",
    source: "Consumer Protection Act (Yukon), R.S.Y. 2002, c. 40",
    jurisdiction: "yukon",
    registrationCategories: ["consumer-protection", "supplier", "retailer"],
    content: `Yukon CPA Part I — Consumer sales and warranties

Section 4 — Implied conditions and warranties. In every consumer sale of goods, there are implied warranties of:
(a) title — the seller has the right to sell;
(b) conformity to description — the goods match any description applied;
(c) merchantable quality — the goods are of quality reasonable having regard to the price and description, and free from defects except those specifically drawn to the buyer's attention;
(d) fitness for particular purpose — where the buyer makes known the purpose, the goods will be reasonably fit for that purpose;
(e) conformity to sample — the bulk conforms to any sample;
(f) durability — the goods will be durable for a reasonable period.

Section 6 — Contracting out prohibited. Any term in a consumer sale that purports to negate or reduce the implied warranties is void.

Section 8 — Breach of warranty. The buyer is entitled to rescind the contract, obtain replacement, or claim damages, as appropriate.

Section 10 — Price misrepresentation. A seller may not charge a price higher than the price advertised or displayed; scanner-error policy requires correction and, in the Yukon, a discount of the lower of 10% or $10 as prescribed practice.`,
  },
];

export const NWT_CPA_AUTHORITIES: CognitionItem[] = [
  {
    id: "auth-nt-cpa-direct-sales",
    organizationId: "preview",
    title: "NWT CPA Part IV — Direct sellers",
    source: "Consumer Protection Act (Northwest Territories), R.S.N.W.T. 1988, c. C-17",
    jurisdiction: "northwest-territories",
    registrationCategories: ["consumer-protection", "supplier", "door-to-door-seller"],
    content: `Northwest Territories CPA — Direct sales

Section 29 — Licensing. No person shall engage in the business of direct selling, and no person shall act as a salesperson for a direct seller, unless the person is licensed.

Section 33 — Contract requirements. A direct sales contract must be in writing, signed by the buyer and a representative of the direct seller, and must contain:
(a) names, addresses and phone numbers of buyer and direct seller;
(b) date and place of signing;
(c) description of the goods or services;
(d) itemised total price, taxes, shipping, and any other charges;
(e) terms of payment;
(f) delivery terms;
(g) a conspicuous notice of the consumer's cancellation rights in the prescribed form.

Section 34 — Cooling-off period. The buyer may cancel a direct sales contract for any reason within 10 days after the buyer receives a copy.

Section 35 — Extended cancellation. The buyer may cancel within 1 year after the date of the contract if:
(a) the contract does not comply with s. 33;
(b) the buyer was not given a copy of the contract;
(c) the direct seller or salesperson was not licensed; or
(d) delivery is not made within 30 days of the specified date.

Section 36 — Refund. Upon cancellation, the direct seller shall refund to the buyer within 15 days all money paid and take back the goods at the direct seller's expense.`,
  },
  {
    id: "auth-nt-cpa-warranties",
    organizationId: "preview",
    title: "NWT CPA Part I-II — Consumer sales and misrepresentation",
    source: "Consumer Protection Act (Northwest Territories), R.S.N.W.T. 1988, c. C-17",
    jurisdiction: "northwest-territories",
    registrationCategories: ["consumer-protection", "supplier", "retailer"],
    content: `NWT CPA Parts I and II — Consumer sales

Section 3 — Implied conditions and warranties. In a consumer sale, the following are implied:
(a) warranty of title and quiet possession;
(b) where goods are sold by description, the goods shall correspond with the description;
(c) warranty of merchantable quality;
(d) warranty of fitness for any particular purpose made known to the seller;
(e) where goods are sold by sample, warranty that the bulk will correspond with the sample.

Section 4 — No waiver. Any agreement, term or condition that is inconsistent with the implied warranties in s. 3, or that purports to bar or limit a consumer's remedies, is void.

Section 13 — Unfair practices. It is an unfair practice for a supplier to:
(a) represent that goods or services have sponsorship, approval, performance characteristics, accessories, uses, quantities, or benefits they do not have;
(b) represent that goods are new or unused when they are not;
(c) represent a price advantage that does not exist;
(d) represent that a part, replacement or service is needed when it is not;
(e) exert undue pressure on a consumer;
(f) take advantage of a consumer unable to understand the nature of the transaction;
(g) use exaggeration, innuendo or ambiguity about a material fact.

Section 17 — Consumer remedies. A consumer transaction entered into following an unfair practice may be rescinded within 1 year; the consumer is also entitled to damages, including exemplary damages.`,
  },
];

export const NUNAVUT_CPA_AUTHORITIES: CognitionItem[] = [
  {
    id: "auth-nu-cpa-adopted-from-nwt",
    organizationId: "preview",
    title: "Nunavut CPA — Duplicated NWT Consumer Protection Act",
    source: "Consumer Protection Act (Nunavut), R.S.N.W.T. (Nu.) 1988, c. C-17",
    jurisdiction: "nunavut",
    registrationCategories: ["consumer-protection", "supplier"],
    content: `Nunavut Consumer Protection Act

On 1 April 1999, when Nunavut was established under the Nunavut Act (Canada), the laws of the Northwest Territories were duplicated into Nunavut law and continue in force as laws of Nunavut, subject to amendment by the Nunavut Legislative Assembly. The Consumer Protection Act of the Northwest Territories (R.S.N.W.T. 1988, c. C-17) remains in force in Nunavut as "Consumer Protection Act — Nunavut version."

Key provisions (identical to the NWT Act as it stood on 1 April 1999 plus Nunavut-specific amendments):

Section 3 — Implied warranties in consumer sales (title, description, merchantable quality, fitness for purpose, sample, durability).

Section 13 — Unfair practices prohibition, mirroring the NWT Act's list of deceptive and unconscionable practices.

Section 29-36 — Direct sellers: licensing, written contract requirements, 10-day cooling-off period, 1-year extended cancellation where the contract is deficient or the seller was unlicensed, 15-day refund obligation.

Section 17 — Consumer remedies: rescission within 1 year of the transaction, plus damages (including exemplary damages).

Practical points:
- Nunavut's small market means many disputes under the Act are resolved through the Consumer Affairs Division's mediation rather than litigation.
- Nunavut-resident claimants retain access to federal statutes: Competition Act (s. 52 and s. 74.01), CCPSA, CASL, PIPEDA — these operate independently of territorial consumer law.
- When a consumer transaction crosses provincial/territorial lines (common in Nunavut given the reliance on southern suppliers), choice-of-law clauses purporting to deprive the Nunavut consumer of their statutory cancellation rights are generally unenforceable under principles of public order; a Nunavut consumer cannot waive statutory rights by contract.`,
  },
  {
    id: "auth-nu-direct-sales",
    organizationId: "preview",
    title: "Nunavut — Direct sales contract rules",
    source: "Consumer Protection Act (Nunavut), R.S.N.W.T. (Nu.) 1988, c. C-17",
    jurisdiction: "nunavut",
    registrationCategories: ["consumer-protection", "supplier", "door-to-door-seller"],
    content: `Nunavut direct sales framework

As Nunavut's Consumer Protection Act is the continued-in-force version of the NWT's, the direct sales regime is identical:

Licensing — direct sellers and their salespeople must be licensed. The regulator for Nunavut is the Consumer Affairs Division, Department of Community and Government Services.

Written contract requirements (parallel to NWT s. 33) — identification of the parties, date and place, description of goods/services, itemised total price, payment terms, delivery terms, and the conspicuous cancellation-rights notice.

Cooling-off period — 10 days from the date the consumer receives the contract copy (parallel to NWT s. 34).

Extended 1-year cancellation — applies where the contract does not meet the content requirements, the consumer did not receive a copy, the direct seller was unlicensed, or delivery is more than 30 days late (parallel to NWT s. 35).

Refund on cancellation — 15 days; goods collected at the direct seller's expense (parallel to NWT s. 36).

Nunavut-specific enforcement consideration: shipping costs for refund or return on cancellation can be significant given the remoteness of many communities. The Consumer Affairs Division's guidance indicates that "at the direct seller's expense" includes reasonable freight costs to southern return-processing centres, not just local pickup.`,
  },
];
