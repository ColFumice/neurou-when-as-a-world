import type { LedgerCheckpoint } from '../../core/ledger/store';
import {
  invoke as defaultInvoke,
  TauriInvokeError,
  type TauriInvokeFn,
} from './tauriInvoke';

/** X · Tauri NDJSON ledger adapter；路径相对 ActiveProjectRoot。 */
export class TauriLedgerFile {
  constructor(
    private readonly ledgerPath: string,
    private readonly headPath: string,
    private readonly invokeFn: TauriInvokeFn = defaultInvoke,
  ) {}

  async readHead(): Promise<LedgerCheckpoint | null> {
    return this.call<LedgerCheckpoint | null>('ledger_read_head', {
      relPath: this.headPath,
    });
  }

  async readLines(): Promise<readonly string[]> {
    return this.call<string[]>('ledger_read_lines', {
      relPath: this.ledgerPath,
    });
  }

  async appendLine(line: string): Promise<void> {
    await this.call<void>('ledger_append_line', {
      relPath: this.ledgerPath,
      line,
    });
  }

  async writeHead(checkpoint: LedgerCheckpoint): Promise<void> {
    await this.call<void>('ledger_write_head', {
      relPath: this.headPath,
      value: checkpoint,
    });
  }

  async hash(text: string): Promise<string> {
    return this.call<string>('ledger_hash_sha256', { text });
  }

  private async call<T>(
    command: string,
    args?: Record<string, unknown>,
  ): Promise<T> {
    const result = await this.invokeFn<T>(command, args);
    if (!result.ok) throw new TauriInvokeError(result.code, result.message);
    return result.value;
  }
}
