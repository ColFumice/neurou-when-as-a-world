/**
 * 轻量浮点 RGB 画布。
 *
 * 视频与静帧共用：先在线性浮点空间里合成（允许 >1 的高光），
 * 最后一帧再走 tone mapping / LUT，避免 8-bit 中间态把霓虹压死。
 * 没有 DOM、Canvas 或原生图像库依赖。
 */

import { clamp, lerp } from './style.mjs';

export class Surface {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = new Float32Array(width * height * 3);
  }

  clear(color = [0, 0, 0]) {
    const { data } = this;
    for (let i = 0; i < data.length; i += 3) {
      data[i] = color[0];
      data[i + 1] = color[1];
      data[i + 2] = color[2];
    }
  }

  clone() {
    const copy = new Surface(this.width, this.height);
    copy.data.set(this.data);
    return copy;
  }

  get(x, y, out = [0, 0, 0]) {
    const ix = clamp(Math.round(x), 0, this.width - 1);
    const iy = clamp(Math.round(y), 0, this.height - 1);
    const index = (iy * this.width + ix) * 3;
    out[0] = this.data[index];
    out[1] = this.data[index + 1];
    out[2] = this.data[index + 2];
    return out;
  }

  set(x, y, color) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const index = ((y | 0) * this.width + (x | 0)) * 3;
    this.data[index] = color[0];
    this.data[index + 1] = color[1];
    this.data[index + 2] = color[2];
  }

  addPixel(x, y, color, alpha = 1) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const index = ((y | 0) * this.width + (x | 0)) * 3;
    this.data[index] += color[0] * alpha;
    this.data[index + 1] += color[1] * alpha;
    this.data[index + 2] += color[2] * alpha;
  }

  blendPixel(x, y, color, alpha = 1) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height || alpha <= 0) return;
    const index = ((y | 0) * this.width + (x | 0)) * 3;
    const a = alpha > 1 ? 1 : alpha;
    this.data[index] += (color[0] - this.data[index]) * a;
    this.data[index + 1] += (color[1] - this.data[index + 1]) * a;
    this.data[index + 2] += (color[2] - this.data[index + 2]) * a;
  }

  fill(color) {
    this.clear(color);
  }

  fillRect(x0, y0, x1, y1, color, alpha = 1) {
    const left = Math.max(0, Math.floor(Math.min(x0, x1)));
    const right = Math.min(this.width - 1, Math.ceil(Math.max(x0, x1)));
    const top = Math.max(0, Math.floor(Math.min(y0, y1)));
    const bottom = Math.min(this.height - 1, Math.ceil(Math.max(y0, y1)));
    for (let y = top; y <= bottom; y += 1) {
      for (let x = left; x <= right; x += 1) {
        this.blendPixel(x, y, color, alpha);
      }
    }
  }

  addRect(x0, y0, x1, y1, color, alpha = 1) {
    const left = Math.max(0, Math.floor(Math.min(x0, x1)));
    const right = Math.min(this.width - 1, Math.ceil(Math.max(x0, x1)));
    const top = Math.max(0, Math.floor(Math.min(y0, y1)));
    const bottom = Math.min(this.height - 1, Math.ceil(Math.max(y0, y1)));
    for (let y = top; y <= bottom; y += 1) {
      for (let x = left; x <= right; x += 1) {
        this.addPixel(x, y, color, alpha);
      }
    }
  }

  /** 带圆角的矩形；用于车体、招牌外框。 */
  fillRoundRect(x0, y0, x1, y1, radius, color, alpha = 1) {
    const left = Math.min(x0, x1);
    const right = Math.max(x0, x1);
    const top = Math.min(y0, y1);
    const bottom = Math.max(y0, y1);
    const r = Math.max(0, Math.min(radius, (right - left) / 2, (bottom - top) / 2));
    for (let y = Math.floor(top); y <= Math.ceil(bottom); y += 1) {
      for (let x = Math.floor(left); x <= Math.ceil(right); x += 1) {
        const nx = clamp(x, left + r, right - r);
        const ny = clamp(y, top + r, bottom - r);
        if (Math.hypot(x - nx, y - ny) <= r) this.blendPixel(x, y, color, alpha);
      }
    }
  }

  /** 1px 抗锯齿线段；width 用四向偏移线近似，避免每步分配数组。 */
  line(x0, y0, x1, y1, color, alpha = 1, width = 1, additive = true) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
    if (width <= 1) {
      for (let step = 0; step <= steps; step += 1) {
        const t = step / steps;
        if (additive) this.addPixel(x0 + dx * t, y0 + dy * t, color, alpha);
        else this.blendPixel(x0 + dx * t, y0 + dy * t, color, alpha);
      }
      return;
    }
    const half = (width - 1) / 2;
    const spread = alpha * 0.2;
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      const x = x0 + dx * t;
      const y = y0 + dy * t;
      if (additive) {
        this.addPixel(x, y, color, spread);
        this.addPixel(x - half, y, color, spread);
        this.addPixel(x + half, y, color, spread);
        this.addPixel(x, y - half, color, spread);
        this.addPixel(x, y + half, color, spread);
      } else {
        this.blendPixel(x, y, color, spread);
        this.blendPixel(x - half, y, color, spread);
        this.blendPixel(x + half, y, color, spread);
        this.blendPixel(x, y - half, color, spread);
        this.blendPixel(x, y + half, color, spread);
      }
    }
  }

  /** 径向光晕；intensity 可以 >1，交给后期 roll-off。 */
  glow(cx, cy, radius, color, intensity = 1, falloff = 2.1) {
    const left = Math.max(0, Math.floor(cx - radius));
    const right = Math.min(this.width - 1, Math.ceil(cx + radius));
    const top = Math.max(0, Math.floor(cy - radius));
    const bottom = Math.min(this.height - 1, Math.ceil(cy + radius));
    const inv = 1 / radius;
    for (let y = top; y <= bottom; y += 1) {
      const dy = (y - cy) * inv;
      for (let x = left; x <= right; x += 1) {
        const dx = (x - cx) * inv;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance >= 1) continue;
        const falloffValue = (1 - distance) ** falloff;
        const index = (y * this.width + x) * 3;
        this.data[index] += color[0] * intensity * falloffValue;
        this.data[index + 1] += color[1] * intensity * falloffValue;
        this.data[index + 2] += color[2] * intensity * falloffValue;
      }
    }
  }

  /** 椭圆涟漪：只画环，不填内部。 */
  ellipseRing(cx, cy, rx, ry, color, alpha = 1, thickness = 1.2) {
    const steps = Math.max(24, Math.ceil(Math.max(rx, ry) * 5));
    for (let step = 0; step < steps; step += 1) {
      const angle = (step / steps) * Math.PI * 2;
      const x = cx + Math.cos(angle) * rx;
      const y = cy + Math.sin(angle) * ry;
      this.addPixel(x, y, color, alpha);
      if (thickness > 1.2) this.addPixel(x, y + 1, color, alpha * 0.45);
    }
  }

  /** 竖向湿面拖影，用于霓虹/车灯倒影。 */
  wetStreak(cx, top, bottom, width, color, intensity = 1) {
    const left = Math.max(0, Math.floor(cx - width));
    const right = Math.min(this.width - 1, Math.ceil(cx + width));
    for (let y = Math.max(0, Math.floor(top)); y <= Math.min(this.height - 1, Math.ceil(bottom)); y += 1) {
      const vertical = 1 - (y - top) / Math.max(1, bottom - top);
      for (let x = left; x <= right; x += 1) {
        const horizontal = 1 - Math.abs(x - cx) / (width + 0.001);
        if (horizontal <= 0) continue;
        const alpha = vertical * horizontal * intensity;
        const index = (y * this.width + x) * 3;
        this.data[index] += color[0] * alpha;
        this.data[index + 1] += color[1] * alpha;
        this.data[index + 2] += color[2] * alpha;
      }
    }
  }

  /** 双线性采样；plate 边缘 clamp。 */
  sampleBilinear(x, y, out = [0, 0, 0]) {
    const px = clamp(x, 0, this.width - 1.001);
    const py = clamp(y, 0, this.height - 1.001);
    const x0 = px | 0;
    const y0 = py | 0;
    const x1 = Math.min(this.width - 1, x0 + 1);
    const y1 = Math.min(this.height - 1, y0 + 1);
    const tx = px - x0;
    const ty = py - y0;
    const i00 = (y0 * this.width + x0) * 3;
    const i10 = (y0 * this.width + x1) * 3;
    const i01 = (y1 * this.width + x0) * 3;
    const i11 = (y1 * this.width + x1) * 3;
    const data = this.data;
    for (let channel = 0; channel < 3; channel += 1) {
      const top = data[i00 + channel] + (data[i10 + channel] - data[i00 + channel]) * tx;
      const bottom = data[i01 + channel] + (data[i11 + channel] - data[i01 + channel]) * tx;
      out[channel] = top + (bottom - top) * ty;
    }
    return out;
  }
}

/** 分离式盒糊；用于 bloom 与倒影柔化。 */
export function boxBlur(src, width, height, radius, passes = 2) {
  if (radius < 1) return src;
  const horizontal = new Float32Array(src.length);
  const output = new Float32Array(src.length);
  const diameter = radius * 2 + 1;
  for (let pass = 0; pass < passes; pass += 1) {
    const input = pass === 0 ? src : output;
    // 横向。
    for (let y = 0; y < height; y += 1) {
      const row = y * width * 3;
      for (let channel = 0; channel < 3; channel += 1) {
        let sum = 0;
        for (let x = -radius; x <= radius; x += 1) {
          sum += input[row + clamp(x, 0, width - 1) * 3 + channel];
        }
        for (let x = 0; x < width; x += 1) {
          horizontal[row + x * 3 + channel] = sum / diameter;
          const remove = clamp(x - radius, 0, width - 1);
          const add = clamp(x + radius + 1, 0, width - 1);
          sum += input[row + add * 3 + channel] - input[row + remove * 3 + channel];
        }
      }
    }
    // 纵向。
    for (let x = 0; x < width; x += 1) {
      for (let channel = 0; channel < 3; channel += 1) {
        let sum = 0;
        for (let y = -radius; y <= radius; y += 1) {
          sum += horizontal[clamp(y, 0, height - 1) * width * 3 + x * 3 + channel];
        }
        for (let y = 0; y < height; y += 1) {
          output[y * width * 3 + x * 3 + channel] = sum / diameter;
          const remove = clamp(y - radius, 0, height - 1);
          const add = clamp(y + radius + 1, 0, height - 1);
          sum += horizontal[add * width * 3 + x * 3 + channel]
            - horizontal[remove * width * 3 + x * 3 + channel];
        }
      }
    }
  }
  return output;
}

/** 从 RGB 浮点面提取高光，生成 bloom 源。 */
export function brightPass(surface, threshold = 0.58, knee = 0.22) {
  const output = new Float32Array(surface.data.length);
  const data = surface.data;
  for (let index = 0; index < data.length; index += 3) {
    const luma = data[index] * 0.2126 + data[index + 1] * 0.7152 + data[index + 2] * 0.0722;
    const weight = clamp((luma - threshold) / Math.max(1e-5, knee)) ** 1.5;
    if (weight <= 0) continue;
    output[index] = data[index] * weight;
    output[index + 1] = data[index + 1] * weight;
    output[index + 2] = data[index + 2] * weight;
  }
  return output;
}

export function addSurface(target, source, alpha = 1) {
  const data = target.data;
  for (let index = 0; index < data.length; index += 1) {
    data[index] += source[index] * alpha;
  }
}

export function lerpColor(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}
