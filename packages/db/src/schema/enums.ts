import { pgEnum } from "drizzle-orm/pg-core";

export const frameworkEnum = pgEnum("framework", [
  "soc2",
  "gdpr",
  "eu-ai-act",
  "iso-27001",
]);

export const controlStatusEnum = pgEnum("control_status", [
  "not-started",
  "in-progress",
  "evidence-collected",
  "reviewed",
  "approved",
  "exception",
]);

export const userRoleEnum = pgEnum("user_role", [
  "owner",
  "admin",
  "member",
  "auditor",
]);
