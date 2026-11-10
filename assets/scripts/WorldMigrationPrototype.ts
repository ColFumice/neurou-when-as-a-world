import { JsonAsset, resources } from 'cc';
import { OFFLINE_GRACE_HOURS } from './constants/index';
import { WorldMigrationCodec } from './src/director/WorldMigration';
import type { MigrationAuthorityPort, MigrationAdmission, RestrictedMigrationCorePayload } from './src/director/WorldMigration';
import { WorldStateCodec } from './src/director/WorldStateCodec';
import { validateTransferFolder } from './src/director/CoreTransfer';
import { validateCoreTransferContent } from './src/director/CoreTransferContent';
import { chartContentDigest } from './src/director/ChartArchive';
import { createAccountMilestoneReader } from './src/director/AccountMilestone';
import { AccountMilestoneStorage } from './src/presentation/AccountMilestoneStorage';
import { WorldMigrationContractAdapter } from './src/presentation/WorldMigrationContractAdapter';
import { WorldMigrationStorage } from './src/presentation/WorldMigrationStorage';
import { SafePointDrainStorage, isLiveSafePointDrainCapability } from './src/presentation/SafePointDrainStorage';
import { WorldCoreStateStorage } from './src/presentation/WorldCoreStateStorage';
import type { WorldStateLock } from './src/presentation/WorldCoreStateStorage';
import type { WorldFolderSnapshot } from './src/director/WorldFolderSession';
import type { WorldStateSnapshot } from './src/director/WorldStateSession';
import type { WorldClearRecord } from './src/director/RouteSignature';
import type { WorldRuntimeIdentity } from './WorldFolderBuilder';

export interface WorldMigrationPrototypeBindings {
  prepare(): Promise<void>;
  readFolder(accountId: string): WorldFolderSnapshot;
  readonly core: WorldCoreStateStorage;
  validateComplete(raw: unknown, accountId: string, worldId: string): WorldStateSnapshot;
  readClearRecords(accountId: string): readonly WorldClearRecord[];
  isIdle(): boolean;
  assertPending(accountId: string): void;
  openTarget(identity: WorldRuntimeIdentity): void;
  refresh(): void;
}

/** A separately controlled service fixture; production clients have no unlock command. */
export class ContractServiceClock {
  private readonly key = 'neurou-contract-service-clock-v1';
  now(): number {
    const text = localStorage.getItem(this.key);
    if (text === null) { localStorage.setItem(this.key, '0'); return 0; }
    const value: unknown = JSON.parse(text);
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) { throw Error('服务 fixture 时钟损坏'); }
    return value;
  }
  /** Acceptance harness advances service time explicitly, never the player's clock. */
  advanceServiceFixtureBy(milliseconds: number): void {
    if (!Number.isSafeInteger(milliseconds) || milliseconds < 0) { throw Error('服务 fixture 时钟增量无效'); }
    const value = this.now() + milliseconds;
    if (!Number.isSafeInteger(value)) { throw Error('服务 fixture 时钟溢出'); }
    localStorage.setItem(this.key, JSON.stringify(value));
  }
}

class MigrationDeviceStorage {
  getItem(key: string): string | null { return localStorage.getItem(this.key(key)); }
  setItem(key: string, text: string): void { localStorage.setItem(this.key(key), text); }
  private key(key: string): string { return 'neurou-contract-device-b:' + encodeURIComponent(key); }
}

/** Composition only: one persistent authority, two isolated logical world stores. */
export class WorldMigrationPrototype {
  readonly serviceClockFixture = new ContractServiceClock();
  readonly codec: WorldMigrationCodec;
  readonly authority: WorldMigrationContractAdapter;
  private readonly bStorage = new MigrationDeviceStorage();
  private readonly aLocks = migrationLocks();
  private readonly bLocks = migrationLocks('neurou-contract-device-b:');
  private readonly bCore: WorldCoreStateStorage;
  private accountId: string | null = null;
  private a: MigrationAuthorityPort | null = null;
  private b: MigrationAuthorityPort | null = null;
  private sourceJournal: WorldMigrationStorage | null = null;
  private targetJournal: WorldMigrationStorage | null = null;
  private manifest: unknown = null;
  private ready: Promise<void> | null = null;
  private panel: HTMLElement | null = null;
  private status: HTMLElement | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private closed = true;
  private draining = false;
  private drainingMigrationId: string | null = null;
  private runtimeDeviceId = 'logical-device-a';
  private runtimeWorldId: string | undefined;
  private migrationId: string | null = null;
  private busy = false;
  private alive = true;

  constructor(private readonly bindings: WorldMigrationPrototypeBindings) {
    const complete = (raw: unknown, account: string, world: string): WorldStateSnapshot => {
      if (!this.manifest) { throw Error('正式迁移内容清单尚未装配'); }
      const state = bindings.validateComplete(raw, account, world);
      validateCoreTransferContent(state, this.manifest); return state;
    };
    this.codec = new WorldMigrationCodec(complete);
    const c = this.codec;
    this.authority = new WorldMigrationContractAdapter({ serviceNow: () => this.serviceClockFixture.now(),
      offlineGraceMs: OFFLINE_GRACE_HOURS * 3600000,
      parseContext: raw => c.home.parseContext(raw), parseRegistrationRequest: raw => c.home.parseRegistrationRequest(raw),
      parseRegistry: (raw, account) => c.home.parseSnapshot(raw, account),
      parseRegistrationReply: (raw, context, request) => c.home.parseRegistrationReply(raw, context, request),
      parseConfirmation: (raw, context) => c.parseConfirmation(raw, context),
      parseDrainAcceptance: (raw, confirmation) => c.parseDrainAcceptance(raw, confirmation),
      parseReleaseRequest: raw => c.parseReleaseRequest(raw), parseClaimRequest: raw => c.parseClaimRequest(raw),
      parsePause: (raw, account) => c.parsePause(raw, account), parseDeviceBinding: (raw, device) => c.parseDeviceBinding(raw, device),
      parsePayload: raw => c.parsePayload(raw), parseReceipt: (raw, payload) => c.parseReceipt(raw, payload),
      parseAdmission: (raw, context, world) => c.parseAdmission(raw, context, world),
      verifyDrainCapability: isLiveSafePointDrainCapability, digestState: chartContentDigest,
    });
    this.bCore = new WorldCoreStateStorage(this.bStorage, this.bLocks, (raw, account, world) =>
      (raw as { worldKind?: unknown })?.worldKind === 'Unavailable'
        ? new WorldStateCodec().parse(raw, account, world) : complete(raw, account, world),
      (account, world) => account === this.accountId && this.readBFolder().records.some(r => r.worldId === world && r.deletedAt === null));
  }

  async checkLogin(accountId: string): Promise<void> {
    // Persistent authority validation may contain past payloads; prepare their real codecs first.
    await this.initialize();
    await this.authority.checkDeviceAccount({ accountId, deviceId: 'logical-device-a' });
  }
  async bindAccount(accountId: string): Promise<void> {
    await this.initialize();
    if (this.accountId !== null && this.accountId !== accountId) { throw Error('原型不可跨账号重用'); }
    if (this.accountId === null) {
      this.accountId = accountId;
      this.a = this.authority.bindDevice({ accountId, deviceId: 'logical-device-a' });
      this.b = this.authority.bindDevice({ accountId, deviceId: 'logical-device-b' });
      this.sourceJournal = this.createJournal(this.a, localStorage, this.aLocks, this.bindings.core);
      this.targetJournal = this.createJournal(this.b, this.bStorage, this.bLocks, this.bCore);
      const history = this.sourceJournal.readJournal(accountId)?.entries;
      this.migrationId = history?.[history.length - 1]?.payload.migrationId ?? null;
      this.timer = setInterval(() => { void this.poll().catch(() => { this.closed = true; }); }, 500);
    }
    await this.poll();
  }
  homeAuthority(): Pick<WorldMigrationContractAdapter, 'bindDevice'> { return this.authority; }
  setRuntimeContext(deviceId: string, worldId: string): void { this.runtimeDeviceId = deviceId; this.runtimeWorldId = worldId; }
  isRuntimeClosed(): boolean {
    if (this.closed || this.draining) { return true; }
    try { this.assertAdmissionNow(this.runtimeDeviceId, this.runtimeWorldId); return false; }
    catch { return true; }
  }
  assertAdmissionNow(deviceId: string, worldId?: string): void {
    if (!this.alive || !this.accountId || this.draining) { throw Error('账号准入已关闭或源正在排空'); }
    this.authority.assertAdmissionNow({ accountId: this.accountId, deviceId }, worldId);
    if (deviceId === 'logical-device-a' && this.sourceJournal?.readPending(this.accountId)) {
      throw Error('源迁移事务待对账；新活动准入已关闭');
    }
    if (deviceId === 'logical-device-a' && worldId) {
      const history = this.sourceJournal?.readJournal(this.accountId)?.entries.filter(e => e.role === 'Source' &&
        e.payload.state.worldId === worldId);
      if (history?.length) {
        // Loss of the service domain cannot turn a migrated source into an unregistered world.
        const raw = localStorage.getItem('neurou-migration-contract-authority-v1');
        const registry = raw === null ? null : (JSON.parse(raw) as { registries: readonly { accountId: string;
          records: readonly { worldId: string; homeDeviceId: string | null; homeState: string }[] }[] }).registries
          .find(r => r.accountId === this.accountId);
        const home = registry?.records.find(r => r.worldId === worldId);
        if (!home || home.homeState !== 'Homed' || home.homeDeviceId !== deviceId) { throw Error('去往别处；服务归属缺失或尚未对账'); }
      }
    }
  }
  async requireAdmission(deviceId: string, worldId?: string): Promise<void> {
    if (!this.alive || this.draining) { throw Error('账号准入已关闭或源正在排空'); }
    const authority = this.port(deviceId);
    const admission = this.codec.parseAdmission(await authority.readAdmission(worldId), authority.context, worldId);
    if (admission.kind !== 'Allowed') { throw Error(admission.kind === 'Migrated' ? '去往别处' : admission.kind + '：账号当前拒绝准入'); }
    this.assertAdmissionNow(deviceId, worldId);
  }
  async withAdmission<T>(deviceId: string, worldId: string | undefined, operation: () => Promise<T>): Promise<T> {
    await this.requireAdmission(deviceId, worldId);
    const locks = deviceId === 'logical-device-b' ? this.bLocks : this.aLocks;
    if (!locks || !this.accountId) { throw Error('无 Web Locks；账号新操作不可用'); }
    return locks.request('neurou-cross-device:' + encodeURIComponent(this.accountId), async () => {
      await this.requireAdmission(deviceId, worldId);
      return operation();
    });
  }

  private initialize(): Promise<void> {
    if (!this.ready) {
      this.ready = Promise.all([this.bindings.prepare(), new Promise<JsonAsset>((resolve, reject) =>
        resources.load('chart/content-manifest', JsonAsset, (error, asset) =>
          error || !asset ? reject(error ?? Error('正式迁移内容清单缺失')) : resolve(asset)))])
        .then(([, asset]) => { if (!this.alive) { throw Error('迁移宿主已销毁'); } this.manifest = asset.json; })
        .catch(error => { this.ready = null; throw error; });
    }
    return this.ready;
  }
  private port(deviceId: string): MigrationAuthorityPort {
    const port = deviceId === 'logical-device-b' ? this.b : this.a;
    if (!port) { throw Error('迁移账号尚未绑定'); } return port;
  }
  private createJournal(port: MigrationAuthorityPort, storage: Pick<Storage, 'getItem' | 'setItem'>,
    locks: WorldStateLock | null, core: WorldCoreStateStorage): WorldMigrationStorage {
    const c = this.codec;
    return new WorldMigrationStorage(storage, locks, { context: port.context, authority: port,
      validatePayload: raw => c.parsePayload(raw), validateJournal: raw => c.parseJournal(raw),
      validateFolder: validateTransferFolder, parseReceipt: (raw, payload) => c.parseReceipt(raw, payload),
      parseAdmission: (raw, context, world) => c.parseAdmission(raw, context, world),
      parseDrainAcceptance: (raw, confirmation) => c.parseDrainAcceptance(raw, confirmation),
      assertTargetLease: payload => { if (!core.hasWorldLease(payload.state.accountId, payload.state.worldId)) { throw Error('迁移目标真实 lease 缺失'); } },
      readTarget: (account, world) => core.readCoreState(account, world),
      validateCurrentTarget: (raw, account, world) => {
        const state = this.bindings.validateComplete(raw, account, world); validateCoreTransferContent(state, this.manifest); return state;
      },
      writeTarget: (state, expected) => {
        this.assertAdmissionNow(port.context.deviceId, state.worldId);
        if (expected !== null || !core.hasWorldLease(state.accountId, state.worldId)) { throw Error('迁移 Core CAS/真实 lease 无效'); }
        const candidate = this.bindings.validateComplete(state, state.accountId, state.worldId);
        validateCoreTransferContent(candidate, this.manifest);
        if (core.readCoreState(state.accountId, state.worldId) !== null) { throw Error('迁移目标 Core 已存在；未覆盖'); }
        storage.setItem(stateKey(state.accountId, state.worldId), JSON.stringify(candidate));
        if (chartContentDigest(core.readCoreState(state.accountId, state.worldId)) !== chartContentDigest(state)) { throw Error('迁移 Core 原值回读失败'); }
      },
      assertAdmissionNow: world => this.assertAdmissionNow(port.context.deviceId, world),
    });
  }

  private async release(worldId: string): Promise<void> {
    if (!this.accountId || !this.a || !this.sourceJournal || !this.bindings.isIdle()) { throw Error('请等待活动自然到达安全点并返回文件夹'); }
    const sourceAdmission = this.codec.parseAdmission(await this.a.readAdmission(worldId), this.a.context, worldId);
    if (sourceAdmission.kind !== 'Allowed') { throw Error(sourceAdmission.kind + '：迁移源当前拒绝准入'); }
    this.authority.assertAdmissionNow(this.a.context, worldId);
    const registration = { schemaVersion: 1 as const, worldId, registrationId: 'migration-home-' + crypto.randomUUID() };
    const home = this.codec.home.parseRegistrationReply(await this.a.registerWorldHome(registration), this.a.context, registration);
    if (home.kind === 'HomeConflict') { throw Error('HomeConflict：源设备不是 HomeDevice'); }
    const pending = this.sourceJournal.readPending(this.accountId);
    this.migrationId = pending?.phase === 'Prepared' ? pending.payload.migrationId : 'migration-' + crypto.randomUUID();
    if (pending && pending.phase !== 'Prepared') { throw Error('已有迁移待对账'); }
    this.drainingMigrationId = this.migrationId;
    const account = this.accountId;
    const drain = new SafePointDrainStorage({ context: this.a.context,
      withCoordination: operation => this.sourceJournal!.withMigrationLock(account, operation),
      holdAdmission: () => { this.draining = true; return {
        assertClosed: () => { if (!this.draining || !this.alive) { throw Error('源排空准入世代失效'); } },
        release: () => { this.draining = false; this.drainingMigrationId = null; },
      }; },
      assertRuntimeSafe: () => { if (!this.bindings.isIdle()) { throw Error('账号活动未排空；不能强退'); } },
      assertNoPendingTransactions: () => {
        this.bindings.assertPending(account);
        const entry = this.sourceJournal!.readPending(account);
        if (entry && (entry.phase !== 'Prepared' || entry.payload.migrationId !== this.drainingMigrationId)) { throw Error('迁移事务未结算'); }
      },
      readFolder: () => this.bindings.readFolder(account), validateFolder: validateTransferFolder,
      readCore: world => this.bindings.core.readCoreState(account, world),
      validateCore: (raw, a, w) => this.bindings.core.validateCoreState(raw),
      readAccountFacts: () => ({ records: this.bindings.readClearRecords(account),
        FirstWorldCleared: createAccountMilestoneReader(account, new AccountMilestoneStorage().readProjection(account)).getMilestoneSnapshot().FirstWorldCleared }),
      acquireWorldLease: world => this.bindings.core.acquireWorldLease(account, world, true),
      hasWorldLease: world => this.bindings.core.hasWorldLease(account, world), digest: chartContentDigest,
      validateConfirmation: raw => this.codec.parseConfirmation(raw, this.a!.context),
      createDrainId: () => 'drain-' + crypto.randomUUID(),
    }, this.aLocks);
    const receipt = await drain.withDrain(async capability => {
      const record = this.bindings.readFolder(account).records.find(r => r.worldId === worldId && r.deletedAt === null);
      if (!record) { throw Error('迁移源目录不存在'); }
      const payload = this.codec.parsePayload({ schemaVersion: 1, kind: 'RestrictedMigrationCore',
        migrationId: this.migrationId, sourceDeviceId: 'logical-device-a', expectedHomeRevision: home.record.homeRevision,
        record, state: this.bindings.core.readCoreState(account, worldId) });
      this.sourceJournal!.prepareSource(payload);
      return this.sourceJournal!.releaseSource(payload.migrationId, capability);
    });
    if (receipt.error) { throw Error(receipt.error); }
    await this.poll(); this.message('账号已暂停；源世界原值保留。等待服务冷静期结束。');
  }
  private async claim(): Promise<void> {
    if (!this.accountId || !this.migrationId || !this.targetJournal || !this.bindings.isIdle()) { throw Error('没有可认领迁移或活动未排空'); }
    await this.requireAdmission('logical-device-b');
    await this.initializeB();
    await this.targetJournal.withMigrationLock(this.accountId, async () => {
      const payload = await this.targetJournal!.readAuthoritativePayload(this.migrationId!);
      const lease = await this.bCore.acquireWorldLease(payload.state.accountId, payload.state.worldId, true);
      try {
        this.targetJournal!.prepareTarget(payload);
        const receipt = await this.targetJournal!.claimAndPublish(payload.migrationId);
        if (receipt.error) { throw Error(receipt.error); }
        this.message('B 已认领并发布同 ID 世界');
      } finally { lease.release(); }
    });
    await this.poll();
  }
  private async open(): Promise<void> {
    const account = this.accountId, id = this.migrationId;
    if (!account || !id || !this.targetJournal) { throw Error('尚无本地发布迁移'); }
    const payload = this.targetJournal.readJournal(account)?.entries.find(e => e.payload.migrationId === id)?.payload;
    if (!payload) { throw Error('尚无本地发布迁移'); }
    await this.withAdmission('logical-device-b', payload.state.worldId, async () => {
      const lease = await this.bCore.acquireWorldLease(account, payload.state.worldId, true);
      let transferred = false;
      try {
        await this.targetJournal!.assertCanOpen(account, payload.state.worldId);
        this.assertAdmissionNow('logical-device-b', payload.state.worldId);
        this.setRuntimeContext('logical-device-b', payload.state.worldId);
        this.bindings.openTarget({ accountId: account, worldId: payload.state.worldId, coreStorage: this.bCore, lease });
        transferred = true;
      } finally { if (!transferred) { lease.release(); } }
    });
  }
  private async reconcile(): Promise<void> {
    if (!this.accountId || !this.migrationId || !this.sourceJournal || !this.targetJournal) { return; }
    await this.sourceJournal.withMigrationLock(this.accountId, () => this.sourceJournal!.recover(this.accountId!, this.migrationId!));
    const target = this.targetJournal.readJournal(this.accountId)?.entries.find(e => e.payload.migrationId === this.migrationId);
    if (target) { await this.claim(); } else { await this.poll(); }
  }
  private readBFolder(): WorldFolderSnapshot {
    const text = this.bStorage.getItem(folderKey(this.accountId!));
    return validateTransferFolder(text === null ? null : JSON.parse(text), this.accountId!);
  }
  private async initializeB(): Promise<void> {
    if (!this.accountId || !this.targetJournal || this.bStorage.getItem(folderKey(this.accountId)) !== null) { return; }
    const account = this.accountId;
    await this.withAdmission('logical-device-b', undefined, async () => {
      const lease = await this.bCore.acquireWorldLease(account, 'InitialWorld', true);
      try {
        if (!this.bLocks) { throw Error('无 Web Locks'); }
        await this.bLocks.request('neurou-world-folder:' + encodeURIComponent(account), async () => {
          this.assertAdmissionNow('logical-device-b');
          if (this.bStorage.getItem(folderKey(account)) !== null) { return; }
          const current = this.bCore.readCoreState(account, 'InitialWorld');
          const state = current === null ? { schemaVersion: 1, accountId: account, worldId: 'InitialWorld', worldKind: 'Unavailable',
            shoreOrigin: 'Unavailable', revision: 0, capturedAt: 0, kind: 'Core', sections: { Ledger: null, PuzzleProgress: null, FormatTime: { epochMs: 0 } } }
            : new WorldStateCodec().parse(current, account, 'InitialWorld');
          if (state.worldKind !== 'Unavailable' || state.revision !== 0 || Object.keys(state.sections).length !== 3) { throw Error('B 初始 Core 碰撞'); }
          if (current === null) { this.bStorage.setItem(stateKey(account, 'InitialWorld'), JSON.stringify(state)); }
          this.bStorage.setItem(folderKey(account), JSON.stringify(validateTransferFolder({ schemaVersion: 1, accountId: account,
            records: [{ worldId: 'InitialWorld', title: 'InitialWorld', description: '', createdAt: state.sections.FormatTime!.epochMs,
              deletedAt: null, template: 'InitialWorld' }] }, account)));
        });
      } finally { lease.release(); }
    });
  }
  private async poll(): Promise<void> {
    if (!this.a || !this.accountId || !this.alive) { return; }
    let admission: MigrationAdmission;
    try { admission = this.codec.parseAdmission(await this.a.readAdmission(), this.a.context); }
    catch (error) { this.closed = true; this.message('服务不可用：' + String(error)); throw error; }
    this.closed = admission.kind !== 'Allowed';
    if (admission.pause) {
      localStorage.setItem('neurou-reality-pause-v1:' + encodeURIComponent(this.accountId), JSON.stringify(admission.pause));
    }
    if (this.panel) {
      this.panel.dataset.admission = admission.kind;
      if (this.migrationId) {
        this.panel.dataset.migrationId = this.migrationId;
        const raw = await this.a.readMigration(this.migrationId);
        if (raw) {
          const receipt = this.codec.parseReceipt(raw); this.panel.dataset.phase = receipt.kind;
          this.panel.dataset.worldId = receipt.worldId;
          this.panel.dataset.homeDeviceId = receipt.record.homeDeviceId ?? '';
          if (receipt.kind === 'PauseActive') { this.message('全账号冷静期 · 服务尚未解除 · 所有设备拒绝新进入'); }
        }
      }
    }
  }

  mount(): void {
    this.unmount();
    if (!this.accountId) { return; }
    const panel = document.createElement('section'); panel.id = 'world-migration-prototype';
    panel.dataset.mode = 'ContractAdapter'; panel.dataset.prototype = 'RestrictedMigrationCore';
    panel.style.cssText = 'position:fixed;left:24px;bottom:62px;z-index:225;width:min(410px,90vw);padding:14px;border:1px solid #657779;border-radius:5px;background:#102c32;color:#e3f0ec;font:14px sans-serif;box-sizing:border-box';
    const title = document.createElement('strong'); title.textContent = '世界迁移 · 同 ID · 两个逻辑设备'; panel.appendChild(title);
    const note = document.createElement('p'); note.textContent = 'A 主动排空后进入全账号冷静期，服务解除后由 B 认领。ContractAdapter 使用受控服务时钟。'; panel.appendChild(note);
    const select = document.createElement('select'); select.id = 'world-migration-source';
    select.style.cssText = 'width:100%;padding:6px';
    for (const record of this.bindings.readFolder(this.accountId).records.filter(r => r.worldId !== 'InitialWorld' && r.deletedAt === null)) {
      const option = document.createElement('option'); option.value = record.worldId; option.textContent = record.title; select.appendChild(option);
    }
    panel.appendChild(select);
    const operations: [string, string, () => Promise<void>][] = [
      ['world-migration-release', 'A · 排空并迁移', () => this.release(select.value)],
      ['world-migration-refresh', '查询服务状态', () => this.poll()],
      ['world-migration-claim', 'B · 认领同 ID', () => this.claim()],
      ['world-migration-open', 'B · 打开迁移世界', () => this.open()],
      ['world-migration-recover', '迁移对账', () => this.reconcile()],
    ];
    for (const [id, label, operation] of operations) {
      const button = document.createElement('button'); button.id = id; button.textContent = label;
      button.style.cssText = 'padding:7px;margin:3px;cursor:pointer';
      button.onclick = () => { void this.run(operation); }; panel.appendChild(button);
    }
    this.status = document.createElement('p'); this.status.id = 'world-migration-status';
    this.status.textContent = '同 ID 原值迁移 · 源世界保留'; panel.appendChild(this.status);
    document.body.appendChild(panel); this.panel = panel; void this.poll().catch(() => undefined);
  }
  private async run(operation: () => Promise<void>): Promise<void> {
    if (this.busy || !this.bindings.isIdle() || !this.alive) { this.message('等待活动自然到达安全点并返回文件夹'); return; }
    this.busy = true;
    if (this.panel) { delete this.panel.dataset.error; }
    try { await operation(); }
    catch (error) { this.message(String(error)); if (this.panel) { this.panel.dataset.error = String(error); } }
    finally { this.busy = false; }
  }
  private message(value: string): void { if (this.status) { this.status.textContent = value; } }
  unmount(): void { this.panel?.remove(); this.panel = null; this.status = null; }
  dispose(): void { this.alive = false; this.unmount(); if (this.timer) { clearInterval(this.timer); this.timer = null; } }
}
function stateKey(account: string, world: string): string { return 'neurou-world-state-v1:' + encodeURIComponent(account) + ':' + encodeURIComponent(world); }
function folderKey(account: string): string { return 'neurou-world-folder-v1:' + encodeURIComponent(account); }
function migrationLocks(prefix = ''): WorldStateLock | null {
  if (typeof navigator === 'undefined' || !navigator.locks) { return null; }
  return { request: (name, operation) => navigator.locks.request(prefix + name, { mode: 'exclusive' }, operation),
    requestIfAvailable: (name, operation) => navigator.locks.request(prefix + name, { mode: 'exclusive', ifAvailable: true }, lock => {
      if (!lock) { throw Error('世界已被占用；等待真实安全点'); } return operation();
    }) };
}
