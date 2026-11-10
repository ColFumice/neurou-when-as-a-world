import { _decorator, Component, Node, UITransform, Canvas, Camera, director, Director, isValid, resources, JsonAsset } from 'cc';
import { AccountStartupSession } from './src/director/AccountStartupSession';
import { WorldFolderSession } from './src/director/WorldFolderSession';
import { WorldLocalStorage } from './src/presentation/WorldLocalStorage';
import { WorldFolderView } from './src/presentation/WorldFolderView';
import { EditorFolderView } from './src/presentation/EditorFolderView';
import { AccountStartupStorage, FolderStartupView } from './src/presentation/FolderStartupView';
import { applyFolderTheme } from './src/presentation/FolderTheme';
import { createWorldFolderReader, editorCatalog } from './src/presentation/FolderCatalog';
import type { EditorFolderEntry, WorldFolderEntry } from './src/presentation/FolderCatalog';
import { GuidanceEditorBuilder } from './GuidanceEditorBuilder';
import { MusicEditorBuilder } from './MusicEditorBuilder';
import { MinimalWorldBuilder } from './MinimalWorldBuilder';
import { createAccountMilestoneReader } from './src/director/AccountMilestone';
import type { AccountMilestoneReader } from './src/director/AccountMilestone';
import { AccountMilestoneStorage } from './src/presentation/AccountMilestoneStorage';
import { WorldStateSession } from './src/director/WorldStateSession';
import { WorldStateStorage } from './src/presentation/WorldStateStorage';
import { WorldClearStorage } from './src/presentation/WorldClearStorage';
import { WorldCoreStateStorage } from './src/presentation/WorldCoreStateStorage';
import type { WorldStateLease } from './src/presentation/WorldCoreStateStorage';
import { FormatTimeStorage } from './src/presentation/FormatTimeStorage';
import { WorldStateCodec } from './src/director/WorldStateCodec';
import { createPrimaryWorldStateCodec } from './src/director/PrimaryWorldState';
import type { WorldStateSnapshot } from './src/director/WorldStateSession';
import type { WorldCoreStateSnapshot } from './src/director/WorldStateCodec';
import { LedgerHydration } from './src/director/LedgerHydration';
import type { LedgerSnapshot } from './src/director/LedgerHydration';
import { validatePuzzleProgressSnapshot } from './src/director/PuzzleHydration';
import { parseWorldNarrativeContent } from './src/director/WorldNarrativeContent';
import { parseGuidanceChart } from './src/chart/GuidanceChart';
import { createDefaultKeyboardPadLayout, CHART_KEY_IDS } from './src/chart/KeyboardPadLayout';
import { WorldForkSession, validateWorldForkPlan, rebaseWorldState } from './src/director/WorldForkSession';
import { chartContentDigest } from './src/director/ChartArchive';
import { WorldForkStorage } from './src/presentation/WorldForkStorage';
import { CrossDevicePrototype } from './CrossDevicePrototype';

const { ccclass } = _decorator;

/** Composition-only runtime identity; no mutable gameplay object crosses the view. */
export interface WorldRuntimeIdentity {
  readonly accountId: string;
  readonly worldId: string;
  readonly coreStorage: WorldCoreStateStorage;
  readonly lease: WorldStateLease;
}

/** Composition root for entry routing. No gameplay objects exist before world selection. */
@ccclass('WorldFolderBuilder')
export class WorldFolderBuilder extends Component {
  private readonly storage = new AccountStartupStorage();
  private readonly startup = new AccountStartupSession(snapshot => this.storage.saveCompletion(snapshot));
  private readonly startupView = new FolderStartupView();
  private folderView: WorldFolderView | null = null;
  private catalogView: EditorFolderView | null = null;
  private runtimeNode: Node | null = null;
  private worldFactory: ((node: Node, identity: WorldRuntimeIdentity) => void) | null = null;
  private exitControl: HTMLButtonElement | null = null;
  private retiring = false;
  private folderPending = false;
  private folderSession: WorldFolderSession | null = null;
  private readonly worldStorage = new WorldLocalStorage();
  private readonly milestoneStorage = new AccountMilestoneStorage();
  private readonly clearStorage = new WorldClearStorage();
  private milestoneReader: AccountMilestoneReader | null = null;
  private readonly stateStorage = new WorldStateStorage();
  private readonly stateSessions = new Map<string, WorldStateSession>();
  private readonly creationIds = new Set<string>();
  private readonly coreStorage = new WorldCoreStateStorage(undefined, undefined,
    (raw, accountId, worldId) => new WorldStateCodec().parse(raw, accountId, worldId),
    (accountId, worldId) => this.isWorldActive(accountId, worldId));
  private readonly formatStorage = new FormatTimeStorage(this.coreStorage);
  private readonly forkStorage = new WorldForkStorage(undefined, undefined, {
    validatePlan: raw => validateWorldForkPlan(raw, (state, accountId, worldId) => {
      if (!this.directoryCompleteValidator) { throw new Error('分叉完整状态验证器尚未装配'); }
      return this.directoryCompleteValidator(state, accountId, worldId);
    }),
    validateFolder: (raw, accountId) => {
      if (raw === null) { throw new Error('分叉目录不存在'); }
      return new WorldFolderSession(accountId, raw, () => { throw new Error('目录验证不可写入'); },
        () => { throw new Error('目录验证不可创建'); }, () => { throw new Error('目录验证不可采样时间'); }).getSnapshot();
    },
    validateSource: plan => {
      if (!this.coreStorage.hasWorldLease(plan.accountId, plan.sourceWorldId)) { throw new Error('分叉必须持有源世界租约'); }
      const sourceRecord = this.loadFolderSession(plan.accountId).getWorldRecord(plan.sourceWorldId);
      const source = this.directoryCompleteValidator!(this.coreStorage.readCoreState(plan.accountId, plan.sourceWorldId),
        plan.accountId, plan.sourceWorldId);
      if (source.revision !== plan.sourceRevision || chartContentDigest(source) !== plan.sourceDigest) {
        throw new Error('源世界完整状态已变化；未发布分叉');
      }
      const inherited = rebaseWorldState(source, plan.targetWorldId, plan.targetState.forkOrigin!,
        (raw, account, world) => this.directoryCompleteValidator!(raw, account, world));
      if (chartContentDigest(inherited) !== chartContentDigest(plan.targetState)) {
        throw new Error('目标状态不是当前源世界七项状态的精确继承；未发布分叉');
      }
      const suffix = ' 的副本'; let title = '';
      for (const character of Array.from(sourceRecord.title)) {
        if (title.length + character.length > 80 - suffix.length) { break; }
        title += character;
      }
      if (plan.targetRecord.title !== title.trimEnd() + suffix || plan.targetRecord.description !== sourceRecord.description) {
        throw new Error('目标目录文字不是当前来源目录的合法副本；未发布分叉');
      }
      const permission = createAccountMilestoneReader(plan.accountId, this.milestoneStorage.readProjection(plan.accountId));
      if (!permission.getMilestoneSnapshot().CopyPermission) { throw new Error('尚未取得复制权限'); }
    },
    assertTargetLease: plan => {
      if (!this.coreStorage.hasWorldLease(plan.accountId, plan.targetWorldId)) { throw new Error('分叉目标缺少独占租约'); }
    },
    writeTarget: state => {
      if (!this.coreStorage.hasWorldLease(state.accountId, state.worldId) || !state.forkOrigin) { throw new Error('分叉暂存授权无效'); }
      const reservation = JSON.stringify([state.accountId, state.worldId]);
      this.creationIds.add(reservation);
      try { this.coreStorage.saveCoreState(state, null); }
      finally { this.creationIds.delete(reservation); }
    },
    deleteTargetExpected: (state, expectedRaw) => this.coreStorage.removeUnpublishedCoreState(state, expectedRaw),
  });
  private runtimeLease: WorldStateLease | null = null;
  private opening = false;
  private directoryBusy = false;
  private coreValidatorReady: Promise<void> | null = null;
  private directoryCoreValidator: ((raw: unknown, accountId: string, worldId: string) => WorldCoreStateSnapshot) | null = null;
  private directoryCompleteValidator: ((raw: unknown, accountId: string, worldId: string) => WorldStateSnapshot) | null = null;
  private regularChartUsesGuidance = true;
  private regularChartResourcePath = 'chart/guidance_c';
  private crossDevicePrototype: CrossDevicePrototype | null = null;

  bindWorldFactory(factory: (node: Node, identity: WorldRuntimeIdentity) => void): void {
    this.worldFactory = factory;
  }

  bindRegularChartSource(useGuidanceChart: boolean, resourcePath: string): void {
    this.regularChartUsesGuidance = useGuidanceChart;
    this.regularChartResourcePath = resourcePath.trim();
  }

  start(): void {
    this.startupView.showLogin(accountId => {
      try {
        // Storage failure must not be treated as an uncompleted or completed milestone.
        const completed = this.storage.readCompletion(accountId);
        this.startup.submitStartupIntent({ kind: 'Login', accountId, PrologueCompleted: completed });
        if (completed) { this.showWorldFolder(); return; }
        this.startupView.showPrologue(accountId, this.startup.getPrologueText(), () => {
          try {
            this.startup.submitStartupIntent({ kind: 'CompletePrologue' });
            this.showWorldFolder();
          } catch (error) { this.startupView.showError('序章完成状态未能保存：' + String(error)); }
        });
      } catch (error) { this.startupView.showError('无法登录本地账号：' + String(error)); }
    });
  }

  private clearViews(): void {
    this.crossDevicePrototype?.unmount();
    this.startupView.destroy(); this.folderView?.destroy(); this.catalogView?.destroy();
    this.folderView = null; this.catalogView = null;
  }

  private showWorldFolder(): void {
    const accountId = this.startup.getStartupSnapshot().accountId;
    if (accountId === null) { return; }
    // B2.2c replays only a persisted, validated account fact, never world hydration.
    void this.clearStorage.reconcileAccount(accountId, this.milestoneStorage).then(() => {
      if (isValid(this, true)) { this.renderWorldFolder(); }
    }).catch(error => {
      if (!isValid(this, true)) { return; }
      this.renderWorldFolder();
      this.folderView?.showStatus('通关记录对账未能完成：' + String(error));
    });
  }

  private async renderWorldFolder(): Promise<void> {
    const accountId = this.startup.getStartupSnapshot().accountId;
    if (accountId === null) { return; }
    let error: unknown = null;
    let cleanupError: unknown = null;
    try {
      await this.prepareCoreValidator();
      await this.recoverPendingFork(accountId);
      await this.initializeDirectory(accountId);
      if (!isValid(this, true)) { return; }
      this.folderSession = this.loadFolderSession(accountId);
      // Tombstoned worlds never reopen; any interrupted chart cleanup is retried here.
      try { await this.cleanupDeletedCharts(accountId); }
      catch (failure) { cleanupError = failure; }
    }
    catch (failure) { this.folderSession = null; error = failure; }
    this.clearViews();
    // Read the existing projection after the trusted account-record reconciliation boundary.
    this.milestoneReader = Object.freeze({ getMilestoneSnapshot: () =>
      createAccountMilestoneReader(accountId, this.milestoneStorage.readProjection(accountId)).getMilestoneSnapshot() });
    this.stateSessions.clear();
    this.folderView = new WorldFolderView(createWorldFolderReader(accountId,
      () => this.folderSession?.getWorlds() ?? []),
      entry => this.openWorld(entry), () => this.showEditorFolder(),
      { submitWorldFolderIntent: intent => {
        if (!this.folderSession) { throw new Error('世界目录尚未加载，请刷新后重试'); }
        if (intent.kind === 'CreateWorld') {
          void this.createWorld(accountId, intent.title, intent.description);
        } else if (intent.kind === 'DeleteWorld') {
          return this.deleteWorld(accountId, intent.worldId);
        } else if (intent.kind === 'WorldFork') { return this.forkWorld(accountId, intent.worldId); }
        else { this.folderSession.submitWorldFolderIntent(intent); }
        return undefined;
      } }, () => this.showWorldFolder(), this.milestoneReader,
      worldId => this.getStateSession(accountId, worldId).captureWorldState(),
      worldId => this.getStateSession(accountId, worldId).restoreWorldState(
        this.stateStorage.readSnapshot(accountId, worldId)), () => 'Implemented');
    this.folderView.mount();
    if (error !== null) { this.folderView.showStatus('世界目录未能加载：' + String(error)); }
    else if (cleanupError !== null) { this.folderView.showStatus('世界目录已加载；已删除世界的谱面清理待刷新重试：' + String(cleanupError)); }
    if (error === null) { this.mountCrossDevicePrototype(accountId); }
  }

  /** Restricted-transfer composition is separate from local Fork and its transaction. */
  private mountCrossDevicePrototype(accountId: string): void {
    if (!this.crossDevicePrototype) {
      this.crossDevicePrototype = new CrossDevicePrototype({ accountId,
        readSourceFolder: () => this.loadFolderSession(accountId).getSnapshot(),
        readSource: worldId => this.directoryCompleteValidator!(this.coreStorage.readCoreState(accountId, worldId), accountId, worldId),
        acquireSourceLease: worldId => this.coreStorage.acquireWorldLease(accountId, worldId, true),
        milestoneReader: this.milestoneReader!,
        validateComplete: (raw, account, world) => this.directoryCompleteValidator!(raw, account, world),
        isIdle: () => isValid(this, true) && !this.runtimeNode && !this.opening && !this.directoryBusy && !this.retiring,
        openTarget: identity => this.openImportedRuntime(identity),
      });
    }
    this.crossDevicePrototype.mount();
  }

  /** Caller has passed receipt/current HomeDevice guard and owns the real B lease. */
  private openImportedRuntime(identity: WorldRuntimeIdentity): void {
    if (!isValid(this, true) || this.runtimeNode || this.opening || this.directoryBusy || this.retiring || !this.worldFactory) {
      throw new Error('导入世界入口当前不可用');
    }
    const runtime = this.createRuntime(identity.worldId);
    try { this.worldFactory(runtime, identity); }
    catch (error) { runtime.active = false; runtime.destroy(); this.runtimeNode = null; throw error; }
    this.runtimeLease = identity.lease;
    this.clearViews();
    this.showExitControl('退出 B 世界 · 返回世界文件夹');
  }

  private getStateSession(accountId: string, worldId: string): WorldStateSession {
    // Validate active directory membership; a diagnostic must not load or create gameplay.
    if (this.worldStorage.readSnapshot(accountId) === null) { throw new Error('世界目录不存在，请刷新后重试'); }
    this.loadFolderSession(accountId).getWorldRecord(worldId);
    let session = this.stateSessions.get(worldId);
    if (!session) {
      session = new WorldStateSession(accountId, worldId, Date.now, 'Implemented');
      session.bindCompleteSource(() => this.coreStorage.readValidatedCoreState(accountId, worldId),
        raw => {
          if (!this.directoryCompleteValidator) { throw new Error('七项验证器尚未装配'); }
          return this.directoryCompleteValidator(raw, accountId, worldId);
        });
      this.stateSessions.set(worldId, session);
    }
    return session;
  }

  private loadFolderSession(accountId: string, reservedWorldId?: string): WorldFolderSession {
    let expected = this.worldStorage.readSnapshot(accountId);
    return new WorldFolderSession(accountId, expected, snapshot => {
      this.forkStorage.assertNoPending(accountId);
      const previousIds = new Set((expected as { records?: readonly { worldId: string }[] } | null)?.records?.map(record => record.worldId) ?? []);
      for (const record of snapshot.records) {
        if (!previousIds.has(record.worldId)) { this.initializeCreatedWorld(accountId, record.worldId); }
      }
      this.worldStorage.saveSnapshot(snapshot, expected);
      expected = snapshot;
    }, () => reservedWorldId ?? 'world-' + globalThis.crypto.randomUUID(), () => Date.now());
  }

  private isWorldActive(accountId: string, worldId: string): boolean {
    if (this.creationIds.has(JSON.stringify([accountId, worldId]))) { return true; }
    const raw = this.worldStorage.readSnapshot(accountId);
    if (raw === null) { return false; }
    const folder = new WorldFolderSession(accountId, raw, () => { throw new Error('目录读取不可写入'); },
      () => { throw new Error('目录读取不可创建'); }, () => Date.now());
    return folder.getSnapshot().records.some(record => record.worldId === worldId && record.deletedAt === null);
  }

  /** Only a newly allocated, leased directory identity can receive FormatTime. */
  private initializeCreatedWorld(accountId: string, worldId: string): void {
    if (!this.creationIds.has(JSON.stringify([accountId, worldId]))) {
      throw new Error('世界创建协议缺少独占租约；未发布新目录');
    }
    const existing = this.coreStorage.readValidatedCoreState(accountId, worldId);
    if (existing !== null) {
      // Retry a failed directory publication without inventing another creation time.
      if (existing.revision !== 0 || existing.worldKind !== 'Unavailable' || existing.sections.Ledger !== null ||
          existing.sections.PuzzleProgress !== null || existing.sections.FormatTime === null) {
        throw new Error('待创建世界已有其他状态；保留原始存储并拒绝覆盖');
      }
      return;
    }
    const epochMs = Date.now();
    const snapshot: WorldCoreStateSnapshot = Object.freeze({ schemaVersion: 1, accountId, worldId,
      worldKind: 'Unavailable', shoreOrigin: 'Unavailable', revision: 0, capturedAt: epochMs, kind: 'Core',
      sections: Object.freeze({ Ledger: null, PuzzleProgress: null, FormatTime: Object.freeze({ epochMs }) }) });
    this.formatStorage.initializeFormatTime(snapshot, true);
  }

  private async initializeDirectory(accountId: string): Promise<void> {
    if (this.worldStorage.readSnapshot(accountId) !== null) { return; }
    const lease = await this.coreStorage.acquireWorldLease(accountId, 'InitialWorld');
    const creationId = JSON.stringify([accountId, 'InitialWorld']);
    try {
      await this.forkStorage.withDirectoryLock(accountId, () => {
        this.forkStorage.assertNoPending(accountId);
        if (this.worldStorage.readSnapshot(accountId) !== null) { return; }
        this.creationIds.add(creationId);
        this.loadFolderSession(accountId);
      });
    } finally { this.creationIds.delete(creationId); lease.release(); }
  }

  private async createWorld(accountId: string, title: string, description: string): Promise<void> {
    if (this.directoryBusy || this.opening || this.runtimeNode) { return; }
    this.directoryBusy = true;
    const worldId = 'world-' + globalThis.crypto.randomUUID();
    const creationId = JSON.stringify([accountId, worldId]);
    let lease: WorldStateLease | null = null;
    try {
      await this.recoverPendingFork(accountId);
      lease = await this.coreStorage.acquireWorldLease(accountId, worldId);
      if (!isValid(this, true)) { return; }
      this.creationIds.add(creationId);
      await this.forkStorage.withDirectoryLock(accountId, () => {
        this.forkStorage.assertNoPending(accountId);
        const session = this.loadFolderSession(accountId, worldId);
        session.submitWorldFolderIntent({ kind: 'CreateWorld', title, description });
        this.folderSession = session;
      });
      this.showWorldFolder();
    } catch (error: unknown) {
      if (isValid(this, true)) { this.folderView?.showStatus('世界未能创建：' + String(error)); }
    } finally { this.creationIds.delete(creationId); lease?.release(); this.directoryBusy = false; }
  }

  private async deleteWorld(accountId: string, worldId: string): Promise<void> {
    if (this.directoryBusy || this.runtimeNode || this.opening) { throw new Error('世界正在使用，请返回文件夹后重试'); }
    this.directoryBusy = true;
    let lease: WorldStateLease | null = null;
    let failure: unknown = null;
    try {
      await this.prepareCoreValidator();
      await this.recoverPendingFork(accountId);
      lease = await this.coreStorage.acquireWorldLease(accountId, worldId);
      await this.forkStorage.withDirectoryLock(accountId, () => {
        this.forkStorage.assertNoPending(accountId);
        const folder = this.loadFolderSession(accountId);
        folder.submitWorldFolderIntent({ kind: 'DeleteWorld', worldId });
        this.folderSession = folder;
      });
      // Directory tombstone first, then idempotent GC under the same world lease.
      this.coreStorage.clearDeletedChartState(accountId, worldId);
    } catch (error: unknown) { failure = error; }
    finally { lease?.release(); this.directoryBusy = false; }
    await this.renderWorldFolder();
    if (failure !== null) {
      this.folderView?.showStatus('删除或谱面清理未全部完成；墓碑保留，刷新可重试：' + String(failure));
      throw failure;
    }
  }

  private async cleanupDeletedCharts(accountId: string): Promise<void> {
    for (const record of this.folderSession?.getSnapshot().records ?? []) {
      if (record.deletedAt === null) { continue; }
      const raw = this.coreStorage.readValidatedCoreState(accountId, record.worldId);
      if (raw?.sections.ChartSnapshot == null && raw?.sections.ChartScore == null) { continue; }
      const lease = await this.coreStorage.acquireWorldLease(accountId, record.worldId);
      try { this.coreStorage.clearDeletedChartState(accountId, record.worldId); }
      finally { lease.release(); }
    }
  }

  /** Recovery does not consult or change the source; publication is decided by the directory. */
  private async recoverPendingFork(accountId: string): Promise<void> {
    const pending = this.forkStorage.readPending(accountId);
    if (!pending) { return; }
    const lease = await this.coreStorage.acquireWorldLease(accountId, pending.plan.targetWorldId, true);
    try {
      const result = await this.forkStorage.withDirectoryLock(accountId, () => this.forkStorage.recoverWorldFork(accountId));
      if (result.kind === 'Pending' || (result.kind === 'Committed' && result.cleanupPending)) {
        throw new Error('分叉事务待恢复；原数据保留，请刷新重试：' + result.error);
      }
    } finally { lease.release(); }
  }

  private async forkWorld(accountId: string, sourceWorldId: string): Promise<void> {
    if (this.directoryBusy || this.opening || this.runtimeNode || this.retiring) { throw new Error('请返回世界文件夹后再分叉'); }
    this.directoryBusy = true;
    let sourceLease: WorldStateLease | null = null, targetLease: WorldStateLease | null = null;
    let message = '';
    try {
      await this.prepareCoreValidator();
      await this.recoverPendingFork(accountId);
      sourceLease = await this.coreStorage.acquireWorldLease(accountId, sourceWorldId, true);
      if (!isValid(this, true)) { return; }
      const directory = this.loadFolderSession(accountId).getSnapshot();
      const source = this.directoryCompleteValidator!(this.coreStorage.readCoreState(accountId, sourceWorldId), accountId, sourceWorldId);
      const permission = createAccountMilestoneReader(accountId, this.milestoneStorage.readProjection(accountId));
      const plan = new WorldForkSession(accountId, permission, {
        createWorldId: () => 'world-' + crypto.randomUUID(), createTransactionId: () => 'fork-' + crypto.randomUUID(),
        now: () => Date.now(), validateComplete: (raw, account, world) => this.directoryCompleteValidator!(raw, account, world),
      }).prepareWorldFork(sourceWorldId, directory, source);
      targetLease = await this.coreStorage.acquireWorldLease(accountId, plan.targetWorldId, true);
      const result = await this.forkStorage.withDirectoryLock(accountId, () => this.forkStorage.commitWorldFork(plan, directory));
      if (result.kind === 'Pending') { throw new Error('分叉尚未发布；回滚待刷新重试：' + result.error); }
      message = result.cleanupPending ? '副本已创建；事务清理待刷新重试：' + result.error : '副本已创建，原世界保留。';
    } finally {
      targetLease?.release(); sourceLease?.release(); this.directoryBusy = false;
    }
    await this.renderWorldFolder();
    this.folderView?.showStatus(message);
  }

  private prepareCoreValidator(): Promise<void> {
    if (this.coreValidatorReady !== null) { return this.coreValidatorReady.then(() => {
      if (this.directoryCoreValidator) { this.coreStorage.bindValidator(this.directoryCoreValidator); }
    }); }
    const regularPath = this.regularChartUsesGuidance ? this.regularChartResourcePath : 'chart/chart_placeholder';
    if (this.regularChartUsesGuidance && !/^chart\/[\p{L}\p{N}_-]+(?:\/[\p{L}\p{N}_-]+)*$/u.test(regularPath)) {
      return Promise.reject(new Error('ChartResourcePath 须为 chart/ 下不含 .json 的资源路径'));
    }
    this.coreValidatorReady = Promise.all([
      new Promise<JsonAsset>((resolve, reject) => resources.load('world/primary-rain-dialogue', JsonAsset,
        (error, asset) => error || !asset ? reject(error ?? new Error('正式世界叙事内容缺失')) : resolve(asset))),
      new Promise<JsonAsset | null>((resolve, reject) => resources.load(regularPath, JsonAsset,
        (error, asset) => {
          if (!error && asset) { resolve(asset); }
          else if (this.regularChartUsesGuidance) { reject(error ?? new Error('正式常规谱面内容缺失')); }
          else { resolve(null); }
        })),
    ]).then(([asset, regularAsset]) => {
      const content = parseWorldNarrativeContent(asset.json);
      const layout = createDefaultKeyboardPadLayout();
      const regular = this.regularChartUsesGuidance ? parseGuidanceChart(regularAsset!.json, layout)
        : parseRegularChartIdentity(regularAsset?.json, layout.layoutVersion) ??
          { chartId: 'chart-placeholder-fallback', tier: 'Regular' };
      if (regular.tier !== 'Regular') { throw new Error('目录状态检验需要已验证的常规谱面身份'); }
      this.directoryCoreValidator = (raw, accountId, worldId) =>
        createPrimaryWorldStateCodec(accountId, worldId, content, regular.chartId).parse(raw, accountId, worldId);
      this.directoryCompleteValidator = (raw, accountId, worldId) =>
        createPrimaryWorldStateCodec(accountId, worldId, content, regular.chartId).parseComplete(raw, accountId, worldId);
      this.stateStorage.bindCompleteWriter({
        validate: raw => {
          const partial = this.coreStorage.validateCoreState(raw);
          return this.directoryCompleteValidator!(partial, partial.accountId, partial.worldId);
        },
        save: (snapshot, expected) => {
          const saved = this.coreStorage.saveCoreState(snapshot, expected);
          return this.directoryCompleteValidator!(saved, saved.accountId, saved.worldId);
        },
      });
      this.coreStorage.bindValidator(this.directoryCoreValidator);
    }).catch((error: unknown) => { this.coreValidatorReady = null; throw error; });
    return this.coreValidatorReady;
  }

  private showEditorFolder(): void {
    this.clearViews();
    this.catalogView = new EditorFolderView(editorCatalog, entry => this.openEditor(entry), () => this.showWorldFolder());
    this.catalogView.mount();
  }

  private createRuntime(name: string): Node {
    const node = new Node(name); node.layer = this.node.layer;
    const parentTransform = this.node.getComponent(UITransform) ?? this.node.parent?.getComponent(UITransform);
    node.addComponent(UITransform).setContentSize(parentTransform?.width ?? 1920, parentTransform?.height ?? 1080);
    const uiRoot = this.node.getComponent(Canvas) ? this.node : this.node.parent ?? this.node;
    uiRoot.addChild(node); this.runtimeNode = node; return node;
  }

  private async openWorld(entry: WorldFolderEntry): Promise<void> {
    if (this.retiring || this.runtimeNode || this.opening || this.directoryBusy) { return; }
    const accountId = this.startup.getStartupSnapshot().accountId;
    if (accountId === null) { return; }
    this.opening = true;
    let lease: WorldStateLease | null = null;
    try {
      await this.prepareCoreValidator();
      await this.recoverPendingFork(accountId);
      lease = await this.coreStorage.acquireWorldLease(accountId, entry.worldId);
      if (!isValid(this, true)) { lease.release(); return; }
      // Never trust an old card: re-read the account metadata immediately before opening.
      this.folderSession = this.loadFolderSession(accountId);
      const record = this.folderSession.getWorldRecord(entry.worldId);
      const stored = this.coreStorage.readValidatedCoreState(accountId, record.worldId);
      const isFork = stored?.forkOrigin !== undefined;
      if (isFork) { this.directoryCompleteValidator!(stored, accountId, record.worldId); }
      if ((record.template === 'InitialWorld' || isFork) && !this.worldFactory) { throw new Error('正式世界入口尚未接线'); }
      const runtime = this.createRuntime(record.worldId);
      this.runtimeLease = lease; lease = null;
      if (record.template === 'InitialWorld' || isFork) { this.worldFactory!(runtime, { accountId, worldId: record.worldId,
        coreStorage: this.coreStorage, lease: this.runtimeLease }); }
      else { runtime.addComponent(MinimalWorldBuilder).bindEntry(record); }
      this.clearViews();
    } catch (error) {
      if (this.runtimeNode) {
        this.exitRuntime();
        // Keep the existing folder and its error visible while deferred destruction finishes.
        this.folderPending = false;
      }
      this.folderView?.showStatus('世界未能打开：' + String(error));
      return;
    } finally { lease?.release(); this.opening = false; }
    this.showExitControl('退出世界 · 返回世界文件夹');
  }

  private openEditor(entry: EditorFolderEntry): void {
    if (this.retiring || this.runtimeNode || entry.availability !== 'Implemented' ||
        !['GuidanceEditor', 'MidiTrackEditor'].includes(entry.entryId)) { return; }
    this.clearViews();
    const runtime = this.createRuntime(entry.entryId);
    if (entry.entryId === 'MidiTrackEditor') { runtime.addComponent(MusicEditorBuilder); }
    else { runtime.addComponent(GuidanceEditorBuilder); }
    this.showExitControl('退出编辑器 · 返回世界文件夹');
  }

  private showExitControl(title: string): void {
    this.exitControl = document.createElement('button'); this.exitControl.id = 'folder-runtime-exit';
    this.exitControl.textContent = title;
    this.exitControl.style.cssText = 'position:fixed;right:18px;bottom:14px;z-index:300;padding:9px 16px;border:1px solid var(--folder-border);background:var(--folder-panel);color:var(--folder-ink);font:14px var(--folder-font);cursor:pointer;border-radius:4px';
    applyFolderTheme(this.exitControl);
    this.exitControl.onclick = () => this.exitRuntime(); document.body.appendChild(this.exitControl);
  }

  private exitRuntime(): void {
    if (!this.runtimeNode || this.retiring) { return; }
    this.retiring = true; this.exitControl?.remove(); this.exitControl = null;
    const runtime = this.runtimeNode; this.runtimeNode = null;
    // Deactivation stops FrameDriver/input synchronously; destruction removes media/DOM.
    runtime.active = false; runtime.destroy(); this.folderPending = true;
    director.once(Director.EVENT_AFTER_DRAW, this.finishRetirement, this);
  }

  private finishRetirement(): void {
    // Creator performs deferred destruction after update and before draw.
    this.retiring = false;
    this.runtimeLease?.release(); this.runtimeLease = null;
    const camera = this.node.getComponent(Canvas)?.cameraComponent ??
      this.node.parent?.getComponent(Canvas)?.cameraComponent ??
      this.node.getComponent(Camera) ?? this.node.parent?.getComponent(Camera);
    if (camera) { camera.clearFlags = Camera.ClearFlag.SOLID_COLOR; }
    if (this.folderPending && isValid(this, true)) { this.folderPending = false; this.showWorldFolder(); }
  }

  onDestroy(): void {
    this.crossDevicePrototype?.dispose(); this.crossDevicePrototype = null;
    director.off(Director.EVENT_AFTER_DRAW, this.finishRetirement, this);
    this.clearViews(); this.exitControl?.remove(); this.exitControl = null;
    if (this.runtimeNode && isValid(this.runtimeNode, true)) {
      this.runtimeNode.active = false; this.runtimeNode.destroy(); this.runtimeNode = null;
    }
    this.runtimeLease?.release(); this.runtimeLease = null;
  }
}

/** Match SceneBuilder's legacy ChartData resource boundary without loading a runtime. */
function parseRegularChartIdentity(raw: unknown, layoutVersion: string): { chartId: string; tier: string } | null {
  if (typeof raw !== 'object' || raw === null) { return null; }
  const source = raw as Record<string, unknown>;
  if (typeof source.chartId !== 'string' || source.chartId.length === 0 ||
      source.layoutVersion !== layoutVersion || !Array.isArray(source.notes)) { return null; }
  const keyIds = new Set<string>(CHART_KEY_IDS);
  for (const item of source.notes) {
    if (typeof item !== 'object' || item === null) { return null; }
    const note = item as Record<string, unknown>;
    if (typeof note.timeMs !== 'number' || !Number.isFinite(note.timeMs) || note.timeMs < 0 ||
        typeof note.keyId !== 'string' || !keyIds.has(note.keyId)) { return null; }
  }
  const tier = source.tier === 'Character' || source.tier === 'World' || source.tier === 'Final' ||
    source.tier === 'Regular' ? source.tier : 'Regular';
  return { chartId: source.chartId, tier };
}
