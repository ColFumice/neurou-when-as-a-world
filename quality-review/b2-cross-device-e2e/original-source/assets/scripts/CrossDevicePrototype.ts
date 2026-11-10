import { JsonAsset, resources } from 'cc';
import { CoreTransferCodec, CrossDeviceImportAdapter, validateTransferFolder } from './src/director/CoreTransfer';
import type { CoreTransferPayload, CrossDeviceAuthorityPort } from './src/director/CoreTransfer';
import { validateCoreTransferContent } from './src/director/CoreTransferContent';
import { WorldHomeRegistryCodec, WorldHomeRegistrySession } from './src/director/WorldHomeRegistry';
import { WorldHomeContractAdapter } from './src/presentation/WorldHomeContractAdapter';
import { CrossDeviceContractAdapter } from './src/presentation/CrossDeviceContractAdapter';
import { CrossDeviceImportStorage } from './src/presentation/CrossDeviceImportStorage';
import { WorldCoreStateStorage } from './src/presentation/WorldCoreStateStorage';
import type { WorldStateLease, WorldStateLock } from './src/presentation/WorldCoreStateStorage';
import { WorldStateCodec } from './src/director/WorldStateCodec';
import { WorldFolderSession } from './src/director/WorldFolderSession';
import type { WorldFolderSnapshot } from './src/director/WorldFolderSession';
import type { WorldStateSnapshot } from './src/director/WorldStateSession';
import type { AccountMilestoneReader } from './src/director/AccountMilestone';
import { chartContentDigest } from './src/director/ChartArchive';
import type { WorldRuntimeIdentity } from './WorldFolderBuilder';

export interface CrossDevicePrototypeBindings {
  readonly accountId: string;
  readonly readSourceFolder: () => WorldFolderSnapshot;
  readonly readSource: (worldId: string) => WorldStateSnapshot;
  readonly acquireSourceLease: (worldId: string) => Promise<WorldStateLease>;
  readonly milestoneReader: AccountMilestoneReader;
  readonly validateComplete: (raw: unknown, accountId: string, worldId: string) => WorldStateSnapshot;
  readonly isIdle: () => boolean;
  readonly openTarget: (identity: WorldRuntimeIdentity) => void;
  readonly homeAuthority?: Pick<WorldHomeContractAdapter, 'bindDevice'>;
  readonly withAdmission?: <T>(deviceId: string, worldId: string | undefined, operation: () => Promise<T>) => Promise<T>;
  readonly assertAdmissionNow?: (deviceId: string, worldId?: string) => void;
}

/** Two logical devices in one realm. Only world/journal keys are namespaced for B. */
class LogicalDeviceStorage {
  getItem(key: string): string | null { return localStorage.getItem(this.key(key)); }
  setItem(key: string, value: string): void { localStorage.setItem(this.key(key), value); }
  removeItem(key: string): void { localStorage.removeItem(this.key(key)); }
  private key(key: string): string { return 'neurou-contract-device-b:' + encodeURIComponent(key); }
}

/** Additive production composition. Account facts are a shared read port, never payload data. */
export class CrossDevicePrototype {
  private panel: HTMLElement | null = null;
  private status: HTMLElement | null = null;
  private payload: CoreTransferPayload | null = null;
  private lastTarget: string | null = null;
  private busy = false;
  private readonly bStorage = new LogicalDeviceStorage();
  private readonly reservations = new Set<string>();
  private readonly homeCodec = new WorldHomeRegistryCodec();
  private readonly codec: CoreTransferCodec;
  private readonly homes: WorldHomeContractAdapter;
  private readonly authority: CrossDeviceContractAdapter;
  private readonly a: CrossDeviceAuthorityPort;
  private readonly b: CrossDeviceAuthorityPort;
  private readonly imports: CrossDeviceImportAdapter;
  private readonly bCore: WorldCoreStateStorage;
  private readonly importStorage: CrossDeviceImportStorage;
  private manifest: unknown = null;
  private ready: Promise<void> | null = null;
  private serverTick = 0;
  private alive = true;

  constructor(private readonly bindings: CrossDevicePrototypeBindings) {
    const validateComplete = (raw: unknown, accountId: string, worldId: string): WorldStateSnapshot => {
      if (!this.manifest) { throw new Error('正式传输内容清单尚未装配'); }
      const state = bindings.validateComplete(raw, accountId, worldId);
      validateCoreTransferContent(state, this.manifest); return state;
    };
    this.codec = new CoreTransferCodec(validateComplete);
    this.homes = new WorldHomeContractAdapter({ now: () => ++this.serverTick,
      validateContext: raw => this.homeCodec.parseContext(raw), validateRequest: raw => this.homeCodec.parseRegistrationRequest(raw),
      validateSnapshot: (raw, account) => this.homeCodec.parseSnapshot(raw, account),
      validateReply: (raw, context, request) => this.homeCodec.parseRegistrationReply(raw, context, request) });
    this.authority = new CrossDeviceContractAdapter(bindings.homeAuthority ?? this.homes, { parsePayload: raw => this.codec.parsePayload(raw),
      parseProof: (raw, payload) => this.codec.parseProof(raw, payload), parseContext: raw => this.homeCodec.parseContext(raw),
      parseRegistry: (raw, account) => this.homeCodec.parseSnapshot(raw, account), digestState: state => chartContentDigest(state) });
    this.a = this.authority.bindDevice({ accountId: bindings.accountId, deviceId: 'logical-device-a' });
    this.b = this.authority.bindDevice({ accountId: bindings.accountId, deviceId: 'logical-device-b' });
    this.imports = new CrossDeviceImportAdapter(this.b.context, { authority: this.b, milestoneReader: bindings.milestoneReader,
      validateComplete, createWorldId: () => 'world-' + crypto.randomUUID(), createTransactionId: () => 'import-' + crypto.randomUUID(),
      createRegistrationId: () => 'registration-' + crypto.randomUUID(), now: Date.now });
    const locks = prototypeLocks();
    this.bCore = new WorldCoreStateStorage(this.bStorage, locks, (raw, account, world) => {
      if ((raw as { worldKind?: unknown } | null)?.worldKind === 'Unavailable') { return new WorldStateCodec().parse(raw, account, world); }
      return validateComplete(raw, account, world);
    }, (account, world) => account === bindings.accountId && (this.reservations.has(world) ||
      this.readBFolder().records.some(record => record.worldId === world && record.deletedAt === null)));
    this.importStorage = new CrossDeviceImportStorage(this.bStorage, locks, {
      context: this.b.context, authority: this.b,
      validatePlan: raw => this.codec.parsePlan(raw), validateJournal: raw => this.codec.parseJournal(raw),
      validateFolder: (raw, account) => validateTransferFolder(raw, account),
      parseRegistrationReply: (raw, context, request) => this.homeCodec.parseRegistrationReply(raw, context, request),
      parseRegistry: (raw, account) => this.homeCodec.parseSnapshot(raw, account),
      assertTargetLease: plan => {
        this.assertAlive();
        bindings.assertAdmissionNow?.('logical-device-b');
        if (!this.bCore.hasWorldLease(plan.accountId, plan.targetWorldId)) { throw new Error('真实导入目标 lease 缺失'); }
      },
      readTarget: (account, world) => this.bCore.readCoreState(account, world),
      validateCurrentTarget: validateComplete,
      writeTarget: state => {
        this.assertAlive();
        this.reservations.add(state.worldId);
        try { this.bCore.saveCoreState(state, null); } finally { this.reservations.delete(state.worldId); }
      },
      verifyAuthoritySource: async plan => {
        this.assertAlive();
        this.imports.requirePermission();
        await this.imports.verifyAuthoritySource(plan.payload);
        this.assertAlive();
      },
    });
  }

  mount(): void {
    this.assertAlive();
    this.unmount();
    const panel = document.createElement('section'); panel.id = 'cross-device-prototype';
    panel.dataset.mode = 'ContractAdapter'; panel.dataset.prototype = 'RestrictedCoreTransfer';
    panel.style.cssText = 'position:fixed;right:24px;bottom:62px;z-index:220;width:min(390px,90vw);padding:14px;border:1px solid #657779;border-radius:5px;background:#102c32;color:#e3f0ec;font:14px sans-serif;box-sizing:border-box';
    const title = document.createElement('strong'); title.textContent = '受限 Core 原型 · 两个逻辑设备'; panel.appendChild(title);
    const note = document.createElement('p'); note.textContent = 'A 发送自己创建的世界，B 复制为新世界。'; panel.appendChild(note);
    const select = document.createElement('select'); select.id = 'cross-device-source'; select.style.cssText = 'width:100%;padding:6px;margin-bottom:8px';
    for (const record of this.bindings.readSourceFolder().records.filter(record => record.worldId !== 'InitialWorld' && record.deletedAt === null)) {
      const option = document.createElement('option'); option.value = record.worldId; option.textContent = record.title; select.appendChild(option);
    }
    panel.appendChild(select);
    const controls: [string, string, () => Promise<void>][] = [
      ['cross-device-export', 'A · 发送选定世界', () => this.exportSource(select.value)],
      ['cross-device-import', 'B · 导入副本', () => this.importTarget()],
      ['cross-device-open', 'B · 打开导入世界', () => this.openTarget()],
      ['cross-device-recover', 'B · 恢复导入', () => this.recover()],
    ];
    for (const [id, label, operation] of controls) {
      const button = document.createElement('button'); button.id = id; button.textContent = label;
      button.style.cssText = 'padding:7px;margin:3px;cursor:pointer';
      button.onclick = () => { void this.run(operation); }; panel.appendChild(button);
    }
    this.status = document.createElement('p'); this.status.id = 'cross-device-status'; this.status.textContent = 'ContractAdapter · 仅传输七项 Core';
    panel.appendChild(this.status); document.body.appendChild(panel); this.panel = panel;
    if (this.lastTarget) { panel.dataset.targetWorldId = this.lastTarget; }
    void this.initialize().catch(error => this.message(String(error)));
  }
  unmount(): void { this.panel?.remove(); this.panel = null; this.status = null; }
  dispose(): void { this.alive = false; this.unmount(); }
  private assertAlive(): void { if (!this.alive) { throw Error('原型宿主已销毁；导入保留日志等待恢复'); } }
  private message(value: string): void { if (this.status) { this.status.textContent = value; } }
  private async run(operation: () => Promise<void>): Promise<void> {
    if (this.busy || !this.bindings.isIdle()) { this.message('请返回世界文件夹后重试'); return; }
    this.busy = true;
    try { this.assertAlive(); await this.initialize(); this.assertAlive(); await operation(); }
    catch (error) { this.message(String(error)); if (this.panel) { this.panel.dataset.error = String(error); } }
    finally { this.busy = false; }
  }
  private initialize(): Promise<void> {
    if (this.ready) { return this.ready; }
    this.ready = new Promise<JsonAsset>((resolve, reject) => resources.load('chart/content-manifest', JsonAsset,
      (error, asset) => error || !asset ? reject(error ?? Error('正式内容清单缺失')) : resolve(asset)))
      .then(async asset => {
        this.assertAlive();
        this.manifest = asset.json;
        if (this.bStorage.getItem(this.folderKey()) !== null) { return; }
        this.bindings.assertAdmissionNow?.('logical-device-b');
        await this.importStorage.withImportLock(this.bindings.accountId, async () => {
          this.assertAlive();
          const lease = await this.bCore.acquireWorldLease(this.bindings.accountId, 'InitialWorld', true);
          try {
            this.assertAlive();
            const locks = prototypeLocks(); if (!locks) { throw Error('无 Web Locks；未初始化 B'); }
            await locks.request('neurou-world-folder:' + encodeURIComponent(this.bindings.accountId), async () => {
              this.assertAlive();
              this.bindings.assertAdmissionNow?.('logical-device-b');
              if (this.bStorage.getItem(this.folderKey()) !== null) { return; }
              const previous = this.bCore.readValidatedCoreState(this.bindings.accountId, 'InitialWorld');
              if (previous && (previous.revision !== 0 || previous.worldKind !== 'Unavailable' || previous.shoreOrigin !== 'Unavailable' ||
                  previous.forkOrigin || previous.sections.Ledger !== null || previous.sections.PuzzleProgress !== null ||
                  Object.keys(previous.sections).length !== 3 || !previous.sections.FormatTime ||
                  previous.capturedAt !== previous.sections.FormatTime.epochMs)) {
                throw Error('B 初始暂存与初始化协议不符；保留原数据');
              }
              const now = previous?.sections.FormatTime?.epochMs ?? Date.now();
              if (!previous) {
                this.reservations.add('InitialWorld');
                try { this.bCore.saveCoreState({ schemaVersion: 1, accountId: this.bindings.accountId, worldId: 'InitialWorld',
                  worldKind: 'Unavailable', shoreOrigin: 'Unavailable', revision: 0, capturedAt: now, kind: 'Core',
                  sections: { Ledger: null, PuzzleProgress: null, FormatTime: { epochMs: now } } }, null); }
                finally { this.reservations.delete('InitialWorld'); }
              }
              new WorldFolderSession(this.bindings.accountId, null,
                snapshot => this.bStorage.setItem(this.folderKey(), JSON.stringify(snapshot)), () => { throw Error('初始化不分配UUID'); }, () => now);
            });
          } finally { lease.release(); }
        });
      }).catch(error => { this.ready = null; throw error; });
    return this.ready;
  }
  private async exportSource(worldId: string): Promise<void> {
    if (this.bindings.withAdmission) {
      return this.bindings.withAdmission('logical-device-a', worldId, () => this.exportSourceAdmitted(worldId));
    }
    return this.exportSourceAdmitted(worldId);
  }
  private async exportSourceAdmitted(worldId: string): Promise<void> {
    if (!worldId || worldId === 'InitialWorld') { throw Error('请选择 A 自己创建或分叉的世界'); }
    const lease = await this.bindings.acquireSourceLease(worldId);
    try {
      this.assertAlive();
      const folder = this.bindings.readSourceFolder();
      if (!folder.records.some(record => record.worldId === worldId && record.deletedAt === null)) { throw Error('来源目录资格无效'); }
      const source = this.bindings.readSource(worldId);
      const home = new WorldHomeRegistrySession(this.a.context, { authority: this.a, readFolder: () => this.bindings.readSourceFolder(),
        createRegistrationId: () => 'export-home-' + crypto.randomUUID() });
      const result = await home.registerWorldHome(worldId);
      this.assertAlive();
      if (result.kind !== 'Registered' && result.kind !== 'AlreadyHomed') { throw Error(result.kind + ': 来源归属未确认'); }
      const payload = this.codec.parsePayload({ schemaVersion: 1, kind: 'RestrictedCoreTransfer', transferId: 'transfer-' + crypto.randomUUID(),
        sourceDeviceId: this.a.context.deviceId, sourceHomeRevision: 1, state: JSON.parse(JSON.stringify(source)) as unknown });
      this.codec.parseProof(await this.a.publishTransfer(payload), payload);
      this.assertAlive();
      this.payload = payload; if (this.panel) { this.panel.dataset.sourceWorldId = worldId; }
      this.message('A 已发送七项 Core；源世界保持原值');
    } finally { lease.release(); }
  }
  private async importTarget(): Promise<void> {
    if (this.bindings.withAdmission) {
      return this.bindings.withAdmission('logical-device-b', undefined, () => this.importTargetAdmitted());
    }
    return this.importTargetAdmitted();
  }
  private async importTargetAdmitted(): Promise<void> {
    if (!this.payload) { throw Error('请先由 A 发送世界'); }
    await this.importStorage.withImportLock(this.bindings.accountId, async () => {
      this.assertAlive();
      if (this.importStorage.readPending(this.bindings.accountId)) { throw Error('已有导入待恢复'); }
      const plan = await this.imports.prepareImport(this.payload!, { schemaVersion: 1, title: '跨设备副本', description: '受限 Core 原型' }, this.readBFolder());
      this.assertAlive();
      const lease = await this.bCore.acquireWorldLease(plan.accountId, plan.targetWorldId, true);
      try {
        this.assertAlive();
        this.importStorage.prepare(plan);
        const receipt = await this.importStorage.registerAndPublish(plan);
        this.lastTarget = plan.targetWorldId;
        if (this.panel) { this.panel.dataset.targetWorldId = plan.targetWorldId; this.panel.dataset.receipt = receipt.kind; }
        this.message(receipt.kind === 'Published' ? 'B 已发布新世界 · 七项继承' : 'B 导入待恢复：' + receipt.error);
      } finally { lease.release(); }
    });
  }
  private async recover(): Promise<void> {
    if (this.bindings.withAdmission) {
      return this.bindings.withAdmission('logical-device-b', undefined, () => this.recoverAdmitted());
    }
    return this.recoverAdmitted();
  }
  private async recoverAdmitted(): Promise<void> {
    await this.importStorage.withImportLock(this.bindings.accountId, async () => {
      this.assertAlive();
      const pending = this.importStorage.readPending(this.bindings.accountId);
      const journal = this.importStorage.readJournal(this.bindings.accountId);
      const plan = pending?.plan ?? journal?.entries.find(entry => entry.plan.targetWorldId === this.lastTarget)?.plan;
      if (!plan) { this.message('没有待恢复的导入'); return; }
      const lease = await this.bCore.acquireWorldLease(plan.accountId, plan.targetWorldId, true);
      try { const receipt = await this.importStorage.recover(plan.accountId, plan.targetWorldId);
        this.lastTarget = plan.targetWorldId; this.message('B 对账结果：' + receipt.kind); }
      finally { lease.release(); }
    });
  }
  private async openTarget(): Promise<void> {
    if (this.bindings.withAdmission) {
      return this.bindings.withAdmission('logical-device-b', this.lastTarget ?? undefined, () => this.openTargetAdmitted());
    }
    return this.openTargetAdmitted();
  }
  private async openTargetAdmitted(): Promise<void> {
    this.assertAlive();
    if (!this.lastTarget) { throw Error('尚未导入世界'); }
    const lease = await this.bCore.acquireWorldLease(this.bindings.accountId, this.lastTarget, true);
    let transferred = false;
    try {
      await this.importStorage.assertCanOpen(this.bindings.accountId, this.lastTarget);
      this.bindings.assertAdmissionNow?.('logical-device-b', this.lastTarget);
      this.assertAlive();
      this.bindings.openTarget({ accountId: this.bindings.accountId, worldId: this.lastTarget, coreStorage: this.bCore, lease });
      transferred = true;
    } finally { if (!transferred) { lease.release(); } }
  }
  private readBFolder(): WorldFolderSnapshot {
    const bytes = this.bStorage.getItem(this.folderKey());
    return validateTransferFolder(bytes === null ? null : JSON.parse(bytes) as unknown, this.bindings.accountId);
  }
  private folderKey(): string { return 'neurou-world-folder-v1:' + encodeURIComponent(this.bindings.accountId); }
}
function prototypeLocks(): WorldStateLock | null {
  if (typeof navigator === 'undefined' || !navigator.locks) { return null; }
  return {
    request: <T>(name: string, operation: () => Promise<T>): Promise<T> => navigator.locks.request('neurou-contract-device-b:' + name, { mode: 'exclusive' }, operation),
    requestIfAvailable: <T>(name: string, operation: () => Promise<T>): Promise<T> => navigator.locks.request('neurou-contract-device-b:' + name,
      { mode: 'exclusive', ifAvailable: true }, lock => { if (!lock) { throw Error('B 世界已被占用'); } return operation(); }),
  };
}
