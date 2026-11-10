# B2.2c 正式内容来源与制作证据

2026-10-10，内容版本 `1.0.0`。这是本批新制作的 Primary 世界片段与世界之曲，不改旧 T6/T7 灰盒数据或现有 Regular 谱面。

## 原创世界片段

`assets/resources/world/primary-rain-dialogue.json` 独立声明 `worldKind=Primary`、主角 `protagonist-1`、完整二十维零球心及有限正 `EventDistance=3`。故事《雨中遗失的名字》发生在旧站台：同伴丢失了等候者的名字，玩家选择共同避雨、读车票找回约定或作出同行承诺。

每个分支都包含完整二十维非负向量，制作方明示选择 ID、叙事文本、情感解释和内容来源/版本。表现层只显示文本并提交 `ChooseWorldNarrative{choiceId}`，没有向量编辑器、直接穿越按钮或通关权限 setter。

| 选择 ID | 叙事结果 | 制作方主要情感标注 | 球心距 |
| --- | --- | --- | --- |
| share-shelter | 用陪伴缓和等候的恐惧 | Green=3.2；Blue 保留悲伤，Trust/Closeness/PlayerEmpathy 记录共同避雨 | 4.018706259482024 |
| read-ticket | 读车票找回失去的约定 | Blue=3.2；Trace/Understanding/TruthLevel 记录追忆与读出的约定 | 4.115823125451335 |
| keep-promise | 承诺陪她等雨停后一同出发 | White=3.2；Red 记录主动承诺，Trust/Closeness 记录新的同行 | 4.092676385936225 |

以上是该片段已发布的手工标注，不建立全项目通用情感推断。二十维顺序沿用 `NarrativeDimension`：Red / Green / Blue / Black / White / Grey / Initial / Process / Trace / Highlight / Commented / Residue / Trust / Closeness / Understanding / Conflict / TruthLevel / NarrativeTime / InfluenceRadius / PlayerEmpathy。非情感分量分别表示相遇的开端、同行推进、记忆痕、醒目片刻、对话回应、余韵、信任、亲近、理解、冲突、约定真实性、叙事时间推进、影响范围与玩家共情；无对抗情节时 Black/Conflict 为零。所有分量绑定这一次实际玩家回应，不从分辨率、坐标像素或得分推导。

## World 谱面与媒体

制作脚本 `quality-review/b2-world-clear/content-build.cjs` 实际调用既有生产者与编辑器 API：

1. 原创音乐工程经 `MusicEditorSession.LoadProject` 加载。
2. `MusicEditorSession.exportSource()` 生成带快照 revision、Midi 来源和既有布局版本的 `ChartSourceData`。
3. 从该源建立原生 `tier=World` 草稿，调用 `GuidanceEditorSession.LoadDraft`。
4. 调用既有 `GuidanceEditorSession.exportChart()` 导出最终玩法 JSON 和视觉伴随 JSON。

脚本没有修改编辑器核心，没有先读取 Regular 再改 tier，也不在运行时改 tier。结果是 `schemaVersion=3 / tier=World / chartId=primary-rain-world-1`，一条引导线、五个正式 Tap 节点，绝对卡点来自同一原创音乐工程。草稿自身即 World。

《雨后回响》原创音高序列 C4/E4/G4/A4/G4/C5，以 100 BPM 的六个时刻构成六秒短曲；媒体由同一导出源的音高、力度与绝对时间合成钟音，加确定性的轻雨纹理。PCM WAV 为 22050 Hz / 单声道 / 16 bit / 6000 ms，无借用采样或外部媒体。表现层接收 Cocos `resources.load` 得到的 `AudioClip.nativeUrl`，由 `HTMLAudioElement` 正常播放并读取 `currentTime` 与真实 `ended`。

| 文件 | 用途 |
| --- | --- |
| content-music-project.json | 原创音乐工程输入 |
| content-chart-source.json | 既有音乐编辑器实际导出源 |
| content-world-draft.json | 原生 World 草稿，包含来源、选择、媒体引用 |
| assets/resources/chart/primary-rain-world-1.json | 既有引导线编辑器实际导出的 World 玩法内容 |
| assets/resources/chart/primary-rain-world-1.visual.json | 同次导出的节点颜色伴随内容 |
| assets/resources/audio/primary-rain-world-1.wav | 同源原创六秒媒体 |
| content-export-manifest.json | 出版链、内容版本、计数、媒体参数及七份产物 SHA-256 |

重新制作：在工程根执行 `node quality-review/b2-world-clear/content-build.cjs`。脚本确定性生成同样产物与 SHA-256，保留已有 Cocos meta/UUID。

## 表现层接口

`WorldClearView(reader, milestones, enqueue)`：`mount`、`setVisible`、`onFrameRefresh`、`destroy`。通过 IntentPort 只类型引用 WorldClearReader 与账号读面；玩家只能提交选择 ID、进入 World 之曲和失败后的保存重试意图。

`WorldChartView(premiere, enqueue, world?, milestones?)`：`bindChart(chart,layout,visual?)`、`bindMedia(AudioClip.nativeUrl)`、`mount`、`onFrameRefresh`、`readTimeMs`、`getMediaStatus`、`play`、`pause`、`stop`、`destroy`。Canvas 显示既有首演快照的键盘、路径、Head、JudgmentPoint、节点结果；图形不改变谱面或判定。开始/暂停/继续/退出响应 director 状态，媒体尚未真实 playing 时钟返回 -1。InputCollector 的物理键边沿仍由组合根送给 director，视图不代打。

## 本证据的验收边界

本文件证明内容来源、编辑器正式导出、资源归属及静态读/意图边界。脚本执行成功证明制作 API 可用、输出为合法 World v3 并满足二十维/半径配置。实际 Cocos 生产链路、真实玩家输入、正常媒体结束、账号写入、重复/退出行为及两档分辨率验收由本批主交付的预览截图与运行记录独立证明；本文件不代替生产验收。
