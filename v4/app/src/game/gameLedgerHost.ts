import { TauriLedgerFile } from '@adapters/tauri/TauriLedgerFile';
import { TauriProjectIo } from '@adapters/tauri/TauriProjectIo';
import { ChartPremiereDirector } from '@core/director/ChartPremiereDirector';
import { LedgerReader, LedgerStore } from '@core/ledger/store';
import type { LedgerCheckpoint } from '@core/ledger/store';
import { ChartPremiere } from '@core/chart/ChartPremiere';
import { isValidWorldId, worldLedgerPaths } from './narrative/ledgerPaths';

export type GameLedgerStatus =
  | 'Ready'
  | 'PremiereRecorded'
  | 'Corrupt'
  | 'Unavailable';

/**
 * X · game / ledger host。
 * 负责把真实项目根与 world 账本适配器接起来；写入口仍委托给 director。
 */
export class GameLedgerHost {
  private readonly projectRoot: string;
  private readonly worldId: string;
  private readonly chartId: string;
  private readonly paths: { readonly ledgerPath: string; readonly headPath: string } | null;
  private readonly file: TauriLedgerFile | null;
  private readonly store: LedgerStore | null;
  private readonly reader: LedgerReader | null;
  private readonly director: ChartPremiereDirector | null;
  private status: GameLedgerStatus = 'Unavailable';
  private diagnostic: string | null = null;
  private disposed = false;
  private loaded = false;

  constructor(projectRoot: string, worldId: string, chartId: string) {
    this.projectRoot = projectRoot;
    this.worldId = worldId;
    this.chartId = chartId;

    if (typeof projectRoot !== 'string' || projectRoot.trim().length === 0) {
      this.paths = null;
      this.file = null;
      this.store = null;
      this.reader = null;
      this.director = null;
      this.diagnostic = 'projectRoot is empty';
      return;
    }
    if (!isValidWorldId(worldId)) {
      this.paths = null;
      this.file = null;
      this.store = null;
      this.reader = null;
      this.director = null;
      this.diagnostic = 'invalid worldId';
      return;
    }
    if (typeof chartId !== 'string' || chartId.length === 0) {
      this.paths = null;
      this.file = null;
      this.store = null;
      this.reader = null;
      this.director = null;
      this.diagnostic = 'chartId is empty';
      return;
    }

    try {
      const paths = worldLedgerPaths(worldId);
      const file = new TauriLedgerFile(paths.ledgerPath, paths.headPath);
      this.paths = paths;
      this.file = file;
      this.store = new LedgerStore(file);
      this.reader = new LedgerReader(file);
      this.director = new ChartPremiereDirector(this.store, this.reader);
    } catch (error) {
      this.paths = null;
      this.file = null;
      this.store = null;
      this.reader = null;
      this.director = null;
      this.diagnostic = error instanceof Error ? error.message : String(error);
    }
  }

  getStatus(): GameLedgerStatus {
    return this.status;
  }

  getDiagnostic(): string | null {
    return this.diagnostic;
  }

  /** 游戏加载阶段调用；读取失败只降级，不影响谱面进入 ready。 */
  async load(): Promise<GameLedgerStatus> {
    if (this.disposed) return this.status;
    if (!this.file || !this.reader || !this.paths) {
      this.status = 'Unavailable';
      return this.status;
    }
    try {
      await new TauriProjectIo().openProjectRoot(this.projectRoot);
      const result = await this.reader.readAll();
      if (!result.ok) {
        this.status = 'Corrupt';
        this.diagnostic = result.diagnostic;
        this.loaded = true;
        return this.status;
      }
      const recorded = result.events.some((event) => event.chartRef === this.chartId);
      this.status = recorded ? 'PremiereRecorded' : 'Ready';
      this.diagnostic = null;
      this.loaded = true;
      return this.status;
    } catch (error) {
      this.status = 'Unavailable';
      this.diagnostic = error instanceof Error ? error.message : String(error);
      this.loaded = true;
      return this.status;
    }
  }

  /**
   * 委托 director 写入；失败/拒绝返回 null，诊断通过 getDiagnostic() 读取。
   * 本方法不抛账本 I/O 异常。
   */
  async recordPremiere(
    premiere: ChartPremiere,
    nowMs: number,
  ): Promise<LedgerCheckpoint | null> {
    if (this.disposed || !this.director) {
      this.diagnostic = this.diagnostic ?? 'ledger host is disposed';
      return null;
    }
    if (!this.loaded) {
      await this.load();
    }
    if (this.status === 'Corrupt' || this.status === 'Unavailable') {
      return null;
    }
    if (this.status === 'PremiereRecorded') {
      this.diagnostic = 'chart premiere already recorded';
      return null;
    }
    if (premiere.chartId !== this.chartId) {
      this.diagnostic = 'premiere chartId does not match ledger host';
      return null;
    }

    try {
      const checkpoint = await this.director.recordPremiere(premiere, nowMs);
      if (checkpoint) {
        this.status = 'PremiereRecorded';
        this.diagnostic = null;
        return checkpoint;
      }
      const reason = this.director.lastDiagnostic ?? 'premiere was not recorded';
      this.diagnostic = reason;
      if (reason.includes('already recorded')) {
        this.status = 'PremiereRecorded';
      } else {
        this.status = 'Unavailable';
      }
      return null;
    } catch (error) {
      this.diagnostic = error instanceof Error ? error.message : String(error);
      this.status = 'Unavailable';
      return null;
    }
  }

  dispose(): void {
    this.disposed = true;
  }

  /** 诊断/测试用；只返回相对路径，不暴露绝对项目根。 */
  getRelativePaths(): { readonly ledgerPath: string; readonly headPath: string } | null {
    return this.paths;
  }

  getWorldId(): string {
    return this.worldId;
  }
}
