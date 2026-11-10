// Browser presentation clock: media samples -> actual audio output time (INV-12).
// No fixed compensation; output timestamp is already aligned, so do not subtract latency twice.
export class AudioOutputClock {
  private context: AudioContext | null = null;
  private bgmBuffer: AudioBuffer | null = null;
  private bgmSource: AudioBufferSourceNode | null = null;
  private bgmGain: GainNode | null = null;
  private bgmStartSeconds = -1;
  private video: HTMLVideoElement | null = null;
  private mediaSource: MediaElementAudioSourceNode | null = null;
  private chartTimeMs = -1;
  private chartAnchor: { mediaSeconds: number; contextSeconds: number } | null = null;
  private chartRunning = false;
  private disposed = false;
  private onMediaEnded = (): void => {
    if (this.video) { this.chartTimeMs = Math.max(this.chartTimeMs, this.video.currentTime * 1000); }
    this.onMediaPause();
  };
  private onMediaPlaying = (): void => {
    if (!this.video || !this.context) { return; }
    this.chartAnchor = { mediaSeconds: this.video.currentTime, contextSeconds: this.readOutputSeconds() };
    this.chartRunning = true;
  };
  private onMediaPause = (): void => {
    this.chartRunning = false;
    this.chartAnchor = null;
  };
  private onMediaWaiting = (): void => {
    this.chartRunning = false;
    this.chartAnchor = null;
  };

  private ensureContext(): AudioContext {
    if (!this.context) { this.context = new AudioContext(); }
    return this.context;
  }
  async loadBgm(url: string): Promise<void> {
    const context = this.ensureContext();
    const response = await fetch(url);
    if (!response.ok) { throw new Error('BGM HTTP ' + response.status); }
    const buffer = await context.decodeAudioData(await response.arrayBuffer());
    if (!this.disposed) { this.bgmBuffer = buffer; }
  }
  async unlock(): Promise<void> {
    if (this.disposed) { return; }
    await this.ensureContext().resume();
  }
  startBgm(): boolean {
    if (!this.bgmBuffer || this.disposed) { return false; }
    const context = this.ensureContext();
    if (context.state !== 'running') { return false; }
    if (this.bgmSource) { return true; }
    this.bgmGain = context.createGain();
    this.bgmGain.gain.value = 0;
    this.bgmGain.connect(context.destination);
    this.bgmSource = context.createBufferSource();
    this.bgmSource.buffer = this.bgmBuffer;
    this.bgmSource.loop = true;
    this.bgmSource.connect(this.bgmGain);
    this.bgmStartSeconds = context.currentTime;
    this.bgmSource.start(this.bgmStartSeconds);
    return true;
  }
  setBgmVolume(value: number): void {
    if (this.bgmGain && this.context) {
      this.bgmGain.gain.setValueAtTime(Math.max(0, Math.min(1, value)), this.context.currentTime);
    }
  }
  readBgmTimeMs(): number {
    if (!this.context || !this.bgmSource || this.bgmStartSeconds < 0) { return -1; }
    return Math.max(0, (this.readOutputSeconds() - this.bgmStartSeconds) * 1000);
  }
  attachVideo(video: HTMLVideoElement): void {
    if (this.video === video) { return; }
    this.detachVideo();
    this.video = video;
    const context = this.ensureContext();
    this.mediaSource = context.createMediaElementSource(video);
    this.mediaSource.connect(context.destination);
    video.addEventListener('playing', this.onMediaPlaying);
    video.addEventListener('pause', this.onMediaPause);
    video.addEventListener('waiting', this.onMediaWaiting);
    video.addEventListener('seeking', this.onMediaWaiting);
    video.addEventListener('ended', this.onMediaEnded);
  }
  resetChart(): void {
    this.chartAnchor = null;
    this.chartRunning = false;
    this.chartTimeMs = -1;
  }
  hasChartMediaEnded(): boolean {
    return this.video?.ended === true;
  }
  isChartMediaUnavailable(): boolean {
    return !this.video || this.video.error !== null || (!this.chartRunning && !this.video.ended);
  }
  readChartTimeMs(): number {
    const video = this.video;
    const context = this.context;
    if (!video || !context || video.readyState < 2 || video.seeking) { return -1; }
    if (!this.chartRunning || !this.chartAnchor) { return this.chartTimeMs; }
    // Chromium's media playback head already follows its audio output clock.
    // Pair it with output time, not the ahead-of-output AudioContext.currentTime.
    // Subtracting context latency again made Note/Strike lag the displayed frame.
    const outputSeconds = this.readOutputSeconds();
    this.chartAnchor = { mediaSeconds: video.currentTime, contextSeconds: outputSeconds };
    const mapped = (this.chartAnchor.mediaSeconds + outputSeconds - this.chartAnchor.contextSeconds) * 1000;
    this.chartTimeMs = Math.max(0, this.chartTimeMs, mapped);
    return this.chartTimeMs;
  }
  private readOutputSeconds(): number {
    const context = this.context!;
    const timestamp = context.getOutputTimestamp?.();
    if (context.state === 'running' && timestamp && typeof timestamp.performanceTime === 'number' &&
        typeof timestamp.contextTime === 'number' && timestamp.performanceTime > 0 &&
        timestamp.contextTime > 0 && performance.now() - timestamp.performanceTime < 1000) {
      return Math.min(context.currentTime, timestamp.contextTime +
        (performance.now() - timestamp.performanceTime) / 1000);
    }
    const measuredLatency = context.baseLatency + (context.outputLatency || 0);
    return Math.max(0, context.currentTime - measuredLatency);
  }
  private detachVideo(): void {
    if (this.video) {
      this.video.removeEventListener('playing', this.onMediaPlaying);
      this.video.removeEventListener('pause', this.onMediaPause);
      this.video.removeEventListener('waiting', this.onMediaWaiting);
      this.video.removeEventListener('seeking', this.onMediaWaiting);
      this.video.removeEventListener('ended', this.onMediaEnded);
    }
    this.mediaSource?.disconnect();
    this.mediaSource = null;
    this.video = null;
    this.resetChart();
  }
  destroy(): void {
    this.disposed = true;
    this.detachVideo();
    this.bgmSource?.stop();
    this.bgmSource?.disconnect();
    this.bgmGain?.disconnect();
    void this.context?.close();
  }
}
