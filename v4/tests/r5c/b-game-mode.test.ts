import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  exploreReady,
  initialGameModeState,
  modeTransitionLocked,
  reduceGameMode,
  rhythmPhaseOf,
} from '../../app/src/game/gameMode';
import {
  CutsceneParseError,
  parseCutscene,
} from '../../app/src/game/cutscene';

function phaseOf(state: ReturnType<typeof initialGameModeState>): string | null {
  if (state.mode === 'Rhythm') return state.phase;
  if (state.mode === 'Cutscene') return state.phase;
  return null;
}

function readyExplore() {
  return reduceGameMode(initialGameModeState('explore'), { type: 'explore-ready' });
}

function readyRhythm(autoCountdown = true) {
  let state = readyExplore();
  state = reduceGameMode(state, { type: 'enter-rhythm', chartId: 'chart-w1' });
  state = reduceGameMode(state, {
    type: 'rhythm-loaded',
    autoCountdown,
    chartId: 'chart-w1',
  });
  return state;
}

describe('R5c-B GameMode state machine', () => {
  test('default is Explore loading; ready is explicit', () => {
    const initial = initialGameModeState();
    assert.equal(initial.mode, 'Explore');
    assert.equal(initial.status, 'loading');
    const ready = readyExplore();
    assert.equal(ready.mode, 'Explore');
    assert.equal(ready.status, 'ready');
    assert.equal(rhythmPhaseOf(ready), null);
  });

  test('EnterRhythm locks, loads to countdown, and cannot re-enter', () => {
    let state = readyExplore();
    state = reduceGameMode(state, { type: 'enter-rhythm', chartId: 'chart-w1' });
    assert.equal(state.mode, 'Rhythm');
    assert.equal(phaseOf(state), 'loading');
    assert.equal(modeTransitionLocked(state), true);
    const duplicate = reduceGameMode(state, { type: 'enter-rhythm', chartId: 'chart-w1' });
    assert.equal(duplicate, state);
    state = reduceGameMode(state, {
      type: 'rhythm-loaded',
      autoCountdown: true,
    });
    assert.equal(phaseOf(state), 'countdown');
    assert.equal(modeTransitionLocked(state), false);
    state = reduceGameMode(state, { type: 'rhythm-playing' });
    assert.equal(phaseOf(state), 'playing');
    state = reduceGameMode(state, { type: 'rhythm-complete' });
    assert.equal(phaseOf(state), 'completed');
    state = reduceGameMode(state, { type: 'exit-to-explore' });
    assert.equal(state.mode, 'Explore');
    assert.equal(state.status, 'ready');
  });

  test('debug rhythm loading goes ready, not auto countdown', () => {
    let state = initialGameModeState('rhythm');
    assert.equal(state.mode, 'Rhythm');
    assert.equal(state.entrySource, 'debug');
    state = reduceGameMode(state, {
      type: 'rhythm-loaded',
      autoCountdown: false,
      chartId: 'chart-w1',
    });
    assert.equal(phaseOf(state), 'ready');
    state = reduceGameMode(state, { type: 'rhythm-begin-countdown' });
    assert.equal(phaseOf(state), 'countdown');
  });

  test('pause/resume only from playing; complete only from playing', () => {
    let state = readyRhythm();
    state = reduceGameMode(state, { type: 'rhythm-playing' });
    const paused = reduceGameMode(state, { type: 'rhythm-pause' });
    assert.equal(phaseOf(paused), 'paused');
    assert.equal(phaseOf(reduceGameMode(paused, { type: 'rhythm-playing' })), 'paused');
    const resumed = reduceGameMode(paused, { type: 'rhythm-resume' });
    assert.equal(phaseOf(resumed), 'playing');
    assert.equal(
      reduceGameMode(readyRhythm(), { type: 'rhythm-complete' }).mode,
      'Rhythm',
    );
  });

  test('ExitToExplore is idempotent in Explore', () => {
    const state = readyExplore();
    assert.equal(reduceGameMode(state, { type: 'exit-to-explore' }), state);
  });

  test('ExitToExplore supersedes a locked transition', () => {
    let state = readyExplore();
    state = reduceGameMode(state, { type: 'enter-rhythm', chartId: 'chart-w1' });
    const exited = reduceGameMode(state, { type: 'exit-to-explore' });
    assert.equal(exited.mode, 'Explore');
    assert.equal(modeTransitionLocked(exited), false);
  });

  test('Cutscene is only from Explore and returns to Explore', () => {
    let state = readyExplore();
    state = reduceGameMode(state, { type: 'play-cutscene', cutsceneId: 'cs-intro' });
    assert.equal(state.mode, 'Cutscene');
    assert.equal(modeTransitionLocked(state), true);
    const duplicate = reduceGameMode(state, { type: 'play-cutscene', cutsceneId: 'cs-intro' });
    assert.equal(duplicate, state);
    state = reduceGameMode(state, { type: 'cutscene-started' });
    assert.equal(phaseOf(state), 'playing');
    assert.equal(modeTransitionLocked(state), false);
    state = reduceGameMode(state, { type: 'cutscene-completed', skipped: true });
    assert.equal(state.mode, 'Explore');
    assert.equal(state.status, 'ready');
  });

  test('Cutscene cannot start from Rhythm; errors return Explore warning', () => {
    let state = readyRhythm();
    assert.equal(
      reduceGameMode(state, { type: 'play-cutscene', cutsceneId: 'cs' }).mode,
      'Rhythm',
    );
    state = reduceGameMode(state, { type: 'rhythm-error', message: 'load failed' });
    assert.equal(phaseOf(state), 'error');
    state = reduceGameMode(state, { type: 'exit-to-explore' });
    assert.equal(state.mode, 'Explore');
    const cutscene = reduceGameMode(readyExplore(), {
      type: 'play-cutscene',
      cutsceneId: 'missing',
    });
    const warning = reduceGameMode(cutscene, {
      type: 'cutscene-error',
      message: 'cutscene missing',
    });
    assert.equal(warning.mode, 'Explore');
    assert.equal(warning.message, 'cutscene missing');
  });

  test('invalid transition actions preserve state identity', () => {
    const explore = readyExplore();
    assert.equal(reduceGameMode(explore, { type: 'rhythm-playing' }), explore);
    const rhythm = readyRhythm();
    assert.equal(reduceGameMode(rhythm, { type: 'play-cutscene', cutsceneId: 'x' }), rhythm);
  });

  test('exploreReady helper has no lock and Explore mode', () => {
    const state = exploreReady('warning');
    assert.deepEqual(state, {
      mode: 'Explore',
      status: 'ready',
      message: 'warning',
      transitionLock: null,
    });
  });
});

const validCutscene = {
  schemaVersion: 1,
  cutsceneId: 'cs-intro',
  durationMs: 3000,
  video: { assetId: 'asset:video:cutscene-intro' },
  audio: null,
  subtitles: [
    { startMs: 0, endMs: 1200, text: '雨夜。' },
    { startMs: 1200, endMs: 2600, text: '城市在呼吸。' },
  ],
  skippable: true,
  skipAfterMs: 300,
  endAction: 'ReturnToExplore',
};

describe('R5c-B Cutscene schema v1', () => {
  test('parses a valid cutscene', () => {
    const cutscene = parseCutscene(validCutscene, 'cs-intro');
    assert.equal(cutscene.cutsceneId, 'cs-intro');
    assert.equal(cutscene.durationMs, 3000);
    assert.equal(cutscene.video?.assetId, 'asset:video:cutscene-intro');
    assert.equal(cutscene.subtitles.length, 2);
    assert.equal(cutscene.skippable, true);
    assert.equal(cutscene.skipAfterMs, 300);
    assert.equal(cutscene.endAction, 'ReturnToExplore');
  });

  test('defaults skippable/skipAfterMs/endAction', () => {
    const cutscene = parseCutscene({
      schemaVersion: 1,
      cutsceneId: 'cs-min',
      durationMs: 1000,
      video: null,
      audio: null,
      subtitles: [{ startMs: 0, endMs: 1000, text: 'hi' }],
    });
    assert.equal(cutscene.skippable, true);
    assert.equal(cutscene.skipAfterMs, 0);
    assert.equal(cutscene.endAction, 'ReturnToExplore');
  });

  test('rejects wrong schema, id, unknown keys and bad asset refs', () => {
    assert.throws(() => parseCutscene({ ...validCutscene, schemaVersion: 2 }), CutsceneParseError);
    assert.throws(() => parseCutscene(validCutscene, 'other'), /must match/);
    assert.throws(() => parseCutscene({ ...validCutscene, extra: 1 }), /not allowed/);
    assert.throws(() => parseCutscene({
      ...validCutscene,
      video: { assetId: 'a', relPath: 'media/a.mp4' },
    }), /exactly one/);
    assert.throws(() => parseCutscene({
      ...validCutscene,
      video: { relPath: '../secret.mp4' },
    }), /project-relative/);
  });

  test('rejects invalid skip, end action, subtitles and empty content', () => {
    assert.throws(() => parseCutscene({ ...validCutscene, skipAfterMs: 4000 }), /skipAfterMs/);
    assert.throws(() => parseCutscene({ ...validCutscene, endAction: 'Next' }), /ReturnToExplore/);
    assert.throws(() => parseCutscene({
      ...validCutscene,
      subtitles: [{ startMs: 100, endMs: 100, text: 'x' }],
    }), /endMs/);
    assert.throws(() => parseCutscene({
      ...validCutscene,
      subtitles: [
        { startMs: 0, endMs: 2000, text: 'a' },
        { startMs: 1000, endMs: 2500, text: 'b' },
      ],
    }), /non-overlapping/);
    assert.throws(() => parseCutscene({
      schemaVersion: 1,
      cutsceneId: 'cs-empty',
      durationMs: 1000,
      video: null,
      audio: null,
      subtitles: [],
    }), /must define/);
  });
});
