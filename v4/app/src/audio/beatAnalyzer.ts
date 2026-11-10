/**
 * R5a.1 · 离线节拍分析器（纯函数）。
 *
 * 输入 mono PCM，不依赖 DOM / WebAudio / Tauri / React。
 * 算法：短时能量 onset envelope → 峰值/间期聚类 → BPM + 低频 downbeat phase。
 * 该实现是确定性的；真实音乐的低置信结果应由编辑器手动标记兜底。
 */

export interface BeatAnalysisResult {
  readonly ok: boolean;
  readonly bpm?: number;
  readonly meter?: 4;
  readonly offsetMs?: number;
  readonly beatsMs?: readonly number[];
  readonly downbeatsMs?: readonly number[];
  readonly confidence?: number;
  readonly reason?: 'Silent' | 'NoBeat' | 'LowConfidence';
}

export interface BeatAnalysisOptions {
  readonly minBpm?: number;
  readonly maxBpm?: number;
  readonly minConfidence?: number;
}

const FRAME_SIZE = 1024;
const HOP_SIZE = 512;
const DEFAULT_MIN_BPM = 60;
const DEFAULT_MAX_BPM = 200;
const DEFAULT_MIN_CONFIDENCE = 0.35;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  let total = 0;
  for (const value of values) total += value;
  return total / values.length;
}

function std(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const average = mean(values);
  let total = 0;
  for (const value of values) total += (value - average) ** 2;
  return Math.sqrt(total / values.length);
}

function smooth(values: readonly number[]): number[] {
  const result = new Array<number>(values.length).fill(0);
  for (let index = 0; index < values.length; index += 1) {
    const left = values[Math.max(0, index - 1)];
    const right = values[Math.min(values.length - 1, index + 1)];
    result[index] = (left + values[index] * 2 + right) / 4;
  }
  return result;
}

function frameFeatures(
  samples: Float32Array,
  sampleRate: number,
): { readonly energy: readonly number[]; readonly lowEnergy: readonly number[]; readonly hopMs: number } {
  const frameCount = Math.max(0, Math.floor((samples.length - FRAME_SIZE) / HOP_SIZE) + 1);
  const energy = new Array<number>(frameCount).fill(0);
  const lowEnergy = new Array<number>(frameCount).fill(0);
  const alpha = 1 - Math.exp((-2 * Math.PI * 120) / sampleRate);
  let low = 0;
  for (let frame = 0; frame < frameCount; frame += 1) {
    const start = frame * HOP_SIZE;
    let sum = 0;
    let lowSum = 0;
    for (let offset = 0; offset < FRAME_SIZE; offset += 1) {
      const sample = samples[start + offset] ?? 0;
      low += alpha * (sample - low);
      sum += sample * sample;
      lowSum += low * low;
    }
    energy[frame] = Math.sqrt(sum / FRAME_SIZE);
    lowEnergy[frame] = Math.sqrt(lowSum / FRAME_SIZE);
  }
  return { energy, lowEnergy, hopMs: (HOP_SIZE / sampleRate) * 1000 };
}

function onsetEnvelope(features: readonly number[]): number[] {
  const result = new Array<number>(features.length).fill(0);
  for (let index = 0; index < features.length; index += 1) {
    result[index] = index === 0
      ? Math.max(0, features[index])
      : Math.max(0, features[index] - features[index - 1]);
  }
  return smooth(result);
}

function findPeaks(envelope: readonly number[], threshold: number): number[] {
  const peaks: number[] = [];
  for (let index = 0; index < envelope.length; index += 1) {
    if (envelope[index] < threshold) continue;
    if (index > 0 && envelope[index] < envelope[index - 1]) continue;
    if (index + 1 < envelope.length && envelope[index] < envelope[index + 1]) continue;
    const previous = peaks[peaks.length - 1];
    if (previous !== undefined && index - previous < 2) {
      if (envelope[index] > envelope[previous]) peaks[peaks.length - 1] = index;
      continue;
    }
    peaks.push(index);
  }
  return peaks;
}

/** onset envelope 的归一化 autocorrelation；作为间期聚类的验证/细化。 */
function autocorrelationPeriod(
  envelope: readonly number[],
  hopMs: number,
  minBpm: number,
  maxBpm: number,
): { readonly periodMs: number; readonly score: number } {
  const minLag = Math.max(1, Math.round((60000 / maxBpm) / hopMs));
  const maxLag = Math.min(
    envelope.length - 2,
    Math.max(minLag, Math.round((60000 / minBpm) / hopMs)),
  );
  let bestLag = minLag;
  let bestScore = 0;
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let numerator = 0;
    let left = 0;
    let right = 0;
    for (let index = lag; index < envelope.length; index += 1) {
      numerator += envelope[index] * envelope[index - lag];
      left += envelope[index] * envelope[index];
      right += envelope[index - lag] * envelope[index - lag];
    }
    const denominator = Math.sqrt(left * right);
    const score = denominator > 0 ? numerator / denominator : 0;
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }
  return { periodMs: bestLag * hopMs, score: bestScore };
}

function lowEnergyAt(
  lowEnvelope: readonly number[],
  frame: number,
): number {
  let total = 0;
  for (let offset = -2; offset <= 2; offset += 1) {
    total += lowEnvelope[Math.max(0, Math.min(lowEnvelope.length - 1, frame + offset))];
  }
  return total;
}

/** 分析 mono PCM；ok=false 时没有可用节拍。 */
export function analyzeBeats(
  samples: Float32Array,
  sampleRate: number,
  options: BeatAnalysisOptions = {},
): BeatAnalysisResult {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    return { ok: false, reason: 'NoBeat' };
  }
  if (samples.length < FRAME_SIZE * 4) {
    return { ok: false, reason: 'NoBeat' };
  }

  let absolutePeak = 0;
  let squareSum = 0;
  for (const sample of samples) {
    const absolute = Math.abs(sample);
    if (absolute > absolutePeak) absolutePeak = absolute;
    squareSum += sample * sample;
  }
  if (absolutePeak < 1e-4 || Math.sqrt(squareSum / samples.length) < 1e-5) {
    return { ok: false, reason: 'Silent' };
  }

  const { energy, lowEnergy, hopMs } = frameFeatures(samples, sampleRate);
  const onset = onsetEnvelope(energy);
  const lowOnset = onsetEnvelope(lowEnergy);
  const onsetMean = mean(onset);
  const onsetStd = std(onset);
  if (onsetMean < 1e-6 || onsetStd < 1e-6) {
    return { ok: false, reason: 'NoBeat' };
  }

  const peaks = findPeaks(onset, onsetMean + onsetStd * 0.5);
  if (peaks.length < 4) {
    return { ok: false, reason: 'NoBeat' };
  }

  const intervals: number[] = [];
  for (let index = 1; index < peaks.length; index += 1) {
    const interval = (peaks[index] - peaks[index - 1]) * hopMs;
    if (interval >= 250 && interval <= 1200) intervals.push(interval);
  }
  if (intervals.length < 3) {
    return { ok: false, reason: 'NoBeat' };
  }

  const roughPeriod = median(intervals);
  const inliers = intervals.filter((interval) => (
    Math.abs(interval - roughPeriod) <= roughPeriod * 0.2
  ));
  const inlierRatio = inliers.length / intervals.length;
  if (inliers.length < 3 || inlierRatio < 0.5) {
    return { ok: false, reason: 'LowConfidence' };
  }

  let periodMs = mean(inliers);
  let bpm = 60000 / periodMs;
  const minBpm = options.minBpm ?? DEFAULT_MIN_BPM;
  const maxBpm = options.maxBpm ?? DEFAULT_MAX_BPM;
  const autocorrelation = autocorrelationPeriod(onset, hopMs, minBpm, maxBpm);
  // autocorrelation 只在接近间期聚类结果时用于细化，避免 octave error。
  if (autocorrelation.score > 0.15
    && Math.abs(autocorrelation.periodMs - periodMs) <= periodMs * 0.2) {
    periodMs = (periodMs + autocorrelation.periodMs) / 2;
    bpm = 60000 / periodMs;
  }
  while (bpm > maxBpm) {
    periodMs *= 2;
    bpm /= 2;
  }
  while (bpm < minBpm) {
    periodMs /= 2;
    bpm *= 2;
  }
  if (bpm < minBpm || bpm > maxBpm || !Number.isFinite(periodMs)) {
    return { ok: false, reason: 'NoBeat' };
  }

  const offsetMs = peaks[0] * hopMs;
  const durationMs = (samples.length / sampleRate) * 1000;
  const beatsMs: number[] = [];
  for (let time = offsetMs; time <= durationMs + 0.001; time += periodMs) {
    beatsMs.push(Math.round(time * 1000) / 1000);
  }
  if (beatsMs.length < 2) {
    return { ok: false, reason: 'NoBeat' };
  }

  // 用低频 onset 选 4/4 phase；低频信息不足时默认 phase 0。
  const phaseScores = [0, 1, 2, 3].map((phase) => {
    let total = 0;
    let count = 0;
    for (let beat = phase; beat < beatsMs.length; beat += 4) {
      const frame = Math.round(beatsMs[beat] / hopMs);
      total += lowEnergyAt(lowOnset, frame);
      count += 1;
    }
    return count === 0 ? 0 : total / count;
  });
  const bestPhase = phaseScores.indexOf(Math.max(...phaseScores));
  const lowMean = mean(phaseScores);
  const phase = lowMean > 0 && Math.max(...phaseScores) > lowMean * 1.02 ? bestPhase : 0;
  const downbeatsMs = beatsMs.filter((_, index) => index % 4 === phase);

  const peakFactor = clamp(peaks.length / 12, 0, 1);
  const confidence = clamp(
    inlierRatio * 0.65 + peakFactor * 0.2 + clamp(autocorrelation.score, 0, 1) * 0.15,
    0,
    1,
  );
  const minConfidence = options.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
  if (confidence < minConfidence) {
    return { ok: false, reason: 'LowConfidence' };
  }

  return {
    ok: true,
    bpm: Math.round(bpm * 100) / 100,
    meter: 4,
    offsetMs: Math.round(offsetMs * 1000) / 1000,
    beatsMs,
    downbeatsMs,
    confidence: Math.round(confidence * 1000) / 1000,
  };
}
