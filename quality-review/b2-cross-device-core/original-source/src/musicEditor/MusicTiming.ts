import type { MusicProjectData } from './MusicProjectData';
import { musicFinite, musicInteger } from './MusicProjectData';

/** ColorMusic GameManager 时间线的 beat×60000/BPM，适配为 PPQ 分段积分。 */
export function tickToTimeMs(project: MusicProjectData, tick: number): number {
  musicFinite(tick,0,project.durationTicks);
  let ms = 0;
  for (let i=0; i<project.tempoMap.length && project.tempoMap[i].tick < tick; i++) {
    const point = project.tempoMap[i], end = Math.min(tick,project.tempoMap[i+1]?.tick ?? tick);
    ms += (end-point.tick) * 60000 / (project.ppq*point.bpm);
  }
  return musicFinite(ms,0);
}
export function musicProjectDurationMs(project: MusicProjectData): number {
  return musicFinite(tickToTimeMs(project,project.durationTicks)+Math.max(0,...project.tracks.map(t=>t.offsetMs)),Number.MIN_VALUE);
}
/** 全局项目时间的 tempo 积分逆变换；轨道正偏移造成的尾段钳制到项目尾 tick。 */
export function timeMsToTick(project: MusicProjectData, timeMs: number): number {
  musicFinite(timeMs,0);
  let elapsedMs = 0;
  for (let i=0;i<project.tempoMap.length;i++) {
    const point = project.tempoMap[i], endTick = project.tempoMap[i+1]?.tick ?? project.durationTicks;
    const segmentMs = (endTick-point.tick) * 60000 / (project.ppq * point.bpm);
    if (timeMs <= elapsedMs+segmentMs) { return Math.min(project.durationTicks,
      point.tick + (timeMs-elapsedMs) * project.ppq * point.bpm / 60000); }
    elapsedMs += segmentMs;
  }
  return project.durationTicks;
}
export function musicMeasureTicks(project: MusicProjectData): number {
  return project.ppq * 4 / project.timeSignature.denominator * project.timeSignature.numerator;
}
/** 原始来源 SynthMapping.ts:midiToFreq；只保留 A4=440 的纯数学，不带 WebSynth。 */
export function midiPitchToFrequency(pitch: number): number {
  musicInteger(pitch,0,127);
  return 440 * Math.pow(2,(pitch-69)/12);
}
