# B1 正式裁定书 · VERDICT-196～200

日期：2026-10-10。适用范围：《雨若》阶段 1，编辑器 v3 谱面接入既有深痕游戏入口。本文件为交付证据；不改写 docs、NAMEBOOK 或参照文件。

| 编号 | 正式裁定 |
| --- | --- |
| VERDICT-196 | 谱面选择采用 SceneBuilder Inspector 字段 `ChartResourcePath`，默认 `chart/guidance_c`。字段表示相对 `assets/resources/` 的无扩展名资源路径，须在 `chart/` 下，允许字母、数字、下划线、连字符及子目录。世界组合根创建新的 SceneBuilder 时复制该值；本轮保持 `UseGuidanceChart` 开关。世界文件夹只负责进入世界，不增加谱面列表；ChartRegistry、ChartCatalog 不在 B1 中引入。 |
| VERDICT-197 | 编辑器导出与运行时资源保持分离。沿用既有“导出玩法 + 颜色 JSON”及“选择导出文件夹”：默认交接目录为 `编辑器/导出/引导线/`，将 `{chartId}.json` 和可选 `{chartId}.visual.json` 成对复制到 `assets/resources/chart/`。支持文件夹选择的浏览器也可由用户明确选择该游戏目录，复用原功能。编辑器不推断项目绝对路径，不新增“导出到游戏”选项或 EditorExportTarget；编辑器核心、草稿与导出数据结构不变。复制后须完成 Creator 资源刷新/导入，再启动预览。 |
| VERDICT-198 | SceneBuilder 组合根沿用 `resources.load` 和 `parseGuidanceChart` 资源边界，加载 v1/v2/v3 后传入已有 ChartPremiere；ChartPremiere 不承担路径或文件系统读取。主谱面缺失、路径非法或数据非法时明确拒绝加载，不以另一张引导线谱面回退。可选颜色资源路径为 `ChartResourcePath + '.visual'`；先查询资源元数据，缺失时直接使用默认颜色。存在时通过既有 `parseGuidanceVisualData` 严格校验 schema、chartId、nodeId、重复节点与 8 位 RGB；读取失败或校验失败仅降级表现。颜色经 ChartPadView 缓存、转发至 LineEraseEffect，绝不进入首演判定或账本。无需 ChartResourceLoader 接口。 |
| VERDICT-199 | v3 游戏演奏复用现有 director 的结算与 NarrativeEvent：全部判定对象已决且媒体结束才完成，媒体异常使用原独立超时兜底；director 同帧恰好追加一条带真实 ChartRef 的完整演奏事件并恢复世界。事件向量、输入来源、章节标记及时间字段沿用原契约，和分数无关。深痕解谜事件与完整演奏事件分别计数，以进入谱面前的 T6 账本为基线验收 +1。中途退出不新增完整演奏事件，重入不重复 T6；完整首演完成后维持既有防重语义。编辑器预览仍独立、零游戏账本。 |
| VERDICT-200 | 沿用现行 AC-20/21 的 v3 补充条款，不新增重复 AC 编号。本轮使用 B1-01～B1-11 与 R01～R12 作为证据标签，覆盖编辑器导出、资源选择、颜色降级、完成恰好 +1、退出重入、隔离、兼容和时序。两档真实 Creator 预览应核验 1920×1080 / 2560×1440 的相同导出字节、节点/得分/完成结果、账本增量、媒体同步和原始截图。三条门禁独立运行。 |

架构边界：逻辑层继续零 cc；表现层只以 type 导入 GuidanceVisualData。运行时颜色解析器的值导入位于 assets/scripts 组合根，未新增逻辑模块或依赖矩阵边。未发现需要停止实施的架构冲突，因此不提交阻断 PROTOCOL。

媒体范围：v3 玩法 JSON 不携带编辑器草稿的媒体路径。B1 保留现有 `video/chart_video_placeholder`，闭环样本与该 12 秒媒体匹配。任意外部音视频的资源选择和打包属于后续独立工作，不通过修改 A/B/C 或 v3 结构隐式实现。
