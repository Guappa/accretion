// package.json is the single source of truth for the version; Vite inlines just the named field.
import { version } from '../../package.json';

// Injected by vite.config.ts at build time so the badge names the exact deployed commit.
declare const __COMMIT_HASH__: string;

export function createVersionBadge(): void {
  const badge = document.createElement('div');
  badge.id = 'version-badge';
  badge.textContent = `v${version} ${__COMMIT_HASH__}`;
  document.body.append(badge);
}
