/// <reference types="vitest/config" />
import { execFileSync } from 'node:child_process';
import { defineConfig } from 'vite';

// Stamped at build time so the badge identifies the exact deployed commit; 'dev' when git is unavailable.
function commitHash(): string {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD']).toString().trim();
  } catch {
    return 'dev';
  }
}

export default defineConfig({
  define: {
    __COMMIT_HASH__: JSON.stringify(commitHash()),
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
