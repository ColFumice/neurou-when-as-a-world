import type { ChartRef, ChartTier } from '../../constants';

/** An entry grants access; only a completed ledger reference proves a premiere. */
export interface ChartEntry {
  readonly entryId: string;
  readonly worldId: string;
  readonly characterId: string;
  readonly ChartRef: ChartRef;
  readonly tier: ChartTier;
  readonly source: 'DeepTrace' | 'SphereCrossing';
}
