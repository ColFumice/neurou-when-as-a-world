import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ConsoleCommand } from '../../core/presentation/console/ConsoleCommand';
import { ConsoleCommandList } from '../../core/presentation/console/ConsoleCommandList';

describe('R3.3a ConsoleCommand', () => {
  test('已知命令全部解析成功', () => {
    const commands = ['ls', 'cd', 'open', 'export', 'import', 'settings', 'help', 'clear', 'pwd', 'exit'];
    for (const name of commands) {
      const result = ConsoleCommand.parseCommand(name);
      assert.equal(result.ok, true, name);
      assert.ok(result.command, name);
      assert.equal(result.command.kind, name);
      assert.deepEqual(result.args, []);
      assert.equal(result.reason, null);
    }
  });

  test('参数提取正确', () => {
    const result = ConsoleCommand.parseCommand('cd world1');
    assert.equal(result.ok, true);
    assert.ok(result.command);
    assert.equal(result.command.kind, 'cd');
    assert.deepEqual(result.args, ['world1']);

    const open = ConsoleCommand.parseCommand('open my-world');
    assert.equal(open.ok, true);
    assert.deepEqual(open.args, ['my-world']);
  });

  test('未知命令与空输入解析失败', () => {
    const unknown = ConsoleCommand.parseCommand('bogus foo');
    assert.equal(unknown.ok, false);
    assert.equal(unknown.command, null);
    assert.match(unknown.reason ?? '', /unknown command/);

    const empty = ConsoleCommand.parseCommand('   ');
    assert.equal(empty.ok, false);
    assert.match(empty.reason ?? '', /empty command/);
  });

  test('命令表顺序稳定', () => {
    assert.deepEqual(
      ConsoleCommandList.map((item) => item.name),
      ['ls', 'cd', 'pwd', 'open', 'edit', 'export', 'import', 'settings', 'help', 'clear', 'exit'],
    );
  });
});
