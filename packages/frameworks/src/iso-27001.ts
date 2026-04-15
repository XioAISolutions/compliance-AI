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
    slug: "iso-27001.a-5-7",
    code: "A.5.7",
    annexA: "A.5.7",
    domain: "organizational",
    title: "Threat intelligence",
    description:
      "Information relating to threats must be collected and analyzed to produce actionable threat intelligence.",
  },
  {
    framework: "iso-27001",
    slug: "iso-27001.a-5-8",
    code: "A.5.8",
    annexA: "A.5.8",
    domain: "organizational",
    title: "Information security in project management",
    description:
      "Information security must be integrated into project management practices for all projects.",
  },
  {
    framework: "iso-27001",
    slug: "iso-27001.a-5-23",
    code: "A.5.23",
    annexA: "A.5.23",
    domain: "organizational",
    title: "Information security for use of cloud services",
    description:
      "Processes for acquisition, use, management, and exit from cloud services must address information security risks.",
  },
  {
    framework: "iso-27001",
    slug: "iso-27001.a-6-1",
    code: "A.6.1",
    annexA: "A.6.1",
    domain: "people",
    title: "Screening",
    description:
      "Background verification checks must be carried out on candidates before joining and on an ongoing basis where appropriate.",
  },
  {
    framework: "iso-27001",
    slug: "iso-27001.a-6-2",
    code: "A.6.2",
    annexA: "A.6.2",
    domain: "people",
    title: "Terms and conditions of employment",
    description:
      "Employment agreements must state personnel responsibilities for information security.",
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
    slug: "iso-27001.a-6-8",
    code: "A.6.8",
    annexA: "A.6.8",
    domain: "people",
    title: "Information security event reporting",
    description:
      "Personnel must be provided with a mechanism to report observed or suspected information security events promptly.",
  },
  {
    framework: "iso-27001",
    slug: "iso-27001.a-7-1",
    code: "A.7.1",
    annexA: "A.7.1",
    domain: "physical",
    title: "Physical security perimeters",
    description:
      "Security perimeters must be defined and used to protect areas containing information and associated assets.",
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
    slug: "iso-27001.a-7-4",
    code: "A.7.4",
    annexA: "A.7.4",
    domain: "physical",
    title: "Physical security monitoring",
    description:
      "Premises must be continuously monitored for unauthorized physical access.",
  },
  {
    framework: "iso-27001",
    slug: "iso-27001.a-7-8",
    code: "A.7.8",
    annexA: "A.7.8",
    domain: "physical",
    title: "Equipment siting and protection",
    description:
      "Equipment must be sited and protected to reduce risks from environmental threats and unauthorized access.",
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
    slug: "iso-27001.a-8-5",
    code: "A.8.5",
    annexA: "A.8.5",
    domain: "technological",
    title: "Secure authentication",
    description:
      "Secure authentication technologies and procedures must be implemented based on access restrictions and the information classification.",
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
  {
    framework: "iso-27001",
    slug: "iso-27001.a-8-24",
    code: "A.8.24",
    annexA: "A.8.24",
    domain: "technological",
    title: "Use of cryptography",
    description:
      "Rules for effective use of cryptography, including cryptographic key management, must be defined and implemented.",
  },
];
