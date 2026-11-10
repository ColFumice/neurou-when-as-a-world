# 第 31 批正式裁定：音频编辑器最小交付

2026-10-10。依据本轮用户对 ARCHITECT + IMPLEMENTER 的明确授权。本裁定在本批实施范围内生效；共享规格与名库的追认、落盘交 PROTOCOL → Trae。本文件是交付附件，不修改 docs、名库或参照原文。

| 编号 | 正式裁定、理由与影响 |
| --- | --- |
| VERDICT-180 | 三个子编辑器共享一个版本化音乐工程及一套撤销历史。RGB波表负责音色定义，网格负责内容空间位置及音阶/音量映射，MIDI以及音轨负责音符、轨道、tick、tempo、时值和轨道偏移。波表→音色，网格→位置，音轨→绝对媒体时间；三者互相引用稳定ID，不各自另存互相矛盾的工程。本批只实现 MIDI 音轨，另两项继续占位；轨道颜色与显式位置是本批必要的源元数据，不构成 RGB/网格编辑器交付。 |
| VERDICT-181 | 音乐工程与谱面源分层：MusicProjectData 是音乐创作数据，ChartSourceBuilder 将其转换为已冻结 ChartSourceData / MidiNoteEvent。引导线编辑器仍只消费 ChartSourceData；不让它识别音乐工程、计算 tempo 或推断颜色。转换版本进入 mappingVersion；schemaVersion=1、provenance='Midi'，UI显示 MIDI，禁止将生产数据标为Mock。 |
| VERDICT-182 | MusicEditorDocument 是草稿真源，含版本、documentId、project、revision和 MusicEditorHistory；项目内容是不可变快照，历史最多100项，撤销后新编辑截断redo，失败提交不改变草稿。MusicProjectData、TrackDefinition、NoteDefinition 是本批冻结创作结构；不用 MusicProject 表示可直接交给引导线的输出。WavetableDefinition / GridDefinition 仅是后续名库预留提案，本批不实现也不把未定义字段塞进schema1。 |
| VERDICT-183 | 新增 musicEditor 纯逻辑模块，musicEditor→constants/chart 为A，→editor为R且仅类型引用冻结源契约，→其余域为✗。editor/chart/director等既有域→musicEditor为✗；presentation→musicEditor为R+I且仅import type。MusicEditorReader只读，MusicEditorPort只收MusicEditorIntent；MusicEditorSession唯一维护草稿。assets/scripts/MusicEditorBuilder 为组合根，实例化及验证源与真实消费者。扩展依赖门禁登记和零cc范围，不放宽原矩阵边。 |
| VERDICT-184 | 在 VERDICT-151 的原目录身份下，MusicEditor 升级为 Folder，MidiTrackEditor 为 Implemented；RGB波表/网格继续 Placeholder。采用统一音乐项目界面，左树右工作区，本批只有MIDI工作区可编辑。复用 FolderPresentationTheme；时间轴与音高采用项目坐标，分辨率仅影响显示尺度。未来两个工作区也通过同一会话意图操作共享工程。 |
| VERDICT-185 | MusicEditorSession与GuidanceEditorSession相互独立，前者产出冻结源，后者保留独立类型/Head/Hold选择历史。MusicEditorBuilder交接先执行现有parseChartSourceData、LoadSource与exportChart，成功后绑定既有GuidanceEditorView；返回音乐工程保留音乐草稿。本批不修改 GuidanceEditorSession/View/Builder核心。WorldFolderBuilder仅增加MidiTrackEditor路由，原登录/序章/世界/退出/销毁流程保留。无世界director、账本或gameplay实例进入音乐预览。 |
| VERDICT-186 | ColorMusic仅按功能语义翻译，不整类移植。本批提取MIDI→Hz及BPM/拍号相关纯数学，时间统一为tick/PPQ四分音符基准：每四分音符60000/BPM毫秒；一小节tick=PPQ×numerator×4/denominator，emphasis只在明确小节首拍设置。RGB→音色/均匀度/亮度、网格音阶/行音量、min/max波形、手绘波表/谐波、鼓库留给后续子编辑器。特殊颜色TS/Java并列触发规则存在差异，不能在本批替其定夺；不得引入AudioTrack、实时DSP、WebSynth、JNI、原平台/UI/I18n和未经许可确认的采样。 |
| VERDICT-187 | 分步：①纯逻辑工程/校验/历史/时间转换；②时间轴双轨、放删改音符和草稿保存恢复；③单次离线渲染PCM的简易音高试听，播放/暂停/停止/seek均依据AudioContext时间；④严格导出ChartSourceData与真实引导线交接；⑤两档Creator预览、隔离/错误/生命周期及三门禁验收。RGB与网格须后续独立授权；标准.mid导入/导出、录音、音频片段混音与真实波形不属本批最小范围。 |
| VERDICT-188 | 本批验收逐项为加载工程、时间轴与音轨、放/删/改、撤销重做/恢复、音符试听、源JSON导出、引导线真实消费及schema3导出、1920×1080/2560×1440一致、退出释放、逻辑零cc与既有核心保护。三门禁仍为check:naming、typecheck、check:dependencies；不能用离线逻辑测试替代Creator截图，不能用编辑器试听替代gameplay或人耳听感验收。 |
| VERDICT-189 | 正式授权阶段1新增音频编辑器有限最小范围，修订§4对“新音乐编辑器”的一概排除及VERDICT-162/163仅GuidanceEditor可打开的范围。保留地图/剧情、RGB波表/网格、实时音频引擎等排除。stage-1 §3/§4/§6及新验收项应同步修订，由Trae落盘；用户本轮禁止修改docs，因此本批只交准确修订提案。本轮直接授权已涵盖该例外，不因尚未落盘重复索要许可。 |
| VERDICT-190 | 源转换不变式：tempo积分与track offset以整段媒体0为原点；不为适配速度改时间、位置或添点；sourceRevision标识草稿版本，重导入创建独立源选择；音符时值不自动推断Hold。导出须每条有效线至少两事件且有有效路径，普通节点落入既有键位，拒绝同刻不同位置、负媒体时间、超媒体尾部等不可消费数据，失败保留音乐草稿并报告。音乐坐标为GuidancePosition无量纲，不新增世界距离单位；颜色不改变ElementType/TrailColor/判定或得分，只有director可追加账本。 |

无须变更既有冻结契约或核心架构。特殊颜色等参考差异位于本批明确延期范围；若未来实现需要选择不同语义，先提交 PROTOCOL，不静默移植。
