/**
 * 「雨夜城市」程序化场景。
 *
 * 组成：
 *   静态底板（天空 / 远景楼群 / 中景立面 / 湿街 / 近景框）
 *   + 逐帧叠加（雨、涟漪、霓虹闪烁、远处车灯、镜头呼吸、颗粒、暗角）。
 *
 * 底板只生成一次，逐帧按机位做一次双线性采样；两个机位共享底板，
 * 右眼在采样时增加 8px 水平偏移，接近真实双目基线。
 * 全部在浮点 RGB 空间合成，最后统一走调色 LUT。
 */

import { Surface, boxBlur, brightPass } from './surface.mjs';
import {
  STYLE,
  PALETTE,
  clamp,
  lerp,
  smoothstep,
  fbm2,
  valueNoise2,
  mulberry32,
  hexToRgb,
  buildGradeLut,
  buildVignette,
  buildGrain,
} from './style.mjs';

const C = Object.fromEntries(
  Object.entries(PALETTE).map(([key, value]) => [key, hexToRgb(value)]),
);

const HORIZON = 0.622;
const SIDEWALK_BOTTOM = 0.638;

function mix(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function scale(color, value) {
  return [color[0] * value, color[1] * value, color[2] * value];
}

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function fillTriangle(surface, ax, ay, bx, by, cx, cy, color, alpha, additive = false) {
  const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
  const maxX = Math.min(surface.width - 1, Math.ceil(Math.max(ax, bx, cx)));
  const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
  const maxY = Math.min(surface.height - 1, Math.ceil(Math.max(ay, by, cy)));
  const denominator = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
  if (Math.abs(denominator) < 1e-6) return;
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const w1 = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / denominator;
      const w2 = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / denominator;
      const w3 = 1 - w1 - w2;
      if (w1 < 0 || w2 < 0 || w3 < 0) continue;
      if (additive) surface.addPixel(x, y, color, alpha);
      else surface.blendPixel(x, y, color, alpha);
    }
  }
}

function drawWindow(surface, emissive, x, y, w, h, color, intensity) {
  surface.blendPixel(x, y, color, 0.55);
  if (w > 1.5 && h > 1.5) {
    surface.blendPixel(x + 1, y, color, 0.35);
    surface.blendPixel(x, y + 1, color, 0.25);
  }
  emissive.addPixel(x, y, color, intensity);
  if (w > 2 && h > 2) emissive.addPixel(x + 1, y, color, intensity * 0.45);
}

function skyPass(plate, width, height, seed) {
  const horizon = HORIZON * height;
  const top = C.abyss;
  const mid = mix(C.deep, C.ink, 0.6);
  const low = mix(C.slate, C.teal, 0.30);
  for (let y = 0; y < height; y += 1) {
    const v = y / height;
    const base = v < HORIZON
      ? mix(top, mid, smoothstep(0, 0.52, v))
      : mid;
    const glow = Math.exp(-Math.abs(y - horizon) / (height * 0.09));
    for (let x = 0; x < width; x += 1) {
      const nx = x / width;
      const clouds = fbm2(nx * 3.4 + seed * 0.001, v * 6.2 - 0.4, 5, seed, 2.07, 0.52);
      const streak = fbm2(nx * 9 + 11.3, v * 22, 3, seed + 71, 2.11, 0.5);
      const cloudAmount = smoothstep(0.38, 0.82, clouds) * (1 - smoothstep(0.46, 0.66, v));
      let color = mix(base, low, smoothstep(0.34, 0.62, v) * 0.48 + glow * 0.22);
      color = add(color, scale(C.teal, cloudAmount * 0.035 + streak * 0.006));
      // 地平线附近的城市光污染：极淡的冷青，避免变成纯黑。
      color = add(color, scale(C.cyan, glow * (0.014 + 0.01 * nx)));
      const index = (y * width + x) * 3;
      plate.data[index] = color[0];
      plate.data[index + 1] = color[1];
      plate.data[index + 2] = color[2];
    }
  }
}

function farSkylinePass(plate, emissive, width, height, seed) {
  const random = mulberry32(seed ^ 0x51ed);
  const horizon = HORIZON * height;
  const base = mix(C.deep, C.fog, 0.18);
  let x = -width * 0.02;
  while (x < width * 1.02) {
    const buildingWidth = width * (0.018 + random() * 0.055);
    const buildingHeight = height * (0.045 + random() * 0.155);
    const top = horizon - buildingHeight;
    const fog = 0.15 + random() * 0.12;
    const facade = mix(base, C.fog, fog);
    plate.fillRect(x, top, x + buildingWidth, horizon + 2, facade, 0.92);
    plate.fillRect(x, top, x + buildingWidth, top + 1.4, scale(C.fog, 0.55), 0.18);
    // 远景只保留稀疏窗光，主要交给中景。
    const cell = Math.max(2, Math.round(width * 0.0042));
    const columns = Math.max(1, Math.floor((buildingWidth - 2) / cell));
    const rows = Math.max(1, Math.floor((buildingHeight - 2) / (cell * 1.25)));
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        if (random() > 0.052) continue;
        const wx = x + 2 + column * cell;
        const wy = top + 2 + row * cell * 1.25;
        const warm = random() > 0.28;
        const color = warm ? [0.85, 0.62, 0.4] : [0.46, 0.66, 0.74];
        drawWindow(plate, emissive, wx, wy, Math.max(1, cell - 1.5), Math.max(1, cell - 2), color, 0.18 + random() * 0.25);
      }
    }
    if (random() > 0.68) {
      const antennaX = x + buildingWidth * 0.55;
      plate.line(antennaX, top, antennaX, top - height * 0.035, scale(facade, 0.5), 0.8, 1, false);
      emissive.addPixel(antennaX, top - height * 0.035, [0.9, 0.3, 0.24], 0.9);
    }
    // 楼底雾气，拉开远景层次。
    for (let y = Math.floor(horizon - height * 0.05); y < horizon; y += 1) {
      const fogAlpha = smoothstep(horizon - height * 0.05, horizon, y) * 0.22;
      plate.fillRect(x, y, x + buildingWidth, y + 1, scale(C.fog, 0.42), fogAlpha);
    }
    x += buildingWidth + width * (0.002 + random() * 0.012);
  }
}

function drawGlassTower(plate, emissive, x0, x1, top, bottom, seed) {
  const random = mulberry32(seed);
  const width = x1 - x0;
  const height = bottom - top;
  const base = mix(C.deep, C.ink, 0.42);
  plate.fillRect(x0, top, x1, bottom, base, 1);
  // 上暗下亮的立面渐变，贴着街面的一端被路灯抬起来一点。
  for (let y = Math.floor(top); y < bottom; y += 1) {
    const v = (y - top) / Math.max(1, height);
    const lift = smoothstep(0.55, 1, v) * 0.035;
    plate.fillRect(x0, y, x1, y + 1, scale(C.slate, lift * 2.2), 1);
  }
  // 玻璃幕墙的竖向反射：越靠近顶部越冷。
  for (let x = Math.floor(x0); x <= Math.ceil(x1); x += 1) {
    const nx = (x - x0) / Math.max(1, width);
    const reflection = fbm2(nx * 7 + seed * 0.01, 0.4, 3, seed + 9);
    const color = mix(C.slate, C.teal, 0.12 + reflection * 0.34);
    plate.fillRect(x, top, x + 1, bottom, color, 0.13);
  }
  const floorHeight = Math.max(3, Math.round(height * 0.036));
  for (let y = top + floorHeight; y < bottom; y += floorHeight) {
    plate.fillRect(x0, y, x1, y + 1, C.abyss, 0.22);
    // 楼层内的灯带：稀疏办公室。
    if (random() > 0.45) {
      const start = x0 + width * (0.08 + random() * 0.55);
      const run = width * (0.10 + random() * 0.28);
      plate.fillRect(start, y - 2, Math.min(x1 - 2, start + run), y + 1, [0.62, 0.7, 0.66], 0.16);
      emissive.fillRect(start, y - 2, Math.min(x1 - 2, start + run), y + 1, [0.55, 0.67, 0.62], 0.08);
    }
  }
  const mullion = Math.max(4, Math.round(width * 0.028));
  for (let x = x0 + mullion; x < x1; x += mullion) {
    plate.fillRect(x, top, x + 1, bottom, C.abyss, 0.24);
  }
  // 顶部退台与航空障碍灯。
  plate.fillRect(x0, top, x1, top + height * 0.018, C.abyss, 0.6);
  emissive.addPixel(x1 - width * 0.12, top + 2, [0.95, 0.24, 0.2], 0.8);
}

function drawPanelBuilding(plate, emissive, x0, x1, top, bottom, seed, options = {}) {
  const random = mulberry32(seed);
  const width = x1 - x0;
  const height = bottom - top;
  const warm = options.warm ?? 0.65;
  const base = mix(C.deep, options.tint ?? C.ink, 0.5 + (seed % 5) * 0.035);
  plate.fillRect(x0, top, x1, bottom, base, 1);
  // 立面竖向渐变与底层抬亮。
  for (let y = Math.floor(top); y < bottom; y += 1) {
    const v = (y - top) / Math.max(1, height);
    const lift = smoothstep(0.5, 1, v) * 0.05;
    plate.fillRect(x0, y, x1, y + 1, scale(C.slate, lift * 2.4), 1);
  }
  // 楼体上缘与雨渍。
  plate.fillRect(x0, top, x1, top + Math.max(2, height * 0.006), scale(base, 0.45), 0.9);
  // 竖向壁柱，把窗户分成开间。
  const pierCount = Math.max(2, Math.floor(width / 70));
  for (let pier = 1; pier < pierCount; pier += 1) {
    const px = x0 + (width * pier) / pierCount;
    plate.fillRect(px, top, px + 1.6, bottom, C.abyss, 0.22);
  }
  const cellWidth = Math.max(4, Math.round(width * 0.035));
  const cellHeight = Math.max(5, Math.round(height * 0.031));
  const gapX = Math.max(2, Math.round(cellWidth * 0.36));
  const gapY = Math.max(2, Math.round(cellHeight * 0.42));
  for (let y = top + gapY; y < bottom - gapY; y += cellHeight) {
    for (let x = x0 + gapX; x < x1 - gapX; x += cellWidth) {
      const windowWidth = Math.max(1, cellWidth - gapX);
      const windowHeight = Math.max(1, cellHeight - gapY);
      const lit = random() < 0.155;
      if (!lit) {
        plate.fillRect(x, y, x + windowWidth, y + windowHeight, C.abyss, 0.5);
        plate.fillRect(x, y, x + windowWidth, y + 1, [0.28, 0.38, 0.44], 0.07);
        continue;
      }
      const isWarm = random() < warm;
      const flicker = 0.45 + random() * 0.55;
      const color = isWarm
        ? [0.90, 0.62, 0.38]
        : [0.44, 0.68, 0.76];
      drawWindow(
        plate,
        emissive,
        x,
        y,
        windowWidth,
        windowHeight,
        color,
        (isWarm ? 0.42 : 0.32) * flicker,
      );
      // 窗内顶部的灯带 / 窗帘暗部，让 1-2px 的窗也有层次。
      if (windowHeight > 3) {
        plate.fillRect(x, y, x + windowWidth, y + 1, scale(color, 1.5), 0.5);
      }
    }
  }
  // 楼层横线、局部阳台与空调外机。
  const floorIndex = Math.max(1, Math.floor(height / cellHeight));
  for (let floor = 1; floor < floorIndex; floor += 1) {
    const y = top + floor * cellHeight;
    plate.fillRect(x0, y - 1, x1, y, C.abyss, 0.24);
    if (floor % 3 === 0 && random() > 0.35) {
      const balconyX = x0 + width * (0.08 + random() * 0.55);
      const balconyWidth = width * (0.16 + random() * 0.18);
      plate.fillRect(balconyX, y - 2, balconyX + balconyWidth, y, [0.22, 0.31, 0.35], 0.22);
      plate.fillRect(balconyX, y - 3, balconyX + balconyWidth, y - 2, [0.4, 0.5, 0.52], 0.10);
      plate.fillRect(balconyX + 1, y - 6, balconyX + 4, y - 2, C.abyss, 0.55);
    }
    if (floor % 4 === 1 && random() > 0.6) {
      const acX = x0 + width * (0.12 + random() * 0.7);
      plate.fillRect(acX, y - 4, acX + Math.max(3, width * 0.035), y - 1, C.abyss, 0.45);
    }
  }
  if (height > 60) {
    const unitWidth = width * 0.18;
    plate.fillRect(x0 + width * 0.12, top - height * 0.018, x0 + width * 0.12 + unitWidth, top, C.abyss, 0.65);
    plate.fillRect(x0 + width * 0.62, top - height * 0.012, x0 + width * 0.72, top, C.abyss, 0.6);
  }
}

function neonRainGlyph(plate, emissive, x, y, width, height, color, intensity = 1) {
  const panel = C.abyss;
  plate.fillRoundRect(x - 2, y - 2, x + width + 2, y + height + 2, 3, panel, 0.9);
  plate.fillRect(x, y, x + width, y + height, mix(C.deep, color, 0.06), 0.9);
  plate.fillRect(x + 1, y + 1, x + width - 1, y + height - 1, C.abyss, 0.25);
  plate.fillRect(x, y, x + width, y + 1.6, color, 0.28);
  plate.fillRect(x, y + height - 1.2, x + width, y + height, color, 0.18);
  plate.fillRect(x, y, x + 1.2, y + height, color, 0.2);
  plate.fillRect(x + width - 1.2, y, x + width, y + height, color, 0.2);
  const stroke = Math.max(1.8, width * 0.05);
  const glyphSize = Math.min(width * 0.86, height * 0.42);
  const gx = x + (width - glyphSize) / 2;
  const gy = y + height * 0.045;
  const drawStroke = (x0, y0, x1, y1, weight = 1) => {
    plate.line(x0, y0, x1, y1, color, 0.98 * weight, stroke, true);
    plate.line(x0, y0, x1, y1, [0.86, 0.98, 1.0], 0.34 * weight, 1.1, true);
    plate.line(x0, y0 + 1.6, x1, y1 + 1.6, color, 0.22 * weight, stroke * 1.8, true);
    emissive.line(x0, y0, x1, y1, color, 1.0 * intensity * weight, stroke, true);
  };
  // 「雨」：一横、一竖、左右两竖、四点。
  const top = gy + glyphSize * 0.08;
  const bottom = gy + glyphSize * 0.92;
  const left = gx + glyphSize * 0.06;
  const right = gx + glyphSize * 0.94;
  const mid = gx + glyphSize * 0.5;
  drawStroke(left, top, right, top, 1);
  drawStroke(mid, top, mid, bottom, 0.95);
  drawStroke(left, top + glyphSize * 0.04, left, gy + glyphSize * 0.5, 0.9);
  drawStroke(right, top + glyphSize * 0.04, right, gy + glyphSize * 0.5, 0.9);
  for (let row = 0; row < 2; row += 1) {
    for (let column = 0; column < 2; column += 1) {
      const dx = gx + glyphSize * (0.34 + column * 0.32);
      const dy = gy + glyphSize * (0.6 + row * 0.2);
      plate.glow(dx, dy, glyphSize * 0.085, color, 0.75 * intensity, 2.2);
      emissive.glow(dx, dy, glyphSize * 0.07, color, 0.7 * intensity, 2.2);
    }
  }
  // 字下三条细的落雨线，长度错开；不抢「雨」字的轮廓。
  for (let index = 0; index < 3; index += 1) {
    const dx = x + width * (0.3 + index * 0.2);
    const topY = y + height * (0.58 + index * 0.02);
    const bottomY = y + height * (0.68 + index * 0.055);
    plate.line(dx, topY, dx, bottomY, color, 0.24, Math.max(1, width * 0.025), true);
    emissive.line(dx, topY, dx, bottomY, color, 0.2, Math.max(1, width * 0.022), true);
    plate.addPixel(dx, bottomY + 1, color, 0.45);
  }
  // 沿中线落下的水滴，填补灯箱下半部的空。
  for (let index = 0; index < 8; index += 1) {
    const dx = x + width * 0.5;
    const dy = y + height * (0.55 + index * 0.042);
    plate.addPixel(dx, dy, color, 0.16 - index * 0.012);
    if (index % 3 === 0) plate.glow(dx, dy, width * 0.06, color, 0.03, 2.2);
  }
  // 灯箱底部的一条短横杠。
  plate.fillRect(x + width * 0.24, y + height * 0.91, x + width * 0.76, y + height * 0.922, color, 0.2);
  plate.glow(x + width / 2, y + height * 0.42, width * 2.8, color, 0.18 * intensity, 2.5);
  emissive.glow(x + width / 2, y + height * 0.42, width * 2.4, color, 0.16 * intensity, 2.5);
}

/** 横向灯箱：左边一个「雨」，右边三根暖色灯管；放在低层楼面上。 */
function neonRainBar(plate, emissive, x, y, width, height, color, intensity = 1) {
  plate.fillRoundRect(x - 2, y - 2, x + width + 2, y + height + 2, 2, C.abyss, 0.88);
  plate.fillRect(x, y, x + width, y + height, mix(C.deep, color, 0.08), 0.86);
  plate.fillRect(x, y, x + width, y + 1.2, color, 0.26);
  plate.fillRect(x, y + height - 1, x + width, y + height, color, 0.16);
  const glyph = Math.min(height * 0.72, width * 0.2);
  const gx = x + width * 0.08;
  const gy = y + (height - glyph) / 2;
  const stroke = Math.max(1.4, glyph * 0.09);
  const draw = (x0, y0, x1, y1, weight = 1) => {
    plate.line(x0, y0, x1, y1, color, 0.95 * weight, stroke, true);
    plate.line(x0, y0, x1, y1, [0.9, 0.98, 1.0], 0.28 * weight, 1, true);
    emissive.line(x0, y0, x1, y1, color, 0.9 * intensity * weight, stroke, true);
  };
  const top = gy + glyph * 0.08;
  const bottom = gy + glyph * 0.92;
  const left = gx + glyph * 0.04;
  const right = gx + glyph * 0.96;
  const mid = gx + glyph * 0.5;
  draw(left, top, right, top, 1);
  draw(mid, top, mid, bottom, 0.9);
  draw(left, top, left, gy + glyph * 0.5, 0.7);
  draw(right, top, right, gy + glyph * 0.5, 0.7);
  for (let row = 0; row < 2; row += 1) {
    for (let column = 0; column < 2; column += 1) {
      const dx = gx + glyph * (0.34 + column * 0.32);
      const dy = gy + glyph * (0.6 + row * 0.2);
      plate.glow(dx, dy, glyph * 0.07, color, 0.5 * intensity, 2.2);
      emissive.glow(dx, dy, glyph * 0.06, color, 0.45 * intensity, 2.2);
    }
  }
  // 右侧灯管。
  for (let index = 0; index < 3; index += 1) {
    const bx = x + width * (0.48 + index * 0.16);
    const by0 = y + height * 0.2;
    const by1 = y + height * (0.65 + (index % 2) * 0.15);
    plate.line(bx, by0, bx, by1, color, 0.62, Math.max(1.4, height * 0.055), true);
    emissive.line(bx, by0, bx, by1, color, 0.5 * intensity, Math.max(1.2, height * 0.05), true);
  }
  plate.glow(x + width / 2, y + height / 2, width * 0.6, color, 0.14 * intensity, 2.3);
  emissive.glow(x + width / 2, y + height / 2, width * 0.5, color, 0.12 * intensity, 2.3);
}

function drawNeonBar(plate, emissive, x, y, width, height, color, seed, intensity = 1) {
  const random = mulberry32(seed);
  plate.fillRoundRect(x - 2, y - 2, x + width + 2, y + height + 2, 2, C.abyss, 0.82);
  plate.fillRect(x, y, x + width, y + height, mix(C.deep, color, 0.1), 0.9);
  for (let index = 0; index < 5; index += 1) {
    if (random() < 0.28) continue;
    const barX = x + width * (0.08 + index * 0.18);
    const barHeight = height * (0.26 + random() * 0.5);
    const barY = y + height * 0.5 - barHeight * 0.5;
    plate.fillRect(barX, barY, barX + width * 0.07, barY + barHeight, color, 0.85);
    emissive.fillRect(barX, barY, barX + width * 0.07, barY + barHeight, color, 0.6 * intensity);
  }
  plate.glow(x + width / 2, y + height / 2, width * 0.68, color, 0.16 * intensity, 2.2);
  emissive.glow(x + width / 2, y + height / 2, width * 0.6, color, 0.14 * intensity, 2.2);
}

function streetLight(plate, emissive, x, width, height, warm = true) {
  const top = height * 0.335;
  const bottom = height * 0.705;
  plate.line(x, bottom, x, top, C.abyss, 0.9, Math.max(1.6, width * 0.0028), false);
  plate.line(x, top, x - width * 0.028, top + height * 0.006, C.abyss, 0.85, Math.max(1.2, width * 0.0022), false);
  const lampX = x - width * 0.027;
  const lampY = top + height * 0.006;
  const color = warm ? [1.0, 0.66, 0.38] : [0.52, 0.78, 0.84];
  plate.glow(lampX, lampY, width * 0.052, color, 0.62, 2.2);
  emissive.glow(lampX, lampY, width * 0.032, color, 0.8, 2.1);
  plate.fillRect(lampX - 2, lampY - 1, lampX + 2, lampY + 1, color, 1);
  plate.fillRoundRect(lampX - width * 0.009, lampY - height * 0.006, lampX + width * 0.009, lampY + height * 0.004, 2, C.abyss, 0.75);
  // 灯柱的湿冷边缘，让它在暗部里仍有轮廓。
  plate.line(x + 2, bottom, x + 2, top, [0.28, 0.42, 0.46], 0.22, 1, true);
  // 灯柱下端的湿地反光。
  plate.wetStreak(lampX, lampY + height * 0.01, height * 0.96, width * 0.013, color, 0.10);
}

function buildMidground(plate, emissive, width, height, seed) {
  const horizon = HORIZON * height;
  // 左：玻璃塔；中左：砖楼；中：板楼；右：主塔（雨字霓虹）。
  drawGlassTower(plate, emissive, -width * 0.01, width * 0.145, height * 0.245, horizon + 2, seed + 11);
  drawPanelBuilding(plate, emissive, width * 0.145, width * 0.272, height * 0.405, horizon + 2, seed + 23, { warm: 0.72 });
  drawPanelBuilding(plate, emissive, width * 0.272, width * 0.392, height * 0.325, horizon + 2, seed + 31, { warm: 0.4, tint: C.slate });
  drawPanelBuilding(plate, emissive, width * 0.392, width * 0.505, height * 0.465, horizon + 2, seed + 47, { warm: 0.78 });
  drawPanelBuilding(plate, emissive, width * 0.505, width * 0.618, height * 0.355, horizon + 2, seed + 59, { warm: 0.55 });
  drawGlassTower(plate, emissive, width * 0.618, width * 0.742, height * 0.205, horizon + 2, seed + 67);
  drawPanelBuilding(plate, emissive, width * 0.742, width * 0.856, height * 0.395, horizon + 2, seed + 79, { warm: 0.8, tint: C.slate });
  drawGlassTower(plate, emissive, width * 0.856, width * 1.01, height * 0.285, horizon + 2, seed + 97);
  // 屋顶水塔与天线，打破天际线节奏。
  const tankX = width * 0.452;
  const tankTop = height * 0.425;
  plate.fillRect(tankX, tankTop, tankX + width * 0.018, tankTop + height * 0.022, C.abyss, 0.72);
  plate.fillRect(tankX - 1, tankTop - 1, tankX + width * 0.019, tankTop + 1, C.abyss, 0.8);
  for (let index = 0; index < 3; index += 1) {
    plate.line(tankX + 2 + index * width * 0.006, tankTop + height * 0.022, tankX + 2 + index * width * 0.006, horizon, C.abyss, 0.4, 1, false);
  }
  plate.line(width * 0.69, height * 0.205, width * 0.69, height * 0.14, C.abyss, 0.75, 1, false);
  emissive.addPixel(width * 0.69, height * 0.14, [0.9, 0.22, 0.2], 0.75);
  // 霓虹：主招牌是「雨」的抽象笔画；左侧横向暖光；右侧小冷光。
  neonRainGlyph(
    plate,
    emissive,
    width * 0.612,
    height * 0.31,
    width * 0.046,
    height * 0.135,
    [0.42, 0.88, 0.94],
    1.0,
  );
  // 招牌旁边的一根竖向霓虹管，保留塔楼的垂直节奏。
  plate.wetStreak(width * 0.684, height * 0.36, height * 0.58, width * 0.006, [0.3, 0.7, 0.76], 0.28);
  drawNeonBar(plate, emissive, width * 0.292, height * 0.435, width * 0.095, height * 0.018, [0.95, 0.58, 0.3], seed + 101, 0.85);
  neonRainBar(
    plate,
    emissive,
    width * 0.405,
    height * 0.505,
    width * 0.095,
    height * 0.035,
    [0.95, 0.62, 0.34],
    0.85,
  );
  drawNeonBar(plate, emissive, width * 0.832, height * 0.365, width * 0.032, height * 0.012, [0.4, 0.8, 0.78], seed + 113, 0.55);
  // 沿街底层：暗色店面 + 少量暖光橱窗 + 雨棚，给街面尺度。
  const storeSeed = mulberry32(seed + 211);
  for (let index = 0; index < 9; index += 1) {
    if (index === 3 || index === 7) continue; // 留两处暗巷，打断连续店招。
    const storeX = width * (0.015 + index * 0.11);
    const storeWidth = width * 0.082;
    const storeTop = height * 0.592;
    const storeBottom = height * 0.625;
    plate.fillRect(storeX, storeTop, storeX + storeWidth, storeBottom, C.abyss, 0.78);
    // 雨棚：深色斜面，边缘一条湿冷高光。
    plate.fillRect(storeX - 2, storeTop - height * 0.007, storeX + storeWidth + 2, storeTop, C.abyss, 0.9);
    plate.fillRect(storeX - 2, storeTop, storeX + storeWidth + 2, storeTop + 1.2, [0.24, 0.36, 0.38], 0.18);
    // 门洞与橱窗。
    const lit = storeSeed() > 0.58;
    const doorX = storeX + storeWidth * (0.62 + storeSeed() * 0.12);
    plate.fillRect(doorX, storeTop + height * 0.012, doorX + width * 0.012, storeBottom, C.abyss, 0.86);
    const windowTop = storeTop + height * 0.014;
    const windowBottom = storeBottom - height * 0.01;
    if (lit) {
      const warm = storeSeed() > 0.35;
      const color = warm ? [0.88, 0.58, 0.34] : [0.4, 0.62, 0.68];
      plate.fillRect(storeX + 3, windowTop, doorX - 3, windowBottom, color, 0.045);
      plate.fillRect(storeX + 4, windowTop + 2, doorX - 4, windowTop + 3.4, color, 0.14);
      emissive.fillRect(storeX + 4, windowTop + 2, doorX - 4, windowTop + 3.4, color, 0.08);
      // 店内货架/人影的暗块。
      for (let shelf = 0; shelf < 3; shelf += 1) {
        const shelfY = windowTop + (windowBottom - windowTop) * (0.3 + shelf * 0.22);
        plate.fillRect(storeX + 4, shelfY, doorX - 4, shelfY + 1, C.abyss, 0.45);
      }
    } else {
      // 关闭的卷帘：横向细纹。
      for (let y = windowTop; y < windowBottom; y += 2) {
        plate.fillRect(storeX + 2, y, doorX - 2, y + 1, [0.16, 0.23, 0.25], 0.14);
      }
    }
    plate.fillRect(doorX - 1, windowTop, doorX + 1, windowBottom, C.abyss, 0.7);
  }
}

function buildStreet(plate, emissive, width, height, seed) {
  const horizon = HORIZON * height;
  const sidewalkBottom = SIDEWALK_BOTTOM * height;
  const wetMask = new Float32Array(width * height);
  const reflectionSample = [0, 0, 0];
  const puddles = [
    { x: 0.24, y: 0.86, rx: 0.13, ry: 0.045 },
    { x: 0.55, y: 0.79, rx: 0.11, ry: 0.035 },
    { x: 0.78, y: 0.92, rx: 0.16, ry: 0.05 },
    { x: 0.42, y: 0.96, rx: 0.20, ry: 0.04 },
    { x: 0.67, y: 0.70, rx: 0.08, ry: 0.022 },
  ];
  for (let y = Math.floor(horizon); y < height; y += 1) {
    const v = (y - horizon) / Math.max(1, height - horizon);
    for (let x = 0; x < width; x += 1) {
      const nx = x / width;
      const isSidewalk = y < sidewalkBottom;
      const asphaltNoise = fbm2(nx * 38, v * 26 + 3.1, 3, seed + 7, 2.07, 0.55);
      const coarse = fbm2(nx * 7.5, v * 4.4, 3, seed + 13, 2.03, 0.5);
      const puddle = puddles.reduce((best, item) => {
        const dx = (nx - item.x) / item.rx;
        const dy = (v - (item.y - HORIZON) / (1 - HORIZON)) / item.ry;
        const distance = Math.hypot(dx, dy);
        return Math.min(best, distance);
      }, 10);
      const puddleMask = 1 - smoothstep(0.62, 1.02, puddle);
      const wet = clamp(coarse * 0.34 + puddleMask * 0.62 + 0.02);
      wetMask[y * width + x] = wet;
      let base = isSidewalk
        ? mix(C.abyss, C.slate, 0.2 + asphaltNoise * 0.12)
        : mix(C.abyss, C.deep, 0.26 + asphaltNoise * 0.2);
      // 湿沥青的镜面高光：靠近地平线更亮。
      const sheen = Math.exp(-v * 5.2) * (0.03 + asphaltNoise * 0.025);
      base = add(base, scale(C.teal, sheen * 0.3));
      if (isSidewalk) {
        // 人行道砖缝：横向透视 + 纵向砖缝，避免出现一条纯色亮带。
        const seamAngle = (Math.floor(nx * 52 + v * 3) % 2) === 0 ? 0.008 : 0;
        const seamLine = Math.abs(((v * 28) % 1) - 0.5) < 0.03 ? 0.016 : 0;
        const seam = seamAngle + seamLine;
        base = add(base, [seam, seam * 1.05, seam * 1.12]);
        // 大块湿斑与积水，把水平亮带打碎。
        const patch = fbm2(nx * 7.5 + 2.2, 0.5, 3, seed + 43, 2.05, 0.55);
        base = add(base, scale(C.abyss, smoothstep(0.48, 0.78, patch) * 0.075));
        base = add(base, scale(C.cyan, smoothstep(0.72, 0.9, patch) * 0.018));
        // 店招/路灯在人行道上的湿反光。
        base = add(base, scale(C.amber, Math.exp(-Math.abs(nx - 0.21) * 22) * 0.025));
        // 纵向伸缩缝。
        if (Math.abs(((nx * 17) % 1) - 0.5) < 0.012) {
          base = add(base, scale(C.abyss, 0.04));
        }
      } else {
        // 车辙：两条更暗、更湿的纵向带。
        const tire = Math.exp(-((nx - 0.37) ** 2) / 0.0025) + Math.exp(-((nx - 0.61) ** 2) / 0.0025);
        base = add(base, scale(C.abyss, tire * 0.05));
      }
      // 倒影：取地平线以上的画面，纵向拉长并带一点波动。
      const reflectionY = horizon - (y - horizon) * (1.02 + wet * 0.22);
      const wobble = Math.sin(y * 0.11 + nx * 8.4) * (1.0 + wet * 2.2)
        + Math.sin(y * 0.031 - nx * 3.1) * 1.6;
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      for (let sample = 0; sample < 3; sample += 1) {
        const sampleY = reflectionY - sample * 2.2;
        plate.sampleBilinear(x + wobble, sampleY, reflectionSample);
        sumR += reflectionSample[0];
        sumG += reflectionSample[1];
        sumB += reflectionSample[2];
      }
      const broken = 0.55 + valueNoise2(nx * 34 + 4.2, v * 11 + 7.7, seed + 31) * 0.55;
      const reflectionScale = (1 / 3) * (0.06 + wet * 0.30) * (isSidewalk ? 0.22 : 1) * broken;
      const reflection = [sumR * reflectionScale, sumG * reflectionScale, sumB * reflectionScale];
      let color = add(base, reflection);
      // 中央虚线：只保留一条，近处更宽、更淡；两侧不再画实线，避免像悬空的钢丝。
      const laneWidth = 2 + v * 9;
      const center = width * 0.5 + Math.sin(v * 5.2) * width * 0.006;
      if (!isSidewalk && v > 0.12 && Math.abs(x - center) < laneWidth * 0.22) {
        const dash = Math.floor(v * 26) % 2 === 0;
        if (dash) color = add(color, [0.14, 0.15, 0.14]);
      }
      const index = (y * width + x) * 3;
      plate.data[index] = color[0];
      plate.data[index + 1] = color[1];
      plate.data[index + 2] = color[2];
    }
  }
  // 人行道上的积水与暗斑：用不规则椭圆打碎水平亮带。
  const patchRandom = mulberry32(seed ^ 0x5a17);
  for (let index = 0; index < 18; index += 1) {
    const cx = width * (0.08 + patchRandom() * 0.84);
    const cy = height * (0.624 + patchRandom() * 0.028);
    const rx = width * (0.025 + patchRandom() * 0.07);
    const ry = height * (0.004 + patchRandom() * 0.006);
    const dark = patchRandom() > 0.35;
    const color = dark ? [0.008, 0.012, 0.016] : [0.30, 0.45, 0.48];
    const alpha = dark ? 0.16 : 0.06;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
      const dy = (y - cy) / ry;
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
        const dx = (x - cx) / rx;
        if (dx * dx + dy * dy > 1) continue;
        plate.blendPixel(x, y, color, alpha);
      }
    }
    if (!dark) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
        const dx = (x - cx) / rx;
        if (Math.abs(dx) > 1) continue;
        plate.addPixel(x, cy + ry * 0.7, [0.52, 0.68, 0.7], 0.05 * (1 - dx * dx));
      }
    }
  }
  // 路缘石：暗色石材，只有一条湿冷高光，不再是一条发亮的白带。
  const curbY = sidewalkBottom;
  plate.fillRect(0, curbY - 3, width, curbY, [0.12, 0.18, 0.21], 0.62);
  plate.fillRect(0, curbY - 2, width, curbY - 1, [0.28, 0.4, 0.43], 0.22);
  plate.fillRect(0, curbY, width, curbY + 3, C.abyss, 0.72);
  // 霓虹、橱窗与路灯在湿地上的拖影。
  plate.wetStreak(width * 0.646, horizon, height * 0.995, width * 0.036, [0.22, 0.66, 0.74], 0.30);
  plate.wetStreak(width * 0.338, horizon, height * 0.99, width * 0.024, [0.78, 0.42, 0.2], 0.18);
  plate.wetStreak(width * 0.455, horizon, height * 0.99, width * 0.018, [0.72, 0.42, 0.22], 0.13);
  plate.wetStreak(width * 0.745, horizon, height * 0.99, width * 0.018, [0.58, 0.4, 0.26], 0.09);
  plate.wetStreak(width * 0.842, horizon, height * 0.99, width * 0.012, [0.24, 0.5, 0.54], 0.08);
  // 地平线附近的一层薄水光。
  for (let y = Math.floor(horizon + 2); y < horizon + height * 0.035; y += 1) {
    const alpha = (1 - (y - horizon) / (height * 0.035)) * 0.045;
    plate.fillRect(0, y, width, y + 1, [0.22, 0.36, 0.4], alpha);
  }
  streetLight(plate, emissive, width * 0.205, width, height, true);
  streetLight(plate, emissive, width * 0.775, width, height, false);
  return { wetMask, puddles, horizon, sidewalkBottom };
}

/** 人行道上的系柱、垃圾桶和一辆靠边停着的车，用来打断「水面」般的水平线。 */
function buildStreetProps(plate, emissive, width, height, seed) {
  const random = mulberry32(seed ^ 0x3de1);
  const sidewalkY = height * 0.633;
  // 店门口的台阶与灯影，把立面和人行道接起来。
  for (let index = 0; index < 9; index += 1) {
    if (index === 3 || index === 7) continue;
    const storeX = width * (0.015 + index * 0.11);
    const stepTop = height * 0.621;
    const stepBottom = height * 0.633;
    plate.fillRect(storeX + width * 0.008, stepTop, storeX + width * 0.072, stepBottom, [0.16, 0.23, 0.26], 0.38);
    plate.fillRect(storeX + width * 0.008, stepTop, storeX + width * 0.072, stepTop + 1.2, [0.4, 0.52, 0.54], 0.18);
    plate.fillRect(storeX + width * 0.008, stepBottom - 1.2, storeX + width * 0.072, stepBottom, C.abyss, 0.35);
    const warm = index % 2 === 0;
    plate.wetStreak(
      storeX + width * 0.04,
      height * 0.625,
      height * 0.685,
      width * 0.022,
      warm ? [0.8, 0.5, 0.28] : [0.3, 0.52, 0.56],
      0.16,
    );
  }
  for (let index = 0; index < 9; index += 1) {
    const x = width * (0.085 + index * 0.095);
    if (index === 2 || index === 6) continue;
    const top = sidewalkY - height * (0.016 + (index % 3) * 0.002);
    plate.fillRect(x, top, x + Math.max(2, width * 0.0022), sidewalkY + height * 0.008, C.abyss, 0.92);
    plate.fillRect(x - 1, top, x + Math.max(3, width * 0.0035), top + 2, [0.32, 0.44, 0.46], 0.28);
    plate.addPixel(x, top + 1, [0.62, 0.76, 0.76], 0.3);
    // 系柱在湿地上的一小截倒影。
    plate.fillRect(x, sidewalkY + height * 0.008, x + width * 0.002, sidewalkY + height * 0.032, [0.18, 0.28, 0.31], 0.12);
  }
  // 人行道排水篦子与消防栓。
  const drainX = width * 0.545;
  const drainY = height * 0.626;
  plate.fillRect(drainX, drainY, drainX + width * 0.032, drainY + height * 0.01, [0.012, 0.018, 0.02], 0.85);
  for (let bar = 1; bar < 6; bar += 1) {
    plate.fillRect(drainX + (width * 0.032 * bar) / 6, drainY + 1, drainX + (width * 0.032 * bar) / 6 + 1, drainY + height * 0.008, [0.16, 0.23, 0.25], 0.55);
  }
  const hydrantX = width * 0.332;
  const hydrantTop = height * 0.61;
  plate.fillRect(hydrantX, hydrantTop, hydrantX + width * 0.006, height * 0.633, [0.12, 0.09, 0.07], 0.9);
  plate.fillRect(hydrantX - width * 0.002, hydrantTop + height * 0.008, hydrantX + width * 0.008, hydrantTop + height * 0.016, [0.18, 0.12, 0.08], 0.9);
  plate.addPixel(hydrantX, hydrantTop + height * 0.004, [0.5, 0.32, 0.18], 0.35);

  // 垃圾桶。
  const binX = width * 0.875;
  const binTop = height * 0.604;
  plate.fillRect(binX, binTop, binX + width * 0.018, height * 0.664, [0.04, 0.055, 0.06], 0.92);
  plate.fillRect(binX - 1, binTop - 2, binX + width * 0.019, binTop, [0.22, 0.32, 0.34], 0.35);
  plate.addPixel(binX + 1, binTop + 2, [0.4, 0.55, 0.56], 0.2);

  // 靠右停着的车：低照度下的剪影 + 尾灯 + 湿地倒影。
  const carX0 = width * 0.792;
  const carX1 = width * 0.962;
  const carTop = height * 0.708;
  const carBottom = height * 0.786;
  const roofTop = height * 0.675;
  const roofX0 = width * 0.815;
  const roofX1 = width * 0.932;
  const body = [0.018, 0.024, 0.03];
  plate.fillRoundRect(carX0, carTop, carX1, carBottom, height * 0.018, body, 0.96);
  plate.fillRoundRect(roofX0, roofTop, roofX1, carTop + 2, height * 0.026, body, 0.96);
  // 车窗：只留一点冷色反光。
  plate.fillRect(roofX0 + width * 0.006, roofTop + height * 0.008, roofX1 - width * 0.006, carTop - height * 0.003, [0.12, 0.22, 0.27], 0.5);
  plate.fillRect(roofX0 + width * 0.006, roofTop + height * 0.008, roofX1 - width * 0.006, roofTop + height * 0.014, [0.42, 0.58, 0.62], 0.18);
  // 车顶与腰线的湿高光。
  plate.line(roofX0 + 2, roofTop, roofX1 - 2, roofTop, [0.48, 0.64, 0.66], 0.35, 1, true);
  plate.line(carX0 + 3, carTop + 1, carX1 - 3, carTop + 1, [0.42, 0.58, 0.6], 0.22, 1, true);
  // 车轮。
  for (const wheelX of [carX0 + width * 0.026, carX1 - width * 0.026]) {
    plate.fillRoundRect(wheelX - width * 0.014, carBottom - height * 0.008, wheelX + width * 0.014, carBottom + height * 0.006, height * 0.012, [0.006, 0.008, 0.01], 0.96);
    plate.addPixel(wheelX - width * 0.014, carBottom - height * 0.002, [0.3, 0.42, 0.44], 0.12);
  }
  // 尾灯：右侧车尾朝向镜头。
  plate.glow(carX1 - width * 0.008, carTop + height * 0.035, width * 0.012, [1.0, 0.18, 0.12], 0.85, 2.0);
  emissive.glow(carX1 - width * 0.008, carTop + height * 0.035, width * 0.008, [1.0, 0.18, 0.12], 0.75, 2.0);
  plate.fillRect(carX1 - width * 0.012, carTop + height * 0.031, carX1 - width * 0.005, carTop + height * 0.039, [1.0, 0.32, 0.2], 0.9);
  // 车底阴影与湿地尾灯拖影。
  plate.fillRect(carX0 + 2, carBottom + height * 0.004, carX1 - 2, carBottom + height * 0.012, [0.004, 0.006, 0.008], 0.5);
  plate.wetStreak(carX1 - width * 0.008, carBottom + height * 0.01, height * 0.98, width * 0.012, [0.78, 0.16, 0.1], 0.22);
  plate.wetStreak(roofX0 + width * 0.01, carBottom + height * 0.01, height * 0.97, width * 0.008, [0.3, 0.44, 0.46], 0.08);
  // 前挡风上的一点点雨光。
  for (let index = 0; index < 5; index += 1) {
    const sx = roofX0 + random() * (roofX1 - roofX0);
    plate.addPixel(sx, roofTop + height * (0.012 + random() * 0.025), [0.5, 0.7, 0.72], 0.18);
  }
}

/**
 * 一个背对着镜头、撑伞的人。
 * 只画剪影和轮廓光；尺寸很小，不喧宾夺主，但给雨夜一个尺度与叙事落点。
 */
function buildFigure(plate, emissive, width, height, seed) {
  const random = mulberry32(seed ^ 0x19c3);
  const cx = width * 0.236;
  const feetY = height * 0.958;
  const shoulderY = height * 0.812;
  const hemY = height * 0.902;
  const headY = height * 0.792;
  const headRadius = width * 0.0095;
  const umbrellaCenterY = height * 0.731;
  const umbrellaRx = width * 0.063;
  const umbrellaRy = height * 0.039;
  const canopyBase = umbrellaCenterY + umbrellaRy;
  const dark = [0.008, 0.011, 0.015];
  const coat = [0.032, 0.039, 0.045];
  const rimWarm = [0.98, 0.67, 0.4];
  const rimCool = [0.45, 0.71, 0.75];

  // 路灯在人物背后形成的一小片逆光，先把剪影托起来。
  plate.glow(cx - width * 0.018, shoulderY - height * 0.05, width * 0.095, rimWarm, 0.065, 2.3);
  plate.glow(cx + width * 0.012, hemY, width * 0.07, [0.3, 0.48, 0.54], 0.03, 2.4);

  // 伞面：半椭圆穹顶 + 细轮廓光 + 伞骨。
  for (let x = Math.floor(cx - umbrellaRx); x <= Math.ceil(cx + umbrellaRx); x += 1) {
    const dx = (x - cx) / umbrellaRx;
    if (Math.abs(dx) > 1) continue;
    const top = umbrellaCenterY + umbrellaRy * (1 - Math.sqrt(Math.max(0, 1 - dx * dx)));
    plate.fillRect(x, top, x + 1, canopyBase, dark, 0.84);
    plate.addPixel(x, top, rimCool, 0.3 * (1 - Math.abs(dx) * 0.55));
    if (Math.abs(dx) < 0.05) plate.addPixel(x, top - 1, rimWarm, 0.26);
  }
  // 伞骨。
  for (let rib = -3; rib <= 3; rib += 1) {
    if (rib === 0) continue;
    const angle = (rib / 3) * (Math.PI / 2);
    const ex = cx + Math.sin(angle) * umbrellaRx;
    const ey = umbrellaCenterY + umbrellaRy * (1 - Math.cos(angle) * 0.92);
    plate.line(cx, umbrellaCenterY + 2, ex, ey, [0.03, 0.045, 0.055], 0.5, 1, false);
  }
  // 伞柄与手。
  plate.line(cx, umbrellaCenterY + 2, cx + width * 0.002, height * 0.868, [0.012, 0.016, 0.02], 0.92, 1.5, false);
  plate.addPixel(cx + width * 0.002, height * 0.868, rimWarm, 0.45);

  // 头部（后脑 + 一点帽檐）。
  for (let y = Math.floor(headY - headRadius); y <= Math.ceil(headY + headRadius); y += 1) {
    const dy = (y - headY) / headRadius;
    if (Math.abs(dy) > 1) continue;
    const half = headRadius * Math.sqrt(1 - dy * dy);
    plate.fillRect(cx - half, y, cx + half, y + 1, dark, 0.96);
    plate.addPixel(cx - half, y, rimWarm, 0.5);
    plate.addPixel(cx + half, y, rimCool, 0.16);
  }
  plate.fillRect(cx - headRadius * 1.15, headY - headRadius * 0.9, cx + headRadius * 1.15, headY - headRadius * 0.45, dark, 0.96);
  plate.addPixel(cx - headRadius * 1.15, headY - headRadius * 0.9, rimWarm, 0.25);

  // 大衣：肩窄、下摆微喇，中间有一点腰线，避免变成一块梯形。
  fillTriangle(
    plate,
    cx - width * 0.022, shoulderY,
    cx + width * 0.022, shoulderY,
    cx + width * 0.027, hemY,
    coat, 0.97,
  );
  fillTriangle(
    plate,
    cx - width * 0.022, shoulderY,
    cx + width * 0.027, hemY,
    cx - width * 0.027, hemY,
    coat, 0.97,
  );
  plate.fillRect(cx - width * 0.022, shoulderY, cx + width * 0.022, shoulderY + height * 0.006, dark, 0.6);
  plate.fillRect(cx - width * 0.025, hemY - height * 0.004, cx + width * 0.025, hemY, dark, 0.85);
  // 腰带与肩线。
  plate.line(cx - width * 0.019, height * 0.858, cx + width * 0.019, height * 0.858, [0.055, 0.07, 0.08], 0.55, 1.4, false);
  plate.line(cx - width * 0.022, shoulderY, cx - width * 0.027, hemY, rimCool, 0.34, 1, true);
  plate.line(cx + width * 0.022, shoulderY, cx + width * 0.027, hemY, rimWarm, 0.24, 1, true);
  plate.line(cx - width * 0.027, hemY, cx + width * 0.027, hemY, rimCool, 0.2, 1, true);
  plate.line(cx - width * 0.02, shoulderY + height * 0.008, cx - width * 0.024, hemY - height * 0.01, rimWarm, 0.2, 1, true);
  // 双腿：比下摆更窄，露出一段裤线。
  plate.line(cx - width * 0.0085, hemY, cx - width * 0.012, feetY, dark, 0.96, 2.2, false);
  plate.line(cx + width * 0.0085, hemY, cx + width * 0.0125, feetY, dark, 0.96, 2.2, false);
  plate.line(cx - width * 0.012, feetY - height * 0.006, cx - width * 0.012, feetY, rimCool, 0.35, 1, true);
  plate.addPixel(cx + width * 0.0125, feetY - height * 0.008, rimWarm, 0.18);
  // 鞋。
  plate.fillRect(cx - width * 0.019, feetY, cx - width * 0.006, feetY + height * 0.006, dark, 0.9);
  plate.fillRect(cx + width * 0.006, feetY, cx + width * 0.019, feetY + height * 0.006, dark, 0.9);
  plate.addPixel(cx - width * 0.019, feetY + height * 0.004, rimCool, 0.25);

  // 地面接触阴影与湿地倒影。
  for (let index = 0; index < 6; index += 1) {
    const spread = width * (0.015 + index * 0.006);
    const y = feetY + height * 0.006 + index * 2;
    plate.fillRect(cx - spread, y, cx + spread, y + 1, [0.005, 0.007, 0.01], 0.15 - index * 0.02);
  }
  plate.wetStreak(cx - width * 0.006, feetY + height * 0.004, height * 0.995, width * 0.02, [0.30, 0.38, 0.42], 0.12);
  plate.wetStreak(cx - width * 0.018, feetY + height * 0.004, height * 0.99, width * 0.01, [0.6, 0.38, 0.2], 0.09);
  // 伞上滴下的水珠。
  for (let index = 0; index < 5; index += 1) {
    const dx = cx + (random() - 0.5) * umbrellaRx * 1.6;
    const dy = canopyBase + random() * height * 0.06;
    emissive.addPixel(dx, dy, rimCool, 0.14);
  }
}

function buildNearFrame(plate, width, height, seed) {
  const random = mulberry32(seed ^ 0x73a1);
  // 左右近景建筑边缘：更黑、更实，作为画框。
  const leftEdge = width * 0.075;
  for (let x = 0; x < leftEdge; x += 1) {
    const alpha = 0.82 - (x / leftEdge) * 0.24;
    plate.fillRect(x, 0, x + 1, height, C.abyss, alpha);
  }
  const rightEdge = width * 0.925;
  for (let x = Math.floor(rightEdge); x < width; x += 1) {
    const alpha = 0.8 - ((width - x) / (width - rightEdge)) * 0.16;
    plate.fillRect(x, 0, x + 1, height, C.abyss, alpha);
  }
  // 左上方雨棚：斜切的黑影，给画面一个近景遮挡。
  for (let x = 0; x < width * 0.22; x += 1) {
    const edge = height * (0.105 - (x / (width * 0.22)) * 0.055);
    plate.fillRect(x, 0, x + 1, edge, C.abyss, 0.88);
    plate.fillRect(x, edge - 1, x + 1, edge + 1, [0.38, 0.55, 0.58], 0.10);
  }
  // 右侧竖管与湿亮边。
  const pipeX = width * 0.958;
  plate.fillRect(pipeX, height * 0.18, pipeX + width * 0.007, height, C.abyss, 0.9);
  plate.fillRect(pipeX + width * 0.007, height * 0.18, pipeX + width * 0.009, height, [0.42, 0.62, 0.66], 0.16);
  for (let y = height * 0.28; y < height; y += height * 0.11) {
    plate.fillRect(pipeX - 1, y, pipeX + width * 0.008, y + 2, C.abyss, 0.85);
  }
  // 底部湿台面，压低画面重心。
  for (let y = Math.floor(height * 0.972); y < height; y += 1) {
    const alpha = 0.6 + ((y - height * 0.972) / (height * 0.028)) * 0.3;
    plate.fillRect(0, y, width, y + 1, C.abyss, alpha);
  }
  // 近景雨棚上的水珠反光。
  for (let index = 0; index < 42; index += 1) {
    const x = random() * width * 0.22;
    const y = random() * height * 0.08;
    plate.glow(x, y, 1.4 + random() * 2.8, [0.55, 0.74, 0.8], 0.15 + random() * 0.12, 2.0);
  }
}

function buildHaze(plate, width, height) {
  const horizon = HORIZON * height;
  for (let y = 0; y < height; y += 1) {
    const distance = Math.abs(y - horizon) / (height * 0.19);
    const fog = Math.exp(-(distance * distance) * 2.2) * 0.22;
    if (fog < 0.002) continue;
    for (let x = 0; x < width; x += 1) {
      const noise = valueNoise2(x * 0.0018, y * 0.006, 91);
      const amount = fog * (0.65 + noise * 0.7);
      const index = (y * width + x) * 3;
      plate.data[index] += C.teal[0] * amount;
      plate.data[index + 1] += C.teal[1] * amount;
      plate.data[index + 2] += C.teal[2] * amount;
    }
  }
}

function addBloom(plate, width, height) {
  const bright = brightPass(plate, STYLE.bloom.threshold, 0.24);
  const blurred = boxBlur(bright, width, height, STYLE.bloom.radius, 2);
  const intensity = STYLE.bloom.intensity;
  for (let index = 0; index < plate.data.length; index += 1) {
    plate.data[index] += blurred[index] * intensity;
  }
}

function createLayout(width, height) {
  return {
    horizon: HORIZON * height,
    sign: {
      x: width * 0.612,
      y: height * 0.31,
      width: width * 0.046,
      height: height * 0.135,
    },
    lamps: [
      { x: width * 0.205 - width * 0.027, y: height * 0.341 },
      { x: width * 0.775 - width * 0.027, y: height * 0.341 },
    ],
  };
}

/**
 * 生成静态底板。
 * @param {{width:number,height:number,seed:number,variant?:string}} options
 */
export function renderPlate({ width, height, seed = 20261025, variant = 'default' }) {
  const plate = new Surface(width, height);
  const emissive = new Surface(width, height);
  skyPass(plate, width, height, seed);
  farSkylinePass(plate, emissive, width, height, seed + 3);
  buildMidground(plate, emissive, width, height, seed + 5);
  const street = buildStreet(plate, emissive, width, height, seed + 9);
  buildStreetProps(plate, emissive, width, height, seed + 10);
  buildFigure(plate, emissive, width, height, seed + 11);
  buildNearFrame(plate, width, height, seed + 13);
  // 先叠一层薄雾，再把 emissive 的 bloom 加回来；顺序影响霓虹的空气感。
  buildHaze(plate, width, height);
  addBloom(plate, width, height);
  // 静态底板也带一点点冷调，让雨和灯更贴。
  if (variant === 'dark') {
    for (let index = 0; index < plate.data.length; index += 3) {
      plate.data[index] *= 0.82;
      plate.data[index + 1] *= 0.9;
      plate.data[index + 2] *= 0.94;
    }
  }
  const layout = createLayout(width, height);
  layout.street = street;
  return { plate, emissive, layout, street, width, height, seed };
}

function projectPoint(plate, outWidth, outHeight, zoom, cameraX, cameraY, eyeShift, x, y) {
  return {
    x: (x - plate.width / 2 - cameraX - eyeShift) * zoom + outWidth / 2,
    y: (y - plate.height / 2 - cameraY) * zoom + outHeight / 2,
  };
}

function drawRain(frame, width, height, t, seed, eyeShift) {
  const { layers, wind, color } = STYLE.rain;
  const random = mulberry32(seed ^ 0x4a11);
  const areaScale = Math.sqrt((width * height) / (1280 * 720));
  for (const layer of layers) {
    const count = Math.round(layer.count * areaScale);
    const speed = layer.speed;
    const length = layer.length * areaScale;
    const alpha = layer.alpha;
    const widthPx = layer.width * areaScale;
    const depth = layer.depth;
    for (let index = 0; index < count; index += 1) {
      const seedX = random();
      const seedY = random();
      const wobble = random();
      const x = ((seedX * (width + 120) + t * speed * wind + eyeShift * (0.35 + depth * 0.65)) % (width + 120)) - 60;
      const y = ((seedY * (height + 160) + t * speed) % (height + 160)) - 80;
      const dx = wind * length;
      const dy = length * (0.92 + wobble * 0.25);
      const localAlpha = alpha * (0.55 + wobble * 0.65);
      frame.line(x, y, x + dx, y + dy, color, localAlpha, widthPx, true);
      if (depth > 0.8 && wobble > 0.82) {
        frame.addPixel(x, y, [0.74, 0.86, 0.9], localAlpha * 0.8);
        frame.glow(x, y, 2.2 * areaScale, color, localAlpha * 0.12, 2.2);
      }
    }
  }
}

function drawRipples(frame, plate, layout, width, height, t, zoom, cameraX, cameraY, eyeShift, seed) {
  const random = mulberry32(seed ^ 0x61f1);
  const puddles = layout.street?.puddles ?? [];
  for (const puddle of puddles) {
    const px = plate.width * puddle.x;
    const py = plate.height * (HORIZON + puddle.y * (1 - HORIZON));
    const point = projectPoint(plate, width, height, zoom, cameraX, cameraY, eyeShift, px, py);
    const baseRadius = plate.width * puddle.rx * 0.42;
    const rings = 3;
    for (let ring = 0; ring < rings; ring += 1) {
      const phase = (t * 0.55 + ring / rings + random() * 0.1) % 1;
      const radius = (0.18 + phase * 0.95) * baseRadius * zoom;
      const alpha = (1 - phase) * 0.10;
      if (alpha <= 0.002) continue;
      frame.ellipseRing(
        point.x,
        point.y,
        radius,
        radius * 0.28,
        [0.50, 0.68, 0.72],
        alpha,
        1.1,
      );
    }
  }
}

function drawHeadlights(frame, plate, layout, width, height, t, zoom, cameraX, cameraY, eyeShift) {
  const start = 6.4;
  const end = 9.8;
  if (t < start || t > end) return;
  const progress = (t - start) / (end - start);
  const eased = progress * progress * (3 - 2 * progress);
  const worldX = plate.width * lerp(0.14, 0.86, eased);
  const worldY = plate.height * (HORIZON + 0.025);
  const point = projectPoint(plate, width, height, zoom, cameraX, cameraY, eyeShift, worldX, worldY);
  const scaleFactor = zoom * (1.0 + progress * 0.25);
  const carWidth = 34 * scaleFactor;
  const carHeight = 8 * scaleFactor;
  // 远处车体只是一块更黑的剪影，避免抢主体。
  frame.fillRoundRect(
    point.x - carWidth / 2,
    point.y - carHeight / 2,
    point.x + carWidth / 2,
    point.y + carHeight * 0.6,
    carHeight * 0.45,
    [0.006, 0.008, 0.01],
    0.72,
  );
  const lightY = point.y - carHeight * 0.1;
  for (const side of [-1, 1]) {
    const lx = point.x + side * carWidth * 0.33;
    frame.glow(lx, lightY, 9 * scaleFactor, [1.0, 0.76, 0.48], 0.9, 2.2);
    frame.addPixel(lx, lightY, [1.0, 0.9, 0.72], 1.2);
    frame.wetStreak(lx, lightY + 4, lightY + 38 * scaleFactor, 3.4 * scaleFactor, [0.8, 0.52, 0.28], 0.32);
  }
  // 车灯照亮的一小片湿地。
  frame.glow(point.x, point.y + 6, 38 * scaleFactor, [0.55, 0.42, 0.26], 0.10, 2.4);
}

function drawFlicker(frame, plate, layout, width, height, t, zoom, cameraX, cameraY, eyeShift) {
  const sign = layout.sign;
  const point = projectPoint(plate, width, height, zoom, cameraX, cameraY, eyeShift, sign.x + sign.width / 2, sign.y + sign.height / 2);
  // 11s 附近的一次短暂接触不良；其余时间只有呼吸。
  let flicker = 1;
  if (t > 10.7 && t < 11.25) {
    const local = (t - 10.7) / 0.55;
    const gate = Math.sin(local * Math.PI * 17) > 0.25 ? 1 : 0.18;
    const dropout = local > 0.35 && local < 0.48 ? 0.1 : 1;
    flicker = gate * dropout;
  }
  flicker *= 0.94 + 0.06 * Math.sin(t * 1.7);
  const signW = sign.width * zoom;
  const signH = sign.height * zoom;
  if (flicker < 0.9) {
    frame.fillRect(
      point.x - signW / 2,
      point.y - signH / 2,
      point.x + signW / 2,
      point.y + signH / 2,
      [0, 0, 0],
      (1 - flicker) * 0.55,
    );
  }
  frame.glow(point.x, point.y, signW * 3.8, [0.28, 0.82, 0.88], 0.055 * flicker, 2.4);
  frame.glow(point.x, point.y, signW * 1.4, [0.35, 0.9, 0.96], 0.08 * flicker, 2.0);
}

function drawBokeh(frame, width, height, t, seed, eyeShift) {
  const random = mulberry32(seed ^ 0x2b7e);
  for (let index = 0; index < 14; index += 1) {
    const baseX = random();
    const baseY = random();
    const radius = 18 + random() * 42;
    const drift = 0.5 + random() * 0.8;
    const x = ((baseX * width + Math.sin(t * 0.13 * drift + index) * 28 + width) % width) + eyeShift * 1.4;
    const y = ((baseY * height + Math.cos(t * 0.09 * drift + index * 2.1) * 20 + height) % height);
    const color = index % 3 === 0 ? [0.62, 0.5, 0.3] : [0.35, 0.6, 0.68];
    frame.glow(x, y, radius, color, 0.018 + random() * 0.018, 2.0);
  }
}

/**
 * 逐帧渲染。
 * @param {ReturnType<typeof renderPlate>} scene
 * @param {number} t 秒
 * @param {'Left'|'Right'} eye
 * @param {{width:number,height:number,frameIndex:number,loopSeconds:number}} options
 */
export function renderSceneFrame(scene, t, eye, options) {
  const { width, height, frameIndex = 0, loopSeconds = 24 } = options;
  const { plate } = scene;
  const eyeShift = eye === 'Right' ? 8 : 0;
  const tau = Math.PI * 2;
  const cameraX = Math.sin((t / loopSeconds) * tau) * 8.5 + Math.sin((t / 8) * tau) * 1.8;
  const cameraY = Math.sin((t / loopSeconds) * tau + 0.7) * 3.2 + Math.sin((t / 6) * tau) * 0.8;
  const zoom = 1.045 + Math.sin((t / loopSeconds) * tau + 1.2) * 0.006;
  const frame = options.frame ?? new Surface(width, height);
  const sample = [0, 0, 0];
  const plateWidth = plate.width;
  const plateHeight = plate.height;
  const startX = plateWidth / 2 - width / 2 / zoom + cameraX + eyeShift;
  const startY = plateHeight / 2 - height / 2 / zoom + cameraY;
  const step = 1 / zoom;
  for (let y = 0; y < height; y += 1) {
    const sourceY = startY + y * step;
    for (let x = 0; x < width; x += 1) {
      const sourceX = startX + x * step;
      plate.sampleBilinear(sourceX, sourceY, sample);
      const index = (y * width + x) * 3;
      frame.data[index] = sample[0];
      frame.data[index + 1] = sample[1];
      frame.data[index + 2] = sample[2];
    }
  }
  // 先画远景车灯与霓虹呼吸，再画雨；雨始终在最前。
  drawHeadlights(frame, plate, scene.layout, width, height, t, zoom, cameraX, cameraY, eyeShift);
  drawFlicker(frame, plate, scene.layout, width, height, t, zoom, cameraX, cameraY, eyeShift);
  drawRipples(frame, plate, scene.layout, width, height, t, zoom, cameraX, cameraY, eyeShift, scene.seed);
  drawRain(frame, width, height, t, scene.seed, eyeShift);
  drawBokeh(frame, width, height, t, scene.seed, eyeShift);

  // 极淡的横向雾带，随镜头缓慢漂移。
  const horizon = scene.layout.horizon;
  const fogColor = [0.30, 0.48, 0.53];
  for (let y = Math.max(0, Math.floor(horizon - height * 0.16)); y < Math.min(height, horizon + height * 0.08); y += 1) {
    const distance = Math.abs(y - horizon) / (height * 0.16);
    const alpha = Math.exp(-distance * distance * 2.5) * 0.035;
    const row = y * width * 3;
    for (let x = 0; x < width; x += 1) {
      frame.data[row + x * 3] += fogColor[0] * alpha;
      frame.data[row + x * 3 + 1] += fogColor[1] * alpha;
      frame.data[row + x * 3 + 2] += fogColor[2] * alpha;
    }
  }

  return {
    frame,
    cameraX,
    cameraY,
    zoom,
    eyeShift,
  };
}

const postCache = new Map();

function postProcessTables(width, height, seed) {
  const key = `${width}x${height}:${seed}`;
  const cached = postCache.get(key);
  if (cached) return cached;
  const tables = {
    lut: buildGradeLut(),
    vignette: buildVignette(width, height),
    grain: buildGrain(512, seed),
  };
  postCache.set(key, tables);
  return tables;
}

/** 浮点面 -> 8-bit RGBA，含 tone map、LUT、暗角和颗粒。 */
export function finalizeFrame(frame, width, height, frameIndex = 0, seed = 20261025) {
  const { lut, vignette, grain } = postProcessTables(width, height, seed);
  const output = new Uint8ClampedArray(width * height * 4);
  const data = frame.data;
  const grainOffsetX = (frameIndex * 37) % grain.size;
  const grainOffsetY = (frameIndex * 61) % grain.size;
  for (let y = 0; y < height; y += 1) {
    const grainRow = ((y + grainOffsetY) % grain.size) * grain.size;
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 3;
      const out = (y * width + x) * 4;
      const noise = grain.data[grainRow + ((x + grainOffsetX) % grain.size)] * STYLE.grain.strength;
      const factor = vignette[y * width + x];
      let r = data[index];
      let g = data[index + 1];
      let b = data[index + 2];
      r = r <= 0 ? 0 : r <= 0.8 ? r : 0.8 + (1 - Math.exp(-(r - 0.8) * 2.6)) * 0.24;
      g = g <= 0 ? 0 : g <= 0.8 ? g : 0.8 + (1 - Math.exp(-(g - 0.8) * 2.6)) * 0.24;
      b = b <= 0 ? 0 : b <= 0.8 ? b : 0.8 + (1 - Math.exp(-(b - 0.8) * 2.6)) * 0.24;
      r = clamp(r + noise / 255);
      g = clamp(g + noise / 255);
      b = clamp(b + noise / 255);
      r = lut[0][Math.round(r * 255)];
      g = lut[1][Math.round(g * 255)];
      b = lut[2][Math.round(b * 255)];
      const luma = r * 0.2126 + g * 0.7152 + b * 0.0722;
      const saturation = STYLE.grade.saturation;
      output[out] = (r + (luma - r) * (1 - saturation)) * factor;
      output[out + 1] = (g + (luma - g) * (1 - saturation)) * factor;
      output[out + 2] = (b + (luma - b) * (1 - saturation)) * factor;
      output[out + 3] = 255;
    }
  }
  return output;
}

/** 生成一张静帧（供 generate-images / 视频抽帧使用）。 */
export function renderStill({ width, height, time, seed = 20261025, variant = 'default', eye = 'Left' }) {
  const scene = renderPlate({ width, height, seed, variant });
  const { frame, cameraX, cameraY, zoom, eyeShift } = renderSceneFrame(scene, time, eye, {
    width,
    height,
    frameIndex: Math.round(time * 30),
    loopSeconds: 24,
  });
  const rgba = finalizeFrame(frame, width, height, Math.round(time * 30), seed);
  return { scene, frame, rgba, cameraX, cameraY, zoom, eyeShift };
}
