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
];
