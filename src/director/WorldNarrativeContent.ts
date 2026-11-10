// Maker-published Primary content, parsed before any player intent can append a value.
import type { WorldBossChartSource } from '../chart/WorldBossChartSource';
import type { NarrativeVector } from '../ledger/NarrativeEvent';
import { validateNarrativeVector } from '../ledger/deriveLedgerPosition';

export interface WorldNarrativeChoice {
  readonly choiceId: string;
  readonly label: string;
  readonly meaning: string;
  readonly vector: NarrativeVector;
}

export interface WorldNarrativeContent {
  readonly schemaVersion: 1;
  readonly contentId: string;
  readonly contentRevision: string;
  readonly worldKind: 'Primary';
  readonly protagonistCharacterId: string;
  readonly EventSpaceCenter: NarrativeVector;
  readonly EventDistance: number;
  readonly source: { readonly author: string; readonly version: string; readonly description: string };
  readonly interaction: { readonly title: string; readonly prompt: string; readonly choices: readonly WorldNarrativeChoice[] };
  readonly worldBossChartSource: WorldBossChartSource;
}

function fields(raw: unknown, names: readonly string[], label: string): Record<string, unknown> {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) { throw new Error(`${label}格式无效`); }
  const prototype: unknown = Object.getPrototypeOf(raw);
  if (prototype !== Object.prototype && prototype !== null) { throw new Error(`${label}原型无效`); }
  const descriptors = Object.getOwnPropertyDescriptors(raw);
  if (Reflect.ownKeys(descriptors).length !== names.length) { throw new Error(`${label}字段无效`); }
  const value: Record<string, unknown> = {};
  for (const name of names) {
    const descriptor = descriptors[name];
    if (descriptor === undefined || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      throw new Error(`${label}字段不可安全读取`);
    }
    value[name] = descriptor.value;
  }
  return value;
}

function text(raw: unknown, label: string, maximum = 128): string {
  if (typeof raw !== 'string' || raw.length < 1 || raw.length > maximum || raw !== raw.trim()) {
    throw new Error(`${label}须为非空、无首尾空白的字符串`);
  }
  try { encodeURIComponent(raw); } catch { throw new Error(`${label}编码无效`); }
  return raw;
}

function resourcePath(raw: unknown, label: string): string {
  const path = text(raw, label, 256);
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(path) || path.split('/').some(segment => segment === '..' || segment === '' || segment === '.')) {
    throw new Error(`${label}须为包内资源相对路径`);
  }
  return path;
}

export function parseWorldNarrativeContent(raw: unknown): WorldNarrativeContent {
  const value = fields(raw, ['schemaVersion', 'contentId', 'contentRevision', 'worldKind', 'protagonistCharacterId',
    'EventSpaceCenter', 'EventDistance', 'source', 'interaction', 'worldBossChartSource'], '正式世界叙事内容');
  if (value.schemaVersion !== 1 || value.worldKind !== 'Primary') { throw new Error('正式世界叙事内容版本或种类不匹配'); }
  const EventSpaceCenter = validateNarrativeVector(value.EventSpaceCenter);
  if (EventSpaceCenter.some(component => component !== 0)) { throw new Error('本批 Primary 主角事件空间球心须为零坐标'); }
  if (typeof value.EventDistance !== 'number' || !Number.isFinite(value.EventDistance) || value.EventDistance <= 0) {
    throw new Error('正式世界事件空间半径须为有限正值');
  }
  const contentRevision = text(value.contentRevision, '世界内容版本');
  const source = fields(value.source, ['author', 'version', 'description'], '内容来源');
  if (source.version !== contentRevision) { throw new Error('制作内容来源版本不匹配'); }
  const interaction = fields(value.interaction, ['title', 'prompt', 'choices'], '世界叙事交互');
  if (!Array.isArray(interaction.choices) || Object.getPrototypeOf(interaction.choices) !== Array.prototype) {
    throw new Error('世界叙事交互分支无效');
  }
  const descriptors: PropertyDescriptorMap = Object.getOwnPropertyDescriptors(interaction.choices as object);
  const length: unknown = descriptors.length?.value;
  if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 1 ||
      Reflect.ownKeys(descriptors).length !== length + 1) { throw new Error('世界叙事交互分支列表无效'); }
  const choices: WorldNarrativeChoice[] = [];
  const choiceIds = new Set<string>();
  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (descriptor === undefined || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      throw new Error('世界叙事交互分支不可安全读取');
    }
    const choice = fields(descriptor.value, ['choiceId', 'label', 'meaning', 'vector'], '叙事选择');
    const choiceId = text(choice.choiceId, '叙事选择标识');
    if (choiceIds.has(choiceId)) { throw new Error('叙事选择标识重复'); }
    choiceIds.add(choiceId);
    choices.push(Object.freeze({ choiceId, label: text(choice.label, '叙事选择文本'),
      meaning: text(choice.meaning, '叙事与情感意义', 2048), vector: validateNarrativeVector(choice.vector) }));
  }
  const chart = fields(value.worldBossChartSource, ['chartId', 'contentRevision', 'chartResourcePath',
    'visualResourcePath', 'mediaResourcePath'], 'World 谱面内容来源');
  if (chart.chartId === 'CHART_NOT_BOUND') { throw new Error('正式 World 内容不能引用未绑定谱面'); }
  if (chart.contentRevision !== contentRevision) { throw new Error('World 谱面内容版本不匹配'); }
  return Object.freeze({ schemaVersion: 1, contentId: text(value.contentId, '世界内容标识'), contentRevision,
    worldKind: 'Primary', protagonistCharacterId: text(value.protagonistCharacterId, '主角身份'), EventSpaceCenter,
    EventDistance: value.EventDistance,
    source: Object.freeze({ author: text(source.author, '制作来源'), version: contentRevision,
      description: text(source.description, '内容来源说明', 2048) }),
    interaction: Object.freeze({ title: text(interaction.title, '叙事交互标题'),
      prompt: text(interaction.prompt, '叙事交互内容', 2048), choices: Object.freeze(choices) }),
    worldBossChartSource: Object.freeze({ chartId: text(chart.chartId, 'World 谱面标识'), contentRevision,
      chartResourcePath: resourcePath(chart.chartResourcePath, '谱面资源'),
      visualResourcePath: resourcePath(chart.visualResourcePath, '视觉资源'),
      mediaResourcePath: resourcePath(chart.mediaResourcePath, '媒体资源') }) });
}
