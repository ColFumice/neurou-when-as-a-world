/** X · game / narrative / ledger paths；纯路径/身份校验，不碰 Tauri。 */

export interface WorldLedgerPaths {
  readonly ledgerPath: string;
  readonly headPath: string;
}

const WORLD_ID_PATTERN = /^[A-Za-z0-9._-]+$/;

/** worldId 同时受 Tauri resolve_in_root 与这里的白名单保护。 */
export function isValidWorldId(worldId: string): boolean {
  if (typeof worldId !== 'string' || !WORLD_ID_PATTERN.test(worldId)) return false;
  return worldId !== '.' && worldId !== '..';
}

/** 项目相对路径；不包含 projectRoot。 */
export function worldLedgerPaths(worldId: string): WorldLedgerPaths {
  if (!isValidWorldId(worldId)) {
    throw new RangeError('worldId must contain only A-Za-z0-9._- and must not be . or ..');
  }
  return {
    ledgerPath: `worlds/${worldId}/ledger.ndjson`,
    headPath: `worlds/${worldId}/ledger.head.json`,
  };
}
