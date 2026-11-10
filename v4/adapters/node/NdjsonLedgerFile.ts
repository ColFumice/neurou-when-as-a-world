import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { AtomicJsonFile } from './AtomicJsonFile';
import type { LedgerCheckpoint } from '../../core/ledger/store';

/** NDJSON 追加 + fsync；head 原子写；SHA-256 摘要。 */
export class NdjsonLedgerFile {
  private readonly headFile: AtomicJsonFile;

  constructor(private readonly ledgerPath: string, headPath: string) {
    this.headFile = new AtomicJsonFile(headPath);
  }

  async readHead(): Promise<LedgerCheckpoint | null> {
    try {
      const value = await this.headFile.readJson();
      return value as LedgerCheckpoint | null;
    } catch (error) {
      if (isEnoent(error)) return null;
      throw error;
    }
  }

  async readLines(): Promise<readonly string[]> {
    try {
      const text = await fs.readFile(this.ledgerPath, 'utf8');
      if (text === '') return [];
      const lines = text.split('\n');
      if (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
      }
      return lines;
    } catch (error) {
      if (isEnoent(error)) return [];
      throw error;
    }
  }

  async appendLine(line: string): Promise<void> {
    const handle = await fs.open(this.ledgerPath, 'a');
    try {
      await handle.writeFile(line + '\n', 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
  }

  async writeHead(checkpoint: LedgerCheckpoint): Promise<void> {
    await this.headFile.writeJson(checkpoint);
  }

  async hash(text: string): Promise<string> {
    return createHash('sha256').update(text, 'utf8').digest('hex');
  }
}

function isEnoent(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && (error as NodeJS.ErrnoException).code === 'ENOENT';
}
