import { chartContentDigest, parseChartContentManifest } from './ChartArchive';
import { isValidatedWorldStateSnapshot } from './WorldStateCodec';
import type { WorldStateSnapshot } from './WorldStateSession';

/**
 * An additional published-reference boundary for the restricted Core prototype.
 * Complete certifies the graph; this check also binds every frozen performance to
 * the maker's publication index. No media bytes or missing historical values are
 * reconstructed here. The composition root verifies actual media before playback.
 */
export function validateCoreTransferContent(state: WorldStateSnapshot, rawManifest: unknown): void {
  if (!isValidatedWorldStateSnapshot(state)) { throw new Error('CoreTransferContentRequired: 接收端须先重新 parseComplete'); }
  if (state.worldKind !== 'Primary' || state.shoreOrigin !== null) { throw new Error('受限 Core 传输只支持正式 Primary 内容'); }
  const manifest = parseChartContentManifest(rawManifest);
  for (const record of state.sections.ChartSnapshot.records) {
    const chart = manifest.charts.find(value => value.chartId === record.chartId);
    if (!chart || chartContentDigest(record.chart) !== chart.chartDigest ||
        chartContentDigest(record.visual) !== chart.visualDigest) {
      throw new Error('受限 Core 的冻结谱面或视觉与正式发布内容不匹配：' + record.chartId);
    }
    const media = manifest.media.find(value => value.contentId === chart.mediaContentId);
    if (!media || chartContentDigest(record.media) !== chartContentDigest(media)) {
      throw new Error('受限 Core 的冻结媒体引用与正式发布内容不匹配：' + record.chartId);
    }
    if (record.chart.tier === 'World' && chart.contentRevision !== state.sections.Ledger.contentRevision) {
      throw new Error('受限 Core 的 World 谱面版本与正式叙事版本不匹配：' + record.chartId);
    }
  }
}
