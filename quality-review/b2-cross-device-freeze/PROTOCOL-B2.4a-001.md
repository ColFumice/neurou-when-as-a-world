# PROTOCOL-B2.4a-001 · 冻结前置冲突

提交日期：2026-10-10（Asia/Shanghai）。发现方式：当前源码与历史裁定只读审查。

**状态：待 PROTOCOL 裁定，受影响新增契约停止冻结，B2.4b 未获准入。** 本轮用户明示：“若发现新的架构冲突或前置缺失，先停止，提交 PROTOCOL。” 因此不以 ARCHITECT 身份静默修补现有 B2.1/B2.3 身份、计时或存储机制。以下推荐方案均为可审阅提案，不是既成冻结或实施许可。

## P1 · 初始世界的全球实例身份不成立

证据：

- `src/director/WorldFolderSession.ts:44`：新本机目录固定创建 `worldId='InitialWorld'`；`src/presentation/WorldLocalStorage.ts:24` 的目录 key 只有 accountId。
- `assets/scripts/WorldFolderBuilder.ts:273`：本机无目录即初始化；所持 lease 仅本设备有效。
- `src/presentation/WorldCoreStateStorage.ts:178`：Core 身份/存储只含 accountId 与 worldId。
- `assets/scripts/WorldFolderBuilder.ts:465`、`assets/scripts/SceneBuilder.ts:1626`：InitialWorld 进入正式 Primary 生产链，可生成完整七项与真实通关，并非只有 EmptyWorld 占位。

复现逻辑：设备 A 与 B 的独立本地存储为空，同账号各自开始旅程，两边都产生 `(accountId,'InitialWorld')`，但世界经历可能不同。VERDICT-047 的 account×world→HomeDevice 无法区分独立创建和复制；直接采用“另一设备即复制”会错误拒载/分叉独立世界。状态摘要/FormatTime 也不能证明来源身份：同一世界可修改，不同世界也可能有相同值。

需要裁定：旧 InitialWorld 如何获得不可混淆的实例身份，是否允许兼容升级，是否扩展本批触碰范围。

可选方案：

1. **本轮约束下推荐的有限范围方案**：B2.4 仅接入已经获得可信服务登记的 UUID 世界，旧 InitialWorld 跨设备明确 UnsupportedBoundary，不自动重键/登记、不改旧 Core。已有本地玩法和分叉保持。代价：B2.4 不是全部世界跨设备完整交付，必须在阶段范围/验收写明；旧 InitialWorld 的完整迁移留后续裁定。
2. 全范围方案：授权独立的旧身份升级协议/不可变实例身份及兼容映射，处理世界 Core、目录、通关记录、forkOrigin、锁与引用一致性，另行冻结。不得偷偷按 deviceId 拼 worldId，因为那会把真正复制也误作不同原件。

禁止：用本机 deviceId 将每份导入文件都当新原件；用服务器首次看到的一份无来源文件给另一份定罪；以载荷摘要顶替实例身份。

## P2 · 服务器暂停、开机宽限与安全点缺少闭合证明

历史依据：根参照 jsonl 的 VERDICT-024（第 85 行）规定最后联系 AuthService 后按设备开机累计运行时长计 OfflineGrace，宽限结束到下一 SafePoint 暂停，演奏不得中断；VERDICT-059（第 167 行）规定 RealityPause 仅服务器时间、冻结整个账号、发起设备不能切换账号、时长≥宽限、结束才 Released。

冲突/缺口：

- 服务器时间流逝一小时，不必然等于休眠/关机设备的开机累计运行一小时；重启前后的基准、休眠计入规则和平台来源都没有冻结。`performance.now()` 只覆盖当前会话，不满足要求。
- 即使宽限已到期，已开始谱面还可继续到 SafePoint；没有最长排空证明，不能据服务器截止时间直接认为旧设备所有世界写入已经结束。
- 服务归属版本递增能拒绝陈旧在线请求，但**单独 fencing 不能阻止仍有离线资格的设备继续本地推进**。
- 账号级 `neurou-reality-pause-v1:<accountId>` 缓存不足以阻止另一账号登录、另一窗口、登出后登录或重启。稳定 deviceId、设备绑定服务记录、恢复与重装边界未定义。
- 立即账号暂停与已活动演奏/结局的不中断要求，需要明确操作准入、运行暂停、安全落盘和在途账号提交如何协调。

推荐裁定包（须作为整体审查）：

1. RealityPause 仍只由服务器判定；客户端时间仅倒计时。最低一小时且≥OfflineGrace；服务不能证明安全排空时不因倒计时归零自动 Released。
2. 设备启动时钟端口有可信来源、bootId、累计运行毫秒和休眠语义；无法证明连续基准、重启或缺能力时，离线资格按不确定拒绝，须联网重新认证，不重新赠送一小时。不能用墙钟补缺口。
3. 服务签发/撤销有版本的设备/世界推进资格；旧资格必须在平台可验证条件下实际到期或经安全点确认排空。没有证明时保留暂停/拒绝认领。不能说“服务拒收提交”即等于“本地禁止推进”。
4. 暂停一经确认即拒绝新准入；正在演奏不直接破坏 INV-12，按正式 SafePoint 终止世界推进并排空保存/账号提交。安全点集合与离线资格允许的终止落盘范围须先列清。
5. 服务保存发起 deviceId→暂停账号绑定；任意账号登录/切换前核查，活动绑定拒绝切换；可信设备身份或绑定状态不明时不能放行。普通应用重启必须恢复约束；清数据/重装的信任边界另写明。

若坚持服务器一小时结束就无条件 Released，并保留可在关机后继续剩余宽限的离线资格及无限安全点等待，则不能保证同一实例只有一个可推进设备，需明确修改其中一项历史承诺。ARCHITECT 不在本轮自行选改。

## P3 · 本地目录追加不能原子提交全球归属

证据：`quality-review/b3-world-fork/verdicts-271-285.md` 的 278/279/281 冻结本地目录追加与日志恢复；`WorldForkSession.ts:115` 和 `WorldForkStorage.ts:193` 拒绝源/目标相同 ID；目标 revision=0；`WorldCoreStateStorage.ts:153` 只允许回滚删除精确的未发布分叉目标。

迁移要保持同 ID、原 revision/forkOrigin，并把归属改到另一设备；服务器归属与 localStorage 目录不在一个原子事务。另见 `WorldFolderBuilder.ts:310` 的 DeleteWorld 和后续 deletedAt GC：写源删除墓碑会清除谱面/成绩，与“不修改、不删除原文件”冲突。

推荐裁定：

- 保留“目录追加是本地新目标唯一发布提交点”；确认它不充当全球归属的唯一原子提交点。
- 为迁移独立冻结权威 Release/Claim CAS、migrationId 幂等 receipt、递增归属版本和本地可恢复 journal；服务操作与本地发布分段，网络请求不放入同步目录锁回调。
- 目标获 Claim receipt 后，本地发布失败保留日志并恢复，不能把已认领事实当未发生。目录中可见但尚未满足归属/载荷验证的世界不开放。
- 源文件保持；Migrated 是设备加载资格/归属登记状态，不使用 deletedAt、不清 Core/媒体。
- 首次迁入时目标本地 worldId 已有 active 文件、不同 Core 或删除墓碑，一律保留并拒绝；精确重复投递是否视为已完成、迁回是否允许及旧本机目录再发布方式另行冻结。
- 服务须提供合法迁移对原 HomeDevice 的撤销证据；原设备据此分流为 Migrated。仅比较当前 HomeDevice!=self 不能区分普通复制和已经迁走的源世界，不能将后者自动分叉。

P3 也覆盖 **CrossDeviceDuplicate 新 UUID 的服务首次登记与本地目录发布协调**，不只迁移：推荐先持久化包含目标 UUID、完整候选、registrationId 和预期目录的独立导入事务，再服务登记。服务登记成功、本地发布失败保留同一事务/id 恢复，不能删日志将服务孤儿登记当未发生。本地目录发布后仍须验证目标 HomeDevice 权威证明才能打开。独立导入 journal/key、服务登记幂等结果、发布/恢复顺序以及与 fork pending guard 的协调尚未冻结，不能混塞进 `neurou-migration-v1` 日志。

需要明确批准“本地发布点与全球归属点分离”的解释。如果仍要求全球唯一点也是本地目录追加，则需另行服务/存储架构，不可由现有 Fork 适配器完成。

## P4 · 完整 FileCarry 的生产载体缺失

证据：NAMEBOOK.md:836 明文七项 WorldStateSnapshot 不是 FileCarryPayload，:1141 明文 B2.3 不实现共享同步/文件携带；当前 src 没有 WorldChangeLog/WorldCheckpoint/FileCarryPayload 的生产 codec。归档 `archive/sync/WorldChangeLog.ts` 是 add/merge 空方法体，`WorldCheckpoint.ts` 是空接口，不能算完整共享层。VERDICT-046（根 jsonl 第 132 行）要求共享层加发送者全部个人层，包括世界状态之外的个人媒体。

需要裁定：

1. **满足原完整迁移目标的推荐方案**：B2.4 增设 FileCarry 数据载体/codec/完整媒体清单前置冻结；共享状态并不等于要求实装全部 ObserverSync，但必须有合法序列化与验证来源，不能空造共享层。还需账号密钥来源、个人层及媒体的独立认证加密封装、共享层可读取/认证的外壳、版本/内容摘要/大小限制、导入失败保留和全部个人载体归属清单。其他账号接收者能读取共享层、不能解密个人层；转发以本人层替换旧密文，不能只加密整包。须解除相应旧阶段排除范围，先再次冻结，再实现。
2. 若保持现有范围：正式降为“七项 Core 受限携带契约/原型”，不命名成完整 FileCarry，不声称完整 WorldMigration，真正迁移保持 UnsupportedBoundary，留后续范围裁定。

最终彼岸历史上不可复制、可迁移；当前本批真实生产来源仅 Primary。最终彼岸/bug 彼岸的生产迁移是否进入 B2.4，以及归档中 BugShore 迁移挂起项，也须作为范围提请，不能靠一个通用 Core 类型宣称这些路径已齐备。

## 待 PROTOCOL 回复的具体字段

请分别给出：P1 选择有限范围或授权完整身份升级；P2 批准上述资格/时钟/安全点约束或指定历史规则修订；P3 批准提交点范围解释并明确迁回/碰撞策略；P4 选择补齐完整载体前置或正式缩减交付范围。真实服务仍建议延后接入，B2.4 先共享权威测试适配器；是否解除 stage-1 外部服务排除须单独明示。

本文不要求实现、部署、发消息给 Trae 或修改正式名库。配套 286～300 裁定、v3.12 提案、契约草案和基线门禁均已准备供审阅；受阻条款在 PROTOCOL 回复之前保持受阻。
