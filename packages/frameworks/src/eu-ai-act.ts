/**
 * EU AI Act (Regulation 2024/1689) — seed catalog.
 *
 * Focus: obligations most products need to reason about first.
 *   - Prohibited practices (Title II)
 *   - High-risk system requirements (Title III, Chapter 2)
 *   - Transparency obligations for limited-risk systems (Art. 50)
 *   - GPAI model obligations (Title VIIIa)
 */

import type { EUAIActControl } from "./control.js";

export type EUAIActCatalogEntry = Omit<
  EUAIActControl,
  "id" | "organizationId" | "ownerId" | "createdAt" | "updatedAt" | "status"
>;

export const EU_AI_ACT_CORE: EUAIActCatalogEntry[] = [
  {
    framework: "eu-ai-act",
    slug: "eu-ai-act.art-5",
    code: "Art. 5",
    article: "Art. 5",
    riskTier: "unacceptable",
    title: "Prohibited AI practices",
    description:
      "Subliminal manipulation, exploitation of vulnerabilities, social scoring by public authorities, untargeted facial image scraping, emotion recognition in workplaces/schools, biometric categorisation on sensitive traits, and real-time remote biometric identification in public spaces (with narrow exceptions).",
  },
  {
    framework: "eu-ai-act",
    slug: "eu-ai-act.art-9",
    code: "Art. 9",
    article: "Art. 9",
    riskTier: "high",
    title: "Risk management system",
    description:
      "High-risk AI providers must establish, implement, document, and maintain a risk management system throughout the system's lifecycle.",
    annex: "Annex III",
  },
  {
    framework: "eu-ai-act",
    slug: "eu-ai-act.art-10",
    code: "Art. 10",
    article: "Art. 10",
    riskTier: "high",
    title: "Data and data governance",
    description:
      "Training, validation, and testing data sets must meet quality criteria including relevance, representativeness, and absence of errors, and must be examined for bias.",
    annex: "Annex III",
  },
  {
    framework: "eu-ai-act",
    slug: "eu-ai-act.art-13",
    code: "Art. 13",
    article: "Art. 13",
    riskTier: "high",
    title: "Transparency and provision of information to deployers",
    description:
      "High-risk AI systems must be accompanied by instructions for use containing concise, accurate, and clear information relevant to deployers.",
    annex: "Annex III",
  },
  {
    framework: "eu-ai-act",
    slug: "eu-ai-act.art-14",
    code: "Art. 14",
    article: "Art. 14",
    riskTier: "high",
    title: "Human oversight",
    description:
      "High-risk AI systems must be designed to be effectively overseen by humans, with measures proportionate to risk.",
    annex: "Annex III",
  },
  {
    framework: "eu-ai-act",
    slug: "eu-ai-act.art-50",
    code: "Art. 50",
    article: "Art. 50",
    riskTier: "limited",
    title: "Transparency for certain AI systems",
    description:
      "Users must be informed when interacting with an AI system. Deepfakes and AI-generated text on matters of public interest must be labelled.",
  },
];
