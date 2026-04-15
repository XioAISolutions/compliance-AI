/**
 * GDPR — seed catalog of the articles most operationally relevant to a
 * typical SaaS. A full catalog ingests all 99 articles + recitals later.
 */

import type { GDPRControl } from "./control.js";

export type GDPRCatalogEntry = Omit<
  GDPRControl,
  "id" | "organizationId" | "ownerId" | "createdAt" | "updatedAt" | "status"
>;

export const GDPR_CORE: GDPRCatalogEntry[] = [
  {
    framework: "gdpr",
    slug: "gdpr.art-5",
    code: "Art. 5",
    article: "Art. 5",
    chapter: "Chapter II — Principles",
    title: "Principles relating to processing of personal data",
    description:
      "Personal data must be processed lawfully, fairly, transparently, for specified purposes, with data minimisation, accuracy, storage limitation, integrity, confidentiality, and accountability.",
  },
  {
    framework: "gdpr",
    slug: "gdpr.art-6",
    code: "Art. 6",
    article: "Art. 6",
    chapter: "Chapter II — Principles",
    title: "Lawfulness of processing",
    description:
      "Processing is only lawful if at least one of the six lawful bases applies.",
    lawfulBasis: [
      "consent",
      "contract",
      "legal-obligation",
      "vital-interests",
      "public-task",
      "legitimate-interests",
    ],
  },
  {
    framework: "gdpr",
    slug: "gdpr.art-7",
    code: "Art. 7",
    article: "Art. 7",
    chapter: "Chapter II — Principles",
    title: "Conditions for consent",
    description:
      "Where processing is based on consent, the controller must be able to demonstrate valid consent and make withdrawal as easy as giving consent.",
    lawfulBasis: ["consent"],
  },
  {
    framework: "gdpr",
    slug: "gdpr.art-13",
    code: "Art. 13",
    article: "Art. 13",
    chapter: "Chapter III — Rights of the data subject",
    title: "Information to be provided where data is collected from the subject",
    description:
      "Controllers must provide transparent information at the point of collection, including identity, purposes, legal basis, retention, and rights.",
    dataSubjectRight: "right-to-be-informed",
  },
  {
    framework: "gdpr",
    slug: "gdpr.art-15",
    code: "Art. 15",
    article: "Art. 15",
    chapter: "Chapter III — Rights of the data subject",
    title: "Right of access",
    description:
      "Data subjects have the right to obtain confirmation of processing and a copy of their personal data.",
    dataSubjectRight: "right-of-access",
  },
  {
    framework: "gdpr",
    slug: "gdpr.art-17",
    code: "Art. 17",
    article: "Art. 17",
    chapter: "Chapter III — Rights of the data subject",
    title: "Right to erasure",
    description:
      "Data subjects have the right to request erasure of personal data in defined circumstances, including withdrawn consent, objection, unlawful processing, or expired purpose.",
    dataSubjectRight: "right-to-erasure",
  },
  {
    framework: "gdpr",
    slug: "gdpr.art-20",
    code: "Art. 20",
    article: "Art. 20",
    chapter: "Chapter III — Rights of the data subject",
    title: "Right to data portability",
    description:
      "Data subjects have the right to receive personal data they provided in a structured, commonly used, machine-readable format and transmit it to another controller.",
    dataSubjectRight: "right-to-data-portability",
  },
  {
    framework: "gdpr",
    slug: "gdpr.art-25",
    code: "Art. 25",
    article: "Art. 25",
    chapter: "Chapter IV — Controller and processor",
    title: "Data protection by design and by default",
    description:
      "Controllers must implement appropriate technical and organisational measures that embed data protection principles and default to only necessary processing.",
  },
  {
    framework: "gdpr",
    slug: "gdpr.art-28",
    code: "Art. 28",
    article: "Art. 28",
    chapter: "Chapter IV — Controller and processor",
    title: "Processor obligations",
    description:
      "Controllers may use only processors providing sufficient guarantees, and processing must be governed by a contract with required data protection terms.",
  },
  {
    framework: "gdpr",
    slug: "gdpr.art-30",
    code: "Art. 30",
    article: "Art. 30",
    chapter: "Chapter IV — Controller and processor",
    title: "Records of processing activities",
    description:
      "Controllers and processors must maintain a written record of processing activities, including purposes, categories of data, and recipients.",
  },
  {
    framework: "gdpr",
    slug: "gdpr.art-32",
    code: "Art. 32",
    article: "Art. 32",
    chapter: "Chapter IV — Controller and processor",
    title: "Security of processing",
    description:
      "Controllers and processors must implement appropriate technical and organisational measures to ensure a level of security appropriate to the risk.",
  },
  {
    framework: "gdpr",
    slug: "gdpr.art-33",
    code: "Art. 33",
    article: "Art. 33",
    chapter: "Chapter IV — Controller and processor",
    title: "Notification of a personal data breach to the supervisory authority",
    description:
      "Personal data breaches must be reported to the supervisory authority within 72 hours of awareness, unless the breach is unlikely to result in a risk to rights and freedoms.",
  },
  {
    framework: "gdpr",
    slug: "gdpr.art-35",
    code: "Art. 35",
    article: "Art. 35",
    chapter: "Chapter IV — Controller and processor",
    title: "Data protection impact assessment",
    description:
      "Where processing is likely to result in high risk to individuals, the controller must assess necessity, proportionality, risks, and risk mitigation before processing.",
  },
  {
    framework: "gdpr",
    slug: "gdpr.art-37",
    code: "Art. 37",
    article: "Art. 37",
    chapter: "Chapter IV — Controller and processor",
    title: "Designation of the data protection officer",
    description:
      "Controllers and processors must designate a data protection officer where required, including certain public authority, large-scale monitoring, or special-category processing contexts.",
  },
  {
    framework: "gdpr",
    slug: "gdpr.art-38",
    code: "Art. 38",
    article: "Art. 38",
    chapter: "Chapter IV — Controller and processor",
    title: "Position of the data protection officer",
    description:
      "The data protection officer must be properly involved, supported, independent in duties, reachable by data subjects, and bound by confidentiality.",
  },
  {
    framework: "gdpr",
    slug: "gdpr.art-39",
    code: "Art. 39",
    article: "Art. 39",
    chapter: "Chapter IV — Controller and processor",
    title: "Tasks of the data protection officer",
    description:
      "The data protection officer informs and advises, monitors compliance, advises on DPIAs, cooperates with supervisory authorities, and acts as a contact point.",
  },
];
