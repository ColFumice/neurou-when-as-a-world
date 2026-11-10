// ============================================================
// T0 技术验证 · VideoSyncTest 视频/判定时钟同步偏差测量脚本
// 名库版本：v1.2（名库未冻结任何视频同步领域名称；
//   本文件名 VideoSyncTest 与输出字段
//   resolution / deviationMs / sampleCount
//   为 HANDOFF-ROUND-10 文本逐字明示，按铁律 3 通道落盘）
//
// 本文件性质：纯测量/输出脚本，不含任何游戏业务逻辑，
//   不 import 任何游戏模块，不参与游戏运行时。
//
// 测量对象：
//   视频画面中“判定圈”的实际呈现时刻（rVFC 回调时刻）
//   相对“判定时钟”（谱面等间隔音符的媒体时间）的偏差。
//
// 测量方法（HANDOFF-ROUND-11 正式追认，作为阶段 1 合格线）：
//   容差 100ms / 聚合口径 max|d| / 检出阈值 30fps·500ms；
//   1. 测试视频为黑底，判定圈（白色圆环）仅在谱面音符
//      对应帧（30fps 下每 15 帧，即每 500ms）呈现 1 帧；
//   2. 以 requestVideoFrameCallback 逐帧回调，把视频帧
//      绘制到离屏缩放 canvas（320x180），扫描中心区域的
//      高亮像素数量，以上升沿检出判定圈呈现帧；
//   3. 以首个 rVFC 回调为锚点 (wall0, media0)：
//      样本偏差 d = (wallNow - wall0) - (expectedMs - media0)
//      正值表示画面呈现落后于判定时钟；
//   4. 同时记录编码对齐误差 presentedMediaMs - expectedMs
//      （仅作旁证，不进入 HANDOFF 指定输出）；
//   5. 聚合口径：deviationMs = max(|d_i|)（最坏值），
//      节奏游戏同步判定采用保守最坏值；平均值仅入明细。
//
// 容差：100ms（VIDEO_SYNC_TOLERANCE_MS_TENTATIVE），
//   ROUND-11 正式追认为阶段 1 合格线。
//
// T0 验收结论（ROUND-11）：双分辨率实测偏差
//   16.87ms / 16.53ms，均远低于 100ms 容差，T0 人工
//   验收正式通过；不触发 FFmpeg 升级路径，无需移动端复测。
//
// 测试内部命名（测试专用，不进入游戏名库面）：
//   EquallySpacedChart / SyncTestNote / SyncTestTarget /
//   SyncSample / ResolutionDetail / detectBrightPixelCount /
//   runOneResolution 等，均经 ROUND-11 追认冻结。
// ============================================================

// ------------------------------------------------------------
// 板块零：测试常量（仅本脚本使用；本轮未授权 constants/，
// 故不写入集中常量文件）
// ------------------------------------------------------------

/** 音画同步容差（毫秒），HANDOFF-ROUND-10 暂定 100ms */
export const VIDEO_SYNC_TOLERANCE_MS_TENTATIVE = 100;

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
}
type VideoFrameRequestCallbackLike = (
  nowMs: number,
  metadata: VideoFrameCallbackMetadataLike,
) => void;
interface RequestVideoFrameCallbackCapable {
  requestVideoFrameCallback(cb: VideoFrameRequestCallbackLike): number;
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
  video.src = target.videoUrl;
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.controls = false;
  document.body.appendChild(video);

  const canvas = document.createElement('canvas');
  canvas.width = DETECT_CANVAS_WIDTH;
  canvas.height = DETECT_CANVAS_HEIGHT;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('VideoSyncTest：无法取得 2d canvas 上下文');
  }

  await new Promise<void>((resolve, reject) => {
    video.addEventListener('loadeddata', () => resolve(), { once: true });
    video.addEventListener('error', () => reject(new Error('视频加载失败：' + target.videoUrl)), { once: true });
  });

  const samples: SyncSample[] = [];
  let anchorWallMs: number | null = null;
  let anchorMediaMs = 0;
  let markerPresent = false;

  const callbackCapable = video as unknown as RequestVideoFrameCallbackCapable;

  await new Promise<void>((resolve, reject) => {
    video.addEventListener('ended', () => resolve(), { once: true });
    video.addEventListener('error', () => reject(new Error('播放失败：' + target.videoUrl)), { once: true });

    const onFrame: VideoFrameRequestCallbackLike = (nowMs, metadata) => {
      if (anchorWallMs === null) {
        anchorWallMs = nowMs;
        anchorMediaMs = metadata.mediaTime * 1000;
      }

      context.drawImage(video, 0, 0, DETECT_CANVAS_WIDTH, DETECT_CANVAS_HEIGHT);
      const brightCount = detectBrightPixelCount(context);
      const markerNowPresent = brightCount >= BRIGHT_PIXEL_COUNT_THRESHOLD;

      // 判定圈上升沿：上一帧无、本帧有
      if (markerNowPresent && !markerPresent) {
        const noteIndex = samples.length;
        const expectedMs = chart.notes[noteIndex]?.timeMs;
        if (expectedMs !== undefined) {
          const presentedMediaMs = metadata.mediaTime * 1000;
          const wallDriftMs =
            nowMs - (anchorWallMs ?? nowMs) - (expectedMs - anchorMediaMs);
          samples.push({ expectedMs, presentedMediaMs, wallDriftMs });
        }
      }
      markerPresent = markerNowPresent;

      callbackCapable.requestVideoFrameCallback(onFrame);
    };

    callbackCapable.requestVideoFrameCallback(onFrame);
    void video.play().catch((error: unknown) => reject(error as Error));
  });

  document.body.removeChild(video);

  if (samples.length === 0) {
    throw new Error('VideoSyncTest：未检出任何判定圈（' + target.resolution + '）');
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
 * 判定某分辨率结果是否超出暂定容差（100ms）
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
