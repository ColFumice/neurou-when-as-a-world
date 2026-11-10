// ============================================================
// P 表现层 · TrailRenderer 拖尾渲染组件（T3 拖尾 / AC-07 / AC-08）
// 名库 v1.9：行 51 颜色体系冻结 `TrailRender`（不含 -er 后缀）；
//            HANDOFF-ROUND-14 明示文件 `src/presentation/TrailRenderer.ts`
//            与组件类型 `TrailRenderer`（与名库 TrailRender 不一致，
//            列入待追认事项，请 PROTOCOL 裁定是否更新名库）。
//
// 关联冻结名：TrailLength（character 域，逻辑拖尾长度，行 51）
//             Protagonist（character 域，主角状态承载类，VERDICT-096）
//             MoveSpeed（character 域，速度承载类型，行 51）
//             WorldMeter（world 域，全游戏唯一距离单位）
//
// HANDOFF-ROUND-14 明示：
//   - 文件路径：src/presentation/TrailRenderer.ts
//   - 组件类型：TrailRenderer（Cocos 组件）
//   - 读取 Protagonist 移动速度，调用 calculateTrailLength 获取
//     逻辑拖尾长度（经 Protagonist.getTrailLength 间接消费，
//     避免违反 presentation → character R 边值导入禁令）；
//   - 拖尾颜色使用固定占位色 #FFFFFF，不得读取感绪值或
//     渲染过渡色（AC-08）；
//   - 拖尾长度上限等视觉参数放 TrailRenderer 内部，
//     绝对不准放进 constants。
//
// 实现选择（HANDOFF 明示"使用 Cocos 的 MotionStreak 或 Graphics"）：
//   未补 cc.d.ts 中 MotionStreak / Graphics 桩（避免触碰未授权文件），
//   改用 MeshRenderer + 一组小立方体子节点模拟拖尾段（与 SceneBuilder
//   灰盒方案一致；所引用的 cc 类型均已桩）。列入偏差栏待追认。
//
// 职责：
//   - 每帧读取主角位置，推入位置历史队列；
//   - 调用 protagonist.getTrailLength() 获取逻辑拖尾长度；
//   - 静止检测（位置 delta < EPSILON）→ 视觉裁剪为 0（拖尾收拢）；
//   - 应用表现侧视觉上限裁剪（MAX_TRAIL_LENGTH_WM）；
//   - 按可视段数把段节点对齐到历史位置，沿队列尾部缩放衰减；
//   - 段节点固定白色 #FFFFFF（PLACEHOLDER_TRAIL_COLOR）。
//
// 边界：
//   ✗ 不读感绪值 / 不实现颜色映射 / 不做网络同步
//     （HANDOFF-14 禁感绪系统；AC-08 占位色固定不变）
//   ✗ 不修改 Protagonist 内部状态（INV-3 表现层只读）
//   ✗ 不另建拖尾长度公式（消费 calculateTrailLength 即可）
//
// 依赖矩阵（stage-1.md §6）：
//   presentation → constants A（无；本轮无新增 constants 引用）
//   presentation → character R（Protagonist 类型只读；
//                  通过 protagonist.getTrailLength() 间接消费
//                  character.calculateTrailLength，避免值导入违规）
//   presentation → presentation 自身（FrameRefreshable）
// ============================================================

import {
  _decorator,
  Component,
  Node,
  Vec3,
  MeshRenderer,
  Material,
  Color,
  utils,
  primitives,
} from 'cc';
import type { Protagonist } from '../character/Protagonist';
import type { TrailLength } from '../character/TrailLength';
import type { FrameRefreshable } from './FrameDriver';

const { ccclass, property } = _decorator;

// ------------------------------------------------------------
// 视觉参数（HANDOFF-14 明令：放 TrailRenderer 内部，
// 绝对不准放进 constants；以下常量均为表现侧占位数值）
// ------------------------------------------------------------

/** 拖尾段节点数量上限（一段对应一帧位置；视觉占位） */
const TRAIL_SEGMENT_COUNT = 32;

/** 拖尾段间距（WorldMeter；视觉占位，决定拖尾"密度"——
 * 间距小于段尺寸时段相互重叠，拖尾看起来连续） */
const TRAIL_SEGMENT_SPACING_WM = 0.2;

/** 拖尾段边长（WorldMeter；与主角 1.0 立方体同尺寸，
 * 让拖尾看起来像一串主角残影） */
const TRAIL_SEGMENT_SIZE = 1.0;

/** 拖尾长度上限（WorldMeter；HANDOFF-14 明令视觉参数） */
const MAX_TRAIL_LENGTH_WM: TrailLength = 6;

/** 拖尾增长速度（WorldMeter/秒；移动时按此速度拉伸拖尾，
 * 6 WM 上限需 0.3 秒拉满，呈现"拉伸"感而非瞬时出现） */
const TRAIL_GROW_RATE_WM_PER_SECOND = 30;

/** 拖尾收回速度（WorldMeter/秒；静止时按此速度收拢，
 * 6 WM 收回需 0.5 秒，呈现"渐变消失"而非瞬时归零） */
const TRAIL_DECAY_RATE_WM_PER_SECOND = 12;

/** 静止判定阈值（WorldMeter/帧；位置 delta 小于该值视为静止） */
const STATIONARY_EPSILON_WM = 0.0005;

/** 占位拖尾色（白色 #FFFFFF；AC-08：固定不变，不读感绪值） */
const PLACEHOLDER_TRAIL_COLOR = new Color(255, 255, 255, 255);

/**
 * TrailRenderer 拖尾渲染组件（HANDOFF-14 明示类型名）
 *
 * 阶段 1 承载：
 *   - AC-07：拖尾长度随移动速度增加只增不减；静止时拖尾收拢；
 *   - AC-08：拖尾颜色固定占位色（白色），任何逻辑不读取渲染色。
 *
 * 调用约定：
 *   由 SceneBuilder 在 Protagonist 节点上挂载，并通过
 *   bindSource 注入 Protagonist 实例；FrameDriver 把本组件
 *   加入 refreshables 列表，每帧第 ③ 步回调 onFrameRefresh。
 */
@ccclass('TrailRenderer')
export class TrailRenderer extends Component implements FrameRefreshable {
  /** 主角实例（R 边：类型只读；运行时由 bindSource 注入） */
  private protagonist: Protagonist | null = null;

  /** 拖尾段节点列表（onLoad 时一次性创建） */
  private readonly trailSegments: Node[] = [];

  /** 主角位置历史（FIFO 队列，最新在前；最多 TRAIL_SEGMENT_COUNT 项） */
  private readonly positionHistory: Vec3[] = [];

  /** 上一帧主角位置（用于计算位置 delta 做静止检测） */
  private lastPosition: Vec3 | null = null;

  /**
   * 当前显示拖尾长度（WorldMeter；带状态，按增长/收回速度
   * 朝目标值过渡，不瞬时跳变）。
   * 移动时朝逻辑拖尾长度上限（应用视觉 cap 后）按
   * TRAIL_GROW_RATE_WM_PER_SECOND 增长；静止时按
   * TRAIL_DECAY_RATE_WM_PER_SECOND 衰减至 0。
   */
  private currentTrailLength: TrailLength = 0;

  /** 上一帧时间戳（毫秒；用 Date.now() 计算 deltaTime，
   * 因 FrameRefreshable.onFrameRefresh 接口未传 deltaTime，
   * 避免修改接口影响其他 refreshables） */
  private lastTimeMs: number | null = null;

  /**
   * 跟随节点（@property；引擎导入后由编辑器拖拽赋值。
   * 灰盒占位：若未拖拽，回退使用 this.node 自身——即主角节点）。
   * 直译方法/字段名（followNode）已在前轮 ProtagonistView 中
   * 落盘并列入待追认，本文件沿用同一命名。
   */
  @property({ type: Node })
  followNode: Node | null = null;

  /**
   * 接线只读数据源（方法名直译，待追认；与 ProtagonistView.bindSource
   * 同一命名）。
   *
   * @param protagonist 主角实例（仅读取 getPosition / getTrailLength）
   */
  bindSource(protagonist: Protagonist): void {
    this.protagonist = protagonist;
  }

  /**
   * Cocos 生命周期：加载时一次性创建拖尾段节点池。
   *
   * 段节点为本组件所在节点的子节点；继承父节点 layer 以保证
   * 3D 相机可见（与 SceneBuilder.addBox 同一口径）。
   * 初始全部 scale=0 隐藏（速度=0 → 拖尾收拢）。
   */
  onLoad(): void {
    this.buildTrailSegments();
  }

  /**
   * 一次性创建拖尾段节点池（灰盒：每个段为小立方体 + unlit 材质）。
   */
  private buildTrailSegments(): void {
    const parentLayer = this.node.layer;
    for (let i = 0; i < TRAIL_SEGMENT_COUNT; i++) {
      const seg = new Node('TrailSegment' + i);
      this.node.addChild(seg);
      seg.layer = parentLayer;

      const meshRenderer = seg.addComponent(MeshRenderer);
      const mesh = utils.MeshUtils.createMesh(
        primitives.box({
          width: TRAIL_SEGMENT_SIZE,
          height: TRAIL_SEGMENT_SIZE,
          length: TRAIL_SEGMENT_SIZE,
        }),
      );
      meshRenderer.mesh = mesh;

      const material = new Material();
      material.initialize({ effectName: 'builtin-unlit' });
      material.setProperty('mainColor', PLACEHOLDER_TRAIL_COLOR);
      meshRenderer.material = material;

      // 初始隐藏（scale=0；速度=0 → 拖尾收拢）
      seg.setScale(0, 0, 0);
      this.trailSegments.push(seg);
    }
  }

  /**
   * FrameDriver 第 ③ 步回调：读取主角最新位置与逻辑拖尾长度，
   * 推进位置历史队列，并对齐段节点（INV-3 表现层只读——
   * 不修改 Protagonist 内部状态）。
   *
   * 拖尾长度过渡（AC-07"静止时拖尾收拢"，按收回速度渐变）：
   *   calculateTrailLength 内部已在速度=0 时返回 0；但本工程
   *   Protagonist.speed 字段为 MAX_MOVE_SPEED 常量（非实际速度），
   *   故 protagonist.getTrailLength() 始终返回 calculateTrailLength(MAX)。
   *   为满足"静止时拖尾收拢"，本组件以位置 delta 做静止
   *   判定：delta < STATIONARY_EPSILON_WM 视为静止，目标长度=0；
   *   否则目标长度 = applyVisualCap(getTrailLength())。
   *   currentTrailLength 按增长/收回速度朝目标值过渡——
   *   移动时拉伸（不瞬时出现），静止时渐变收拢（不瞬时消失）。
   *
   *   该静止判定属表现侧只读观测（不写 protagonist 状态），
   *   列入偏差栏待 PROTOCOL 裁定是否改由逻辑侧承载。
   */
  onFrameRefresh(): void {
    if (this.protagonist === null) {
      return;
    }

    // —— 0. 计算 deltaTime（FrameRefreshable 接口未传，用
    //        Date.now() 自行计算，避免改接口影响其他 refreshables） ——
    const nowMs = Date.now();
    const deltaTimeSeconds =
      this.lastTimeMs !== null ? (nowMs - this.lastTimeMs) / 1000 : 0;
    this.lastTimeMs = nowMs;

    // —— 1. 读取主角当前位置（3D：含 vertical，跟随主角真实 Y 轴）——
    const position = this.protagonist.getPosition();
    const currentPos = new Vec3(position.lateral, position.vertical, position.depth);

    // —— 2. 计算位置 delta，做静止检测（3D 距离，含 Y 分量）——
    //   原地跳跃时 XZ 不变但 Y 变化，3D 距离 > 0 视为"移动"，
    //   拖尾在空中画出垂直轨迹（3D 跟随的自然结果）。
    let distanceMoved = 0;
    if (this.lastPosition !== null) {
      const dx = currentPos.x - this.lastPosition.x;
      const dy = currentPos.y - this.lastPosition.y;
      const dz = currentPos.z - this.lastPosition.z;
      distanceMoved = Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    this.lastPosition = currentPos;

    // —— 3. 计算目标拖尾长度 ——
    //   拖尾现在跟随 3D 坐标（含 Y 轴），跳跃期间不隐藏：
    //     移动（含跳跃空中位移 / 原地跳跃 Y 变化）：
    //       目标 = applyVisualCap(getTrailLength()) = MAX_TRAIL_LENGTH_WM
    //     静止（三轴均无位移）：目标 = 0（拖尾收拢）
    //   段节点位置由 positionHistory 提供，已含 Y 分量，
    //   跳跃期间段在空中沿主角真实 3D 轨迹排列。
    const logicalLength = this.protagonist.getTrailLength();
    const targetLength: TrailLength =
      distanceMoved < STATIONARY_EPSILON_WM
        ? 0
        : this.applyVisualCap(logicalLength);

    // —— 4. currentTrailLength 按速度过渡到 targetLength ——
    if (targetLength > this.currentTrailLength) {
      // 增长（按 TRAIL_GROW_RATE_WM_PER_SECOND）
      const grown = this.currentTrailLength +
        TRAIL_GROW_RATE_WM_PER_SECOND * deltaTimeSeconds;
      this.currentTrailLength = Math.min(grown, targetLength);
    } else if (targetLength < this.currentTrailLength) {
      // 衰减（按 TRAIL_DECAY_RATE_WM_PER_SECOND；不为负）
      const decayed = this.currentTrailLength -
        TRAIL_DECAY_RATE_WM_PER_SECOND * deltaTimeSeconds;
      this.currentTrailLength = Math.max(0, decayed);
    }

    // —— 5. 推入位置历史队列（FIFO） ——
    this.positionHistory.unshift(currentPos);
    if (this.positionHistory.length > TRAIL_SEGMENT_COUNT) {
      this.positionHistory.length = TRAIL_SEGMENT_COUNT;
    }

    // —— 6. 计算可视段数（按当前过渡长度与段间距） ——
    const visibleCount = this.currentTrailLength > 0
      ? Math.min(
          TRAIL_SEGMENT_COUNT,
          this.positionHistory.length,
          Math.ceil(this.currentTrailLength / TRAIL_SEGMENT_SPACING_WM),
        )
      : 0;

    // —— 7. 对齐段节点：可见段沿队列排列，统一尺寸（与主角
    //        方块同尺寸，让拖尾像一串主角残影）；不可见段
    //        缩放归零（灰盒"隐藏"） ——
    for (let i = 0; i < TRAIL_SEGMENT_COUNT; i++) {
      const seg = this.trailSegments[i];
      if (i < visibleCount) {
        const p = this.positionHistory[i];
        seg.setPosition(p.x, p.y, p.z);
        seg.setScale(TRAIL_SEGMENT_SIZE, TRAIL_SEGMENT_SIZE, TRAIL_SEGMENT_SIZE);
      } else {
        seg.setScale(0, 0, 0);
      }
    }
  }

  /**
   * 表现侧视觉上限裁剪（HANDOFF-14 明令视觉参数放 TrailRenderer 内部）。
   */
  private applyVisualCap(trailLength: TrailLength): TrailLength {
    if (trailLength > MAX_TRAIL_LENGTH_WM) {
      return MAX_TRAIL_LENGTH_WM;
    }
    return trailLength;
  }
}
