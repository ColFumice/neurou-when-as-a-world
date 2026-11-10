import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ConsoleCommand } from '../../core/presentation/console/ConsoleCommand';
import { ConsoleDirectory } from '../../core/presentation/console/ConsoleDirectory';
import { ConsoleDirectoryConstraint } from '../../core/presentation/console/ConsoleDirectoryConstraint';

function parse(input: string) {
  const result = ConsoleCommand.parseCommand(input);
  assert.equal(result.ok, true);
  assert.ok(result.command);
  return result.command;
}

function fixture() {
  const root = new ConsoleDirectory();
  const world1 = root.addChild('world1');
  world1.addChild('sub');
  root.addChild('world2');
  return { root, world1, constraint: new ConsoleDirectoryConstraint() };
}

describe('R3.3a ConsoleDirectoryConstraint', () => {
  test('根执行 cd .. 被拒绝且目录不变', () => {
    const { root, constraint } = fixture();
    const result = constraint.validate(parse('cd ..'), root);
    assert.equal(result.ok, false);
    assert.match(result.reason ?? '', /above the main folder/);
    assert.equal(result.nextDirectory, root);
  });

  test('绝对路径被拒绝', () => {
    const { root, constraint } = fixture();
    const result = constraint.validate(parse('cd /world1'), root);
    assert.equal(result.ok, false);
    assert.match(result.reason ?? '', /absolute/);
    assert.equal(result.nextDirectory, root);
  });

  test('盘符路径被拒绝', () => {
    const { root, constraint } = fixture();
    const result = constraint.validate(parse('cd C:\\world1'), root);
    assert.equal(result.ok, false);
    assert.match(result.reason ?? '', /drive/);
  });

  test('UNC 路径被拒绝', () => {
    const { root, constraint } = fixture();
    const result = constraint.validate(parse('cd \\\\server\\share'), root);
    assert.equal(result.ok, false);
    assert.match(result.reason ?? '', /UNC/);
  });

  test('含 .. 但仍在根内被允许', () => {
    const { root, constraint } = fixture();
    const result = constraint.validate(parse('cd world1/../world1'), root);
    assert.equal(result.ok, true);
    assert.equal(result.nextDirectory.getPath(), '/world1');
  });

  test('含 .. 且逃出根被拒绝', () => {
    const { root, constraint } = fixture();
    const result = constraint.validate(parse('cd ../world1'), root);
    assert.equal(result.ok, false);
    assert.equal(result.nextDirectory, root);
  });

  test('正常 cd 子目录成功', () => {
    const { root, constraint } = fixture();
    const result = constraint.validate(parse('cd world1'), root);
    assert.equal(result.ok, true);
    assert.equal(result.nextDirectory.getPath(), '/world1');
  });

  test('子层正常 cd .. 成功', () => {
    const { root, world1, constraint } = fixture();
    const result = constraint.validate(parse('cd ..'), world1);
    assert.equal(result.ok, true);
    assert.equal(result.nextDirectory, root);
  });
});
