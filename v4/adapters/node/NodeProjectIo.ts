import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { AtomicJsonFile } from './AtomicJsonFile';

/** 项目布局与两个 JSON 文档的 Node 适配器。 */
export class NodeProjectIo {
  private readonly projectFile: AtomicJsonFile;
  private readonly eventTreeFile: AtomicJsonFile;

  constructor(private readonly projectRoot: string) {
    this.projectFile = new AtomicJsonFile(path.join(projectRoot, 'project.json'));
    this.eventTreeFile = new AtomicJsonFile(path.join(projectRoot, 'event-tree.json'));
  }

  async ensureLayout(): Promise<void> {
    await fs.mkdir(this.projectRoot, { recursive: true });
    await fs.mkdir(path.join(this.projectRoot, 'worlds'), { recursive: true });
    await fs.mkdir(path.join(this.projectRoot, 'media'), { recursive: true });
    await fs.mkdir(path.join(this.projectRoot, 'drafts'), { recursive: true });
  }

  /** 文件不存在时返回 null；解析失败时抛错。 */
  async readProjectJson(): Promise<unknown> {
    return this.readJsonOrNull(this.projectFile);
  }

  async writeProjectJson(data: unknown): Promise<void> {
    await this.projectFile.writeJson(data);
  }

  /** 文件不存在时返回 null；解析失败时抛错。 */
  async readEventTreeJson(): Promise<unknown> {
    return this.readJsonOrNull(this.eventTreeFile);
  }

  async writeEventTreeJson(data: unknown): Promise<void> {
    await this.eventTreeFile.writeJson(data);
  }

  private async readJsonOrNull(file: AtomicJsonFile): Promise<unknown> {
    try {
      return await file.readJson();
    } catch (error) {
      if (isEnoent(error)) return null;
      throw error;
    }
  }
}

function isEnoent(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && (error as NodeJS.ErrnoException).code === 'ENOENT';
}
