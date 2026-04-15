/**
 * ISO/IEC 27001:2022 — seed catalog.
 *
 * The 2022 revision groups 93 Annex A controls into 4 themes:
 *   - Organizational (37)
 *   - People (8)
 *   - Physical (14)
 *   - Technological (34)
 *
 * Seeded here: one representative control per theme + two common SaaS picks.
 */

import type { ISO27001Control } from "./control.js";

export type ISO27001CatalogEntry = Omit<
  ISO27001Control,
  "id" | "organizationId" | "ownerId" | "createdAt" | "updatedAt" | "status"
>;

export const ISO_27001_CORE: ISO27001CatalogEntry[] = [
  {
    framework: "iso-27001",
    slug: "iso-27001.a-5-1",
    code: "A.5.1",
    annexA: "A.5.1",
    domain: "organizational",
    title: "Policies for information security",
    description:
      "Information security policy and topic-specific policies must be defined, approved by management, published, and reviewed.",
  },
  {
    framework: "iso-27001",
    slug: "iso-27001.a-6-3",
    code: "A.6.3",
    annexA: "A.6.3",
    domain: "people",
    title: "Information security awareness, education, and training",
    description:
      "Personnel and relevant interested parties must receive appropriate information security awareness, education, and training.",
  },
  {
    framework: "iso-27001",
    slug: "iso-27001.a-7-2",
    code: "A.7.2",
    annexA: "A.7.2",
    domain: "physical",
    title: "Physical entry controls",
    description:
      "Secure areas must be protected by appropriate entry controls and access points.",
  },
  {
    framework: "iso-27001",
    slug: "iso-27001.a-8-2",
    code: "A.8.2",
    annexA: "A.8.2",
    domain: "technological",
    title: "Privileged access rights",
    description:
      "The allocation and use of privileged access rights must be restricted and managed.",
  },
  {
    framework: "iso-27001",
    slug: "iso-27001.a-8-16",
    code: "A.8.16",
    annexA: "A.8.16",
    domain: "technological",
    title: "Monitoring activities",
    description:
      "Networks, systems, and applications must be monitored for anomalous behaviour, with appropriate actions taken to evaluate potential security incidents.",
  },
];
