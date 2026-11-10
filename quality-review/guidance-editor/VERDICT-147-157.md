# 第 29 批正式裁定：引导线编辑器

依据：本轮 PROTOCOL 三项正式架构决策及直接实现授权。适用范围仅为引导线编辑器、v3 时间模型和可选视觉伴随输入。既有 v1/v2 数据继续有效；本文件是交付证据，不改写 docs、名库或参照文件。

| 裁定 | 正式规则 |
| --- | --- |
| VERDICT-147 | MIDI 输出采用版本化 ChartSourceData / MidiNoteEvent；上游已经完成 tick、tempo、轨道偏移到整段媒体毫秒的换算，以及网格位置和音色颜色映射。编辑器只接收输出，不实现音频创作。时间采用绝对媒体时间；位置采用 GuidancePosition；颜色采用独立 NoteColor。按 lineId 分组、timeMs / eventId 排序，连续源位置构成路径，首事件为 Head，其余事件为普通节点。 |
| VERDICT-148 | 允许 Mock，与未来 MIDI 使用同一 schema、严格校验和导出器，仅 provenance 不同。生产数据不得靠修改时间、位置或增加绕路点适配旧速度。 |
| VERDICT-149 | GuidanceEditorDocument 是草稿真源，包含冻结源快照、节点类型、Head 与 Hold 尾端引用、媒体引用和 EditorHistory。修改产生新冻结草稿，导出产生新冻结 GuidanceChart，不编辑运行中的 chart。历史最多 100 项，cursor 表示已应用项数；撤销后新编辑截断 redo。历史仅记录类型/Head/尾端选择，不记录播放进度，不进入玩法 JSON。 |
| VERDICT-150 | 新增 editor 纯逻辑模块：值依赖 chart / constants；不引用 cc、presentation、director、ledger。presentation 仅类型读取 GuidanceEditorReader 并通过 GuidanceEditorPort 提交 GuidanceEditorIntent。草稿由 GuidanceEditorSession 唯一维护；玩法账本仍仅 director 能写，预览不连接 director / ledger。 |
| VERDICT-151 | 当前 Neurou 工程根为 Neurou_official，在其“编辑器”目录提供启动入口与完整世界编辑器目录树。Cocos 浏览器预览中开启游戏内独立编辑模式；其余编辑器目录仅占位。UI 不直接写 chart 或草稿。 |
| VERDICT-152 | 可演奏预览复用真实 ChartPremiere / GuidanceChartRuntime / GuidanceLineRuntime / LineEraseEffect 和 AudioOutputClock；创建独立实例，不复用 gameplay 实例。原始源视图允许呈现尚不可导出的选择；运行预览必须先严格导出。Seek 重建实例并按时间戳回放已记录输入，丢弃未来分支；不倒退 advance。自动试听清楚标记，不作为玩家成绩。 |
| VERDICT-153 | 点击节点或源事件列表选中，属性面板下拉选择 Tap / Drag / Hold，Hold 尾端从同线更晚且更远的源事件选取。禁止拖动位置、时间微调、手工路径点、键绑定。Head 只能是该线排序首事件；选其他事件会报错，不能静默舍弃先前音符。源的 lineId 由上游决定，本轮不提供重新分线。 |
| VERDICT-154 | sRGB 三通道 0～255 整数，不关联 ElementType / TrailColor / EmotionToTrailColor。导出独立 GuidanceVisualData，按 chartId + nodeId 配对。Tap 白框/Drag 圆框/Hold 白色起点及长条叠加中心彩色实心方块；颜色不改变判定、时钟或透明度规则。白色引导线路径与判定点保持原视觉约束。 |
| VERDICT-155 | 新编辑器固定导出 schemaVersion=3；不提供将任意绝对 MIDI 伪装成 v2 的出口。v1 恰一线、v2 至少一线仍为固定速度；v3 至少一线为绝对时间表，不设硬上限。导出 {chartId}.json 与 {chartId}.visual.json，经源、选择、空间取键、转折、时间锚点及 parseGuidanceChart 校验后写文件；Tap 无 keyId，Drag/Hold 键由源位置自动确定。 |
| VERDICT-156 | 最小交付包含 mock/MIDI 契约导入、视频与时间轴、源路径和彩色标记、类型及 Hold 尾端选择、undo/redo、草稿保存/恢复与备份、严格双文件导出、加载导出文件并由真实运行时演奏/试听。UI 为可操作灰盒，不含其他编辑器。验收覆盖 v3、v1/v2 回归、两档分辨率、生命周期、错误数据与无账本写入。 |
| VERDICT-157 | UI 常驻显示“数据来源：Mock / MIDI”。本版本真实上游输出可直接替换 Mock，无格式迁移。重导入视为新草稿，不做跨 sourceRevision 的自动合并；保留备份可恢复人工选择与历史。未来变更 schema 或增量同步应显式迁移/冲突报告，禁止静默覆盖旧版本人工选择。 |

## v3 七项补充时间裁定

1. targetTimeMs 是视频/音轨开始为 0 的绝对媒体时间。暂停时媒体和谱面一起冻结，恢复不改变目标值。startedAtMs 仍记录实际 Space Down，作为启动门槛及回放信息，不作为 v3 节奏偏移。
2. 保留 GuidanceLine、GuidanceNode 的旧字段，增加 TimedGuidanceLine 分支；普通节点时间放入 timing 表，以 nodeId 关联。v3 Head 在专用分支增加 targetTimeMs，并要求 spawnTimeMs 等于该值。v3 不携带 speed；v1/v2 不接受 timing。颜色不进入任何玩法分支。
3. 锚点为 Head (T0,0)、普通节点起点 (Ti,si)、Hold 尾端 (Te,se)。距离是 aspectRatio 加权弧长。时间升序、距离非递减；同时间必须同距离，重复锚点合并语义等价。相同距离、不同时刻表示停留，不生成重复几何顶点。非首锚点必须晚于 Head；最后锚点覆盖完整路径。

   在 Ti ≤ t ≤ Ti+1 且 Ti+1 > Ti 时：

   `s(t) = si + (si+1 - si) × (t - Ti) / (Ti+1 - Ti)`。

   Head 以前 s=0，最后锚点以后 s=L。边界两侧位置连续、速度可变；零时间差锚点只允许相同距离，不瞬移。判定点位置为现有 positionAtPathDistance(path, aspectRatio, s(t))。每线独立按 s(t) 擦除。
4. Tap 相对 targetTimeMs：|误差| ≤ 50ms 为 Perfect，≤ 120ms 为 Good；超过 +120ms 自动 Miss，边界包含。仍用输入时刻判定点的位置动态取键，单次非 Space Down 最多消费一个 Tap（时间差→目标时间→线 ID→节点 ID）。Drag 在目标时刻检查广播按住集合，Hold 在目标起点锁定连续按住、目标尾端结算。Drag/Hold 保留 B 步 Perfect/Miss 及边界：同刻 Down 有效；Drag 同刻 Up 无效；Hold 尾端同刻 Up 有效；暂停释放使已开始 Hold 中断。
5. Head 从 T0 至 T0+1000ms 包含边界可启动；一次新 Space 只启动一线，按生成时间→线 ID→Head ID。晚启动直接进入当前绝对 s(startedAtMs)，后续卡点不顺延；过期 Tap 立即 Miss；尚在 Tap 窗口内仍可按实际时间命中；目标早于启动的 Drag 不补发 Perfect；已错过起点的 Hold 锁定失败，到尾端只结算一次 Miss。恰好启动于 Drag/Hold 起点仍检查当时真实按住状态。
6. 无 v2→v3 迁移工具；v2 保留 speed 及 `startedAtMs + distance / speed × 1000`。并行线、单消费 Tap、独立 Head 超时和总完成条件不改变。v3 同样要求全部普通节点已有最终判定且媒体结束才 Completed；Head 超时只批量 Miss 本线未决节点。
7. AC-15～21 的原业务目标保留；补充版本化时间/兼容测试、可选颜色无判定影响、编辑器隔离测试，见依赖矩阵扩展提案。编辑器预览完成不写账本；不能用它替代 AC-20 gameplay director 的写账本证据。

## 音频编辑器输出契约

```ts
interface NoteColor { readonly r: number; readonly g: number; readonly b: number } // sRGB uint8
interface MidiNoteEvent {
  readonly id: string; readonly trackId: string; readonly lineId: string;
  readonly timeMs: number; // 整段媒体绝对 ms，0～mediaDurationMs
  readonly position: GuidancePosition; // {u,v}，均在 [0,1]
  readonly color: NoteColor;
  readonly pitch: number | null; // MIDI 0～127 整数
  readonly drumType: string | null;
  readonly velocity: number; // 0～127 整数
  readonly endTimeMs: number | null; // 来源时值信息，不自动决定 Hold 尾端
  readonly emphasis: boolean; // 来源元信息，不用于猜测节点类型
}
interface ChartSourceData {
  readonly schemaVersion: 1; readonly sourceId: string; readonly sourceRevision: string;
  readonly provenance: 'Mock' | 'Midi';
  readonly layoutVersion: string; readonly aspectRatio: number;
  readonly mappingVersion: string; readonly mediaDurationMs: number;
  readonly events: readonly MidiNoteEvent[];
}
```

事件 ID 在源内唯一并稳定；lineId 决定序列，不按 trackId 或颜色猜分线。上游应将所需重音置于所属线的首事件；同线其他同刻事件只有相同位置才可能通过 v3 锚点校验。位置重复允许停留；整条线完全无位移、时间倒退、同刻不同位置或无有效网格键时拒绝导出，不改变源数据。

RGB 表示最终显示颜色，不是音色索引。mappingVersion 是上游映射版本标识，不新增颜色玩法枚举。所有 JSON 严格拒绝未知字段、非法范围和无效引用；解析后复制深冻结。

## 草稿及视觉格式

```ts
interface GuidanceEditorDocument {
  readonly schemaVersion: 1;
  readonly documentId: string; readonly chartId: string; readonly tier: ChartTier;
  readonly source: ChartSourceData;
  readonly selection: {
    readonly heads: Readonly<Record<string, string>>; // lineId → 首源 eventId
    readonly nodes: Readonly<Record<string, {
      readonly kind: 'Tap' | 'Drag' | 'Hold'; readonly holdEndEventId: string | null;
    }>>;
  };
  readonly history: EditorHistory;
  readonly media: { readonly videoPath: string | null; readonly audioPath: string | null };
}
interface EditorHistory {
  readonly entries: readonly { readonly label: string;
    readonly before: EditorSelection; readonly after: EditorSelection }[];
  readonly cursor: number;
}
interface GuidanceVisualData {
  readonly schemaVersion: 1; readonly chartId: string;
  readonly nodes: readonly { readonly nodeId: string; readonly color: NoteColor }[];
}
```

Head 作为启动标记，其源颜色在编辑视图显示；本版运行时伴随文件为 Tap/Drag/Hold 普通节点的色块。Hold 尾端引用的源事件仍保留自己的普通节点，不能默默删音。草稿可以暂时不满足导出条件（例如 Hold 尚未选择尾端），但引用和历史必须合法。导出草稿不携带历史/来源元信息到玩法数据。

草稿自动及手动保存于浏览器 localStorage 的 neurou-guidance-draft-v1；下载备份建议保存在“编辑器/草稿/引导线/{documentId}.draft.json”。导出建议目录“编辑器/导出/引导线”；支持目录选择时直接写，其他浏览器按下载设置保存。媒体文件引用不嵌入草稿，跨会话本地视频需重选。

## v3 玩法结构

```ts
interface TimedGuidanceLine {
  readonly id: string;
  readonly head: HeadNode & { readonly targetTimeMs: number };
  readonly path: NodePath;
  readonly nodes: readonly GuidanceNode[]; // 完全沿用 Tap / Drag / Hold 字段
  readonly timing: readonly GuidanceNodeTiming[];
}
interface GuidanceNodeTiming {
  readonly nodeId: string; readonly targetTimeMs: number;
  readonly endTargetTimeMs?: number; // 只允许 Hold，且必须存在
}
// GuidanceChart.schemaVersion = 1 | 2 | 3
// v1/v2 lines 只接受旧 GuidanceLine；v3 只接受 TimedGuidanceLine
```

exportChart 输出新的冻结 chart / visual；parseGuidanceVisualData 检查 chartId、节点 ID 唯一与存在性。省略伴随文件等价于零颜色输入；旧游戏入口不自动加载视觉文件。相同 chartId/nodeId 不提供内容摘要匹配保证，请成对保留导出文件。

## 命名冻结表及模块关系

本轮实现中的新领域名以附录提案为准，待 PROTOCOL 追认、Trae 落盘；已冻结的 A/B/C 名不改名。

| 名称 | 模块 | 本轮职责 |
| --- | --- | --- |
| MidiNoteEvent / ChartSourceData / NoteColor | editor | 上游输出契约、来源标记和 RGB |
| GuidanceEditorDocument / EditorSelection / EditorHistory | editor | 冻结草稿与有界撤销历史 |
| GuidanceEditorSession | editor | 草稿控制器、严格导出、隔离预览的生命周期 |
| GuidanceEditorReader / GuidanceEditorIntent / GuidanceEditorPort | editor | UI 只读接口及编辑意图 |
| GuidanceVisualData | editor | 可选颜色伴随文件 |
| TimedGuidanceLine / GuidanceNodeTiming / GuidanceTimeAnchor | chart | v3 时间分支及时间锚点 |
| GuidanceEditorView | presentation | 游戏内编辑 UI、视频/文件系统边界 |
| GuidanceEditorBuilder | assets/scripts | 独立组合根，不创建 director/ledger |

| 既有 A/B/C 模块 | 关系 |
| --- | --- |
| GuidanceChart / parseGuidanceChart | 新增 v3 分支，v1/v2 字段、约束及语义保留 |
| KeyboardPadLayout | 复用 layoutVersion 与空间取键；Tap 动态键、Drag/Hold 自动导出固定键 |
| GuidanceLineRuntime | 复用输入、节点生命周期、擦除快照；按版本查询位置及目标时间 |
| GuidanceChartRuntime | 原样复用多线协调、Head/Tap 仲裁和按住广播 |
| ChartPremiere / ChartScore | 原样复用判定计分、暂停、完成；实例完全隔离 |
| AudioOutputClock | 原样复用实际媒体/音频输出时钟 |
| LineEraseEffect | 原有白色绘制及擦除，新增可选节点颜色叠加 |
| director / ledger | 编辑器无依赖、无实例、无写入；旧游戏组合根保持原行为 |

## 最小验收定义

通过同一 UI 完成：加载 Mock → 显示路径/彩色点 → 将 a1 选 Drag、a2 选 Hold 并选 a3 为尾端 → 撤销/重做与重开恢复 → 导出两个物理 JSON → 通过文件选择器重载 → 实际 ChartPremiere/LineEraseEffect 演奏或自动试听 → 视频结束且全部节点结算 → Completed。两档分辨率、手动 Space、暂停/恢复、Seek/重入、错误数据及 v1/v2 回归证据逐条见交付报告。
