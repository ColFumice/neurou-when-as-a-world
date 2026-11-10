import { _decorator, Component } from 'cc';
import type { MusicEditorReader, MusicEditorPort, MusicEditorIntent, MusicEditorDocument } from '../musicEditor/MusicEditorSession';
import type { MusicProjectData, NoteDefinition, TrackDefinition } from '../musicEditor/MusicProjectData';
import type { ChartSourceData } from '../editor/GuidanceEditorSession';
import { applyFolderTheme } from './FolderTheme';
import { MusicPreviewAudio } from './MusicPreviewAudio';

const { ccclass } = _decorator;
const DRAFT_KEY = 'neurou-music-draft-v1';
interface NoteRect { readonly trackId: string; readonly noteId: string; readonly x: number; readonly y: number; readonly width: number; readonly height: number }
interface TrackRect { readonly trackId: string; readonly x: number; readonly y: number; readonly width: number; readonly height: number; readonly minimumPitch: number; readonly maximumPitch: number }

// 与目录共享灰盒主题；只消费不可变 reader，并向 port 发出编辑意图。
@ccclass('MusicEditorView')
export class MusicEditorView extends Component {
  private reader: MusicEditorReader | null = null;
  private port: MusicEditorPort | null = null;
  private openGuidance: ((source: ChartSourceData) => void) | null = null;
  private root: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private readonly audio = new MusicPreviewAudio();
  private lastDocument: MusicEditorDocument | null = null;
  private selectedTrackId = '';
  private selectedNoteId = '';
  private exportedSource: ChartSourceData | null = null;
  private noteRects: NoteRect[] = [];
  private trackRects: TrackRect[] = [];
  private lifecycleGeneration = 0;
  private noteSerial = 1;
  private savedRevision = -1;
  private playPending = false;
  private readonly keyDown = (event: KeyboardEvent): void => {
    if (!this.root || /INPUT|TEXTAREA|SELECT/.test((event.target as HTMLElement | null)?.tagName ?? '')) { return; }
    if (event.code === 'Space' && !event.repeat) { event.preventDefault(); this.togglePlayback(); }
    if (event.code === 'Delete') { event.preventDefault(); this.deleteSelected(); }
    if ((event.ctrlKey || event.metaKey) && event.code === 'KeyZ') {
      event.preventDefault(); this.send({ kind: event.shiftKey ? 'Redo' : 'Undo' });
    }
  };

  bindMusic(reader: MusicEditorReader, port: MusicEditorPort, onOpenGuidance: (source: ChartSourceData) => void, defaultProject?: MusicProjectData): void {
    this.reader = reader;
    this.port = port;
    this.openGuidance = onOpenGuidance;
    this.defaultProject = defaultProject ?? reader.getDocument()?.project ?? null;
    // 首次进入不覆盖上一次浏览器草稿；主动编辑 / 保存后才写入。
    this.savedRevision = reader.getDocument()?.revision ?? -1;
    this.build();
    this.refreshDocument();
  }

  onEnable(): void { if (this.reader) { this.build(); this.refreshDocument(); } }

  private el<T extends HTMLElement = HTMLElement>(id: string): T { return this.root!.querySelector('#' + id) as T; }
  private status(message: string, error = false): void {
    if (!this.root) { return; }
    const output = this.el('music-status'); output.textContent = message; output.dataset.error = String(error);
  }

  private build(): void {
    if (typeof document === 'undefined' || this.root) { return; }
    ++this.lifecycleGeneration;
    const root = document.createElement('section');
    root.id = 'music-editor'; root.setAttribute('aria-label', '音乐编辑器');
    applyFolderTheme(root);
    root.innerHTML = `
      <style>
      #music-editor{position:fixed;inset:0;z-index:100;display:grid;grid-template-rows:82px minmax(0,1fr) 126px;background:var(--folder-bg);color:var(--folder-ink);font:14px/1.45 var(--folder-font)}
      #music-editor *{box-sizing:border-box}#music-editor button,#music-editor input,#music-editor select,#music-editor textarea{font:inherit;color:var(--folder-ink);background:var(--folder-panel);border:1px solid var(--folder-border);border-radius:4px}
      #music-editor button{cursor:pointer;padding:7px 11px}#music-editor button:hover{background:#383838}#music-editor button:disabled{opacity:.38;cursor:default}#music-editor button:focus-visible,#music-editor input:focus-visible{outline:2px solid #ddd;outline-offset:2px}
      #music-editor header{display:flex;align-items:center;gap:20px;padding:14px 24px;border-bottom:1px solid var(--folder-border)}#music-editor h1{font-size:22px;line-height:1.25;margin:0}#music-editor .subtitle,#music-editor small{color:var(--folder-muted);font-size:12px}#music-source{border:1px solid #727d6d;border-radius:18px;color:#c9dbbd;padding:4px 12px;white-space:nowrap}#music-meta{margin-left:auto;text-align:right;max-width:55%;overflow-wrap:anywhere;font-size:12px;color:var(--folder-muted)}
      #music-editor main{display:grid;grid-template-columns:220px minmax(0,1fr) 324px;min-height:0}#music-editor nav{border-right:1px solid var(--folder-border);padding:22px 14px;overflow:auto}#music-editor nav h2{font-size:14px;margin:0 0 12px}#music-editor nav button{display:block;width:100%;margin:7px 0;text-align:left;padding:12px}#music-editor nav .active{border-color:#ddd;background:#363636}#music-editor nav small{display:block;margin:22px 8px 0}
      #music-workspace{display:grid;grid-template-rows:auto minmax(0,1fr) auto;min-width:0;min-height:0;padding:16px 18px;gap:12px}#music-editor .toolbar,#music-editor .row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}#music-editor .toolbar input{width:70px;padding:6px}#music-editor .toolbar select{max-width:155px;padding:6px}#music-project-title{font-size:16px;font-weight:600;margin:0 auto 0 0}#music-timeline{display:block;width:100%;height:100%;background:#1f1f1f;border:1px solid #555;border-radius:4px;cursor:crosshair}#music-roll{position:relative;min-height:180px;min-width:0}#music-roll-caption{font-size:12px;color:var(--folder-muted)}
      #music-editor aside{border-left:1px solid var(--folder-border);padding:16px 18px;overflow:auto}#music-editor aside h2{font-size:14px;font-weight:600;margin:0 0 9px}#music-editor aside h2.section{margin-top:22px}#music-selected{font-size:12px;color:var(--folder-muted);margin-bottom:12px;overflow-wrap:anywhere}#music-editor .fields{display:grid;grid-template-columns:1fr 1fr;gap:9px 12px}#music-editor .fields label{display:grid;gap:3px;font-size:12px;color:var(--folder-muted)}#music-editor .fields input{padding:7px;width:100%;min-width:0}#music-editor .properties-actions{margin:12px 0}#music-editor aside .row{margin:8px 0}#music-editor .primary{background:#4b5546;border-color:#829176}#music-editor aside small{display:block;margin-top:8px}#music-editor details{margin-top:12px}#music-editor summary{cursor:pointer;font-size:12px}#music-output-preview{width:100%;height:180px;margin-top:8px;font:11px/1.45 ui-monospace,monospace;padding:8px;resize:vertical}
      #music-editor footer{border-top:1px solid var(--folder-border);padding:12px 260px 10px 24px;display:grid;grid-template-rows:auto auto auto;gap:7px}#music-seek{width:100%;accent-color:#b8c6ab}#music-playback-state{font-size:12px;color:#bfd2b2;margin-left:8px}#music-time{font-variant-numeric:tabular-nums;min-width:180px}#music-status{font-size:12px;min-height:18px;color:#c7d9be}#music-status[data-error=true]{color:#f1aaa4}
      @media(min-width:2200px){#music-editor{grid-template-rows:94px minmax(0,1fr) 140px;font-size:16px}#music-editor main{grid-template-columns:270px minmax(0,1fr) 370px}#music-editor header{padding:18px 30px}#music-editor nav{padding:26px 18px}#music-workspace{padding:20px 24px;gap:16px}#music-editor aside{padding:20px 24px}#music-editor h1{font-size:26px}#music-editor button{padding:9px 13px}#music-editor aside h2{font-size:16px}#music-editor small,#music-editor .subtitle,#music-meta,#music-roll-caption{font-size:14px}}
      @media(max-width:1150px){#music-editor main{grid-template-columns:170px minmax(0,1fr) 270px}#music-editor header{gap:12px;padding:12px 16px}#music-editor nav{padding:16px 10px}#music-workspace{padding:12px 10px}#music-editor aside{padding:12px}#music-meta{max-width:40%;font-size:10px}#music-editor footer{padding-right:220px}}
      </style>
      <header><div><h1>雨若 / 音乐编辑器</h1><div class="subtitle">世界编辑器 → 音乐编辑器 → MIDI 以及音轨编辑器</div></div><span id="music-source">数据来源：MIDI</span><div id="music-meta"></div></header>
      <main><nav aria-label="音乐项目目录"><h2>音乐项目</h2><button id="music-tab-wavetable" disabled>RGB 波表编辑器<br><span class="subtitle">待后续交付</span></button><button id="music-tab-grid" disabled>网格编辑器<br><span class="subtitle">待后续交付</span></button><button id="music-tab-midi" class="active">MIDI 以及音轨编辑器</button><small>同一项目，共享音符、时间与位置。当前只开放 MIDI 音轨工作区。</small></nav>
      <section id="music-workspace"><div class="toolbar"><h2 id="music-project-title">未加载音乐项目</h2><label>BPM <input id="music-bpm" type="number" min="20" max="320" step="1" aria-label="BPM"></label><button id="music-set-bpm">应用 BPM</button><button id="music-undo">撤销</button><button id="music-redo">重做</button></div><div id="music-roll"><canvas id="music-timeline" aria-label="音轨钢琴卷帘时间轴"></canvas></div><div id="music-roll-caption">点击空白放音符，点击音符选中；横轴是 tick，纵轴是 MIDI pitch。Space 播放 / 暂停，Delete 删除。</div></section>
      <aside><h2>音轨与音符</h2><div class="row"><select id="music-track" aria-label="编辑音轨"></select><button id="music-add-note">添加音符</button></div><div id="music-selected">点击音符编辑属性</div><div class="fields"><label>起点 tick<input id="music-note-tick" type="number" min="0" step="1" value="0"></label><label>时长 ticks<input id="music-note-duration" type="number" min="1" step="1" value="480"></label><label>MIDI pitch (0–127)<input id="music-note-pitch" type="number" min="0" max="127" step="1" value="60"></label><label>力度 (0–127)<input id="music-note-velocity" type="number" min="0" max="127" step="1" value="96"></label><label>位置 u (0–1)<input id="music-note-u" type="number" min="0" max="1" step="0.001" value="0.5"></label><label>位置 v (0–1)<input id="music-note-v" type="number" min="0" max="1" step="0.001" value="0.5"></label></div><div class="row properties-actions"><button id="music-note-apply" class="primary">应用属性</button><button id="music-delete-note">删除音符</button></div><small>位置是显式 UV 数据；变更音高不会改写位置。当前试听为固定正弦音色。</small>
      <h2 class="section">项目与草稿</h2><div class="row"><button id="music-load-default">加载默认项目</button><button id="music-import-project">导入项目</button></div><div class="row"><button id="music-save-draft">保存草稿</button><button id="music-restore-draft">恢复草稿</button></div><div class="row"><button id="music-download-project">下载项目</button><button id="music-download-draft">下载草稿</button><button id="music-import-draft">导入草稿</button></div><small id="music-save-info">草稿含撤销历史；项目文件可独立导入。</small>
      <h2 class="section">引导线来源</h2><button id="music-export" class="primary">导出 ChartSourceData JSON</button><div class="row"><button id="music-open-guidance" disabled>交给引导线编辑器</button></div><small id="music-export-info">输出来源固定为 Midi，使用当前布局与映射版本。</small><details id="music-export-details"><summary>查看导出 JSON</summary><textarea id="music-output-preview" readonly aria-label="ChartSourceData 导出预览"></textarea></details></aside></main>
      <footer><div class="row"><button id="music-play">播放试听</button><button id="music-pause">暂停</button><button id="music-stop">停止</button><span id="music-time">00:00.000 / 00:00.000</span><span id="music-playback-state">停止 · 固定正弦音色</span><small>时间轴试听</small></div><input id="music-seek" type="range" min="0" max="1" value="0" step="1" aria-label="试听进度"><div id="music-status" role="status" aria-live="polite">编辑音乐后导出，或直接交给引导线编辑器。</div></footer>`;
    this.root = root; this.canvas = this.el<HTMLCanvasElement>('music-timeline');
    document.body.appendChild(root);
    this.el('music-roll-caption').textContent = '点击空白按当前 u / v 放音符，点击音符选中；横轴 tick，纵轴 MIDI pitch。Space 播放 / 暂停，Delete 删除。';
    const click = (id: string, action: () => void): void => { this.el(id).onclick = action; };
    click('music-undo', () => this.send({ kind: 'Undo' })); click('music-redo', () => this.send({ kind: 'Redo' }));
    this.el('music-set-bpm').textContent = '设为恒定 BPM';
    this.el('music-set-bpm').title = '替换项目全部速度点；分段速度可由音乐项目 JSON 导入';
    click('music-set-bpm', () => this.send({ kind: 'SetTempo', bpm: this.number('music-bpm') }));
    click('music-add-note', () => this.addNoteFromFields()); click('music-note-apply', () => this.applyNote()); click('music-delete-note', () => this.deleteSelected());
    this.el<HTMLSelectElement>('music-track').onchange = () => { this.selectedTrackId = this.el<HTMLSelectElement>('music-track').value; this.selectedNoteId = ''; this.refreshSelection(); };
    click('music-load-default', () => {
      // 组合根给 session 的默认项目是 initial snapshot；View 通过意图重新加载。
      if (this.defaultProject) { this.send({ kind: 'LoadProject', project: this.defaultProject }); this.selectedNoteId = ''; this.refreshDocument(); }
    });
    click('music-import-project', () => this.importFile('project')); click('music-import-draft', () => this.importFile('draft'));
    click('music-save-draft', () => this.saveDraft()); click('music-restore-draft', () => this.restoreDraft());
    click('music-download-project', () => { const d = this.reader?.getDocument(); if (d) { this.download(d.project.projectId + '.music.json', d.project); this.status('已请求下载音乐项目 JSON'); } });
    click('music-download-draft', () => { const d = this.reader?.getDocument(); if (d) { this.download(d.documentId + '.draft.json', d); this.status('已请求下载含历史的音乐草稿'); } });
    click('music-export', () => this.exportSource());
    click('music-open-guidance', () => { if (this.exportedSource && this.openGuidance) { this.audio.stop(); this.openGuidance(this.exportedSource); } });
    click('music-play', () => this.togglePlayback()); click('music-pause', () => { this.audio.pause(); this.status('试听已暂停'); }); click('music-stop', () => { this.audio.stop(); this.status('试听已停止'); });
    this.el<HTMLInputElement>('music-seek').oninput = () => { if (!this.reader?.getDocument()) { return; } this.audio.seek(this.number('music-seek'), this.reader.getDurationMs()); };
    this.canvas.onclick = event => this.clickTimeline(event);
    window.addEventListener('keydown', this.keyDown);
  }

  private defaultProject: MusicEditorDocument['project'] | null = null;
  private number(id: string): number { return Number(this.el<HTMLInputElement>(id).value); }
  private send(intent: MusicEditorIntent): boolean {
    if (!this.port) { return false; }
    try {
      this.port.submitMusicEditorIntent(intent);
      this.audio.stop(); this.exportedSource = null;
      if (this.root) {
        this.el<HTMLButtonElement>('music-open-guidance').disabled = true;
        this.el<HTMLTextAreaElement>('music-output-preview').value = '';
        this.el('music-export-info').textContent = '当前草稿已变更，请重新导出。';
      }
      this.lastDocument = null; this.refreshDocument(); this.saveDraft(); this.status('已更新音乐项目');
      return true;
    } catch (error) { this.status(error instanceof Error ? error.message : String(error), true); return false; }
  }

  private refreshDocument(): void {
    if (!this.root || !this.reader) { return; }
    const d = this.reader.getDocument(); this.lastDocument = d;
    if (!d) { return; }
    if (!this.defaultProject) { this.defaultProject = d.project; }
    const p = d.project;
    this.el('music-project-title').textContent = p.title;
    this.el('music-meta').textContent = `revision ${d.revision} · ${p.ppq} PPQ · ${p.timeSignature.numerator}/${p.timeSignature.denominator} · ${p.aspectRatio.toFixed(4)}\nlayout ${p.layoutVersion} · mapping ${p.mappingVersion}`;
    this.el('music-meta').style.whiteSpace = 'pre-line';
    this.el<HTMLInputElement>('music-bpm').value = String(p.tempoMap[0].bpm);
    this.el<HTMLButtonElement>('music-undo').disabled = d.history.cursor === 0;
    this.el<HTMLButtonElement>('music-redo').disabled = d.history.cursor === d.history.entries.length;
    const tracks = this.el<HTMLSelectElement>('music-track'); tracks.innerHTML = '';
    for (const track of p.tracks) { const option = document.createElement('option'); option.value = track.id; option.textContent = track.title; tracks.appendChild(option); }
    if (!p.tracks.some(track => track.id === this.selectedTrackId)) { this.selectedTrackId = p.tracks[0].id; }
    tracks.value = this.selectedTrackId;
    this.el<HTMLInputElement>('music-seek').max = String(this.reader.getDurationMs());
    this.refreshSelection(); this.drawTimeline();
  }

  private selected(): { readonly track: TrackDefinition; readonly note: NoteDefinition } | null {
    const track = this.reader?.getDocument()?.project.tracks.find(item => item.id === this.selectedTrackId);
    const note = track?.notes.find(item => item.id === this.selectedNoteId);
    return track && note ? { track, note } : null;
  }

  private refreshSelection(): void {
    if (!this.root) { return; }
    const selected = this.selected();
    this.el<HTMLButtonElement>('music-note-apply').disabled = !selected;
    this.el<HTMLButtonElement>('music-delete-note').disabled = !selected;
    this.el('music-selected').textContent = selected ? `${selected.track.title} / ${selected.note.id}` : '点击音符编辑属性；点击空白或添加按钮创建音符';
    if (!selected) { return; }
    const note = selected.note;
    for (const [id, value] of [['tick', note.tick], ['duration', note.durationTicks], ['pitch', note.pitch], ['velocity', note.velocity], ['u', note.position.u], ['v', note.position.v]] as const) {
      this.el<HTMLInputElement>('music-note-' + id).value = String(value);
    }
  }

  private readNote(id: string): NoteDefinition {
    return { id, tick: this.number('music-note-tick'), durationTicks: this.number('music-note-duration'), pitch: this.number('music-note-pitch'), velocity: this.number('music-note-velocity'), position: { u: this.number('music-note-u'), v: this.number('music-note-v') } };
  }

  private addNoteFromFields(): void {
    const id = `music-note-${Date.now()}-${this.noteSerial++}`;
    if (this.send({ kind: 'AddNote', trackId: this.selectedTrackId, note: this.readNote(id) })) { this.selectedNoteId = id; this.refreshSelection(); }
  }

  private applyNote(): void {
    if (!this.selected()) { return; }
    this.send({ kind: 'ChangeNote', trackId: this.selectedTrackId, noteId: this.selectedNoteId, note: this.readNote(this.selectedNoteId) });
  }

  private deleteSelected(): void {
    if (!this.selected()) { return; }
    if (this.send({ kind: 'DeleteNote', trackId: this.selectedTrackId, noteId: this.selectedNoteId })) { this.selectedNoteId = ''; this.refreshSelection(); }
  }

  private clickTimeline(event: MouseEvent): void {
    if (!this.canvas || !this.reader) { return; }
    const d = this.reader.getDocument(); if (!d) { return; }
    const bounds = this.canvas.getBoundingClientRect(); const x = event.clientX - bounds.left, y = event.clientY - bounds.top;
    const hit = [...this.noteRects].reverse().find(rect => x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height);
    if (hit) { this.selectedTrackId = hit.trackId; this.selectedNoteId = hit.noteId; this.el<HTMLSelectElement>('music-track').value = hit.trackId; this.refreshSelection(); this.drawTimeline(); return; }
    const track = this.trackRects.find(rect => x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height);
    if (!track) { return; }
    const p = d.project, step = Math.max(1, Math.round(p.ppq / 4));
    const tick = Math.max(0, Math.min(p.durationTicks - step, Math.round((x - track.x) / track.width * p.durationTicks / step) * step));
    const rowHeight = track.height / (track.maximumPitch - track.minimumPitch + 1);
    const pitch = track.maximumPitch - Math.floor((y - track.y) / rowHeight);
    const position = { u: this.number('music-note-u'), v: this.number('music-note-v') };
    const id = `music-note-${Date.now()}-${this.noteSerial++}`;
    this.selectedTrackId = track.trackId;
    if (this.send({ kind: 'AddNote', trackId: track.trackId, note: { id, tick, durationTicks: Math.min(p.ppq, p.durationTicks - tick), pitch, velocity: 96, position } })) {
      this.selectedNoteId = id; this.refreshSelection();
    }
  }

  private drawTimeline(): void {
    if (!this.canvas || !this.reader) { return; }
    const project = this.reader.getDocument()?.project; if (!project) { return; }
    const bounds = this.canvas.getBoundingClientRect(); if (bounds.width < 1 || bounds.height < 1) { return; }
    const scale = window.devicePixelRatio || 1;
    const width = bounds.width, height = bounds.height;
    if (this.canvas.width !== Math.round(width * scale) || this.canvas.height !== Math.round(height * scale)) { this.canvas.width = Math.round(width * scale); this.canvas.height = Math.round(height * scale); }
    const ctx = this.canvas.getContext('2d'); if (!ctx) { return; }
    ctx.setTransform(scale, 0, 0, scale, 0, 0); ctx.clearRect(0, 0, width, height); ctx.fillStyle = '#202020'; ctx.fillRect(0, 0, width, height);
    const left = 64, right = 16, ruler = 28, trackGap = 12, trackTitle = 27;
    const plotWidth = Math.max(1, width - left - right);
    const measureTicks = project.ppq * 4 / project.timeSignature.denominator * project.timeSignature.numerator;
    ctx.font = '12px system-ui'; ctx.textBaseline = 'middle';
    const rulerStep = measureTicks * Math.max(1, Math.ceil(project.durationTicks / measureTicks / Math.max(1, Math.floor(plotWidth / 85))));
    for (let tick = 0; tick <= project.durationTicks; tick += rulerStep) { const x = left + tick / project.durationTicks * plotWidth; ctx.fillStyle = '#c7c7c7'; ctx.fillText(`${Math.round(tick / measureTicks) + 1} / ${tick}`, x + 4, 13); }
    const paneHeight = (height - ruler - trackGap * (project.tracks.length - 1) - 5) / project.tracks.length;
    this.noteRects = []; this.trackRects = [];
    project.tracks.forEach((track, index) => {
      const top = ruler + index * (paneHeight + trackGap);
      const minimumPitch = Math.max(0, Math.min(48, ...track.notes.map(note => note.pitch)));
      const maximumPitch = Math.min(127, Math.max(84, ...track.notes.map(note => note.pitch)));
      const plotTop = top + trackTitle, plotHeight = Math.max(1, paneHeight - trackTitle), rows = maximumPitch - minimumPitch + 1, rowHeight = plotHeight / rows;
      this.trackRects.push({ trackId: track.id, x: left, y: plotTop, width: plotWidth, height: plotHeight, minimumPitch, maximumPitch });
      ctx.fillStyle = track.id === this.selectedTrackId ? '#373a34' : '#303030'; ctx.fillRect(0, top, width, trackTitle);
      ctx.fillStyle = '#dfdfdf'; ctx.font = '12px system-ui'; ctx.fillText(`${track.title} · ${track.notes.length} notes · line ${track.lineId} · offset ${track.offsetMs}ms`, 12, top + trackTitle / 2);
      for (let row = 0; row < rows; row += 1) {
        const pitch = maximumPitch - row, y = plotTop + row * rowHeight;
        ctx.fillStyle = [1, 3, 6, 8, 10].includes(pitch % 12) ? '#1d1d1d' : '#252525'; ctx.fillRect(left, y, plotWidth, rowHeight);
        ctx.strokeStyle = pitch % 12 === 0 ? '#555' : '#313131'; ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(left + plotWidth, y); ctx.stroke();
        if (pitch % 12 === 0) { ctx.fillStyle = '#b8b8b8'; ctx.font = '10px system-ui'; ctx.fillText(`C${Math.floor(pitch / 12) - 1} ${pitch}`, 6, y + rowHeight / 2); }
      }
      const gridStep = project.ppq * Math.max(1, Math.ceil(project.durationTicks / project.ppq / Math.max(1, Math.floor(plotWidth / 12))));
      for (let tick = 0; tick <= project.durationTicks; tick += gridStep) {
        const x = left + tick / project.durationTicks * plotWidth; ctx.strokeStyle = tick % measureTicks === 0 ? '#626262' : '#393939'; ctx.beginPath(); ctx.moveTo(x, plotTop); ctx.lineTo(x, plotTop + plotHeight); ctx.stroke();
      }
      for (const note of track.notes) {
        const x = left + note.tick / project.durationTicks * plotWidth, y = plotTop + (maximumPitch - note.pitch) * rowHeight + 1;
        const noteWidth = Math.max(5, note.durationTicks / project.durationTicks * plotWidth), noteHeight = Math.max(3, rowHeight - 2);
        const selected = track.id === this.selectedTrackId && note.id === this.selectedNoteId;
        ctx.fillStyle = `rgb(${track.color.r},${track.color.g},${track.color.b})`; ctx.globalAlpha = note.velocity / 127 * 0.65 + 0.35; ctx.fillRect(x, y, noteWidth, noteHeight); ctx.globalAlpha = 1;
        if (selected) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(x - 1, y - 1, noteWidth + 2, noteHeight + 2); ctx.lineWidth = 1; }
        this.noteRects.push({ trackId: track.id, noteId: note.id, x, y, width: noteWidth, height: noteHeight });
      }
      // 每轨 offset 属于声音绝对时间；游标须先还原该轨的项目时间。
      const trackTimeMs = Math.max(0, this.audio.readTimeMs() - track.offsetMs);
      const trackCursorX = left + this.reader!.getTickAtTimeMs(trackTimeMs) / project.durationTicks * plotWidth;
      ctx.strokeStyle = '#e9eadf'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(trackCursorX, plotTop); ctx.lineTo(trackCursorX, plotTop + plotHeight); ctx.stroke(); ctx.lineWidth = 1;
    });
    const timeMs = this.audio.readTimeMs();
    const playheadX = left + this.reader.getTickAtTimeMs(timeMs) / project.durationTicks * plotWidth;
    ctx.strokeStyle = '#e9eadf'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(playheadX, 0); ctx.lineTo(playheadX, ruler - 1); ctx.stroke(); ctx.lineWidth = 1;
  }

  private togglePlayback(): void {
    if (this.audio.getState() === 'Playing') { this.audio.pause(); return; }
    if (!this.reader?.getDocument() || this.playPending) { return; }
    const generation = this.lifecycleGeneration; this.playPending = true;
    void this.audio.play(this.reader.getPlaybackNotes(), this.reader.getDurationMs()).then(() => {
      if (generation === this.lifecycleGeneration && this.root && this.audio.getState() === 'Playing') { this.status('正在试听当前音符 · 固定正弦音色'); }
    }).catch(error => {
      if (generation === this.lifecycleGeneration && this.root) { this.status(error instanceof Error ? error.message : String(error), true); }
    }).finally(() => { if (generation === this.lifecycleGeneration) { this.playPending = false; } });
  }

  private saveDraft(): void {
    const d = this.reader?.getDocument(); if (!d || !this.root) { return; }
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); this.savedRevision = d.revision; this.el('music-save-info').textContent = `草稿已保存 · revision ${d.revision} · 含撤销历史`; }
    catch { this.status('浏览器草稿保存失败，可下载草稿备份', true); }
  }

  private restoreDraft(): void {
    try {
      const text = localStorage.getItem(DRAFT_KEY); if (!text) { this.status('此浏览器尚无保存的音乐草稿', true); return; }
      if (this.send({ kind: 'LoadDraft', document: JSON.parse(text) })) { this.selectedNoteId = ''; this.refreshSelection(); this.status('已恢复音乐草稿与撤销历史'); }
    } catch (error) { this.status(error instanceof Error ? error.message : String(error), true); }
  }

  private importFile(kind: 'project' | 'draft'): void {
    if (!this.root) { return; }
    this.root.querySelector('#music-import-file')?.remove();
    const input = document.createElement('input'); input.id = 'music-import-file'; input.type = 'file'; input.accept = '.json'; input.hidden = true;
    this.root.appendChild(input); const generation = this.lifecycleGeneration;
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) { return; }
      try {
        const raw = JSON.parse(await file.text()); if (generation !== this.lifecycleGeneration || !this.root) { return; }
        if (this.send(kind === 'project' ? { kind: 'LoadProject', project: raw } : { kind: 'LoadDraft', document: raw })) { this.selectedNoteId = ''; this.refreshSelection(); this.status('已导入 ' + file.name); }
      } catch (error) { if (generation === this.lifecycleGeneration && this.root) { this.status(error instanceof Error ? error.message : String(error), true); } }
    };
    input.click();
  }

  private download(filename: string, value: unknown): void {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
    URL.revokeObjectURL(url);
  }

  private exportSource(): void {
    try {
      const source = this.reader!.exportSource(); this.exportedSource = source;
      this.el<HTMLTextAreaElement>('music-output-preview').value = JSON.stringify(source, null, 2);
      this.el<HTMLDetailsElement>('music-export-details').open = true;
      this.el('music-export-info').textContent = `已导出 Midi · ${source.events.length} events · revision ${source.sourceRevision}`;
      this.el<HTMLButtonElement>('music-open-guidance').disabled = false;
      this.download(source.sourceId + '.chart-source.json', source); this.status('ChartSourceData 已校验并请求下载，可交给引导线编辑器');
    } catch (error) { this.status(error instanceof Error ? error.message : String(error), true); }
  }

  update(): void {
    if (!this.root || !this.reader) { return; }
    const d = this.reader.getDocument(); if (d !== this.lastDocument) { this.refreshDocument(); }
    if (d && d.revision !== this.savedRevision) { this.saveDraft(); }
    const time = this.audio.readTimeMs(), duration = d ? this.reader.getDurationMs() : 0;
    const format = (ms: number): string => `${Math.floor(ms / 60000).toString().padStart(2, '0')}:${(ms / 1000 % 60).toFixed(3).padStart(6, '0')}`;
    this.el('music-time').textContent = `${format(time)} / ${format(duration)}`;
    const playbackLabel = { Stopped: '停止', Playing: '播放中', Paused: '已暂停', Completed: '已完成' };
    this.el('music-playback-state').textContent = `${playbackLabel[this.audio.getState()]} · 固定正弦音色`;
    this.el('music-playback-state').dataset.state = this.audio.getState();
    this.el<HTMLButtonElement>('music-play').textContent = this.audio.getState() === 'Playing' ? '暂停试听' : this.audio.getState() === 'Paused' ? '继续试听' : '播放试听';
    this.el<HTMLInputElement>('music-seek').value = String(Math.round(time)); this.drawTimeline();
  }

  private teardown(): void {
    ++this.lifecycleGeneration; this.playPending = false; this.audio.destroy();
    window.removeEventListener('keydown', this.keyDown); this.root?.remove(); this.root = null; this.canvas = null;
    this.lastDocument = null; this.noteRects = []; this.trackRects = []; this.exportedSource = null;
  }

  onDisable(): void { this.teardown(); }
  onDestroy(): void { this.teardown(); }
}
