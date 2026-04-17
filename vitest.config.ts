import { defineConfig } from "vitest/config";

/**
 * Minimal Vitest config — scope the test discovery to the origin repo.
 *
 * Session-local worktrees under `.claude/worktrees/` duplicate every test
 * file but have no `node_modules`, so vitest's default discovery picks
 * them up as "failed-to-load" test files. Excluding `.claude/` here
 * matches how `.gitignore` and `.dockerignore` already treat it.
 */
export default defineConfig({
  test: {
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/.claude/**",
    ],
  },
});
