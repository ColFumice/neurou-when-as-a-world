// INV-11: play the reveal, then report completion through IntentPort.
import { _decorator, Component, input, Input } from 'cc';
import type { DeepTrace } from '../trace/DeepTrace';
import type { IntentPort } from '../director/IntentPort';
import type { ScreenInvertRipple } from './ScreenInvertRipple';
const { ccclass } = _decorator;
const REVEAL_DURATION_SECONDS = 1.2;
const FLASH_DECAY_BASE = 0.9;
const FLASH_END_EPSILON = 0.004;
export function easeExpand(p: number): number {
  return Math.log(1 + 4 * Math.max(0, Math.min(1, p))) / Math.log(5);
}
@ccclass('DeepTraceRevealSequence')
export class DeepTraceRevealSequence extends Component {
  private deepTrace: DeepTrace | null = null;
  private intentPort: IntentPort | null = null;
  private invertRipple: ScreenInvertRipple | null = null;
  private phase: 'Idle' | 'Playing' | 'Flash' | 'Finished' = 'Idle';
  private elapsedSeconds = 0;
  private flashValue = 0;
  bindSource(deepTrace: DeepTrace): void { this.deepTrace = deepTrace; }
  bindIntentPort(intentPort: IntentPort): void { this.intentPort = intentPort; }
  bindInvertRipple(invertRipple: ScreenInvertRipple): void { this.invertRipple = invertRipple; }
  onEnable(): void { input.on(Input.EventType.MOUSE_DOWN, this.onSkipInput, this); }
  onDisable(): void {
    input.off(Input.EventType.MOUSE_DOWN, this.onSkipInput, this);
    this.invertRipple?.end();
  }
  update(deltaTime: number): void {
    if (this.phase === 'Idle') {
      if (this.deepTrace?.isTriggered() && this.invertRipple?.begin()) { this.phase = 'Playing'; }
      return;
    }
    if (this.phase === 'Playing') {
      this.elapsedSeconds += deltaTime;
      const p = this.elapsedSeconds / REVEAL_DURATION_SECONDS;
      if (p >= 1) {
        this.flashValue = 1;
        this.phase = 'Flash';
        this.invertRipple?.updateProgress(1, 1);
      } else { this.invertRipple?.updateProgress(p, 0); }
      return;
    }
    if (this.phase === 'Flash') {
      this.flashValue *= Math.pow(FLASH_DECAY_BASE, deltaTime * 60);
      if (this.flashValue < FLASH_END_EPSILON) { this.finishSequence(); }
      else { this.invertRipple?.updateProgress(1, this.flashValue); }
    }
  }
  private onSkipInput(): void {
    if (this.phase === 'Playing' || this.phase === 'Flash' ||
        (this.phase === 'Idle' && this.deepTrace?.isTriggered())) { this.finishSequence(); }
  }
  private finishSequence(): void {
    this.invertRipple?.end();
    this.phase = 'Finished';
    this.intentPort?.submitFrameIntents([{ kind: 'EnterChart' }], 0);
  }
}
