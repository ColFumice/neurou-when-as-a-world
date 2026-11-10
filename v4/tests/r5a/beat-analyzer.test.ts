import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeBeats } from '../../app/src/audio/beatAnalyzer';

const SAMPLE_RATE = 44100;

function clickTrack(
  bpm: number,
  seconds: number,
  downbeatEvery = 4,
): Float32Array {
  const samples = new Float32Array(Math.floor(SAMPLE_RATE * seconds));
  const period = 60 / bpm;
  const beats = Math.floor(seconds / period);
  for (let beat = 0; beat < beats; beat += 1) {
    const down = beat % downbeatEvery === 0;
    const frequency = down ? 80 : 1100;
    const amplitude = down ? 0.9 : 0.5;
    const start = Math.round(beat * period * SAMPLE_RATE);
    const length = Math.round(0.035 * SAMPLE_RATE);
    for (let offset = 0; offset < length && start + offset < samples.length; offset += 1) {
      const envelope = Math.exp(-offset / (0.009 * SAMPLE_RATE));
      samples[start + offset] += amplitude * envelope
        * Math.sin((2 * Math.PI * frequency * offset) / SAMPLE_RATE);
    }
  }
  return samples;
}

function noise(seconds: number, seed = 12345): Float32Array {
  const samples = new Float32Array(Math.floor(SAMPLE_RATE * seconds));
  let state = seed >>> 0;
  for (let index = 0; index < samples.length; index += 1) {
    state = (1664525 * state + 1013904223) >>> 0;
    samples[index] = ((state / 0xffffffff) * 2 - 1) * 0.35;
  }
  return samples;
}

function irregularTrack(): Float32Array {
  const samples = new Float32Array(SAMPLE_RATE * 8);
  const times = [0, 370, 910, 1230, 1870, 2210, 2890, 3300, 3910, 4470, 5210, 5600];
  for (const ms of times) {
    const start = Math.round((ms / 1000) * SAMPLE_RATE);
    for (let offset = 0; offset < 1200 && start + offset < samples.length; offset += 1) {
      samples[start + offset] += 0.7 * Math.exp(-offset / 300)
        * Math.sin((2 * Math.PI * 900 * offset) / SAMPLE_RATE);
    }
  }
  return samples;
}

describe('R5a.1 beat analyzer', () => {
  test('120 BPM click track: BPM ±2, downbeat phase ±20ms', () => {
    const result = analyzeBeats(clickTrack(120, 8), SAMPLE_RATE);
    assert.equal(result.ok, true, result.reason);
    assert.equal(result.meter, 4);
    assert.ok(result.bpm !== undefined && Math.abs(result.bpm - 120) <= 2, String(result.bpm));
    assert.ok(result.downbeatsMs !== undefined && result.downbeatsMs.length >= 3);
    assert.ok(result.confidence !== undefined && result.confidence > 0.5);
    const downbeats = result.downbeatsMs ?? [];
    for (const expected of [0, 2000, 4000, 6000]) {
      const closest = Math.min(...downbeats.map((actual) => Math.abs(actual - expected)));
      assert.ok(closest <= 20, `downbeat ${expected}ms closest error ${closest}ms`);
    }
  });

  test('silence → Silent', () => {
    const result = analyzeBeats(new Float32Array(SAMPLE_RATE * 5), SAMPLE_RATE);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'Silent');
  });

  test('white noise → NoBeat or LowConfidence', () => {
    const result = analyzeBeats(noise(6), SAMPLE_RATE);
    assert.equal(result.ok, false);
    assert.ok(result.reason === 'NoBeat' || result.reason === 'LowConfidence', result.reason);
  });

  test('free tempo irregular clicks → not ok', () => {
    const result = analyzeBeats(irregularTrack(), SAMPLE_RATE);
    assert.equal(result.ok, false);
  });
});
