import type { GuidancePosition } from '../chart/GuidanceChart';
import type { KeyboardPadLayout } from '../chart/KeyboardPadLayout';
import type { NoteColor } from '../editor/GuidanceEditorSession';

/** 音乐工程是可编辑的生产者数据；不是最终谱面，也不保存引擎资源。 */
export interface TempoPoint { readonly tick: number; readonly bpm: number }
export interface MusicTimeSignature { readonly numerator: number; readonly denominator: number }
export interface NoteDefinition {
  readonly id: string;
  readonly tick: number;
  readonly durationTicks: number;
  readonly pitch: number;
  readonly velocity: number;
  /** 用户显式指定的归一化谱面位置；音高不暗中生成位置。 */
  readonly position: GuidancePosition;
}
export interface TrackDefinition {
  readonly id: string;
  readonly title: string;
  readonly lineId: string;
  readonly offsetMs: number;
  readonly color: NoteColor;
  readonly notes: readonly NoteDefinition[];
}
export interface MusicProjectData {
  readonly schemaVersion: 1;
  readonly projectId: string;
  readonly title: string;
  readonly ppq: number;
  readonly tempoMap: readonly TempoPoint[];
  readonly timeSignature: MusicTimeSignature;
  readonly durationTicks: number;
  readonly layoutVersion: string;
  readonly aspectRatio: number;
  readonly mappingVersion: string;
  readonly tracks: readonly TrackDefinition[];
}

/** 模块内统一严格解析工具，不返回原输入引用。 */
export function musicRecord(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) { throw new Error('音乐数据必须为对象'); }
  const prototype = Object.getPrototypeOf(raw);
  if (prototype !== Object.prototype && prototype !== null) { throw new Error('音乐数据必须为普通对象'); }
  return raw as Record<string, unknown>;
}
export function musicExact(raw: Record<string, unknown>, keys: readonly string[]): void {
  if (Reflect.ownKeys(raw).some(k => typeof k !== 'string' || !keys.includes(k)) || keys.some(k => !Object.prototype.hasOwnProperty.call(raw, k))) {
    throw new Error('音乐数据字段缺失或包含未知字段');
  }
}
export function musicFinite(raw: unknown, min: number, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < min || raw > max) { throw new Error('音乐数值越界'); }
  return raw;
}
export function musicInteger(raw: unknown, min: number, max = Number.MAX_SAFE_INTEGER): number {
  const n = musicFinite(raw, min, max);
  if (!Number.isSafeInteger(n)) { throw new Error('音乐数值必须是安全整数'); }
  return n;
}
export function musicId(raw: unknown): string {
  if (typeof raw !== 'string' || !/^[\p{L}\p{N}_-]+$/u.test(raw) ||
      ['__proto__', 'constructor', 'prototype'].includes(raw)) { throw new Error('音乐 ID 必须为安全字母、数字、下划线、连字符'); }
  return raw;
}
function musicTitle(raw: unknown): string {
  if (typeof raw !== 'string' || raw.trim().length === 0 || raw.length > 200) { throw new Error('音乐标题必须为 1 至 200 字符'); }
  return raw;
}
export function freezeMusicData<T>(raw: T): T {
  if (raw && typeof raw === 'object') { Object.values(raw).forEach(freezeMusicData); Object.freeze(raw); }
  return raw;
}

export function parseMusicProjectData(raw: unknown, layout?: KeyboardPadLayout): MusicProjectData {
  const p = musicRecord(raw);
  musicExact(p, ['schemaVersion','projectId','title','ppq','tempoMap','timeSignature','durationTicks',
    'layoutVersion','aspectRatio','mappingVersion','tracks']);
  if (p.schemaVersion !== 1) { throw new Error('仅支持 MusicProjectData schemaVersion=1'); }
  const ppq = musicInteger(p.ppq, 1, 32767), durationTicks = musicInteger(p.durationTicks, 1, ppq * 4096);
  const layoutVersion = musicId(p.layoutVersion);
  if (layout && layoutVersion !== layout.layoutVersion) { throw new Error('音乐工程布局版本不匹配'); }
  if (p.mappingVersion !== 'music-mapping-1') { throw new Error('不支持该音乐位置映射版本'); }
  const signature = musicRecord(p.timeSignature); musicExact(signature, ['numerator','denominator']);
  const numerator = musicInteger(signature.numerator, 1, 32), denominator = musicInteger(signature.denominator, 1, 32);
  if (![1,2,4,8,16,32].includes(denominator) || !Number.isSafeInteger(ppq * 4 / denominator)) {
    throw new Error('拍号分母必须为 1/2/4/8/16/32，且拍长必须能表示为整数 tick');
  }
  if (!Array.isArray(p.tempoMap) || p.tempoMap.length === 0) { throw new Error('tempoMap 至少包含 tick=0 的 BPM'); }
  const tempoMap = p.tempoMap.map(rawPoint => {
    const t = musicRecord(rawPoint); musicExact(t, ['tick','bpm']);
    return { tick: musicInteger(t.tick, 0, durationTicks - 1), bpm: musicFinite(t.bpm, 20, 320) };
  }).sort((a,b) => a.tick - b.tick);
  if (tempoMap[0].tick !== 0 || tempoMap.some((t,i) => i > 0 && t.tick === tempoMap[i-1].tick)) {
    throw new Error('tempoMap 必须从 tick=0 开始且时点唯一');
  }
  if (!Array.isArray(p.tracks) || p.tracks.length === 0) { throw new Error('音乐工程至少需要一条音轨'); }
  const trackIds = new Set<string>(), noteIds = new Set<string>();
  const tracks = p.tracks.map(rawTrack => {
    const t = musicRecord(rawTrack); musicExact(t, ['id','title','lineId','offsetMs','color','notes']);
    const trackId = musicId(t.id);
    if (trackIds.has(trackId)) { throw new Error('音轨 ID 重复'); } trackIds.add(trackId);
    const c = musicRecord(t.color); musicExact(c, ['r','g','b']);
    const color = { r: musicInteger(c.r,0,255), g: musicInteger(c.g,0,255), b: musicInteger(c.b,0,255) };
    if (!Array.isArray(t.notes)) { throw new Error('音轨 notes 必须为数组'); }
    const notes = t.notes.map(rawNote => {
      const n = musicRecord(rawNote); musicExact(n, ['id','tick','durationTicks','pitch','velocity','position']);
      const noteId = musicId(n.id); if (noteIds.has(noteId)) { throw new Error('音符 ID 必须跨轨唯一'); } noteIds.add(noteId);
      const tick = musicInteger(n.tick,0,durationTicks-1), noteDuration = musicInteger(n.durationTicks,1,durationTicks-tick);
      const position = musicRecord(n.position); musicExact(position, ['u','v']);
      return { id: noteId, tick, durationTicks: noteDuration, pitch: musicInteger(n.pitch,0,127),
        velocity: musicInteger(n.velocity,0,127), position: { u: musicFinite(position.u,0,1), v: musicFinite(position.v,0,1) } };
    }).sort((a,b) => a.tick - b.tick || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return { id: trackId, title: musicTitle(t.title), lineId: musicId(t.lineId),
      offsetMs: musicFinite(t.offsetMs,-Number.MAX_SAFE_INTEGER), color, notes };
  });
  const project: MusicProjectData = { schemaVersion: 1, projectId: musicId(p.projectId), title: musicTitle(p.title), ppq,
    tempoMap, timeSignature: { numerator, denominator }, durationTicks, layoutVersion,
    aspectRatio: musicFinite(p.aspectRatio,Number.MIN_VALUE), mappingVersion: musicId(p.mappingVersion), tracks };
  // 时间换算的有限性和负偏移在加载时校验；位置落格等发布约束由 Builder 校验。
  const timeAt = (tick: number): number => {
    let ms = 0;
    for (let i=0; i<tempoMap.length && tempoMap[i].tick < tick; i++) {
      const start = tempoMap[i], end = Math.min(tick, tempoMap[i+1]?.tick ?? tick);
      ms += (end-start.tick) * 60000 / (ppq * start.bpm);
    }
    return musicFinite(ms,0);
  };
  const durationMs = timeAt(durationTicks) + Math.max(0,...tracks.map(t=>t.offsetMs));
  musicFinite(durationMs,Number.MIN_VALUE);
  for (const track of tracks) {
    for (const note of track.notes) {
      const start = musicFinite(timeAt(note.tick)+track.offsetMs,0,durationMs);
      musicFinite(timeAt(note.tick+note.durationTicks)+track.offsetMs,Number.MIN_VALUE,durationMs);
      if (timeAt(note.tick+note.durationTicks)+track.offsetMs <= start) { throw new Error('音符毫秒尾端必须晚于起点'); }
    }
  }
  return freezeMusicData(project);
}

export function createDefaultMusicProject(layout: KeyboardPadLayout): MusicProjectData {
  const keys = ['KeyA','KeyF','KeyJ','KeyQ','KeyT','KeyP'];
  const positions = keys.map(key => {
    const slot = layout.slots.find(s=>s.keyId===key);
    if (!slot) { throw new Error('默认音乐工程需要布局键 ' + key); }
    return { u: slot.u + slot.width / 2, v: slot.v + slot.height / 2 };
  });
  const track = (index: number, title: string, color: NoteColor): TrackDefinition => ({
    id: 'track-' + (index+1), title, lineId: 'music-line-' + (index+1), offsetMs: 0, color,
    notes: [0,1,2].map(n=>({ id: 'music-note-' + (index*3+n+1), tick: 960+n*960+index*240,
      durationTicks: 240, pitch: 60+index*12+n*4, velocity: 90, position: positions[index*3+n] })),
  });
  return parseMusicProjectData({ schemaVersion: 1, projectId: 'music-project-1', title: '雨若 · 音乐工程', ppq: 480,
    tempoMap: [{ tick: 0, bpm: 120 }], timeSignature: { numerator: 4, denominator: 4 }, durationTicks: 15360,
    layoutVersion: layout.layoutVersion, aspectRatio: 16/9, mappingVersion: 'music-mapping-1',
    tracks: [track(0,'钢琴主旋律',{r:110,g:190,b:255}),track(1,'伴奏音轨',{r:230,g:166,b:96})] }, layout);
}
