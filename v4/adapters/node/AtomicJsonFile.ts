import { promises as fs } from 'node:fs';
import * as path from 'node:path';

let tempCounter = 0;

/**
 * JSON 原子写：
 * 写临时文件 → fsync → （目标存在时）备份 .bak → rename。
 * 崩溃钩子用于 AC4-03 的四情形测试；钩子抛错即模拟崩溃。
 */
export class AtomicJsonFile {
  constructor(
    private readonly filePath: string,
    private readonly hooks: {
      beforeBakWrite?: () => void | Promise<void>;
      afterBakWrite?: () => void | Promise<void>;
      beforeRename?: () => void | Promise<void>;
      afterRename?: () => void | Promise<void>;
    } = {},
  ) {}

  async writeJson(data: unknown): Promise<void> {
    const text = JSON.stringify(data, null, 2);
    if (text === undefined) {
      throw new TypeError('AtomicJsonFile.writeJson: data is not JSON serializable');
    }

    const directory = path.dirname(this.filePath);
    await fs.mkdir(directory, { recursive: true });
    tempCounter += 1;
    const tempPath = path.join(
      directory,
      `.${path.basename(this.filePath)}.tmp-${process.pid}-${tempCounter}`,
    );
    const bakPath = this.filePath + '.bak';

    try {
      const handle = await fs.open(tempPath, 'w');
      try {
        await handle.writeFile(text, 'utf8');
        await handle.sync();
      } finally {
        await handle.close();
      }

      if (await this.exists()) {
        await this.hooks.beforeBakWrite?.();
        await fs.copyFile(this.filePath, bakPath);
        await this.hooks.afterBakWrite?.();
      }

      await this.hooks.beforeRename?.();
      await fs.rename(tempPath, this.filePath);
      await this.hooks.afterRename?.();
    } catch (error) {
      await this.removeIfExists(tempPath);
      throw error;
    }
  }

  async readJson(): Promise<unknown> {
    const text = await fs.readFile(this.filePath, 'utf8');
    return JSON.parse(text) as unknown;
  }

  async exists(): Promise<boolean> {
    try {
      await fs.access(this.filePath);
      return true;
    } catch (error) {
      if (isEnoent(error)) return false;
      throw error;
    }
  }

  private async removeIfExists(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if (!isEnoent(error)) throw error;
    }
  }
}

function isEnoent(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && (error as NodeJS.ErrnoException).code === 'ENOENT';
}
