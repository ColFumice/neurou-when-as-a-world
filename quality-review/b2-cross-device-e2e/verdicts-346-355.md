# B2.4e 验收冻结 · VERDICT-346～355

2026-10-11（Asia/Shanghai）。依据 VERDICT-286～345、P1～P4 的正式回复、d 已验收及本轮 e 授权。本轮冻结的是整体运行验收及证据边界，沿用 b/c/d 的现有接口、运行时名称、schema、key、锁与 journal phase，不实现新机制。实际 e 结果由完成后的产物确认；本文不预先判定通过。

| 裁定 | 正式冻结内容 |
|---|---|
| 346 | B2.4e 仅完成端到端、双档 Creator、既有契约回归、三门禁与源码保护证据。只在 `quality-review/b2-cross-device-e2e/` 写测试脚本与交付材料，不修改 production、docs、名库、参照、核心算法或门禁规则。新增运行时名 / 接口 / key / phase 为零；不借 e 补做 B2.5。 |
| 347 | 旧 a 的 P1～P4 已由 301～310 闭合，旧“停止 b / 等 Trae / 全 FileCarry 不齐”的点时材料保留但不再阻断。用户后续确认 d 所见 docs 变化为 Trae 授权同步，并正式验收 d、追认 v3.14；该来源问题以本轮后续 PROTOCOL 记录闭合，不重新请示。d 原 SHA 差异、`completeProtectedAuditPass:false` 和旧诊断保持原值，不追改历史审计为 PASS。用户追认与正式文档实际落盘分别报告；现有文件未出现 v3.14 时不能宣称已同步。e 从自己的固定基线审计本轮零生产改动。 |
| 348 | WorldHomeRegistry 仍是账号级服务归属权威，WorldRegistry 仍是本机位置层、未由 e 实装。范围仅本账号自建 / 分叉的非 InitialWorld 世界，身份来自现有绑定 ContractAdapter 端口。InitialWorld 不登记、不作为 c 传输或 d 迁移世界；源全账号 SafePoint 排空与 RealityPause 仍包括 InitialWorld / 空世界。两设备独立 InitialWorld 互不争抢归属。 |
| 349 | 整体验收在同一账号、同一持久权威、同一条实际 Creator 主链中先验证 c 合法复制，再验证 d 同 ID 迁移。c 由 A 非 Initial 源产生 B 新 UUID：七项重键、FormatTime 保留、Inherited 语义、原源仍 Home=A。d 将 A 的原 worldId 迁到 B：不重键、不 rebase、不改 revision / forkOrigin / capturedAt / FormatTime。B 的复制目标与迁移目标必须为不同 worldId、各有独立 Core / 目录记录 / receipt / 当前 Home。c 目标先正式打开，再验证 d 全链及暂停拒入后，其 Core / 导入 journal 仍保持先前字节；不得让迁移覆盖或冒用 c 目标。 |
| 350 | 沿用 d 主动排空 → MigrationRelease → RealityPause → Released → MigrationClaim → LocalPublished → 正式 Restored / Complete 的同 ID 链。服务归属是全局权威，目录追加是本地新发布唯一 commit point，独立日志协调两域。迁移源不改不删无墓碑；WorldClearRecord / FirstWorldCleared 继续同账号既有事实、不随载荷复制。CopyPermission 仅是 c 门槛，d 不要求。源迁走后不凭 HomeConflict 或历史 c proof 再自动复制；打开鲜读当前归属。 |
| 351 | RealityPause 时长规则仍为 `max(1 小时, OfflineGrace)`，仅服务时钟裁决；客户端时钟 / 倒计时 / 缓存均不解锁。e 主链允许明确推进独立 `ContractServiceClock` fixture 一小时，报告必须标 `ContractAdapter`、`serviceClockAdvancedMs:3600000`、`realElapsedHour:false`。该推进不是实际等待、真实服务器或平台 OfflineGrace 实现。活动续行补验不推进服务时钟，并另记 `serviceClockAdvancedMs:0`。 |
| 352 | 同一 RealityPause 下 A / B、InitialWorld、c 复制目标、d 待迁目标及其他世界均拒绝新准入；发起逻辑设备跨窗口 / 客户端重建不能登录另账号。已在其他窗口运行的活动保留必要输入、真实原生媒体及自然时间线，不强退 / seek / 清时钟 / 伪造 ended / Complete。另窗口迁移不同稳定世界时，实际回放自然 ended、世界及账号结算后进入 SafePoint，显式返回文件夹不能提前绕过；INV-10 / INV-12 / INV-13 保持。 |
| 353 | e 重跑 b/c/d 既有契约套件，并区分领域 / 存储故障 / 内容验证 / 实际组合根。包括严格 data-only 与接收端重新 parseComplete、身份 / 权限、服务 unavailable、Web Locks 拒绝、Release / Claim 幂等与响应丢失、每持久 phase 恢复、碰撞 / 原值迁回 / 异值拒绝、服务成功本地失败与本地已发布服务未知。原有子套件不重复累计；d 的 65 项 c 回归是历史重复执行，不额外加到 e 独立用例数。既有脚本输出若重写历史 JSON，应恢复原字节，在 e 保存本轮副本。 |
| 354 | Creator 双档固定 1920×1080、2560×1440，每档使用独立干净 profile，从正式登录 / 序章 / 通关 / 本机 Fork 开始，经 c 复制及 d 同 ID 迁移后正式打开；禁止玩法状态或世界文件种植。报告给逐步截图、实际 dimensions、账号 / ID 关联、receipt 与归属、源字节 / 账号事实保持、原生媒体事件。两档比较语义结果与不变式，随机 ID / 时间不要求互相逐字节相等。验收源码、sourceMap、served 编译字节首尾核对，错误及外部请求计数单列；契约 fixture 不冒充 Creator / 物理双设备证据。 |
| 355 | e 结束运行三条现有门禁，并以本轮固定 SHA 基线确认 production / docs / 名库 / 参照 / 配置 / junction 未改；测试证据目录与生成目录按已记录范围排除，不移动允许清单或旧基线。最终报告将本轮 e 运行、契约、门禁、证据一致性、保护审计分别给结果；任一必需项未完成标 Pending / FAIL，不沿用 d PASS 代替。本轮闭合 B2.4 受限 Core / ContractAdapter 范围，完整 FileCarry、真实 AuthService / CommitRelay / fetchServerTime、平台 OfflineGrace、非 Primary 生产迁移、WorldRegistry 位置、AccessCode / ObserverSync 留 B2.5 或后续独立范围。 |

以上只冻结验收规则，未新增服务能力、可信物理设备声明或生产交付。若 e 暴露新的机制缺口，记录具体 PROTOCOL 并停止受影响路径；不在测试轮静默改生产源码。正式名库 v3.15 同步材料见本目录附录提案。

## 冻结规则适用范围澄清（依据 e 入场前用户已给出的授权）

用户在 e 入场前已明确授权本轮并发官方 Markdown 同步归因为 TraeAuthorized。355 的 docs / 名库零改要求约束实施代理不得写入；Trae可按该既有授权并发同步。production / 配置 / 其余参照 / junction 零改要求保持；docs/NAMEBOOK.md、docs/spec/stage-1.md、docs/spec/stage-1-acceptance.md 三个已列举路径若发生正式同步，单列授权分类、原 / 终 hash及diff，不把raw差异抹为相等，不泛化豁免其他文件。这是既有入场授权的适用澄清，不是测试后放宽规则或 e 新运行时契约。终态实际改变前两项，v3.14 / d已同步，`rawHashEquality:false` / `sourceProtectionPass:true`；实施代理未写正式文档。
