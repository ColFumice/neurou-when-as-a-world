# 判定窗口修订与 AC 同步提案 · 2026-10-10

依据：用户已确认 T6 `RHYTHM_STRIKE_WINDOW_MS` 由 50 调整为 100，T7 `PERFECT_WINDOW_MS` 由 50 调整为 100、`GOOD_WINDOW_MS` 由 120 调整为 200；实施范围为这三个常量值、相关注释和两处现有 T6 提示的数值一致性修正：“±50ms”改为“±100ms”，“≤50”改为“≤100”。本文件是独立修订说明及交 PROTOCOL → Trae 的同步提案，不修改 docs、名库、参照或旧证据，不预先宣布本轮验收通过。

## 正式修订结论

| 修订对象 | 本轮代码改动前基线/既有规则 | 本轮正式规则 |
| --- | --- | --- |
| VERDICT-113 第 2 条的 T6 窗口 | RHYTHM_STRIKE_WINDOW_MS = 50 | RHYTHM_STRIKE_WINDOW_MS = 100；目标拍点前后各 100ms，绝对偏差 ≤100ms 成功，含端点 |
| VERDICT-123 第 5 条的 T7 窗口 | PERFECT_WINDOW_MS = 50；GOOD_WINDOW_MS = 120 | PERFECT_WINDOW_MS = 100；GOOD_WINDOW_MS = 200；Perfect 为绝对偏差 ≤100ms，Good 为 100ms < 绝对偏差 ≤200ms，窗外 Miss |
| VERDICT-093 同步不变式 | SYNC_TOLERANCE_MS < PERFECT_WINDOW_MS | 规则保留；当前 SYNC_TOLERANCE_MS = 30，故 30 < 100，成立 |

这里的窗口值均为目标时刻两侧的**单侧绝对偏差上限**，不是整段窗口宽度。T6 不新增 Good 档。Head 继续使用独立 `HEAD_WINDOW_MS = 1000`，包括生成时刻与生成时刻 +1000ms；本轮不调整头节点窗口、Space 启动边沿、一次输入启动一线及头节点超时规则。

**理由**

1. 用户已直接确认放宽数值，实施者无需重新提出数值审批。
2. 所有受影响判定通过现有常量消费获得新窗口，无需修改算法、接口、schema 或命名。
3. 30 < 100 < 200 保留同步可信度与 Perfect/Good 的严格分界。

**影响范围**：T6 RhythmStrike 与漏拍截止；T7 旧 Note 和引导线 Tap 的候选、判档、漏判截止及多候选集合；共用运行时、计分、完成条件和编辑器预览需要回归。所有字段、键映射、路径、v1/v2/v3 时间语义、连续 7 秒持续期、账本写入规则保留。

**是否可逆**：数值可在未来明确授权后再次调整。历史验收、历史判定和历史成绩作为当时版本的证据保留，不回写为本轮新窗口结果。

## 最终五文件实施边界

| 生产文件 | 本轮差异 |
| --- | --- |
| constants/index.ts | 三个已授权常量改为100/100/200，相关窗口及不变式注释同步 |
| src/trace/RhythmStrike.ts | 旧50ms数值注释改为100ms，判定函数不改 |
| src/trace/PuzzleChain.ts | 旧50ms数值注释改为100ms，持续期与漏拍算法不改 |
| src/chart/ChartScore.ts | 旧50/120ms数值注释改为100/200ms，判档与计分函数不改 |
| assets/scripts/SceneBuilder.ts:1037、:1079 | 两处既有T6灰盒/诊断提示分别由“±50ms”改为“±100ms”、由“≤50”改为“≤100”；控件、事件、状态与运行操作不改 |

本轮变更审计 `change-audit.json` 的 productionFiles 为5：剔除注释，并精确归一化三个授权常量值及两处既有提示数值后，生成 JavaScript 与本轮改动前基线逐字一致。该审计确认修改边界，不替代实际玩法、AC-18与AC-19验证。没有新增类型、字段、名称、模块或判定算法。

## 原文出处与可核对范围

当前仓库可查到 VERDICT-093 的完整正式原文：根参照 `641f3d33-4bab-4769-8f46-62a03315d1b1.jsonl:281` 的 assistant 消息。全文第 3 条写明：

> 规定：`SYNC_TOLERANCE_MS` 必须**严格小于** `PERFECT_WINDOW_MS`。

第 4 条写明：

> T7 用真实谱面完成后，用同样的方法再测一次，测试素材至少要和正式视频的帧率、时长量级一致。这次复测作为 AC-19 的证据。

该历史消息第 1 条限定 T0 通过环境为“桌面 Chromium 142（Electron 内核）”；第 2 条要求每增加目标平台补 SyncVerificationRecord。改变本轮判定数值不代表改变运行环境；若运行环境另有变化，仍依该规则补测。

VERDICT-113 第 2 条及 VERDICT-123 第 5 条的编号来自本轮修订请求；仓库中未找到两份完整逐条裁定原文，不能把名库摘要冒充完整条文。**共享规格与名库已在本轮代码改动前更新为100/100/200；旧50/50/120来自本轮代码基线，不是当前docs文本。**重新读取当前受保护文件，可核对的内容如下：

| 来源 | 当前共享文档原文/状态（本轮未修改） |
| --- | --- |
| docs/spec/stage-1.md:238 | `RHYTHM_STRIKE_WINDOW_MS` 默认100；“目标拍点前后各100ms，绝对偏差 ≤100ms 为成功”；已同步 |
| docs/spec/stage-1.md:311 | AC-12：“判定窗口为目标拍点前后各100ms（RHYTHM_STRIKE_WINDOW_MS = 100）”；已同步 |
| docs/spec/stage-1.md:318 | AC-13：“时间偏差 ≤100ms”；第一次有效命中启动7秒持续期；数值已同步 |
| docs/spec/stage-1.md:262 | Note 判定：“PERFECT_WINDOW_MS = 100、GOOD_WINDOW_MS = 200”；一次按下最多消费一条Note；已同步 |
| docs/spec/stage-1.md:346 | AC-17 v3补充：“Tap ±100/200ms；v3 Drag/Hold 在绝对起/尾时刻检查”；已同步 |
| docs/NAMEBOOK.md:377 | “Perfect：绝对偏差 ≤ PERFECT_WINDOW_MS（100ms）”；已同步 |
| docs/NAMEBOOK.md:378 | “Good：> Perfect 且 ≤ GOOD_WINDOW_MS（200ms）”；已同步 |
| docs/spec/stage-1.md:573 | “SYNC_TOLERANCE_MS 必须严格小于 PERFECT_WINDOW_MS” |
| docs/spec/stage-1.md:574 | “SYNC_TOLERANCE_MS = 30、PERFECT_WINDOW_MS = 100（30 < 100 ✓；VERDICT-093不变式仍成立）”；已同步 |

本轮改动前的代码基线已单独保存在本交付目录 `baseline/`，其中常量仍为T6 50、T7 Perfect50/Good120；用于核对本轮实际代码差异，不修改或覆盖此前批次证据。本轮代码实施后与当前已更新的共享规格/名库数值一致，无上述条文的待同步数值落差，不要求Trae把已更新的条文再次改写。

受保护文件以**本轮开始时的当前文件**为哈希基线。`prior-protected-updates.json` 单独记录 docs/NAMEBOOK.md 与 docs/spec/stage-1.md 在上一批保护快照之后、本轮开始之前已有更新；这些先前变化不归入本次五文件改动。当前基线、旧批次哈希与先前变化说明分别保留，本轮不回滚或覆盖这些参考文件。

## 精确源码消费关系

| 源码位置 | 消费与实际影响 |
| --- | --- |
| constants/index.ts:226 | PERFECT_WINDOW_MS = 100；原冻结名保留 |
| constants/index.ts:232 | GOOD_WINDOW_MS = 200；原冻结名保留 |
| constants/index.ts:235 | HEAD_WINDOW_MS = 1000，未改 |
| constants/index.ts:243 | SYNC_TOLERANCE_MS = 30，未改 |
| constants/index.ts:282 | RHYTHM_STRIKE_WINDOW_MS = 100；原冻结名保留 |
| src/trace/RhythmStrike.ts:55 | `abs(strikeTimeMs-targetBeatTimeMs) <= RHYTHM_STRIKE_WINDOW_MS`，T6 对称含端点命中 |
| src/trace/PuzzleChain.ts:200 | 下一拍严格越过 `nextBeatTimeMs + RHYTHM_STRIKE_WINDOW_MS` 才漏拍；截止自动扩至 +100ms |
| src/trace/PuzzleChain.ts:221 | 目标拍点 ≥持续期终点仍排除；不能因窗口变大把终点拍点计入 |
| src/trace/PuzzleChain.ts:225 | 继续调用原 judgeRhythmStrike；无新判定分支 |
| src/chart/ChartScore.ts:68 | ≤ PERFECT_WINDOW_MS 为 Perfect，使用 100ms |
| src/chart/ChartScore.ts:71 | 其余 ≤ GOOD_WINDOW_MS 为 Good，使用 200ms |
| src/chart/ChartPremiere.ts:312 | 旧 Note 判档通过同一个 judgeTimeWindow，自动使用新值 |
| src/chart/ChartPremiere.ts:367 | 旧 Note 严格越过目标 +GOOD 才漏判，自动扩至 +200ms |
| src/chart/ChartPremiere.ts:444 | 候选 Note 的有效绝对时间偏差由 GOOD_WINDOW_MS 限定 |
| src/chart/ChartPremiere.ts:461 | 错键反馈所需窗内候选集合使用 GOOD_WINDOW_MS |
| src/chart/GuidanceLineRuntime.ts:152 | Tap 候选允许 ±GOOD；扩大到 ±200ms，仍按时间差/目标时间/身份仲裁 |
| src/chart/GuidanceLineRuntime.ts:159 | Tap 最终档位使用共享 judgeTimeWindow |
| src/chart/GuidanceLineRuntime.ts:177 | 多线仲裁读取 Tap 候选时同样使用新 GOOD |
| src/chart/GuidanceLineRuntime.ts:267 | Tap 超时事件设在目标 +GOOD，严格越界才 Miss |
| src/chart/GuidanceLineRuntime.ts:131 | Head 启动比较 HEAD_WINDOW_MS，保持 1000ms 含端点 |
| src/chart/GuidanceLineRuntime.ts:256 | Head 严格越过 +1000ms 超时，未改 |
| src/chart/GuidanceChartRuntime.ts:35 | 多线 Head 候选继续使用独立 HEAD_WINDOW_MS |
| src/chart/GuidanceChart.ts:376 | v3 时间数值有限性检查引用 GOOD；结构和算法未改 |

### Drag / Hold 与共享常量的准确边界

不能把“同一个引导线运行时导入了 GOOD_WINDOW_MS”推断为 Drag / Hold 获得 ±100/200ms 的时间容错。现有实现中：

- `GuidanceLineRuntime.ts:269`～`:275` 安排 Drag/Hold 起点与 Hold 尾端的确定目标时刻。
- `:288`～`:299` 直接按到达/尾端的按住状态及连续性输出 Perfect/Miss，**不调用 judgeTimeWindow**。
- `:105`～`:123` 保留 Hold 尾端同刻 Up 可成功、Drag 到达同刻 Up 无按住状态的顺序；暂停释放规则 `:183`～`:191` 未改。
- 共享的 GOOD 改动实际作用于同运行时中的 Tap 候选与超时；同一混合线或多线含 Tap 时，未决 Tap 的最终截止可能影响整线/整谱面“全部已决”的时刻。Drag/Hold 自身目标时间、按住连续性、Perfect/Miss 档位和 Head 门槛保持。
- 所有节点仍进入共享 ChartScore；`ChartPremiere.ts:418` 与 `ChartScore.ts:108`～`:123` 的计分公式未改。编辑器独立预览复用相同运行时，故同样消费新 Tap 窗口，需纳入验证。

因此应回归混合节点、暂停/恢复、边沿顺序、多线仲裁及完成条件；**本轮不改 Drag/Hold 算法，不为其新增 Good 档**。

## AC 原文与同步提案

验收清单 `docs/spec/stage-1-acceptance.md:5` 原文要求实施者仅在交付报告提供证据，由 PROTOCOL 填状态；本轮继续遵守，不直接改状态栏。

| AC | 当前原文位置与关键规则 | 交 Trae 核对/证据索引同步 | 本轮证据要求 |
| --- | --- | --- | --- |
| AC-12 | stage-1.md:311～314：固定痕投影进入敲击区域；按节拍敲击；窗口±100ms；成功推进，失败保留待敲击 | 当前数值已同步，核对代码/证据符合±100ms；空间、音量、按键、失败阶段不改 | 对称±100ms含端点命中，窗外失败；数字键及正常T6流程 |
| AC-13 | stage-1.md:317～321：两步链、≤100ms、7秒半开持续区间、终点前拍点仍须判定、中间不写账本、终点恰一条 | 当前数值已同步，核对代码/证据符合≤100ms；持续期和账本规则保留 | 漏拍截止+100ms边界、终点拍点排除、持续期未满/满、重复结算防护；中间零/终点一条 |
| AC-17 | stage-1.md:344：Tap三档，Drag/Hold Perfect/Miss；一次结算；暂停冻结；:346已为Tap±100/200ms | 当前v3补充和Note数值已同步；追加新窗口边界/混合节点证据；Drag/Hold按住目标时刻规则保留 | 100ms Perfect、稍超100为Good、200ms Good、稍超200为Miss；早晚对称；候选单消费、Head不变、混合节点回归 |
| AC-18 | acceptance.md:47：“同输入下透明度越高得分不低于更低时”；stage-1.md:350 为原加成、视觉不改变判定；:352 RGB无得分影响 | 数值变化不改变AC业务条文；追加当前窗口版本的验证记录 | **必须重跑**相同谱面、相同输入序列下0/50/100透明度或等效多档；比较判定一致与得分单调；不能只凭计分源码未变或旧结果宣告通过 |
| AC-19 | stage-1.md:356～358：两档同谱面坐标、进度、映射及媒体时钟，继续原同步阈值；acceptance.md:49 为音画容差内 | 当前同步阈值仍30ms；新增本轮真实运行环境/素材的测量证据，不改T0历史数据 | **当前双档重测**1920×1080、2560×1440；实际媒体帧与输出时钟、样本数、最大偏差及运行环境；同数据/输入判定一致 |

验收清单的摘要本身未写窗口数值：AC-12/13/17/18/19 分别位于第 35/37/45/47/49 行，业务摘要保持。具体数值以规格及本轮修订为准；不在旧状态栏伪造新版本验收结果。

## T0 历史记录与 AC-19 当前测量

`docs/spec/stage-1.md:579`～`:585` 保存原 T0：Chromium 142（Electron 内核），1920×1080 最大偏差 16.87ms，2560×1440 最大偏差 16.53ms，各 10/10 样本，H.264/30fps/180帧/6秒；历史验证记录的容差字段为 100ms。

**该 100ms 是当时记录，不是当前 SYNC_TOLERANCE_MS 的值。**当前常量继续为30ms。不得为了与历史文本一致将同步容差改为100ms；新Perfect同为100ms时，100 < 100也不成立。当前应核对30 < 100，不变式成立。T0历史原数值、素材、环境、容差和旧通过结论均保留原样。

原实测偏差低于当前30ms可以作技术路线旁证，但旧6秒测试及旧窗口批次不能替代本轮AC-19的真实谱面双档重测。依 VERDICT-093 第4条，当前测试应使用实际媒体、实际运行时与时钟，记录素材、运行环境、有效样本和最大偏差，按30ms验收。本提案不把历史100ms合格线放宽到当前验收。

## 同步范围、保护边界与冲突结论

交 PROTOCOL → Trae 核对与证据索引提案：

1. 核对VERDICT-113第2条、VERDICT-123第5条的数值修订记录；若持有完整逐条真源，确认其当前值对应本轮授权，不要求重复修改已同步条文。
2. stage-1常量表第238行、Note判定第262行、AC-12第311行、AC-13第318行、AC-17 v3补充第346行及同步不变式示例第574行已为本轮目标数值，保留当前内容，仅核对代码与新证据一致。
3. NAMEBOOK窗口备注第377/378行已为100/200ms，保留当前内容与名称。历史T0证据和历史批次裁定/报告不改写。
4. 同步本轮AC-12/13/17/18/19的新证据索引；由PROTOCOL据本轮实际结果填写当前版本验收状态，不复用旧通过状态作为已重测证明。

不新增命名、模块、schema或依赖边；不更改Head、SYNC容差、7秒持续期、音频时钟映射、路径/邻格规则、谱面计分公式、世界运动门控、暂停时长不补算、输入单消费、节点一次结算或账本唯一写入原则。

**冲突结论：没有未授权架构冲突需要停工。**用户直接授权将本轮旧代码基线数值调整为100/100/200；当前共享规格/名库已经同步，代码实施后与其一致。三个常量仍有限且大于0，SYNC30 < PERFECT100 < GOOD200成立，Head独立。完整113/123逐条原文在本仓库缺失，仅影响追溯注释的完整性，不影响用户对三个数值的明确实施授权；不得据此虚构原文或扩大修改范围。

本轮门禁、实际AC-18/AC-19结果及截图由主交付报告另附。此提案不修改生产代码，不发送Trae消息工具，不覆盖旧测试脚本、旧截图或旧结果。
