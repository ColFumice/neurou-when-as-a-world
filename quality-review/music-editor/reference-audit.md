# 第 31 批 ColorMusic 只读功能审计

审计日期：2026-10-10（Asia/Shanghai）。本审计只写本报告；未修改 ColorMusic、参照源码包、docs、名库或业务源码。结论供 ARCHITECT 裁定与实现使用，引用的 ColorMusic 原名不因此获得《雨若》名库冻结身份。

## 已重新读取的筛选报告

此前筛选报告与源码包位于 [colormusic_mode_code.txt](D:/Project/A_New_Begin/colormusic_mode_code.txt:1)，不是 Neurou 工程内的独立 Markdown。文档前 50 行说明其范围和移植边界；4982 行起给出 107 个功能索引（A～I）。报告 8 行明确“收录不等于批准整块进入 T7”；13～15 行要求新名称重新审计、不得把原宿主字段或 cc/Java 类型整段粘入逻辑层。功能编号与当前源文件行号已交叉核对。

SHA-256：`5BA868183FB8B6454AB15823002071063057C8A04B7A1577431DFDA860ED3C23`。

本轮最小交付可适配 MIDI 音高→频率、音名显示及 BPM / 拍号数学；时间轴音符 CRUD、音乐草稿、undo/redo、契约转换需新实现。ColorMusic 只有触摸 noteOn/noteOff、颜色合成及音频片段混音台，未找到 SMF `.mid` 文件解析、MIDI tick/tempo map 导入或独立钢琴卷帘音符编辑器，不能将这些标成“已有代码移植”。

## 功能提取与裁定建议

| 筛选编号 / 功能 | 当前原代码与精确位置 | 本轮结论 | 翻译边界 / 说明 |
|---|---|---|---|
| B-025 MIDI 音高→Hz | [SynthMapping.ts](D:/Project/A_New_Begin/ColorMusic/assets/scripts/SynthMapping.ts:134)，`midiToFreq` 134～136 | 最小试听可移植数学 | `440 × 2^((pitch−69)/12)`；先严格验证 MIDI 整数 0～127。平台播放保留在 presentation。 |
| B-027 音高→音名 | [SynthMapping.ts](D:/Project/A_New_Begin/ColorMusic/assets/scripts/SynthMapping.ts:146)，`midiToName` 146～150；音名表 145 | 最小 UI 可移植数学 | 音名 octave=`floor(pitch/12)−1`；不从屏幕坐标反推已编辑的音高。 |
| B-024 / 026 坐标→音高/音量 | [SynthMapping.ts](D:/Project/A_New_Begin/ColorMusic/assets/scripts/SynthMapping.ts:128)，`uvToMidi` 128～131、`uvToVolume` 139～142 | 延期至网格编辑器 | ColorMusic 36～96、0.06～1 是原项目数值，不是雨若冻结值；真实 MIDI 输入允许 0～127。 |
| B-006 / 009 / 010 / 011 网格→调式 MIDI | [GridSettings.ts](D:/Project/A_New_Begin/ColorMusic/assets/scripts/GridSettings.ts:6)，预设 6～19、`nearestScaleMidi` 30～44、`scaleNotesInRange` 46～53、`scaleMidiForCell` 55～60 | 可移植纯数学，完整编辑 UI 延期 | 网格选择音阶及 pitch；契约 position 必须由既有键盘布局映射，不能用 ColorMusic 的原屏幕网格取代 KeyboardPadLayout。原模块混有 cc / localStorage，不能整文件导入。 |
| B-020 / 021 格线归属、行中心→音量 | [GameManager.ts](D:/Project/A_New_Begin/ColorMusic/assets/scripts/GameManager.ts:6301)，`gridCellIndex` 6301～6304；演奏覆盖 6507～6515 | 归属数学已用于视频谱面；音量映射延期 | 格线等值归右/上格；行中心比例 `(row+.5)/rowCount`，随后 `volumeMin + ratio × (volumeMax−volumeMin)`。amp 0～1 和 MIDI velocity 0～127 需显式转换，不能同名复用语义。 |
| D-038 RGB 均匀度 | [SynthMapping.ts](D:/Project/A_New_Begin/ColorMusic/assets/scripts/SynthMapping.ts:51)，`pielouEvenness` 51～63 | 延期，允许未来纯函数适配 | Shannon / ln(3)；纯黑（sum<1）返回 1；纯色返回 0；灰色返回 1。输入须先验证 sRGB 整数，不能依赖原 clamp 掩盖 NaN。 |
| D-039 RGB→质感 / 音色参数 | [SynthMapping.ts](D:/Project/A_New_Begin/ColorMusic/assets/scripts/SynthMapping.ts:66)，`toneFromARGB` 66～122；`ToneParams` 29～48 | 延期至 RGB 波表阶段 | avg→cutoff=`1000+avg×17000`；even→attack=`.2+(.005−.2)×even`；均匀度/亮度决定 drive、reverbMix、decayScale。参数与波表资产是音色层，不是 ChartSourceData 的显示 RGB 或计分。 |
| D-039 亮/暗鼓权重 | [SynthMapping.ts](D:/Project/A_New_Begin/ColorMusic/assets/scripts/SynthMapping.ts:74)，74～79 | 延期 | 三通道均 >200 为亮区、均 <55 为暗区；鼓权重抑制效果。可参考参数数学，不能据颜色创建雨若 Drum/Heavy 判定节点。 |
| E-045～060 特殊颜色效果槽与预设 | [Effects.ts](D:/Project/A_New_Begin/ColorMusic/assets/scripts/Effects.ts:16)，常量/条件 16～50；`FxDef/FxSlot` 53～69；默认参数/曲线 132～169；推荐链 292～314 | 延期，数据与触发数学可独立适配 | 原文件 import sys from cc、持久化、下发宿主不能移入逻辑层。触发条件以代码为准，不能用文件头旧简写。 |
| E-063 实际特殊颜色触发 | [AudioSynth.java](D:/Project/A_New_Begin/ColorMusic/native/engine/android/app/src/com/colormusic/game/AudioSynth.java:1399)，`rebuildActiveFx` 1399～1433 | 仅提取公式，DSP 不移植 | 八输入=六个通道亮/暗槽、even、avg；效果深度=`(invert?1−input:input) × intensity × (1−drumWeight)`。拓扑/音频线程/DSP 不移植。 |
| F-065 / 066 谐波音色预设 | [Effects.ts](D:/Project/A_New_Begin/ColorMusic/assets/scripts/Effects.ts:347)，`InstDef/PRESET_INST` 347～368；`presetWaveFor` 370～391 | 延期至 RGB 波表阶段 | 11 种谐波定义；256 点正弦叠加→去直流→峰值归一化。原样生成数学可转为纯函数；256 不是本轮冻结参数。 |
| F-068 波表幅度 / 周期 | [GameManager.ts](D:/Project/A_New_Begin/ColorMusic/assets/scripts/GameManager.ts:2477)，`applyWaveAxes` 2477～2487 | 延期 | 循环波表的周期坐标，不是音符时长或音轨时间。 |
| F-069～071 手绘波表 | [GameManager.ts](D:/Project/A_New_Begin/ColorMusic/assets/scripts/GameManager.ts:2572)，`addWavePoint` 2572～2587；`drawWaveStroke` 2590～2605；`rebuildWaveFromPoints` 2611～2667 | 延期 | 重建=逐段插值、3 轮 5 点平滑、去直流、按绘制高度映射；刻意不做峰值归一化，横线产生静音。点输入/渲染归 presentation，纯重建算法归 editor。 |
| F-072～075 归一化 / 正弦 / 随机 / 经典 | [GameManager.ts](D:/Project/A_New_Begin/ColorMusic/assets/scripts/GameManager.ts:2670)，2670～2712 | 延期 | 随机预设需要种子或保存结果以保证可恢复；不可拿原 Math.random 输出冒充确定性导出。 |
| G-080 / 085 真实音轨 min/max | [NativeBridge.ts](D:/Project/A_New_Begin/ColorMusic/assets/scripts/NativeBridge.ts:44)，`AudioWaveformData` 44～47；[NativeBridge.java](D:/Project/A_New_Begin/ColorMusic/native/engine/android/app/src/com/colormusic/game/NativeBridge.java:1256)，`pcmWaveformJson` 1256～1313 | 延期至真实音轨导入 | 可借 min/max envelope 算法：bin=floor(frameIndex×binCount/totalFrames)，所有声道逐样本取 min/max。原 16 位 PCM WAV 读取、Android 解码、线程、JNI 回调不移植。 |
| G-089～095 波形裁剪 / 源比例 / 绘制 | [GameManager.ts](D:/Project/A_New_Begin/ColorMusic/assets/scripts/GameManager.ts:4043)，4043～4093；绘制 4383～4413、5413～5448 | 延期 | 未来 envelope 归只读音轨资源，裁剪比例纯数学归 editor、cc Graphics 绘制归 presentation。256 点鼓预览不是真实 PCM envelope。 |
| H-096 / 101 鼓目录及授权 | [DrumLibrary.ts](D:/Project/A_New_Begin/ColorMusic/assets/scripts/DrumLibrary.ts:1)，1～6；[THIRD_PARTY_DRUM_SAMPLES.md](D:/Project/A_New_Begin/ColorMusic/THIRD_PARTY_DRUM_SAMPLES.md:1)，1～42 | 本轮不复制；未来可选资产 | 29×256 预览点是缩略波形，不是 WAV；不能直接循环合成为真实鼓音色。未来复制 WAV 必须按资产 ID 保留来源/许可映射。 |
| I-102 BPM / 拍号间隔 | [GameManager.ts](D:/Project/A_New_Begin/ColorMusic/assets/scripts/GameManager.ts:1943)，`metronomeBeatSeconds` 1943～1945 | 可移植数学 | 原分母拍=`60/BPM × 4/beatUnit`；若音乐工程 beat 采用四分音符单位，则每 beat=`60000/BPM`，每小节 beat 数=`numerator×4/denominator`。两种不能混用。 |
| I-103 重音 | [GameManager.ts](D:/Project/A_New_Begin/ColorMusic/assets/scripts/GameManager.ts:4158)，`mixerBeatAccent` 4158～4163 | 可适配显示 / emphasis 数学 | 首拍=2；分母 8 且 numerator>=6、为 3 倍数时每三拍次重音=1；其余 numerator>=4 的中间拍次重音=1。规范先明确 beat 单位，不能直接传四分音符 beat 到原分母拍算法。 |
| I-104～107 挂钟呼吸 / 原点击合成 | [GameManager.ts](D:/Project/A_New_Begin/ColorMusic/assets/scripts/GameManager.ts:1947)，1947～1971；[AudioSynth.java](D:/Project/A_New_Begin/ColorMusic/native/engine/android/app/src/com/colormusic/game/AudioSynth.java:1010)，1010～1032 | 原运行链不移植 | 浏览器挂钟、outputSampleClock、原合成点击不成为玩法判定时间真源；最小试听应独立适配资源输出。 |

## 发现的原代码语义差异

1. `toneFromARGB` 第 70 行计算 a01，但未用于返回参数。文件头“Alpha→表情”和 decay 注释仍有旧含义；当前实际公式以 RGB evenness 替代。翻译不得声称 alpha 仍驱动包络，冻结 NoteColor 也只有 r/g/b。
2. `toneFromARGB` 第 82～92 行亮/暗效果使用 else-if，并列最大/最小值时 R 优先；Java `rebuildActiveFx` 第 1404～1409 行分别判断，允许并列通道同时触发。这是原项目两套效果路径，未来效果器裁定必须明确采用哪套。最小交付延期，不合并它们。
3. `metronomeBeatSeconds` 的 beat 是拍号分母拍；`clipBeats` 第 4027～4036 行与播放头第 5234 行的 beat 使用四分音符单位（seconds×BPM/60）。统一音乐工程应显式冻结 quarter-note beat，拍号只决定小节和重音，或为各调用边界执行换算。直接照搬混音台会在 6/8 等拍号产生语义错误。
4. ColorMusic 默认 MIDI_MIN/MAX 36/96、GridState 30×12、BPM 20～320、256 点波表、16/32 点效果曲线均为宿主约定。最小交付可有显式工程 schema 约束，但不能冒称名库已经冻结。
5. 原 `SynthMapping.ts` 虽标注“纯函数”，实际第 16 行导入 I18n；Effects/GridSettings 混有 cc。只能摘取算法并重新验证输入，不能建立雨若→ColorMusic import 依赖。

## 最小交付使用的数学（规范性翻译，不冒充原代码）

```ts
// beat 明确为四分音符拍；所有输入先经严格 schema 验证。
const timeMs = startBeat * 60000 / bpm;
const endTimeMs = (startBeat + durationBeats) * 60000 / bpm;
const frequencyHz = 440 * Math.pow(2, (pitch - 69) / 12);
const beatsPerBar = numerator * 4 / denominator;
const denominatorBeatIndex = quarterNoteBeat * denominator / 4;
```

原 I-102 分母拍间隔与上述 quarter-note 时间换算相容，因为分母拍所占 quarter-note beats=`4/denominator`。测试至少应覆盖 120 BPM 的 beat 1→500ms，6/8 每小节→1500ms，以及修改 BPM 后事件时间统一重算。

## 雨若契约与不变式对接

- 数据生产链建议是音乐工程→纯逻辑 ChartSourceBuilder→冻结 ChartSourceData schema 1；继续使用 `provenance: 'Midi'`，绝不标 Mock。MusicProject 保留 beat / 音轨 / 音符，ChartSourceData 只接收完成时间/位置/颜色映射的事件；二者各有用途，不合并 schema。
- [GuidanceEditorSession.ts](D:/Project/A_New_Begin/Neurou_official/src/editor/GuidanceEditorSession.ts:13) 已冻结 MidiNoteEvent / ChartSourceData / NoteColor。必须复用这些类型与 `parseChartSourceData`，不改字段、不新增 Wave/tempo 等未知字段。色彩保持 sRGB uint8，不关联 TrailColor、ElementType、EmotionToTrailColor 或计分。
- 冻结 parser 第 98 行要求至少 2 个事件；既有引导线导出第 204 行要求每条 line 至少 2 个事件且首事件为 Head；第 230 行要求普通节点落入有效键盘网格。生产者应在可消费导出边界验证这些约束，空轨、单音轨不得偷偷补造音乐事件。音乐草稿可保留不完整状态，但导出须说明错误。
- 有效位置从已有 KeyboardPadLayout / KeyPadSlot 中心取得。波表负责音色，网格负责 pitch/velocity 与位置映射，音轨负责音符时间；原图像 content UV 与演奏 grid UV 保持分离。
- 一条线的路径仍必须符合 GuidanceChart 既有验证。同位置连音、同刻和弦等音乐结构不能通过修改消费者核心规避；需要明确分线映射或在导出时拒绝具体不兼容组合。
- undo/redo 是音乐编辑器草稿历史，不是账本。只有 director 追加账本；音乐编辑、试听、导出、移交消费不连接 director/ledger，不改变世界运动门控或 T6/T7 判定。
- 逻辑代码零 cc，零 DOM/WebAudio/文件系统；presentation 保留浏览器下载、输入采集、试听输出和 cc 渲染。组合根创建 session 并接窄接口。图形主题可复用 FolderPresentationTheme，不能让逻辑读取主题。

## 名库 v3.2 审计

已读取 [NAMEBOOK.md](D:/Project/A_New_Begin/Neurou_official/docs/NAMEBOOK.md:579) 第 579～693 行，含 v3.0/v3.1/v3.2。SHA-256：`E7D43750F96CEF360B83F1711679E49B4F0CF0C4332559D07784782A56DB8350`。

1. 优先复用 `NoteColor`、`MidiNoteEvent`、`ChartSourceData`、`GuidancePosition`、`KeyboardPadLayout`、`FolderPresentationTheme`。名库明确不新增 `GridPosition`、`UndoStack`、`EditorDraft`。音乐历史结构需领域限定，或提案扩展已冻结 EditorHistory，不能把 GuidanceEditor 专属选择历史硬套为 MusicProject history。
2. 界面名使用 View / Panel；运行实例用 Session / Runtime；UI 选择用 Focus / Selection；日志用 Log。裸 Event / Developer / Rain 禁止；不能以 WaveWindow 命名界面。
3. 目录 ID `MusicEditor` / `RgbWavetableEditor` / `GridEditor` / `MidiTrackEditor` 已冻结，但只代表 presentation 目录身份，不自动批准同名实现类。三个 UI 标题沿用“音乐编辑器”“RGB波表编辑器”“网格编辑器”“MIDI以及音轨编辑器”。
4. 未来候选 MusicEditorDocument / MusicProject / WavetableDefinition / GridDefinition / TrackDefinition / NoteDefinition / ChartSourceBuilder 均未在 v3.2 冻结；本轮需单列附录提案和机器新增命名清单。为了避免 generic Track / Note 与已有叙事 Note 混淆，领域限定的 MusicTrackDefinition / MusicNoteDefinition 更清晰，最终由本轮裁定。
5. `GuideOpacity` 禁用，必须使用 GuideTransparency。歌曲编辑 RGB/velocity 不改变 GuideTransparency 或判定窗口；v3.2 的 100/200ms、Head 1000ms 完全保持。

## 模块与范围建议

初始只读审计表明现有 editor 的允许边足以容纳最小实现，但 ARCHITECT 已明确选择独立 musicEditor，以隔离音乐创作/历史与引导线节点选择职责；本报告服从本轮最终裁定，先前“可并入 editor”仅是方案评估。

最终边提案：musicEditor→constants/chart 为 A；musicEditor→editor 为 R（仅 type 共享冻结 ChartSourceData / MidiNoteEvent / NoteColor）；presentation→musicEditor 为 R + I（仅 import type Reader / Intent / Port）。editor→musicEditor 禁止，其他业务逻辑→musicEditor 禁止；musicEditor→ledger/director/world/character/trace/presentation 禁止且零 cc。组合根 MusicEditorBuilder 可实例化两个隔离会话并通过既有 parseChartSourceData + GuidanceEditorSession 验证交接。新增模块必须同时纳入 E6 登记、E8 零 cc，以及新边的负向依赖测试；不扩张既有域权限。

§3 editor 当前职责文字只写引导线编辑器；§4 仍排除新音乐/地图/剧情编辑器。用户本轮已授权音乐编辑器最小交付，ARCHITECT 应正式裁定为本批范围例外，给 Trae 提出同步 §3/§4/§6/验收的文本提案；实施者遵守“不修改 docs”，只在 quality-review 出具提案。本轮独立 musicEditor 为显式新增矩阵行/列，既有边保持；最终裁定书与扩展提案是本批门禁扩展依据，正式真源文本仍由 Trae 同步。若实现越过上述窄依赖边，应先停止提交 PROTOCOL。

## 原代码与资产许可

用户已明确授权从本地 ColorMusic 提取功能数学；本审计未复制素材或发布原项目。ColorMusic 根目录未发现单独代码 LICENSE，故不能将用户本地源码的本轮适配授权扩张为未知第三方的通用发布许可。

[THIRD_PARTY_DRUM_SAMPLES.md](D:/Project/A_New_Begin/ColorMusic/THIRD_PARTY_DRUM_SAMPLES.md:1) 为 29 项 WAV 逐项列出 CC0 / royalty-free / Public Domain 来源，并声明可再分发；0x808、MckAudio、Stargate、Free Drum Samples 来源链接保留于原说明。未来如果复制 WAV，应保留具体 ID→源文件→许可对应证据与许可文件；品牌型号只用于说明来源/风格，不暗示背书。本轮采用原创/既有最小试听资源时，不应交付这些 ColorMusic 鼓资产或其生成工具运行产物。

## 已核对当前参考源 SHA-256

| 原文件 | SHA-256 |
|---|---|
| assets/scripts/SynthMapping.ts | 83AA85A18579312054FCF2B62BACF78FA1224F3968F5318307EE1E6F76DD5A97 |
| assets/scripts/GridSettings.ts | 32B57B37949D9BAB5A03580FF795BB4956D5FFD953877E137F09451F2A7AC82D |
| assets/scripts/GameManager.ts | 5BB44D36F643F59EE35F5622BE694CDAEF5092A113E63D03F4203C03BEC23996 |
| assets/scripts/Effects.ts | C6B383FF647A5728D8D5CA66CD8C03CD6AF24B13ED73B52A6796771F559B3E52 |
| assets/scripts/DrumLibrary.ts | AE0326F0C8EBCA627A4C1D4CBA293548290C80330A3EFFB30FCA3D258DA99C7E |
| THIRD_PARTY_DRUM_SAMPLES.md | 2BAE632C1A7F8C4DA1870A86F7A34C838FF2D9A0D8F44CF8DD03372B99251ADC |
| assets/scripts/NativeBridge.ts | 7AA0C4869A672D8C547F59C6874DEB9C76F77386F0F93C817D3020BA55F82553 |
| assets/scripts/FxUI.ts | 2EC28152174A61E5EB4F1B49B10ED9602116CFC97A5C7A9BBBC53B0DC7469E12 |
| native/engine/android/app/src/com/colormusic/game/NativeBridge.java | E0056853787D343C47B60BC8993CCD83D8EFBB3CDA1D2296DC19320372A762E7 |
| native/engine/android/app/src/com/colormusic/game/AudioSynth.java | F4B2CE293E2F8E5B86323ED16F2ECADB0B4209DFB105B11E867FED07A4BC7FF8 |
| tools/build-drum-library.mjs | A270C0C1690640651E99E9241DF31E8D45326073871F573BE7E1F43F66EDA7F0 |

不应移植列表维持：AudioTrack、实时 DSP、完整 AudioSynth/WebSynth、JNI/NativeBridge、Android 解码/导出线程、原 localStorage 键和宿主持久化逻辑。原声波和 min/max 数据都是创作/显示素材，不替代 gameplay Note.timeMs、统一媒体时间或既有判定链。
