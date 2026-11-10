import type { KeyboardPadLayout } from '../chart/KeyboardPadLayout';
import { resolveGridKeyAt } from '../chart/KeyboardPadLayout';
import { measurePathLength } from '../chart/GuidanceChart';
import type { ChartSourceData, MidiNoteEvent } from '../editor/GuidanceEditorSession';
import type { MusicProjectData } from './MusicProjectData';
import { parseMusicProjectData, freezeMusicData, musicInteger } from './MusicProjectData';
import { tickToTimeMs, musicProjectDurationMs, musicMeasureTicks } from './MusicTiming';

/** 稳定的双 32 位非安全校验和，只标识工程快照，不用于签名/安全认证。 */
function sourceFingerprint(project: MusicProjectData): string {
  const canonical = JSON.stringify(project);
  let first = 2166136261, second = 2246822507;
  for (let i=0;i<canonical.length;i++) {
    const code = canonical.charCodeAt(i);
    first = Math.imul(first ^ code,16777619) >>> 0;
    second = Math.imul(second ^ code,3266489909) >>> 0;
  }
  return first.toString(16).padStart(8,'0')+second.toString(16).padStart(8,'0');
}

/** 生产者到冻结契约的唯一转换边界；不导入 editor 的运行时写入能力。 */
export function buildChartSource(rawProject: MusicProjectData, revision: number, layout: KeyboardPadLayout): ChartSourceData {
  const project = parseMusicProjectData(rawProject,layout);
  musicInteger(revision,0);
  const events: MidiNoteEvent[] = project.tracks.flatMap(track=>track.notes.map(note=>({
    id: note.id, trackId: track.id, lineId: track.lineId,
    timeMs: tickToTimeMs(project,note.tick)+track.offsetMs, position: note.position, color: track.color,
    pitch: note.pitch, drumType: null, velocity: note.velocity,
    endTimeMs: tickToTimeMs(project,note.tick+note.durationTicks)+track.offsetMs,
    emphasis: note.tick % musicMeasureTicks(project) === 0,
  }))).sort((a,b)=>a.timeMs-b.timeMs || a.id.localeCompare(b.id,'en'));
  const lineIds = new Set(project.tracks.map(t=>t.lineId));
  for (const lineId of lineIds) {
    const line = events.filter(e=>e.lineId===lineId);
    if (line.length < 2) { throw new Error(lineId + ': 导出每条引导线至少需要两个真实音符'); }
    if (line.some(e=>resolveGridKeyAt(layout,e.position)===null)) { throw new Error(lineId + ': 导出位置未归属有效网格'); }
    if (!line.some(e=>e.position.u!==line[0].position.u || e.position.v!==line[0].position.v)) {
      throw new Error(lineId + ': 至少需要两个不同位置以构成引导线路径');
    }
    // 在冻结谱面同样的 aspectRatio 度量下验证折线，阻止极小横向尺寸下溢为零。
    const points = [line[0].position];
    for (const event of line.slice(1)) {
      const previous = points[points.length-1];
      if (previous.u===event.position.u && previous.v===event.position.v) { continue; }
      const length = measurePathLength({kind:'Polyline',points:[previous,event.position]},project.aspectRatio);
      if (!Number.isFinite(length) || length<=0) { throw new Error(lineId + ': 位置映射产生非有限或零长度路径段'); }
      points.push(event.position);
    }
    const length = measurePathLength({kind:'Polyline',points},project.aspectRatio);
    if (!Number.isFinite(length) || length<=0) { throw new Error(lineId + ': 位置映射的完整路径长度无效'); }
    // 既有 v3 要求节点严格晚于 Head；不合并同刻音符、不补造 Head。
    if (line[1].timeMs === line[0].timeMs) { throw new Error(lineId + ': 最早同刻和弦无法作为唯一 Head，请拆到不同引导线'); }
    for (let i=1;i<line.length;i++) {
      if (line[i].timeMs===line[i-1].timeMs &&
          (line[i].position.u!==line[i-1].position.u || line[i].position.v!==line[i-1].position.v)) {
        throw new Error(lineId + ': 同刻不同位置不能映射为一条引导线');
      }
    }
  }
  return freezeMusicData({ schemaVersion: 1, sourceId: project.projectId, sourceRevision: 'revision-'+revision+'-'+sourceFingerprint(project),
    provenance: 'Midi', layoutVersion: project.layoutVersion, aspectRatio: project.aspectRatio,
    mappingVersion: project.mappingVersion, mediaDurationMs: musicProjectDurationMs(project), events });
}
