/**
 * SOC 2 Trust Service Criteria — seed catalog.
 *
 * Scope of this seed: the Common Criteria (CC) series only. The remaining
 * categories (Availability, Confidentiality, Processing Integrity, Privacy)
 * are additional criteria layered on top of CC and can be added per-customer.
 *
 * Each entry omits the tenant-bound fields (`id`, `organizationId`, `ownerId`,
 * `createdAt`, `updatedAt`, `status`) — those are assigned when a tenant
 * "adopts" the framework and the catalog is materialized into their controls.
 */

import type { SOC2Control } from "./control.js";

export type SOC2CatalogEntry = Omit<
  SOC2Control,
  "id" | "organizationId" | "ownerId" | "createdAt" | "updatedAt" | "status"
>;

export const SOC2_COMMON_CRITERIA: SOC2CatalogEntry[] = [
  {
    framework: "soc2",
    slug: "soc2.cc1.1",
    code: "CC1.1",
    tsc: "CC",
    auditPeriod: "type-2",
    title: "Control environment — integrity and ethical values",
    description:
      "The entity demonstrates a commitment to integrity and ethical values.",
    pointsOfFocus: [
      "Code of conduct is documented and acknowledged by personnel",
      "Tone at the top reinforces ethical behavior",
      "Deviations are investigated and remediated",
    ],
  },
  {
    framework: "soc2",
    slug: "soc2.cc1.2",
    code: "CC1.2",
    tsc: "CC",
    auditPeriod: "type-2",
    title: "Control environment - board independence and oversight",
    description:
      "The board of directors demonstrates independence from management and exercises oversight of internal control.",
    pointsOfFocus: [
      "Board oversight responsibilities are defined",
      "Independent directors challenge management where appropriate",
      "Oversight covers system and service commitments",
    ],
  },
  {
    framework: "soc2",
    slug: "soc2.cc1.3",
    code: "CC1.3",
    tsc: "CC",
    auditPeriod: "type-2",
    title: "Control environment - structure, authority, and responsibility",
    description:
      "Management establishes structures, reporting lines, and appropriate authorities and responsibilities.",
    pointsOfFocus: [
      "Organizational structure supports control objectives",
      "Reporting lines are documented",
      "Authority and responsibility are assigned",
    ],
  },
  {
    framework: "soc2",
    slug: "soc2.cc1.4",
    code: "CC1.4",
    tsc: "CC",
    auditPeriod: "type-2",
    title: "Control environment - competence",
    description:
      "The entity demonstrates a commitment to attract, develop, and retain competent individuals.",
    pointsOfFocus: [
      "Roles define required skills and experience",
      "Personnel receive training appropriate to responsibilities",
      "Performance is evaluated against control responsibilities",
    ],
  },
  {
    framework: "soc2",
    slug: "soc2.cc1.5",
    code: "CC1.5",
    tsc: "CC",
    auditPeriod: "type-2",
    title: "Control environment - accountability",
    description:
      "The entity holds individuals accountable for their internal control responsibilities.",
    pointsOfFocus: [
      "Accountability is built into performance expectations",
      "Control responsibilities are monitored",
      "Corrective action is taken when responsibilities are not met",
    ],
  },
  {
    framework: "soc2",
    slug: "soc2.cc2.1",
    code: "CC2.1",
    tsc: "CC",
    auditPeriod: "type-2",
    title: "Information quality — relevant information for internal control",
    description:
      "The entity obtains or generates and uses relevant, quality information to support the functioning of internal control.",
    pointsOfFocus: [
      "Information requirements are identified",
      "Internal and external data sources are evaluated",
      "Data quality is maintained",
    ],
  },
  {
    framework: "soc2",
    slug: "soc2.cc2.2",
    code: "CC2.2",
    tsc: "CC",
    auditPeriod: "type-2",
    title: "Information and communication - internal communication",
    description:
      "The entity internally communicates information necessary to support internal control.",
    pointsOfFocus: [
      "Control information is communicated to personnel",
      "Policy and procedure changes are distributed",
      "Personnel can report control issues",
    ],
  },
  {
    framework: "soc2",
    slug: "soc2.cc2.3",
    code: "CC2.3",
    tsc: "CC",
    auditPeriod: "type-2",
    title: "Information and communication - external communication",
    description:
      "The entity communicates with external parties about matters affecting internal control.",
    pointsOfFocus: [
      "Customer commitments are communicated",
      "Vendor and third-party communications are managed",
      "External reports are reviewed for accuracy",
    ],
  },
  {
    framework: "soc2",
    slug: "soc2.cc3.1",
    code: "CC3.1",
    tsc: "CC",
    auditPeriod: "type-2",
    title: "Risk assessment - objectives",
    description:
      "The entity specifies objectives with sufficient clarity to enable risk identification and assessment.",
    pointsOfFocus: [
      "System objectives align with service commitments",
      "Objectives consider security, availability, and confidentiality needs",
      "Measurable criteria are defined",
    ],
  },
  {
    framework: "soc2",
    slug: "soc2.cc3.2",
    code: "CC3.2",
    tsc: "CC",
    auditPeriod: "type-2",
    title: "Risk assessment - identifies and analyzes risks",
    description:
      "The entity identifies risks to the achievement of objectives and analyzes those risks as a basis for response.",
    pointsOfFocus: [
      "Threats and vulnerabilities are identified",
      "Risk likelihood and impact are assessed",
      "Risk responses are selected and tracked",
    ],
  },
  {
    framework: "soc2",
    slug: "soc2.cc3.3",
    code: "CC3.3",
    tsc: "CC",
    auditPeriod: "type-2",
    title: "Risk assessment - fraud risk",
    description:
      "The entity considers the potential for fraud when assessing risks to objectives.",
    pointsOfFocus: [
      "Incentives and pressures are considered",
      "Opportunities for unauthorized activity are evaluated",
      "Fraud scenarios are included in risk assessment",
    ],
  },
  {
    framework: "soc2",
    slug: "soc2.cc3.4",
    code: "CC3.4",
    tsc: "CC",
    auditPeriod: "type-2",
    title: "Risk assessment - significant change",
    description:
      "The entity identifies and assesses changes that could significantly affect internal control.",
    pointsOfFocus: [
      "Product, infrastructure, and personnel changes are evaluated",
      "Third-party and regulatory changes are monitored",
      "Control impacts are assessed before rollout",
    ],
  },
  {
    framework: "soc2",
    slug: "soc2.cc4.1",
    code: "CC4.1",
    tsc: "CC",
    auditPeriod: "type-2",
    title: "Monitoring activities - ongoing and separate evaluations",
    description:
      "The entity selects, develops, and performs ongoing and separate evaluations to determine whether controls are present and functioning.",
    pointsOfFocus: [
      "Controls are tested on a defined cadence",
      "Automated monitoring supports manual reviews",
      "Evaluation scope covers key commitments",
    ],
  },
  {
    framework: "soc2",
    slug: "soc2.cc4.2",
    code: "CC4.2",
    tsc: "CC",
    auditPeriod: "type-2",
    title: "Monitoring activities - evaluates and communicates deficiencies",
    description:
      "The entity evaluates and communicates internal control deficiencies in a timely manner.",
    pointsOfFocus: [
      "Deficiencies are documented and prioritized",
      "Owners and deadlines are assigned",
      "Remediation is verified",
    ],
  },
  {
    framework: "soc2",
    slug: "soc2.cc5.1",
    code: "CC5.1",
    tsc: "CC",
    auditPeriod: "type-2",
    title: "Control activities - selects and develops control activities",
    description:
      "The entity selects and develops control activities that help mitigate risks to objectives.",
    pointsOfFocus: [
      "Controls map to identified risks",
      "Preventive and detective controls are balanced",
      "Control ownership is assigned",
    ],
  },
  {
    framework: "soc2",
    slug: "soc2.cc5.2",
    code: "CC5.2",
    tsc: "CC",
    auditPeriod: "type-2",
    title: "Control activities — technology general controls",
    description:
      "The entity selects and develops general control activities over technology to support the achievement of objectives.",
    pointsOfFocus: [
      "Dependency on technology is identified",
      "Technology infrastructure controls are established",
      "Security management process is in place",
    ],
  },
  {
    framework: "soc2",
    slug: "soc2.cc5.3",
    code: "CC5.3",
    tsc: "CC",
    auditPeriod: "type-2",
    title: "Control activities - policies and procedures",
    description:
      "The entity deploys control activities through policies that establish expectations and procedures that put policies into action.",
    pointsOfFocus: [
      "Policies are approved and maintained",
      "Procedures describe control operation",
      "Policy exceptions are reviewed",
    ],
  },
  {
    framework: "soc2",
    slug: "soc2.cc6.1",
    code: "CC6.1",
    tsc: "CC",
    auditPeriod: "type-2",
    title: "Logical access — access controls",
    description:
      "The entity implements logical access security software, infrastructure, and architectures over protected information assets.",
    pointsOfFocus: [
      "User identification and authentication",
      "Least-privilege access is enforced",
      "Access is reviewed periodically",
      "Privileged access is tightly controlled",
    ],
  },
  {
    framework: "soc2",
    slug: "soc2.cc6.2",
    code: "CC6.2",
    tsc: "CC",
    auditPeriod: "type-2",
    title: "Logical access - user registration and authorization",
    description:
      "Before issuing credentials, the entity authorizes and registers new internal and external users.",
    pointsOfFocus: [
      "Access requests require approval",
      "User identities are verified before provisioning",
      "Access is provisioned according to role",
    ],
  },
  {
    framework: "soc2",
    slug: "soc2.cc6.3",
    code: "CC6.3",
    tsc: "CC",
    auditPeriod: "type-2",
    title: "Logical access - access modification and removal",
    description:
      "The entity authorizes, modifies, or removes access based on changes in user roles or termination.",
    pointsOfFocus: [
      "Role changes trigger access review",
      "Departing personnel are deprovisioned promptly",
      "Access changes are logged",
    ],
  },
  {
    framework: "soc2",
    slug: "soc2.cc6.4",
    code: "CC6.4",
    tsc: "CC",
    auditPeriod: "type-2",
    title: "Logical access - restricts physical access",
    description:
      "The entity restricts physical access to facilities and protected information assets.",
    pointsOfFocus: [
      "Facilities use badge or equivalent access controls",
      "Visitor access is authorized and logged",
      "Physical access is reviewed periodically",
    ],
  },
  {
    framework: "soc2",
    slug: "soc2.cc6.5",
    code: "CC6.5",
    tsc: "CC",
    auditPeriod: "type-2",
    title: "Logical access - protects against unauthorized access",
    description:
      "The entity prevents or detects unauthorized access to system resources.",
    pointsOfFocus: [
      "Authentication mechanisms are enforced",
      "Network and endpoint protections are deployed",
      "Unauthorized access attempts generate alerts",
    ],
  },
  {
    framework: "soc2",
    slug: "soc2.cc6.6",
    code: "CC6.6",
    tsc: "CC",
    auditPeriod: "type-2",
    title: "Logical access - protects against malicious software",
    description:
      "The entity implements controls to prevent, detect, and act on malicious software.",
    pointsOfFocus: [
      "Anti-malware or equivalent protections are enabled",
      "Malware alerts are investigated",
      "Users are trained on malicious content risks",
    ],
  },
  {
    framework: "soc2",
    slug: "soc2.cc6.7",
    code: "CC6.7",
    tsc: "CC",
    auditPeriod: "type-2",
    title: "Logical access - data transmission and disposal",
    description:
      "The entity restricts the transmission, movement, and disposal of information to authorized channels.",
    pointsOfFocus: [
      "Sensitive data transfer is encrypted",
      "Removable media and exports are controlled",
      "Disposal follows retention and destruction requirements",
    ],
  },
  {
    framework: "soc2",
    slug: "soc2.cc6.8",
    code: "CC6.8",
    tsc: "CC",
    auditPeriod: "type-2",
    title: "Logical access - vulnerability management",
    description:
      "The entity implements controls to identify and manage vulnerabilities in infrastructure and software.",
    pointsOfFocus: [
      "Vulnerability scans are performed",
      "Findings are risk-ranked",
      "Remediation is tracked to closure",
    ],
  },
  {
    framework: "soc2",
    slug: "soc2.cc7.1",
    code: "CC7.1",
    tsc: "CC",
    auditPeriod: "type-2",
    title: "System operations - detection procedures",
    description:
      "The entity uses detection and monitoring procedures to identify events that may indicate security incidents.",
    pointsOfFocus: [
      "Security events are logged",
      "Monitoring rules cover key assets",
      "Detection procedures are reviewed",
    ],
  },
  {
    framework: "soc2",
    slug: "soc2.cc7.2",
    code: "CC7.2",
    tsc: "CC",
    auditPeriod: "type-2",
    title: "System operations — monitoring and anomaly detection",
    description:
      "The entity monitors system components and the operation of controls to detect anomalies indicative of malicious acts, natural disasters, and errors.",
    pointsOfFocus: [
      "Logging is enabled across critical systems",
      "Anomaly detection is configured and tuned",
      "Alerts are reviewed and actioned",
    ],
  },
  {
    framework: "soc2",
    slug: "soc2.cc7.3",
    code: "CC7.3",
    tsc: "CC",
    auditPeriod: "type-2",
    title: "System operations - evaluates security events",
    description:
      "The entity evaluates security events to determine whether they could or did result in system failure or unauthorized activity.",
    pointsOfFocus: [
      "Events are triaged using defined severity criteria",
      "Potential incidents are escalated",
      "Event analysis is retained",
    ],
  },
  {
    framework: "soc2",
    slug: "soc2.cc7.4",
    code: "CC7.4",
    tsc: "CC",
    auditPeriod: "type-2",
    title: "System operations - incident response",
    description:
      "The entity responds to identified security incidents by executing response procedures.",
    pointsOfFocus: [
      "Incident response plans are documented",
      "Roles and communications are defined",
      "Incident actions are tracked",
    ],
  },
  {
    framework: "soc2",
    slug: "soc2.cc7.5",
    code: "CC7.5",
    tsc: "CC",
    auditPeriod: "type-2",
    title: "System operations - incident recovery",
    description:
      "The entity identifies, develops, and implements activities to recover from identified security incidents.",
    pointsOfFocus: [
      "Recovery steps are documented",
      "Lessons learned feed control improvements",
      "Incident closure includes remediation validation",
    ],
  },
  {
    framework: "soc2",
    slug: "soc2.cc8.1",
    code: "CC8.1",
    tsc: "CC",
    auditPeriod: "type-2",
    title: "Change management - manages system changes",
    description:
      "The entity authorizes, designs, develops, configures, documents, tests, approves, and implements changes to infrastructure, data, software, and procedures.",
    pointsOfFocus: [
      "Changes are requested and approved",
      "Testing is performed before production release",
      "Emergency changes are reviewed after implementation",
    ],
  },
  {
    framework: "soc2",
    slug: "soc2.cc9.1",
    code: "CC9.1",
    tsc: "CC",
    auditPeriod: "type-2",
    title: "Risk mitigation - selects and develops risk responses",
    description:
      "The entity identifies, selects, and develops risk mitigation activities for business disruptions and vendor or third-party risks.",
    pointsOfFocus: [
      "Business disruption scenarios are assessed",
      "Third-party risks are evaluated",
      "Mitigation plans are approved and tracked",
    ],
  },
  {
    framework: "soc2",
    slug: "soc2.cc9.2",
    code: "CC9.2",
    tsc: "CC",
    auditPeriod: "type-2",
    title: "Risk mitigation - third-party risk management",
    description:
      "The entity assesses and manages risks associated with vendors and business partners.",
    pointsOfFocus: [
      "Vendors are risk-ranked",
      "Vendor commitments and controls are reviewed",
      "Ongoing monitoring is performed for critical vendors",
    ],
  },
];
