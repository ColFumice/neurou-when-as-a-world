// T0 视频帧呈现测量；AC-19 使用当前 30ms 门限，历史值不代表本轮结果。
import { SYNC_TOLERANCE_MS } from '../../constants';

/** 保留既有测试导出名；数值服从阶段 1 当前同步门限。 */
export const VIDEO_SYNC_TOLERANCE_MS_TENTATIVE = SYNC_TOLERANCE_MS;

/** 缩放检测画布宽（16:9，与测试视频一致） */
const DETECT_CANVAS_WIDTH = 320;
const DETECT_CANVAS_HEIGHT = 180;

/** 中心检测区域边长（缩放后像素） */
const DETECT_REGION_SIZE = 96;

/** 单像素亮度阈值（三通道均高于该值视为高亮） */
const BRIGHT_CHANNEL_THRESHOLD = 200;

/** 中心区域高亮像素数阈值，高于此值判定判定圈出现 */
const BRIGHT_PIXEL_COUNT_THRESHOLD = 100;

// ------------------------------------------------------------
// 板块一：输出契约（HANDOFF 逐字指定，字段名禁止改动）
// ------------------------------------------------------------

/**
 * VideoSyncResult 单分辨率测量结果（HANDOFF-ROUND-10 指定格式）
 */
export interface VideoSyncResult {
  /** 分辨率标签，如 "1920x1080" */
  readonly resolution: string;
  /** 偏差（毫秒），各样本 |d| 的最大值 */
  readonly deviationMs: number;
  /** 本次有效采样数（成功检出的判定圈数量） */
  readonly sampleCount: number;
}

// ------------------------------------------------------------
// 板块二：测试输入结构（测试专用，非游戏谱面类型）
// ------------------------------------------------------------

/** 等间隔音符（测试谱面条目） */
interface SyncTestNote {
  /** 音符相对视频起点的媒体时间（毫秒） */
  readonly timeMs: number;
}

/** 等间隔谱面（assets/test/equally-spaced-chart.json） */
interface EquallySpacedChart {
  readonly testChartName: string;
  readonly timeBase: string;
  readonly intervalMs: number;
  readonly notes: readonly SyncTestNote[];
}

/** 单个测量目标（一个分辨率 + 其视频地址） */
interface SyncTestTarget {
  readonly resolution: string;
  readonly videoUrl: string;
}

/** 单次判定圈采样明细（不进入 HANDOFF 指定输出） */
interface SyncSample {
  /** 判定时钟期望时间（毫秒） */
  readonly expectedMs: number;
  /** 检出帧携带的视频媒体时间（毫秒） */
  readonly presentedMediaMs: number;
  /** 呈现时刻相对判定时钟的偏差（毫秒） */
  readonly wallDriftMs: number;
}

/** 单分辨率测量明细（输出 + 旁证数据） */
interface ResolutionDetail {
  readonly result: VideoSyncResult;
  readonly samples: readonly SyncSample[];
  /** 样本偏差绝对值的平均值（毫秒，旁证） */
  readonly meanAbsDriftMs: number;
  /** 编码对齐误差最大绝对值（毫秒，旁证） */
  readonly maxEncodeAlignmentMs: number;
}

/** rVFC 元数据最小自包含声明（不依赖 TS DOM lib 版本） */
interface VideoFrameCallbackMetadataLike {
  readonly mediaTime: number;
  readonly expectedDisplayTime: number;
}
type VideoFrameRequestCallbackLike = (
  nowMs: number,
  metadata: VideoFrameCallbackMetadataLike,
) => void;
interface RequestVideoFrameCallbackCapable {
  requestVideoFrameCallback(cb: VideoFrameRequestCallbackLike): number;
  cancelVideoFrameCallback(handle: number): void;
}

// ------------------------------------------------------------
// 板块三：测量实现
// ------------------------------------------------------------

/**
 * 检出缩放画布中心区域的高亮像素数量
 */
function detectBrightPixelCount(
  context: CanvasRenderingContext2D,
): number {
  const half = DETECT_REGION_SIZE / 2;
  const centerX = DETECT_CANVAS_WIDTH / 2;
  const centerY = DETECT_CANVAS_HEIGHT / 2;
  const imageData = context.getImageData(
    centerX - half,
    centerY - half,
    DETECT_REGION_SIZE,
    DETECT_REGION_SIZE,
  );

  let count = 0;
  const pixels = imageData.data;
  for (let index = 0; index < pixels.length; index += 4) {
    if (
      pixels[index] > BRIGHT_CHANNEL_THRESHOLD &&
      pixels[index + 1] > BRIGHT_CHANNEL_THRESHOLD &&
      pixels[index + 2] > BRIGHT_CHANNEL_THRESHOLD
    ) {
      count += 1;
    }
  }
  return count;
}

/**
 * 对单个分辨率目标执行一次完整播放测量
 */
async function runOneResolution(
  target: SyncTestTarget,
  chart: EquallySpacedChart,
): Promise<ResolutionDetail> {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.controls = false;
  document.body.appendChild(video);
  const samples: SyncSample[] = [];
  const callbackCapable = video as unknown as RequestVideoFrameCallbackCapable;
  let frameHandle = 0;
  let timeoutHandle = 0;
  let onLoaded = (): void => {};
  let onEnded = (): void => {};
  let onError = (): void => {};
  try {
    const canvas = document.createElement('canvas');
    canvas.width = DETECT_CANVAS_WIDTH;
    canvas.height = DETECT_CANVAS_HEIGHT;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context || typeof callbackCapable.requestVideoFrameCallback !== 'function') {
      throw new Error('VideoSyncTest：平台缺少画布或逐帧回调');
    }
    await new Promise<void>((resolve, reject) => {
      onLoaded = resolve;
      onError = () => reject(new Error('视频加载失败：' + target.videoUrl));
      video.addEventListener('loadeddata', onLoaded, { once: true });
      video.addEventListener('error', onError, { once: true });
      timeoutHandle = window.setTimeout(() => reject(new Error('视频加载超时')), 15000);
      video.src = target.videoUrl;
    });
    window.clearTimeout(timeoutHandle);
    video.removeEventListener('error', onError);
    let anchorWallMs: number | null = null;
    let anchorMediaMs = 0;
    let markerPresent = false;
    await new Promise<void>((resolve, reject) => {
      onEnded = resolve;
      onError = () => reject(new Error('播放失败：' + target.videoUrl));
      video.addEventListener('ended', onEnded, { once: true });
      video.addEventListener('error', onError, { once: true });
      timeoutHandle = window.setTimeout(() => reject(new Error('视频测量超时')), 30000);
      const onFrame: VideoFrameRequestCallbackLike = (_nowMs, metadata) => {
        try {
          if (anchorWallMs === null) {
            anchorWallMs = metadata.expectedDisplayTime;
            anchorMediaMs = metadata.mediaTime * 1000;
          }
          context.drawImage(video, 0, 0, DETECT_CANVAS_WIDTH, DETECT_CANVAS_HEIGHT);
          const markerNowPresent = detectBrightPixelCount(context) >= BRIGHT_PIXEL_COUNT_THRESHOLD;
          if (markerNowPresent && !markerPresent) {
            const expectedMs = chart.notes[samples.length]?.timeMs;
            if (expectedMs !== undefined) {
              const presentedMediaMs = metadata.mediaTime * 1000;
              const wallDriftMs = metadata.expectedDisplayTime - anchorWallMs - (expectedMs - anchorMediaMs);
              samples.push({ expectedMs, presentedMediaMs, wallDriftMs });
            }
          }
          markerPresent = markerNowPresent;
          frameHandle = callbackCapable.requestVideoFrameCallback(onFrame);
        } catch (error) { reject(error); }
      };
      frameHandle = callbackCapable.requestVideoFrameCallback(onFrame);
      void video.play().catch(reject);
    });
  } finally {
    window.clearTimeout(timeoutHandle);
    if (frameHandle) { callbackCapable.cancelVideoFrameCallback(frameHandle); }
    video.removeEventListener('loadeddata', onLoaded);
    video.removeEventListener('ended', onEnded);
    video.removeEventListener('error', onError);
    video.pause();
    video.removeAttribute('src');
    video.load();
    video.remove();
  }
  if (samples.length !== chart.notes.length || samples.length === 0) {
    throw new Error('VideoSyncTest：检出判定圈不完整（' + target.resolution + '）');
  }

  const driftValues = samples.map((sample) => Math.abs(sample.wallDriftMs));
  const deviationMs = Math.max(...driftValues);
  const meanAbsDriftMs =
    driftValues.reduce((sum, value) => sum + value, 0) / driftValues.length;
  const maxEncodeAlignmentMs = Math.max(
    ...samples.map((sample) => Math.abs(sample.presentedMediaMs - sample.expectedMs)),
  );

  return {
    result: {
      resolution: target.resolution,
      deviationMs: Number(deviationMs.toFixed(2)),
      sampleCount: samples.length,
    },
    samples,
    meanAbsDriftMs: Number(meanAbsDriftMs.toFixed(2)),
    maxEncodeAlignmentMs: Number(maxEncodeAlignmentMs.toFixed(2)),
  };
}

/**
 * VideoSyncTest 入口：加载等间隔谱面，依次测量各分辨率
 *
 * @param basePath 资源根路径（同源静态服务，默认 '/assets/test'）
 * @returns results 为 HANDOFF 指定的输出数组；details 为旁证明细
 */
export async function runVideoSyncTest(
  basePath = '/assets/test',
): Promise<{
  readonly results: readonly VideoSyncResult[];
  readonly details: readonly ResolutionDetail[];
}> {
  const chartUrl = basePath + '/equally-spaced-chart.json';
  const chartResponse = await fetch(chartUrl);
  if (!chartResponse.ok) {
    throw new Error('谱面加载失败：' + chartUrl);
  }
  const chart = (await chartResponse.json()) as EquallySpacedChart;

  const targets: readonly SyncTestTarget[] = [
    { resolution: '1920x1080', videoUrl: basePath + '/sync_1920x1080.mp4' },
    { resolution: '2560x1440', videoUrl: basePath + '/sync_2560x1440.mp4' },
  ];

  const details: ResolutionDetail[] = [];
  for (const target of targets) {
    details.push(await runOneResolution(target, chart));
  }

  return {
    results: details.map((detail) => detail.result),
    details,
  };
}

/**
 * 判定某分辨率结果是否超出当前同步容差（30ms）
 * 超限 → 向 PROTOCOL 报告并升级 ARCHITECT 裁定是否改用 FFmpeg。
 */
export function exceedsTentativeTolerance(result: VideoSyncResult): boolean {
  return result.deviationMs > VIDEO_SYNC_TOLERANCE_MS_TENTATIVE;
}

// 浏览器环境自动挂载入口（仅技术验证执行用，非游戏运行时）
const browserGlobal = globalThis as {
  __runVideoSyncTest?: typeof runVideoSyncTest;
};
if (typeof document !== 'undefined') {
  browserGlobal.__runVideoSyncTest = runVideoSyncTest;
}
