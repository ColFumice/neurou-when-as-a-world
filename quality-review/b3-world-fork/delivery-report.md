# B2.3 WorldFork 实装交付

PROTOCOL 已正式验收 B2.3，名库 v3.11 提案中的全部名称与生产装配 WorldForkAvailability=Implemented 已追认。两处并发修改已确认是 PROTOCOL 授权的 Trae 落盘；随后已观察到 Trae 落盘 v3.11 名库附录、B2.3 授权范围及证据标签。确认记录见 protocol-acceptance.json；下一阶段为 B2.4（跨设备），本轮未启动其实现。

正式 Primary 世界的分叉链路已完成：拥有 CopyPermission 且来源为当前 active、稳定 Complete 世界时，分配新的 world-UUID，把七项状态精确重键并持久化，以目录追加作为提交点。进入副本复用既有七项无副作用恢复与未激活对象图发布，产出 Complete / Restored。修改副本回忆/成绩不影响原世界；FormatTime 继承，WorldClearRecord 不继承。

双档真实 Cocos 已通过：1920×1080 / 2560×1440 各27张，共54张原始截图。副本回忆2→3、World重玩次数2→3，原世界保持2/2且原始Core字节不变；同profile新窗口恢复副本；账号通关记录始终一条且账号字节不变。完整媒体、自然T6/T7和产品控件运行，没有注入存储、向量、快照或通关事实。

## 交付索引

| 要求 | 交付文件 |
| --- | --- |
| VERDICT-271～285 落地裁定 | verdicts-271-285.md |
| 名库v3.11提案，交Trae落盘 | namebook-v3.11-proposal.md |
| 修改文件及完整diff | changed-files.md / changed-files.json / production.diff |
| 三条门禁 | gate-results.json / gate-typecheck.log / gate-dependencies.log / gate-naming.log |
| Cocos真实预览与截图 | screenshots.md双档逐张原图链接；creator-preview-results.json / delivery-results.json 中路径、尺寸、摘要 |
| 逐项验收证据 | acceptance-evidence.md |
| 新增命名 | namebook-v3.11-proposal.md 的12顶层导出、公开方法、头字段、状态和key/lock增量 |
| 依赖与遗留边界 | dependency-proposal.md 与本文后半 |
| PROTOCOL 验收、归因及后续落盘 | protocol-acceptance.json / post-acceptance-trae-landings.json / post-acceptance-trae.diff |

## 核心裁定

CopyPermission 是账号权限门槛，Complete/稳定边界、Primary来源、active目录与可立即取得源租约是实例前置。FinalShore禁止；BugShore生产入口没有装配，本批明确返回不支持。分叉保持原世界active。

角色、事件、chain/trace/chart ID是世界内局部ID，保留原值；新worldId使account/world/character复合身份成为新身份。全部section envelope、PuzzleProgress和SphereCrossing入口world ID重键，ChartRef仍指向继承的同一冻结内容。制作方主角声明没有改写。目录名称为原名加“ 的副本”，description继承，本批不新增自定义表单。

formatTime的原epochMs不变；新目录createdAt和目标capturedAt记录本次forkedAt。永久forkOrigin作为可选Core头记录来源，不增加第八项玩法状态；已存头不可补写、改写或删除。短期journal与永久来源分开，成功提交或回滚后清理；无需长期WorldForkLog或WorldRegistry。

已首演副本保持合法完成引用、快照和成绩，公开Inherited；允许重玩更新副本成绩，阻断再次首演/Retry补造WorldClearRecord。未首演副本可依原真实首演链产生自己的新通关记录，该路径已契约验证。账号FirstWorldCleared/CopyPermission/原通关记录均不复制，不参与本次写事务。

租约顺序为源世界→新目标→账号目录锁。journal→目标Core→目录追加→日志清理；目录追加是唯一提交点。发布前只删除精确匹配的未发布暂存目标；发布后永不回滚，清理失败保留日志并重试。恢复只需目标与目录锁，不因来源后续删除失效。提交前重读来源、权限与目录，重新重键并比较完整目标，拒绝“合法但不是精确继承”的候选。

## 验证结果

| 证据类别 | 结果 |
| --- | --- |
| 本批核心契约 | 132 PASS / 0 FAIL：domain54 / storage41 / inheritance23 / root-wiring14 |
| 当前目录与原接线适配回归 | 23 PASS / 0 FAIL：folder12 / legacy-wiring11 |
| 14组有效历史原文套件 | 396 PASS / 0 FAIL |
| 4组历史阶段/环境例外 | 原文9 PASS / 12 FAIL保留，不计成PASS；归因见domain-delivery.md，当前对应七项/异步接线另有覆盖 |
| 真实Cocos | 双分辨率PASS、54原始截图、编译源映射/served代码与当前源一致、运行/渲染错误0、外部请求0 |
| typecheck / dependencies | 均PASS；依赖0ERROR |
| 当前/基线命名规则 | 均0ERROR；当前22WARN、基线27WARN，均为原语义告警 |

这些结果分开记录。契约中的控制锁/时钟/故障夹具、Chromium DOM测试、Cocos生命周期适配不是生产截图；真实预览没有做故障注入或未完成来源通关验收。

## 文件与约束审计

本批9个修改文件、4个新实现及4个配套meta，无删除。完整diff不包含Cocos junction重复路径。A/B/C/T6/T7、编辑器、制作方内容、账号基础和七项领域核心算法保持；原WorldClearSession只增加Inherited类型值，继承保护由子类承担；逻辑层cc import为0，无新增依赖方向。

工作区20:19:53的两处并发落盘已由 PROTOCOL 确认归因给 Trae：stage-1.md 的 B2.2d-2 证据标签，以及 check-naming.js 的 v3.10 痕绑定白名单。它们属于上一轮 PROTOCOL 授权工作，合法且原样保留。concurrent-external.diff 与原摘要沿用历史文件名供核验，归因见 protocol-acceptance.json。原采证时32个保护文件中30个字节不变，NAMEBOOK、archive和两份参照docx未变；这项历史计数保持。当前授权规则命名为0ERROR/22WARN，交接前白名单基线脚本补充复核为0ERROR/27WARN，两份原结果均保留。

Trae 后续 docs 落盘与原验收分开：post-acceptance-trae-landings.json / post-acceptance-trae.diff 保存 v3.11 名库及 stage-1 的 B2.3 范围、证据标签。accepted-delivery-results.json 保留原交付结果；accepted-protected-manifest.json 记录原保护字节的核验与重建来源，明确其为回执更新时准备的历史快照。生产 diff 与原 30/32 计数不包含后续文档变更。本次仅核验制品哈希与回执一致性，未重跑测试、门禁或生产预览。

## 遗留边界

无新增架构阻断。B2.3 已获正式验收，v3.11 名称及 Implemented 能力追认完成；v3.11 正式名库与 B2.3 stage-1 更新已由 Trae 落盘，本批不编辑docs、名库或参照。后续 Trae 并发落盘按 PROTOCOL 澄清继续原样保留并记录归因。

BugShore虽有WorldLink严格载体/单层弱引用契约，尚无正式Shore生产运行图与内容绑定，因此当前分叉只开放Primary，保留未来BugShore继承同来源和Orphaned冻结快照的规则；FinalShore不可复制。活动七秒/揭示/演奏不恢复，要求稳定Complete；历史缺真实谱面/FormatTime不会补值。FileCarryPayload、WorldRegistry、跨设备、观察者同步、服务、AccessCode与完整感绪系统均在本批外。

Web Locks不可用时不无锁降级；quota/冲突日志只保留错误与字节，需可用存储后刷新重试。事务恢复与多adapter锁竞争已契约验证，本次真实生产验收只宣称成功路径、退出重入和独立性。旧测试阶段/环境例外原结果保留，不修历史断言冒充通过。
