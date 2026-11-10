# 音乐编辑器批量操作正式裁定：VERDICT-191～195

2026-10-10（Asia/Shanghai）。依据用户本轮对音乐编辑器多选、删除、移动与复制粘贴的明确授权。裁定在本批实施范围生效；共享规格、名库及裁定记录交 PROTOCOL → Trae 追认落盘。实施者不修改 docs、名库、参照或上批验收附件。

| 编号 | 正式裁定、理由与边界 |
|---|---|
| **VERDICT-191** | 多选属于 MusicEditorView 的交互状态：selectedNoteIds 使用 Set，anchorNoteId、clipboard、pointer/drag/box gesture 与 ghost 均只存 UI 内存，不进入 MusicProjectData、MusicEditorDocument 或 MusicEditorHistory。音符仍以全项目唯一稳定 ID 识别；单选是集合仅一项的特例，单音符属性编辑保持原行为。逻辑会话只接收明确的批量创作意图，不读取 UI 选择状态。加载工程、恢复草稿清除选择/锚点/未完成手势；草稿历史只记录音乐内容。 |
| **VERDICT-192** | 扩展 MusicEditorIntent：DeleteNotes{noteIds}、MoveNotes{noteIds,deltaTick,deltaPitch}、PasteNotes{trackId,notes}；旧 AddNote / ChangeNote / DeleteNote API 和原 schema1 字段、Builder、ChartSourceData 契约不变。DeleteNotes / MoveNotes 可通过稳定 ID 跨轨选定；PasteNotes 指定一个目标轨。一个成功批量操作只递增一次 revision、生成一项同名历史事务，Undo/Redo 整组恢复；撤销后批量操作截断 redo。候选整体先严格解析，任何错误保留 document/project/history/revision。空操作不记录空历史；批量历史导入须校验标签与实际差异，不以新标签绕过旧字段不变式。 |
| **VERDICT-193** | 移动整组保持所有音符的相对 tick/pitch、时值、力度、位置、ID 和归属音轨，只统一加 deltaTick / deltaPitch。任一音符 tick<0、尾端>durationTicks、pitch 不在0～127、值非安全整数或经tempo/track offset产生负媒体时间，整组拒绝。不自动延长工程，不逐音符夹取、不缩短音符或只移动合法子集。鼠标拖动即时展示整组 ghost，拖动中不提交逻辑事务；mouseUp 成功时只提交一次 MoveNotes，Esc 取消不提交。 |
| **VERDICT-194** | 复制保存被选音符的 UI 快照，不写历史或系统剪贴板。粘贴优先采用最近位于钢琴卷帘有效音轨区域内的 pointer tick/pitch；没有有效 pointer 时采用目标轨播放头映射 tick、保留原 pitch。复制集合最早 tick 是时间锚点，按 tick/ID 规范排序的首音符 pitch 是音高锚点；计算一个统一 tick/pitch 偏移，保持集合内部关系。跨轨复制粘贴时将音符 flatten 到当前 selectedTrack，目标轨 lineId/color/offset 保持目标轨定义，音符时值/力度/显式位置保留；新音符取得全项目未使用的稳定新 ID。整体候选无效则全部拒绝；成功只记录一个 PasteNotes 历史并选中新集合，后续复制、删除、移动操作针对新 ID。 |
| **VERDICT-195** | 输入规则固定：Ctrl+A 仅全选当前轨；Ctrl 点击 toggle 单音符，可形成跨轨集合；Shift 点击在 clicked track 按 tick/ID 排序的 anchor 范围选择，Ctrl+Shift 将该范围追加到已有集合。空白 drag 超过4px视为框选，选择矩形与实际绘制 noteRect 相交的音符，可跨轨；空白短点击沿原行为添加音符。普通点击切换为单选，已选音符可整体拖移；Esc 先取消手势并清除选择。快捷键不抢 input/textarea/select/contenteditable 文本输入；LoadProject / LoadDraft 清 selection，Undo/Redo 后按当前工程修剪失效 ID，不把UI选择写入历史。无新增模块/依赖边、无 gameplay/ledger 连接；逻辑零cc，presentation 继续只用 Reader/Intent/Port。 |

## 操作语义补充

**集合与锚点。** Ctrl 的增删只改变 UI 选择。范围锚点必须属于 clicked track 且仍存在；没有有效同轨锚点时以 clicked note 建立该轨锚点并按单点范围处理。跨轨选择不改变各音符 trackId；当前 selectedTrack 决定 Ctrl+A、属性上下文和粘贴目的轨。

**移动单位。** deltaTick / deltaPitch 是整数增量；拖动 tick 按 max(1, round(PPQ/4)) 网格步长吸附、pitch 按半音吸附。边界约束在逻辑层重新检查，ghost 的显示结果不能代替最终候选校验。batch identity 列表要求安全、唯一、已有 ID；空集合是无操作。暂停/停止试听与导出失效处理沿音乐内容变更的既有链路。

**粘贴锚点。** pointer 仅在实际音轨内容区有效，侧栏、工具栏、卷帘外不保留一个错误的目标位置。复制集合以 tick 升序、同 tick 按 ID 排序确定首音符；fallback 的 deltaPitch=0。目标轨播放头先按 max(0, mediaTimeMs−targetTrack.offsetMs) 还原目标轨的项目时间，再使用 Reader 反算 tick，并按 max(1, round(PPQ/4)) 吸附；pointer tick 采用同一步长。不把媒体毫秒直接当 tick。粘贴只复制音符定义，不复制原轨 metadata，不重算或隐式推断 UV。

**事务历史。** 新批量标签须验证未变项目/音轨属性。DeleteNotes 只能删除选定音符，其他已有音符逐字段不变；MoveNotes 只能统一改变选定音符 tick/pitch，选定音符的其他字段不变；PasteNotes 只能向一条既有目标轨增加音符，原音符不变。旧草稿历史仍可加载，新历史 label 是同一 schema1 的明确判别值扩展，不新增选择/剪贴板字段。

## 验收与范围

本批验收应覆盖单选/多选/跨轨/框选、Ctrl+A / Ctrl/Shift/Ctrl+Shift、批量 Delete、ghost 拖移一次提交、Esc 取消、copy/paste 两种锚点与跨轨 flatten、新 ID 选择、边界整组拒绝、Undo/Redo 一步恢复、恢复草稿清选择、文本输入快捷键隔离、Creator 双分辨率及现有导出/消费者链路。原三门禁保持；不新增模块行列或放宽依赖。

用户已明确报告上一阶段**人工听感验收通过**，在本批证据中记为“人类报告”。本轮自动操作或截图没有替代用户的听觉确认，也不扩张为新音色或音频引擎验收。固定正弦试听与10分钟 / 80,000,000 note-frame容量保持；RGB/网格、标准.mid、录音/真实混音继续不属于本批。

若实现需要新增序列化选择字段、改原音符/源契约、自动扩长工程、部分夹取或引入新禁边，应停止提交 PROTOCOL；本裁定不授权这些变化。
