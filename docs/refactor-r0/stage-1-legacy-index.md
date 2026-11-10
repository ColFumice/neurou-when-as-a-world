﻿﻿﻿# 旧 stage-1 全景索引（refactor-r0 / 任务 2）

- 源文件：`docs/spec/stage-1.md`（只读，本任务未修改）
- 源文件字节数：108712
- 源文件 SHA256：`C4E9A3090BC96D2204E57401B57F788B448386D822ADA7EDAE6874C68AC63FCE`
- 生成时间：2026-10-18 19:46 +08:00
- 任务性质：重构前置（R0）机械索引。只做机械判定，不做产品判断；判定列括注所套用的规则编号。

## 判定规则（用户给定，逐字机械套用）

| 规则 | 内容 | 判定 |
| --- | --- | --- |
| R-A | 涉及箱庭移动、镜头、视距、拖尾、3D 空间 | 需重审 |
| R-B | 涉及元素 / 可见性 / 解谜链 / 节奏敲击 | 需重审 |
| R-C | 涉及引导线谱面（AC-15 ~ AC-21） | 废止 |
| R-D | 涉及跳跃（AC-30） | 需重审（技术栈换了，但概念可能保留） |
| R-E | 涉及账本 / 命名 / 依赖方向（AC-22 ~ AC-26） | 需重审 |
| R-F | 涉及端到端（AC-27 ~ AC-28） | 废止（旧链路不存在） |
| R-G | 涉及美术可替换（AC-29） | 保留 |
| R-H | ME / B1 / B2 系列 | 全部需重审 |

## 机械事实备注

- §8 标题为「验收标准（AC-01 ~ AC-29）」，实际清单含 AC-01 ~ AC-30 + ME-01~19 + B1-01~11 + B2.1 / B2.2 / B2.2c / B2.2d-1 / B2.2d-2 / B2.3 / B2.4 / B2.4c / B2.4d / B2.4e / B2.5b / P3 / B2.5c-1 各系列。
- §8 证据标签止于 B2.5c-1-10。B2.5c-2a / B2.5c-2b / B2.5c-2c 仅 §4 有授权范围块（另见 §4「B2.5c-2d（占位）」），无 §8 AC 条目，故不在本索引 AC 计数内。
- AC-10 在源文件中标注「待补验」（分项 1 已通过、分项 2 待补验），按现状原文入表。

## 1. AC-01 ~ AC-30（阶段 1 主体验收，30 项）

### A. 移动与箱庭

| 编号 | 标题 | 一句话内容 | 重构后是否仍适用（机械判定） |
| --- | --- | --- | --- |
| AC-01 | 横轴+纵深移动 | 主角可沿横轴与纵深轴移动，纵深幅度明显小于横向 | 需重审（R-A） |
| AC-02 | 镜头居中 | 镜头中心始终是主角 | 需重审（R-A） |
| AC-03 | 视距调节 | 玩家可调视距；调节不改变主角纵深坐标与距中点距离 | 需重审（R-A） |
| AC-04 | 三层纵深与镜头旋转 | 箱庭至少三层纵深，前后景视差；至少一段路线镜头随路线旋转 | 需重审（R-A） |
| AC-05 | 调试面板距中点 | 调试面板显示主角距中点距离，单位 WorldMeter，计入横轴与纵深 | 需重审（R-A） |
| AC-06 | 主角尺度 | 主角画面高度与 1.6 WorldMeter 尺度一致 | 需重审（R-A） |

### B. 拖尾

| 编号 | 标题 | 一句话内容 | 重构后是否仍适用（机械判定） |
| --- | --- | --- | --- |
| AC-07 | 拖尾长度 | 拖尾长度随移动速度增加只增不减；静止时收拢 | 需重审（R-A） |
| AC-08 | 拖尾占位色 | 拖尾用占位逻辑色且本阶段固定；任何逻辑不读取渲染出的颜色 | 需重审（R-A） |

### C. 元素、可见性与解谜

| 编号 | 标题 | 一句话内容 | 重构后是否仍适用（机械判定） |
| --- | --- | --- | --- |
| AC-09 | 元素类型基线 | 场景至少一个 Initial 实体、一个 Process 实体、一枚普通痕；元素类型只能是 4 种允许值之一 | 需重审（R-B） |
| AC-10 | 感知模式画面（待补验） | Normal 低饱和（分项 2 待补验）；Triggered 可见 Concealed 实体（分项 1 已通过） | 需重审（R-B） |
| AC-11 | 触发变明态/移出回复 | 形态实体触发条件满足后变明态；移出屏幕后变回（阶段 1 用 FORGET_DISTANCE_WM 距离占位） | 需重审（R-B） |

### 节奏敲击与解谜链（AC-12 ~ AC-14 独立小节）

| 编号 | 标题 | 一句话内容 | 重构后是否仍适用（机械判定） |
| --- | --- | --- | --- |
| AC-12 | 节奏敲击 | 痕位置固定，投影进入敲击区域，按 BGM 节拍 RhythmStrike，窗口 ±100ms（RHYTHM_STRIKE_WINDOW_MS=100），数字键 0~9 触发、Tab 切感知模式 | 需重审（R-B） |
| AC-13 | 两步解谜链 | 接近+投影入区推进至待敲击；节拍命中启动 7 秒持续期（半开区间、终点排除、终点前拍点仍须判定）；中间只更新 PuzzleProgress，链终点恰好写一条 NarrativeEvent | 需重审（R-B） |
| AC-14 | 深痕产出与谱面入口 | 链终点若为深痕，同次结算确定产出并自动进入谱面（DeepTraceRevealSequence 灰盒）；视觉揭示与切换不额外写账本 | 需重审（R-B；谱面入口的目标形态随 AC-15~21 废止，留待重构裁定） |

### D. 视频谱面（AC-15 ~ AC-21，引导线体系）

| 编号 | 标题 | 一句话内容 | 重构后是否仍适用（机械判定） |
| --- | --- | --- | --- |
| AC-15 | 引导线谱面 | 键盘打击垫叠加白色引导线；头节点 1000ms 内 Space 边沿启动；判定点按弧长匀速；Tap/Drag/Hold 规则；多线独立运行 | 废止（R-C） |
| AC-16 | 视频与谱面数据分离 | GuidanceChart 为独立数据；路径/节点/键绑定/速度不得编码进视频或由像素推导 | 废止（R-C） |
| AC-17 | 判定 | 统一谱面时间轴、节点规则、物理键身份；Tap Perfect/Good/Miss，Drag/Hold Perfect 或 Miss；每节点最多结算一次；暂停冻结判定 | 废止（R-C） |
| AC-18 | 引导透明度与视觉 | 保留透明度调节与得分加成；引导线/节点/判定点白色并按规则擦除或淡出；视觉不改变路径/键映射/窗口/判定 | 废止（R-C） |
| AC-19 | 两档分辨率同步 | 两档分辨率共用同一谱面坐标、弧长进度、网格映射与媒体时钟，满足原同步阈值 | 废止（R-C） |
| AC-20 | 完成与账本 | 全部判定对象已决且媒体播放结束才 Completed；完成后由 director 恰好写一条带谱面引用的账本记录 | 废止（R-C） |
| AC-21 | 中途退出与重入 | 中途退出终止引导线、回收资源、不写完整演奏账本；重入复位全部演奏状态，不重复写既有解谜终点记录 | 废止（R-C） |

### E. 账本与架构

| 编号 | 标题 | 一句话内容 | 重构后是否仍适用（机械判定） |
| --- | --- | --- | --- |
| AC-22 | 叙事事件结构 | 每条叙事事件含完整 20 维向量、写入时间、输入来源、章节标记、ChartRef（阶段 1 允许灰盒值） | 需重审（R-E） |
| AC-23 | 账本只增 | 账本对外没有修改和删除记录的能力 | 需重审（R-E） |
| AC-24 | 唯一追加者 | 全工程只有叙事导演调用「追加账本」 | 需重审（R-E） |
| AC-25 | 表现层不写账本 | 表现层模块不依赖任何账本写入能力 | 需重审（R-E） |
| AC-26 | 命名检查 | 全工程不出现 INV-8 禁止的命名 | 需重审（R-E） |

### F. 端到端

| 编号 | 标题 | 一句话内容 | 重构后是否仍适用（机械判定） |
| --- | --- | --- | --- |
| AC-27 | 完整流程 | 出生→移动→触发模式发现形态痕→两步解谜链→深痕→进谱面→完整演奏→回世界；账本恰好 +2 | 废止（R-F） |
| AC-28 | 中途退出重入流程 | 重复 AC-27 但谱面中途退出：账本只 +1，重入完整演奏后最终 2 条 | 废止（R-F） |

### G. 美术可替换

| 编号 | 标题 | 一句话内容 | 重构后是否仍适用（机械判定） |
| --- | --- | --- | --- |
| AC-29 | 美术可替换 | 所有占位美术可在不修改任何逻辑代码的情况下替换；资源与逻辑只经配置或资源引用关联 | 保留（R-G） |

### 跳跃（独立小节）

| 编号 | 标题 | 一句话内容 | 重构后是否仍适用（机械判定） |
| --- | --- | --- | --- |
| AC-30 | 跳跃 | 地面或落地容差内空格起跳；按住连续弹跳、松开不自动起跳、空中不再跳；跳跃不改横轴/纵深/距中点；不写账本不生痕；谱面与转场期间不接受请求 | 需重审（R-D） |

## 2. ME 系列（音频编辑器，19 项）

### H. 音频编辑器最小交付（ME-01 ~ ME-10）

| 编号 | 标题 | 一句话内容 | 重构后是否仍适用（机械判定） |
| --- | --- | --- | --- |
| ME-01 | 加载工程 | 加载音乐工程（Mock 或 MIDI provenance），显示音轨时间轴与音符 | 需重审（R-H） |
| ME-02 | 音符编辑 | 音符放/删/改正常，时间轴与音轨实时更新 | 需重审（R-H） |
| ME-03 | undo/redo 与草稿 | undo/redo 有界（≤100 项），撤销后新编辑截断 redo；草稿保存/恢复正常 | 需重审（R-H） |
| ME-04 | 离线试听 | 离线简易试听（单次 PCM 渲染），播放/暂停/停止/seek 依据 AudioContext 时间 | 需重审（R-H） |
| ME-05 | 严格导出 | 严格导出 ChartSourceData（schemaVersion=1、provenance='Midi'），通过 parseChartSourceData 校验 | 需重审（R-H） |
| ME-06 | 导出可消费 | 导出的 ChartSourceData 可被既有 GuidanceEditorSession 消费并经真实 ChartPremiere/LineEraseEffect 演奏 | 需重审（R-H） |
| ME-07 | 两档分辨率一致 | 1920×1080 与 2560×1440 两档下时间轴、音符位置及试听一致 | 需重审（R-H） |
| ME-08 | 退出复位 | 退出释放资源，重入复位草稿；不产生叙事事件，不连接 director / ledger | 需重审（R-H） |
| ME-09 | 零 cc 与门禁 | musicEditor 逻辑模块零 cc 引用；E1~E9 门禁全部通过 | 需重审（R-H） |
| ME-10 | 既有核心未改 | 既有 GuidanceEditorSession / View / Builder 核心未修改；WorldFolderBuilder 仅新增 MidiTrackEditor 路由 | 需重审（R-H） |

### ME-11 ~ ME-19 批量操作（VERDICT-191~195）

| 编号 | 标题 | 一句话内容 | 重构后是否仍适用（机械判定） |
| --- | --- | --- | --- |
| ME-11 | 单选/多选 | 单选 / 多选（Ctrl+点击、Shift+点击、Ctrl+Shift 范围） | 需重审（R-H） |
| ME-12 | 框选 | 空白拖动 > 4px 框选，与实际 noteRect 相交的音符全部选中，可跨轨 | 需重审（R-H） |
| ME-13 | 全选/取消 | Ctrl+A 全选当前轨；Esc 取消选择 | 需重审（R-H） |
| ME-14 | 复制粘贴 | Ctrl+C / Ctrl+V（UI 内存剪贴板；pointer 优先否则播放头；跨轨 flatten） | 需重审（R-H） |
| ME-15 | 拖拽移动 | 整组 ghost 实时显示，mouseUp 只提交一次 MoveNotes | 需重审（R-H） |
| ME-16 | 删除 | Delete / Backspace 删除选中集合 | 需重审（R-H） |
| ME-17 | 批量撤销 | 批量操作的 Undo / Redo 整组恢复 | 需重审（R-H） |
| ME-18 | 状态清理 | 恢复工程/草稿清选择；重启工作区清剪贴板 | 需重审（R-H） |
| ME-19 | 文本控件隔离 | 文本输入控件（input/textarea/select/contenteditable）不抢快捷键 | 需重审（R-H） |

## 3. B1 系列（谱面接入游戏入口，11 项，VERDICT-196~200）

| 编号 | 标题 | 一句话内容 | 重构后是否仍适用（机械判定） |
| --- | --- | --- | --- |
| B1-01 | 谱面资源成对复制 | 编辑器导出 `{chartId}.json` 与可选 `{chartId}.visual.json` 成对复制到 `assets/resources/chart/` | 需重审（R-H） |
| B1-02 | 资源路径配置 | SceneBuilder Inspector 字段 ChartResourcePath 配置谱面资源路径（默认 `chart/guidance_c`） | 需重审（R-H） |
| B1-03 | 主谱面拒绝回退 | 主谱面缺失/路径非法/数据非法时拒绝加载，不以另一张谱面回退 | 需重审（R-H） |
| B1-04 | 颜色缺失降级 | 颜色文件缺失时降级为默认颜色，不阻断谱面加载 | 需重审（R-H） |
| B1-05 | 颜色严格校验 | 颜色文件存在时经 parseGuidanceVisualData 严格校验 schema/chartId/nodeId/8 位 RGB | 需重审（R-H） |
| B1-06 | 首演账本 +1 | 完整首演完成后 director 同帧恰好追加一条带 ChartRef 的 NarrativeEvent | 需重审（R-H） |
| B1-07 | 退出/重入账本纪律 | 中途退出不新增完整演奏事件，重入不重复 T6 | 需重审（R-H） |
| B1-08 | 编辑器预览零账本 | 编辑器预览零游戏账本，不连接 director / ledger | 需重审（R-H） |
| B1-09 | v3 复用既有逻辑 | v3 谱面复用既有 ChartPremiere / ChartRef / 判定 / 计分 / 完成逻辑 | 需重审（R-H） |
| B1-10 | 两档一致 | 两档分辨率下导出字节、节点/得分/完成结果、账本增量一致 | 需重审（R-H） |
| B1-11 | 三条门禁 | check-naming / check-dependencies / tsc 三条门禁独立通过 | 需重审（R-H） |

## 4. B2.1 系列（本地多世界基础，10 项，VERDICT-201~210）

| 编号 | 标题 | 一句话内容 | 重构后是否仍适用（机械判定） |
| --- | --- | --- | --- |
| B2.1-01 | 默认 InitialWorld | 默认存在 InitialWorld | 需重审（R-H） |
| B2.1-02 | 动态多项 | 世界列表支持动态多项 | 需重审（R-H） |
| B2.1-03 | 独立最小箱庭 | 每个世界为独立最小箱庭 | 需重审（R-H） |
| B2.1-04 | 墓碑删除 | 世界删除采用墓碑机制 | 需重审（R-H） |
| B2.1-05 | 删除不重种 | InitialWorld 删除后不重种 | 需重审（R-H） |
| B2.1-06 | 退出返回刷新 | 退出世界返回文件夹后列表刷新 | 需重审（R-H） |
| B2.1-07 | 重启刷新 | 重启后世界列表刷新正确 | 需重审（R-H） |
| B2.1-08 | 账号隔离 | 世界数据按账号隔离 | 需重审（R-H） |
| B2.1-09 | 存储失败 | 存储失败路径行为正确 | 需重审（R-H） |
| B2.1-10 | 分叉延后反馈 | WorldFork 未实装时分叉入口给出延后反馈 | 需重审（R-H） |

## 5. B2.2 系列（账号里程碑与状态契约，13 项，VERDICT-211~225）

| 编号 | 标题 | 一句话内容 | 重构后是否仍适用（机械判定） |
| --- | --- | --- | --- |
| B2.2-01 | 独立 key | 里程碑独立 key 不覆盖序章 key | 需重审（R-H） |
| B2.2-02 | 严格解析 | FirstWorldCleared 严格解析 | 需重审（R-H） |
| B2.2-03 | 账号隔离 | 账号事实按账号隔离 | 需重审（R-H） |
| B2.2-04 | 只读派生 | CopyPermission 只读派生自 FirstWorldCleared | 需重审（R-H） |
| B2.2-05 | 单向事实 | 事实只允许 false→true / true→true | 需重审（R-H） |
| B2.2-06 | 拒绝异常 | 损坏/未知版本/身份不匹配拒绝 | 需重审（R-H） |
| B2.2-07 | 快照头部 | WorldStateSnapshot 头部结构契约 | 需重审（R-H） |
| B2.2-08 | 七项归属 | 七项归属类型契约 | 需重审（R-H） |
| B2.2-09 | Complete/Incomplete 判别 | 检查点 Complete / Incomplete 判别 | 需重审（R-H） |
| B2.2-10 | 缺失返回 Incomplete | 已知缺失项返回 Incomplete | 需重审（R-H） |
| B2.2-11 | 恢复请求拒绝 | 不完整状态恢复请求拒绝 | 需重审（R-H） |
| B2.2-12 | Fork 未实装显示 | WorldForkAvailability=NotImplemented 显示 | 需重审（R-H） |
| B2.2-13 | 契约 vs 生产区分 | 契约测试与生产验收区分 | 需重审（R-H） |

## 6. B2.2c 系列（真实通关链路，10 项，VERDICT-226~240）

| 编号 | 标题 | 一句话内容 | 重构后是否仍适用（机械判定） |
| --- | --- | --- | --- |
| B2.2c-01 | 球面穿越触发 | Player 写入后主角权威账本累计坐标 on/outside 且未穿越才授予入口；等号算触发 | 需重审（R-H） |
| B2.2c-02 | 穿越不可撤销 | 穿越后本运行期间不撤销；入口按四元组+SphereCrossing 唯一 | 需重审（R-H） |
| B2.2c-03 | WorldBossChart 装配 | 每世界内容版本恰好绑定一首 schemaVersion=3 / tier='World' 谱面；只校验加载装配 | 需重审（R-H） |
| B2.2c-04 | World 首演完成判据 | 沿用 C 判据（全部节点已决+媒体完成边界），与分数无关；退出不写完成账本 | 需重审（R-H） |
| B2.2c-05 | RouteSignature 冻结 | 完成追加后从同一主角账本取完整累计坐标生成不可变 RouteSignature | 需重审（R-H） |
| B2.2c-06 | 六情感分类 | 正最大值严格为正选最大；并列按 Red→Green→Blue→Black→White→Grey 取首；全零/零向量特例 | 需重审（R-H） |
| B2.2c-07 | ChartRef.state 兼容 | T6 写 Entry、T7/World 写 PremiereCompleted；旧记录只读识别；未知 Unclassified；不追溯 | 需重审（R-H） |
| B2.2c-08 | 通关提交链与幂等 | 记录先持久化投影后更新；[accountId, worldId] 幂等；不进快照、不随墓碑删除 | 需重审（R-H） |
| B2.2c-09 | 最小内容生产者 | 制作方内容文件声明 worldKind/主角身份/零坐标中心/有限正距离/20 维非负向量；玩家仅提交选择 ID | 需重审（R-H） |
| B2.2c-10 | 完整链路 | Primary 世界→选择→非零向量→穿越→Boss 谱面→首演→WorldClearRecord→FirstWorldCleared→CopyPermission=true | 需重审（R-H） |

## 7. B2.2d-1 系列（完整状态恢复前置·核心机制，5 项，VERDICT-241~255）

| 编号 | 标题 | 一句话内容 | 重构后是否仍适用（机械判定） |
| --- | --- | --- | --- |
| B2.2d-1-01 | 账本 round-trip | 账本序列化/反序列化 round-trip 一致 | 需重审（R-H） |
| B2.2d-1-02 | PuzzleProgress 完整状态 | PuzzleProgress 完整状态可恢复 | 需重审（R-H） |
| B2.2d-1-03 | FormatTime immutable | FormatTime 不可变语义 | 需重审（R-H） |
| B2.2d-1-04 | 无副作用 hydration | hydration 无副作用 | 需重审（R-H） |
| B2.2d-1-05 | 跨账号跨世界拒绝 | 跨账号/跨世界恢复请求拒绝 | 需重审（R-H） |

## 8. B2.2d-2 系列（扩展四项与七项完成，8 项，VERDICT-256~270）

| 编号 | 标题 | 一句话内容 | 重构后是否仍适用（机械判定） |
| --- | --- | --- | --- |
| B2.2d-2-01 | RecallCount 正式载体与合法行为 | 同一权威 Ledger 校验来源；只能选当前主角已有事件；计数非负安全整数；回忆不追加向量/不穿越/不写账号事实 | 需重审（R-H） |
| B2.2d-2-02 | 痕回放共享来源事件计数 | 真实痕绑定限定 T6_MAIN_DEEP_TRACE→原 T6 占位；ReplayTrace 与直接回忆共用计数；ReplayChart 返回 ChartReplayIgnored | 需重审（R-H） |
| B2.2d-2-03 | 他人事件第一次经历 | experienceForeignEvent 只接受同账号/世界权威账本已知其他角色正式 Regular Entry；第一次经历走同源追加 | 需重审（R-H） |
| B2.2d-2-04 | WorldLink 判别联合与孤立语义 | WorldLinkSnapshot 严格判别联合；Primary/FinalShore NotApplicable；BugShore 必 Linked；Unknown 拒绝；孤立保留最后合法快照 | 需重审（R-H） |
| B2.2d-2-05 | AIProfileSnapshot 完整配置 | schemaVersion=1 保存 profileId/revision/providers/taskRoutes；三类 Provider 严格；降级链以 TemplateProvider 结束 | 需重审（R-H） |
| B2.2d-2-06 | ChartSnapshot 首演实际内容冻结 | 首演只关联同次合法 PremiereCompleted 与真实 completed=true；保存实际谱面/布局/RGB/媒体身份/透明度/事件 ID/冻结时间/归属/摘要 | 需重审（R-H） |
| B2.2d-2-07 | ChartScore 持久化更新语义 | schemaVersion=1、scoringVersion=1；首演成为 best/latest、count=1；重演唯一 playId 严格 +1；仅严格高分替换 best | 需重审（R-H） |
| B2.2d-2-08 | 七项完整认证与 Complete/Restored 产出 | 七项全非空+权威身份/版本/归属/结构/跨项引用全部通过并认证才产出快照；publish() 成功才 Restored；活动边界仍 UnsupportedBoundary | 需重审（R-H） |

## 9. B2.3 系列（WorldFork 实装，10 项，VERDICT-271~285）

| 编号 | 标题 | 一句话内容 | 重构后是否仍适用（机械判定） |
| --- | --- | --- | --- |
| B2.3-01 | CopyPermission 权限门槛 | prepareWorldFork 要求同账号合法只读里程碑；CopyPermission===FirstWorldCleared===true；否则拒绝 | 需重审（R-H） |
| B2.3-02 | Complete Primary 来源校验 | 来源须当前目录未删除、parseComplete 认证七项完整、Primary 内容绑定验证；FinalShore 禁止、BugShore 不支持 | 需重审（R-H） |
| B2.3-03 | 七项精确继承与身份重键 | 七项 account/world 复合身份统一重键到新 worldId；accountId/characterId/chainId/traceId/eventId/chartId 保持；FormatTime 保留 | 需重审（R-H） |
| B2.3-04 | WorldForkOrigin 永久见证 | forkOrigin 为 Core 可选头非第八项；非 null 完成事件 ID 须匹配控制事实；创建后不得补写/改写/删除 | 需重审（R-H） |
| B2.3-05 | 继承完成后阻断再次首演 | 继承完成 completionStatus=Inherited、record=null；过滤 EnterWorldChart 与 RetryWorldClear | 需重审（R-H） |
| B2.3-06 | 未完成副本的真实新通关 | 来源未完成时 inheritedCompletionEventId=null，沿用正式通关流程产生目标自己的 WorldClearRecord | 需重审（R-H） |
| B2.3-07 | 独立记忆、成绩与冻结内容 | 每世界独立账本/解谜/回忆计数/链接/冻结谱面/成绩；分叉后目标 Recall/Replay 只改目标 | 需重审（R-H） |
| B2.3-08 | 目录追加唯一提交点+回滚 | 短期日志桥接；验证→写日志→持租约写 Core→回读→比目录→追加目录→清理；目录追加唯一提交点 | 需重审（R-H） |
| B2.3-09 | 租约+目录锁顺序 | 先来源租约、再目标租约、最后目录独占锁；ifAvailable 检查；缺锁能力不无锁写入 | 需重审（R-H） |
| B2.3-10 | 两档分辨率+三条门禁 | 双档真实 Cocos 预览 54 张截图；三条门禁独立通过；renderer/runtime 错误 0；外部请求 0 | 需重审（R-H） |

## 10. B2.4 系列（b 契约级最小闭环，10 项，VERDICT-301~310）

| 编号 | 标题 | 一句话内容 | 重构后是否仍适用（机械判定） |
| --- | --- | --- | --- |
| B2.4-01 | InitialWorld 完全排除 | InitialWorld 不进 WorldHomeRegistry、不参与复制/迁移/传输；网络与 ID/时钟工厂调用前拒绝 ExcludedWorld | 需重审（R-H） |
| B2.4-02 | 归属索引与两层表 | WorldHomeRegistry 为 accountId×worldId 账号级归属索引；HomeDevice 是设备归属非所有权转让；WorldRegistry 本机位置表保留 | 需重审（R-H） |
| B2.4-03 | 登记来源合法性 | 登记来源经同账号本机合法目录读取器确认；已删除/未知/错账号/损坏不登记 | 需重审（R-H） |
| B2.4-04 | 首次归属原子与版本纪律 | 首次登记原子不可覆盖；homeRevision=1；registryRevision 每新增递增；重试/读不增版本；重复登记 AlreadyHomed | 需重审（R-H） |
| B2.4-05 | HomeConflict 语义边界 | HomeConflict 仅是「已有另一设备归属」，不等价已确认复制品；不载入/复制/改写 | 需重审（R-H） |
| B2.4-06 | 严格解码与观察不回退 | 请求无账号/设备可覆盖字段；响应 unknown 严格解码；观察的 revision 不回退、record 不无故消失 | 需重审（R-H） |
| B2.4-07 | 诊断完备 | 服务 unavailable、端口缺失、响应格式/身份/版本错误均明确诊断；不缓存回填成功 | 需重审（R-H） |
| B2.4-08 | 无持久化与边界保持 | b 不写三个 key 前缀、无本地 journal；不改旧 lease/目录提交/账号保存/输入门控 | 需重审（R-H） |
| B2.4-09 | 契约级验证与生产证据区分 | 34/34 契约测试 PASS（两逻辑设备共享 ContractAdapter）；非真实登录/物理设备/网络服务 | 需重审（R-H） |
| B2.4-10 | 三门禁与核心保护 | 三条门禁 0 ERROR；保护审计 587→595 路径 SHA256 全保持；IntentPort type-only 追加前缀一致 | 需重审（R-H） |

## 11. B2.4c 系列（CrossDeviceDuplicate 受限 Core 原型，10 项，VERDICT-311~325）

| 编号 | 标题 | 一句话内容 | 重构后是否仍适用（机械判定） |
| --- | --- | --- | --- |
| B2.4c-01 | 受限载荷与品牌不传输 | RestrictedCoreTransfer 仅封装七项 data-only 值与传输身份头；不带账号事实/媒体/品牌/凭证；接收端重新 parseComplete | 需重审（R-H） |
| B2.4c-02 | 六路分流 | Homed 不复制；CrossDeviceDuplicate 唯一可走 c；Released 交 d；Migrated 不产出；AuthorityUnavailable/UnsupportedBoundary 拒绝；InitialWorld 先排除 | 需重审（R-H） |
| B2.4c-03 | 权限门槛与账号事实隔离 | 接收账号经 AccountMilestoneReader 校验 CopyPermission；无权限拒载；账号事实不进载荷不写接收世界 | 需重审（R-H） |
| B2.4c-04 | 新 UUID 重键与继承 | 目标 world-UUIDv4、import-UUIDv4 事务；源 accountId 保持；七项重键；FormatTime 原值；Inherited；Primary/null 静止 Complete 才支持 | 需重审（R-H） |
| B2.4c-05 | 服务先登记与归属不变 | registerWorldHome 幂等 registrationId；目标 HomeDevice=接收设备、源不变；HomeConflict 永远拒绝；不是迁移 | 需重审（R-H） |
| B2.4c-06 | 两域提交与锁顺序 | 导入锁→目标 lease→目录锁；目录追加本地唯一发布点；服务 await 不持锁；A 导出单独持来源 lease | 需重审（R-H） |
| B2.4c-07 | 崩溃恢复与幂等 | 日志前无副作用；各 phase 幂等恢复；目录原子写异常以回读判定；Published 后不删除不伪装撤销 | 需重审（R-H） |
| B2.4c-08 | 恢复与打开门控 | 恢复以 journal+权威 proof+当前归属+lease+一致性协调；已发布服务缺失/冲突先拒开；篡改阻断；不删除已发布世界 | 需重审（R-H） |
| B2.4c-09 | 组合原型与身份边界 | 同 realm A/B 共享一个 ContractAdapter、B 独立存储命名空间；面板标注受限；不冒充物理双设备或外部认证 | 需重审（R-H） |
| B2.4c-10 | 三门禁、契约与保护 | 三条门禁 0 ERROR；契约 87/87 PASS；Creator 双逻辑设备两档各 11 张截图；保护路径 603→621 SHA 全保持 | 需重审（R-H） |

## 12. B2.4d 系列（同 ID 迁移+RealityPause，10 项，VERDICT-326~345）

| 编号 | 标题 | 一句话内容 | 重构后是否仍适用（机械判定） |
| --- | --- | --- | --- |
| B2.4d-01 | 同 ID 迁移边界 | WorldMigration 转移同账号同 worldId 的 HomeDevice；不重键/不 rebase/不改七项；不要求 CopyPermission；InitialWorld 不迁移 | 需重审（R-H） |
| B2.4d-02 | 独立 d 权威端口与旧契约保护 | 新增 MigrationAuthorityPort/ContractAdapter，不扩旧 b/c 契约；d 准入读同一持久权威；旧 c 操作受 d guard | 需重审（R-H） |
| B2.4d-03 | SafePoint 排空确认全集合 | DrainConfirmation 覆盖源设备账号全部未删世界（含 InitialWorld/空世界）；仅迁移世界须 Primary 七项 Complete；不忽略活动图 | 需重审（R-H） |
| B2.4d-04 | 活动自然排空与能力世代 | 单次排空世代能力；排尽在途世界/账号事实；未排空清单明确；不强制结束谱面/不跳过揭示/不清计时 | 需重审（R-H） |
| B2.4d-05 | 确认失效与 30 秒服务寿命 | 确认随世代/集合变化/恢复写入/显式撤销失效；服务侧 30 秒有效期；Release 原子消费；migrationId 可查 | 需重审（R-H） |
| B2.4d-06 | Release/Claim 请求与 receipt | 请求严格版本化；账号/device 绑定来自端口；Receipt.kind=PauseActive/Released/Claimed 含证据 | 需重审（R-H） |
| B2.4d-07 | RealityPause 记录、版本递增与服务时钟 | Pause 记录含服务起止时刻；Released +1 / Claimed +2；冷静期 max(1h, OfflineGrace) 只由服务时钟判定 | 需重审（R-H） |
| B2.4d-08 | 全账号暂停准入与设备绑定 | 全账号拒绝新进入/创建/删除/分叉/导入/迁移/新演奏/新叙事；活动自然退场；DeviceAccountBinding 服务持久 | 需重审（R-H） |
| B2.4d-09 | 受限载荷、journal、锁序、源字节与恢复 | data-only 七项载荷；MigrationJournal 五 phase；独立 key 与协调锁；源字节不改不删；逐 phase 恢复；无 WebLocks 拒绝 | 需重审（R-H） |
| B2.4d-10 | 三门禁、契约回归与双档验收 | 三条门禁 0 ERROR；新增契约 106/106、c 回归 65/65；Creator 双逻辑设备全链两档共 34 张截图；fixture 时钟非真实等待 | 需重审（R-H） |

## 13. B2.4e 系列（端到端验收轮，10 项，VERDICT-346~355）

| 编号 | 标题 | 一句话内容 | 重构后是否仍适用（机械判定） |
| --- | --- | --- | --- |
| B2.4e-01 | 纯验收轮与零新增冻结 | e 仅完成端到端/双档/回归/门禁/保护证据；不改 production/docs/名库/参照/门禁；新增冻结名 0 | 需重审（R-H） |
| B2.4e-02 | PROTOCOL 闭合与审计诚实 | P1~P4 闭合；d 历史 SHA 差异与旧诊断保持原值；e 审计单列 TraeAuthorized 且 rawHashEquality=false | 需重审（R-H） |
| B2.4e-03 | 归属分层与 InitialWorld 边界 | WorldHomeRegistry 服务归属权威、WorldRegistry 本机位置层；InitialWorld 不登记不传输但纳入排空与暂停 | 需重审（R-H） |
| B2.4e-04 | 同一主链 c+d 双目标独立 | 同一持久权威同一条 Creator 主链先验 c 复制再验 d 迁移；两目标 worldId 不同、各有独立 Core/目录/receipt | 需重审（R-H） |
| B2.4e-05 | 同 ID 迁移链沿用与打开鲜读 | 沿用 d 全链至正式 Restored/Complete；目录追加唯一本地 commit point；源不改不删；打开鲜读当前归属 | 需重审（R-H） |
| B2.4e-06 | 服务时钟权威与一小时标签 | Pause 时长仅服务时钟裁决；主链推进 fixture 3600000ms 并标注 realElapsedHour:false；不是真实等待 | 需重审（R-H） |
| B2.4e-07 | 全账号暂停拒入与活动自然退场 | 同一 Pause 下全部世界拒新准入；发起设备绑定跨窗口重建存活；活动保留必要输入与原生媒体自然时序 | 需重审（R-H） |
| B2.4e-08 | 契约回归 227/227 | 隔离副本重跑 b/c/d 契约合计 227/227 PASS / 0 FAIL；127 个生产 TS 路径前后 SHA 不变 | 需重审（R-H） |
| B2.4e-09 | Creator 双档实际运行 40 张截图 | 双档独立干净 profile 从登录/序章/通关/Fork 开始经 c+d 后正式打开；40 张 CDP PNG；编译首尾不变；错误与外部请求 0 | 需重审（R-H） |
| B2.4e-10 | 三门禁、源码保护与 B2.5 剩余 | 三条门禁 0 ERROR；643 路径终态一致、productionFileCount=0；唯二字节变化为授权 Markdown 同步；FileCarry/真实服务留 B2.5 | 需重审（R-H） |

## 14. B2.5b 系列（真实认证服务，10 项，VERDICT-376~390）

| 编号 | 标题 | 一句话内容 | 重构后是否仍适用（机械判定） |
| --- | --- | --- | --- |
| B2.5b-01 | 阶段恢复与 b 授权边界 | 仅 b 授权范围准入；允许新契约/type-only 导出/独立组合根/模式分流；不放宽旧 guard；不自动构成 c/d/e/f | 需重审（R-H） |
| B2.5b-02 | P6 外部报告归因闭合 | 两份 B2.4-overall-report 确认为 Trae 授权落盘；仅追加归因不回写旧观测；rawHashEquality=false | 需重审（R-H） |
| B2.5b-03 | 真实端口与 ExternalService | 新增三个真实端口，mode 逐字 ExternalService；旧 ContractAdapter 联合与同步签名原样保留；两个端口仅类型定义 | 需重审（R-H） |
| B2.5b-04 | 真实权威不承载世界 payload | 服务仅允许账号事实/归属/暂停/设备绑定/幂等/摘要/receipt；禁存世界文件/七项/媒体；无 readMigrationPayload | 需重审（R-H） |
| B2.5b-05 | 独立 server 包与真实运行时 | server/ 独立包（Node 24/Fastify 5/PG 17）；真实 loopback HTTP；独立锁文件/构建/测试；不进客户端门禁 | 需重审（R-H） |
| B2.5b-06 | 认证与注册设备凭据 | Argon2id 密码；P-256 RegisteredCredential challenge 持有证明注册/登录；generation=1；账号仅管理员 CLI 创建 | 需重审（R-H） |
| B2.5b-07 | 会话、刷新与登出 | 不透明凭据 DB 只存摘要；访问 15 分钟/刷新家族 7 日；旋转单次刷新+重用检测；HttpOnly/SameSite=Strict；登出清缓存 | 需重审（R-H） |
| B2.5b-08 | 签名服务器时间 | fetchServerTime 逐字签名；仅真实已认证服务 ES256(P1363) 签名 receipt 投影 epochMs；AuthorityTrustAnchor 引导；失败拒绝 | 需重审（R-H） |
| B2.5b-09 | 轻量账号/设备事实与组合根窄边 | 只读 RealAccountFacts 与设备事实；严格字段白名单；buildRealAuthService 独立装配；旧 Builder/会话/guard 不改 | 需重审（R-H） |
| B2.5b-10 | 三门禁、真实证据与延期项 | 三条门禁 0 ERROR；server 真实 PG17+HTTP 正反例；客户端契约 24/24、真实 6/6、server 16/16；Relay/FileCarry 等延期 | 需重审（R-H） |

## 15. P3 系列（共享契约补冻·纯文档，10 项，VERDICT-391~410）

| 编号 | 标题 | 一句话内容 | 重构后是否仍适用（机械判定） |
| --- | --- | --- | --- |
| P3-01 | 纯文档补冻范围与规范来源 | 仅 quality-review 规范与审查证据；零生产变更；schemaVersion=1、profile=ExternalSharedOnlineV1；v1 覆盖有限地图/Trigger 子集 | 需重审（R-H） |
| P3-02 | 二元身份与序号段边界 | WorldCommitIdentity=authorAccountId+authorSequence；1024 号段/3600000ms；只消费不归还；旧三元拒绝不迁移 | 需重审（R-H） |
| P3-03 | AppendedAt、总序与三类精确变化 | 服务签名 WorldAppendPermit 给逻辑追加时刻（30000ms 有效）；总序 epochMs→账号 ASCII→序号；三类变化严格映射 | 需重审（R-H） |
| P3-04 | 稳定对象合并与 DeveloperRoster/注销 | 稳定 UUID 永不复用；milli WorldMeter 仅 wire 表达；后序修改/删除胜；tombstone 不复活；名单权限按总序 | 需重审（R-H） |
| P3-05 | WorldRelayKey 分域加密与 AccessCode 首次准入 | 成员域 256-bit 群 key 绑 world/epoch；每 commit 随机 DEK、HKDF/AES-256-GCM、ES256 签名；6 位 AccessCode 授首次 Observer | 需重审（R-H） |
| P3-06 | 成员 epoch 密钥交接与 TraceTouch 聚合 | ECDH P-256 包经临时 ECDH/HKDF/AES-GCM 精确绑定；epoch 原子激活；TraceTouchAggregate uint128 精确总量+饱和强度 | 需重审（R-H） |
| P3-07 | WorldChangeLog 与 B2.4 journal 关系、Checkpoint 精确覆盖 | 三类日志不统一不互转；Checkpoint 覆盖=完整时间前缀+精确身份/摘要；陌生 checkpoint 无证明不授 Complete | 需重审（R-H） |
| P3-08 | 迟到、封边不复活与 SettleHorizon 有限延迟 | seal≤S−H 单调；封边不复活；迟到沿 028 个人三元；H≥G+B+U、retention≥H；初始 G/B/U/H/retention 政策值 | 需重审（R-H） |
| P3-09 | Relay 边界降级与 ObserverSync 实施分段 | 客户端 HTTP pull 长轮询；bounded 密文队列+轻量摘要；不存 state/key/正文；B2.5c 分 c-1/c-2/c-3 各需授权 | 需重审（R-H） |
| P3-10 | 三门禁、SHA 保护归因与不变式延期闭合 | 三条门禁 PASS；raw FAIL 保留、两项 docs 经用户确认授权归因闭合；全部不变式沿用；P4/P5/旧三元迁移各有前置 | 需重审（R-H） |

## 16. B2.5c-1 系列（契约与确定性重放，10 项，VERDICT-411~425）

| 编号 | 标题 | 一句话内容 | 重构后是否仍适用（机械判定） |
| --- | --- | --- | --- |
| B2.5c-1-01 | 五份独立源码与文件边界 | src/director 下五份 Shared* 源码+隔离测试；IntentPort 仅尾部 type-only 追加；服务器/旧主链/编辑器不接入 | 需重审（R-H） |
| B2.5c-1-02 | 数据契约与旧服务契约分离 | SharedCommitContracts 逐项落实 54 种 schema；schemaVersion=1/ExternalSharedOnlineV1；拒绝旧三元；旧契约原状 | 需重审（R-H） |
| B2.5c-1-03 | Codec 与 canonical 字节边界 | Codec 三入口精确 schema；CanonicalBytes 手写 UTF-8/JCS 安全整数子集唯一字节；decode 重编码逐字相同；深度上限 128 | 需重审（R-H） |
| B2.5c-1-04 | 验真模块与注入密码学端口 | SharedCryptoPort 四方法；上下文由可信调用方安装信任根；Verified/Gap/HostFailure 三结果；零平台依赖 | 需重审（R-H） |
| B2.5c-1-05 | 七个签名/AAD 域与 AEAD 绑定 | 七个域字面量（真实 NUL 结尾）固定；ES256 P1363、nonce 12B、tag 16B；拒绝签名材料重用 | 需重审（R-H） |
| B2.5c-1-06 | 来源失败、坏正文与主机故障分流 | validateCommit 精确顺序执行；坏正文形成 invalid 本地能力；缺 key/字节/摘要为 Gap；backend 异常为 HostFailure | 需重审（R-H） |
| B2.5c-1-07 | 确定性重放、封边与三类变化 | SharedWorldReducer 从受信 Genesis/parent 重放；结果不依赖输入顺序；无 seal 不生成 checkpoint；三类变化语义固定 | 需重审（R-H） |
| B2.5c-1-08 | 触痕边界、coverage 与本地可信 checkpoint | TraceTouch 限 Normal 资格；uint128 总量与饱和渲染分离；seal 满足 cutoff≤S−H 等才建 checkpoint；registry 仅内存 | 需重审（R-H） |
| B2.5c-1-09 | 隔离测试与真实密码学证据 | 154/154 PASS；严格隔离编译 ES2020；网络尝试 0；IntentPort 追加前后运行时 JS 字节相同 | 需重审（R-H） |
| B2.5c-1-10 | 三门禁、SHA 归因闭合与遗留边界 | 三条门禁 0 ERROR/45 WARN；SHA raw FAIL 保留、两项 docs 归因闭合；c-2 需新授权与真实前置 | 需重审（R-H） |

## 17. 统计

| 判定 | 数量 |
| --- | --- |
| 保留 | 1（AC-29） |
| 需重审 | 176 |
| 废止 | 9（AC-15 ~ AC-21 共 7 项 + AC-27、AC-28 共 2 项） |
| 待裁定 | 0 |
| 合计 | 186 |

分系列计数复核：AC-01~30 = 30（需重审 20 / 废止 9 / 保留 1）；ME-01~19 = 19；B1-01~11 = 11；B2.1 = 10；B2.2 = 13；B2.2c = 10；B2.2d-1 = 5；B2.2d-2 = 8；B2.3 = 10；B2.4 = 10；B2.4c = 10；B2.4d = 10；B2.4e = 10；B2.5b = 10；P3 = 10；B2.5c-1 = 10。合计 186。
