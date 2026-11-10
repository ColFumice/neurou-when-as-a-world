# 第 29 批：引导线编辑器架构消歧请求

状态：三项冲突已由本轮 PROTOCOL 正式消解并授权直接实现。下文保留当时请求与建议作为历史，不代表最终采用方案；正式裁定以 VERDICT-147-157.md 为准（v3 绝对时间、独立颜色伴随文件、新 editor 模块）。docs、名库、参照文件仍未修改。

## 必须消解的兼容问题

### MIDI 固定时间与固定位置不一定能导出固定速率路径

docs/NAMEBOOK.md:449、451 冻结每线弧长匀速及 `targetTime = startedAtMs + pathDistance / speed × 1000`；GuidanceLine 只有一个 speed。若相邻三个 MIDI 点的加权距离各为 0.2，时间间隔为 100ms 和 400ms，则需要 speed 分别为 2 和 0.5，无法在一条线中同时成立。相同位置、不同时间的重复音也不能作为重合相邻路径点导出。不能默默更改时间、移动位置、添加绕路点、每音拆线或舍弃音符。

还存在启动时间差：当前 Head 以实际 Space Down 设置 startedAtMs。若头拍为 1000ms、下一音为 1500ms，玩家到 1300ms 才启动，即使理想目标为 1500ms，运行时目标也变成 1800ms。现有语义是相对于实际启动的路径节奏，不是强制媒体绝对卡点。

建议本轮保留 A/B/C：源格式完整保留 MIDI 绝对时间与位置；导出器只允许满足固定速率约束的源数据，其他数据明确报错而保留草稿，不自动纠正。预览区分“源媒体时间轴”与“按实际 Space 启动的运行时目标”，mock 专门提供可导出的合规样例与明确拒绝的反例。若要求任意 MIDI 无损导出且严格绝对卡点，则必须另行授权新的时间模型与版本，不能宣称兼容 v2。

### 颜色无法放进冻结的 GuidanceChart v2

GuidanceChart / GuidanceNode 没有颜色字段，parseGuidanceChart 严格拒绝额外字段；直接添加 color 会违背“不修改冻结数据结构”。建议颜色保存于独立 `GuidanceVisualData` 文件，以 chartId、nodeId 关联，同时校验配对版本/内容摘要；导出两个文件：标准 v2 玩法 JSON 与视觉伴随 JSON。旧运行时能单独加载玩法 JSON；显示颜色需要新增可选的 presentation 视觉输入，不能承诺未改接线的旧运行时自动显示颜色。

白色路径、判定点和既有节点图形保持白色，彩色实心小方块作为新增音色标记叠加；不得由颜色参与判定。用户已明确要求新增彩色点，本请求只需确认它在编辑器和游戏演奏中都显示，以及伴随资源方案，而不是重复请求允许彩色点。

### 新 editor 模块需要扩展依赖矩阵

scripts/check-dependencies.js 的 E6 拒绝未登记的 src 模块，矩阵唯一真源为只读 docs/spec/stage-1.md。不能通过把新模块排除扫描、修改脚本另立规则或放在资产目录绕过门禁来解决。建议 PROTOCOL 授权新增 editor 模块与下述边，并由文档维护方同步真源；实施者仍不编辑 docs。若不扩展矩阵，可把本轮纯逻辑暂放 chart，UI 放 presentation，组合根负责实例化与导出；需要明确选择。

## 待确认 VERDICT-147～157

| 编号 | 建议 |
| --- | --- |
| 147 | 采用版本化、已经完成音轨时间换算和位置/颜色映射的 MIDI 输出契约。必需绝对 timeMs、稳定 ID、trackId、lineId、归一化位置、RGB；记录 pitch 或 drumType 等来源信息。引导线编辑器不解析原始 MIDI tick/tempo、不实现音频创作或映射编辑器。 |
| 148 | 允许 mock；与真实输出使用同一 schema 和校验，仅 provenance 标为 Mock。含一条/两条线、重叠、合法 Hold、不可导出节奏等样例。 |
| 149 | GuidanceEditorDocument 保存源快照、节点类型选择、Head 指定、Hold 尾端引用、媒体引用、草稿版本与 EditorHistory。导出生成新冻结 GuidanceChart，不原地编辑运行时 chart。历史采用有界命令/修订记录与 cursor，撤销后新操作截断 redo；历史不进入玩法 JSON。 |
| 150 | 建议新 editor 纯逻辑模块零 cc，依赖 constants/chart；presentation 仅类型读取编辑器接口并发送编辑意图；编辑器控制器拥有草稿写权限，不引用 ledger/director，不产出叙事事件。依赖矩阵扩展待授权；备选为逻辑暂属 chart。 |
| 151 | 在用户指定 Neurou/编辑器 目录提供入口与完整目录树，其他编辑器仅目录占位，无实现。游戏内独立编辑器界面由该入口启动；文件夹本身不等同于游戏内界面，需确认实际 Neurou 根路径和入口形式。UI 不写 GuidanceChart，只提交编辑意图。 |
| 152 | 合规导出后预览复用 GuidanceChartRuntime / ChartPremiere 与只读视觉，不另写判定逻辑。建立独立预览实例，不挂 gameplay director/ledger。编辑时暂停并重新生成预览，seek 从 reset 后按记录的输入顺序回放；不向有状态 runtime 倒退 advance。源时间轴预览可独立展示不合规数据，但不得标为可演奏预览。 |
| 153 | 点击节点选中，属性面板下拉选择 Tap/Drag/Hold；不循环盲切。禁止拖动位置、时间微调、手工路径点与键绑定。允许从已有源事件选择 Head、将事件分配到既有源线、为 Hold 选择严格更晚的源尾端；不移动源数据。Head 默认建议来自强调标记，不能仅凭 pitch 或 velocity 猜出重音。 |
| 154 | RGB 为 sRGB 8 位整数，不关联 ElementType、TrailColor 或归档 EmotionToTrailColor。presentation 渲染白色图形叠加居中彩色实心小方块；Hold 仍白边长条，起点附彩色标记；颜色不改透明度玩法、时钟和判定。颜色伴随资源方案待确认。 |
| 155 | 导出 schemaVersion=2，经源校验、固定速率兼容校验、空间取键与现有 parseGuidanceChart 校验全部成功后写新文件。Tap 无 keyId；Drag/Hold 的 keyId 在导出时由节点固定位置 resolveGridKeyAt 得出，运行时仍是已冻结固定绑定语义，不随移动点换键。Hold 的 endPathDistance 来自明确尾端事件，不能从普通 MIDI 时值猜出任意新位置。自动键若为空则拒绝，不用最近键兜底。内部转折必须 Tap/Hold 起点，选择 Drag 造成非法转折则报错并拒绝导出，不自动改类型。 |
| 156 | 最小交付必须含 mock 导入、视频/时间轴、路径与彩色标记、类型选择、Hold 尾端选择、undo/redo、草稿保存/恢复、严格导出、真实运行时加载与预览。灰盒但文字清晰、错误可定位、空状态完整；不要求成品美术。含错误源、错误媒体、非法导出与文件写入失败验收。 |
| 157 | UI 常驻显示“数据来源：Mock / MIDI”。相同契约版本替换真实输出无需迁移；未来契约升级才用显式迁移并保留原文件。稳定 eventId 用于重新导入匹配编辑选择；缺失或变化的事件列出冲突，不静默删除人工选择与历史。 |

## 名称候选表（待冻结）

| 名称 | 归属/职责 |
| --- | --- |
| MidiNoteEvent | 音频编辑器输出事件，已转换到整段媒体绝对时间。 |
| ChartSourceData | 完整版本化事件输出、布局/画幅、来源和映射版本。 |
| NoteColor | sRGB RGB 纯数据，不是玩法拖尾状态。 |
| GuidanceEditorDocument | 编辑器持久化文档；拥有源快照与人工选择。 |
| EditorHistory | 命令/修订历史及撤销重做 cursor。 |
| GuidanceVisualData | 可选颜色伴随资源，不扩展 GuidanceChart。 |
| GuidanceEditorSession | 草稿写入控制器，预览与导出生命周期。 |
| GuidanceEditorIntent / GuidanceEditorReader | UI 意图口与只读快照；不暴露账本写权限。 |

复用 GuidancePosition，不新增重复 GridPosition 类型。已有 GuidanceChartRuntime/getGuidanceSnapshots 等冻结名称不改。具体方法、私有成员与资源 ID 留到授权后的实现命名清单追认。

## 接口契约草案

```ts
type NoteColor = Readonly<{ r: number; g: number; b: number }>;
interface MidiNoteEvent {
  readonly id: string;
  readonly trackId: string;
  readonly lineId: string; // 输出显式分线；不由编辑器猜测声部
  readonly timeMs: number; // 整段媒体从零开始的绝对时间，非 tick
  readonly position: GuidancePosition; // 映射后的 [0,1] 坐标
  readonly color: NoteColor; // 映射后的最终 RGB
  readonly pitch: number | null; // MIDI 0~127
  readonly drumType: string | null; // 打击来源的稳定类型 ID
  readonly velocity: number; // 0~127，来源信息，不直接决定图形
  readonly endTimeMs: number | null; // MIDI 时值来源；不自动决定 Hold 尾部
  readonly emphasis: boolean; // 上游明确标记，供 Head 建议
}
interface ChartSourceData {
  readonly schemaVersion: 1;
  readonly sourceId: string;
  readonly sourceRevision: string;
  readonly provenance: 'Mock' | 'Midi';
  readonly layoutVersion: string;
  readonly aspectRatio: number;
  readonly mappingVersion: string;
  readonly mediaDurationMs: number;
  readonly events: readonly MidiNoteEvent[];
}
```

输入必须包含最终坐标和颜色；pitch/drumType 用于追溯，不在本工具重做映射。事件 ID 全源唯一，lineId/trackId 非空；数值有限、时间不负且在媒体时长内，RGB 整数范围 0~255；输出按 timeMs、ID 规范排序并复制深冻结。Space 无网格，因此普通节点坐标取键为空应拒绝。引用媒体是可替换文件引用，不保存视频像素或把路径编码到视频。

路径推导按显式 lineId 分组、以源时间/ID 排序，在所选 Head 起点及后续节点位置间建立 Polyline；路径弧长与节点距离全部复用 chart 数学。至少两个不同路径点，不能默默合并重复音。固定速率兼容要求每个普通节点 `(distanceFromHead / (timeMs - headTimeMs))` 相同，使用明确数值误差容差，不借容差扩大玩法窗口。实际演奏仍相对于 Space 启动，不能声称绝对时间已冻结。

## 草稿结构草案

```ts
interface GuidanceEditorDocument {
  schemaVersion: 1;
  documentId: string;
  chartId: string;
  tier: ChartTier;
  source: ChartSourceData;
  media: { videoPath: string | null; audioPath: string | null };
  lines: { lineId: string; headEventId: string }[];
  nodes: { eventId: string; kind: ChartNodeKind; holdEndEventId: string | null }[];
  history: EditorHistory;
}
interface EditorHistory {
  entries: readonly {
    revisionId: string;
    // 可序列化的语义编辑操作及其前后选择；不放引擎对象/函数
    operation: unknown;
  }[];
  cursor: number;
}
```

这里 operation 的 unknown 只是裁定草案占位，实现前必须定义有限判别联合并验证加载，不能以任意对象执行命令。用户操作只改类型/Head/尾端等选择，源 MIDI 坐标时间只读；导入、替换源、恢复草稿都是明确事务。草稿保存历史和版本，自动保存与手工保存显示状态，导出只包含运行时字段。默认存储建议为 Neurou/编辑器/草稿/引导线/{documentId}.draft.json，导出为 Neurou/编辑器/导出/引导线/{chartId}.json 与 {chartId}.visual.json；不默认写 assets/resources，测试导入运行时资源另作显式动作。

## 目录与依赖草案

```text
Neurou/编辑器/
  世界编辑器/
    音乐编辑器/
      RGB波表编辑器/
      网格编辑器/
      MIDI以及音轨编辑器/
    地图编辑器/
      事件编辑器/
      剧情编辑器/
        路人编辑器/
        字幕编辑器/
    谱面编辑器/
      引导线编辑器/
        视频卡点器/
        位置编辑器/
      特殊事件编辑器/
  草稿/引导线/
  导出/引导线/
```

本轮两个子工具消费上游结果和展示时间/位置，不实现原始音频编辑与音色映射制作。“视频卡点器”不擅自微调 MIDI 时间，“位置编辑器”不擅自拖动 MIDI 位置。其余目录为空占位；不新增那些编辑器的界面或功能。

建议依赖：editor → chart/constants 值依赖；presentation → editor 仅类型只读/意图；editor 不依赖 presentation/cc/director/ledger；资产组合根实例化会话并注入媒体与文件服务。预览实例拥有自身键状态、暂停状态与得分，不提交世界意图，不持有 LedgerAppend。扩展矩阵必须先由 PROTOCOL 授权并同步唯一真源。

## 与 A/B/C 的关系

| 模块 | 关系 |
| --- | --- |
| GuidanceChart、节点联合、schemaVersion 1/2 | 原样保留；导出器只生成合法 v2。 |
| parseGuidanceChart / 路径数学 / resolveGridKeyAt | 直接复用真实校验、弧长和自动取键。 |
| GuidanceLineRuntime / GuidanceChartRuntime / ChartPremiere | 原样复用隔离预览，不改变启动及判定规则。 |
| LineEraseEffect / ChartPadView | 白色逻辑视觉保留；可选视觉伴随输入及彩色标记新增于 presentation。 |
| AudioOutputClock | 播放预览共享一媒体时间轴；seek 重建运行时。 |
| director / ledger | 不接入编辑器操作与预览，运行时导入演奏沿用现有唯一写账本链路。 |
| KeyboardPadLayout | 原样复用；Drag/Hold 导出时从起点位置计算固定键。 |

## 提请 PROTOCOL 确认

1. 采用“保留 v2 固定速率/相对启动，只允许兼容源导出并显式拒绝其他 MIDI”，还是授权新的时间模型与格式？
2. 接受颜色独立视觉伴随 JSON、编辑器及游戏中通过可选 presentation 输入显示颜色？
3. 授权新增 editor 模块并由维护方同步矩阵，还是纯逻辑暂放 chart？

实际 Neurou 根目录、入口启动方式可以在实施前澄清；当前工作区为 D:/Project/A_New_Begin/Neurou_official，不能擅自认定它等于用户所指 Neurou 文件夹。本轮没有获得“裁定后直接实现”的指令，因此本请求不创建编辑器代码或空占位目录。
