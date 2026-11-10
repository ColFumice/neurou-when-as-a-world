# B 步前置裁定请求

状态：已由后续用户 PROTOCOL 裁定解除阻断并完成 B 步实现。裁定采用方案一：接受 Polyline 折线，转折必须对应 Tap 或 Hold 起点，仍拒绝曲线与多线。Head 正式确认为 1000ms。以下保留实现前的请求记录，最终交付见 [交付报告](D:/Project/A_New_Begin/Neurou_official/quality-review/guidance-b/交付报告.md)。

## 已核对的前置状态

- docs 路径已修正为 `docs/NAMEBOOK.md`。
- [名库 v2.7 附录](D:/Project/A_New_Begin/Neurou_official/docs/NAMEBOOK.md:494) 已包含 A 步实现追认。
- Head 窗口继续使用前轮用户明确授权的 1000 ms；[现有常量](D:/Project/A_New_Begin/Neurou_official/constants/index.ts:235) 已生效。名库和 stage-1 仍记载 100 ms，仅作为待 PROTOCOL/Trae 同步事项，不构成本次重复授权要求。
- docs、名库、参照文件保持只读。

## 阻断项：B 步是否允许折线路径

本次交接的解析器要求：

> 保留 A 步的严格校验：非法字段、未知类型、非直线、多线仍明确拒绝。

同一交接同时要求：

> 内部转折点对应 Tap → 通过。
>
> 内部转折点对应 Hold 起点 → 通过。
>
> 内部转折点对应 Drag → 明确拒绝。

[名库数据约束](D:/Project/A_New_Begin/Neurou_official/docs/NAMEBOOK.md:447) 明示：

> 折线内部转折点必须对应 Tap 或 Hold 起点；Drag 不得单独构成转折。
>
> 首版只接收 Polyline；未来贝塞尔路径通过版本化扩展 NodePath。

例如路径 `(0.2,0.5) → (0.5,0.5) → (0.5,0.8)` 在中点设置 Tap：按“非直线拒绝”应拒绝，按转接点验收应通过，同一资源无法同时满足两种结果。

## 提请裁定

建议明确采用方案一，但在 PROTOCOL 确认前不据此实现：

1. **B 步接受 Polyline 折线。** 各段为直线；真实内部转折必须对应 Tap 或 Hold 起点，Drag 不得单独作为转折。仍拒绝非 Polyline 路径、未知字段/类型和多线。“非直线拒绝”修正为“非 Polyline 曲线路径拒绝”。这与当前名库和 B 步转接点验收一致。
2. **B 步继续只接受两点直线。** 将转接点支持及对应正向验收移至后续步骤，其余 Tap/Drag/Hold 混合单线功能继续属于 B 步。

收到明确裁定后继续完整 B 步实现、门禁、两档 Creator 预览和验收交付。本文件仅为实现前的裁定请求，不修改冻结条文。
