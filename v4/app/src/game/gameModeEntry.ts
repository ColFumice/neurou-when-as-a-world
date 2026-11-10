/**
 * R5c-B-patch · 一次性 debug GameMode 入口。
 *
 * `?mode=rhythm` 只服务第一次进入世界；closeGame 后回到 Explore。
 * sessionStorage 只用于兜住 Tauri 导航可能丢 query 的窗口，App 模块消费后立即清除。
 */

export const GAME_MODE_STORAGE_KEY = 'neurou.game.mode';

export type GameModeEntry = 'explore' | 'rhythm';

export interface GameModeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function requestedGameMode(search: string): GameModeEntry | null {
  const mode = new URLSearchParams(search).get('mode');
  if (mode === 'rhythm') return 'rhythm';
  if (mode === 'explore') return 'explore';
  return null;
}

/**
 * 消费一次入口。调用后 storage 中的 debug 标记必须被移除：
 * 刷新/新标签页无 query 时回到 Explore。
 */
export function consumeInitialGameMode(
  search: string,
  storage: GameModeStorage,
): GameModeEntry {
  const queryMode = requestedGameMode(search);
  const storedMode = storage.getItem(GAME_MODE_STORAGE_KEY);
  storage.removeItem(GAME_MODE_STORAGE_KEY);

  if (queryMode === 'explore') return 'explore';
  if (queryMode === 'rhythm') return 'rhythm';
  // Tauri 项目导航可能在 App 模块求值前丢掉 query；index.html 的预写是唯一线索。
  if (storedMode === 'rhythm') return 'rhythm';
  return 'explore';
}

/** closeGame 时调用：清除粘性并回 Explore。 */
export function resetGameModeEntry(storage: GameModeStorage): GameModeEntry {
  storage.removeItem(GAME_MODE_STORAGE_KEY);
  return 'explore';
}
