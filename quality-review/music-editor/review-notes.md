# 第 31 批独立审查记录

2026-10-10。审查者只读实现、执行内存测试，未修改业务实现或 docs；本报告与 reference-audit.md / reference-hashes.json 是本审查写入的附件。代码持续并行更新，本记录区分已复核修复与仍需确认事项。

## 已确认的架构与数据边界

- musicEditor 仅 type 依赖 editor 的冻结 ChartSourceData / MidiNoteEvent / NoteColor；chart 值依赖只用于既有布局归属、路径数学；没有 cc / DOM / WebAudio / 文件系统 / director / ledger 引用。presentation 只以 import type 读取音乐 Reader / Intent / Port / 数据类型。
- parseMusicProjectData 逐层复制字段并深冻结，不冻结调用方。MusicEditorSession 复制布局；getDocument / getPlaybackNotes 返回深冻结快照。失败候选不提交 project/revision/history。
- history 上限 100，导入验证项目身份、完整快照链与 cursor 当前状态；Undo/Redo 不改原快照，新编辑截断 redo 分支；revision 单调增长。
- ChartSourceBuilder 拒绝单事件线、格外位置、无路径、首刻和弦、同刻不同位置；保留真实音乐事件身份，不补造 Head 或节点。音符 duration 不自动变成 Hold。
- MusicEditorBuilder 先执行冻结 parseChartSourceData、既有 LoadSource、真实 exportChart，成功才切换工作区；失败保留音乐会话。不同 session 分别管理音乐创作与引导线节点选择历史。
- 实际 Cocos 路径 `assets/scripts/src` 是 Junction，fs.realpath 指向根 `src`；根 `src` 为真实目录。四个新音乐逻辑文件经两条路径读取 SHA-256 一致。因此根模块扫描与 Creator 运行代码没有镜像漂移。

## 审查发现与修复状态

| 项目 | 初次发现与影响 | 最新复核 |
|---|---|---|
| 首帧覆盖已有草稿（P1） | 默认新会话 revision=0、View.savedRevision=-1，第一帧自动保存覆盖 localStorage 旧工程；退出重进后无法恢复 | 已修：bindMusic 将 savedRevision 初始化为当前 revision，进入不写旧草稿；用户真实编辑/显式保存继续持久化。需 Creator 重入证据覆盖。 |
| 变速工程播放头坐标（P2） | 横轴是 tick，播放头却用 timeMs/durationMs 线性比例，tempoMap 非线性时错位 | 已修：新增纯逻辑 timeMsToTick / Reader.getTickAtTimeMs，UI 用积分逆变换显示。内存测试覆盖 tempo 120→60、tick1440↔2000ms。 |
| 轨道偏移游标（P2） | offsetMs 参与声音与导出，但局部 tick 音符与全局媒体游标不一致 | 已修：每轨以 max(0, mediaTime−track.offsetMs) 还原局部项目时间，再经 tempo 逆变换绘制该轨游标；保留全局媒体游标。 |
| pending resume 时暂停（P2） | AudioContext.resume 尚未完成时状态非 Playing，旧 pause 直接返回，之后仍开始发声 | 已修并独立实测：pause 一律递增 generation / 断开输出并置 Paused；可控 Promise 的 resume 延迟后 state 仍 Paused。 |
| 参考重音与裁定不一致 | 初版导出所有 emphasis=false，与小节首拍裁定不一致 | 已修：note.tick % musicMeasureTicks(project) === 0；内存验证首拍 true。强调按工程 tick 定义，不由偏移声音重新推断。 |
| 同 ID 重导入源修订碰撞 | LoadProject 都 revision=0，相同 projectId 下导入不同内容会得到相同 sourceRevision | 已修：sourceRevision 包含规范快照的双 32 位校验和；独立验证 pitch 改变但 ID/revision 相同的导入产生不同 revision 字符串。校验和只作快照标识，不是安全签名。 |
| 极小 aspectRatio 输出不可消费（P2） | 默认工程 aspectRatio=Number.MIN_VALUE 可解析且 Builder 接受，水平路径度量下溢为零，真实 GuidanceChart 拒绝 | 已修并独立实测：Builder 用 chart.measurePathLength 验证去重后的每段及总路径有限且为正，出口拒绝该工程，保留草稿。 |
| 重新挂载后的默认项目按钮（P2） | 新 View 从当前工程初始化 defaultProject，音乐→引导线→返回后，“加载默认项目”重载返回时编辑快照 | 已修：MusicEditorBuilder 每次挂载显式传 createDefaultMusicProject 到 bindMusic 第四参数，返回后重置仍为真实默认工程。 |
| 极长工程网格绘制（P2） | parser 接受大 durationTicks，UI 每帧按全曲逐 beat/measure 画线；合法输入可造成长期阻塞 | 已修：parser 限制 durationTicks≤PPQ×4096，UI ruler/grid stride 按 viewport 宽度采样；独立验证超出 tick 上限拒绝。试听仍有独立 10 分钟输出上限，属实际限制。 |

## 独立内存逻辑复核

以 TypeScript transpileModule 在 Node 内存加载最新根模块，未生成编译文件，结果 **10 passed / 0 failed**：

1. 调用方输入未被冻结、后续修改不影响 session，深层 position 冻结。
2. NaN 音符输入拒绝，原 document 对象身份保持。
3. ChangeNote→Undo→Redo 恢复正确 pitch。
4. Undo 后 SetTempo 截断 redo，entries/cursor 一致。
5. 含历史草稿 JSON roundtrip 与 parser 输出一致。
6. 变速积分与逆函数：120 BPM 至 tick960，随后 60 BPM，tick1440=2000ms；逆变换返回1440。
7. 默认生产源经真实 parseChartSourceData→GuidanceEditorSession→exportChart 得到 schemaVersion=3。
8. aspectRatio 下溢路径在 Builder 出口拒绝。
9. 相同 projectId/revision 的不同导入快照 sourceRevision 不同。
10. tick0 音符小节强调标记为 true。

另以假的 AudioContext / 延迟 resume Promise 验证 pending 播放期间 pause 后不会开始声音，最终状态 Paused。此项是生命周期控制验证，不是人耳音频听感验收。

上述 10 项及超长输入、AST、Junction、pending pause 已固化为 [independent-review.cjs](D:/Project/A_New_Begin/Neurou_official/quality-review/music-editor/independent-review.cjs)，复现命令：`node quality-review/music-editor/independent-review.cjs`。结果为 [independent-review-results.json](D:/Project/A_New_Begin/Neurou_official/quality-review/music-editor/independent-review-results.json)，含 7 个新 TS 文件的当前 SHA-256 / AST 导入形态，代码内存编译，不写实现构建产物。

## 依赖门禁审计限度

当前实际新文件没有 require、side-effect import 或值依赖 editor，因此未发现本批实现绕过依赖矩阵。新增 musicEditor 已进入 E6 登记、E8 零 cc，矩阵新增 type R / type I，旧域没有获得新写权限。

独立审查脚本使用 TypeScript AST 扫描 4 个音乐逻辑文件、2 个 presentation 文件及 MusicEditorBuilder，共 7 个新 TS 文件；确认零 require / side-effect import、音乐逻辑零 cc/禁域依赖、音乐逻辑→editor 与 presentation→musicEditor/editor 都为整句 type import。按 ARCHITECT 要求，本批不扩张原 regex 检查器的解析范围，避免无关门禁实现变动。

对既有 regex 解析器进行内存虚拟文件负测（未创建源文件）发现：`const editor=require('../editor/GuidanceEditorSession')` 与 `import '../editor/GuidanceEditorSession'` 未被静态依赖 parser 识别；同目标命名值 import 正确触发 E2。该缺口已存在于本批前的检查器，并非本批导入产生。交付不能把 gate 的零错误解释为对所有 TypeScript / CommonJS 导入写法的完整证明；当前实现需辅以 AST / 源码审计。若增强 gate，应对这两类导入增加负向测试且保持原矩阵权限。

此审查不替代真实 Creator 双分辨率操作、下载文件读回、退出释放、实际听感和三条门禁最终记录。已修问题应在最终 suite / Creator 链路留证；未确认项由 ARCHITECT 明确完成或列入实际限制。
