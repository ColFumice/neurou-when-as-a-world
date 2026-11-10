import { WorldClearSession } from './WorldClearSession';
import type { WorldGameplayContext, WorldClearCallbacks, WorldClearSnapshot } from './WorldClearSession';
import type { WorldNarrativeContent } from './WorldNarrativeContent';
import type { IntentPort } from './IntentPort';
import type { PlayerIntent } from './PlayerIntent';
import type { LedgerSnapshot } from './LedgerHydration';
import { validateWorldForkOrigin } from './WorldForkOrigin';
import type { WorldForkOrigin } from './WorldForkOrigin';

/** Inherited premiere facts keep their music and score, without becoming a new account clear. */
export class ForkWorldClearSession extends WorldClearSession {
  private readonly inheritedPremiere: boolean;

  constructor(context: WorldGameplayContext, content: WorldNarrativeContent, legacy: IntentPort,
    callbacks: WorldClearCallbacks, hydrated: LedgerSnapshot | undefined, origin: WorldForkOrigin) {
    if (!hydrated) { throw new Error('分叉通关接线必须具备已经校验的继承账本'); }
    const verified = validateWorldForkOrigin(origin, context.accountId, context.worldId, hydrated);
    const inherited = verified.inheritedCompletionEventId !== null;
    super(context, content, legacy, inherited ? {
      ...callbacks,
      commitRecord: () => Promise.reject(new Error('继承的首演完成不生成本世界通关记录')),
    } : callbacks, hydrated);
    this.inheritedPremiere = inherited;
  }

  getWorldClearSnapshot(): WorldClearSnapshot {
    const snapshot = super.getWorldClearSnapshot();
    return this.inheritedPremiere ? Object.freeze({ ...snapshot, completionStatus: 'Inherited' as const,
      completionError: null, record: null }) : snapshot;
  }

  submitFrameIntents(intents: readonly PlayerIntent[], frameDurationSeconds: number): void {
    super.submitFrameIntents(this.inheritedPremiere ? intents.filter(intent =>
      intent.kind !== 'EnterWorldChart' && intent.kind !== 'RetryWorldClear') : intents, frameDurationSeconds);
  }
}
