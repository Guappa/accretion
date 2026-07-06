export const SAVE_VERSION = 1;
export const SAVE_STORAGE_KEY = 'black-hole.save';

export interface SavePayload {
  version: number;
  matter: number;
  mass: number;
  purchasedNodes: string[];
  migrationMultiplier: number;
  victorySeen: boolean;
}

export function serializeSave(
  matter: number,
  mass: number,
  purchasedNodes: readonly string[],
  migrationMultiplier: number,
  victorySeen: boolean,
): string {
  const payload: SavePayload = {
    version: SAVE_VERSION,
    matter,
    mass,
    purchasedNodes: [...purchasedNodes],
    migrationMultiplier,
    victorySeen,
  };
  return JSON.stringify(payload);
}

export function parseSave(raw: string | null): SavePayload | null {
  if (!raw) return null;
  try {
    return migrateSave(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function migrateSave(candidate: unknown): SavePayload | null {
  if (typeof candidate !== 'object' || candidate === null) return null;
  const record = candidate as Record<string, unknown>;
  if (record.version !== SAVE_VERSION) return null;
  if (typeof record.matter !== 'number' || typeof record.mass !== 'number') return null;
  if (typeof record.migrationMultiplier !== 'number') return null;
  // Corrupt/edited imports can carry well-typed but nonsensical numbers (negative, NaN, Infinity) - reject to fresh-start instead of loading garbage state.
  if (!Number.isFinite(record.matter) || record.matter < 0) return null;
  if (!Number.isFinite(record.mass) || record.mass < 0) return null;
  if (!Number.isFinite(record.migrationMultiplier) || record.migrationMultiplier <= 0) return null;
  if (!Array.isArray(record.purchasedNodes)) return null;
  if (!record.purchasedNodes.every((entry) => typeof entry === 'string')) return null;
  // Old saves predate this field, and a hand-edited non-boolean shouldn't nuke the whole save - default instead of reject.
  const victorySeen = record.victorySeen === true;
  return {
    version: SAVE_VERSION,
    matter: record.matter,
    mass: record.mass,
    purchasedNodes: record.purchasedNodes as string[],
    migrationMultiplier: record.migrationMultiplier,
    victorySeen,
  };
}
