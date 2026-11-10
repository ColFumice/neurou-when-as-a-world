import type { TriggerSink } from '../triggerRuntime';
import type {
  TriggerDwell,
  TriggerEnter,
  TriggerExit,
  TriggerOccupancy,
  TriggerParallax,
} from '../../../../core/world/trigger';

export interface TriggerNarrativeStats {
  readonly triggerEnter: number;
  readonly triggerExit: number;
  readonly triggerDwell: number;
  readonly triggerOccupancy: number;
  readonly triggerParallax: number;
}

/**
 * X · game / narrative。
 * 包住 TriggerRuntime 的 HUD sink，按信号种类去重；不写账本。
 */
export class TriggerNarrativeCollector implements TriggerSink {
  private enterValue = 0;
  private exitValue = 0;
  private dwellValue = 0;
  private occupancyValue = 0;
  private parallaxValue = 0;
  private diagnosticValue: string | null = null;
  private readonly onDiagnostic: ((message: string) => void) | null;

  constructor(
    private readonly delegate: TriggerSink,
    onDiagnostic?: (message: string) => void,
  ) {
    this.onDiagnostic = onDiagnostic ?? null;
  }

  get diagnostic(): string | null {
    return this.diagnosticValue;
  }

  enter(signal: TriggerEnter): void {
    try {
      this.delegate.enter(signal);
      this.enterValue = 1;
    } catch (error) {
      this.report(error);
    }
  }

  exit(signal: TriggerExit): void {
    try {
      this.delegate.exit(signal);
      this.exitValue = 1;
    } catch (error) {
      this.report(error);
    }
  }

  dwell(signal: TriggerDwell): void {
    try {
      this.delegate.dwell(signal);
      this.dwellValue = 1;
    } catch (error) {
      this.report(error);
    }
  }

  occupancy(signal: TriggerOccupancy): void {
    try {
      this.delegate.occupancy(signal);
      this.occupancyValue = 1;
    } catch (error) {
      this.report(error);
    }
  }

  parallax(signal: TriggerParallax): void {
    try {
      this.delegate.parallax(signal);
      this.parallaxValue = 1;
    } catch (error) {
      this.report(error);
    }
  }

  snapshot(): TriggerNarrativeStats {
    return {
      triggerEnter: this.enterValue,
      triggerExit: this.exitValue,
      triggerDwell: this.dwellValue,
      triggerOccupancy: this.occupancyValue,
      triggerParallax: this.parallaxValue,
    };
  }

  reset(): void {
    this.enterValue = 0;
    this.exitValue = 0;
    this.dwellValue = 0;
    this.occupancyValue = 0;
    this.parallaxValue = 0;
    this.diagnosticValue = null;
  }

  private report(error: unknown): void {
    const message = `Trigger 采集异常（已隔离）：${error instanceof Error ? error.message : String(error)}`;
    this.diagnosticValue = message;
    if (!this.onDiagnostic) return;
    try {
      this.onDiagnostic(message);
    } catch {
      // HUD callback must not break trigger runtime.
    }
  }
}
