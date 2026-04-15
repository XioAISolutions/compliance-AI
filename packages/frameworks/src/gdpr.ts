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
];
