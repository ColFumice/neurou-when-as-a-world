// VERDICT-042 revised / VERDICT-226~228. Geometry is content, not a frame trigger.
import { NarrativeDimension } from '../../constants';
import { InputSource } from '../ledger/NarrativeEvent';
import type { NarrativeEvent, NarrativeVector } from '../ledger/NarrativeEvent';
import { validateNarrativeVector } from '../ledger/deriveLedgerPosition';

const dimensions: readonly NarrativeDimension[] = Object.values(NarrativeDimension)
  .filter((value): value is NarrativeDimension => typeof value === 'number');

export class SphereCrossing {
  private readonly EventSpaceCenter: NarrativeVector;
  private crossed = false;

  constructor(EventSpaceCenter: NarrativeVector, private readonly EventDistance: number) {
    this.EventSpaceCenter = validateNarrativeVector(EventSpaceCenter);
    if (!Number.isFinite(EventDistance) || EventDistance <= 0) {
      throw new Error('事件空间半径须为有限正值');
    }
  }

  getDistance(position: NarrativeVector): number {
    const validated = validateNarrativeVector(position);
    return Math.hypot(...dimensions.map(dimension => validated[dimension] - this.EventSpaceCenter[dimension]));
  }

  hasCrossed(): boolean { return this.crossed; }

  /** Invoke only after the same authoritative carrier has successfully appended. */
  onLedgerAppended(
    narrativeEvent: NarrativeEvent,
    targetCharacterId: string,
    protagonistCharacterId: string,
    ledgerPosition: NarrativeVector,
  ): boolean {
    if (this.crossed || narrativeEvent.InputSource !== InputSource.Player ||
        targetCharacterId !== protagonistCharacterId) { return false; }
    if (this.getDistance(ledgerPosition) < this.EventDistance) { return false; }
    this.crossed = true;
    return true;
  }
}
