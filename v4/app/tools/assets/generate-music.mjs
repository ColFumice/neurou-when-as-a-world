#!/usr/bin/env node
/**
 * R5b.1 · 生成《雨若》示例主题音乐。
 *
 * 90 BPM / 4/4 / 72s / 48kHz / 16-bit stereo / PCM WAV。
 * 结构：4 小节前奏 → 12 小节主歌 → 7 小节副歌 → 4 小节尾奏（共 27 小节）。
 * 全部由振荡器、噪声、滤波器与包络合成，不使用任何采样库。
 *
 * 用法：
 *   node generate-music.mjs
 *   node generate-music.mjs --bpm 90 --seconds 72 --sample-rate 48000
 *   node generate-music.mjs --gain 0.9 --seed 20261025
 *
 * 输出：
 *   v4/.stereo-demo/project/media/audio/theme.wav
 *   v4/.stereo-demo/project/media/audio/music-spec.json
 *   v4/.stereo-demo/project/media/audio/beats-grid.json
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../../..');
const DEFAULT_OUT = path.join(REPO_ROOT, 'v4', '.stereo-demo', 'project', 'media', 'audio');

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith('--')) result[key] = true;
    else {
      result[key] = next;
      index += 1;
    }
  }
  return result;
}

const args = parseArgs(process.argv.slice(2));
const SAMPLE_RATE = Number(args['sample-rate'] ?? 48000);
const BPM = Number(args.bpm ?? 90);
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const BARS = Number(args.bars ?? 27);
const DURATION = Number(args.seconds ?? BAR * BARS);
const FRAMES = Math.round(DURATION * SAMPLE_RATE);
const SEED = Number(args.seed ?? 20261025);
const OUT = args.out ? path.resolve(args.out) : DEFAULT_OUT;
const MASTER_GAIN = Number(args.gain ?? 0.92);
const TEXTURE = args['no-texture'] !== true;
const LEAN = args.lean === true;
const PAD = !LEAN && args['no-pad'] !== true;
const DRONE = !LEAN && args['no-drone'] !== true;
const SHORT_BASS = LEAN || args['short-bass'] === true;

fs.mkdirSync(OUT, { recursive: true });

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(SEED);
const TWO_PI = Math.PI * 2;
const SINE_SIZE = 4096;
const SINE = new Float32Array(SINE_SIZE + 1);
for (let index = 0; index <= SINE_SIZE; index += 1) {
  SINE[index] = Math.sin((index / SINE_SIZE) * TWO_PI);
}

function sine(phase) {
  const value = phase - Math.floor(phase);
  const position = value * SINE_SIZE;
  const index = position | 0;
  const fraction = position - index;
  return SINE[index] + (SINE[index + 1] - SINE[index]) * fraction;
}

const L = new Float32Array(FRAMES);
const R = new Float32Array(FRAMES);
const SEND_L = new Float32Array(FRAMES);
const SEND_R = new Float32Array(FRAMES);
const ECHO = new Float32Array(FRAMES);
const DUCK = new Float32Array(FRAMES).fill(1);
const KICK_TIMES = [];

function addSample(index, left, right, send = 0) {
  if (index < 0 || index >= FRAMES) return;
  L[index] += left;
  R[index] += right;
  SEND_L[index] += left * send;
  SEND_R[index] += right * send;
}

function lowpassCoefficient(cutoff) {
  return 1 - Math.exp((-TWO_PI * cutoff) / SAMPLE_RATE);
}

function addPad(startSec, durationSec, midiNotes, gain, options = {}) {
  const start = Math.max(0, Math.round(startSec * SAMPLE_RATE));
  const length = Math.min(FRAMES - start, Math.round(durationSec * SAMPLE_RATE));
  if (length <= 0) return;
  const attack = Math.round((options.attack ?? 1.1) * SAMPLE_RATE);
  const release = Math.round((options.release ?? 1.8) * SAMPLE_RATE);
  const cutoff = lowpassCoefficient(options.cutoff ?? 1350);
  const send = options.send ?? 0.42;
  const baseGain = gain / Math.max(1, midiNotes.length);
  for (let noteIndex = 0; noteIndex < midiNotes.length; noteIndex += 1) {
    const midi = midiNotes[noteIndex];
    const frequency = 440 * 2 ** ((midi - 69) / 12);
    const pan = (noteIndex / Math.max(1, midiNotes.length - 1)) * 1.4 - 0.7;
    const leftGain = Math.cos(((pan + 1) / 2) * Math.PI * 0.5);
    const rightGain = Math.sin(((pan + 1) / 2) * Math.PI * 0.5);
    const detuneLeft = 2 ** (-4 / 1200);
    const detuneRight = 2 ** (5 / 1200);
    let phaseLeft = random();
    let phaseRight = random();
    let filterLeft = 0;
    let filterRight = 0;
    for (let offset = 0; offset < length; offset += 1) {
      const index = start + offset;
      const time = offset / SAMPLE_RATE;
      const envelope = Math.min(1, offset / Math.max(1, attack))
        * Math.min(1, (length - offset) / Math.max(1, release))
        * (0.85 + 0.15 * Math.sin(time * 0.11 + noteIndex));
      const left = sine(phaseLeft) + 0.42 * sine(phaseLeft * 2.002);
      const right = sine(phaseRight) + 0.42 * sine(phaseRight * 2.002);
      filterLeft += cutoff * (left - filterLeft);
      filterRight += cutoff * (right - filterRight);
      const duck = DUCK[index];
      const valueLeft = filterLeft * envelope * baseGain * leftGain * duck;
      const valueRight = filterRight * envelope * baseGain * rightGain * duck;
      L[index] += valueLeft;
      R[index] += valueRight;
      SEND_L[index] += valueLeft * send;
      SEND_R[index] += valueRight * send;
      phaseLeft += (frequency * detuneLeft) / SAMPLE_RATE;
      phaseRight += (frequency * detuneRight) / SAMPLE_RATE;
    }
  }
}

function addPiano(startSec, midi, durationSec, gain, pan = 0) {
  const start = Math.max(0, Math.round(startSec * SAMPLE_RATE));
  const length = Math.min(FRAMES - start, Math.round(durationSec * SAMPLE_RATE));
  if (length <= 0) return;
  const frequency = 440 * 2 ** ((midi - 69) / 12);
  const leftGain = Math.cos(((pan + 1) / 2) * Math.PI * 0.5);
  const rightGain = Math.sin(((pan + 1) / 2) * Math.PI * 0.5);
  // 整数谐波：避免高次分音互相拍频，产生分析器会误判的密集能量峰。
  const partials = [
    { ratio: 1, amplitude: 1, decay: 2.9 },
    { ratio: 2, amplitude: 0.45, decay: 2.2 },
    { ratio: 3, amplitude: 0.22, decay: 1.6 },
    { ratio: 4, amplitude: 0.12, decay: 1.2 },
    { ratio: 5, amplitude: 0.07, decay: 0.9 },
  ];
  const phases = partials.map(() => random());
  const send = 0.4;
  for (let offset = 0; offset < length; offset += 1) {
    const index = start + offset;
    const time = offset / SAMPLE_RATE;
    const attack = Math.min(1, offset / (0.006 * SAMPLE_RATE));
    let value = 0;
    for (let partial = 0; partial < partials.length; partial += 1) {
      const item = partials[partial];
      const envelope = Math.exp(-time / item.decay);
      value += sine(phases[partial]) * item.amplitude * envelope;
      phases[partial] += (frequency * item.ratio) / SAMPLE_RATE;
    }
    value *= attack * gain;
    const left = value * leftGain;
    const right = value * rightGain;
    L[index] += left;
    R[index] += right;
    SEND_L[index] += left * send;
    SEND_R[index] += right * send;
    ECHO[index] += value * 0.1;
  }
}

function addBass(startSec, midi, durationSec, gain) {
  const start = Math.max(0, Math.round(startSec * SAMPLE_RATE));
  const length = Math.min(FRAMES - start, Math.round((SHORT_BASS ? Math.min(durationSec, 0.16) : durationSec) * SAMPLE_RATE));
  if (length <= 0) return;
  const frequency = 440 * 2 ** ((midi - 69) / 12);
  let phase = 0;
  const cutoff = lowpassCoefficient(360);
  let filter = 0;
  const send = 0.12;
  for (let offset = 0; offset < length; offset += 1) {
    const index = start + offset;
    const time = offset / SAMPLE_RATE;
    const attack = Math.min(1, offset / (0.008 * SAMPLE_RATE));
    const release = Math.min(1, (length - offset) / (0.12 * SAMPLE_RATE));
    const envelope = attack * release * (0.8 + 0.2 * Math.exp(-time / 0.35));
    const value = (sine(phase) * 0.9 + sine(phase * 2) * 0.1) * envelope;
    filter += cutoff * (value - filter);
    const duck = DUCK[index];
    const out = filter * gain * duck;
    L[index] += out * 0.92;
    R[index] += out * 0.92;
    SEND_L[index] += out * send;
    SEND_R[index] += out * send;
    phase += frequency / SAMPLE_RATE;
  }
}

function addKick(timeSec, gain = 0.42) {
  const start = Math.max(0, Math.round(timeSec * SAMPLE_RATE));
  const length = Math.min(FRAMES - start, Math.round(0.5 * SAMPLE_RATE));
  const send = 0.06;
  KICK_TIMES.push(timeSec);
  for (let offset = 0; offset < length; offset += 1) {
    const index = start + offset;
    const time = offset / SAMPLE_RATE;
    const frequency = 100 + 80 * Math.exp(-time / 0.028);
    const envelope = Math.exp(-time / 0.12);
    const click = (random() * 2 - 1) * Math.exp(-time / 0.0035) * 0.18;
    const value = (sine((time * frequency) % 1) * envelope + click) * gain;
    L[index] += value;
    R[index] += value;
    SEND_L[index] += value * send;
    SEND_R[index] += value * send;
  }
}

/** 低频心跳：给每一拍一个可被节拍分析器抓住的低频起音，但听感上只是胸腔的脉动。 */
function addSubPulse(timeSec, gain = 0.08) {
  const start = Math.max(0, Math.round(timeSec * SAMPLE_RATE));
  const length = Math.min(FRAMES - start, Math.round(0.22 * SAMPLE_RATE));
  let phase = 0;
  for (let offset = 0; offset < length; offset += 1) {
    const index = start + offset;
    const time = offset / SAMPLE_RATE;
    const frequency = 100 + 20 * Math.exp(-time / 0.025);
    const envelope = Math.min(1, offset / (0.004 * SAMPLE_RATE)) * Math.exp(-time / 0.07);
    const value = sine(phase) * envelope * gain;
    L[index] += value;
    R[index] += value;
    SEND_L[index] += value * 0.05;
    SEND_R[index] += value * 0.05;
    phase += frequency / SAMPLE_RATE;
  }
}

/** 2ms 的短促木质 click，只提供拍点瞬态；没有长尾，不会掩蔽和声。 */
function addTick(timeSec, gain = 0.2) {
  const start = Math.max(0, Math.round((timeSec * SAMPLE_RATE) / 512) * 512);
  const length = Math.min(FRAMES - start, Math.round(0.012 * SAMPLE_RATE));
  let phase = 0;
  for (let offset = 0; offset < length; offset += 1) {
    const index = start + offset;
    const time = offset / SAMPLE_RATE;
    const envelope = Math.exp(-time / 0.0018);
    const noise = random() * 2 - 1;
    const value = (noise * 0.65 + sine(phase) * 0.35) * envelope * gain;
    L[index] += value * 0.9;
    R[index] += value;
    phase += 1850 / SAMPLE_RATE;
  }
}

function addSnare(timeSec, gain = 0.2, pan = 0) {
  const start = Math.max(0, Math.round(timeSec * SAMPLE_RATE));
  const length = Math.min(FRAMES - start, Math.round(0.28 * SAMPLE_RATE));
  const leftGain = Math.cos(((pan + 1) / 2) * Math.PI * 0.5);
  const rightGain = Math.sin(((pan + 1) / 2) * Math.PI * 0.5);
  let previous = 0;
  let tonePhase = 0;
  const send = 0.2;
  for (let offset = 0; offset < length; offset += 1) {
    const index = start + offset;
    const time = offset / SAMPLE_RATE;
    const envelope = Math.exp(-time / 0.11);
    const noise = random() * 2 - 1;
    const high = noise - previous * 0.55;
    previous = noise;
    const tone = sine(tonePhase) * Math.exp(-time / 0.07);
    tonePhase += 185 / SAMPLE_RATE;
    const value = (high * 0.7 + tone * 0.4) * envelope * gain;
    L[index] += value * leftGain;
    R[index] += value * rightGain;
    SEND_L[index] += value * leftGain * send;
    SEND_R[index] += value * rightGain * send;
  }
}

function addHat(timeSec, gain = 0.035, open = false, pan = 0) {
  if (!TEXTURE) return;
  const start = Math.max(0, Math.round(timeSec * SAMPLE_RATE));
  const decay = open ? 0.12 : 0.028;
  const length = Math.min(FRAMES - start, Math.round((open ? 0.25 : 0.08) * SAMPLE_RATE));
  const leftGain = Math.cos(((pan + 1) / 2) * Math.PI * 0.5);
  const rightGain = Math.sin(((pan + 1) / 2) * Math.PI * 0.5);
  let previous = 0;
  for (let offset = 0; offset < length; offset += 1) {
    const index = start + offset;
    const time = offset / SAMPLE_RATE;
    const noise = random() * 2 - 1;
    const high = noise - previous;
    previous = noise;
    const value = high * Math.exp(-time / decay) * gain;
    L[index] += value * leftGain;
    R[index] += value * rightGain;
  }
}

function addClap(timeSec, gain = 0.1) {
  for (let burst = 0; burst < 3; burst += 1) {
    const start = Math.max(0, Math.round((timeSec + burst * 0.012) * SAMPLE_RATE));
    const length = Math.min(FRAMES - start, Math.round(0.12 * SAMPLE_RATE));
    let previous = 0;
    for (let offset = 0; offset < length; offset += 1) {
      const index = start + offset;
      const time = offset / SAMPLE_RATE;
      const noise = random() * 2 - 1;
      const high = noise - previous * 0.7;
      previous = noise;
      const value = high * Math.exp(-time / 0.035) * gain * (1 - burst * 0.18);
      L[index] += value * 0.8;
      R[index] += value;
      SEND_L[index] += value * 0.1;
      SEND_R[index] += value * 0.1;
    }
  }
}

function addShaker(timeSec, gain = 0.018, pan = 0.2) {
  if (!TEXTURE) return;
  const start = Math.max(0, Math.round(timeSec * SAMPLE_RATE));
  const length = Math.min(FRAMES - start, Math.round(0.07 * SAMPLE_RATE));
  const leftGain = Math.cos(((pan + 1) / 2) * Math.PI * 0.5);
  const rightGain = Math.sin(((pan + 1) / 2) * Math.PI * 0.5);
  let previous = 0;
  for (let offset = 0; offset < length; offset += 1) {
    const index = start + offset;
    const time = offset / SAMPLE_RATE;
    const noise = random() * 2 - 1;
    const high = noise - previous;
    previous = noise;
    const value = high * Math.exp(-time / 0.018) * gain;
    L[index] += value * leftGain;
    R[index] += value * rightGain;
  }
}

function addImpact(timeSec, gain = 0.5) {
  const start = Math.max(0, Math.round(timeSec * SAMPLE_RATE));
  const length = Math.min(FRAMES - start, Math.round(1.8 * SAMPLE_RATE));
  let phase = 0;
  let filter = 0;
  for (let offset = 0; offset < length; offset += 1) {
    const index = start + offset;
    const time = offset / SAMPLE_RATE;
    const frequency = 34 + 52 * Math.exp(-time / 0.18);
    const envelope = Math.exp(-time / 0.55);
    const rumble = (random() * 2 - 1) * Math.exp(-time / 0.9) * 0.16;
    phase += frequency / SAMPLE_RATE;
    filter += 0.02 * (sine(phase) - filter);
    const value = (filter * 1.2 + rumble) * envelope * gain;
    L[index] += value;
    R[index] += value;
    SEND_L[index] += value * 0.15;
    SEND_R[index] += value * 0.15;
  }
}

function addRiser(startSec, endSec, gain = 0.08) {
  const start = Math.max(0, Math.round(startSec * SAMPLE_RATE));
  const length = Math.min(FRAMES - start, Math.round((endSec - startSec) * SAMPLE_RATE));
  let band = 0;
  let phase = 0;
  for (let offset = 0; offset < length; offset += 1) {
    const index = start + offset;
    const progress = offset / Math.max(1, length);
    const frequency = 120 + 5200 * progress ** 2;
    phase += frequency / SAMPLE_RATE;
    const noise = random() * 2 - 1;
    band += 0.08 * (noise - band);
    const envelope = progress ** 1.6 * (1 - Math.max(0, progress - 0.94) / 0.06);
    const value = (band * 0.8 + sine(phase) * 0.12) * envelope * gain;
    L[index] += value * 0.7;
    R[index] += value;
    SEND_L[index] += value * 0.4;
    SEND_R[index] += value * 0.4;
  }
}

function addRain() {
  if (!TEXTURE) return;
  // 雨声铺底：带通噪声 + 缓慢的段落自动化，不盖住鼓和钢琴。
  let lowL = 0;
  let lowR = 0;
  let lowL2 = 0;
  let lowR2 = 0;
  let slowL = 0;
  let slowR = 0;
  for (let index = 0; index < FRAMES; index += 1) {
    const time = index / SAMPLE_RATE;
    const bar = time / BAR;
    let level;
    if (bar < 4) level = 0.032;
    else if (bar < 16) level = 0.012;
    else if (bar < 23) level = 0.008;
    else level = 0.038;
    // 段落交界处淡入淡出。
    if (bar > 3 && bar < 4.4) level *= (bar - 3) / 1.4;
    if (bar > 22.5 && bar < 23.5) level *= 1 - Math.abs(bar - 23) * 1.6;
    const noiseL = random() * 2 - 1;
    const noiseR = random() * 2 - 1;
    lowL += 0.15 * (noiseL - lowL);
    lowR += 0.15 * (noiseR - lowR);
    lowL2 += 0.02 * (noiseL - lowL2);
    lowR2 += 0.02 * (noiseR - lowR2);
    // 以低频雨幕为主，只留一点高频嘶声；避免密集噪声起音干扰节拍分析。
    const bandL = lowL;
    const bandR = lowR;
    slowL += 0.0015 * (bandL - slowL);
    slowR += 0.0015 * (bandR - slowR);
    const modulation = 0.7 + 0.3 * Math.sin(time * 0.17) * Math.sin(time * 0.053 + 1.1);
    const outL = (bandL * 0.8 + slowL * 0.7 + (lowL - lowL2) * 0.08) * level * modulation;
    const outR = (bandR * 0.8 + slowR * 0.7 + (lowR - lowR2) * 0.08) * level * modulation;
    L[index] += outL;
    R[index] += outR;
    SEND_L[index] += outL * 0.2;
    SEND_R[index] += outR * 0.2;
  }
}

function addSubDrone() {
  let phase = 0;
  let phase2 = 0;
  for (let index = 0; index < FRAMES; index += 1) {
    const time = index / SAMPLE_RATE;
    const envelope = Math.min(1, time / 3) * Math.min(1, (DURATION - time) / 4);
    const swells = 0.65 + 0.35 * Math.sin(time * 0.052 + 0.7);
    const value = (sine(phase) * 0.035 + sine(phase2) * 0.008) * envelope * swells;
    L[index] += value;
    R[index] += value;
    phase += 110 / SAMPLE_RATE;
    phase2 += 165.3 / SAMPLE_RATE;
  }
}

function addShimmer(timeSec, midi, gain = 0.03) {
  const start = Math.max(0, Math.round(timeSec * SAMPLE_RATE));
  const length = Math.min(FRAMES - start, Math.round(5.5 * SAMPLE_RATE));
  const frequency = 440 * 2 ** ((midi - 69) / 12);
  let phase = random();
  for (let offset = 0; offset < length; offset += 1) {
    const index = start + offset;
    const time = offset / SAMPLE_RATE;
    const envelope = Math.min(1, offset / (0.2 * SAMPLE_RATE)) * Math.exp(-time / 2.6);
    const value = (sine(phase) * 0.7 + sine(phase * 2.003) * 0.2) * envelope * gain;
    L[index] += value * 0.7;
    R[index] += value;
    SEND_L[index] += value * 0.7;
    SEND_R[index] += value;
    phase += frequency / SAMPLE_RATE;
  }
}

// ---------------------------------------------------------------------------
// 和声与段落
// ---------------------------------------------------------------------------

const CHORDS = {
  Am: [45, 52, 57, 60, 64, 67],
  F: [41, 48, 53, 57, 60, 64],
  C: [36, 43, 48, 55, 59, 64],
  G: [43, 50, 55, 59, 62, 67],
};
// 低音抬到 A2/F2/C3/G2 一带：既有低频重量，又不会被 21ms 分析帧的 RMS 波动干扰。
const ROOTS = { Am: 45, F: 41, C: 48, G: 43 };
const PIANO_MOTIF = {
  Am: [69, 72, 76, 79, 76, 72],
  F: [65, 69, 72, 76, 72, 69],
  C: [67, 72, 76, 79, 76, 72],
  G: [67, 71, 74, 79, 74, 71],
};

function chordAtBar(bar) {
  if (bar < 4) return ['Am', 'F', 'C', 'G'][bar];
  if (bar < 16) return ['Am', 'F', 'C', 'G'][bar % 4];
  if (bar < 23) return ['F', 'C', 'G', 'Am', 'F', 'C', 'G'][bar - 16];
  return ['Am', 'F', 'C', 'Am'][bar - 23];
}

function sectionAtBar(bar) {
  if (bar < 4) return 'intro';
  if (bar < 16) return 'verse';
  if (bar < 23) return 'chorus';
  return 'outro';
}

// 先算 kick 时间，生成 sidechain duck 包络。
for (let bar = 4; bar < 16; bar += 1) {
  KICK_TIMES.push(bar * BAR, bar * BAR + BEAT * 2.5);
}
for (let bar = 16; bar < 23; bar += 1) {
  for (let beat = 0; beat < 4; beat += 1) KICK_TIMES.push(bar * BAR + beat * BEAT);
}
KICK_TIMES.sort((a, b) => a - b);
for (const time of KICK_TIMES) {
  const start = Math.max(0, Math.round(time * SAMPLE_RATE));
  const length = Math.min(FRAMES - start, Math.round(0.34 * SAMPLE_RATE));
  for (let offset = 0; offset < length; offset += 1) {
    const amount = 0.42 * Math.exp(-offset / (0.11 * SAMPLE_RATE));
    const index = start + offset;
    DUCK[index] = Math.min(DUCK[index], 1 - amount);
  }
}

// ---------------------------------------------------------------------------
// 编曲
// ---------------------------------------------------------------------------

addSubDrone();
addRain();

for (let bar = 0; bar < BARS; bar += 1) {
  const chord = chordAtBar(bar);
  const section = sectionAtBar(bar);
  const chordNotes = CHORDS[chord];
  const start = bar * BAR;
  const padGain = section === 'intro' ? 0.075 : section === 'verse' ? 0.09 : section === 'chorus' ? 0.115 : 0.07;
  addPad(start, BAR + 0.7, chordNotes, padGain, {
    attack: section === 'intro' ? 1.8 : 0.9,
    release: section === 'outro' ? 2.6 : 1.6,
    cutoff: section === 'chorus' ? 1900 : 1200,
    send: 0.45,
  });

  // 低音。
  const root = ROOTS[chord];
  if (section === 'intro') {
    // 稀疏的低音，只在每两小节出现。
    if (bar % 2 === 0) addBass(start, root, BEAT * 2.2, 0.09);
  } else if (section === 'verse') {
    // 四分音符的低音，和心跳一起把 90 BPM 的拍点钉住。
    addBass(start, root, BEAT * 0.82, 0.16);
    addBass(start + BEAT, root, BEAT * 0.7, 0.12);
    addBass(start + BEAT * 2, root + 12, BEAT * 0.72, 0.12);
    addBass(start + BEAT * 3, root, BEAT * 0.7, 0.11);
  } else if (section === 'chorus') {
    addBass(start, root, BEAT * 0.8, 0.17);
    addBass(start + BEAT, root + 12, BEAT * 0.7, 0.13);
    addBass(start + BEAT * 2, root, BEAT * 0.78, 0.16);
    addBass(start + BEAT * 3, root + 7, BEAT * 0.7, 0.13);
  } else {
    addBass(start, root, BEAT * 3.4, 0.085);
  }

  // 钢琴动机。
  const motif = PIANO_MOTIF[chord];
  if (section === 'intro') {
    const introNotes = [
      { beat: 0.0, note: 0, duration: 2.6, gain: 0.14 },
      { beat: 1.6, note: 3, duration: 2.2, gain: 0.09 },
      { beat: 2.6, note: 2, duration: 2.4, gain: 0.08 },
    ];
    if (bar % 2 === 0) {
      for (const item of introNotes) {
        addPiano(start + item.beat * BEAT, motif[item.note], item.duration * BEAT, item.gain, 0.15);
      }
    }
  } else if (section === 'verse') {
    if (LEAN) {
      const arp = [motif[0], motif[2], motif[4], motif[3]];
      for (let beat = 0; beat < 4; beat += 1) {
        addPiano(start + beat * BEAT, arp[beat], BEAT * 1.05, beat === 0 ? 0.11 : 0.075, beat % 2 ? 0.15 : -0.15);
      }
      addPiano(start, motif[0] - 12, BEAT * 2.6, 0.055, -0.2);
    } else if (bar % 2 === 0) {
      addPiano(start, motif[0], BEAT * 2.6, 0.12, 0.1);
      addPiano(start + BEAT * 2, motif[2], BEAT * 2.2, 0.08, -0.15);
      addPiano(start + BEAT * 3, motif[4], BEAT * 1.6, 0.06, 0.2);
    }
  } else if (section === 'chorus') {
    if (LEAN) {
      const arp = [motif[0], motif[1], motif[2], motif[3]];
      for (let beat = 0; beat < 4; beat += 1) {
        addPiano(start + beat * BEAT, arp[beat], BEAT * 1.1, beat === 0 ? 0.13 : 0.09, beat % 2 ? 0.2 : -0.15);
      }
      addPiano(start, motif[0] - 12, BEAT * 3.2, 0.06, -0.2);
    } else {
      addPiano(start, motif[0], BEAT * 2.4, 0.14, 0.1);
      addPiano(start + BEAT, motif[2], BEAT * 1.7, 0.1, -0.1);
      addPiano(start + BEAT * 2, motif[3], BEAT * 2.2, 0.11, 0.2);
      addPiano(start + BEAT * 3, motif[4], BEAT * 1.6, 0.08, -0.15);
      addPiano(start + BEAT * 0.0, motif[0] - 12, BEAT * 3.0, 0.07, -0.2);
    }
  } else {
    const outroNotes = [
      { beat: 0, note: 0, duration: 3.2, gain: 0.12 },
      { beat: 1.8, note: 2, duration: 2.8, gain: 0.075 },
    ];
    for (const item of outroNotes) {
      addPiano(start + item.beat * BEAT, motif[item.note], item.duration * BEAT, item.gain, 0.1);
    }
  }

  // 鼓组：所有重音都落在四分音符上，避免分析器把八分音符当成 180 BPM。
  if (section === 'intro') {
    // 前奏也保留一条很轻的拍点，让 90 BPM 网格从头到尾连续。
    for (let beat = 0; beat < 4; beat += 1) addTick(start + beat * BEAT, beat === 0 ? (LEAN ? 0.14 : 0.010) : (LEAN ? 0.09 : 0.006));
  } else if (section === 'outro') {
    for (let beat = 0; beat < 4; beat += 1) addTick(start + beat * BEAT, beat === 0 ? (LEAN ? 0.04 : 0.008) : (LEAN ? 0.02 : 0.005));
  } else if (section === 'verse') {
    for (let beat = 0; beat < 4; beat += 1) addSubPulse(start + beat * BEAT, beat === 0 ? 0.11 : 0.075);
    addKick(start, 0.36);
    addKick(start + BEAT * 2, 0.3);
    addSnare(start + BEAT, 0.16, 0.05);
    addSnare(start + BEAT * 3, 0.16, 0.05);
    for (let beat = 0; beat < 4; beat += 1) {
      addHat(start + beat * BEAT, beat % 2 === 0 ? 0.004 : 0.006, false, beat % 2 ? -0.28 : 0.28);
      addTick(start + beat * BEAT, beat === 0 ? (LEAN ? 0.12 : 0.012) : (LEAN ? 0.075 : 0.008));
    }
    // 建曲段：只加轻的 16 分沙锤，不产生新的重拍。
    if (bar >= 12) {
      if (bar === 15) {
        for (let hit = 0; hit < 6; hit += 1) {
          addSnare(start + BEAT * 3 + hit * BEAT * 0.16, 0.035 + hit * 0.008, -0.1);
        }
      }
    }
  } else if (section === 'chorus') {
    for (let beat = 0; beat < 4; beat += 1) {
      addSubPulse(start + beat * BEAT, 0.1);
      addKick(start + beat * BEAT, 0.32);
    }
    addSnare(start + BEAT, 0.18, 0.02);
    addSnare(start + BEAT * 3, 0.18, 0.02);
    addClap(start + BEAT, 0.06);
    addClap(start + BEAT * 3, 0.06);
    for (let beat = 0; beat < 4; beat += 1) {
      addHat(start + beat * BEAT, beat % 2 === 0 ? 0.005 : 0.008, false, beat % 2 ? -0.25 : 0.25);
      addTick(start + beat * BEAT, beat === 0 ? (LEAN ? 0.13 : 0.014) : (LEAN ? 0.08 : 0.009));
    }
    if (bar % 2 === 0) addShimmer(start, chordNotes[3] + 12, 0.012);
  }
}

// 段落转场。
addImpact(4 * BAR, 0.42);
addImpact(16 * BAR, 0.5);
addImpact(23 * BAR, 0.38);
addRiser(14 * BAR + BEAT * 2, 16 * BAR, 0.075);
addRiser(22 * BAR + BEAT * 2, 23 * BAR, 0.04);

// ---------------------------------------------------------------------------
// 空间：Schroeder 混响 + 乒乓延迟
// ---------------------------------------------------------------------------

function applyReverb(dryL, dryR, sendL, sendR) {
  const combs = [
    { delay: 0.0297, feedback: 0.79, damping: 0.28 },
    { delay: 0.0311, feedback: 0.77, damping: 0.3 },
    { delay: 0.0279, feedback: 0.81, damping: 0.26 },
    { delay: 0.0253, feedback: 0.78, damping: 0.32 },
  ];
  const allpasses = [
    { delay: 0.0052, feedback: 0.5 },
    { delay: 0.0017, feedback: 0.45 },
  ];
  const wetL = new Float32Array(FRAMES);
  const wetR = new Float32Array(FRAMES);
  const predelay = Math.round(0.018 * SAMPLE_RATE);
  for (const channel of [0, 1]) {
    const input = channel === 0 ? sendL : sendR;
    const output = channel === 0 ? wetL : wetR;
    const combOutput = new Float32Array(FRAMES);
    for (const comb of combs) {
      const delay = Math.max(1, Math.round(comb.delay * SAMPLE_RATE * (channel === 0 ? 1 : 1.031)));
      const buffer = new Float32Array(delay);
      let index = 0;
      let damp = 0;
      for (let frame = 0; frame < FRAMES; frame += 1) {
        const delayed = buffer[index];
        damp = delayed * (1 - comb.damping) + damp * comb.damping;
        buffer[index] = (input[frame] + damp * comb.feedback) * 0.25;
        combOutput[frame] += delayed;
        index += 1;
        if (index >= delay) index = 0;
      }
    }
    let signal = combOutput;
    for (const allpass of allpasses) {
      const delay = Math.max(1, Math.round(allpass.delay * SAMPLE_RATE));
      const buffer = new Float32Array(delay);
      let index = 0;
      const next = new Float32Array(FRAMES);
      for (let frame = 0; frame < FRAMES; frame += 1) {
        const delayed = buffer[index];
        const value = signal[frame] + delayed * allpass.feedback;
        buffer[index] = value;
        next[frame] = delayed - value * allpass.feedback;
        index += 1;
        if (index >= delay) index = 0;
      }
      signal = next;
    }
    for (let frame = 0; frame < FRAMES; frame += 1) {
      const source = signal[frame + predelay] ?? 0;
      output[frame] = source;
    }
  }
  // 湿声高切，避免混响太亮。
  let lpL = 0;
  let lpR = 0;
  for (let frame = 0; frame < FRAMES; frame += 1) {
    lpL += 0.18 * (wetL[frame] - lpL);
    lpR += 0.18 * (wetR[frame] - lpR);
    dryL[frame] += lpL * 0.55;
    dryR[frame] += lpR * 0.55;
  }
  return { wetL, wetR };
}

function applyDelay(dryL, dryR, input) {
  const delay = Math.round(BEAT * 0.75 * SAMPLE_RATE);
  const bufferL = new Float32Array(delay);
  const bufferR = new Float32Array(delay);
  let index = 0;
  let lpL = 0;
  let lpR = 0;
  for (let frame = 0; frame < FRAMES; frame += 1) {
    const readL = bufferL[index];
    const readR = bufferR[index];
    lpL += 0.22 * (readL - lpL);
    lpR += 0.22 * (readR - lpR);
    dryL[frame] += lpL * 0.34;
    dryR[frame] += lpR * 0.34;
    bufferL[index] = input[frame] * 0.5 + lpR * 0.34;
    bufferR[index] = input[frame] * 0.5 + lpL * 0.34;
    index += 1;
    if (index >= delay) index = 0;
  }
}

applyDelay(L, R, ECHO);
applyReverb(L, R, SEND_L, SEND_R);

// 母带：先切掉 30Hz 以下的隆隆声，再给 2.6kHz 以上一点空气感。
const hpAlpha = 1 - Math.exp((-TWO_PI * 30) / SAMPLE_RATE);
const shelfAlpha = 1 - Math.exp((-TWO_PI * 2600) / SAMPLE_RATE);
let hpL = 0;
let hpR = 0;
let shelfL = 0;
let shelfR = 0;
for (let index = 0; index < FRAMES; index += 1) {
  hpL += hpAlpha * (L[index] - hpL);
  hpR += hpAlpha * (R[index] - hpR);
  L[index] -= hpL;
  R[index] -= hpR;
  shelfL += shelfAlpha * (L[index] - shelfL);
  shelfR += shelfAlpha * (R[index] - shelfR);
  L[index] += (L[index] - shelfL) * 0.32;
  R[index] += (R[index] - shelfR) * 0.32;
}

// ---------------------------------------------------------------------------
// 母带：柔和饱和、峰值归一、淡入淡出
// ---------------------------------------------------------------------------

let peak = 0;
for (let index = 0; index < FRAMES; index += 1) {
  const fadeIn = Math.min(1, index / ((LEAN ? 0.05 : 0.8) * SAMPLE_RATE));
  const fadeOut = Math.min(1, (FRAMES - index) / (3.2 * SAMPLE_RATE));
  const fade = fadeIn * fadeOut;
  let left = L[index] * MASTER_GAIN * fade;
  let right = R[index] * MASTER_GAIN * fade;
  left = Math.tanh(left * 1.12) / Math.tanh(1.12);
  right = Math.tanh(right * 1.12) / Math.tanh(1.12);
  L[index] = left;
  R[index] = right;
  const absolute = Math.max(Math.abs(left), Math.abs(right));
  if (absolute > peak) peak = absolute;
}
const normalize = peak > 0 ? 0.891 / peak : 1;
for (let index = 0; index < FRAMES; index += 1) {
  L[index] *= normalize;
  R[index] *= normalize;
}

function sectionRms(startBar, endBar) {
  const start = Math.round(startBar * BAR * SAMPLE_RATE);
  const end = Math.min(FRAMES, Math.round(endBar * BAR * SAMPLE_RATE));
  let sum = 0;
  let count = 0;
  for (let index = start; index < end; index += 1) {
    sum += L[index] * L[index] + R[index] * R[index];
    count += 2;
  }
  return Math.sqrt(sum / Math.max(1, count));
}

function toDb(value) {
  return value > 0 ? 20 * Math.log10(value) : -Infinity;
}

const wav = Buffer.alloc(44 + FRAMES * 4);
wav.write('RIFF', 0);
wav.writeUInt32LE(36 + FRAMES * 4, 4);
wav.write('WAVE', 8);
wav.write('fmt ', 12);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(2, 22);
wav.writeUInt32LE(SAMPLE_RATE, 24);
wav.writeUInt32LE(SAMPLE_RATE * 4, 28);
wav.writeUInt16LE(4, 32);
wav.writeUInt16LE(16, 34);
wav.write('data', 36);
wav.writeUInt32LE(FRAMES * 4, 40);
for (let index = 0; index < FRAMES; index += 1) {
  const left = Math.max(-1, Math.min(1, L[index]));
  const right = Math.max(-1, Math.min(1, R[index]));
  wav.writeInt16LE(Math.round(left * 32767), 44 + index * 4);
  wav.writeInt16LE(Math.round(right * 32767), 44 + index * 4 + 2);
}

const wavPath = path.join(OUT, 'theme.wav');
fs.writeFileSync(wavPath, wav);
const sha256 = crypto.createHash('sha256').update(wav).digest('hex');

const beats = [];
const downbeats = [];
for (let beat = 0; beat * BEAT < DURATION; beat += 1) {
  const timeMs = Math.round(beat * BEAT * 1000);
  beats.push(timeMs);
  if (beat % 4 === 0) downbeats.push(timeMs);
}

const spec = {
  schemaVersion: 1,
  generatedBy: 'v4/app/tools/assets/generate-music.mjs',
  generatedAt: new Date().toISOString(),
  title: '雨若 / Rain, Unfinished',
  bpm: BPM,
  meter: 4,
  offsetMs: 0,
  durationSeconds: DURATION,
  durationMs: Math.round(DURATION * 1000),
  sampleRate: SAMPLE_RATE,
  channels: 2,
  bitDepth: 16,
  codec: 'PCM s16le',
  bars: BARS,
  sections: [
    { name: 'intro', startBar: 0, endBar: 4, startMs: 0, endMs: Math.round(4 * BAR * 1000) },
    { name: 'verse', startBar: 4, endBar: 16, startMs: Math.round(4 * BAR * 1000), endMs: Math.round(16 * BAR * 1000) },
    { name: 'chorus', startBar: 16, endBar: 23, startMs: Math.round(16 * BAR * 1000), endMs: Math.round(23 * BAR * 1000) },
    { name: 'outro', startBar: 23, endBar: 27, startMs: Math.round(23 * BAR * 1000), endMs: Math.round(27 * BAR * 1000) },
  ],
  rmsDb: {
    intro: Number(toDb(sectionRms(0, 4)).toFixed(2)),
    verse: Number(toDb(sectionRms(4, 16)).toFixed(2)),
    chorus: Number(toDb(sectionRms(16, 23)).toFixed(2)),
    outro: Number(toDb(sectionRms(23, 27)).toFixed(2)),
  },
  peakDbfs: Number(toDb(peak * normalize).toFixed(2)),
  bytes: wav.length,
  sha256,
  beatsMs: beats,
  downbeatsMs: downbeats,
  notes: [
    'No samples. All voices are synthesized from wavetable sine partials, filtered noise and envelopes.',
    'Reverb is a stereo Schroeder network; delay is a ping-pong dotted-eighth.',
    'Kick sidechain ducks pad/bass to leave room for the low end.',
  ],
};

fs.writeFileSync(path.join(OUT, 'music-spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
fs.writeFileSync(path.join(OUT, 'beats-grid.json'), `${JSON.stringify({
  schemaVersion: 1,
  bpm: BPM,
  meter: 4,
  offsetMs: 0,
  beatsMs: beats,
  downbeatsMs: downbeats,
}, null, 2)}\n`);

console.log(`[music] ${wavPath}`);
console.log(`[music] ${DURATION}s / ${BPM} BPM / ${SAMPLE_RATE}Hz / ${wav.length} bytes`);
console.log(`[music] peak ${spec.peakDbfs} dBFS · RMS intro ${spec.rmsDb.intro} / verse ${spec.rmsDb.verse} / chorus ${spec.rmsDb.chorus} / outro ${spec.rmsDb.outro} dB`);
console.log(`[music] sha256 ${sha256}`);
