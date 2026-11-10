/**
 * R5b.1 · 雨若示例资产统一风格库。
 *
 * 所有生成器共用同一套色板、色调曲线、暗角与颗粒参数；
 * 视频、静帧、字幕预览因此保持同一「雨夜 / 暗蓝青 / 低饱和」气质。
 * 本文件不写盘，也不依赖任何第三方包。
 */

export const PALETTE = Object.freeze({
  abyss: '#060a0f',
  ink: '#1a2332',
  deep: '#0a131b',
  slate: '#16222d',
  steel: '#243747',
  teal: '#4f8fa8',
  cyan: '#78d7e6',
  ice: '#b9dbe1',
  moss: '#6f8f7a',
  amber: '#c08a5e',
  ember: '#e0a06a',
  bone: '#d8d2c4',
  fog: '#8aa3ad',
});

/** 统一调色参数；写入 media/theme/style.json，供后续 R5b.2 复用。 */
export const STYLE = Object.freeze({
  name: 'rain-night / restrained cyan',
  palette: PALETTE,
  grade: {
    exposure: 1.04,
    contrast: 1.06,
    saturation: 0.86,
    gamma: 1.02,
    shadowLift: [0.012, 0.02, 0.03],
    highlightTint: [0.028, 0.012, -0.004],
    toe: 0.018,
  },
  vignette: {
    strength: 0.34,
    inner: 0.38,
    outer: 1.08,
  },
  grain: {
    strength: 1.7,
    size: 512,
  },
  rain: {
    color: [0.52, 0.69, 0.78],
    wind: -0.19,
    layers: [
      { count: 1150, speed: 760, length: 16, alpha: 0.075, width: 1.0, depth: 0.2 },
      { count: 780, speed: 1120, length: 26, alpha: 0.14, width: 1.2, depth: 0.55 },
      { count: 320, speed: 1660, length: 44, alpha: 0.26, width: 1.7, depth: 0.92 },
    ],
  },
  bloom: {
    threshold: 0.58,
    radius: 14,
    intensity: 0.72,
  },
});

export const clamp = (value, min = 0, max = 1) => (value < min ? min : value > max ? max : value);

export const lerp = (a, b, t) => a + (b - a) * t;

export const smoothstep = (edge0, edge1, value) => {
  const t = clamp((value - edge0) / (edge1 - edge0 || 1e-9));
  return t * t * (3 - 2 * t);
};

/** mulberry32：小而稳的确定性随机源。 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 32-bit 整数哈希，返回 0..1。 */
export function hash2(x, y, seed = 0) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function valueNoise2(x, y, seed = 0) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  const top = a + (b - a) * ux;
  const bottom = c + (d - c) * ux;
  return top + (bottom - top) * uy;
}

export function fbm2(x, y, octaves = 4, seed = 0, lacunarity = 2.03, gain = 0.5) {
  let amplitude = 0.5;
  let frequency = 1;
  let sum = 0;
  let norm = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    sum += amplitude * valueNoise2(x * frequency, y * frequency, seed + octave * 131);
    norm += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }
  return sum / norm;
}

export function hexToRgb(hex) {
  const value = hex.replace('#', '');
  return [
    parseInt(value.slice(0, 2), 16) / 255,
    parseInt(value.slice(2, 4), 16) / 255,
    parseInt(value.slice(4, 6), 16) / 255,
  ];
}

export function mixRgb(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

export function scaleRgb(color, scale) {
  return [color[0] * scale, color[1] * scale, color[2] * scale];
}

/**
 * 胶片化色调映射 + 阴影冷偏 + 高光暖偏。
 * 返回三张 256 项 LUT；逐像素只做查表，不重复算曲线。
 */
export function buildGradeLut(style = STYLE) {
  const { exposure, contrast, saturation, gamma, shadowLift, highlightTint, toe } = style.grade;
  const lut = [new Uint8ClampedArray(256), new Uint8ClampedArray(256), new Uint8ClampedArray(256)];
  const tint = [highlightTint[0], highlightTint[1], highlightTint[2]];
  const lift = [shadowLift[0], shadowLift[1], shadowLift[2]];
  for (let i = 0; i < 256; i += 1) {
    let value = i / 255;
    value = Math.max(0, value * exposure);
    // 肩部：高光缓慢压缩，避免霓虹过曝。
    value = value <= 0.74
      ? value
      : 0.74 + (1 - Math.exp(-(value - 0.74) * 4.2)) * 0.26;
    value = Math.pow(clamp(value), 1 / gamma);
    value = (value - 0.5) * contrast + 0.5;
    value = clamp(value + toe);
    const luma = Math.max(0, value);
    for (let channel = 0; channel < 3; channel += 1) {
      let result = value;
      // 低饱和：向亮度靠拢。
      result = lerp(result, luma, 1 - saturation);
      // 暗部冷偏、亮部微暖偏。
      result += lift[channel] * (1 - value) ** 2;
      result += tint[channel] * value ** 3;
      lut[channel][i] = Math.round(clamp(result) * 255);
    }
  }
  return lut;
}

/** 径向暗角，预计算为乘法系数。 */
export function buildVignette(width, height, style = STYLE) {
  const data = new Float32Array(width * height);
  const { strength, inner, outer } = style.vignette;
  const cx = width / 2;
  const cy = height / 2;
  const maxDistance = Math.hypot(cx, cy);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const distance = Math.hypot(x - cx, y - cy) / maxDistance;
      const falloff = smoothstep(inner, outer, distance);
      data[y * width + x] = 1 - falloff * strength;
    }
  }
  return data;
}

/** 单通道颗粒表；按帧偏移采样，避免静态噪点。 */
export function buildGrain(size = 512, seed = 20261025) {
  const random = mulberry32(seed);
  const data = new Float32Array(size * size);
  for (let i = 0; i < data.length; i += 1) {
    // 三角分布，中心更密；比均匀噪声更像胶片。
    const value = random() + random() - 1;
    data[i] = value;
  }
  return { size, data };
}

export function gradeFrame(rgba, width, height, options = {}) {
  const lut = options.lut ?? buildGradeLut();
  const vignette = options.vignette ?? buildVignette(width, height);
  const grain = options.grain ?? buildGrain();
  const frame = options.frame ?? 0;
  const grainStrength = options.grainStrength ?? STYLE.grain.strength;
  const grainOffset = (frame * 37) % grain.size;
  const grainOffsetY = (frame * 61) % grain.size;
  const length = width * height;
  for (let index = 0; index < length; index += 1) {
    const base = index * 4;
    const gx = ((index % width) + grainOffset) % grain.size;
    const gy = (((index / width) | 0) + grainOffsetY) % grain.size;
    const noise = grain.data[gy * grain.size + gx] * grainStrength;
    const factor = vignette[index];
    const r = lut[0][Math.round(clamp((rgba[base] + noise) / 255) * 255)] * factor;
    const g = lut[1][Math.round(clamp((rgba[base + 1] + noise) / 255) * 255)] * factor;
    const b = lut[2][Math.round(clamp((rgba[base + 2] + noise) / 255) * 255)] * factor;
    rgba[base] = r;
    rgba[base + 1] = g;
    rgba[base + 2] = b;
  }
}

/** style.json 的稳定序列化内容。 */
export function styleJson(extra = {}) {
  return {
    schemaVersion: 1,
    generatedBy: 'v4/app/tools/assets',
    ...STYLE,
    ...extra,
  };
}
