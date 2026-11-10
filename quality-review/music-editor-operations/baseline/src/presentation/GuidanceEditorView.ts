// Cocos 浏览器编辑界面；只读 editor/chart，通过意图修改草稿。
import { _decorator, Component, Node, UITransform, SpriteFrame, isValid } from 'cc';
import type { GuidanceEditorReader, GuidanceEditorPort, GuidanceEditorIntent, ChartSourceData } from '../editor/GuidanceEditorSession';
import type { ChartNodeKind } from '../chart/GuidanceChart';
import { LineEraseEffect } from './LineEraseEffect';
import { AudioOutputClock } from './AudioOutputClock';
const { ccclass } = _decorator;
interface EditorDirectoryHandle {
  getFileHandle(name: string, options: { create: boolean }): Promise<{ createWritable(): Promise<{ write(text: string): Promise<void>; close(): Promise<void> }> }>;
}

@ccclass('GuidanceEditorView')
export class GuidanceEditorView extends Component {
  private reader: GuidanceEditorReader | null = null;
  private port: GuidanceEditorPort | null = null;
  private root: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private video: HTMLVideoElement | null = null;
  private readonly clock = new AudioOutputClock();
  private effect: LineEraseEffect | null = null;
  private selectedId = '';
  private lastDocument: unknown = null;
  private videoUrl: string | null = null;
  private playing = false;
  private playingMode: 'Rehearsal' | 'Manual' = 'Manual';
  private savedAt = '';
  private directory: EditorDirectoryHandle | null = null;
  private endedElapsedMs = 0;
  private mock: ChartSourceData | null = null;
  private keyDown = (e: KeyboardEvent): void => {
    if (!this.playing || e.repeat || /INPUT|SELECT|TEXTAREA/.test((e.target as HTMLElement)?.tagName)) { return; }
    e.preventDefault(); this.send({ kind: 'Strike', strike: { keyId: e.code as never, videoTimeMs: this.time(), phase: 'Down' } });
  };
  private keyUp = (e: KeyboardEvent): void => {
    if (!/INPUT|SELECT|TEXTAREA/.test((e.target as HTMLElement)?.tagName)) {
      this.send({ kind: 'Strike', strike: { keyId: e.code as never, videoTimeMs: this.time(), phase: 'Up' } });
    }
  };
  bindEditor(reader: GuidanceEditorReader, port: GuidanceEditorPort, mock: ChartSourceData): void {
    this.reader = reader; this.port = port; this.mock = mock; this.build();
  }
  bindHeadLogo(logo: SpriteFrame): void { this.effect?.bindHeadLogo(logo); }
  private send(intent: GuidanceEditorIntent): void {
    try { this.port?.submitEditorIntent(intent); if(['LoadSource','LoadDraft','SetKind','SetHead','SetHoldEnd','Undo','Redo'].includes(intent.kind))this.el('preview-file').textContent='预览来自当前草稿；可加载导出的谱面文件。';if(intent.kind!=='Advance')this.status(''); }
    catch (error) { this.status(error instanceof Error ? error.message : String(error), true); }
  }
  private time(): number { const time = this.clock.readChartTimeMs();return this.playing && time >= 0 ? time : (this.video?.currentTime ?? 0) * 1000; }
  private el<T extends HTMLElement = HTMLElement>(id: string): T { return this.root!.querySelector('#' + id) as T; }
  private status(message: string, error = false): void {
    if (!this.root) { return; } const el = this.el('editor-status'); el.textContent = message; el.style.color = error ? '#ffa09a' : '#9ec9af';
  }
  private build(): void {
    if (typeof document === 'undefined' || this.root) { return; }
    this.root = document.createElement('section'); this.root.id = 'guidance-editor';
    this.root.innerHTML = `
      <style>
      #guidance-editor{position:fixed;inset:0;z-index:100;display:grid;grid-template-rows:66px 1fr 108px;background:transparent;color:#e7ebf1;font:15px/1.5 system-ui,sans-serif;pointer-events:none}
      #guidance-editor *{box-sizing:border-box}#guidance-editor header,#guidance-editor aside,#guidance-editor footer{background:#121b28;pointer-events:auto}
      #guidance-editor header{display:flex;align-items:center;gap:14px;padding:12px 24px;border-bottom:1px solid #334157}#guidance-editor h1{font-size:19px;margin:0 20px 0 0}
      #guidance-editor main{display:grid;grid-template-columns:1fr 350px;min-height:0}#editor-stage{position:relative;pointer-events:auto;background:transparent}
      #editor-stage canvas{width:100%;height:100%;display:block}#editor-stage .caption{position:absolute;left:22px;top:12px;font-size:12px;color:#94a5bc}
      #guidance-editor aside{padding:20px;border-left:1px solid #334157;overflow:auto}#guidance-editor h2{font-size:15px;font-weight:600;margin:20px 0 10px}
      #guidance-editor button,#guidance-editor select{background:#23334b;color:#edf3ff;border:1px solid #405878;border-radius:6px;padding:8px 12px;cursor:pointer;font:inherit}
      #guidance-editor button:hover{background:#354e70}#guidance-editor button:disabled{opacity:.35;cursor:default}#guidance-editor .primary{background:#4f75ae}
      #guidance-editor .row{display:flex;gap:8px;margin:8px 0;align-items:center}#guidance-editor select{width:100%}#guidance-editor small{color:#9baabe;display:block}
      #guidance-editor video{width:100%;height:150px;background:#080d14;border-radius:6px}#editor-events{display:flex;flex-direction:column;gap:4px;max-height:230px;overflow:auto}
      #editor-events button{text-align:left;font-size:13px}#editor-events button.selected{border-color:#a7c4f4;background:#365079}
      #guidance-editor footer{border-top:1px solid #334157;padding:12px 24px}#editor-timeline{width:100%;accent-color:#97bbf0}#editor-score{margin-left:auto;color:#c4d5ee}
      #editor-source{color:#edbd72;border:1px solid #6b573d;border-radius:20px;padding:3px 10px;font-size:12px}#editor-status{font-size:13px;min-height:20px}
      </style>
      <header><h1>雨若 / 引导线编辑器</h1><span id="editor-source">尚未加载</span><button id="load-mock">加载 mock</button><button id="load-source">导入 MIDI 输出</button><button id="undo">撤销</button><button id="redo">重做</button><span id="editor-score">位置与时间来自 MIDI</span></header>
      <main><div id="editor-stage"><canvas id="editor-canvas"></canvas><div class="caption">位置编辑器 · 点选音符以设置类型；位置与卡点只读</div></div>
      <aside><h2>选中音符</h2><div id="selected-info">先加载源数据</div><div class="row"><select id="node-kind" aria-label="节点类型"><option>Tap</option><option>Drag</option><option>Hold</option></select></div><label>Hold 尾端<select id="hold-end" aria-label="Hold 尾端"></select></label><button id="set-head">设为 Head</button><small id="key-info"></small><h2>源事件</h2><div id="editor-events"></div>
      <h2>视频卡点器</h2><video id="editor-video" preload="auto" src="/assets/resources/native/96/96162c33-4ecf-492c-b933-6852e6166148.mp4"></video><button id="choose-video">选择视频</button><small id="media-info">预览视频加载中；可选择本地视频。草稿只保存文件名，恢复后需重新选择。</small>
      <h2>草稿与导出</h2><div class="row"><button id="save-draft">保存草稿</button><button id="restore-draft">恢复草稿</button></div><div class="row"><button id="download-draft">下载草稿</button><button id="import-draft">导入草稿</button></div><div class="row"><button id="choose-output">选择导出文件夹</button></div><button class="primary" id="export-chart">导出玩法 + 颜色 JSON</button><div class="row"><button id="load-export">加载导出谱面</button></div><small id="preview-file">可同时选择玩法 JSON 和可选的 .visual.json，再演奏或试听。</small><small id="save-info">草稿自动保存在此浏览器；导出文件可保存到 编辑器/导出/引导线。</small></aside></main>
      <footer><div class="row"><button id="play-manual">演奏预览</button><button id="play-auto">自动试听</button><button id="pause-preview">暂停 / 恢复</button><button id="stop-preview">停止</button><span id="editor-time">00:00.000</span><small>演奏预览：Space 启动 Head，再按网格键。自动试听独立标记。</small></div><input id="editor-timeline" type="range" min="0" max="12000" step="1" value="0" aria-label="时间轴"><div id="editor-status"></div></footer>`;
    document.body.appendChild(this.root); this.canvas = this.el<HTMLCanvasElement>('editor-canvas'); this.video = this.el<HTMLVideoElement>('editor-video');
    this.clock.attachVideo(this.video);
    const effectNode = new Node('GuidanceEditorPreview'); effectNode.layer = this.node.layer; this.node.addChild(effectNode); effectNode.addComponent(UITransform);
    this.effect = effectNode.addComponent(LineEraseEffect);
    const click = (id: string, run: () => void): void => { this.el(id).onclick = run; };
    click('load-mock', () => { this.stopPlayback(); this.send({ kind: 'LoadSource', source: this.mock }); this.selectedId = ''; });
    click('load-source', () => this.importFile('source')); click('import-draft', () => this.importFile('draft'));
    click('undo', () => { this.stopPlayback(); this.send({ kind: 'Undo' }); }); click('redo', () => { this.stopPlayback(); this.send({ kind: 'Redo' }); });
    this.el<HTMLSelectElement>('node-kind').onchange = () => { this.stopPlayback(); this.send({ kind: 'SetKind', eventId: this.selectedId, nodeKind: this.el<HTMLSelectElement>('node-kind').value as ChartNodeKind }); };
    this.el<HTMLSelectElement>('hold-end').onchange = () => { this.stopPlayback(); this.send({ kind: 'SetHoldEnd', eventId: this.selectedId, endEventId: this.el<HTMLSelectElement>('hold-end').value }); };
    click('set-head', () => { const event = this.reader?.getDocument()?.source.events.find(e => e.id === this.selectedId); if (event) { this.stopPlayback(); this.send({kind:'SetHead',lineId:event.lineId,eventId:event.id}); } });
    click('save-draft', () => this.saveDraft()); click('restore-draft', () => { const draft = localStorage.getItem('neurou-guidance-draft-v1'); if (draft) { this.stopPlayback(); try { this.send({kind:'LoadDraft',document:JSON.parse(draft)}); } catch { this.status('浏览器草稿损坏，请导入备份',true); } } else { this.status('此浏览器尚无保存的草稿',true); } });
    click('download-draft', () => { const d = this.reader?.getDocument(); if (d) { this.download(d.documentId+'.draft.json',d); } });
    click('export-chart', () => this.exportFiles()); click('choose-video', () => this.chooseVideo());
    click('load-export', () => this.importPreview());
    click('choose-output', () => { const picker = (window as unknown as { showDirectoryPicker?: () => Promise<EditorDirectoryHandle> }).showDirectoryPicker;
      if (!picker) { this.status('此浏览器不支持目录选择，将使用常规下载。'); return; }
      void picker().then(handle => { this.directory = handle; this.status('输出目录已选择；再次导出会覆盖同名文件。'); }).catch(() => this.status('未选择输出目录')); });
    click('play-manual', () => this.play('Manual')); click('play-auto', () => this.play('Rehearsal'));
    click('stop-preview', () => { this.stopPlayback(); this.send({kind:'StopPreview'}); });
    click('pause-preview', () => { const state = this.reader?.getPreview()?.getState(); if (state === 'Playing') { this.video?.pause(); this.send({kind:'Pause',timeMs:this.time()}); } else if (state === 'Paused') { this.send({kind:'Pause',timeMs:this.time()}); void this.video?.play().catch(e => this.status(String(e),true)); } });
    this.el<HTMLInputElement>('editor-timeline').oninput = () => { this.video?.pause(); this.playing = false; this.clock.resetChart(); const timeMs = Number(this.el<HTMLInputElement>('editor-timeline').value); if (this.video) { this.video.currentTime = timeMs/1000; } this.send({kind:'Seek',timeMs}); this.bindPreview(); };
    this.video.onloadedmetadata = () => { this.el('media-info').textContent = '视频 ' + this.video!.duration.toFixed(2)+' 秒 · 可替换'; };
    this.video.onerror = () => this.status('视频不可用，请选择本地视频后预览',true);
    this.canvas.onclick = e => { const d = this.reader?.getDocument(); if (!d) { return; } const r = this.canvas!.getBoundingClientRect(); const u = (e.clientX-r.left)/r.width, v = 1-(e.clientY-r.top)/r.height; const near = d.source.events.map(n=>({n,d:Math.hypot((u-n.position.u)*r.width,(v-n.position.v)*r.height)})).sort((a,b)=>a.d-b.d)[0]; if (near?.d < 30) { this.selectedId=near.n.id;this.lastDocument=null; } };
    window.addEventListener('keydown',this.keyDown); window.addEventListener('keyup',this.keyUp);
    this.update();
  }
  private saveDraft(): void {
    const d=this.reader?.getDocument(); if (!d) { this.status('没有草稿',true); return; }
    try { localStorage.setItem('neurou-guidance-draft-v1',JSON.stringify(d));this.savedAt=new Date().toLocaleTimeString();this.el('save-info').textContent='草稿已保存 '+this.savedAt+' · 历史一并保存'; }
    catch { this.status('草稿保存失败：浏览器空间不足。可下载草稿备份。',true); }
  }
  private importFile(kind:'source'|'draft'): void {
    this.root!.querySelector('#editor-import')?.remove();const input=document.createElement('input');input.id='editor-import';input.type='file';input.accept='.json';input.hidden=true;this.root!.appendChild(input);input.onchange=async()=>{const f=input.files?.[0];if(!f)return;try { const data=JSON.parse(await f.text());this.port?.submitEditorIntent(kind==='source'?{kind:'LoadSource',source:data}:{kind:'LoadDraft',document:data});this.stopPlayback();this.selectedId='';this.el('preview-file').textContent='预览来自当前草稿；可加载导出的谱面文件。';this.status('已加载 '+f.name); } catch(e){this.status(e instanceof Error?e.message:String(e),true);} };input.click();
  }
  private chooseVideo(): void {
    const input=document.createElement('input');input.type='file';input.accept='video/*';input.onchange=()=>{const f=input.files?.[0];if(!f)return;this.stopPlayback();if(this.videoUrl)URL.revokeObjectURL(this.videoUrl);this.videoUrl=URL.createObjectURL(f);this.video!.src=this.videoUrl;if(this.reader?.getDocument())this.send({kind:'SetMedia',videoPath:f.name,audioPath:null});};input.click();
  }
  private importPreview(): void {
    this.root!.querySelector('#preview-files')?.remove();
    const input = document.createElement('input'); input.id = 'preview-files'; input.type = 'file'; input.accept = '.json'; input.multiple = true; input.hidden = true; this.root!.appendChild(input);
    input.onchange = async () => {
      try {
        const files = Array.from(input.files ?? []); if (!files.length) { return; }
        const values = await Promise.all(files.map(async f => ({ name: f.name, value: JSON.parse(await f.text()) })));
        const charts = values.filter(f => Array.isArray(f.value?.lines)), visuals = values.filter(f => !Array.isArray(f.value?.lines));
        if (charts.length !== 1 || visuals.length > 1) { throw new Error('请选择一个玩法 JSON，以及至多一个颜色伴随 JSON'); }
        this.port!.submitEditorIntent({ kind: 'LoadPreview', chart: charts[0].value, visual: visuals[0]?.value });
        this.stopPlayback(); this.el('preview-file').textContent = '已加载：' + values.map(f => f.name).join(' + '); this.status('导出谱面已校验；预览将使用加载文件。编辑类型后返回草稿预览。');
      } catch (e) { this.status(e instanceof Error ? e.message : String(e), true); }
    }; input.click();
  }
  private download(name:string,value:unknown): void {
    const text=JSON.stringify(value,null,2), url=URL.createObjectURL(new Blob([text],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  private async exportFiles(): Promise<void> {
    let written = 0;
    try { const output=this.reader!.exportChart();const files=[{name:output.chart.chartId+'.json',value:output.chart},{name:output.chart.chartId+'.visual.json',value:output.visual}];
      if (this.directory) { for (const f of files) { const file = await this.directory.getFileHandle(f.name,{create:true});const writer = await file.createWritable();await writer.write(JSON.stringify(f.value,null,2));await writer.close();written += 1; } this.status('两个 JSON 已保存到所选目录。'); }
      else { for (const f of files) this.download(f.name,f.value);this.status('已请求下载两个 JSON；浏览器若提示多个下载，请允许。'); }
      }
    catch(e){this.status((written ? `导出未完成，已有 ${written} 个文件写入；请重新成对导出。` : '') + (e instanceof Error?e.message:String(e)),true);}
  }
  private stopPlayback(): void { this.video?.pause();this.playing=false;this.endedElapsedMs=0;if(this.effect && isValid(this.effect,true))this.effect.clearVisuals(); }
  private play(mode:'Manual'|'Rehearsal'): void {
    if (!this.video || !Number.isFinite(this.video.duration)) { this.status('请先加载可播放视频',true);return; }
    try { const d=this.reader!.getDocument();if(!this.reader!.getPreviewData())throw new Error('先加载源数据或导出谱面');if(d&&Math.abs(this.video.duration*1000-d.source.mediaDurationMs)>100)throw new Error('视频时长与 MIDI 源不匹配');
      this.stopPlayback();this.clock.resetChart();this.port!.submitEditorIntent({kind:'StartPreview',mode});this.video.currentTime=0;this.playingMode=mode;this.playing=true;this.bindPreview();void this.clock.unlock().then(()=>this.video!.play()).catch(e=>{this.playing=false;this.status(String(e),true);});this.status(mode==='Manual'?'演奏预览：按 Space 启动；绝对卡点不顺延':'自动试听：自动输入，预览不写游戏账本');
    }catch(e){this.status(e instanceof Error?e.message:String(e),true);}
  }
  private bindPreview(): void {
    const preview=this.reader?.getPreview();if(preview){this.effect?.bindPremiere(preview);this.effect?.bindNodeColors(this.reader!.getPreviewData()!.visual.nodes);}
  }
  update(dt = 0): void {
    if (!this.root || !this.reader) { return; }
    const d=this.reader.getDocument();if(d!==this.lastDocument){this.lastDocument=d;this.refreshDocument();if(d)this.saveDraft();}
    const preview=this.reader.getPreview();if(this.playing&&this.video?.ended&&preview?.getState()==='Playing')this.endedElapsedMs+=dt*1000;
    const now=this.time()+this.endedElapsedMs;
    if(this.playing && preview?.getState()==='Playing'){
      
      this.send({kind:'Advance',timeMs:now,ended:this.video?.ended??false});
    }
    const stage=this.el('editor-stage').getBoundingClientRect(),root=this.node.getComponent(UITransform);
    if(this.effect&&root){const sx=root.width/window.innerWidth,sy=root.height/window.innerHeight;this.effect.bindContentSize(stage.width*sx,stage.height*sy);this.effect.node.setPosition((stage.left+stage.width/2-window.innerWidth/2)*sx,(window.innerHeight/2-stage.top-stage.height/2)*sy);if(preview)this.effect.onFrameRefresh();else this.effect.clearVisuals();}
    if(preview?.getState()==='Completed'){this.playing=false;this.video?.pause();this.status('预览完成 · 不写游戏账本');}
    this.el('editor-score').textContent=preview?`${this.playingMode==='Rehearsal'?'自动试听':'演奏预览'} · ${preview.getState()} · P${preview.getPerfectCount()} G${preview.getGoodCount()} M${preview.getMissCount()}`:'位置与时间来自 MIDI';
    this.el('editor-time').textContent=(preview?.getCurrentTimeMs()??now).toFixed(0)+' ms';
    this.el<HTMLInputElement>('editor-timeline').max=String(d?.source.mediaDurationMs ?? (Number.isFinite(this.video?.duration) ? this.video!.duration * 1000 : 12000));if(this.playing)this.el<HTMLInputElement>('editor-timeline').value=String(now);
    if(d)this.draw(d.source,!!preview);
  }
  private refreshDocument(): void {
    const d=this.reader?.getDocument();this.el('editor-source').textContent=d?'数据来源：'+(d.source.provenance==='Mock'?'Mock':'MIDI'):'尚未加载';
    this.el<HTMLButtonElement>('undo').disabled=!d||d.history.cursor===0;this.el<HTMLButtonElement>('redo').disabled=!d||d.history.cursor===d.history.entries.length;
    if(!d)return;if(!d.source.events.some(e=>e.id===this.selectedId))this.selectedId=d.source.events[1].id;
    const event=d.source.events.find(e=>e.id===this.selectedId)!,isHead=d.selection.heads[event.lineId]===event.id,n=d.selection.nodes[event.id];
    this.el('selected-info').textContent=`${event.id} · 线 ${event.lineId} · ${event.timeMs} ms · (${event.position.u.toFixed(3)}, ${event.position.v.toFixed(3)})${isHead?' · Head':''}`;
    const kind=this.el<HTMLSelectElement>('node-kind');kind.value=n.kind;kind.disabled=isHead;
    const tail=this.el<HTMLSelectElement>('hold-end');tail.innerHTML='';const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='选择同线更晚音符';tail.appendChild(placeholder);
    for(const e of d.source.events.filter(e=>e.lineId===event.lineId&&e.timeMs>event.timeMs)){const option=document.createElement('option');option.value=e.id;option.textContent=e.id+' · '+e.timeMs+' ms';tail.appendChild(option);}tail.value=n.holdEndEventId??'';tail.disabled=isHead||n.kind!=='Hold';
    const list=this.el('editor-events');list.innerHTML='';for(const e of d.source.events){const button=document.createElement('button');button.textContent=`${e.id}  ${e.timeMs} ms  ${d.selection.heads[e.lineId]===e.id?'Head':d.selection.nodes[e.id].kind}`;button.className=e.id===this.selectedId?'selected':'';button.dataset.eventId=e.id;button.onclick=()=>{this.selectedId=e.id;this.lastDocument=null;};list.appendChild(button);}
    try{const chart=this.reader!.exportChart().chart;const node=chart.lines.flatMap(l=>l.nodes).find(n=>n.id==='node-'+event.id);this.el('key-info').textContent=node&&'keyId'in node?'自动键位：'+node.keyId:'Tap：输入时刻按判定点位置取键';}catch(e){this.el('key-info').textContent=e instanceof Error?e.message:String(e);}
  }
  private draw(source:ChartSourceData,hasPreview:boolean): void {
    const c=this.canvas!,r=c.getBoundingClientRect();if(c.width!==Math.round(r.width)||c.height!==Math.round(r.height)){c.width=Math.round(r.width);c.height=Math.round(r.height);}const ctx=c.getContext('2d')!;ctx.clearRect(0,0,c.width,c.height);
    if(!hasPreview){ctx.fillStyle='#0c1522';ctx.fillRect(0,0,c.width,c.height);}ctx.strokeStyle='#2c3b51';ctx.lineWidth=1;
    for(const slot of this.reader!.getLayout().slots){ctx.strokeRect(slot.u*c.width,(1-slot.v-slot.height)*c.height,slot.width*c.width,slot.height*c.height);ctx.fillStyle='#53647c';ctx.font='11px system-ui';ctx.fillText(slot.keyId.replace('Key','').replace('Digit',''),(slot.u+slot.width/2)*c.width,(1-slot.v-slot.height/2)*c.height);}
    if(hasPreview)return;const d=this.reader!.getDocument()!;ctx.strokeStyle='#e8eef6';ctx.lineWidth=2;
    for(const line of new Set(source.events.map(e=>e.lineId))){ctx.beginPath();source.events.filter(e=>e.lineId===line).forEach((e,i)=>{const x=e.position.u*c.width,y=(1-e.position.v)*c.height;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();}
    for(const e of source.events){const x=e.position.u*c.width,y=(1-e.position.v)*c.height,n=d.selection.nodes[e.id],head=d.selection.heads[e.lineId]===e.id;ctx.strokeStyle=e.id===this.selectedId?'#b9d3ff':'#fff';ctx.lineWidth=e.id===this.selectedId?4:2;ctx.beginPath();if(head||n.kind==='Drag')ctx.arc(x,y,head?14:11,0,Math.PI*2);else ctx.rect(x-11,y-11,22,22);ctx.stroke();
      if(n.kind==='Hold'&&n.holdEndEventId){const events=source.events.filter(t=>t.lineId===e.lineId),start=events.findIndex(t=>t.id===e.id),end=events.findIndex(t=>t.id===n.holdEndEventId);ctx.strokeStyle='#fff';ctx.lineWidth=2;for(let i=start+1;i<=end;i++){const a=events[i-1].position,b=events[i].position,ax=a.u*c.width,ay=(1-a.v)*c.height,bx=b.u*c.width,by=(1-b.v)*c.height,length=Math.hypot(bx-ax,by-ay);if(!length)continue;const dx=-(by-ay)/length*5,dy=(bx-ax)/length*5;ctx.beginPath();ctx.moveTo(ax+dx,ay+dy);ctx.lineTo(bx+dx,by+dy);ctx.lineTo(bx-dx,by-dy);ctx.lineTo(ax-dx,ay-dy);ctx.closePath();ctx.stroke();}}
      ctx.fillStyle=`rgb(${e.color.r},${e.color.g},${e.color.b})`;ctx.fillRect(x-5,y-5,10,10);ctx.fillStyle='#9cabc0';ctx.font='12px system-ui';ctx.fillText(e.id+' / '+e.timeMs+' ms',x-25,y+30);
    }
  }
  onDestroy(): void {this.stopPlayback();this.clock.destroy();window.removeEventListener('keydown',this.keyDown);window.removeEventListener('keyup',this.keyUp);this.root?.remove();if(this.videoUrl)URL.revokeObjectURL(this.videoUrl);}
}
