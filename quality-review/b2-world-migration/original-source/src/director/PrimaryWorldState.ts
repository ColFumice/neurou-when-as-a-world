import { WorldStateCodec } from './WorldStateCodec';
import { LedgerHydration } from './LedgerHydration';
import type { LedgerSnapshot } from './LedgerHydration';
import { validatePuzzleProgressSnapshot } from './PuzzleHydration';
import { RecallCountSession } from './RecallCountSession';
import { validateWorldLinkSnapshot } from './WorldLinkSession';
import { ChartArchive } from './ChartArchive';
import type { WorldNarrativeContent } from './WorldNarrativeContent';

/** One content-bound decoder used both before activation and by directory inspection. */
export function createPrimaryWorldStateCodec(accountId: string, worldId: string,
  content: WorldNarrativeContent, regularChartId: string): WorldStateCodec {
  const context = { accountId, worldId, worldKind: 'Primary' as const, shoreOrigin: null,
    protagonistCharacterId: content.protagonistCharacterId };
  const hydration = new LedgerHydration(context, content);
  const events = (value: LedgerSnapshot): LedgerSnapshot['characters'][number]['events'] =>
    value.characters.find(character => character.characterId === content.protagonistCharacterId)!.events;
  const archive = new ChartArchive(context);
  const codec = new WorldStateCodec({
    Ledger: raw => hydration.validate(raw),
    PuzzleProgress: (raw, ledger) => validatePuzzleProgressSnapshot(raw, accountId, worldId,
      'T6_MAIN_CHAIN', 'T6_MAIN_DEEP_TRACE', regularChartId, ledger ? events(ledger) : []),
    RecallCount: (raw, value) => {
      if (!value) { throw new Error('回忆缺少权威账本'); }
      return new RecallCountSession({ accountId, worldId, protagonistCharacterId: content.protagonistCharacterId, regularChartId }, {
        readLedger: () => value, persistSnapshot: () => { throw new Error('校验不可写入'); }, now: () => { throw new Error('校验不可采样时钟'); },
      }).validate(raw, value);
    },
    WorldLink: raw => validateWorldLinkSnapshot(raw, context),
    ChartSnapshot: (raw, value) => {
      if (!value) { throw new Error('首演快照缺少权威账本'); }
      return archive.validateSnapshots(raw, events(value));
    },
    ChartScore: (raw, snapshots, value) => {
      if (!value || !snapshots) { throw new Error('谱面成绩缺少权威账本或首演快照'); }
      return archive.validateScores(raw, snapshots, events(value));
    },
    Complete: core => {
      if (core.worldKind !== 'Primary' || core.shoreOrigin !== null || core.sections.PuzzleProgress?.length !== 1 || !core.sections.Ledger) {
        throw new Error('完整状态必须匹配正式 Primary 身份与唯一稳定解谜链');
      }
      const snapshots = archive.validateSnapshots(core.sections.ChartSnapshot, events(core.sections.Ledger), true);
      archive.validateScores(core.sections.ChartScore, snapshots, events(core.sections.Ledger), true);
    },
  });
  return codec;
}
