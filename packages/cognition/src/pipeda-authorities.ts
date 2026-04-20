/**
 * Canadian privacy-law authorities — PIPEDA, OPC guidance, and
 * substantially-similar provincial regimes (Quebec Law 25, Alberta PIPA,
 * BC PIPA).
 *
 * Content is paraphrased from publicly-available authoritative sources
 * (laws-lois.justice.gc.ca, priv.gc.ca, LégisQuébec, Alberta King's Printer,
 * BC Laws). Counsel must verify against the authoritative source before
 * relying on any item in filed material — the source-locker and
 * missing-authority scanner exist precisely to enforce that check.
 */

import type { CognitionItem } from "./types.js";

export const PIPEDA_AUTHORITIES: CognitionItem[] = [
  {
    id: "auth-pipeda-schedule-1-principles",
    organizationId: "preview",
    title: "PIPEDA Schedule 1 — Ten Fair Information Principles",
    source: "Personal Information Protection and Electronic Documents Act, S.C. 2000, c. 5, Schedule 1",
    jurisdiction: "federal",
    registrationCategories: ["privacy", "counsel", "none"],
    sourceType: "statute",
    authorityDate: "2024-06-20",
    content: `PIPEDA Schedule 1 — Principles Set Out in the National Standard of Canada Entitled Model Code for the Protection of Personal Information, CAN/CSA-Q830-96

4.1 Accountability — an organization is responsible for personal information under its control and shall designate an individual or individuals who are accountable for the organization's compliance.

4.2 Identifying Purposes — the purposes for which personal information is collected shall be identified by the organization at or before the time the information is collected.

4.3 Consent — the knowledge and consent of the individual are required for the collection, use, or disclosure of personal information, except where inappropriate.

4.4 Limiting Collection — the collection of personal information shall be limited to that which is necessary for the purposes identified by the organization. Information shall be collected by fair and lawful means.

4.5 Limiting Use, Disclosure, and Retention — personal information shall not be used or disclosed for purposes other than those for which it was collected, except with the consent of the individual or as required by law. Personal information shall be retained only as long as necessary for the fulfilment of those purposes.

4.6 Accuracy — personal information shall be as accurate, complete, and up to date as is necessary for the purposes for which it is to be used.

4.7 Safeguards — personal information shall be protected by security safeguards appropriate to the sensitivity of the information.

4.8 Openness — an organization shall make readily available to individuals specific information about its policies and practices relating to the management of personal information.

4.9 Individual Access — upon request, an individual shall be informed of the existence, use, and disclosure of his or her personal information and shall be given access to that information. An individual shall be able to challenge the accuracy and completeness of the information and have it amended as appropriate.

4.10 Challenging Compliance — an individual shall be able to address a challenge concerning compliance with the above principles to the designated individual or individuals accountable for the organization's compliance.`,
  },
  {
    id: "auth-pipeda-10.1-breach-notification",
    organizationId: "preview",
    title: "PIPEDA s. 10.1 — Breach of Security Safeguards",
    source: "Personal Information Protection and Electronic Documents Act, S.C. 2000, c. 5",
    jurisdiction: "federal",
    registrationCategories: ["privacy", "counsel", "none"],
    sourceType: "statute",
    authorityDate: "2024-06-20",
    content: `Section 10.1 — Report to Commissioner and notification to individuals

(1) An organization shall report to the Commissioner any breach of security safeguards involving personal information under its control if it is reasonable in the circumstances to believe that the breach creates a real risk of significant harm to an individual.

(2) The report must be in the form and manner the Regulations prescribe, and must be made as soon as feasible after the organization determines that the breach has occurred.

(3) Unless otherwise prohibited by law, an organization shall notify an individual of any breach of security safeguards involving the individual's personal information under the organization's control if it is reasonable in the circumstances to believe that the breach creates a real risk of significant harm to the individual.

(4) The notification shall contain sufficient information to allow the individual to understand the significance to them of the breach and to take steps, if any are possible, to reduce the risk of harm that could result from it or to mitigate that harm.

(5) The notification shall be conspicuous and shall be given directly to the individual, except in the prescribed circumstances, in which case it shall be given indirectly.

(6) An organization that notifies an individual under subsection (3) shall also notify another organization, a government institution, or a part of a government institution of the breach if the notifying organization believes that the other organization or the institution or part concerned may be able to reduce the risk of harm that could result from it or mitigate that harm, or if any of the prescribed conditions are satisfied.

(7) An organization shall keep and maintain a record of every breach of security safeguards involving personal information under its control. On request, the organization shall provide the Commissioner with access to, or a copy of, the record.

"Real risk of significant harm" factors (s. 10.1(8)):
(a) the sensitivity of the personal information involved in the breach;
(b) the probability that the personal information has been, is being, or will be misused; and
(c) any other prescribed factor.

"Significant harm" includes bodily harm, humiliation, damage to reputation or relationships, loss of employment, business or professional opportunities, financial loss, identity theft, negative effects on the credit record, and damage to or loss of property.`,
  },
  {
    id: "auth-pipeda-breach-regulations",
    organizationId: "preview",
    title: "Breach of Security Safeguards Regulations (PIPEDA)",
    source: "Breach of Security Safeguards Regulations, SOR/2018-64",
    jurisdiction: "federal",
    registrationCategories: ["privacy", "counsel", "none"],
    sourceType: "regulation",
    authorityDate: "2018-11-01",
    content: `Breach of Security Safeguards Regulations — key requirements

Content of the report to the Commissioner (s. 2):
(a) a description of the circumstances of the breach;
(b) the day on which, or the period during which, the breach occurred;
(c) a description of the personal information that is the subject of the breach to the extent that it is known;
(d) the number of individuals affected or estimated to be affected;
(e) a description of the steps the organization has taken to reduce the risk of harm;
(f) a description of the steps the organization has taken or intends to take to notify affected individuals;
(g) the name and contact information of a person at the organization who can answer, on behalf of the organization, the Commissioner's questions about the breach.

Content of notification to individuals (s. 3):
(a) a description of the circumstances of the breach;
(b) the day on which, or the period during which, the breach occurred;
(c) a description of the personal information that is the subject of the breach to the extent that it is known;
(d) a description of the steps the organization has taken to reduce the risk of harm;
(e) a description of the steps the individual could take to reduce the risk of harm;
(f) a toll-free number or email address the individual can use to obtain further information; and
(g) information about the organization's internal complaint process and the individual's right to file a complaint with the Commissioner.

Record-keeping (s. 6): an organization must maintain a record of every breach of security safeguards for a minimum of 24 months after the day on which the organization determines that the breach has occurred.`,
  },
  {
    id: "auth-opc-guidelines-consent",
    organizationId: "preview",
    title: "OPC Guidelines for Obtaining Meaningful Consent",
    source: "Office of the Privacy Commissioner of Canada — Guidelines for obtaining meaningful consent",
    jurisdiction: "federal",
    registrationCategories: ["privacy", "counsel", "none"],
    sourceType: "regulator-notice",
    authorityDate: "2018-05-24",
    content: `OPC Guidelines for obtaining meaningful consent — key elements

For consent to be valid under PIPEDA, individuals must be able to understand what they are consenting to. The Guidelines identify seven principles:

1. Emphasize key elements — emphasize what personal information is being collected, with whom it is being shared, for what purposes, and the risks of harm.

2. Allow individuals to control the level of detail and format — layered notices; plain-language summaries backed by more detailed information.

3. Provide individuals with clear options to say yes or no — consent should be opt-in for sensitive information; implied consent may be acceptable only for less sensitive information where context makes consent reasonable.

4. Be innovative and creative — consent mechanisms should be adapted to the medium (mobile UI, IoT, biometric context).

5. Consider the consumer's perspective — information must be understandable to the target audience, not just legally-accurate.

6. Make consent a dynamic and ongoing process — refresh consent at appropriate intervals and when purposes change.

7. Be accountable — maintain demonstrable records of consent; designate accountability; train employees.

Meaningful consent is not valid if:
- It is buried in terms of service.
- The notice is not in a language the individual understands.
- Consent to secondary uses is bundled with consent to primary uses.
- The individual cannot withdraw consent without unreasonable friction.`,
  },
  {
    id: "auth-opc-cross-border-transfers",
    organizationId: "preview",
    title: "OPC Guidelines on Transferring Personal Information Across Borders",
    source: "Office of the Privacy Commissioner of Canada — Transborder Data Flows",
    jurisdiction: "federal",
    registrationCategories: ["privacy", "counsel", "none"],
    sourceType: "regulator-notice",
    authorityDate: "2019-04-09",
    content: `OPC Guidelines — Transborder Data Flows and Accountability

An organization that transfers personal information to a third party for processing — whether across a border or not — remains responsible under PIPEDA for the protection of that information. Transfer is not a "disclosure" requiring separate consent; it is a use. Accountability does not transfer with the data.

Key requirements:

1. Transparency. An organization must be open about its handling of personal information, including cross-border transfers. Where personal information is or may be transferred outside Canada, individuals should be informed before the transfer, including the countries involved and the potential for law-enforcement access under foreign law.

2. Contractual protection. The transferring organization must ensure, through a written contract or other means, that the transferee applies a comparable level of protection to the personal information. Recommended elements: purpose limitation, security safeguards proportionate to sensitivity, breach-notification obligations flowing back, limitation on further disclosure, right-to-audit, return/destruction on termination.

3. Risk-based ongoing oversight. The transferring organization must have procedures for ongoing oversight proportionate to the sensitivity of the information and the nature of the transferee relationship.

4. Privacy management. Integrate transfer governance into the organization's overall privacy management program — accountability, training, inventory of transfers, regular review.`,
  },
  {
    id: "auth-quebec-law-25",
    organizationId: "preview",
    title: "Quebec Law 25 (Act to Modernize Legislative Provisions as Regards the Protection of Personal Information)",
    source: "An Act respecting the protection of personal information in the private sector, CQLR, c. P-39.1",
    jurisdiction: "quebec",
    registrationCategories: ["privacy", "counsel", "none"],
    sourceType: "statute",
    authorityDate: "2024-09-22",
    content: `Quebec Law 25 — Key requirements above the PIPEDA baseline

1. Designated privacy officer (s. 3.1): every enterprise must designate a person in charge of the protection of personal information. The person's function and contact information must be published on the enterprise's website.

2. Privacy impact assessments (s. 3.3): required for any project to acquire, develop, or overhaul an information system or electronic service involving personal information. The assessment must be proportionate to the sensitivity and volume of data, the purposes, and the circumstances of use.

3. Breach notification (s. 3.5): confidentiality incidents must be reported to the Commission d'accès à l'information (CAI) and to affected individuals when there is a risk of serious injury. Mandatory register of all incidents (not only serious ones) kept for 5 years.

4. Cross-border transfer (s. 17): before communicating personal information outside Quebec, the enterprise must assess whether the receiving jurisdiction provides adequate protection. Contractual safeguards proportionate to the assessment are required.

5. Consent (ss. 12-14): consent must be free, informed, express (for sensitive information), and given for specific purposes; in the case of minors under 14, parental consent is required.

6. Right to data portability (s. 27): individuals have the right to receive computerized personal information in a structured, commonly-used format, and to require transfer to another enterprise.

7. Biometric information: express consent; 60-day notice to CAI before creating a biometric database.

8. Automated decision-making (s. 12.1): notice and right to submit observations when decisions are made exclusively by automated processing.

9. De-indexation right (s. 28.1): right to cease dissemination or de-index personal information under specified conditions.

10. Administrative monetary penalties (s. 90.1 et seq.): up to the greater of CA$10M or 2% of worldwide turnover for organizations; additional penal provisions with higher caps.`,
  },
  {
    id: "auth-alberta-pipa",
    organizationId: "preview",
    title: "Alberta Personal Information Protection Act (PIPA)",
    source: "Personal Information Protection Act, S.A. 2003, c. P-6.5",
    jurisdiction: "alberta",
    registrationCategories: ["privacy", "counsel", "none"],
    sourceType: "statute",
    authorityDate: "2023-05-18",
    content: `Alberta PIPA — Key requirements above the PIPEDA baseline

1. Breach notification (s. 34.1): an organization must provide notice to the Information and Privacy Commissioner of any incident involving the loss of, or unauthorized access to or disclosure of, personal information where a reasonable person would consider that there exists a real risk of significant harm. The Commissioner may require the organization to notify affected individuals.

2. Consent to transfers outside Canada (implicit via s. 13): when an organization uses a service provider outside Canada to collect, use, or disclose personal information, the organization must notify the individual of that fact and of the purposes.

3. Right of access and correction (ss. 24-25): individuals have a right to access and correct their personal information, subject to limited exceptions.

4. Employee personal information (ss. 15-18): PIPA specifically addresses the collection, use, and disclosure of personal employee information, including a "reasonableness" standard for collection without consent in the employment context.

5. Enforcement: the Commissioner may order compliance, and administrative monetary penalties up to CA$100,000 apply under specified offences (s. 59).`,
  },
  {
    id: "auth-bc-pipa",
    organizationId: "preview",
    title: "British Columbia Personal Information Protection Act (PIPA)",
    source: "Personal Information Protection Act, S.B.C. 2003, c. 63",
    jurisdiction: "british-columbia",
    registrationCategories: ["privacy", "counsel", "none"],
    sourceType: "statute",
    authorityDate: "2023-11-01",
    content: `BC PIPA — Key requirements above the PIPEDA baseline

1. Scope (s. 3): applies to every organization operating in BC in the private sector; includes non-profits.

2. Consent (ss. 6-9): consent required; deemed consent in specified circumstances; opt-out permissible only in narrow scenarios.

3. Employee personal information (ss. 13-16): specific framework for collection, use, and disclosure without consent where reasonably required for the purposes of establishing, managing, or terminating an employment relationship.

4. Access and correction (ss. 23-25): individuals have a right to access and request correction; exceptions must be justified.

5. No mandatory breach notification statute-wide (as at 2024), but the Commissioner may make orders in response to complaints and publishes guidance recommending notification where there is a real risk of significant harm.

6. Enforcement (s. 50 et seq.): investigations, orders, and prosecution of offences.`,
  },
  {
    id: "auth-opc-privacy-management-program",
    organizationId: "preview",
    title: "OPC Getting Accountability Right with a Privacy Management Program",
    source: "Office of the Privacy Commissioner of Canada — Accountability Guidance",
    jurisdiction: "federal",
    registrationCategories: ["privacy", "counsel", "none"],
    sourceType: "regulator-notice",
    authorityDate: "2012-04-17",
    content: `OPC Accountability Guidance — Privacy Management Program

An effective privacy management program has these building blocks:

1. Organizational commitment
   - Buy-in from the top.
   - Appointment of a Chief Privacy Officer or equivalent.
   - Clear reporting mechanisms to senior leadership.

2. Program controls
   - Personal information inventory (what you hold, where, for how long).
   - Policies addressing PIPEDA's ten principles.
   - Risk assessment tools (PIAs, TRAs).
   - Training and awareness.
   - Breach and incident management protocols (incident register; escalation; post-incident review).
   - Service provider management — contractual safeguards and oversight.
   - External communications — privacy notices, access-request handling, complaint procedures.

3. Ongoing assessment and revision
   - Internal audit and self-assessment.
   - Monitoring regulatory developments.
   - Regular revision of policies and program controls based on findings.

The OPC may ask to see an organization's privacy management program in the course of an investigation or audit. Documented program controls are a strong indicator of due diligence.`,
  },
];
