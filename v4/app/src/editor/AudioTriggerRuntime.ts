/**
 * X · editor audio trigger runtime
 * WebAudio 采样触发；音频只重新触发，不 seek。
 */
export class AudioTriggerRuntime {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly active = new Set<AudioBufferSourceNode>();

  private ensureContext(): AudioContext {
    if (this.context) return this.context;
    const context = new AudioContext();
    const master = context.createGain();
    // 多条同时触发时给总输出留 headroom，避免采样叠加削波。
    master.gain.value = 0.8;
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -12;
    compressor.knee.value = 6;
    compressor.ratio.value = 8;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.12;
    master.connect(compressor);
    compressor.connect(context.destination);
    this.context = context;
    this.master = master;
    this.compressor = compressor;
    return context;
  }

  get state(): AudioContextState | 'uninitialized' {
    return this.context?.state ?? 'uninitialized';
  }

  async load(assetId: string, url: string): Promise<void> {
    if (this.buffers.has(assetId)) return;
    const context = this.ensureContext();
    const response = await fetch(url);
    if (!response.ok) throw new Error(`audio fetch failed: ${response.status}`);
    const data = await response.arrayBuffer();
    const buffer = await context.decodeAudioData(data.slice(0));
    this.buffers.set(assetId, buffer);
  }

  async resume(): Promise<boolean> {
    const context = this.ensureContext();
    if (context.state !== 'running') {
      await context.resume();
    }
    return context.state === 'running';
  }

  play(assetId: string, volume = 0.8): boolean {
    const context = this.context;
    const master = this.master;
    const buffer = this.buffers.get(assetId);
    if (!context || !master || !buffer || context.state !== 'running') return false;
    const source = context.createBufferSource();
    source.buffer = buffer;
    const gain = context.createGain();
    gain.gain.value = Math.min(0.8, Math.max(0, volume));
    source.connect(gain);
    gain.connect(master);
    source.onended = () => {
      this.active.delete(source);
      gain.disconnect();
      source.disconnect();
    };
    this.active.add(source);
    source.start(0);
    return true;
  }

  stopAll(): void {
    for (const source of this.active) {
      try {
        source.stop(0);
        source.disconnect();
      } catch {
        // already stopped
      }
    }
    this.active.clear();
  }

  dispose(): void {
    this.stopAll();
    this.buffers.clear();
    this.compressor?.disconnect();
    this.master?.disconnect();
    void this.context?.close();
    this.compressor = null;
    this.master = null;
    this.context = null;
  }
}
