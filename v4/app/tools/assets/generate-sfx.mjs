#!/usr/bin/env node
/**
 * R5c-A.2 · Layer Audio 占位 SFX。
 *
 * 纯 JS 合成 220/440/880Hz 短点击音，写出 48kHz / 16-bit mono WAV，
 * 并登记到 demo media manifest。后续可用真实 SFX 替换，只改 assetId 映射。
 *
 * 用法：node generate-sfx.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../../..');
const PROJECT = path.join(REPO_ROOT, 'v4', '.stereo-demo', 'project');
const AUDIO_DIR = path.join(PROJECT, 'media', 'audio');
const MANIFEST = path.join(PROJECT, 'media', 'manifest.json');
const SAMPLE_RATE = 48_000;
const DURATION_MS = 150;
const LAYERS = [
  { layer: 1, frequency: 220, label: 'low' },
  { layer: 2, frequency: 440, label: 'mid' },
  { layer: 3, frequency: 880, label: 'high' },
];

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function wavBuffer(samples) {
  const dataBytes = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataBytes, 40);
  for (let index = 0; index < samples.length; index += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[index]));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + index * 2);
  }
  return buffer;
}

function makeTone(frequency) {
  const frames = Math.round((SAMPLE_RATE * DURATION_MS) / 1000);
  const samples = new Float32Array(frames);
  for (let index = 0; index < frames; index += 1) {
    const seconds = index / SAMPLE_RATE;
    const attack = Math.min(1, seconds / 0.004);
    const decay = Math.exp(-seconds / 0.042);
    const fundamental = Math.sin(2 * Math.PI * frequency * seconds);
    const harmonic = Math.sin(2 * Math.PI * frequency * 2 * seconds) * 0.18;
    const transient = Math.sin(2 * Math.PI * frequency * 3.1 * seconds) * 0.08;
    samples[index] = (fundamental + harmonic + transient) * attack * decay * 0.46;
  }
  // 末尾 8ms 淡出，避免硬切爆音。
  const fadeFrames = Math.round(SAMPLE_RATE * 0.008);
  for (let index = 0; index < fadeFrames; index += 1) {
    samples[frames - fadeFrames + index] *= 1 - index / fadeFrames;
  }
  return samples;
}

fs.mkdirSync(AUDIO_DIR, { recursive: true });
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const specAssets = [];
const now = Date.now();

for (const item of LAYERS) {
  const file = `sfx-hit-layer${item.layer}.wav`;
  const absolute = path.join(AUDIO_DIR, file);
  const buffer = wavBuffer(makeTone(item.frequency));
  fs.writeFileSync(absolute, buffer);
  const assetId = `asset:audio:sfx-layer${item.layer}`;
  const relPath = `media/audio/${file}`;
  const asset = {
    assetId,
    audioChannel: 'Mono',
    audioChannels: 1,
    audioCodec: 'pcm_s16le',
    bytes: buffer.length,
    createdAt: now,
    derivedFrom: null,
    displayName: file,
    durationMs: DURATION_MS,
    eye: null,
    fps: 0,
    height: 0,
    kind: 'Audio',
    relPath,
    sampleRate: SAMPLE_RATE,
    sha256: sha256(buffer),
    sourceSha256: null,
    stereoPairId: null,
    trim: null,
    videoCodec: null,
    width: 0,
  };
  const existing = manifest.assets.findIndex((entry) => entry.assetId === assetId);
  if (existing >= 0) manifest.assets[existing] = asset;
  else manifest.assets.push(asset);
  specAssets.push({
    assetId,
    layer: item.layer,
    frequencyHz: item.frequency,
    label: item.label,
    file,
    durationMs: DURATION_MS,
    sampleRate: SAMPLE_RATE,
    channels: 1,
    sha256: asset.sha256,
  });
}

manifest.updatedAt = now;
fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
fs.writeFileSync(
  path.join(AUDIO_DIR, 'sfx-spec.json'),
  `${JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), assets: specAssets }, null, 2)}\n`,
);

console.log(`[sfx] ${specAssets.length} assets -> ${AUDIO_DIR}`);
for (const asset of specAssets) {
  console.log(`[sfx] L${asset.layer} ${asset.frequencyHz}Hz ${asset.assetId} ${asset.sha256.slice(0, 12)}…`);
}
