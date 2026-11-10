import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { TauriLedgerFile } from '../../adapters/tauri/TauriLedgerFile';
import { TauriProjectIo } from '../../adapters/tauri/TauriProjectIo';
import type { LedgerCheckpoint } from '../../core/ledger/store';
import {
  normalizeTauriError,
  TauriInvokeError,
  type TauriInvokeFn,
  type TauriResult,
} from '../../adapters/tauri/tauriInvoke';

interface InvokeCall {
  readonly command: string;
  readonly args?: Record<string, unknown>;
}

function makeInvoke(
  handler: (command: string, args?: Record<string, unknown>) => TauriResult<unknown>,
): { fn: TauriInvokeFn; calls: InvokeCall[] } {
  const calls: InvokeCall[] = [];
  const fn: TauriInvokeFn = async <T>(
    command: string,
    args?: Record<string, unknown>,
  ): Promise<TauriResult<T>> => {
    calls.push({ command, args });
    return handler(command, args) as unknown as TauriResult<T>;
  };
  return { fn, calls };
}

describe('R3.3b Tauri adapters', () => {
  test('TauriProjectIo 调用序列与参数', async () => {
    const { fn, calls } = makeInvoke((command) => {
      if (command === 'project_read_json') {
        return { ok: true, value: { schemaVersion: 1 } };
      }
      return { ok: true, value: undefined };
    });
    const io = new TauriProjectIo(fn);

    await io.ensureLayout();
    assert.equal(calls[0].command, 'project_ensure_layout');
    assert.equal(calls[0].args, undefined);

    const project = await io.readProjectJson();
    assert.deepEqual(project, { schemaVersion: 1 });
    assert.deepEqual(calls[1].args, { relPath: 'project.json' });

    await io.writeProjectJson({ schemaVersion: 1, projectId: 'p1' });
    assert.deepEqual(calls[2].args, {
      relPath: 'project.json',
      value: { schemaVersion: 1, projectId: 'p1' },
    });

    await io.writeEventTreeJson({ schemaVersion: 1, nodes: [], edges: [], rootNodeId: null });
    assert.deepEqual(calls[3].args, {
      relPath: 'event-tree.json',
      value: { schemaVersion: 1, nodes: [], edges: [], rootNodeId: null },
    });
  });

  test('TauriProjectIo 缺失文件返回 null', async () => {
    const { fn } = makeInvoke(() => ({ ok: true, value: null }));
    const io = new TauriProjectIo(fn);
    assert.equal(await io.readProjectJson(), null);
    assert.equal(await io.readEventTreeJson(), null);
  });

  test('TauriLedgerFile 调用序列与 hash', async () => {
    const head: LedgerCheckpoint = {
      schemaVersion: 1,
      eventCount: 2,
      lastEventId: 'e2',
      positionSum: new Array<number>(20).fill(0) as unknown as LedgerCheckpoint['positionSum'],
      checksum: 'abc',
    };
    const { fn, calls } = makeInvoke((command) => {
      if (command === 'ledger_read_head') return { ok: true, value: head };
      if (command === 'ledger_read_lines') return { ok: true, value: ['a', 'b'] };
      if (command === 'ledger_hash_sha256') return { ok: true, value: 'hash-value' };
      return { ok: true, value: undefined };
    });
    const ledger = new TauriLedgerFile('worlds/w1/ledger.ndjson', 'worlds/w1/ledger.head.json', fn);

    assert.deepEqual(await ledger.readHead(), head);
    assert.deepEqual(await ledger.readLines(), ['a', 'b']);
    await ledger.appendLine('line-3');
    await ledger.writeHead(head);
    assert.equal(await ledger.hash('abc'), 'hash-value');

    assert.deepEqual(calls[0].args, { relPath: 'worlds/w1/ledger.head.json' });
    assert.deepEqual(calls[1].args, { relPath: 'worlds/w1/ledger.ndjson' });
    assert.deepEqual(calls[2].args, { relPath: 'worlds/w1/ledger.ndjson', line: 'line-3' });
    assert.deepEqual(calls[3].args, { relPath: 'worlds/w1/ledger.head.json', value: head });
    assert.deepEqual(calls[4].args, { text: 'abc' });
  });

  test('错误归一化为 ProjectNotOpen / InvalidPath / EscapeDetected', async () => {
    assert.deepEqual(normalizeTauriError({ code: 'ProjectNotOpen', message: 'closed' }), {
      ok: false,
      code: 'ProjectNotOpen',
      message: 'closed',
    });
    assert.deepEqual(normalizeTauriError('boom'), {
      ok: false,
      code: 'IoError',
      message: 'boom',
    });

    for (const code of ['ProjectNotOpen', 'InvalidPath', 'EscapeDetected']) {
      const { fn } = makeInvoke(() => ({ ok: false, code, message: code }));
      const io = new TauriProjectIo(fn);
      await assert.rejects(
        io.ensureLayout(),
        (error: unknown) => error instanceof TauriInvokeError && error.code === code,
      );
    }
  });

  test('原子写四种 mock 崩溃情形与 Node AtomicJsonFile 对齐', async () => {
    type CrashMode = 'beforeBak' | 'afterBak' | 'beforeRename' | 'afterRename';
    const state: { current: unknown; backup: unknown | null } = { current: { value: 1 }, backup: null };
    let mode: CrashMode | null = null;

    const { fn } = makeInvoke((command, args) => {
      if (command !== 'project_write_json_atomic') return { ok: true, value: undefined };
      const next = (args?.value as unknown);
      if (mode === 'beforeBak') return { ok: false, code: 'IoError', message: 'beforeBak' };
      state.backup = state.current;
      if (mode === 'afterBak') return { ok: false, code: 'IoError', message: 'afterBak' };
      if (mode === 'beforeRename') return { ok: false, code: 'IoError', message: 'beforeRename' };
      state.current = next;
      if (mode === 'afterRename') return { ok: false, code: 'IoError', message: 'afterRename' };
      return { ok: true, value: undefined };
    });
    const io = new TauriProjectIo(fn);

    for (const scenario of [
      { mode: 'beforeBak' as const, current: 1, backup: null },
      { mode: 'afterBak' as const, current: 1, backup: 1 },
      { mode: 'beforeRename' as const, current: 1, backup: 1 },
      { mode: 'afterRename' as const, current: 2, backup: 1 },
    ]) {
      state.current = { value: 1 };
      state.backup = null;
      mode = scenario.mode;

      await assert.rejects(
        io.writeProjectJson({ value: 2 }),
        (error: unknown) => error instanceof TauriInvokeError,
      );
      assert.deepEqual(state.current, { value: scenario.current });
      assert.deepEqual(state.backup, scenario.backup === null ? null : { value: scenario.backup });
    }
  });
});
