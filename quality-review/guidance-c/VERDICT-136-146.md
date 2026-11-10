# 第 28 批 C 步正式裁定书

依据：本轮用户 PROTOCOL 明确采纳并授权继续实现。以下裁定已生效，不再要求二次确认。两条线是设计目标，不是数据硬上限。

| 裁定 | 冻结内容 |
| --- | --- |
| VERDICT-136 | 所有线共享现有 AudioOutputClock；媒体为同一视频，不建立每线时钟。 |
| VERDICT-137 | 所有线共享 KeyboardPadLayout；layoutVersion 保持 GuidanceChart 层。 |
| VERDICT-138 | 单消费仅限制 Tap。新非 Space Down 按绝对时间差 → 目标时间 → 线 ID → 节点 ID 最多命中一个 Tap。物理按住状态向所有线广播；Drag 到达、Hold 起点/尾端独立检查，可共享同一按住键而同时成功。Up 全线广播；Hold 尾端同刻 Up 有效、Drag 到达同刻 Up 无效、暂停释放锁定 Hold 中断。保留当前工程已经实施的目标本键及第一层直接接触邻键容错。 |
| VERDICT-139 | Head 窗口重叠不合并；一个新 Space Down 按生成时间 → 线 ID → Head ID 最多启动一条。生成前按住及重复 Down 不启动；必须先释放再按下。 |
| VERDICT-140 | 每线独立 startedAtMs、路径、速度与节点状态。 |
| VERDICT-141 | 每线按自身路径进度独立擦除；视觉交叉、重叠不影响判定与其他线的擦除。 |
| VERDICT-142 | 单线 Head 超时只终止该线，所属未决节点各记一次 Miss；不复活、不影响另一线。 |
| VERDICT-143 | 所有线全部普通节点有最终 Perfect/Good/Miss 且媒体结束才 Completed。超时线全部已决，满足该线的结算要求。保留现有 R26/A/B 媒体异常不可用的独立超时兜底，暂停不积累该超时。Head 不计分。 |
| VERDICT-144 | schemaVersion 为 1 \| 2。v1 恰一条线；v2 至少一条，无硬上限。线与节点 ID 在谱面内唯一，严格校验并深冻结。 |
| VERDICT-145 | 不增加专门性能优化；各线独立只读快照。逻辑零 cc，presentation 不写 chart，director 唯一写账本。 |
| VERDICT-146 | 验收覆盖版本解析、两线并行/独立启动、正常与超时共存、重叠交织、输入冲突、共同暂停恢复重入、两档分辨率判定一致、三门禁、真实 Cocos 预览及完整链路。不实现编辑器。 |

## 新命名冻结表

| 名称 | 层 | 状态 | 职责 |
| --- | --- | --- | --- |
| GuidanceChartRuntime | chart | 本轮 PROTOCOL 正式追认 | 多线协调、Tap/Head 仲裁、边沿与生命周期广播、结算汇总。 |
| getGuidanceSnapshots | chart 只读接口 | 本轮 PROTOCOL 正式追认 | 返回冻结的所有线快照数组；旧 ChartData 返回空数组。 |
| getGuidanceSnapshot | chart 只读接口 | 既有冻结，保留兼容 | 返回第一条线快照或 null；正式多线视觉使用复数接口。 |
| GuidanceLineRuntime / GuidanceLineSnapshot | chart | 复用 | 单线语义及独立状态快照。 |

其余新增技术成员见新增命名清单.json，提交 PROTOCOL 追认；没有修改名库。

## 多线数据结构

```ts
interface GuidanceChart {
  readonly schemaVersion: 1 | 2;
  readonly chartId: string;
  readonly tier: ChartTier;
  readonly layoutVersion: string;
  readonly aspectRatio: number;
  readonly lines: readonly GuidanceLine[];
}
interface GuidanceLine {
  readonly id: string;
  readonly head: HeadNode;
  readonly path: NodePath;
  readonly speed: number;
  readonly nodes: readonly GuidanceNode[];
}
```

HeadNode / TapNode / DragNode / HoldNode 数据字段不变，不增加每线时钟或布局。节点按弧长与 ID 规范排序，ID 全谱面唯一；输入复制后深冻结。v2 接受第三条线，验收核心为两条同时运行。

## 输入路由与完成条件

路由先验证输入身份及非倒退的媒体时间，在所有线只读候选中选择一个 Tap 与一个 Head 候选；随后向每线广播同一边沿，只有胜出的线拥有相应边沿消费资格。单线内部仍保持 B 步“严格早于边沿的事件 → 边沿 → 同时刻事件”的处理顺序。Up 与按住状态不参与 Tap 单消费限制。

判断 Completed 使用所有线的节点最终结算状态，不要求所有线的 state 都是 Finished。未到生成时间的线仍有未决节点，媒体提前结束不能绕过它们；Head 超时产生的 Miss 已是最终结算。完成与退出仍经现有 director 唯一写账本，独立线完成不写账本。

## C 步最小交付与模块关系

最小交付包含版本化解析、多线协调器、单消费仲裁、独立视觉/擦除、独立超时、统一完成条件、共同冻结/恢复/复位、两分辨率回归、真实预览和完整输入至账本链路证据。

| A/B 模块 | C 步关系 |
| --- | --- |
| GuidanceChart / parseGuidanceChart | 扩展 v1/v2，保留所有节点与 Polyline 校验。 |
| GuidanceLineRuntime | 复用单线状态机，增加按线 ID 选择、只读 Tap 候选及仲裁资格；仍负责 Drag/Hold 精确边界。 |
| GuidanceChartRuntime | 新增多线协调，不另建媒体生命周期。 |
| ChartPremiere / ChartScore | ChartPremiere 汇总所有线节点；ChartScore 原样复用，Head 不计分，每普通节点最终判定计一次。 |
| ChartPlaybackState | 原样保留公共 Playing/Paused/Completed/Exited 等状态。 |
| ChartPadView / LineEraseEffect | 打击垫与容器布局复用；LineEraseEffect 遍历复数快照，Head Sprite 按线 ID 独立，绘制各自裁剪路径与节点。 |
| AudioOutputClock / KeyboardPadLayout | 原样复用；两档分辨率使用相同逻辑坐标、弧长与媒体时间。 |
| SceneBuilder | 默认引导谱面资源切换为独立 guidance_c；沿用媒体、暂停、异常时钟与资源回收接线。 |
| director / ledger | 原样复用；完整谱面只追加一次，中途退出不写完整演奏记录。 |
| ChartData / Note | 旧谱面兼容不变；单线快照兼容入口保留。 |
