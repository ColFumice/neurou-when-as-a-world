/** Versioned configuration data only. This module never calls an AI service. */
export type AIProviderConfiguration =
  | { readonly providerId: string; readonly kind: 'CloudProvider'; readonly model: string;
      readonly endpoint: string; readonly credentialRef: string; readonly systemPrompt: string }
  | { readonly providerId: string; readonly kind: 'LocalProvider'; readonly model: string;
      readonly modelRevision: string; readonly systemPrompt: string }
  | { readonly providerId: string; readonly kind: 'TemplateProvider'; readonly contentId: string;
      readonly contentRevision: string; readonly templates: readonly { readonly templateId: string; readonly text: string }[] };

export interface AIProfile {
  readonly schemaVersion: 1;
  readonly profileId: string;
  readonly revision: string;
  readonly providers: readonly AIProviderConfiguration[];
  readonly taskRoutes: readonly {
    readonly task: 'Narrative' | 'Dialogue' | 'RealityHint' | 'OutputValidation';
    readonly fallbackChain: readonly string[];
  }[];
}

export interface AIProfileSnapshot {
  readonly schemaVersion: 1;
  readonly sourceWorldId: string;
  readonly capturedAt: number;
  readonly profile: AIProfile;
}

export interface WorldLinkContext {
  readonly accountId: string;
  readonly worldId: string;
  readonly worldKind: 'Primary' | 'Shore';
  readonly shoreOrigin: null | 'BugShore' | 'FinalShore';
  readonly protagonistCharacterId: string;
  /** Must come from the authoritative Shore identity, never from the saved link. */
  readonly sourceWorldId?: string;
}

interface WorldLinkIdentity {
  readonly schemaVersion: 1;
  readonly accountId: string;
  readonly worldId: string;
  readonly protagonistCharacterId: string;
}

export type WorldLinkSnapshot =
  | (WorldLinkIdentity & { readonly kind: 'NotApplicable'; readonly worldKind: 'Primary'; readonly shoreOrigin: null })
  | (WorldLinkIdentity & { readonly kind: 'NotApplicable'; readonly worldKind: 'Shore'; readonly shoreOrigin: 'FinalShore' })
  | (WorldLinkIdentity & { readonly kind: 'Linked'; readonly worldKind: 'Shore'; readonly shoreOrigin: 'BugShore';
      readonly sourceWorldId: string; readonly linkState: 'Bound' | 'Orphaned'; readonly aiProfileSnapshot: AIProfileSnapshot });

export type WorldLinkSource =
  | { readonly kind: 'Present'; readonly accountId: string; readonly worldId: string;
      readonly worldKind: 'Primary'; readonly profile: AIProfile }
  | { readonly kind: 'Deleted'; readonly accountId: string; readonly worldId: string }
  | { readonly kind: 'Unknown'; readonly accountId: string; readonly worldId: string };
export type WorldLinkSourceReader = (sourceWorldId: string) => WorldLinkSource;

/** Strict, pure validation. A known tombstone derives Orphaned without writing. */
export function validateWorldLinkSnapshot(
  raw: unknown, context: WorldLinkContext, readSource?: WorldLinkSourceReader,
): WorldLinkSnapshot {
  validateContext(context);
  if (context.shoreOrigin !== 'BugShore') {
    const value = fields(raw, ['schemaVersion', 'accountId', 'worldId', 'protagonistCharacterId', 'kind', 'worldKind', 'shoreOrigin']);
    matchIdentity(value, context);
    if (value.kind !== 'NotApplicable' || value.worldKind !== context.worldKind || value.shoreOrigin !== context.shoreOrigin) {
      throw new Error('WorldLink 不适用声明与权威世界身份不一致');
    }
    return notApplicable(context);
  }
  const value = fields(raw, ['schemaVersion', 'accountId', 'worldId', 'protagonistCharacterId', 'kind', 'worldKind',
    'shoreOrigin', 'sourceWorldId', 'linkState', 'aiProfileSnapshot']);
  matchIdentity(value, context);
  if (value.kind !== 'Linked' || value.worldKind !== 'Shore' || value.shoreOrigin !== 'BugShore' ||
      value.sourceWorldId !== context.sourceWorldId || (value.linkState !== 'Bound' && value.linkState !== 'Orphaned')) {
    throw new Error('WorldLink 单层来源或状态与权威彼岸身份不一致');
  }
  const saved = fields(value.aiProfileSnapshot, ['schemaVersion', 'sourceWorldId', 'capturedAt', 'profile']);
  if (saved.schemaVersion !== 1 || saved.sourceWorldId !== context.sourceWorldId) { throw new Error('AI 配置快照来源或版本不匹配'); }
  integer(saved.capturedAt, 'AI 配置快照时刻');
  const profile = validateAIProfile(saved.profile);
  const source = readKnownSource(context, readSource);
  // Once orphaned, reappearance/reuse of an ID cannot rebind or refresh its profile.
  const linkState = value.linkState === 'Orphaned' || source.kind === 'Deleted' ? 'Orphaned' : 'Bound';
  return Object.freeze({ schemaVersion: 1, accountId: context.accountId, worldId: context.worldId,
    protagonistCharacterId: context.protagonistCharacterId, kind: 'Linked', worldKind: 'Shore', shoreOrigin: 'BugShore',
    sourceWorldId: context.sourceWorldId!, linkState,
    aiProfileSnapshot: Object.freeze({ schemaVersion: 1, sourceWorldId: context.sourceWorldId!, capturedAt: saved.capturedAt, profile }) });
}

/** A profile is complete data under schema v1; unknown fields/providers are rejected. */
export function validateAIProfile(raw: unknown): AIProfile {
  const value = fields(raw, ['schemaVersion', 'profileId', 'revision', 'providers', 'taskRoutes']);
  if (value.schemaVersion !== 1) { throw new Error('AI 配置版本不受支持'); }
  const profileId = text(value.profileId, 'AI 配置标识'); const revision = text(value.revision, 'AI 配置版本');
  const providers: AIProviderConfiguration[] = []; const providerIds = new Set<string>();
  for (const rawProvider of array(value.providers)) {
    const kind = data(rawProvider).kind;
    let provider: AIProviderConfiguration;
    if (kind === 'CloudProvider') {
      const item = fields(rawProvider, ['providerId', 'kind', 'model', 'endpoint', 'credentialRef', 'systemPrompt']);
      const endpoint = text(item.endpoint, '云端接口地址', 2048);
      if (!/^https:\/\//u.test(endpoint)) { throw new Error('云端接口必须使用 https 地址'); }
      provider = Object.freeze({ providerId: text(item.providerId, 'AI 提供方标识'), kind,
        model: text(item.model, '模型'), endpoint, credentialRef: text(item.credentialRef, '凭据引用'),
        systemPrompt: text(item.systemPrompt, '系统提示', 65536) });
    } else if (kind === 'LocalProvider') {
      const item = fields(rawProvider, ['providerId', 'kind', 'model', 'modelRevision', 'systemPrompt']);
      provider = Object.freeze({ providerId: text(item.providerId, 'AI 提供方标识'), kind,
        model: text(item.model, '模型'), modelRevision: text(item.modelRevision, '本地模型版本'),
        systemPrompt: text(item.systemPrompt, '系统提示', 65536) });
    } else if (kind === 'TemplateProvider') {
      const item = fields(rawProvider, ['providerId', 'kind', 'contentId', 'contentRevision', 'templates']);
      const templateIds = new Set<string>();
      const templates = array(item.templates).map(rawTemplate => {
        const template = fields(rawTemplate, ['templateId', 'text']);
        const templateId = text(template.templateId, '模板标识');
        if (templateIds.has(templateId)) { throw new Error('AI 模板标识重复'); } templateIds.add(templateId);
        return Object.freeze({ templateId, text: text(template.text, '模板正文', 65536) });
      });
      if (templates.length === 0) { throw new Error('模板提供方缺少实际模板内容'); }
      provider = Object.freeze({ providerId: text(item.providerId, 'AI 提供方标识'), kind,
        contentId: text(item.contentId, '模板内容标识'), contentRevision: text(item.contentRevision, '模板内容版本'),
        templates: Object.freeze(templates) });
    } else { throw new Error('AI 提供方种类不受支持'); }
    if (providerIds.has(provider.providerId)) { throw new Error('AI 提供方标识重复'); }
    providerIds.add(provider.providerId); providers.push(provider);
  }
  if (providers.length === 0) { throw new Error('AI 配置缺少提供方'); }
  const tasks = new Set<string>();
  const taskRoutes = array(value.taskRoutes).map(rawRoute => {
    const route = fields(rawRoute, ['task', 'fallbackChain']);
    const task = route.task;
    if (task !== 'Narrative' && task !== 'Dialogue' && task !== 'RealityHint' && task !== 'OutputValidation') {
      throw new Error('AI 任务路由不受支持；名言不得进入生成路由');
    }
    if (tasks.has(task)) { throw new Error('AI 任务路由重复'); } tasks.add(task);
    const used = new Set<string>();
    const fallbackChain = array(route.fallbackChain).map(rawId => {
      const id = text(rawId, 'AI 降级提供方');
      const provider = providers.find(item => item.providerId === id);
      if (provider === undefined || used.has(id)) { throw new Error('AI 降级链引用缺失或重复'); }
      if ((task === 'RealityHint' || task === 'OutputValidation') && provider.kind === 'CloudProvider') {
        throw new Error('私有提示与输出校验路由不得使用云端');
      }
      used.add(id); return id;
    });
    if (fallbackChain.length === 0 || providers.find(item => item.providerId === fallbackChain[fallbackChain.length - 1])?.kind !== 'TemplateProvider') {
      throw new Error('AI 降级链必须以实际模板提供方结束');
    }
    return Object.freeze({ task, fallbackChain: Object.freeze(fallbackChain) });
  });
  if (taskRoutes.length === 0) { throw new Error('AI 配置缺少任务路由'); }
  return Object.freeze({ schemaVersion: 1, profileId, revision, providers: Object.freeze(providers), taskRoutes: Object.freeze(taskRoutes) });
}

export class WorldLinkSession {
  private snapshot: WorldLinkSnapshot | null;
  private readonly context: WorldLinkContext;
  private mutationActive = false;
  constructor(context: WorldLinkContext, private readonly callbacks: {
    readonly readSource?: WorldLinkSourceReader;
    readonly now?: () => number;
    readonly persist?: (snapshot: WorldLinkSnapshot) => void;
  } = {}, seed?: unknown) {
    validateContext(context); this.context = Object.freeze({ ...context });
    if (context.shoreOrigin === 'BugShore' && callbacks.readSource === undefined) {
      throw new Error('BugShore 未装配权威来源读取器');
    }
    this.snapshot = seed === undefined ? (context.shoreOrigin === 'BugShore' ? null : notApplicable(context))
      : validateWorldLinkSnapshot(seed, this.context, callbacks.readSource);
  }

  validate(raw: unknown): WorldLinkSnapshot { return validateWorldLinkSnapshot(raw, this.context, this.callbacks.readSource); }

  getSnapshot(): WorldLinkSnapshot {
    if (this.snapshot === null) { throw new Error('BugShore 尚未从合法来源进入，AI 配置快照不可用'); }
    return this.validate(this.snapshot);
  }

  /** Only the source-to-Shore transition can refresh the saved configuration. */
  enterFromSource(sourceWorldId: string): WorldLinkSnapshot {
    if (this.context.shoreOrigin !== 'BugShore' || sourceWorldId !== this.context.sourceWorldId) {
      throw new Error('仅合法来源到 BugShore 的进入可以捕获 AI 配置');
    }
    if (this.snapshot?.kind === 'Linked' && this.snapshot.linkState === 'Orphaned') { throw new Error('孤立彼岸不可重新绑定来源'); }
    const source = readKnownSource(this.context, this.callbacks.readSource);
    if (source.kind !== 'Present') { throw new Error('来源已删除，不能从来源进入彼岸'); }
    const capturedAt = this.callbacks.now?.(); integer(capturedAt, 'AI 配置快照时刻');
    const candidate: WorldLinkSnapshot = Object.freeze({ schemaVersion: 1, accountId: this.context.accountId,
      worldId: this.context.worldId, protagonistCharacterId: this.context.protagonistCharacterId, kind: 'Linked',
      worldKind: 'Shore', shoreOrigin: 'BugShore', sourceWorldId, linkState: 'Bound',
      aiProfileSnapshot: Object.freeze({ schemaVersion: 1, sourceWorldId, capturedAt, profile: source.profile }) });
    this.commit(candidate); return candidate;
  }

  /** Explicit lifecycle checkpoint; it never refreshes a saved profile. */
  refreshSourceState(): WorldLinkSnapshot {
    const candidate = this.getSnapshot();
    if (JSON.stringify(candidate) !== JSON.stringify(this.snapshot)) { this.commit(candidate); }
    return candidate;
  }

  readEffectiveProfile(): AIProfile {
    const snapshot = this.getSnapshot();
    if (snapshot.kind !== 'Linked') { throw new Error('本世界不使用来源 AI 配置'); }
    if (snapshot.linkState === 'Orphaned') { return snapshot.aiProfileSnapshot.profile; }
    const source = readKnownSource(this.context, this.callbacks.readSource);
    if (source.kind !== 'Present') { return snapshot.aiProfileSnapshot.profile; }
    return source.profile;
  }

  canReturnToSource(): boolean { const snapshot = this.getSnapshot(); return snapshot.kind === 'Linked' && snapshot.linkState === 'Bound'; }

  private commit(candidate: WorldLinkSnapshot): void {
    if (this.callbacks.persist === undefined) { throw new Error('WorldLink 持久提交尚未装配'); }
    if (this.mutationActive) { throw new Error('WorldLink 提交不可重入'); }
    this.mutationActive = true;
    try { this.callbacks.persist(candidate); this.snapshot = candidate; }
    finally { this.mutationActive = false; }
  }
}

function notApplicable(context: WorldLinkContext): WorldLinkSnapshot {
  if (context.worldKind === 'Primary') { return Object.freeze({ schemaVersion: 1, accountId: context.accountId,
    worldId: context.worldId, protagonistCharacterId: context.protagonistCharacterId, kind: 'NotApplicable', worldKind: 'Primary', shoreOrigin: null }); }
  if (context.shoreOrigin !== 'FinalShore') { throw new Error('BugShore 不可声明 WorldLink 不适用'); }
  return Object.freeze({ schemaVersion: 1, accountId: context.accountId, worldId: context.worldId,
    protagonistCharacterId: context.protagonistCharacterId, kind: 'NotApplicable', worldKind: 'Shore', shoreOrigin: 'FinalShore' });
}

function readKnownSource(context: WorldLinkContext, reader?: WorldLinkSourceReader): Exclude<WorldLinkSource, { kind: 'Unknown' }> {
  if (reader === undefined) { throw new Error('BugShore 未装配权威来源读取器'); }
  const raw = reader(context.sourceWorldId!); const kind = data(raw).kind;
  const source = fields(raw, kind === 'Present' ? ['kind', 'accountId', 'worldId', 'worldKind', 'profile'] : ['kind', 'accountId', 'worldId']);
  if (source.accountId !== context.accountId || source.worldId !== context.sourceWorldId) { throw new Error('来源读取器身份不匹配'); }
  if (kind === 'Unknown') { throw new Error('来源身份或删除状态未知，不得假定孤立'); }
  if (kind === 'Deleted') { return Object.freeze({ kind, accountId: context.accountId, worldId: context.sourceWorldId! }); }
  if (kind !== 'Present' || source.worldKind !== 'Primary') { throw new Error('来源必须为已知 Primary；禁止彼岸套彼岸'); }
  return Object.freeze({ kind, accountId: context.accountId, worldId: context.sourceWorldId!, worldKind: 'Primary', profile: validateAIProfile(source.profile) });
}

function validateContext(context: WorldLinkContext): void {
  text(context.accountId, '账号', 64); text(context.worldId, '世界', 128); text(context.protagonistCharacterId, '主角', 128);
  if ((context.worldKind === 'Primary' && context.shoreOrigin !== null) ||
      (context.worldKind === 'Shore' && context.shoreOrigin !== 'BugShore' && context.shoreOrigin !== 'FinalShore') ||
      (context.worldKind !== 'Primary' && context.worldKind !== 'Shore')) { throw new Error('WorldLink 权威世界身份不一致'); }
  if (context.shoreOrigin === 'BugShore') {
    text(context.sourceWorldId, '来源世界', 128);
    if (context.sourceWorldId === context.worldId) { throw new Error('WorldLink 禁止自引用'); }
  } else if (context.sourceWorldId !== undefined) { throw new Error('不适用 WorldLink 的世界不得携带来源'); }
}

function matchIdentity(value: Record<string, unknown>, context: WorldLinkContext): void {
  if (value.schemaVersion !== 1 || value.accountId !== context.accountId || value.worldId !== context.worldId ||
      value.protagonistCharacterId !== context.protagonistCharacterId) { throw new Error('WorldLink 版本或账号/世界/角色身份不匹配'); }
}

function text(raw: unknown, label: string, max = 256): string {
  if (typeof raw !== 'string' || !raw || raw !== raw.trim() || raw.length > max) { throw new Error(label + '无效'); }
  try { encodeURIComponent(raw); } catch { throw new Error(label + '编码无效'); }
  return raw;
}
function integer(raw: unknown, label: string): asserts raw is number {
  if (typeof raw !== 'number' || !Number.isSafeInteger(raw) || raw < 0) { throw new Error(label + '须为非负安全整数'); }
}
function data(raw: unknown): Record<string, unknown> {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) { throw new Error('WorldLink 数据须为普通对象'); }
  const prototype: unknown = Object.getPrototypeOf(raw);
  if (prototype !== Object.prototype && prototype !== null) { throw new Error('WorldLink 数据不得继承原型'); }
  const descriptors = Object.getOwnPropertyDescriptors(raw); const output = Object.create(null) as Record<string, unknown>;
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== 'string' || !Object.prototype.hasOwnProperty.call(descriptors[key], 'value')) { throw new Error('WorldLink 数据不得含访问器或符号'); }
    output[key] = descriptors[key].value;
  }
  return output;
}
function fields(raw: unknown, expected: readonly string[]): Record<string, unknown> {
  const value = data(raw);
  if (Object.keys(value).length !== expected.length || expected.some(key => !Object.prototype.hasOwnProperty.call(value, key))) {
    throw new Error('WorldLink 数据字段缺失或含未知字段');
  }
  return value;
}
function array(raw: unknown): readonly unknown[] {
  if (!Array.isArray(raw) || Object.getPrototypeOf(raw) !== Array.prototype) { throw new Error('WorldLink 数组无效'); }
  const descriptors = Object.getOwnPropertyDescriptors(raw as object); const length = descriptors.length?.value as unknown;
  integer(length, '数组长度');
  if (Reflect.ownKeys(descriptors).length !== length + 1) { throw new Error('WorldLink 数组不得含额外字段'); }
  const values: unknown[] = [];
  for (let index = 0; index < length; index++) {
    const descriptor = descriptors[String(index)];
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) { throw new Error('WorldLink 数组不得稀疏或含访问器'); }
    values.push(descriptor.value);
  }
  return values;
}
