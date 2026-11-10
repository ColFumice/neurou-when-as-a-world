# 音乐编辑器批量操作独立审查

2026-10-10（Asia/Shanghai）。审查代码为本批冻结的两个变更文件；审查者没有改动生产源、docs、名库、参照或上一批附件。

**结论：未发现阻断交付的实现缺陷。独立检查 21/21 通过。** [运行脚本](D:/Project/A_New_Begin/Neurou_official/quality-review/music-editor-operations/independent-review.cjs)加载真实 TypeScript View / Session；[完整结果](D:/Project/A_New_Begin/Neurou_official/quality-review/music-editor-operations/independent-review-results.json)记录各项、AST 导入和源 SHA256。

| 范围 | 核对结果与证据 |
|---|---|
| 选择 / 范围 | Ctrl 跨轨 toggle、同轨 Shift、无同轨 anchor、Ctrl+Shift 追加、普通短点击单选、Ctrl+A 当前轨；R01、R02、R10 |
| 拖动原子性 | Pointer down/move 只保持 UI ghost；真实鼠标释放调用路径仅发送一个 MoveNotes；相对 tick/pitch、ID、时值、力度、位置和轨道保持；R03 |
| 整组拒绝 | 负轨道 offset、负 tick、尾端越界或 pitch 越界均不发送部分事务，红色 ghost；R04、R05 |
| 框选与阈值 | 按实际渲染最小5px noteRect 相交，可跨轨；空白≤4px短点击仍添加，>4px进入框选；R06、R07 |
| 取消 / 生命周期 | Esc 取消并清选择；blur 恢复手势前 selection/anchor；Ctrl+A 取消旧拖动；teardown 释放 capture 与监听；R08～R10、R18 |
| 复制 / 粘贴 | tick/ID排序锚点、pointer tick/pitch、跨轨flatten当前目标轨、新ID及新组选择、UV/时值/力度保留、失败保护；R11、R13 |
| 播放头映射 | 减目标track.offsetMs之后用分段tempo反算tick，按max(1,round(PPQ/4))吸附，fallback pitch不变；R12 |
| 草稿 / history | UI状态不入schema1；复制快照与工程隔离；LoadDraft清选择/锚点/手势；Undo/Redo只修剪ID，不恢复UI选择；新batch排序反转可roundtrip；R14～R16、R19 |
| 输入隔离 | input/textarea/select/contenteditable不抢快捷键；重复paste/delete不重复提交；R17 |
| 依赖 / 保护 | 对全部4个musicEditor逻辑文件及MusicEditorView做AST扫描，逻辑零cc，无普通require/动态/副作用导入；View至逻辑与editor均type-only；受保护contracts/Builder/docs SHA不变；R20、R21 |

审查冻结快照：

```text
src/musicEditor/MusicEditorSession.ts
ef6f514f37a34c715117ed871b4c1a8525e5a85c3d0c3d3a754bf17a7dbac97b
src/presentation/MusicEditorView.ts
fc5a6d4c774d841177b264d67fdac2658226f2df976cb5f95cef3d7fb50e425d
```

此脚本为最小cc/DOM/Canvas宿主下的独立状态机验证，验证实际View方法与真实Session的一致性。Creator双分辨率、真实浏览器鼠标事件、屏幕布局、文件下载和引导线消费由root的新Creator验收附件证明；此脚本不代替这些证据。人工听感通过来自用户报告，本轮自动脚本不进行听觉判断。

没有扩展依赖矩阵边、引入序列化选择字段、修改Builder或源契约。框选从实际轨道内容plot内开始；键盘标签栏、标题或ruler不启动添加/框选。pointer取消恢复选择/anchor，当前目标轨保留点击所得上下文；这没有改变批量移动中的轨道归属。以上符合本批裁定，未将可选交互扩张为新范围。

审查对交付文本做了两处实施对齐：范围锚点实际词形为anchorNoteId；本批未设计箭头键移动，因此裁定及验收不承诺该功能。目标轨播放头及PPQ/4吸附也已明确写入VERDICT-194。

首遍独立脚本曾有一条测试夹具错误：把第二次“空白点击”放在首次新增音符的实际宽度内，因而正确触发移动。修正夹具坐标后21项全部通过，没有因此修改生产代码。
