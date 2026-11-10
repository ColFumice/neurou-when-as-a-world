import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GAME_MODE_STORAGE_KEY,
  consumeInitialGameMode,
  resetGameModeEntry,
} from '../../app/src/game/gameModeEntry';

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  has(key: string): boolean {
    return this.values.has(key);
  }
}

describe('R5c-B-patch one-shot GameMode entry', () => {
  test('一次 ?mode=rhythm → Rhythm，并消费 sessionStorage', () => {
    const storage = new MemoryStorage();
    // index.html 的预写（Tauri 导航可能先丢 query）
    storage.setItem(GAME_MODE_STORAGE_KEY, 'rhythm');
    assert.equal(consumeInitialGameMode('?mode=rhythm', storage), 'rhythm');
    assert.equal(storage.has(GAME_MODE_STORAGE_KEY), false);
  });

  test('closeGame 重置 → 再次进入无 query → Explore', () => {
    const storage = new MemoryStorage();
    let appMode = consumeInitialGameMode('?mode=rhythm', storage);
    assert.equal(appMode, 'rhythm');
    appMode = resetGameModeEntry(storage);
    assert.equal(appMode, 'explore');
    assert.equal(consumeInitialGameMode('', storage), 'explore');
  });

  test('再次进入带 ?mode=rhythm → Rhythm', () => {
    const storage = new MemoryStorage();
    resetGameModeEntry(storage);
    assert.equal(consumeInitialGameMode('?mode=rhythm', storage), 'rhythm');
  });

  test('刷新无 query → Explore（sessionStorage 已被消费）', () => {
    const storage = new MemoryStorage();
    consumeInitialGameMode('?mode=rhythm', storage);
    // 模拟 App 模块重载，不带 query
    assert.equal(consumeInitialGameMode('', storage), 'explore');
  });

  test('新标签页无 query → Explore', () => {
    const storage = new MemoryStorage();
    assert.equal(consumeInitialGameMode('', storage), 'explore');
  });

  test('Tauri 先丢 query 但 index.html 已写 storage → 仍 Rhythm 一次', () => {
    const storage = new MemoryStorage();
    storage.setItem(GAME_MODE_STORAGE_KEY, 'rhythm');
    assert.equal(consumeInitialGameMode('', storage), 'rhythm');
    assert.equal(storage.has(GAME_MODE_STORAGE_KEY), false);
    assert.equal(consumeInitialGameMode('', storage), 'explore');
  });

  test('?mode=explore 强制 Explore 并清掉旧 debug 标记', () => {
    const storage = new MemoryStorage();
    storage.setItem(GAME_MODE_STORAGE_KEY, 'rhythm');
    assert.equal(consumeInitialGameMode('?mode=explore', storage), 'explore');
    assert.equal(storage.has(GAME_MODE_STORAGE_KEY), false);
  });
});
