/**
 * Quebec consumer protection authorities.
 *
 * The centrepiece is the Consumer Protection Act (Loi sur la protection du
 * consommateur, CQLR c. P-40.1), the strongest consumer statute in Canada.
 * Quebec's Civil Code also carries consumer-contract provisions that cross-
 * reference the CPA, notably arts. 1435-1437 on external and abusive
 * clauses. We include the CPA sections most frequently invoked in
 * consumer-complaint and advertising files, plus the Civil Code backstop.
 *
 * Source: publicly available Quebec consolidation (LegisQuebec). Section
 * numbering follows the CQLR consolidation current to 2025-12.
 *
 * Regulator: Office de la protection du consommateur (OPC) — enforces the
 * CPA and publishes guidance. Penalties under s. 277-278 CPA can be up to
 * $100,000 per offence for corporations and are doubled on repeat
 * conviction.
 */

import type { CognitionItem } from "./types.js";

export const QUEBEC_CONSUMER_PROTECTION_AUTHORITIES: CognitionItem[] = [
  {
    id: "auth-qc-cpa-8",
    organizationId: "preview",
    title: "Quebec CPA art. 8-9 — Lésion and disproportionate obligations",
    source: "Consumer Protection Act (Quebec), CQLR c. P-40.1",
    jurisdiction: "quebec",
    registrationCategories: ["consumer-protection", "supplier"],
    content: `Articles 8-9 — Lesion

Article 8. A consumer may demand the nullity of a contract or a reduction of his obligations thereunder where the disproportion between the respective obligations of the parties is so great as to amount to exploitation of the consumer, or where the obligation of the consumer is excessive, harsh or unconscionable.

Article 9. Where the court is to determine whether a consumer consented to a contract, it shall consider the condition of the parties, the circumstances in which the contract was entered into and the benefits arising from the contract for the consumer.

Unique to Quebec: unlike common-law unconscionability (which typically requires inequality of bargaining power AND an improvident bargain), art. 8 permits relief on either branch independently — gross disproportion alone is enough, regardless of bargaining power. Quebec courts have used art. 8 to rewrite high-interest lending contracts, excessive termination fees, and rental-car damage clauses.

Practical drafting implication: any contract term that a reasonable observer would describe as "harsh," "excessive," or "unconscionable" is at risk in Quebec even if it would survive in an Ontario or BC court.`,
  },
  {
    id: "auth-qc-cpa-11",
    organizationId: "preview",
    title: "Quebec CPA art. 10-13 — Prohibition on contracting out",
    source: "Consumer Protection Act (Quebec), CQLR c. P-40.1",
    jurisdiction: "quebec",
    registrationCategories: ["consumer-protection", "supplier"],
    content: `Articles 10-13 — Public order and contract interpretation

Article 10. Any stipulation whereby a merchant is liberated from the consequences of his own act or the act of his representative is prohibited.

Article 11. Any stipulation whereby a merchant reserves the right to decide unilaterally (a) that the consumer has failed to perform one or more of his obligations, or (b) that a fact or circumstance has occurred, is prohibited.

Article 11.1. Any stipulation requiring the consumer to refer a dispute to arbitration, restricting the consumer's right to go before a court (in particular by prohibiting the consumer from joining a class action), or depriving him of the right to be a member of a group of persons, is prohibited.

Article 12. No costs may be claimed from a consumer unless the amount is precisely indicated in the contract.

Article 13. The provisions of this Act are of public order (ordre public). Any waiver of a consumer's rights that is not expressly permitted by the Act is prohibited.

Effect of art. 11.1 (since 2006): mandatory consumer arbitration clauses and class-action waivers are void in Quebec. This was upheld in Dell Computer Corp. v. Union des consommateurs, 2007 SCC 34, and codified in 2006 amendments. Businesses operating nationally often need a Quebec-specific contract variant (or a severability clause that explicitly preserves consumer rights in Quebec) to avoid rendering the entire arbitration clause unenforceable across all jurisdictions.`,
  },
  {
    id: "auth-qc-cpa-25",
    organizationId: "preview",
    title: "Quebec CPA art. 25-28 — Contract form and consumer consent",
    source: "Consumer Protection Act (Quebec), CQLR c. P-40.1",
    jurisdiction: "quebec",
    registrationCategories: ["consumer-protection", "supplier"],
    content: `Articles 25-28 — Form of contract

Article 25. A contract evidenced in writing must be clearly and legibly drawn up before the consumer signs it and its stipulations must be explained to the consumer.

Article 26. A contract evidenced in writing must be drawn up in duplicate. The merchant must give a copy of the contract to the consumer when both parties sign it.

Article 27. The obligation of a consumer becomes exigible only upon delivery of a copy of the contract to the consumer.

Article 28. A contract evidenced in writing must be in French. It may, however, be drawn up in another language at the express wish of the parties.

Practical effect: Quebec consumer contracts require (a) a written French-language version delivered at the time of signing, (b) legible type and clear stipulations, and (c) active explanation of the terms to the consumer. Pre-signing verbal explanation is essential evidence — Quebec courts routinely void clauses the consumer cannot show they understood.

Note: The Charter of the French Language (Bill 96, in force 2022-2024) reinforces the French-language requirement for consumer contracts of adhesion: the French version must be provided first, and the consumer may consent to a non-French version only after having been given the opportunity to examine the French version.`,
  },
  {
    id: "auth-qc-cpa-40",
    organizationId: "preview",
    title: "Quebec CPA art. 40-43 — Obligation to correctly describe a good or service",
    source: "Consumer Protection Act (Quebec), CQLR c. P-40.1",
    jurisdiction: "quebec",
    registrationCategories: ["consumer-protection", "supplier"],
    content: `Articles 40-43 — Conformity obligations

Article 40. A good or service supplied must conform to the description made of it in the contract.

Article 41. A good or service supplied must conform to any statement or advertisement respecting it made by the merchant or the manufacturer. Any statement or advertisement forms part of the contract.

Article 42. An affirmation made by a merchant's representative in respect of a good or service is presumed to be part of the contract.

Article 43. A merchant or manufacturer may not avoid the application of article 41 by alleging that he did not know, could not have known or ought not to have known of the statement or advertisement.

Effect: advertising in Quebec is legally incorporated into every consumer contract. If a retailer's flyer claims a laptop comes with a 3-year warranty, a Quebec consumer can enforce the 3-year warranty even if the contract of sale is silent. Distributors, importers, and manufacturers are jointly liable with the retail merchant (art. 53).`,
  },
  {
    id: "auth-qc-cpa-54.4",
    organizationId: "preview",
    title: "Quebec CPA arts. 54.1-54.16 — Distance contracts (including online)",
    source: "Consumer Protection Act (Quebec), CQLR c. P-40.1",
    jurisdiction: "quebec",
    registrationCategories: ["consumer-protection", "supplier", "distance-seller"],
    content: `Articles 54.1-54.16 — Distance contracts (added 2006, amended 2018)

Scope: any contract entered into between a merchant and a consumer where the parties are not in each other's presence when the offer is accepted. Captures online sales, telephone sales, mail-order, and app-based purchases.

Article 54.4 — Mandatory pre-contract disclosure. Before a distance contract is entered into, the merchant must disclose in a prominent manner and in a comprehensible way:
(a) merchant's name and contact information;
(b) detailed description of each good or service;
(c) itemised price and total amount including shipping, installation and other charges;
(d) currency;
(e) terms of payment;
(f) date or delivery period and place of delivery;
(g) applicable cancellation, return, exchange or refund policies;
(h) any other conditions to the contract.

Article 54.6 — Express consent. The consumer must expressly accept the offer. The merchant must give the consumer the express opportunity to accept or decline the offer and to correct any errors.

Article 54.8 — Copy of the contract. The merchant must, within 15 days of entering into the contract, send the consumer a copy on paper or any other medium the consumer has access to.

Article 54.9 — Right to cancel. A consumer may cancel a distance contract within 7 days after receiving the copy of the contract if the merchant has not complied with arts. 54.4 or 54.8. If the merchant has not complied AND has not delivered the goods within 30 days, cancellation may be demanded until delivery.

Article 54.14 — Chargebacks. Where the merchant does not reimburse after cancellation, the consumer may demand a chargeback from the credit card issuer. The credit card issuer must cancel the charge within 90 days.`,
  },
  {
    id: "auth-qc-cpa-219",
    organizationId: "preview",
    title: "Quebec CPA arts. 219-221 — False or misleading representations",
    source: "Consumer Protection Act (Quebec), CQLR c. P-40.1",
    jurisdiction: "quebec",
    registrationCategories: ["consumer-protection", "supplier"],
    content: `Articles 219-221 — Prohibited business practices

Article 219. No merchant, manufacturer or advertiser may make false or misleading representations to a consumer by any means whatever.

Article 220. No merchant, manufacturer or advertiser may, by any means whatever: (a) ascribe to a good or service a performance characteristic that it does not have; (b) falsely represent that a good or service has been tested.

Article 221. No merchant, manufacturer or advertiser may, by any means whatever: (a) falsely ascribe certain special advantages to a good or service; (b) hold out that the acquisition or use of a good or service gives or confers a right, recourse or obligation; (c) falsely ascribe a particular merit to a good or service; (d) falsely ascribe a particular origin, history, component, use, purpose, quality, standard or specification; (e) falsely represent that a good is new, reconditioned or used; (f) represent that a good or service is available where it is not; (g) hold out that the performance or duration of a good or service will be greater than it actually is.

General impression test — Richard v. Time Inc., 2012 SCC 8: representations are assessed from the perspective of a "credulous and inexperienced consumer" who takes no more than ordinary care. This is a materially lower threshold than the "reasonable consumer" test applied under the Competition Act. Disclaimers and fine print cannot cure a misleading general impression.

Private remedy (art. 272): the consumer may seek specific performance, resolution of the contract, a reduction in price, or damages (including punitive damages). Richard v. Time confirmed punitive damages may be awarded without proof that the consumer suffered compensatory damages, because the CPA is a statute of public order.`,
  },
  {
    id: "auth-qc-cpa-228",
    organizationId: "preview",
    title: "Quebec CPA art. 228 — Failing to mention an important fact",
    source: "Consumer Protection Act (Quebec), CQLR c. P-40.1",
    jurisdiction: "quebec",
    registrationCategories: ["consumer-protection", "supplier"],
    content: `Article 228. No merchant, manufacturer or advertiser may fail to mention an important fact in any representation made to a consumer.

"Important fact" is any fact that, had it been known to the consumer, would have led the consumer not to enter into the contract or to enter into it on different terms. The standard is whether the fact is objectively important to the consumer's decision.

Examples of omissions that have been held to violate art. 228:
- Failure to disclose automatic renewal of a fixed-term service contract
- Concealed mandatory fees added at checkout (drip pricing — overlaps with s. 74.011 of the Competition Act)
- Failure to disclose a material defect known to the merchant
- Failure to disclose the total cost of a financed purchase (also covered by art. 72 consumer credit disclosure rules)
- Failure to disclose that a "free trial" converts to a paid subscription

Remedy: arts. 253 (presumption of prejudice where a prohibited practice would have been determinative) and 272 (full menu of consumer remedies including punitive damages).`,
  },
  {
    id: "auth-qc-cpa-230",
    organizationId: "preview",
    title: "Quebec CPA arts. 230-231, 244, 247 — Pricing and price-accuracy policy",
    source: "Consumer Protection Act (Quebec), CQLR c. P-40.1",
    jurisdiction: "quebec",
    registrationCategories: ["consumer-protection", "supplier", "retailer"],
    content: `Articles 230-231, 244, 247 — Price representations and scanner policy

Article 230. No merchant may (a) fail to display the price of a good in a prominent and legible manner; (b) demand a higher price than that advertised.

Article 244. Any representation of a price that is not all-inclusive (not showing the final price the consumer must pay) is prohibited. Exceptions are limited to GST, QST, and a very narrow category of taxes.

Effect: Quebec has had an "all-in" pricing rule since 2010, pre-dating the federal drip-pricing amendments by more than a decade. A restaurant advertising "$10 meal deal" may not add a separately itemised "service charge" at the end.

Article 247 — Scanner Price Accuracy Policy (Politique d'exactitude des prix affichés): where an item scans at a price higher than the shelf price, the merchant must:
(a) for items priced $10 or less — give the item free;
(b) for items priced more than $10 — give a $10 discount off the correct shelf price.

This policy is mandatory in Quebec and must be displayed at every cash register. It applies to all retail merchants using electronic price-scanning technology.`,
  },
  {
    id: "auth-qc-cpa-272",
    organizationId: "preview",
    title: "Quebec CPA art. 272 — Consumer remedies including punitive damages",
    source: "Consumer Protection Act (Quebec), CQLR c. P-40.1",
    jurisdiction: "quebec",
    registrationCategories: ["consumer-protection", "supplier"],
    content: `Article 272. Where a merchant or manufacturer fails to fulfil an obligation imposed by this Act, the regulations or a voluntary undertaking, the consumer may demand, as the case may be, subject to the other recourses provided by this Act:

(a) the specific performance of the obligation;
(b) the authorisation to execute it at the expense of the merchant or manufacturer;
(c) that his obligations be reduced;
(d) that the contract be rescinded;
(e) that the contract be set aside; or
(f) that the contract be annulled,

without prejudice to his claim in damages, in all cases. He may also claim punitive damages.

Richard v. Time Inc., 2012 SCC 8 — governing Supreme Court authority on art. 272:

1. The consumer need not prove actual reliance on the prohibited practice. Where the misleading representation would reasonably have influenced the decision, prejudice is presumed.

2. Punitive damages may be awarded under art. 272 even without compensatory damages being payable. The CPA is a statute of public order; punitive damages serve prevention, deterrence, and denunciation of merchant conduct.

3. Quantum for punitive damages looks to: the gravity of the wrongful act, the merchant's conduct before and during the proceedings, and the merchant's patrimonial situation.

Operative takeaway: Quebec class actions under art. 272 are a major enforcement mechanism; the "credulous and inexperienced consumer" standard (Richard v. Time) combined with presumption of prejudice (art. 253) creates one of the most plaintiff-friendly consumer-protection regimes in North America.`,
  },
  {
    id: "auth-qc-ccq-1435",
    organizationId: "preview",
    title: "Civil Code of Quebec arts. 1435-1437 — External, illegible and abusive clauses",
    source: "Civil Code of Quebec, CQLR c. CCQ-1991",
    jurisdiction: "quebec",
    registrationCategories: ["consumer-protection", "supplier"],
    content: `Articles 1435-1437 — Control of standard-form consumer contracts

Article 1435 — External clause. An external clause referred to in a contract (a clause in a separate document incorporated by reference) is binding on the parties. In a consumer contract or a contract of adhesion, however, an external clause is null if the consumer or adhering party did not know of it at the time of formation of the contract, unless the other party proves the consumer or adhering party knew of it.

Article 1436 — Illegible or incomprehensible clause. In a consumer contract or a contract of adhesion, a clause that is illegible or incomprehensible to a reasonable person is null if the consumer or adhering party suffers injury therefrom, unless the other party proves that an adequate explanation of the nature and scope of the clause was given to the consumer or adhering party.

Article 1437 — Abusive clause. An abusive clause in a consumer contract or contract of adhesion is null, or the obligation arising from it may be reduced.

An abusive clause is a clause that is excessively and unreasonably detrimental to the consumer or adhering party and is contrary to the requirements of good faith; in particular, a clause that so departs from the fundamental obligations arising from the rules normally governing the contract that it changes the nature of the contract is an abusive clause.

Interaction with CPA: arts. 1435-1437 apply to all consumer contracts (whether or not the CPA applies) and to contracts of adhesion more generally. They sit alongside arts. 8, 10-11, and 11.1 of the CPA as independent grounds for invalidating one-sided contractual terms.`,
  },
];
