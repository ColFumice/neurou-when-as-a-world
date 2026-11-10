import type { GameSignalSink, GameSinkEvent } from '../neuRuntime';

export interface NeuNarrativeStats {
  readonly neuAudioModules: number;
  readonly neuEffectModules: number;
  readonly neuLightModules: number;
  readonly neuResourceModules: number;
  readonly neuSubtitleModules: number;
  readonly bindingAudioCount: number;
}

/**
 * X · game / narrative。
 * 包住 GamePlaybackSink：先转发，再采集 NEU 去重模块；不改变 R4b 公开 API。
 */
export class NeuNarrativeCollector implements GameSignalSink {
  private readonly audio = new Set<string>();
  private readonly effect = new Set<string>();
  private readonly light = new Set<string>();
  private readonly resource = new Set<string>();
  private readonly subtitle = new Set<string>();
  private bindingAudioCountValue = 0;
  private diagnosticValue: string | null = null;
  private readonly onDiagnostic: ((message: string) => void) | null;

  constructor(
    private readonly delegate: GameSignalSink,
    onDiagnostic?: (message: string) => void,
  ) {
    this.onDiagnostic = onDiagnostic ?? null;
  }

  get diagnostic(): string | null {
    return this.diagnosticValue;
  }

  emit(event: GameSinkEvent): void {
    // R4b 的行为与异常语义先保持；采集只发生在转发之后。
    this.delegate.emit(event);
    try {
      if ('warning' in event) return;
      if (event.origin !== 'NEU') {
        if (event.signal.kind === 'Audio') this.bindingAudioCountValue += 1;
        return;
      }
      const moduleId = event.signal.moduleId;
      switch (event.signal.kind) {
        case 'Audio':
          this.audio.add(moduleId);
          break;
        case 'Effect':
          this.effect.add(moduleId);
          break;
        case 'Light':
          this.light.add(moduleId);
          break;
        case 'Resource':
          this.resource.add(moduleId);
          break;
        case 'Subtitle':
          this.subtitle.add(moduleId);
          break;
        default:
          break;
      }
    } catch (error) {
      this.report(error);
    }
  }

  snapshot(): NeuNarrativeStats {
    return {
      neuAudioModules: this.audio.size,
      neuEffectModules: this.effect.size,
      neuLightModules: this.light.size,
      neuResourceModules: this.resource.size,
      neuSubtitleModules: this.subtitle.size,
      bindingAudioCount: this.bindingAudioCountValue,
    };
  }

  reset(): void {
    this.audio.clear();
    this.effect.clear();
    this.light.clear();
    this.resource.clear();
    this.subtitle.clear();
    this.bindingAudioCountValue = 0;
    this.diagnosticValue = null;
  }

  private report(error: unknown): void {
    const message = `NEU 采集异常（已隔离）：${error instanceof Error ? error.message : String(error)}`;
    this.diagnosticValue = message;
    if (!this.onDiagnostic) return;
    try {
      this.onDiagnostic(message);
    } catch {
      // HUD callback must not break R4b.
    }
  }
}
