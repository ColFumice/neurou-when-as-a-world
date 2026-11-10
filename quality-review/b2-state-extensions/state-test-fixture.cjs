'use strict';
// Shared controlled-contract fixture: formal published World content and real ChartPremiere results.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), ts = require('typescript');
const root = path.resolve(__dirname, '../..');
require.extensions['.ts'] = (loaded, filename) => loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, strict: true },
}).outputText, filename);
const load = name => require(path.join(root, name));
const readJson = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const clone = value => JSON.parse(JSON.stringify(value));
const { WorldClearSession } = load('src/director/WorldClearSession.ts');
const { LedgerHydration } = load('src/director/LedgerHydration.ts');
const { RecallCountSession } = load('src/director/RecallCountSession.ts');
const { WorldLinkSession } = load('src/director/WorldLinkSession.ts');
const { ChartArchive, chartContentDigest } = load('src/director/ChartArchive.ts');
const { WorldStateCodec } = load('src/director/WorldStateCodec.ts');
const { ChartPremiere } = load('src/chart/ChartPremiere.ts');
const { parseGuidanceChart, positionAtPathDistance } = load('src/chart/GuidanceChart.ts');
const { createDefaultKeyboardPadLayout, resolveGridKeyAt } = load('src/chart/KeyboardPadLayout.ts');
const { parseWorldNarrativeContent } = load('src/director/WorldNarrativeContent.ts');
const { validatePuzzleProgressSnapshot } = load('src/director/PuzzleHydration.ts');
const { PuzzleChain } = load('src/trace/PuzzleChain.ts');
const { PuzzleProgress } = load('src/trace/PuzzleProgress.ts');
const content = parseWorldNarrativeContent(readJson('assets/resources/world/primary-rain-dialogue.json'));
const regular = readJson('assets/resources/chart/guidance_c.json');
const layout = createDefaultKeyboardPadLayout();
const chart = parseGuidanceChart(readJson('assets/resources/chart/primary-rain-world-1.json'), layout);
const visual = readJson('assets/resources/chart/primary-rain-world-1.visual.json');
const bytes = fs.readFileSync(path.join(root, 'assets/resources/audio/primary-rain-world-1.wav'));
const mediaIdentity = { kind: 'Audio', contentId: 'primary-rain-world-1-audio', contentRevision: '1.0.0',
  resourcePath: 'audio/primary-rain-world-1', sha256: crypto.createHash('sha256').update(bytes).digest('hex'), byteLength: bytes.length };
const epochMs = 1791600000000;
function fixture(options = {}) {
  const context = { accountId: options.accountId || 'extensions-contract', worldId: options.worldId || 'extensions-primary',
    worldKind: 'Primary', protagonistCharacterId: content.protagonistCharacterId };
  const archiveContext = { ...context, shoreOrigin: null };
  const ledgerHydration = new LedgerHydration(context, content);
  let accountCalls = 0;
  const legacy = { submitFrameIntents() {}, getCurrentPerceptionMode: () => 'Normal', getChartPlaybackState: () => 'Ready',
    isWorldMotionGated: () => false };
  const world = new WorldClearSession(context, content, legacy, { now: () => epochMs,
    readRecords: () => [], commitRecord: async () => { accountCalls++; } });
  const premiere = new ChartPremiere(chart, layout);
  let nativeTime = 0, ended = false;
  world.bindWorldChart(premiere, () => nativeTime, () => ({ ended, unavailable: false }));
  if (options.completed !== false) {
    world.submitFrameIntents([{ kind: 'ChooseWorldNarrative', choiceId: content.interaction.choices[0].choiceId }], 1 / 60);
    world.submitFrameIntents([{ kind: 'EnterWorldChart' }], 1 / 60);
    nativeTime = 6000; ended = true; world.submitFrameIntents([], 1 / 60);
  }
  const ledger = world.getLedgerSnapshot();
  const events = ledger.characters.find(value => value.characterId === context.protagonistCharacterId).events;
  const completion = events.find(value => value.ChartRef.state === 'PremiereCompleted');
  const archive = new ChartArchive(archiveContext);
  const archived = completion ? archive.preparePremiere({ completionEventId: completion.eventId, chart, layout, visual,
    media: mediaIdentity, guideTransparency: premiere.getGuideTransparency(), result: premiere.getResult() }, events)
    : { snapshots: archive.emptySnapshots(), scores: archive.emptyScores() };
  const recall = new RecallCountSession({ accountId: context.accountId, worldId: context.worldId,
    protagonistCharacterId: context.protagonistCharacterId, regularChartId: regular.chartId }, {
    readLedger: () => ledger, persistSnapshot() { throw new Error('helper Recall write not bound'); },
    now() { throw new Error('helper Recall clock not bound'); },
  });
  const link = new WorldLinkSession(archiveContext);
  const puzzle = { schemaVersion: 1, accountId: context.accountId, worldId: context.worldId,
    chainId: 'T6_MAIN_CHAIN', deepTraceId: 'T6_MAIN_DEEP_TRACE', ruleVersion: 1, chartId: regular.chartId,
    chain: new PuzzleChain(new PuzzleProgress(), 1000).capturePrivateState(),
    control: { currentPerceptionMode: 'Normal', beatClockOffsetMs: 0, endpointSettled: false,
      deepTraceTriggered: false, chartCompletionRecorded: false, revealPhase: 'Idle', chartEntryScheduled: false, worldMotionGated: false } };
  let parsedLedger = ledger;
  const codec = new WorldStateCodec({
    Ledger: raw => { parsedLedger = ledgerHydration.validate(raw); return parsedLedger; },
    PuzzleProgress: raw => validatePuzzleProgressSnapshot(raw, context.accountId, context.worldId,
      puzzle.chainId, puzzle.deepTraceId, regular.chartId,
      parsedLedger.characters.find(value => value.characterId === context.protagonistCharacterId).events),
    RecallCount: (raw, nextLedger) => recall.validate(raw, nextLedger),
    WorldLink: raw => link.validate(raw),
    ChartSnapshot: (raw, nextLedger) => archive.validateSnapshots(raw,
      nextLedger.characters.find(value => value.characterId === context.protagonistCharacterId).events),
    ChartScore: (raw, snapshots, nextLedger) => archive.validateScores(raw, snapshots,
      nextLedger.characters.find(value => value.characterId === context.protagonistCharacterId).events),
    Complete: core => {
      const nextEvents = core.sections.Ledger.characters.find(value => value.characterId === context.protagonistCharacterId).events;
      archive.validateSnapshots(core.sections.ChartSnapshot, nextEvents, true);
      archive.validateScores(core.sections.ChartScore, core.sections.ChartSnapshot, nextEvents, true);
    },
  });
  const initial = codec.parse({ schemaVersion: 1, accountId: context.accountId, worldId: context.worldId,
    worldKind: 'Primary', shoreOrigin: null, revision: 0, capturedAt: epochMs, kind: 'Core',
    sections: { Ledger: ledger, PuzzleProgress: [puzzle], FormatTime: { epochMs: epochMs - 5000 },
      RecallCount: recall.getSnapshot(), WorldLink: link.getSnapshot(), ChartSnapshot: archived.snapshots, ChartScore: archived.scores } });
  return { context, archiveContext, world, ledger, events, completion, archive, archived, recall, link, puzzle, codec, initial,
    accountCalls: () => accountCalls };
}
function actualResult(data = chart, resultLayout = layout, options = {}) {
  const premiere = new ChartPremiere(data, resultLayout); premiere.setGuideTransparency(options.transparency || 0); premiere.begin();
  if (options.perfect && 'notes' in data) { for (const note of data.notes) { premiere.submitStrike({ kind: 'Strike', keyId: note.keyId,
    videoTimeMs: note.timeMs, phase: 'Down' }); } }
  if (options.perfect && 'lines' in data) {
    const strikes = [];
    for (const line of data.lines) {
      strikes.push({ kind: 'Strike', keyId: 'Space', videoTimeMs: line.head.spawnTimeMs, phase: 'Down' });
      strikes.push({ kind: 'Strike', keyId: 'Space', videoTimeMs: line.head.spawnTimeMs + 1, phase: 'Up' });
      for (const node of line.nodes) {
        const time = line.timing.find(value => value.nodeId === node.id).targetTimeMs;
        const keyId = resolveGridKeyAt(resultLayout, positionAtPathDistance(line.path, data.aspectRatio, node.pathDistance));
        strikes.push({ kind: 'Strike', keyId, videoTimeMs: time, phase: 'Down' });
        strikes.push({ kind: 'Strike', keyId, videoTimeMs: time + 1, phase: 'Up' });
      }
    }
    strikes.sort((a, b) => a.videoTimeMs - b.videoTimeMs).forEach(strike => premiere.submitStrike(strike));
  }
  premiere.advance(options.time || 6000); premiere.advanceMediaStatus(true, false, 16); return premiere.getResult();
}
module.exports = { root, load, clone, fixture, actualResult, content, regular, layout, chart, visual, mediaIdentity, epochMs, ChartArchive, chartContentDigest };
