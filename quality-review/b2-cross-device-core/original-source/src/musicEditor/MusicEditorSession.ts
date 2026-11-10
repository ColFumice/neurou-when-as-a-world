import type { KeyboardPadLayout } from '../chart/KeyboardPadLayout';
import type { ChartSourceData } from '../editor/GuidanceEditorSession';
import type { MusicProjectData, NoteDefinition } from './MusicProjectData';
import { parseMusicProjectData, freezeMusicData, musicRecord, musicExact, musicInteger, musicId, musicFinite } from './MusicProjectData';
import { buildChartSource } from './ChartSourceBuilder';
import { tickToTimeMs, musicProjectDurationMs, timeMsToTick } from './MusicTiming';

export interface MusicEditorHistory {
  readonly entries: readonly { readonly label: string; readonly before: MusicProjectData; readonly after: MusicProjectData }[];
  readonly cursor: number;
}
export interface MusicEditorDocument {
  readonly schemaVersion: 1;
  readonly documentId: string;
  readonly project: MusicProjectData;
  readonly history: MusicEditorHistory;
  readonly revision: number;
}
export interface MusicPlaybackNote {
  readonly id: string; readonly trackId: string; readonly timeMs: number; readonly endTimeMs: number;
  readonly pitch: number; readonly velocity: number;
}
export interface MusicEditorReader {
  getDocument(): MusicEditorDocument | null;
  getLayout(): KeyboardPadLayout;
  getDurationMs(): number;
  getTickAtTimeMs(timeMs: number): number;
  exportSource(): ChartSourceData;
  getPlaybackNotes(): readonly MusicPlaybackNote[];
}
export type MusicEditorIntent =
  | { readonly kind: 'LoadProject'; readonly project: unknown }
  | { readonly kind: 'LoadDraft'; readonly document: unknown }
  | { readonly kind: 'AddNote'; readonly trackId: string; readonly note: NoteDefinition }
  | { readonly kind: 'ChangeNote'; readonly trackId: string; readonly noteId: string; readonly note: NoteDefinition }
  | { readonly kind: 'DeleteNote'; readonly trackId: string; readonly noteId: string }
  | { readonly kind: 'DeleteNotes'; readonly noteIds: readonly string[] }
  | { readonly kind: 'MoveNotes'; readonly noteIds: readonly string[]; readonly deltaTick: number; readonly deltaPitch: number }
  | { readonly kind: 'PasteNotes'; readonly trackId: string; readonly notes: readonly NoteDefinition[] }
  | { readonly kind: 'SetTempo'; readonly bpm: number }
  | { readonly kind: 'Undo' }
  | { readonly kind: 'Redo' };
export interface MusicEditorPort { submitMusicEditorIntent(intent: MusicEditorIntent): void }

function assertHistoryTransition(label: string, before: MusicProjectData, after: MusicProjectData): void {
  const equal = (a: unknown,b: unknown): boolean => JSON.stringify(a)===JSON.stringify(b);
  if (equal(before,after)) { throw new Error('音乐历史不得记录空事务'); }
  if (label==='SetTempo') {
    if (after.tempoMap.length!==1 || after.tempoMap[0].tick!==0 ||
        !equal({...before,tempoMap:[]},{...after,tempoMap:[]})) { throw new Error('SetTempo 历史不能改写非 BPM 字段'); }
    return;
  }
  if (!equal({...before,tracks:[]},{...after,tracks:[]}) || before.tracks.length!==after.tracks.length) {
    throw new Error('音符历史不能改写项目属性或增删音轨');
  }
  let changed = 0, totalAdded = 0, totalDeleted = 0, totalEdited = 0;
  let moveDelta: { readonly tick: number; readonly pitch: number } | null = null;
  for (let i=0;i<before.tracks.length;i++) {
    const a = before.tracks[i], b = after.tracks[i];
    if (!equal({...a,notes:[]},{...b,notes:[]})) { throw new Error('音符历史不能改写音轨属性'); }
    if (equal(a.notes,b.notes)) { continue; }
    changed++;
    const oldIds = new Set(a.notes.map(n=>n.id)), newIds = new Set(b.notes.map(n=>n.id));
    const added = b.notes.filter(n=>!oldIds.has(n.id)), deleted = a.notes.filter(n=>!newIds.has(n.id));
    const edited = a.notes.filter(n=>newIds.has(n.id) && !equal(n,b.notes.find(m=>m.id===n.id)));
    totalAdded += added.length; totalDeleted += deleted.length; totalEdited += edited.length;
    if ((label==='AddNote' && (added.length!==1 || deleted.length!==0 || edited.length!==0)) ||
        (label==='DeleteNote' && (added.length!==0 || deleted.length!==1 || edited.length!==0)) ||
        (label==='ChangeNote' && (added.length!==0 || deleted.length!==0 || edited.length!==1))) {
      throw new Error('音乐历史标签与音符事务不一致');
    }
    if (label==='MoveNotes') {
      for (const previous of edited) {
        const next = b.notes.find(n=>n.id===previous.id)!;
        if (!equal({...previous,tick:0,pitch:0},{...next,tick:0,pitch:0})) {
          throw new Error('MoveNotes 历史只能改写 tick 和 pitch');
        }
        const delta = { tick: next.tick-previous.tick, pitch: next.pitch-previous.pitch };
        if (moveDelta && (delta.tick!==moveDelta.tick || delta.pitch!==moveDelta.pitch)) {
          throw new Error('MoveNotes 历史必须为整组共同位移');
        }
        moveDelta = delta;
      }
    }
  }
  if (label==='DeleteNotes') {
    if (totalAdded!==0 || totalDeleted<1 || totalEdited!==0) { throw new Error('DeleteNotes 历史只能批量删除真实音符'); }
  } else if (label==='MoveNotes') {
    if (totalAdded!==0 || totalDeleted!==0 || totalEdited<1 || !moveDelta || (moveDelta.tick===0 && moveDelta.pitch===0)) {
      throw new Error('MoveNotes 历史必须保留音符身份并发生共同位移');
    }
  } else if (label==='PasteNotes') {
    if (changed!==1 || totalAdded<1 || totalDeleted!==0 || totalEdited!==0) { throw new Error('PasteNotes 历史只能向一条音轨加入新音符'); }
  } else if (changed!==1) { throw new Error('音乐历史音符事务必须只修改一条音轨'); }
}

function selectedNoteIds(raw: readonly string[], project: MusicProjectData): ReadonlySet<string> {
  if (!Array.isArray(raw)) { throw new Error('批量 noteIds 必须为数组'); }
  const known = new Set(project.tracks.flatMap(track=>track.notes.map(note=>note.id))), selected = new Set<string>();
  for (const rawId of raw) {
    const id = musicId(rawId);
    if (selected.has(id)) { throw new Error('批量 noteIds 重复'); }
    if (!known.has(id)) { throw new Error('批量操作引用未知音符'); }
    selected.add(id);
  }
  return selected;
}

/** 解析完整历史链；restore 不能携带异项目快照或不一致的 cursor 状态。 */
export function parseMusicEditorDocument(raw: unknown, layout: KeyboardPadLayout): MusicEditorDocument {
  const d = musicRecord(raw); musicExact(d,['schemaVersion','documentId','project','history','revision']);
  if (d.schemaVersion !== 1) { throw new Error('仅支持 MusicEditorDocument schemaVersion=1'); }
  const project = parseMusicProjectData(d.project,layout), documentId = musicId(d.documentId);
  const revision = musicInteger(d.revision,0), h = musicRecord(d.history); musicExact(h,['entries','cursor']);
  if (!Array.isArray(h.entries) || h.entries.length>100) { throw new Error('音乐历史必须为数组且不超过 100 步'); }
  const labels = ['AddNote','ChangeNote','DeleteNote','SetTempo','DeleteNotes','MoveNotes','PasteNotes'];
  const entries = h.entries.map(rawEntry=> {
    const e = musicRecord(rawEntry); musicExact(e,['label','before','after']);
    if (typeof e.label !== 'string' || !labels.includes(e.label)) { throw new Error('音乐历史事务标签非法'); }
    const before = parseMusicProjectData(e.before,layout), after = parseMusicProjectData(e.after,layout);
    if (before.projectId!==project.projectId || after.projectId!==project.projectId) { throw new Error('音乐历史项目身份不一致'); }
    assertHistoryTransition(e.label,before,after);
    return { label: e.label, before, after };
  });
  const cursor = musicInteger(h.cursor,0,entries.length), equal = (a: MusicProjectData,b: MusicProjectData): boolean => JSON.stringify(a)===JSON.stringify(b);
  for (let i=1;i<entries.length;i++) { if (!equal(entries[i-1].after,entries[i].before)) { throw new Error('音乐历史快照链断裂'); } }
  if (entries.length && !equal(project,cursor===0?entries[0].before:entries[cursor-1].after)) {
    throw new Error('音乐草稿项目与历史游标不一致');
  }
  if (revision<entries.length) { throw new Error('音乐草稿 revision 小于历史步数'); }
  return freezeMusicData({ schemaVersion: 1, documentId, project, history: { entries,cursor }, revision });
}

export class MusicEditorSession implements MusicEditorReader, MusicEditorPort {
  private document: MusicEditorDocument | null = null;
  private readonly layout: KeyboardPadLayout;
  constructor(layout: KeyboardPadLayout) {
    // Session 永不冻结调用方；读取布局也是隔离的深冻结快照。
    this.layout = freezeMusicData({ layoutVersion: layout.layoutVersion, slots: layout.slots.map(s=>({...s})) });
  }
  getDocument(): MusicEditorDocument | null { return this.document; }
  getLayout(): KeyboardPadLayout { return this.layout; }
  getDurationMs(): number { return this.document ? musicProjectDurationMs(this.document.project) : 0; }
  getTickAtTimeMs(timeMs: number): number { return this.document ? timeMsToTick(this.document.project,timeMs) : 0; }
  exportSource(): ChartSourceData {
    if (!this.document) { throw new Error('请先加载音乐工程'); }
    return buildChartSource(this.document.project,this.document.revision,this.layout);
  }
  getPlaybackNotes(): readonly MusicPlaybackNote[] {
    if (!this.document) { return freezeMusicData([]); }
    const project = this.document.project;
    return freezeMusicData(project.tracks.flatMap(track=>track.notes.map(note=>({
      id: note.id, trackId: track.id, timeMs: tickToTimeMs(project,note.tick)+track.offsetMs,
      endTimeMs: tickToTimeMs(project,note.tick+note.durationTicks)+track.offsetMs,
      pitch: note.pitch, velocity: note.velocity,
    }))).sort((a,b)=>a.timeMs-b.timeMs || (a.id<b.id?-1:a.id>b.id?1:0)));
  }
  submitMusicEditorIntent(intent: MusicEditorIntent): void {
    if (intent.kind==='LoadProject') {
      const project = parseMusicProjectData(intent.project,this.layout);
      this.document = freezeMusicData({ schemaVersion: 1, documentId: project.projectId+'-draft',
        project, history: { entries: [],cursor: 0 }, revision: 0 }); return;
    }
    if (intent.kind==='LoadDraft') { const document = parseMusicEditorDocument(intent.document,this.layout); this.document=document; return; }
    if (!this.document) { throw new Error('请先加载音乐工程'); }
    const d = this.document;
    if (intent.kind==='Undo' || intent.kind==='Redo') {
      const cursor = d.history.cursor+(intent.kind==='Undo'?-1:1);
      if (cursor<0 || cursor>d.history.entries.length) { return; }
      const revision = musicInteger(d.revision+1,0);
      this.document=freezeMusicData({...d,project:intent.kind==='Undo'?d.history.entries[cursor].before:d.history.entries[cursor-1].after,
        history:{...d.history,cursor},revision}); return;
    }
    // 全部候选数据先解析，失败不改项目、revision、历史；没有自动修正或丢音。
    let candidate: MusicProjectData;
    if (intent.kind==='SetTempo') {
      candidate={...d.project,tempoMap:[{tick:0,bpm:musicFinite(intent.bpm,20,320)}]};
    } else if (intent.kind==='DeleteNotes' || intent.kind==='MoveNotes') {
      musicExact(musicRecord(intent),intent.kind==='DeleteNotes'?['kind','noteIds']:['kind','noteIds','deltaTick','deltaPitch']);
      const selected = selectedNoteIds(intent.noteIds,d.project);
      const deltaTick = intent.kind==='MoveNotes'?musicInteger(intent.deltaTick,-Number.MAX_SAFE_INTEGER):0;
      const deltaPitch = intent.kind==='MoveNotes'?musicInteger(intent.deltaPitch,-Number.MAX_SAFE_INTEGER):0;
      if (selected.size===0 || (intent.kind==='MoveNotes' && deltaTick===0 && deltaPitch===0)) { return; }
      candidate={...d.project,tracks:d.project.tracks.map(track=>({...track,notes:intent.kind==='DeleteNotes'
        ?track.notes.filter(note=>!selected.has(note.id))
        :track.notes.map(note=>selected.has(note.id)?{...note,tick:note.tick+deltaTick,pitch:note.pitch+deltaPitch}:note)}))};
    } else if (intent.kind==='PasteNotes') {
      musicExact(musicRecord(intent),['kind','trackId','notes']);
      const trackId = musicId(intent.trackId), track = d.project.tracks.find(t=>t.id===trackId);
      if (!track) { throw new Error('未知音轨'); }
      if (!Array.isArray(intent.notes)) { throw new Error('批量粘贴 notes 必须为数组'); }
      if (intent.notes.length===0) { return; }
      candidate={...d.project,tracks:d.project.tracks.map(t=>t.id===trackId?{...t,notes:[...t.notes,...intent.notes]}:t)};
    } else {
      const trackId=musicId(intent.trackId), track=d.project.tracks.find(t=>t.id===trackId);
      if (!track) { throw new Error('未知音轨'); }
      let notes: readonly NoteDefinition[];
      if (intent.kind==='AddNote') { notes=[...track.notes,intent.note]; }
      else {
        const noteId=musicId(intent.noteId);
        if (!track.notes.some(n=>n.id===noteId)) { throw new Error('未知音符'); }
        if (intent.kind==='ChangeNote' && intent.note.id!==noteId) { throw new Error('修改音符不得更换身份'); }
        notes=intent.kind==='DeleteNote'?track.notes.filter(n=>n.id!==noteId):track.notes.map(n=>n.id===noteId?intent.note:n);
      }
      candidate={...d.project,tracks:d.project.tracks.map(t=>t.id===trackId?{...t,notes}:t)};
    }
    const after=parseMusicProjectData(candidate,this.layout);
    if (JSON.stringify(d.project)===JSON.stringify(after)) { return; }
    const revision=musicInteger(d.revision+1,0);
    const entries=[...d.history.entries.slice(0,d.history.cursor),{label:intent.kind,before:d.project,after}].slice(-100);
    this.document=freezeMusicData({...d,project:after,history:{entries,cursor:entries.length},revision});
  }
}
