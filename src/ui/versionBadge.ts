// package.json is the single source of truth for the version; Vite inlines just the named field.
import { version } from '../../package.json';

export function createVersionBadge(): void {
  const badge = document.createElement('div');
  badge.id = 'version-badge';
  badge.textContent = `v${version}`;
  document.body.append(badge);
}
