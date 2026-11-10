import type { ConsoleCommand } from './ConsoleCommand';
import type { ConsoleDirectory } from './ConsoleDirectory';

interface ConsoleConstraintResult {
  readonly ok: boolean;
  readonly reason: string | null;
  readonly nextDirectory: ConsoleDirectory;
}

/**
 * P · console：只允许主文件夹下层操作。
 * 拒绝绝对路径、盘符、UNC，以及规范化后逃出根的 ".."。
 */
export class ConsoleDirectoryConstraint {
  validate(command: ConsoleCommand, current: ConsoleDirectory): ConsoleConstraintResult {
    if (command.kind !== 'cd') {
      return { ok: true, reason: null, nextDirectory: current };
    }

    const raw = command.args[0];
    if (raw === undefined || raw.length === 0) {
      return this.fail('cd requires a path', current);
    }
    if (raw.startsWith('/')) {
      return this.fail('absolute paths are not allowed', current);
    }
    if (/^[A-Za-z]:[\\/]/.test(raw)) {
      return this.fail('drive paths are not allowed', current);
    }
    if (/^\\\\/.test(raw)) {
      return this.fail('UNC paths are not allowed', current);
    }

    let directory = current;
    const segments = raw.split(/[\\/]+/);

    for (const segment of segments) {
      if (segment.length === 0 || segment === '.') continue;

      if (segment === '..') {
        if (!directory.canEnterParent()) {
          return this.fail('cannot go above the main folder', current);
        }
        directory = directory.enterParent()!;
        continue;
      }

      const next = directory.enter(segment);
      if (next === null) {
        return this.fail(`directory not found: ${segment}`, current);
      }
      directory = next;
    }

    return { ok: true, reason: null, nextDirectory: directory };
  }

  private fail(reason: string, current: ConsoleDirectory): ConsoleConstraintResult {
    return { ok: false, reason, nextDirectory: current };
  }
}
