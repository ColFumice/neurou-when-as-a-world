// Observer-owned immutable premiere content and persistent score candidates. Zero platform/cc access.
import type { ChartRef, ChartTier } from '../../constants';
import { CHART_BASE_SCORE, CHART_TRANSPARENCY_BONUS_MAX } from '../../constants';
import type { NarrativeEvent } from '../ledger/NarrativeEvent';
import { InputSource } from '../ledger/NarrativeEvent';
import { validateLedgerNarrativeEvent } from './LedgerHydration';
import { classifyChartReference } from './ChartReference';
import type { ChartData } from '../chart/Note';
import type { GuidanceChart } from '../chart/GuidanceChart';
import { parseGuidanceChart } from '../chart/GuidanceChart';
import type { KeyboardPadLayout, ChartKeyId, KeyPadSlot } from '../chart/KeyboardPadLayout';
import { CHART_KEY_IDS } from '../chart/KeyboardPadLayout';
import type { ChartPlaybackResult } from '../chart/ChartPremiere';

export interface ChartArchiveContext {
  readonly accountId: string;
  readonly worldId: string;
  readonly protagonistCharacterId: string;
  readonly worldKind: 'Primary' | 'Shore';
  readonly shoreOrigin: null | 'BugShore' | 'FinalShore';
}
export interface ChartMediaIdentity {
  readonly kind: 'Audio' | 'Video';
  readonly contentId: string;
  readonly contentRevision: string;
  readonly resourcePath: string;
  readonly sha256: string;
  readonly byteLength: number;
}
export interface ChartVisualSnapshot {
  readonly schemaVersion: 1;
  readonly chartId: string;
  readonly nodes: readonly { readonly nodeId: string; readonly color: { readonly r: number; readonly g: number; readonly b: number } }[];
}
export interface ChartContentManifest {
  readonly schemaVersion: 1;
  readonly source: { readonly author: string; readonly version: string; readonly description: string };
  readonly media: readonly ChartMediaIdentity[];
  readonly charts: readonly {
    readonly chartId: string;
    readonly sourceKind: 'Published' | 'LegacyFallback';
    readonly resourcePath: string | null;
    readonly sourcePath: string;
    readonly contentRevision: string;
    readonly chartDigest: string;
    readonly visualDigest: string;
    readonly mediaContentId: string;
  }[];
}
export interface ChartSnapshotRecord {
  readonly chartId: string;
  readonly ChartRef: ChartRef & { readonly state: 'PremiereCompleted' };
  readonly completionEventId: string;
  readonly owner: 'WorldObserver' | 'FinalShorePersonal';
  readonly frozenAt: number;
  readonly chart: ChartData | GuidanceChart;
  readonly layout: KeyboardPadLayout;
  readonly visual: ChartVisualSnapshot;
  readonly media: ChartMediaIdentity;
  readonly guideTransparency: number;
  readonly contentDigest: string;
}
export interface ChartSnapshotCollection {
  readonly schemaVersion: 1;
  readonly accountId: string;
  readonly worldId: string;
  readonly protagonistCharacterId: string;
  readonly records: readonly ChartSnapshotRecord[];
}
export interface ChartScorePlay extends ChartPlaybackResult {
  readonly playId: string;
  readonly guideTransparency: number;
}
export interface ChartScoreRecord {
  readonly chartId: string;
  readonly ChartRef: ChartRef & { readonly state: 'PremiereCompleted' };
  readonly completionEventId: string;
  readonly snapshotDigest: string;
  readonly scoringVersion: 1;
  readonly best: ChartScorePlay;
  readonly latest: ChartScorePlay;
  readonly completedPlayCount: number;
  readonly completedPlayIds: readonly string[];
}
export interface ChartScoreSnapshot {
  readonly schemaVersion: 1;
  readonly accountId: string;
  readonly worldId: string;
  readonly protagonistCharacterId: string;
  readonly records: readonly ChartScoreRecord[];
}
export interface ChartArchiveCandidate {
  readonly snapshots: ChartSnapshotCollection;
  readonly scores: ChartScoreSnapshot;
}
export interface ChartPremiereArchiveInput {
  readonly completionEventId: string;
  readonly chart: ChartData | GuidanceChart;
  readonly layout: KeyboardPadLayout;
  readonly visual: ChartVisualSnapshot;
  readonly media: ChartMediaIdentity;
  readonly guideTransparency: number;
  readonly result: ChartPlaybackResult;
}
export interface ChartReplayArchiveInput {
  readonly chartId: string;
  readonly playId: string;
  readonly guideTransparency: number;
  readonly result: ChartPlaybackResult;
}

/** The publication index describes real bytes; runtime byte verification stays in the composition root. */
export function parseChartContentManifest(raw: unknown): ChartContentManifest {
  const data = fields(raw, ['schemaVersion', 'source', 'media', 'charts']);
  if (data.schemaVersion !== 1) { throw new Error('谱面内容清单版本无效'); }
  const maker = fields(data.source, ['author', 'version', 'description']), seenMedia = new Set<string>(), seenPaths = new Set<string>();
  const media = array(data.media).map(item => {
    const value = mediaValue(item);
    if (seenMedia.has(value.contentId) || seenPaths.has(value.resourcePath)) { throw new Error('谱面内容清单媒体身份或路径重复'); }
    seenMedia.add(value.contentId); seenPaths.add(value.resourcePath); return value;
  });
  const seenCharts = new Set<string>();
  const charts = array(data.charts).map(item => {
    const value = fields(item, ['chartId', 'sourceKind', 'resourcePath', 'sourcePath', 'contentRevision', 'chartDigest', 'visualDigest', 'mediaContentId']);
    const chartId = id(value.chartId), sourceKind = value.sourceKind;
    if (seenCharts.has(chartId)) { throw new Error('谱面内容清单谱面身份重复'); } seenCharts.add(chartId);
    if (sourceKind !== 'Published' && sourceKind !== 'LegacyFallback') { throw new Error('谱面内容清单来源类别无效'); }
    const resourcePath = value.resourcePath;
    if ((sourceKind === 'LegacyFallback' && resourcePath !== null) || (sourceKind === 'Published' &&
        (typeof resourcePath !== 'string' || !/^chart\/[\p{L}\p{N}_-]+(?:\/[\p{L}\p{N}_-]+)*$/u.test(resourcePath)))) {
      throw new Error('谱面内容清单资源路径与来源不一致');
    }
    const sourcePath = id(value.sourcePath, 256), mediaContentId = id(value.mediaContentId);
    if (!/^(assets|quality-review)\/[\p{L}\p{N}_./-]+(?:#[A-Za-z][A-Za-z0-9]*)?$/u.test(sourcePath) ||
        sourcePath.split('/').some(part => part === '.' || part === '..') || !seenMedia.has(mediaContentId) ||
        typeof value.chartDigest !== 'string' || !/^[0-9a-f]{64}$/.test(value.chartDigest) ||
        typeof value.visualDigest !== 'string' || !/^[0-9a-f]{64}$/.test(value.visualDigest)) {
      throw new Error('谱面内容清单缺少有效制作来源、内容摘要或媒体关联');
    }
    return freeze({ chartId, sourceKind: sourceKind as 'Published' | 'LegacyFallback', resourcePath: resourcePath as string | null, sourcePath,
      contentRevision: id(value.contentRevision), chartDigest: value.chartDigest, visualDigest: value.visualDigest, mediaContentId });
  });
  return freeze({ schemaVersion: 1, source: { author: id(maker.author), version: id(maker.version), description: id(maker.description, 512) }, media, charts });
}

/** All operations return independent validated candidates; only the outer transaction may publish them. */
export class ChartArchive {
  private readonly context: ChartArchiveContext;
  constructor(context: ChartArchiveContext,
    private readonly priorSnapshots?: ChartSnapshotCollection,
    private readonly priorScores?: ChartScoreSnapshot) {
    this.context = contextValue(context);
  }

  emptySnapshots(): ChartSnapshotCollection { return this.envelope([]); }
  emptyScores(): ChartScoreSnapshot { return this.envelope([]); }

  validateSnapshots(raw: unknown, ledger: readonly NarrativeEvent[], requireCompleteReferences = false): ChartSnapshotCollection {
    const data = this.header(raw), references = completedReferences(ledger), records: ChartSnapshotRecord[] = [], seen = new Set<string>();
    for (const item of array(data.records)) {
      const value = fields(item, ['chartId', 'ChartRef', 'completionEventId', 'owner', 'frozenAt', 'chart', 'layout', 'visual', 'media', 'guideTransparency', 'contentDigest']);
      const chartId = id(value.chartId), completionEventId = id(value.completionEventId);
      if (seen.has(chartId)) { throw new Error('谱面首演快照重复'); } seen.add(chartId);
      reference(value.ChartRef, chartId);
      const event = references.find(event => event.eventId === completionEventId && event.ChartRef.chartId === chartId);
      if (!event) { throw new Error('谱面首演快照没有合法完成账本引用'); }
      const layout = layoutValue(value.layout), chart = chartValue(value.chart, layout), visual = visualValue(value.visual, chart);
      if (chart.chartId !== chartId) { throw new Error('首演快照谱面身份不一致'); }
      if (!Object.prototype.hasOwnProperty.call(event.ChartRef, 'state') &&
          (chart.tier !== 'Regular' || classifyChartReference(event, chart.chartId) !== 'PremiereCompleted')) {
        throw new Error('旧首演引用必须由实际冻结的 Regular 谱面身份验证');
      }
      const owner = this.owner(chart.tier);
      if (value.owner !== owner || value.frozenAt !== event.AppendedAt.epochMs) { throw new Error('首演快照归属或冻结时间不一致'); }
      const media = mediaValue(value.media), guideTransparency = finite(value.guideTransparency, 0, 100),
        contentDigest = chartContentDigest({ chart, layout, visual, media, guideTransparency });
      if (value.contentDigest !== contentDigest) { throw new Error('首演冻结内容摘要不匹配'); }
      records.push(freeze({ chartId, ChartRef: { chartId, state: 'PremiereCompleted' as const }, completionEventId,
        owner, frozenAt: event.AppendedAt.epochMs, chart, layout, visual, media, guideTransparency, contentDigest }));
    }
    if (requireCompleteReferences && references.some(event => !records.some(record => record.completionEventId === event.eventId))) {
      throw new Error('历史首演缺少实际播放内容快照；不能用当前资源补造');
    }
    return this.envelope(records);
  }

  validateScores(raw: unknown, snapshots: ChartSnapshotCollection, ledger: readonly NarrativeEvent[], requireCompleteReferences = false): ChartScoreSnapshot {
    const verified = this.validateSnapshots(snapshots, ledger, requireCompleteReferences), data = this.header(raw), records: ChartScoreRecord[] = [], seen = new Set<string>();
    for (const item of array(data.records)) {
      const value = fields(item, ['chartId', 'ChartRef', 'completionEventId', 'snapshotDigest', 'scoringVersion', 'best', 'latest', 'completedPlayCount', 'completedPlayIds']);
      const chartId = id(value.chartId), snapshot = verified.records.find(record => record.chartId === chartId);
      if (!snapshot || seen.has(chartId)) { throw new Error('成绩缺少对应首演快照或重复'); } seen.add(chartId);
      reference(value.ChartRef, chartId);
      if (value.completionEventId !== snapshot.completionEventId || value.snapshotDigest !== snapshot.contentDigest || value.scoringVersion !== 1) {
        throw new Error('谱面成绩的快照关联或计分版本无效');
      }
      const best = playValue(value.best, snapshot), latest = playValue(value.latest, snapshot), completedPlayCount = integer(value.completedPlayCount, 1);
      const completedPlayIds = array(value.completedPlayIds).map(value => id(value));
      if (completedPlayIds.length !== completedPlayCount || new Set(completedPlayIds).size !== completedPlayCount ||
          completedPlayIds[0] !== snapshot.completionEventId || !completedPlayIds.includes(best.playId) || completedPlayIds[completedPlayIds.length - 1] !== latest.playId ||
          best.totalScore < latest.totalScore || (completedPlayCount === 1 && canonical(best) !== canonical(latest))) {
        throw new Error('谱面最高成绩、最近成绩或完成次数不一致');
      }
      records.push(freeze({ chartId, ChartRef: snapshot.ChartRef, completionEventId: snapshot.completionEventId,
        snapshotDigest: snapshot.contentDigest, scoringVersion: 1 as const, best, latest, completedPlayCount, completedPlayIds }));
    }
    if (requireCompleteReferences && verified.records.some(snapshot => !records.some(record => record.chartId === snapshot.chartId))) {
      throw new Error('历史首演缺少真实成绩；不能填零分');
    }
    return this.envelope(records);
  }

  preparePremiere(input: ChartPremiereArchiveInput, ledger: readonly NarrativeEvent[]): ChartArchiveCandidate {
    const snapshots = this.validateSnapshots(this.priorSnapshots ?? this.emptySnapshots(), ledger);
    const scores = this.validateScores(this.priorScores ?? this.emptyScores(), snapshots, ledger);
    const chart = chartValue(input.chart, layoutValue(input.layout)), layout = layoutValue(input.layout), visual = visualValue(input.visual, chart), media = mediaValue(input.media);
    const completionEventId = id(input.completionEventId), event = completedReferences(ledger).find(event => event.eventId === completionEventId && event.ChartRef.chartId === chart.chartId);
    if (!event) { throw new Error('首演归档只能关联同次合法完成账本'); }
    const guideTransparency = finite(input.guideTransparency, 0, 100);
    const snapshot: ChartSnapshotRecord = freeze({ chartId: chart.chartId, ChartRef: { chartId: chart.chartId, state: 'PremiereCompleted' }, completionEventId,
      owner: this.owner(chart.tier), frozenAt: event.AppendedAt.epochMs, chart, layout, visual, media, guideTransparency,
      contentDigest: chartContentDigest({ chart, layout, visual, media, guideTransparency }) });
    const play = playValue({ ...input.result, playId: completionEventId, guideTransparency: input.guideTransparency }, snapshot);
    if (snapshots.records.some(record => record.chartId === chart.chartId)) { throw new Error('首演冻结不可覆盖或重复生成'); }
    const score: ChartScoreRecord = freeze({ chartId: chart.chartId, ChartRef: snapshot.ChartRef, completionEventId,
      snapshotDigest: snapshot.contentDigest, scoringVersion: 1, best: play, latest: play, completedPlayCount: 1, completedPlayIds: [completionEventId] });
    const nextSnapshots = this.validateSnapshots(this.envelope([...snapshots.records, snapshot]), ledger);
    const nextScores = this.validateScores(this.envelope([...scores.records, score]), nextSnapshots, ledger);
    return freeze({ snapshots: nextSnapshots, scores: nextScores });
  }

  prepareReplay(input: ChartReplayArchiveInput, ledger: readonly NarrativeEvent[]): ChartArchiveCandidate {
    const snapshots = this.validateSnapshots(this.priorSnapshots ?? this.emptySnapshots(), ledger);
    const scores = this.validateScores(this.priorScores ?? this.emptyScores(), snapshots, ledger);
    const snapshot = snapshots.records.find(record => record.chartId === input.chartId), prior = scores.records.find(record => record.chartId === input.chartId);
    if (!snapshot || !prior) { throw new Error('重演须复用已有合法首演快照与成绩'); }
    const play = playValue({ ...input.result, playId: id(input.playId), guideTransparency: input.guideTransparency }, snapshot);
    if (prior.completedPlayIds.includes(play.playId)) { throw new Error('同一次重演完成不可重复提交'); }
    const updated: ChartScoreRecord = freeze({ ...prior, latest: play, best: play.totalScore > prior.best.totalScore ? play : prior.best,
      completedPlayCount: integer(prior.completedPlayCount + 1, 1), completedPlayIds: [...prior.completedPlayIds, play.playId] });
    return freeze({ snapshots, scores: this.validateScores(this.envelope(scores.records.map(record => record === prior ? updated : record)), snapshots, ledger) });
  }

  private owner(tier: ChartTier): 'WorldObserver' | 'FinalShorePersonal' {
    if (tier === 'Final') {
      if (this.context.worldKind !== 'Shore' || this.context.shoreOrigin !== 'FinalShore') { throw new Error('Final 谱面必须归属 FinalShore 个人层'); }
      return 'FinalShorePersonal';
    }
    return 'WorldObserver';
  }
  private header(raw: unknown): Record<string, unknown> {
    const data = fields(raw, ['schemaVersion', 'accountId', 'worldId', 'protagonistCharacterId', 'records']);
    if (data.schemaVersion !== 1 || data.accountId !== this.context.accountId || data.worldId !== this.context.worldId ||
        data.protagonistCharacterId !== this.context.protagonistCharacterId) { throw new Error('谱面归档版本或个人归属不匹配'); }
    return data;
  }
  private envelope<T>(records: readonly T[]): { readonly schemaVersion: 1; readonly accountId: string; readonly worldId: string; readonly protagonistCharacterId: string; readonly records: readonly T[] } {
    return freeze({ schemaVersion: 1, accountId: this.context.accountId, worldId: this.context.worldId,
      protagonistCharacterId: this.context.protagonistCharacterId, records });
  }
}

function contextValue(raw: unknown): ChartArchiveContext {
  const data = fields(raw, ['accountId', 'worldId', 'protagonistCharacterId', 'worldKind', 'shoreOrigin']);
  if ((data.worldKind === 'Primary' && data.shoreOrigin !== null) || (data.worldKind === 'Shore' && data.shoreOrigin !== 'BugShore' && data.shoreOrigin !== 'FinalShore') ||
      (data.worldKind !== 'Primary' && data.worldKind !== 'Shore')) { throw new Error('谱面归档世界种类与彼岸来源不一致'); }
  return freeze({ accountId: id(data.accountId, 64), worldId: id(data.worldId), protagonistCharacterId: id(data.protagonistCharacterId),
    worldKind: data.worldKind, shoreOrigin: data.shoreOrigin as ChartArchiveContext['shoreOrigin'] });
}
function completedReferences(raw: readonly NarrativeEvent[]): readonly NarrativeEvent[] {
  const ledger = array(raw).map(value => validateLedgerNarrativeEvent(value)), ids = new Set<string>(), charts = new Set<string>(), completed: NarrativeEvent[] = [];
  for (const event of ledger) {
    if (ids.has(event.eventId)) { throw new Error('谱面关联账本事件重复'); } ids.add(event.eventId);
    const classification = classifyChartReference(event);
    // Exact legacy T7 remains an obligation when its actual played content is absent.
    // It becomes a legal completion association only after the record's frozen Regular identity is checked above.
    const legacyObligation = event.ChartRef.state === undefined && event.eventId === 'T7_COMPLETION_PLACEHOLDER' &&
      event.InputSource === InputSource.Player && event.vector.every(component => component === 0) && event.ChartRef.chartId !== 'CHART_NOT_BOUND';
    if (classification !== 'PremiereCompleted' && !legacyObligation) { continue; }
    if (charts.has(event.ChartRef.chartId)) { throw new Error('同一谱面重复首演完成引用'); } charts.add(event.ChartRef.chartId); completed.push(event);
  }
  return completed;
}
function reference(raw: unknown, chartId: string): void {
  const ref = fields(raw, ['chartId', 'state']); if (ref.chartId !== chartId || ref.state !== 'PremiereCompleted') { throw new Error('谱面归档引用须为合法首演完成'); }
}
function layoutValue(raw: unknown): KeyboardPadLayout {
  const data = fields(raw, ['layoutVersion', 'slots']), seen = new Set<string>();
  const slots = array(data.slots).map(item => {
    const value = fields(item, ['keyId', 'padKind', 'u', 'v', 'width', 'height']), keyId = id(value.keyId);
    if (!CHART_KEY_IDS.includes(keyId as ChartKeyId) || keyId === 'Space' || seen.has(keyId)) { throw new Error('完整谱面布局键位无效或重复'); } seen.add(keyId);
    const padKind = keyId.startsWith('Digit') ? 'Drum' : 'Regular';
    if (value.padKind !== padKind) { throw new Error('谱面布局键位类别不匹配'); }
    const u = finite(value.u, 0, 1), v = finite(value.v, 0, 1), width = finite(value.width, Number.MIN_VALUE, 1), height = finite(value.height, Number.MIN_VALUE, 1);
    if (u + width > 1 + 1e-12 || v + height > 1 + 1e-12) { throw new Error('谱面布局越界'); }
    return freeze({ keyId: keyId as ChartKeyId, padKind, u, v, width, height }) as KeyPadSlot;
  });
  if (seen.size !== CHART_KEY_IDS.filter(key => key !== 'Space').length) { throw new Error('首演必须保存完整逻辑布局'); }
  return freeze({ layoutVersion: id(data.layoutVersion), slots });
}
function chartValue(raw: unknown, layout: KeyboardPadLayout): ChartData | GuidanceChart {
  const data = clone(raw) as Record<string, unknown>;
  if ('lines' in data) { return parseGuidanceChart(data, layout); }
  const value = fields(data, ['chartId', 'tier', 'layoutVersion', 'notes']), chartId = id(value.chartId), tier = tierValue(value.tier);
  if (value.layoutVersion !== layout.layoutVersion) { throw new Error('首演谱面布局版本不匹配'); }
  const notes = array(value.notes).map(item => { const note = fields(item, ['timeMs', 'keyId']);
    if (!layout.slots.some(slot => slot.keyId === note.keyId)) { throw new Error('首演音符键位不在布局中'); }
    return freeze({ timeMs: finite(note.timeMs, 0), keyId: note.keyId as ChartKeyId }); });
  return freeze({ chartId, tier, layoutVersion: layout.layoutVersion, notes });
}
function visualValue(raw: unknown, chart: ChartData | GuidanceChart): ChartVisualSnapshot {
  const data = fields(raw, ['schemaVersion', 'chartId', 'nodes']);
  if (data.schemaVersion !== 1 || data.chartId !== chart.chartId) { throw new Error('首演视觉身份不匹配'); }
  const ids = new Set<string>(), nodeIds = new Set('lines' in chart ? chart.lines.flatMap(line => line.nodes.map(node => node.id)) : []);
  const nodes = array(data.nodes).map(item => {
    const value = fields(item, ['nodeId', 'color']), nodeId = id(value.nodeId), color = fields(value.color, ['r', 'g', 'b']);
    if (ids.has(nodeId) || !nodeIds.has(nodeId)) { throw new Error('首演视觉节点不存在或重复'); } ids.add(nodeId);
    return freeze({ nodeId, color: { r: integer(color.r, 0, 255), g: integer(color.g, 0, 255), b: integer(color.b, 0, 255) } });
  });
  return freeze({ schemaVersion: 1, chartId: chart.chartId, nodes });
}
function mediaValue(raw: unknown): ChartMediaIdentity {
  const data = fields(raw, ['kind', 'contentId', 'contentRevision', 'resourcePath', 'sha256', 'byteLength']);
  if (data.kind !== 'Audio' && data.kind !== 'Video') { throw new Error('首演媒体种类无效'); }
  if (typeof data.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(data.sha256) ||
      typeof data.resourcePath !== 'string' || !/^(audio|video)\/[\p{L}\p{N}_-]+(?:\/[\p{L}\p{N}_-]+)*$/u.test(data.resourcePath) ||
      (data.kind === 'Audio' && !data.resourcePath.startsWith('audio/')) || (data.kind === 'Video' && !data.resourcePath.startsWith('video/'))) {
    throw new Error('首演媒体须为制作方稳定内容身份与摘要，不能使用临时URL');
  }
  return freeze({ kind: data.kind, contentId: id(data.contentId), contentRevision: id(data.contentRevision),
    resourcePath: data.resourcePath, sha256: data.sha256, byteLength: integer(data.byteLength, 1) });
}
function playValue(raw: unknown, snapshot: ChartSnapshotRecord): ChartScorePlay {
  const data = fields(raw, ['chartId', 'tier', 'perfectCount', 'goodCount', 'missCount', 'totalScore', 'finishedAtMs', 'completed', 'playId', 'guideTransparency']);
  if (data.chartId !== snapshot.chartId || data.tier !== snapshot.chart.tier || data.completed !== true) { throw new Error('只归档同谱面的完整演奏真实结果'); }
  const perfectCount = integer(data.perfectCount), goodCount = integer(data.goodCount), missCount = integer(data.missCount),
    totalScore = finite(data.totalScore, 0), finishedAtMs = finite(data.finishedAtMs, 0), guideTransparency = finite(data.guideTransparency, 0, 100);
  if (data.playId === snapshot.completionEventId && guideTransparency !== snapshot.guideTransparency) { throw new Error('首演成绩透明度与实际冻结配置不一致'); }
  const total = 'lines' in snapshot.chart ? snapshot.chart.lines.reduce((count, line) => count + line.nodes.length, 0) : snapshot.chart.notes.length;
  const judged = perfectCount + goodCount;
  if (!Number.isSafeInteger(judged + missCount) || judged > total ||
      ('lines' in snapshot.chart ? judged + missCount !== total : judged + missCount < total)) { throw new Error('首演成绩计数与实际谱面不一致'); }
  const expected = judged * (CHART_BASE_SCORE + CHART_TRANSPARENCY_BONUS_MAX * guideTransparency / 100);
  if (Math.abs(totalScore - expected) > Math.max(1e-8, Math.abs(expected) * 1e-12)) { throw new Error('成绩不符合冻结计分算法与实际透明度'); }
  return freeze({ chartId: snapshot.chartId, tier: snapshot.chart.tier, perfectCount, goodCount, missCount, totalScore, finishedAtMs,
    completed: true, playId: id(data.playId), guideTransparency });
}
function tierValue(raw: unknown): ChartTier {
  if (raw !== 'Regular' && raw !== 'Character' && raw !== 'World' && raw !== 'Final') { throw new Error('谱面档位无效'); } return raw;
}
function fields(raw: unknown, names: readonly string[]): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || (Object.getPrototypeOf(raw) !== Object.prototype && Object.getPrototypeOf(raw) !== null)) { throw new Error('谱面归档须为普通数据对象'); }
  const descriptors = Object.getOwnPropertyDescriptors(raw);
  if (Reflect.ownKeys(descriptors).length !== names.length) { throw new Error('谱面归档字段无效'); }
  const output: Record<string, unknown> = {};
  for (const name of names) { const value = descriptors[name]; if (!value || !Object.prototype.hasOwnProperty.call(value, 'value')) { throw new Error('谱面归档不可含访问器或缺失字段'); } output[name] = value.value; }
  return output;
}
function array(raw: unknown): readonly unknown[] {
  if (!Array.isArray(raw) || Object.getPrototypeOf(raw) !== Array.prototype) { throw new Error('谱面归档须为数据数组'); }
  const descriptors: PropertyDescriptorMap = Object.getOwnPropertyDescriptors(raw as object), length = descriptors.length?.value as unknown;
  if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0 || Reflect.ownKeys(descriptors).length !== length + 1) { throw new Error('谱面归档数组无效'); }
  const output: unknown[] = [];
  for (let index = 0; index < length; index++) { const value = descriptors[String(index)]; if (!value || !Object.prototype.hasOwnProperty.call(value, 'value')) { throw new Error('谱面归档数组不可稀疏或含访问器'); } output.push(value.value); }
  return output;
}
function id(raw: unknown, maximum = 128): string {
  if (typeof raw !== 'string' || !raw || raw !== raw.trim() || raw.length > maximum) { throw new Error('谱面归档标识无效'); }
  try { encodeURIComponent(raw); } catch { throw new Error('谱面归档标识编码无效'); } return raw;
}
function finite(raw: unknown, minimum = -Infinity, maximum = Infinity): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < minimum || raw > maximum) { throw new Error('谱面归档数值无效'); } return raw;
}
function integer(raw: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): number {
  const value = finite(raw, minimum, maximum); if (!Number.isSafeInteger(value)) { throw new Error('谱面归档计数须为安全整数'); } return value;
}
function freeze<T>(value: T): T { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
function clone(raw: unknown, ancestors = new Set<object>()): unknown {
  if (raw === null || typeof raw === 'string' || typeof raw === 'boolean') { return raw; }
  if (typeof raw === 'number') { return finite(raw); }
  if (!raw || typeof raw !== 'object' || ancestors.has(raw)) { throw new Error('谱面归档只能包含无环数据'); }
  ancestors.add(raw);
  try {
    if (Array.isArray(raw)) { return array(raw).map(value => clone(value, ancestors)); }
    const descriptors = Object.getOwnPropertyDescriptors(raw);
    if ((Object.getPrototypeOf(raw) !== Object.prototype && Object.getPrototypeOf(raw) !== null) || Reflect.ownKeys(descriptors).some(key => typeof key !== 'string')) { throw new Error('谱面归档对象无效'); }
    const output: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const name of Object.keys(descriptors)) { if (!Object.prototype.hasOwnProperty.call(descriptors[name], 'value')) { throw new Error('谱面归档不可包含访问器'); } output[name] = clone(descriptors[name].value, ancestors); }
    return output;
  } finally { ancestors.delete(raw); }
}
function canonical(raw: unknown): string {
  const value = clone(raw);
  const encode = (value: unknown): string => {
    if (Array.isArray(value)) { return '[' + value.map(encode).join(',') + ']'; }
    if (value && typeof value === 'object') { const data = value as Record<string, unknown>; return '{' + Object.keys(data).sort().map(key => JSON.stringify(key) + ':' + encode(data[key])).join(',') + '}'; }
    return JSON.stringify(value);
  };
  return encode(value);
}
/** Canonical SHA-256 of plain frozen content; media hashes describe actual published bytes separately. */
export function chartContentDigest(value: unknown): string {
  const encoded = unescape(encodeURIComponent(canonical(value))), bytes: number[] = [];
  for (let index = 0; index < encoded.length; index++) { bytes.push(encoded.charCodeAt(index)); }
  const size = bytes.length * 8; bytes.push(128); while (bytes.length % 64 !== 56) { bytes.push(0); }
  for (let shift = 56; shift >= 0; shift -= 8) { bytes.push(shift >= 32 ? Math.floor(size / 2 ** shift) & 255 : (size >>> shift) & 255); }
  const k = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19], rotate = (x: number, n: number): number => (x >>> n) | (x << (32 - n));
  for (let offset = 0; offset < bytes.length; offset += 64) {
    const w: number[] = [];
    for (let index = 0; index < 16; index++) { const at = offset + index * 4; w[index] = ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0; }
    for (let index = 16; index < 64; index++) { const a = w[index - 15], b = w[index - 2]; w[index] = (w[index - 16] + (rotate(a,7)^rotate(a,18)^(a>>>3)) + w[index - 7] + (rotate(b,17)^rotate(b,19)^(b>>>10))) >>> 0; }
    let [a,b,c,d,e,f,g,j] = h;
    for (let index = 0; index < 64; index++) { const t1 = (j + (rotate(e,6)^rotate(e,11)^rotate(e,25)) + ((e&f)^(~e&g)) + k[index] + w[index]) >>> 0;
      const t2 = ((rotate(a,2)^rotate(a,13)^rotate(a,22)) + ((a&b)^(a&c)^(b&c))) >>> 0;
      j=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0; }
    [a,b,c,d,e,f,g,j].forEach((value,index) => { h[index] = (h[index] + value) >>> 0; });
  }
  return h.map(value => value.toString(16).padStart(8, '0')).join('');
}
