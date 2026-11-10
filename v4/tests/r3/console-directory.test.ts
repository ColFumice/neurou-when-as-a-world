import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ConsoleDirectory } from '../../core/presentation/console/ConsoleDirectory';

describe('R3.3a ConsoleDirectory', () => {
  test('根目录 parent 为 null，路径为 /', () => {
    const root = new ConsoleDirectory();
    assert.equal(root.getPath(), '/');
    assert.equal(root.getParent(), null);
    assert.equal(root.canEnterParent(), false);
    assert.equal(root.enterParent(), null);
    assert.equal(root.enter('..'), null);
    assert.deepEqual(root.listEntries(), []);
  });

  test('enter 合法子目录并维护 parent/path', () => {
    const root = new ConsoleDirectory();
    const child = root.addChild('world1');
    child.addChild('sub');

    assert.equal(root.getPath(), '/');
    assert.equal(child.getPath(), '/world1');
    assert.equal(child.getParent(), root);
    assert.equal(child.canEnterParent(), true);
    assert.equal(root.enter('world1'), child);
    assert.equal(child.enter('sub')?.getPath(), '/world1/sub');
    assert.equal(child.enterParent(), root);
    assert.equal(child.enter('missing'), null);
  });

  test('listEntries 顺序稳定，重复 addChild 不重复', () => {
    const root = new ConsoleDirectory();
    root.addChild('beta');
    root.addChild('alpha');
    root.addChild('gamma');
    root.addChild('alpha');

    assert.deepEqual(root.listEntries(), ['beta', 'alpha', 'gamma']);
    assert.deepEqual(root.listEntries(), ['beta', 'alpha', 'gamma']);
  });
});
