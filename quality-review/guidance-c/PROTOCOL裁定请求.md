# 第 28 批 C 步：多线输入规则消歧请求

状态：已由后续用户 PROTOCOL 明确采纳方案一并解除阻断，C 步已完成。正式生效内容见 VERDICT-136-146.md，完整实现与验收见交付报告.md。以下保留首次停止时的请求记录，不作为当前阻断。

## 冲突证据

- docs/NAMEBOOK.md:471：Drag 在判定点到达时独立检查绑定键按住状态。
- docs/NAMEBOOK.md:472：Hold 起点检查按住状态，持续到尾端。
- docs/NAMEBOOK.md:475：单次输入最多消费一个普通节点；多候选按时间差、目标时间、引导线 ID、节点 ID 排序。
- GuidanceNode 联合包括 Tap、Drag、Hold，没有把“普通节点”限定为 Tap。
- src/chart/GuidanceLineRuntime.ts:144：现有 B 实现明确“一次新的 Down 只消费一个 Tap；Drag/Hold 按到达时间自主检查按住状态”。同时间 Down 先更新按住集合，再处理到达事件。

## 最小反例

两条线均已启动，各有绑定 KeyA 的 Drag，目标时间均为 2000ms。此前 KeyA 未按住，用户恰在 2000ms 发出一次 KeyA Down。

独立检查规则要求两个 Drag 都 Perfect；普通节点单消费规则要求最多一个节点被该次输入消费。若强制选择一条线，另一条 Drag 必须被压制，与“到达时独立检查按住状态”冲突。Tap 与另一条线的 Drag 同刻也存在同类歧义。Hold 的起点资格同样需要明确是否参与仲裁。

## 建议 PROTOCOL 裁定

建议将单消费约束明确限定为 **Down 边沿路由的 Tap**：

1. 一个新的非 Space Down 最多命中一个 Tap，按绝对时间差 → 目标时间 → 线 ID → 节点 ID 排序，保留现有冻结排序中的目标时间，不能直接删掉。
2. 一个新的 Space Down 最多启动一个 Head，按生成时间 → 线 ID → Head ID 排序。
3. 物理按住状态向所有线广播；Drag 到达、Hold 起点和尾端独立检查。允许两条线共享同一按住键而同时成功；它们不属于 Down 单消费仲裁。
4. Up 向所有线广播；保留 B 步 Hold 恰在尾端松开有效、Drag 恰在到达时松开无效，以及暂停释放锁定 Hold 中断的规则。

另一方案是坚持所有普通节点互斥，但必须另行规定 Drag/Hold 的资格占用、同刻优先级及持续期冲突，属于修改已冻结节点语义，不建议隐式实施。

## 其余裁定准备（未生效）

| 编号 | 建议 |
| --- | --- |
| VERDICT-136 | 所有线复用同一 AudioOutputClock。 |
| VERDICT-137 | 共用 KeyboardPadLayout，layoutVersion 保持 chart 层。 |
| VERDICT-138 | 待上述输入消歧；保留完整四级 Tap 排序。 |
| VERDICT-139 | 重叠 Head 窗口不合并，一次新的 Space 只启动一条。 |
| VERDICT-140 | 每线独立 startedAtMs。 |
| VERDICT-141 | 每线按自身路径进度擦除；视觉交叉不影响逻辑。 |
| VERDICT-142 | Head 超时仅终止所属线，其全部未决节点一次性记 Miss。 |
| VERDICT-143 | 所有线全部节点最终已决且媒体结束才 Completed；保留 A/B 已有媒体异常超时兜底。超时线已决可参与整体完成条件。 |
| VERDICT-144 | v1 仅单线；v2 非空多线，两条为设计及验收目标，允许更多。将 v2 硬限制为 1~2 与本轮“软性上限、允许更多”不符。 |
| VERDICT-145 | 不增加渲染优化；各线独立快照和视觉，不让 presentation 写 chart。 |
| VERDICT-146 | 覆盖并行、独立启动、单线超时、交织、输入冲突、暂停恢复重入、两档分辨率、三门禁及真实 Cocos 预览。 |

数据草案：保留 GuidanceChart 的 chartId、tier、layoutVersion、aspectRatio、lines；schemaVersion 类型拟改为 1 | 2。GuidanceLine 和节点字段不变，ID 在谱面内唯一，解析后深冻结。v1 必须恰有一条线，v2 至少一条；不增加每线时钟或布局字段。

命名冻结候选：GuidanceChartRuntime（chart，多线协调器）、getGuidanceSnapshots（只读多线快照接口）；其余优先复用现有命名。以上是待追认候选，没有修改名库。

模块关系：GuidanceLineRuntime 保留单线节点语义；多线协调器负责 Tap/Head 仲裁及生命周期广播；ChartPremiere 汇总计分与完成，保留单线快照兼容入口；ChartPadView / LineEraseEffect 消费多线只读快照；AudioOutputClock 和 KeyboardPadLayout 复用；director 继续作为唯一账本写入者。

C 步最小交付：版本化多线解析、协调器、输入仲裁、多线视觉、独立超时和统一完成、生命周期广播、双分辨率回归及完整链路验证。验收逐项采用本轮 11 项，不实现编辑器。

## 本次交付边界

只新增本请求文件；未修改 docs、名库、参照文件或 A/B 代码。没有新增代码 diff、门禁运行结果、Cocos 截图或完成验收证据，不能将本请求视为 C 步交付。
