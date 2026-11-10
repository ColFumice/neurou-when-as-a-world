// 编辑器纯逻辑；不依赖 cc、director、ledger 或文件系统。
import type { ChartTier } from '../../constants';
import type { GuidanceChart, GuidancePosition, ChartNodeKind, GuidanceNode } from '../chart/GuidanceChart';
import { parseGuidanceChart, measurePathLength, positionAtPathDistance } from '../chart/GuidanceChart';
import { guidanceDistanceAtTime, guidanceNodeTime } from '../chart/GuidanceTiming';
import type { KeyboardPadLayout, ChartKeyId } from '../chart/KeyboardPadLayout';
import { resolveGridKeyAt, isMatchingGridKey } from '../chart/KeyboardPadLayout';
import { ChartPremiere } from '../chart/ChartPremiere';
import type { ChartPremiereReader } from '../chart/ChartPremiere';
import type { Strike } from '../chart/Strike';

export interface NoteColor { readonly r: number; readonly g: number; readonly b: number }
export interface MidiNoteEvent {
  readonly id: string; readonly trackId: string; readonly lineId: string;
  readonly timeMs: number; readonly position: GuidancePosition; readonly color: NoteColor;
  readonly pitch: number | null; readonly drumType: string | null;
  readonly velocity: number; readonly endTimeMs: number | null; readonly emphasis: boolean;
}
export interface ChartSourceData {
  readonly schemaVersion: 1; readonly sourceId: string; readonly sourceRevision: string;
  readonly provenance: 'Mock' | 'Midi'; readonly layoutVersion: string; readonly aspectRatio: number;
  readonly mappingVersion: string; readonly mediaDurationMs: number; readonly events: readonly MidiNoteEvent[];
}
export interface GuidanceVisualData {
  readonly schemaVersion: 1; readonly chartId: string;
  readonly nodes: readonly { readonly nodeId: string; readonly color: NoteColor }[];
}
export interface EditorSelection {
  readonly heads: Readonly<Record<string, string>>;
  readonly nodes: Readonly<Record<string, { readonly kind: ChartNodeKind; readonly holdEndEventId: string | null }>>;
}
export interface EditorHistory {
  readonly entries: readonly { readonly label: string; readonly before: EditorSelection; readonly after: EditorSelection }[];
  readonly cursor: number;
}
export interface GuidanceEditorDocument {
  readonly schemaVersion: 1; readonly documentId: string; readonly chartId: string; readonly tier: ChartTier;
  readonly source: ChartSourceData; readonly selection: EditorSelection; readonly history: EditorHistory;
  readonly media: { readonly videoPath: string | null; readonly audioPath: string | null };
}
export interface GuidanceEditorReader {
  getDocument(): GuidanceEditorDocument | null;
  getPreview(): ChartPremiereReader | null;
  getLayout(): KeyboardPadLayout;
  getPreviewData(): { readonly chart: GuidanceChart; readonly visual: GuidanceVisualData } | null;
  exportChart(): { readonly chart: GuidanceChart; readonly visual: GuidanceVisualData };
}
export type GuidanceEditorIntent =
  | { readonly kind: 'LoadSource'; readonly source: unknown }
  | { readonly kind: 'LoadDraft'; readonly document: unknown }
  | { readonly kind: 'LoadPreview'; readonly chart: unknown; readonly visual?: unknown }
  | { readonly kind: 'SetKind'; readonly eventId: string; readonly nodeKind: ChartNodeKind }
  | { readonly kind: 'SetHead'; readonly lineId: string; readonly eventId: string }
  | { readonly kind: 'SetHoldEnd'; readonly eventId: string; readonly endEventId: string }
  | { readonly kind: 'SetMedia'; readonly videoPath: string | null; readonly audioPath: string | null }
  | { readonly kind: 'Undo' | 'Redo' | 'StopPreview' }
  | { readonly kind: 'StartPreview'; readonly mode?: 'Manual' | 'Rehearsal' }
  | { readonly kind: 'Seek'; readonly timeMs: number }
  | { readonly kind: 'Advance'; readonly timeMs: number; readonly ended: boolean }
  | { readonly kind: 'Strike'; readonly strike: Strike }
  | { readonly kind: 'Pause'; readonly timeMs: number };
export interface GuidanceEditorPort { submitEditorIntent(intent: GuidanceEditorIntent): void }

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) { throw new Error('数据必须为对象'); }
  return value as Record<string, unknown>;
}
function exact(value: Record<string, unknown>, keys: readonly string[]): void {
  if (Object.keys(value).some(k => !keys.includes(k)) || keys.some(k => !(k in value))) {
    throw new Error('数据字段缺失或包含未知字段');
  }
}
function finite(value: unknown, min: number, max = Number.MAX_VALUE): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) { throw new Error('数值越界'); }
  return value;
}
function id(value: unknown): string {
  if (typeof value !== 'string' || !/^[\p{L}\p{N}_-]+$/u.test(value) || ['__proto__','constructor','prototype'].includes(value)) { throw new Error('ID 只允许安全的字母、数字、下划线、连字符'); }
  return value;
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function copy<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
export function parseNoteColor(raw: unknown): NoteColor {
  const c = record(raw); exact(c, ['r', 'g', 'b']);
  const channels = [c.r, c.g, c.b].map(v => finite(v, 0, 255));
  if (channels.some(v => !Number.isInteger(v))) { throw new Error('RGB 必须是 sRGB 8 位整数'); }
  return freeze({ r: channels[0], g: channels[1], b: channels[2] });
}
export function parseChartSourceData(raw: unknown, layout: KeyboardPadLayout): ChartSourceData {
  const s = record(raw); exact(s, ['schemaVersion','sourceId','sourceRevision','provenance','layoutVersion','aspectRatio','mappingVersion','mediaDurationMs','events']);
  if (s.schemaVersion !== 1 || (s.provenance !== 'Mock' && s.provenance !== 'Midi') || s.layoutVersion !== layout.layoutVersion) {
    throw new Error('源版本、来源或布局不匹配');
  }
  const duration = finite(s.mediaDurationMs, 1), aspectRatio = finite(s.aspectRatio, Number.MIN_VALUE);
  if (!Array.isArray(s.events) || s.events.length < 2) { throw new Error('至少需要两个源事件'); }
  const seen = new Set<string>();
  const events = s.events.map(rawEvent => {
    const e = record(rawEvent); exact(e, ['id','trackId','lineId','timeMs','position','color','pitch','drumType','velocity','endTimeMs','emphasis']);
    const eventId = id(e.id); if (seen.has(eventId)) { throw new Error('源事件 ID 重复'); } seen.add(eventId);
    const p = record(e.position); exact(p, ['u','v']);
    const timeMs = finite(e.timeMs, 0, duration), position = { u: finite(p.u, 0, 1), v: finite(p.v, 0, 1) };
    const pitch = e.pitch === null ? null : finite(e.pitch, 0, 127), velocity = finite(e.velocity, 0, 127);
    if ((pitch !== null && !Number.isInteger(pitch)) || !Number.isInteger(velocity) || typeof e.emphasis !== 'boolean') { throw new Error('非法 MIDI 音高、力度或强调标记'); }
    return freeze({ id: eventId, trackId: id(e.trackId), lineId: id(e.lineId), timeMs, position,
      color: parseNoteColor(e.color), pitch, drumType: e.drumType === null ? null : id(e.drumType), velocity,
      endTimeMs: e.endTimeMs === null ? null : finite(e.endTimeMs, timeMs, duration), emphasis: e.emphasis });
  }).sort((a, b) => a.timeMs - b.timeMs || a.id.localeCompare(b.id, 'en'));
  return freeze({ schemaVersion: 1, sourceId: id(s.sourceId), sourceRevision: id(s.sourceRevision), provenance: s.provenance,
    layoutVersion: layout.layoutVersion, aspectRatio, mappingVersion: id(s.mappingVersion), mediaDurationMs: duration, events });
}

export function parseGuidanceVisualData(raw: unknown, chart: GuidanceChart): GuidanceVisualData {
  const s = record(raw); exact(s, ['schemaVersion','chartId','nodes']);
  if (s.schemaVersion !== 1 || s.chartId !== chart.chartId || !Array.isArray(s.nodes)) { throw new Error('视觉伴随文件与谱面不匹配'); }
  const ids = new Set(chart.lines.flatMap(l => l.nodes.map(n => n.id))), seen = new Set<string>();
  const nodes = s.nodes.map(rawNode => {
    const n = record(rawNode); exact(n, ['nodeId','color']); const nodeId = id(n.nodeId);
    if (!ids.has(nodeId) || seen.has(nodeId)) { throw new Error('视觉节点未知或重复'); } seen.add(nodeId);
    return { nodeId, color: parseNoteColor(n.color) };
  });
  return freeze({ schemaVersion: 1, chartId: chart.chartId, nodes });
}

export class GuidanceEditorSession implements GuidanceEditorReader, GuidanceEditorPort {
  private document: GuidanceEditorDocument | null = null;
  private preview: ChartPremiere | null = null;
  private loadedPreview: { readonly chart: GuidanceChart; readonly visual: GuidanceVisualData } | null = null;
  private readonly strikes: Strike[] = [];
  private rehearsal = false;
  private readonly automaticInputs = new Set<string>();
  private readonly held = new Set<ChartKeyId>();
  constructor(private readonly layout: KeyboardPadLayout) {}
  getDocument(): GuidanceEditorDocument | null { return this.document; }
  getPreview(): ChartPremiereReader | null { return this.preview; }
  getLayout(): KeyboardPadLayout { return this.layout; }
  getPreviewData(): { readonly chart: GuidanceChart; readonly visual: GuidanceVisualData } | null {
    return this.loadedPreview ?? (this.document ? this.exportChart() : null);
  }
  submitEditorIntent(intent: GuidanceEditorIntent): void {
    if (intent.kind === 'LoadPreview') {
      const chart = parseGuidanceChart(intent.chart, this.layout);
      const visual = parseGuidanceVisualData(intent.visual ?? { schemaVersion: 1, chartId: chart.chartId, nodes: [] }, chart);
      this.stop(); this.loadedPreview = freeze({ chart, visual }); return;
    }
    if (intent.kind === 'LoadSource') {
      const source = parseChartSourceData(intent.source, this.layout), heads: Record<string,string> = {}, nodes: Record<string,{kind:ChartNodeKind;holdEndEventId:string|null}> = {};
      for (const e of source.events) { if (!heads[e.lineId]) { heads[e.lineId] = e.id; } nodes[e.id] = { kind: 'Tap', holdEndEventId: null }; }
      this.document = freeze({ schemaVersion: 1, documentId: source.sourceId, chartId: source.sourceId + '-chart', tier: 'Regular', source,
        selection: { heads, nodes }, history: { entries: [], cursor: 0 }, media: { videoPath: null, audioPath: null } });
      this.stop(); this.loadedPreview = null; return;
    }
    if (intent.kind === 'LoadDraft') { this.loadDraft(intent.document); return; }
    if (intent.kind === 'StartPreview') { this.stop(); this.rehearsal = intent.mode === 'Rehearsal'; this.rebuildPreview(0); return; }
    if (intent.kind === 'StopPreview') { this.stop(); return; }
    if (intent.kind === 'Seek') { finite(intent.timeMs, 0); this.rehearsal = false; this.rebuildPreview(intent.timeMs); return; }
    if (intent.kind === 'Strike') { if (this.preview?.getState() === 'Playing' || this.preview?.getState() === 'Paused') {
      if (this.preview.getState() === 'Playing' || intent.strike.phase === 'Up') { this.strikes.push(copy(intent.strike)); }
      this.preview.submitStrike(intent.strike);
    } return; }
    if (intent.kind === 'Advance') {
      if (this.rehearsal && this.preview?.getState() === 'Playing') { this.autoInput(intent.timeMs); }
      this.preview?.advance(intent.timeMs); this.preview?.advanceMediaStatus(intent.ended, false, 0); return;
    }
    if (intent.kind === 'Pause') { this.preview?.togglePause(intent.timeMs); return; }
    if (!this.document) { throw new Error('请先加载源数据或草稿'); }
    if (intent.kind === 'Undo' || intent.kind === 'Redo') {
      const h = this.document.history, cursor = h.cursor + (intent.kind === 'Undo' ? -1 : 1);
      if (cursor < 0 || cursor > h.entries.length) { return; }
      const selection = intent.kind === 'Undo' ? h.entries[cursor].before : h.entries[cursor - 1].after;
      this.document = freeze({ ...this.document, selection, history: { ...h, cursor } }); this.stop(); this.loadedPreview = null; return;
    }
    if (intent.kind === 'SetMedia') {
      this.document = freeze({ ...this.document, media: { videoPath: intent.videoPath, audioPath: intent.audioPath } }); this.stop(); return;
    }
    if (!('eventId' in intent)) { return; }
    const before = this.document.selection, selection = copy(before);
    const event = this.document.source.events.find(e => e.id === intent.eventId);
    if (!event) { throw new Error('未知源事件'); }
    const mutable = selection as { heads: Record<string,string>; nodes: Record<string,{kind:ChartNodeKind;holdEndEventId:string|null}> };
    if (intent.kind === 'SetKind') {
      if (!['Tap','Drag','Hold'].includes(intent.nodeKind)) { throw new Error('未知节点类型'); }
      mutable.nodes[event.id] = { kind: intent.nodeKind, holdEndEventId: null };
    } else if (intent.kind === 'SetHead') {
      if (event.lineId !== intent.lineId) { throw new Error('Head 必须属于该线'); }
      // 选非首事件会使此前事件失去归属，禁止静默丢音。
      if (this.document.source.events.find(e => e.lineId === event.lineId)!.id !== event.id) { throw new Error('Head 必须是该线最早事件'); }
      mutable.heads[event.lineId] = event.id;
    } else if (intent.kind === 'SetHoldEnd') {
      const end = this.document.source.events.find(e => e.id === intent.endEventId);
      if (!end || end.lineId !== event.lineId || end.timeMs <= event.timeMs || mutable.nodes[event.id].kind !== 'Hold') { throw new Error('Hold 尾端必须是同线更晚源事件'); }
      mutable.nodes[event.id].holdEndEventId = end.id;
    }
    const entries = [...this.document.history.entries.slice(0, this.document.history.cursor), { label: intent.kind, before, after: selection }].slice(-100);
    this.document = freeze({ ...this.document, selection, history: { entries, cursor: entries.length } }); this.stop(); this.loadedPreview = null;
  }
  exportChart(): { readonly chart: GuidanceChart; readonly visual: GuidanceVisualData } {
    if (!this.document) { throw new Error('没有草稿'); }
    const d = this.document, visual: {nodeId:string;color:NoteColor}[] = [];
    const lines = Object.entries(d.selection.heads).map(([lineId, headEventId]) => {
      const events = d.source.events.filter(e => e.lineId === lineId), head = events.find(e => e.id === headEventId);
      if (!head || events[0].id !== head.id || events.length < 2) { throw new Error(lineId + ': Head 必须是首事件且线至少两事件'); }
      const points: GuidancePosition[] = [], distances = new Map<string,number>(); let distance = 0;
      for (const e of events) {
        const last = points[points.length - 1];
        if (!last || last.u !== e.position.u || last.v !== e.position.v) {
          if (last) { distance += measurePathLength({ kind: 'Polyline', points: [last,e.position] }, d.source.aspectRatio); }
          points.push(e.position);
        }
        distances.set(e.id, distance);
      }
      const timing: {nodeId:string;targetTimeMs:number;endTargetTimeMs?:number}[] = [];
      const nodes: GuidanceNode[] = events.filter(e => e.id !== head.id).map(e => {
        const selection = d.selection.nodes[e.id]; if (!selection) { throw new Error('节点选择缺失'); }
        const pathDistance = distances.get(e.id)!, nodeId = 'node-' + e.id;
        visual.push({ nodeId, color: e.color });
        const t = { nodeId, targetTimeMs: e.timeMs }; timing.push(t);
        if (selection.kind === 'Tap') { return { id: nodeId, kind: 'Tap', pathDistance }; }
        const keyId = resolveGridKeyAt(this.layout, e.position);
        if (!keyId) { throw new Error(e.id + ': 节点位置没有有效网格键'); }
        if (selection.kind === 'Drag') { return { id: nodeId, kind: 'Drag', pathDistance, keyId }; }
        const end = events.find(n => n.id === selection.holdEndEventId);
        if (!end || end.timeMs <= e.timeMs || distances.get(end.id)! <= pathDistance) { throw new Error(e.id + ': 请选更晚且距离更大的 Hold 尾端'); }
        timing[timing.length - 1] = { ...t, endTargetTimeMs: end.timeMs };
        return { id: nodeId, kind: 'Hold', pathDistance, endPathDistance: distances.get(end.id)!, keyId };
      });
      // Tap 同样必须落入合法网格，避免生成不可命中的谱面。
      if (events.slice(1).some(e => !resolveGridKeyAt(this.layout, e.position))) { throw new Error('普通节点必须位于有效网格'); }
      return { id: 'line-' + lineId, head: { id: 'head-' + head.id, spawnTimeMs: head.timeMs, targetTimeMs: head.timeMs },
        path: { kind: 'Polyline', points }, nodes, timing };
    });
    const chart = parseGuidanceChart({ schemaVersion: 3, chartId: d.chartId, tier: d.tier,
      layoutVersion: d.source.layoutVersion, aspectRatio: d.source.aspectRatio, lines }, this.layout);
    return freeze({ chart, visual: parseGuidanceVisualData({ schemaVersion: 1, chartId: chart.chartId, nodes: visual }, chart) });
  }
  private stop(): void { this.preview = null; this.strikes.length = 0; this.rehearsal = false; this.automaticInputs.clear(); this.held.clear(); }
  private autoInput(now: number): void {
    const chart = this.getPreviewData()!.chart, p = this.preview!;
    const edge = (keyId: ChartKeyId, phase: 'Down' | 'Up'): void => {
      const strike = { keyId, phase, videoTimeMs: now }; this.strikes.push(strike); p.submitStrike(strike);
    };
    for (const line of chart.lines) {
      if (now >= line.head.spawnTimeMs && now <= line.head.spawnTimeMs + 1000 &&
          !this.automaticInputs.has(line.head.id)) {
        this.automaticInputs.add(line.head.id); edge('Space','Down'); edge('Space','Up');
      }
    }
    const desired = new Set<ChartKeyId>();
    for (const line of chart.lines) {
      const snapshot = p.getGuidanceSnapshots().find(s => s.id === line.id)!;
      if (snapshot.startedAtMs === null) { continue; }
      for (const node of line.nodes) {
        const target = guidanceNodeTime(line, snapshot.startedAtMs, node);
        const end = node.kind === 'Hold' ? guidanceNodeTime(line, snapshot.startedAtMs, node, true) : target;
        if ('keyId' in node && now >= target - 80 && now < end + 80) { desired.add(node.keyId); }
      }
    }
    for (const key of desired) { if (!this.held.has(key)) { this.held.add(key); edge(key,'Down'); } }
    for (const key of [...this.held]) { if (!desired.has(key)) { this.held.delete(key); edge(key,'Up'); } }
    for (const line of chart.lines) {
      const snapshot = p.getGuidanceSnapshots().find(s => s.id === line.id)!;
      if (snapshot.startedAtMs === null) { continue; }
      for (const node of line.nodes) {
        if (node.kind !== 'Tap' || this.automaticInputs.has(node.id) || now < guidanceNodeTime(line, snapshot.startedAtMs, node) - 8) { continue; }
        if (snapshot.nodes.find(n => n.node.id === node.id)!.tier !== null) { this.automaticInputs.add(node.id); continue; }
        const position = positionAtPathDistance(line.path,chart.aspectRatio,guidanceDistanceAtTime(line,snapshot.startedAtMs,now));
        const required = resolveGridKeyAt(this.layout,position);
        const key = required === null ? undefined : this.layout.slots.find(slot =>
          !this.held.has(slot.keyId) && isMatchingGridKey(this.layout,required,slot.keyId))?.keyId;
        if (key !== undefined) { this.automaticInputs.add(node.id); edge(key,'Down'); edge(key,'Up'); }
      }
    }
  }
  private rebuildPreview(timeMs: number): void {
    const data = this.getPreviewData(); if (!data) { throw new Error('先加载源数据或导出的谱面'); }
    const p = new ChartPremiere(data.chart, this.layout); p.begin();
    for (const strike of this.strikes.filter(s => s.videoTimeMs <= timeMs)) { p.submitStrike(strike); }
    p.advance(timeMs); this.preview = p;
    // A new branch after seek cannot inherit future inputs.
    const past = this.strikes.filter(s => s.videoTimeMs <= timeMs); this.strikes.splice(0, this.strikes.length, ...past);
  }
  private loadDraft(raw: unknown): void {
    const d = record(raw); exact(d,['schemaVersion','documentId','chartId','tier','source','selection','history','media']);
    if (d.schemaVersion !== 1 || !['Regular','Character','World','Final'].includes(String(d.tier))) { throw new Error('非法草稿版本或 tier'); }
    const source = parseChartSourceData(d.source, this.layout), media = record(d.media); exact(media,['videoPath','audioPath']);
    if ([media.videoPath,media.audioPath].some(p => p !== null && typeof p !== 'string')) { throw new Error('媒体引用必须为路径或 null'); }
    const validateSelection = (rawSelection: unknown): EditorSelection => {
      const s = record(rawSelection); exact(s,['heads','nodes']); const heads = record(s.heads), nodes = record(s.nodes);
      const lineIds = new Set(source.events.map(e => e.lineId));
      if (Object.keys(heads).length !== lineIds.size || [...lineIds].some(l => heads[l] !== source.events.find(e => e.lineId === l)!.id) || Object.keys(nodes).length !== source.events.length) { throw new Error('草稿 Head 或节点引用不完整'); }
      for (const e of source.events) { const n = record(nodes[e.id]); exact(n,['kind','holdEndEventId']);
        if (!['Tap','Drag','Hold'].includes(String(n.kind))) { throw new Error('非法节点类型'); }
        if (n.holdEndEventId !== null && (n.kind !== 'Hold' || !source.events.some(end => end.id === n.holdEndEventId && end.lineId === e.lineId && end.timeMs > e.timeMs))) { throw new Error('非法 Hold 尾端'); }
      }
      return freeze(copy(s) as unknown as EditorSelection);
    };
    const h = record(d.history); exact(h,['entries','cursor']);
    if (!Array.isArray(h.entries) || h.entries.length > 100 || !Number.isInteger(h.cursor) || Number(h.cursor) < 0 || Number(h.cursor) > h.entries.length) { throw new Error('非法历史游标'); }
    const entries = h.entries.map(rawEntry => { const e = record(rawEntry); exact(e,['label','before','after']);
      if (!['SetKind','SetHead','SetHoldEnd'].includes(String(e.label))) { throw new Error('非法历史操作'); }
      return { label: String(e.label), before: validateSelection(e.before), after: validateSelection(e.after) };
    });
    const selection = validateSelection(d.selection), cursor = Number(h.cursor);
    for (let i = 1; i < entries.length; i += 1) { if (JSON.stringify(entries[i-1].after) !== JSON.stringify(entries[i].before)) { throw new Error('历史链断裂'); } }
    if (entries.length && JSON.stringify(selection) !== JSON.stringify(cursor ? entries[cursor-1].after : entries[0].before)) { throw new Error('历史与当前选择不一致'); }
    this.document = freeze({ schemaVersion: 1, documentId: id(d.documentId), chartId: id(d.chartId), tier: d.tier as ChartTier,
      source, selection, media: media as unknown as GuidanceEditorDocument['media'], history: {entries,cursor} }); this.stop(); this.loadedPreview = null;
  }
}
