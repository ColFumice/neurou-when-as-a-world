import type { MusicEditorReader } from '../musicEditor/MusicEditorSession';

type PlaybackNotes = ReturnType<MusicEditorReader['getPlaybackNotes']>;
export type MusicPreviewAudioState = 'Stopped' | 'Playing' | 'Paused' | 'Completed';

// Presentation-only试听：先离线生成 PCM，再由一个 AudioBufferSourceNode 播放。
// 不引入 ColorMusic AudioTrack / DSP / WebSynth / JNI；音高使用其标准 MIDI 公式。
export class MusicPreviewAudio {
  private context: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private state: MusicPreviewAudioState = 'Stopped';
  private durationMs = 0;
  private offsetMs = 0;
  private startedAt = 0;
  private generation = 0;
  private renderedFrames = 0;

  getState(): MusicPreviewAudioState { return this.state; }
  getRenderedFrames(): number { return this.renderedFrames; }
  getContextState(): string { return this.context?.state ?? 'unavailable'; }
  readTimeMs(): number {
    if (this.state === 'Playing' && this.context) {
      return Math.min(this.durationMs, this.offsetMs + (this.context.currentTime - this.startedAt) * 1000);
    }
    return this.offsetMs;
  }

  async play(notes: PlaybackNotes, durationMs: number): Promise<void> {
    const offset = this.state === 'Completed' ? 0 : this.readTimeMs();
    this.disconnectSource();
    this.state = 'Paused';
    const generation = ++this.generation;
    const Context = globalThis.AudioContext;
    if (!Context) { throw new Error('此浏览器无法播放音频'); }
    if (!this.context || this.context.state === 'closed') { this.context = new Context(); }
    const context = this.context;
    // 必须由按钮 gesture 调用，AudioContext.resume 是用户授权的解锁动作。
    await context.resume();
    if (generation !== this.generation || context !== this.context || context.state === 'closed') { return; }
    if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs > 600000) {
      throw new Error('试听时长必须在 0 到 10 分钟之间');
    }
    // 44.1kHz 保证 MIDI 0–127 的最高音也低于 Nyquist 频率。
    const sampleRate = 44100;
    const voicedFrames = notes.reduce((sum, note) => sum + Math.max(0, note.endTimeMs - note.timeMs) / 1000 * sampleRate, 0);
    if (voicedFrames > 80000000) { throw new Error('当前音符累计时长超出本批试听容量，请缩短音符或减少重叠'); }
    const buffer = context.createBuffer(1, Math.ceil(durationMs / 1000 * sampleRate), sampleRate);
    const pcm = buffer.getChannelData(0);
    for (const note of notes) {
      const start = Math.max(0, Math.round(note.timeMs / 1000 * sampleRate));
      const end = Math.min(pcm.length, Math.round(note.endTimeMs / 1000 * sampleRate));
      const length = end - start;
      if (length <= 0 || note.velocity === 0) { continue; }
      // ColorMusic 的等温律数学：A4=440Hz，MIDI pitch 每 12 步频率翻倍。
      const frequency = 440 * Math.pow(2, (note.pitch - 69) / 12);
      const gain = note.velocity / 127 * 0.22;
      const attack = Math.max(1, Math.min(length / 2, sampleRate * 0.008));
      const release = Math.max(1, Math.min(length / 2, sampleRate * 0.025));
      for (let frame = start; frame < end; frame += 1) {
        const local = frame - start;
        const envelope = Math.min(1, local / attack, (end - frame - 1) / release);
        pcm[frame] += Math.sin(local / sampleRate * frequency * Math.PI * 2) * gain * envelope;
      }
    }
    let peak = 0;
    for (const sample of pcm) { peak = Math.max(peak, Math.abs(sample)); }
    if (peak > 0.85) {
      const scale = 0.85 / peak;
      for (let index = 0; index < pcm.length; index += 1) { pcm[index] *= scale; }
    }
    if (generation !== this.generation || context !== this.context) { return; }
    this.durationMs = durationMs;
    this.offsetMs = Math.min(offset, Math.max(0, durationMs - 1));
    this.renderedFrames = pcm.length;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    this.source = source;
    this.startedAt = context.currentTime;
    this.state = 'Playing';
    source.onended = () => {
      if (this.source !== source || generation !== this.generation) { return; }
      this.offsetMs = durationMs;
      this.state = 'Completed';
      this.source = null;
      source.disconnect();
    };
    source.start(0, this.offsetMs / 1000);
  }

  pause(): void {
    if (this.state === 'Playing') { this.offsetMs = this.readTimeMs(); }
    ++this.generation;
    this.disconnectSource();
    this.state = 'Paused';
  }

  seek(timeMs: number, durationMs: number): void {
    ++this.generation;
    this.disconnectSource();
    this.durationMs = durationMs;
    this.offsetMs = Math.max(0, Math.min(durationMs, timeMs));
    this.state = this.offsetMs >= durationMs ? 'Completed' : 'Paused';
  }

  stop(): void {
    ++this.generation;
    this.disconnectSource();
    this.state = 'Stopped';
    this.offsetMs = 0;
  }

  destroy(): void {
    this.stop();
    const context = this.context;
    this.context = null;
    this.renderedFrames = 0;
    if (context && context.state !== 'closed') { void context.close().catch(() => undefined); }
  }

  private disconnectSource(): void {
    const source = this.source;
    this.source = null;
    if (!source) { return; }
    source.onended = null;
    try { source.stop(); } catch { /* 已自然结束。 */ }
    source.disconnect();
  }
}
