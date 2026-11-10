import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ConsoleEffect } from '../../core/presentation/console/ConsoleEffect';
import { WorldExportIntent } from '../../core/presentation/console/WorldExportIntent';
import { WorldFileEntry } from '../../core/presentation/console/WorldFileEntry';
import { WorldFolderEntryKind } from '../../core/presentation/console/WorldFolderEntryKind';
import { WorldImportAuto } from '../../core/presentation/console/WorldImportAuto';
import { WorldSelectionMode } from '../../core/presentation/console/WorldSelectionMode';

describe('R3.3a console 杂项', () => {
  test('WorldImportAuto 识别 exe / world / 文件夹', () => {
    const exe = WorldImportAuto.detectFromPath('C:\\worlds\\a.exe');
    assert.ok(exe);
    assert.equal(exe.detectedKind, WorldFolderEntryKind.WorldExe);

    const world = WorldImportAuto.detectFromPath('C:\\worlds\\a.world');
    assert.ok(world);
    assert.equal(world.detectedKind, WorldFolderEntryKind.WorldExe);

    const folder = WorldImportAuto.detectFromPath('C:\\worlds\\folder');
    assert.ok(folder);
    assert.equal(folder.detectedKind, WorldFolderEntryKind.Folder);

    const trailing = WorldImportAuto.detectFromPath('C:\\worlds\\folder\\');
    assert.ok(trailing);
    assert.equal(trailing.detectedKind, WorldFolderEntryKind.Folder);

    assert.equal(WorldImportAuto.detectFromPath('   '), null);
  });

  test('WorldExportIntent.create 字段正确', () => {
    const intent = WorldExportIntent.create('entry-1');
    assert.equal(intent.sourceEntryId, 'entry-1');
    assert.equal(intent.targetKind, WorldFolderEntryKind.Folder);

    const custom = WorldExportIntent.create('entry-2', WorldFolderEntryKind.Settings);
    assert.equal(custom.targetKind, WorldFolderEntryKind.Settings);
  });

  test('枚举值正确', () => {
    assert.deepEqual(
      [WorldFolderEntryKind.Folder, WorldFolderEntryKind.WorldExe, WorldFolderEntryKind.Settings, WorldFolderEntryKind.Other],
      ['Folder', 'WorldExe', 'Settings', 'Other'],
    );
    assert.deepEqual(
      [WorldSelectionMode.Keyboard, WorldSelectionMode.Pointer, WorldSelectionMode.Hover],
      ['Keyboard', 'Pointer', 'Hover'],
    );
    assert.deepEqual(
      [ConsoleEffect.Scanline, ConsoleEffect.Flicker, ConsoleEffect.Glitch, ConsoleEffect.None],
      ['Scanline', 'Flicker', 'Glitch', 'None'],
    );
  });

  test('ConsoleEffect 包含 Fisheye 且共 5 个值', () => {
    assert.equal(ConsoleEffect.Fisheye, 'Fisheye');
    assert.equal(Object.values(ConsoleEffect).length, 5);
    assert.deepEqual(
      Object.values(ConsoleEffect),
      ['Scanline', 'Flicker', 'Glitch', 'Fisheye', 'None'],
    );
  });

  test('WorldFileEntry 视图模型不携带文件路径', () => {
    const entry: WorldFileEntry = {
      entryId: 'e1',
      displayName: 'world1',
      kind: WorldFolderEntryKind.Folder,
      orphan: true,
    };
    assert.deepEqual(Object.keys(entry).sort(), ['displayName', 'entryId', 'kind', 'orphan']);
  });
});
