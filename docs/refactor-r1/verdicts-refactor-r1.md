# verdicts-refactor-r1

裁定书：R1 重构裁定
版本：v1（R1 冻结候选）
生成：2026-10-19（Asia/Shanghai）
依据：R1 草案 v2.2 + 补丁 01；PROTOCOL 审阅结论；用户 2026-10-18 / 2026-10-19 澄清
状态：R1 冻结候选；经 PROTOCOL 审阅、Trae 落盘、三门禁通过后生效
编码：UTF-8 无 BOM
路径：docs/refactor-r1/verdicts-refactor-r1.md

---

## 0. 裁定书性质

1. 本文件是 R1 阶段全部裁定的单文件汇总（P7）。
2. 每条裁定（V-R1-001~010）都是已定结论；R2 及以后不得重新裁定。
3. 若发现裁定有方向性偏差，必须新起 `verdicts-refactor-r1.v2.md`，不能直接修改本文件。
4. 本文件与 `NAMEBOOK-v4.0.md`、`stage-4.md` 三者互为契约：名库冻结名字，stage-4 冻结行为，本文件冻结裁定理由与边界。

---

## V-R1-001 三大决策

**裁定**：

1. **服务端不留**：不运营任何 Neurou 服务端。`server/`、B2.2~B2.5c 全部废止。允许客户端直连用户自有第三方 API（CloudProvider / 天气 API），由 app/adapters 实现。
2. **事件树节点 ≠ 世界**：事件树是更高维编排；世界是独立实体；事件树节点指向世界，不内嵌世界。
3. **35 项 R1 保留清单已逐项裁定**：见交接说明第五部分；不得重裁。

**依据**：用户 2026-10-18 明确；scope-statement §2.1。

**影响**：stage-4 §1 / §4 / §5；NAMEBOOK C 类 §3.1~3.3、§3.7、§3.8。

**状态**：冻结。

---

## V-R1-002 账号、profile、导演身份

**裁定**：

1. 无账号、登录、认证、云端身份；不引入 `AccountProfile`。
2. `StudioProfile` 是本机唯一创作者身份，仅存显示名、界面语言、默认导出目录；不参与权限、归属、里程碑、账本判定。
3. 一个安装 = 一个 profile；多 profile 列 D 类。
4. 不以 `profileId` 进入任何数据 schema；项目目录本身是隔离单位。
5. `DirectorSession` 废止；`PlaySession` / `PlaySessionState` 为 B 类候选。

**依据**：用户 2026-10-19 澄清（取消账号登录）；R1 裁定第 10 项、第 35 项。

**影响**：stage-4 AC4-01；NAMEBOOK A 类 §1.16；C 类 §3.1、§3.9；D 类“多 profile”。

**状态**：冻结。

---

## V-R1-003 存储载体

**裁定**：

1. **项目即目录**：

<Project>/
project.json
event-tree.json
worlds/<worldId>/world.json
worlds/<worldId>/ledger.ndjson
worlds/<worldId>/ledger.head.json
worlds/<worldId>/charts/<chartId>.json
media/manifest.json
media/<assetId>.<ext>
drafts/

2. **事件树**：`event-tree.json` 只存 DAG（`nodes[]` / `edges[]` / `rootNodeId`）；节点只存 `worldId` 与 `entryAnchor`，不内嵌世界。
3. **20 维账本**：`ledger.ndjson`（append-only，一行一条 `NarrativeEvent`）+ `ledger.head.json`（`schemaVersion` / `eventCount` / `lastEventId` / `positionSum` / `checksum`）。
4. 唯一写入口 `appendNarrativeEvent`，只允许 director 调用；`LedgerStore` 不暴露 update / delete。
5. 损坏策略：head 与末行不一致 → 只读诊断，不自动截断、不静默重建。
6. 原子写：JSON 文档临时文件 + `fsync` + `rename`，保留一代 `.bak`；NDJSON 追加写 + `fsync`。
7. SQLite 列 D 类（节点规模上千再评估）。
8. 废止旧七项壳：`WorldState*`、`LedgerSnapshot`、`LedgerHydration`、租约 / 锁 / journal 全部 C 类。

**依据**：用户 2026-10-19 澄清；R1 裁定第 9 项、第 27 项；交接说明 8.3 第 2、3 项。

**影响**：stage-4 §4、AC4-02、AC4-03、AC4-11、AC4-12、AC4-13；NAMEBOOK A 类 §1.2；C 类 §3.7。

**状态**：冻结。

---

## V-R1-004 WorldKind

**裁定**：

1. `WorldKind` 名字保留（重定义）。
2. 取值：`Primary`（继承）+ `Secondary`（新增值，无继承标注）。
3. `Primary`：项目入口世界；全项目恰好一个，且等于 `EventTreeDAG.rootNodeId` 指向的世界。
4. `Secondary`：其余世界。
5. `WorldKind.Shore`：**废止值**，进 C 类；**不是 Secondary 的重命名源**（P2）。
6. 重构后无彼岸概念；`WorldLink` / `LinkState` / `ShoreHub*` / `Star*` / `Autopilot*` 等全部废止。

**依据**：R1 裁定第 31 项；P2；scope-statement §5.1、§5.2。

**影响**：stage-4 AC4-06；NAMEBOOK A 类 §1.4；C 类 §3.8、§3.11。

**状态**：冻结。

---

## V-R1-005 PerceptionMode 与 Rain

**裁定**：

1. `PerceptionMode` 保留三态：`Normal` / `Triggered` / `Rain`。
2. `Rain` 是独立第三态**视觉模式**（P3 撤回废止裁定）。
3. Rain 状态跟随玩家 IP 地天气（第三方 IP 定位 + 天气 API）；强度 `RainIntensity = Light / Moderate / Heavy`。
4. 视觉：低饱和 + `NoteLogoGlow`（使周围雨丝清晰可见）+ `RainTintSource`（色调由视频谱面决定）；logo 可见；视差框可见（主要用于非谱面场景）。
5. 下雨不可蓝图触发；实拍雨景可作为蓝图事件剪辑触发，但不改变 `PerceptionMode`。
6. 降级：IP 定位失败 / 天气 API 失败 / 网络不可用 → `RainModeState.degradedReason` 记录（`LocationUnavailable` / `WeatherUnavailable` / `NetworkUnavailable`）；`PerceptionMode` 仍保持 Rain，仅有效视觉降为 Normal（不回写）；不改变玩家当前感知模式选择；恢复网络后自动重试，成功回到 Rain，失败保持 Normal。
7. `CloudProvider` 保留（P26 撤回）：客户端直连用户自填 API Key；API Key 由 app/adapters 存 OS 钥匙串；不写项目文件、账本、日志；失败按 `FallbackChain` 降级到 `LocalProvider` / `TemplateProvider`。

**依据**：用户 2026-10-19 澄清 C；P3 / P26 撤回；细节 6.2。

**影响**：stage-4 AC4-36~39；NAMEBOOK A 类 §1.4、§1.15、§1.19、§1.20；C 类 §3.10。

**状态**：冻结。

---

## V-R1-006 分层判定体系

**裁定**：

1. 层数不固定；`ChartLayerIndex` 从 1 开始；编辑器可 `AddChartLayer` / `RemoveChartLayer`。
2. 第 1 层 = TopMost：空格全屏判定；固定，不可删除。
3. 第 2 层 = 8 格网格判定；固定，不可删除。
4. 第 3 层及更高层 = 全屏判定（任意区域点击）；可增删；`RemoveChartLayer` 只允许删除第 3 层及以上的空层。
5. 每层分值：`score(1) = base`；`score(n) = max(1, floor(score(n-1) × 0.5))`；向下取整 + 最低保护 1；示例 800→400→200→100→50→25→12→6→3→1→1…；增删层后重算。
6. 同一音符只属于一个 `ChartLayerIndex`；禁止跨层 Hold。
7. `ChartPadKind` 与 `ChartLayerIndex` **解耦**（方案 A）：Layer 1 用 TopMost；Layer 2 可同时有 Heavy / Light，共用 8 格判定；Layer 3+ 用 Light；分值只由 `ChartLayerIndex` 决定。
8. `GridLayer` 退场：8 格行由 `GridRow`（Top / Bottom）表达；TopMost 由 `ChartLayerIndex=1` 表达。
9. `ChartKeyId` 是逻辑键身份；`GridCellId` 是格位身份；不引入 `GridKeyId` / `GridPadKind`（P1）。

**依据**：用户 2026-10-19 澄清 A；P1；细节 6.1。

**影响**：stage-4 AC4-14、AC4-16、AC4-17、AC4-30、AC4-40；NAMEBOOK A 类 §1.8、§1.9；C 类 §3.0。

**状态**：冻结。

---

## V-R1-007 Logo、动态网格、Hold

**裁定**：

1. `NoteLogoGuide` 仅用于 `ChartLayerIndex ≤ 2`（Layer 1 与 Layer 2）；Layer 3+ 不生成 Logo。
2. Logo 提前 `NoteLogoLeadTimeMs` 出现；存活 `NoteLogoLifetimeMs`；Hold 延长 `NoteLogoHoldExtensionMs`；Miss 触发 `NoteLogoMiss`。
3. `DynamicGridScale` 是 **per-cell** 放大状态：点击某格成功 → 该格 1.5；点击到该格放大后矩形之外 → 恢复 1.0；每格独立维护；放大不改变 cell → key 映射与判定窗口。
4. `GridLineVisibility`：默认 `Concealed`；点击该格成功 → 该格 `Revealed` 并随 `DynamicGridScale` 放大；恢复 1.0 → `Concealed`。
5. Hold 越界：`HoldGridOverflow` / `SpaceHoldOverflow` 终止当前段，必须重新按下才能续接；越界时刻 = 对应区域新键需按下时刻；越界后未按 → Miss；按对 → 续接；按错 → Miss 并终止当前段；越界只影响 Hold 段，不改变 `DynamicGridScale`。
6. `BlindMode` 隐藏视觉引导（含 `NoteLogoGuide` 与网格线），判定窗口不变。

**依据**：用户 2026-10-19 澄清 5（8 格 / Logo / 动态网格 / 长按）；补丁 01；v2.2 修正 1、2。

**影响**：stage-4 AC4-18、AC4-31、AC4-32、AC4-33；NAMEBOOK A 类 §1.8、§1.9。

**状态**：冻结。

---

## V-R1-008 随机

**裁定**：

1. `RandomPreviewMode = Seeded / Live`；`RandomSeed` 为种子类型。
2. 编辑预览：`Seeded`；同种子 + 同输入 + 同时间轴 → 同结果；随机放置、AI 关键帧生成、随机动作均使用该种子。
3. 运行时试玩：`Live`；使用 OS CSPRNG，真随机，不可复现。
4. `RandomAction` 读取 `RandomPreviewMode`；预览传种子，运行时不传。
5. 已写入账本的结果在重放 / 读取时不重算；随机只影响当场生成。
6. `DelayAction` 按时间轴；`LoopAction` 有上限并产生 `CycleWarning`。

**依据**：用户 2026-10-19 澄清 B；P4；细节 6.1。

**影响**：stage-4 AC4-21、AC4-22、AC4-41；NAMEBOOK A 类 §1.11。

**状态**：冻结。

---

## V-R1-009 AI 双模式

**裁定**：

1. `AIProviderMode = Local / Cloud`；`AIProviderSettings` 保存 `mode` / `endpoint` / `model` / `keyRef` / `timeout` / `fallback`。
2. `CloudProvider` 保留（P26 撤回）：客户端直连用户自填 API Key；API Key 由 app/adapters 存 OS 钥匙串；不写项目文件、账本、日志。
3. `CloudProvider` 通过注入的 `AIHttpPort`（B 类）发请求；ai 模块保持纯逻辑。
4. 失败时按 `FallbackChain` 降级到 `LocalProvider` / `TemplateProvider`。
5. AI 输出只作建议，不得直接写账本；账本仍只由 director 追加。
6. 五个 AI 任务统一 `Task` 后缀：`ParallaxExtractionTask` / `NarrativeVectorTask` / `RhythmGenerationTask` / `SceneVisionTask` / `SubtitleGenerationTask`（P5）。

**依据**：用户 2026-10-19 澄清（AI 本地 / API 双选项）；P5；P26 撤回。

**影响**：stage-4 AC4-26、AC4-35；NAMEBOOK A 类 §1.15、§1.20；B 类 `AIHttpPort` / `AIKeyStorePort` / `AITaskRequest` / `AITaskResult` / `AITaskKind`。

**状态**：冻结。

---

## V-R1-010 命名空间冻结

**裁定**：

1. A 类 271 项全量冻结（P6）；v2 名义追加 60 项（净增 51）+ cmp 细拆 9 项 = 较 v1 净增 60。
2. **双图分工**（P4）：`EventGraph` 是世界内动作蓝图；`EventTreeDAG` 是项目级世界编排；两者不得互相替代。
3. **Strike 分工**（P8）：`Strike` 归 director（`PlayerIntent` 载荷：`timeMs` + `chartKeyId` / `gridCellId`）；`GridStrike` 归 trace（8 格判定结果，只含数值与判定枚举，不 import chart，不引用 Strike）；二者不得互相引用。
4. **退场记录**（C.0）：
- `GridKeyId` / `GridPadKind`：P1 不引入，统一 `ChartKeyId` / `GridCellId` / `ChartPadKind`。
- `GridLayer`：与 `ChartLayer` / `GridRow` 重叠，退场；TopMost 由 `ChartLayerIndex=1` 表达。
- `FrameSaturation`：由 `VisualFrameSaturation` + `GlobalSaturation` 取代。
- `WorldFileHighlight` / `WorldFolderHighlight`：规则相同，合并为 `WorldEntryHighlight`。
5. **单文件裁定书**（P7）：本文件 `verdicts-refactor-r1.md`，V-R1-001~010。
6. **保留字与禁名**：见 NAMEBOOK §6；`check-naming` 必须校验 A 类名存在、禁名表不出现、同名不跨模块。
7. **依赖矩阵**：16 模块 + 4 子域；禁止边 6 条；见 stage-4 §5。
8. **阶段拆分**：R1（文档冻结）/ R2（核心骨架）/ R3（编辑器与渲染外壳）/ R4（玩法闭环）/ R5（延期项）。

**依据**：P1、P4、P6、P7、P8；R1 草案 v2.2 自检表；PROTOCOL 审阅结论。

**影响**：NAMEBOOK 全文；stage-4 §5 / §12；本文件全部条目。

**状态**：冻结。

---

## 附：裁定索引

| 裁定 | 主题 | 主要依据 |
|---|---|---|
| V-R1-001 | 三大决策 | 用户 2026-10-18；scope §2.1 |
| V-R1-002 | 账号 / profile / 导演身份 | 用户 2026-10-19；R1 第 10、35 项 |
| V-R1-003 | 存储载体 | 用户 2026-10-19；R1 第 9、27 项 |
| V-R1-004 | WorldKind | R1 第 31 项；P2；scope §5 |
| V-R1-005 | PerceptionMode 与 Rain | 用户澄清 C；P3 / P26 撤回；细节 6.2 |
| V-R1-006 | 分层判定体系 | 用户澄清 A；P1；细节 6.1 |
| V-R1-007 | Logo / 动态网格 / Hold | 用户澄清 5；补丁 01；v2.2 修正 1、2 |
| V-R1-008 | 随机 | 用户澄清 B；P4；细节 6.1 |
| V-R1-009 | AI 双模式 | 用户 AI 双选项；P5；P26 撤回 |
| V-R1-010 | 命名空间冻结 | P1 / P4 / P6 / P7 / P8 |

---

## 附：R1 冻结基线确认

`R1 草案 v2.2 + 补丁 01 + NAMEBOOK-v4.0.md + stage-4.md + verdicts-refactor-r1.md = R1 冻结基线`。

三份文档经 PROTOCOL 审阅、Trae 落盘、三门禁（E1 / E2 / E3 至少）通过后，R1 正式冻结，进入 R2。