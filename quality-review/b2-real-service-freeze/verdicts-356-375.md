# 《雨若》ARCHITECT 正式审查裁定书 · 第 36 批 · VERDICT-356～375

日期：2026-10-11（Asia/Shanghai）。范围：B2.5a 命名、真实服务边界、契约与安全模型；新增机制实现=0。

**总裁定：B2.5a 尚未全量冻结；B2.5b～f 不准入实现。** 依据本轮“发现新的架构冲突或前置缺失，先停止，提交 PROTOCOL”，提交 PROTOCOL-B2.5a-001（P1～P6）。以下【确认】沿用已冻结规则，正式审查结论有效；【提案】或【受阻】没有升级成冻结实施授权。20 个裁定编号连续且仅分配给本轮；不能让 Trae 将候选字段落成已冻结名库。

依据：正式 NAMEBOOK 已含 v3.15；VERDICT-020/022/023/024/046、301～355，当前 b/c/d 端口与 e 整体验收。B2.4 受限 Core/两逻辑设备/ContractAdapter 闭合保持，不重启历史 P1～P4。

## VERDICT-356 · 阶段事实与本轮边界【确认】

裁定结论：接受 B2.5 真实接入阶段方向，本轮仅审查冻结。v3.15 已在当前名库落盘；v3.16 仅交附录提案。本轮不修改任何现有文件，不部署、注册账号、装依赖、添加 TS 实现或造运行成功。

理由：真实服务、加密与设备身份需要独立可信边界；e 的 fixture 时间与逻辑 deviceId 无法证明真实平台能力。影响范围：B2.5 全阶段准入。可逆性：范围可后续显式改裁，历史证据不改写。

## VERDICT-357 · 部署采用服务器代码 + 本地服务，容器是运行方式【提案】

裁定结论：首选独立 Node.js 24 LTS/Fastify 5 服务包与 PostgreSQL 17，本机 HTTP loopback 开发；Docker Compose 是同一代码的推荐运行方式，Windows 原生运行作为替代。两真实设备验收用同一局域网服务与 HTTPS，公网/云非前置。服务器不是 mock，不允许 fixture 时钟注入生产实例。

理由：独立进程、数据库事务、真实网络失败即可验证真实协议；无需先申请云账号。影响范围：server/ 独立包、反向代理、迁移/备份及健康检查，详见 deployment-plan.md。可逆性：运行平台可替换，wire/存储版本不能静默变化。

## VERDICT-358 · 历史服务签名保留，新异步端口分名【受阻 P1】

裁定结论：AuthService.login/logout/verify 和 CommitRelay.relay 的既有同步签名不改。真实请求使用 RealAuthServicePort/RealCommitRelayPort；fetchServerTime():Promise<number> 保持逐字方法签名。旧 verify=true 只可表示旧骨架本地状态，不能签发网络认证或离线权限。

理由：Promise 替换 void/boolean 不是兼容；现有核心 guard 还只接受 ContractAdapter。影响范围：真实端口、IntentPort 类型窄边、组合根模式分流，须 P1 明确准入。可逆性：增量接口可版本化，不隐式覆写旧契约。

## VERDICT-359 · 账号认证与凭据生命周期【提案】

裁定结论：B2.5 采用账号密码认证，服务器 Argon2id；随机会话凭据，15 分钟访问资格、7 日绝对刷新寿命，刷新一次性轮换并检测重用。Web 同 origin HttpOnly/SameSite=Strict cookie，HTTPS Secure，精确 Origin/CSRF 检查；原生凭据在 OS vault。密码/刷新凭据不进 localStorage、Core、FileCarry、URL或日志。设备挑战绑定另行校验，不用指纹代替密码。OAuth 不作为本阶段依赖。

理由：账号与设备是两种证明；本地生成 accountId 不构成授权。登出先清本地准入与解密能力，服务不可用时明确保留撤销待办、不能声称服务器已撤销。影响范围：RealAuthServicePort 与轻量账号/设备事实。可逆性：未来可增加 OAuth，不能改变账号 ID 或从令牌派生文件密钥。

## VERDICT-360 · 服务器时间不是准入 receipt【提案】

裁定结论：时间由已认证 AuthService 提供，受服务实例、requestNonce、issuedAt/keyId 签名绑定；fetchServerTime 只返回校验后的非负安全整数 epochMs，失败拒绝 Promise。禁止 Date.now/performance.now 回填。RealityPause 的结束、归属和 Claim 仍由服务事务裁决，不由本地倒计时或一次时间样本裁决。

理由：传输真实性不等于准入；服务时钟异常/回滚或恢复不确定时拒绝解冻与续 grant，暂停不能提前。影响范围：SignedServiceReceipt、服务时钟健康与恢复。可逆性：签名 key 轮换可控，时间口径不改。

## VERDICT-361 · CommitRelay 采用客户端增量拉取【历史确认；wire 提案】

裁定结论：沿用 VERDICT-024，HTTPS POST 提交/ACK + 客户端 cursor 增量拉取，25 秒有界 HTTP 长轮询；本轮不选择 WS/SSE 主协议。服务器只保留未确认的 WorldCommit 密文、成员准入、幂等摘要和拉取游标，全部成员确认或保留期届满删除。没有个人层、向量、检查点、完整共享状态或文件上传接口。

理由：拉取是既有裁定；有限队列无需保存世界状态。提案保留期24小时仅在 `retention >= SettleHorizon >= OfflineGrace + boundedRelayDelay` 满足时可用；单条≤64KiB、批≤256条且≤1MiB。服务cursor与作者自序号分开，ACK必须在客户端校验并耐久保存后发送。游标丢段返回Gap，用户文件补齐，不让服务器补检查点。影响范围：Relay wire；依赖P3。可逆性：容量可版本配置，变更不能丢未确认数据或扩大服务器边界。

## VERDICT-362 · Relay 正文端到端加密及作者真实性【历史确认；密钥提案】

裁定结论：TLS 必须，且不足以满足“服务器只看外层”；WorldCommit 正文使用世界/成员域随机 WorldRelayKey 的 AES-256-GCM，作者注册签名绑定外壳和密文。服务器验证账号/成员/外层权限与限流；接收端验签、解密、再次验证正文 SharingCriteria 与开发者修改权限。FileCarry 个人账号密钥与 WorldRelayKey 分离。

理由：服务器不能理解正文；群密钥持有不等于开发者权限。成员加入/撤销与 epoch 轮换需 P3 补冻；不得以六位 AccessCode 派生密钥。影响范围：共享提交、密钥交接、有限离线序号段与重放防护。可逆性：suite 升级用版本，不能静默降明文。

## VERDICT-363 · FileCarryPayload 保持唯一完整语义【确认】

裁定结论：继续用 FileCarryPayload，不新增 FullFileCarryPayload。完整定义是可读共享层（WorldChangeLog + WorldCheckpoint）+ 发送者本人全部个人层；对外 FileCarryEnvelope 包装本人密文。CoreTransferPayload/RestrictedMigrationCorePayload 保持受限历史名称，不是完整载荷或未来密文兼容版本。

理由：多加 Full 会让旧名称看似部分合法；七项是混合个人状态与世界元数据的投影。影响范围：命名与 formatVersion，旧 Core schemaVersion=1 不改。可逆性：格式升版不改分层语义。

## VERDICT-364 · 完整共享 codec 不能从空骨架冻结【受阻 P3】

裁定结论：完整 codec 必须覆盖 WorldCommit、AppendedAt、日志顺序/去重/同 ID 异值拒绝、检查点覆盖/摘要/重放、SharedWorldState、SharingCriteria、开发者权限和 SettleHorizon。当前空接口与无生产来源不能成为完整 codec。contracts-draft.md 标出待裁 schema，只冻结严格拒绝原则，不声称完整 v1 已定义。

理由：把个人 NarrativeEvent 当共享变化会越过所有权；新增地图/共享生产可能扩大 A/B/C 核心范围。影响范围：B2.5c/d 入场前补冻。可逆性：补冻可替换候选字段，已存生产格式不能靠推测兼容。

## VERDICT-365 · 个人数据与媒体清单【既有归属确认；完整生产受阻 P4】

裁定结论：本人Ledger/PuzzleProgress/RecallCount/ChartSnapshot/ChartScore与实际已保存截图ProcessedMomentImage的像素、合法元信息/缩略图、已存在的个人入场视频纳入本人层。MomentImage仅瞬时输入，截图立即处理、不保存原图的历史规则保持（NAMEBOOK:129）。FormatTime、WorldLink保留世界自身归属；通关/里程碑/CopyPermission不从文件授予。官方公共曲目媒体仍是内容资源，个人生成/保存字节不能只给URL或resourcePath。

提案：目录式单文件容器，共享 JSON + 本人加密 JSON + 按条/分块独立加密媒体，内部相对 ID 引用与 SHA-256/长度校验。没有生成媒体可列 NotCaptured，有索引却丢字节则 Incomplete；禁止空数组补缺。入场视频现无生产捕获，需冻结归属/采集来源与字节读口；不在本轮新增 EntryVideoCapture 机制。影响范围：完整载荷认证。可逆性：容器可升版，不改个人数据所有权。

## VERDICT-366 · 对称 suite 与真实存储加密【提案；存储受阻 P4】

裁定结论：个人层/媒体 suite 选 AES-256-GCM，96-bit nonce、128-bit tag；JCS规范 JSON、SHA-256摘要。每次导出/存储对象生成新的 256-bit DEK，媒体分块独立认证；密钥封装与数据 nonce 分域。包括主 key、全部 journal、暂存与个人媒体的静态加密，不仅导出加密。

理由：GCM 同时保密与认证；同步提交口不能 fire-and-forget 异步加密。影响范围：真实密文存储边界与 FileCarry；P4 未裁不能实施“透明包装”。可逆性：拒绝未知 suite，旧 key/suite 解密迁移须显式版本协议。

## VERDICT-367 · 随机账号根密钥、恢复与轮换【提案】

裁定结论：账号根密钥 AccountKey 随机 256-bit，在客户端生成；AuthService 只持账号认证/授权、wrapped-key 轻量记录，不持明文账号/世界密钥。已有可信设备在重新认证后加密批准新设备；否则使用本人离线 256-bit recovery secret 解包。登录密码、accountId、JWT/短会话 token 不直接派生加密 key。

理由：密码重设不应丢旧文件，也不能让服务重设密码取得旧个人层。丢失全部可信设备和恢复秘密即无法恢复旧密文，不能宣称账号找回=数据找回。轮换新 keyId/epoch 用于新写，保留旧解包链；泄露则重包/必要时重加密本地数据，历史已流出明文无法收回。影响范围：账号 key lifecycle；不上传任何世界存档。可逆性：恢复策略影响历史可读性，须先冻结后启用。

## VERDICT-368 · nonce、AAD 与签名绑定【提案】

裁定结论：AAD绑定service domain/formatVersion/worldId/senderAccountId/keyId/keyEpoch/exportId、共享规范字节摘要、条目/分块序号与总数/长度/媒体身份；私有媒体索引在本人密文内。每对象新DEK，entry子key用HKDF-SHA-256域分离、chunk用连续唯一nonce，按security-model.md唯一计划；包头摘要覆盖有序条目与所有密文，注册发送设备签名。服务receipt用可信公钥与ES256/keyId独立验签。

理由：阻止跨账号/世界/分块替换，hash 不代替身份认证。转发重新组装本人层、移除上一发送者密文，但不凭转发者签名重写开发者权限。影响范围：FileCarry、Relay、轻量 receipt 三个签名/密钥域。可逆性：改 AAD 即新格式，不能尝试旧规则解密。

## VERDICT-369 · Web 不以应用时长降级 OfflineGrace【历史确认；原生契约提案】

裁定结论：沿用OfflineGrace从最后成功认证联系起按设备开机累计运行时长、当前1小时，不接受应用时长/performance.now/Date.now替代。新增平台提案把它绑定OS boot session，bootId变化/uptime倒退/可信能力缺失则grant失效；Web无可信设备uptime，提案拒绝签发离线资格、在线受限运行，不把这些新字段称历史已实现。

提案：批准原生可信 host 提供 bootId/uptime，休眠计入预算、跨进程共享、重启重新在线。系统 API 提供 uptime 不自动具有抗恶意客户端信任；攻击者/attestation 范围须 P5。影响范围：平台 OfflineGrace；不能以此改变音频时间线。可逆性：平台新增能力可增加，不偷换历史计时定义。

## VERDICT-370 · SafePoint 与自然排空保持【确认】

裁定结论：保留历史禁止集合与d已验收的Primary排空集合、live单次能力：关闭新准入，按worldId排序持真实leases，排尽在途世界/账号事实、回读全部未删世界含InitialWorld/空世界；无活动首演/重演/结局、揭示/七秒计时/排队入口、未稳定事实、未恢复发布journal、Pending/Failed非继承账号通关提交。结局禁止边界保持，不把尚未实装的结局入口称d已验收。

到期/暂停只请求 drain，不强制结束媒体、seek、清时钟、跳揭示或停整个 FrameDriver。已有活动自然结束，结算耐久后下一 SafePoint 暂停；源持锁直至 Release 返回。服务接受确认寿命 30 秒保持，冷静期不是排空证明。影响范围：所有真实新准入与排空桥接 P2；完整媒体/relay 本机耐久写入也须稳定，网络 ACK 无需无限等待。可逆性：扩大安全点禁止集须审查，不能缩成 UI 布尔值。

## VERDICT-371 · deviceId 只能代表达到的证明等级【受阻 P5】

裁定结论：指纹不认证；随机注册令牌/不可导出浏览器 key 仅证明安装凭据，WebAuthn 仅证明验证器凭据，云同步/漫游 passkey 不证明单一物理机。服务签发不透明 deviceId，绑定注册公钥与 assurance 等级；只有明确受信 host/硬件证明才可声称 PhysicalDevice。

理由：删缓存/新 profile/新 passkey 不能维持同一物理机账号绑定；签名不证明物理停机。影响范围：严格发起设备绑定/离线/迁移真实验收；Web 不能算达标降级。可逆性：收紧产品承诺必须 PROTOCOL 改裁，不能在实现中悄改语义。

## VERDICT-372 · fixture→多真实设备不继承授权【提案】

裁定结论：A/B fixture 标识、receipt、时钟、storage域不升级成真实凭据或物理 ID；每真实设备服务注册，公钥 challenge 绑定、设备撤销单调 generation。fixture 文件可作为不可信输入重新验证，不能自动取得真实 HomeDevice/通关事实/CopyPermission。

首次真实登记由账号权威 CAS、唯一 world 实例证据与人工确认的 legacy enrollment 规则控制；有冲突保留所有文件，返回 HomeConflict，不后到覆盖。同账号同 worldId 迁移保持身份，复制仍另 ID；换密钥/重装不自动继承旧 deviceId 或解除 RealityPause。InitialWorld 继续不跨设备登记，却仍纳入账号暂停/源排空。影响范围：多设备迁移/撤销与历史导入，须 P1/P5。可逆性：登记可显式撤销，已发布世界不能伪装回滚。

## VERDICT-373 · ContractAdapter 永久保留，生产独立装配【确认；接线受阻 P1】

裁定结论：保留 ContractAdapter 做确定性回归、服务时钟故障注入及 fixture 验收；ExternalService 做真实服务链。二者独立组合配置、账号/凭据/存储/服务实例域，旧 fixture key/锁字符串不改。真实模式禁用 fixture 时钟推进和自动 fallback，不能带 mode=ContractAdapter 冒充生产。

理由：可回归与真实证据分别必要；测试 receipt 无法验出真实服务凭据。影响范围：新增 ServiceEnvironment 配置与真实域策略，实际存储字符串待 P1/P4，不在本轮宣布冻结前缀。可逆性：配置可切，但不能把同一份权限数据跨域复用。

## VERDICT-374 · 服务不可用按能力降级，不伪造权威【提案】

裁定结论：Auth/归属/时间失败拒绝新登录确认、登记、Release/Claim、暂停结束与离线续期；保留源、目标和 journal。仅拥有有效签名 OfflineGrant、同 boot/可信 uptime、匹配账号/device/homeRevision 的原生设备可继续已准入世界至预算到期后的自然 SafePoint；新离线跨设备操作始终不开放。Web 无 grant，活动自然排空后拒新准入。

Relay 失败可本地耐久暂存合法共享提交并显示待同步，不撤销已发布本机世界；有限序号段/容量/SettleHorizon 不满足时拒绝新增共享发布，不改个人事实。离线结算的账号通关事实保留待服务验证，不凭缓存升级权限。影响范围：错误结果与重试恢复；依赖 P3/P4/P5。可逆性：恢复联网仍重验归属，不从本地缓存自解冻。

## VERDICT-375 · 不变式、阶段门槛与整体停止【确认】

裁定结论：沿用 INV-10/12/13、B2.3 源→目标→目录锁与 lease、无 Web Locks 显式拒绝、B2.2d-2 七项同主 key；目录追加是**本地新世界发布**唯一 commit point，不冒称服务器/本地全局原子点。沿用 RealityPause≥max(1小时,OfflineGrace)、源主动排空、发起设备账号绑定、FileCarry 本人账号加密且共享层可读。逻辑零 cc、presentation/type-only窄边不变。

B2.5b～f采用stages-and-open-items.md的分拆，但相关P项未闭合不得进入实现；本轮三门禁只检验当前源码基线，不检验Markdown候选或新机制。保护清单出现两项外部报告新增（docs/与quality-review/），6,937→6,939、原有文件无改/删，raw全量比较FAIL/来源待确认，不能报告全工作区零变化。影响范围：阶段验收/名库同步；可逆性：解除阻塞须正式PROTOCOL，既有不变式不隐式解除。
