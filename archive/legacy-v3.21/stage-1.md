﻿﻿﻿\# 阶段 1 系统边界与验收标准

> 本文件最近更新：HANDOFF-ROUND-18，纳入 VERDICT-121 ~ 126（T7 视频谱面 + 键盘打击垫 + 暂停）。

> 本文件最近更新：引导线编辑器阶段，纳入 VERDICT-147 ~ 157（v3 时间模型 + editor 模块 + 颜色伴随文件）。

> 本文件最近更新：世界文件夹阶段，纳入 VERDICT-158 ~ 168（登录 → 序章 → 世界文件夹启动流程 + 编辑器目录框架）。

> 本文件最近更新：音频编辑器阶段，纳入 VERDICT-180 ~ 190（MIDI 音轨编辑器最小交付 + musicEditor 模块）。

> 本文件最近更新：音乐编辑器批量操作 + B1 谱面接入，纳入 VERDICT-191 ~ 200。

> 本文件最近更新：B2.1 本地多世界基础，纳入 VERDICT-201 ~ 210。

> 本文件最近更新：B2.2 账号里程碑与状态契约，纳入 VERDICT-211 ~ 225。

> 本文件最近更新：B2.2c 真实通关链路落地，纳入 VERDICT-226 ~ 240 及最小内容生产者授权。

> 本文件最近更新：B2.2d-1 完整状态恢复前置（核心机制），纳入 VERDICT-241 ~ 255。

> 本文件最近更新：B2.2d 完整状态恢复前置（核心 + 扩展），纳入 VERDICT-241 ~ 270。

> 本文件最近更新：B2.3 WorldFork 实装，纳入 VERDICT-271 ~ 285。

> 本文件最近更新：B2.4a 冻结 + B2.4b 契约级最小闭环，纳入 VERDICT-301 ~ 310。

> 本文件最近更新：B2.4c CrossDeviceDuplicate 受限 Core 原型，纳入 VERDICT-311 ~ 325。

> 本文件最近更新：B2.4d WorldMigration + RealityPause，纳入 VERDICT-326 ~ 345。

> 本文件最近更新：B2.4e 跨设备整体验收 + B2.4 闭环，纳入 VERDICT-346 ~ 355。

> 本文件最近更新：B2.5a 冻结 + B2.5b 真实认证服务，纳入 VERDICT-376 ~ 390。

> 本文件最近更新：P3 共享契约补冻，纳入 VERDICT-391 ~ 410。

> 本文件最近更新：B2.5c-1 契约与确定性重放，纳入 VERDICT-411 ~ 425。

> 本文件最近更新：B2.5c-2a 冻结，纳入 VERDICT-426 ~ 440。

> 本文件最近更新：B2.5c-2b 实施，纳入 VERDICT-441 ~ 447。

> 本文件最近更新：B2.5c-2c 真实 Relay，纳入 VERDICT-448 ~ 451。



> 依据：名库 v1.6、简报"开发路线·阶段 1：核心玩法原型（Cocos 2D 移动 + 箱庭 + 一个视频谱面）"

> 目标：用最小的可玩闭环，验证"移动 → 发现痕 → 解谜 → 获得深痕 → 进入视频谱面 → 结算写回账本"这条主干链路。



\## 1. 阶段目标



玩家在一个手工搭建的箱庭场景中移动主角，通过一个节奏敲击机制解开一条短解谜链，获得一枚深痕，进入一张视频谱面完成演奏，结算结果作为一条叙事事件写入账本。



\## 2. 技术基线



| 项目 | 基线 |

|---|---|

| 引擎 | Cocos Creator 3.8.8 |

| 语言 | TypeScript |

| 平台 | 只做 PC |

| 视频 | mp4，H.264，1920×1080 和 2560×1440 两档 |

| 视频解码 | 优先 Cocos 自带 VideoPlayer |

| 外部服务 | 本阶段不接入 |



\## 3. 本阶段涉及的系统（10 个模块）



| 目录 | 系统 | 职责 |

|---|---|---|

| constants | 共享词汇 | 枚举、ID类型、常量定义。只有定义，不能有逻辑 |

| ledger | S4 事件图（桩实现） | 只追加的账本。读取接口和追加接口分开存放 |

| world | S2 地图 | 世界地图、坐标轴、地图中点、距中点距离、镜头空间信息 |

| character | S6 角色 | 主角移动、移动速度、逻辑拖尾色 |

| trace | S3 元素与痕 | 场景实体、可见性状态、痕、深痕、节奏敲击、解谜进度 |

| chart | S7 谱面 | 谱面数据、时间码对齐、判定、引导透明度、得分 |

| editor | 引导线编辑器 | 引导线编辑器纯逻辑模块（零 cc、零 UI） |

| musicEditor | 音乐编辑器 | 音乐创作纯逻辑模块（零 cc） |

| director | S5 叙事导演 | 解谜链编排、谱面入口、全工程唯一调用账本追加接口的模块，当前感知模式保存，垂直物理推进编排（tickVertical 调用方，每帧一次） ，世界运动门控（受限制状态下暂停世界运动，不缓存请求，不补算暂停时长）|

| presentation | S8 表现 | 所有渲染、镜头、转场、拖尾渲染、输入采集 |



\*\*重要：`event` 目录已改名为 `ledger`。移除 `boss`、`sync`、`service` 目录（归档后移除）。\*\*



\## 4. 明确不在本阶段的内容



\- AI 中间层全部内容

\- 服务器认证、世界事件推送、中继、观察者同步

\- 多世界创建与管理、存档复制 / 分叉 / 迁移

\- 本批有限音乐编辑器以外的新音乐 / 地图 / 剧情编辑器

\*\*v3.1 / VERDICT-158 ~ 168 纳入的有限范围（世界文件夹阶段）\*\*

\- 开发阶段本地账号登录 + 由 director 编排的一次简短序章灰盒

\- 登录/首次序章之后统一进入 WorldFolderView

\- 唯一 InitialWorld 入口接通现有 A/B/C/T6/T7 gameplay

\- 世界编辑器目录 15 项，GuidanceEditor 及 MidiTrackEditor 可打开；MusicEditor 为分组目录，RGB 与网格占位

\- 世界/编辑器退出回 WorldFolderView

\- 所有启动链接（含旧 ?guidanceEditor=1）经过统一入口

\*\*v3.3 / VERDICT-180 ~ 190 纳入的有限范围（音频编辑器阶段）\*\*

\- MIDI 音轨时间轴、音符放删改、有界 undo/redo

\- 音乐草稿保存恢复

\- 离线简易试听

\- ChartSourceData 导出及引导线消费

\- RGB 波表 / 网格及实时 DSP / AudioTrack / WebSynth / JNI、标准 .mid、音频片段 / 录音 / 完整混音继续排除

\- 地图编辑器、街景图片生成地图

\- 路人、招募、操控切换、自动接管、待机动作

\- 事件空间视图、星图入口、瞬间截图、结局回映

\- 雨模式、雨痕、异痕、回响痕、触痕

\- 章节判定

\- 谱面的快照与重玩、魔王曲

\*\*v3.7 / VERDICT-211 ~ 225 纳入的有限范围（B2.2 账号里程碑与状态契约；仅 B2.2a + B2.2b）\*\*

\- 账号里程碑本地投影基础（FirstWorldCleared 读取 + CopyPermission 派生）

\- 状态捕获/恢复契约基础（Complete / Incomplete 判别 + 七项归属 + 诊断）

\- 目录权限显示（权限已取得 / 未取得 + 分叉未实施）

\- 明确排除：真实世界通关写入、完整 gameplay 恢复成功、WorldFork 实装、FileCarryPayload、WorldRegistry、跨设备、观察者同步、服务接入

### B2.2c 真实通关链路授权范围（VERDICT-226 ~ 240）

1. **SphereCrossing 业务实现**：按 VERDICT-227 精确触发条件重建，归 director；复用冻结名，archive 保持只读。

2. **WorldBossChart 合法内容装配**：由制作方经既有编辑器导出 schemaVersion=3 / tier='World' 的 GuidanceChart；每世界内容版本绑定唯一一首；禁止运行时 Regular 改 tier 或空占位。

3. **权威 RouteSignature**：World 首演 Completed 后从同一权威账本累计坐标冻结；6 个 DivergenceAxis 按正最大值归类，正并列按 Red→Green→Blue→Black→White→Grey 选首项，六情感全零返回 null。

4. **T6 ChartRef 与首演判据兼容**：ChartRef 新增可选 state: Entry / PremiereCompleted；T6 终点写 state='Entry'；T7/World 完成写 state='PremiereCompleted'；旧 T6/T7 只读兼容、不回写、不补 state。

5. **最小正式世界叙事内容生产者**：制作方编写 Primary 世界叙事交互内容（schemaVersion=1 / contentId / contentRevision / worldKind='Primary' / protagonistCharacterId / EventSpaceCenter / EventDistance / source / interaction / worldBossChartSource）；玩家通过 PlayerIntent 仅提交 choiceId；director 解析内容构造非零 20 维 NarrativeEvent 并合法追加。旧 T6/T7 灰盒行为保持。

**明确排除**：完整自动感绪计算、完整 20 维感绪系统、状态 hydration（B2.2d）、WorldFork 实装（B2.3）、FileCarryPayload、WorldRegistry、跨设备、观察者同步、服务接入、AccessCode。

**v3.9 / VERDICT-241 ~ 255 纳入的有限范围（B2.2d-1 完整状态恢复前置 · 核心机制）**

- 授权范围：权威账本（Ledger）、PuzzleProgress、FormatTime 三个 section 的持久化与恢复；无副作用 validate/hydrate；单主 key 原子提交、版本/前缀防回退、世界 lease 与活动目录验证
- 明确排除：RecallCount / WorldLink / ChartSnapshot / ChartScore / WorldFork；Ledger section 校验通过不等同 WorldState 完整恢复

**v3.10 / VERDICT-256 ~ 270 纳入的有限范围（B2.2d-2 完整状态恢复前置 · 扩展四项与七项完成）**

- 授权范围：七项（Ledger / PuzzleProgress / FormatTime / RecallCount / WorldLink / ChartSnapshot / ChartScore）全部持久化；Complete / Restored 可产出（七项全非空且通过内容绑定引用校验的运行时认证后）
- 明确排除：WorldFork（实装仍延后）；B2.3 身份 rebasing；FileCarryPayload
  > （本批次时点口径；WorldFork 已由 v3.11 / VERDICT-271~285 实装，见下）

**v3.11 / VERDICT-271 ~ 285 纳入的有限范围（B2.3 WorldFork 实装）**

- 授权范围：WorldFork 实装（同账号权限校验、Complete Primary 来源检验、七项精确继承与实例身份重键、短期日志提交/回滚/恢复）
- 明确排除：FileCarryPayload / WorldRegistry / 跨设备 / 观察者同步 / 服务 / AccessCode / BugShore 生产入口

**v3.12 / VERDICT-301 ~ 310 纳入的有限范围（B2.4a 冻结 + B2.4b 契约级最小闭环）**

- 授权范围：B2.4a 历史名补登与职责冻结；B2.4b WorldHomeRegistry 契约级最小闭环（首次登记 / 同设备重复 / 归属冲突 / 账号索引读取 / 严格 schema 与诊断，共享权威 ContractAdapter 两逻辑设备）
- InitialWorld 排除：不进入 WorldHomeRegistry，不参与 CrossDeviceDuplicate，不迁移、不传输为本批跨设备世界
- 明确排除：c（CrossDeviceDuplicate 受限 Core 原型）/ d（WorldMigration + RealityPause）/ e（端到端与双档 Cocos）；完整 FileCarry 留 B2.5

**v3.13 / VERDICT-311 ~ 325 纳入的有限范围（B2.4c CrossDeviceDuplicate 受限 Core 原型）**

- 授权范围：受限 Core 传输原型 / CrossDeviceDuplicate 处理（CoreTransferPayload data-only 七项载荷与接收端重新 parseComplete + 正式内容引用核验、六路分流、CopyPermission 校验、新 UUID 七项重键、服务先登记、本地目录追加发布、独立 journal 崩溃恢复与打开门控）
- 明确排除：d（WorldMigration + RealityPause）/ e（端到端与双档 Cocos）；完整 FileCarry 留 B2.5；真实外部服务

**v3.14 / VERDICT-326 ~ 345 纳入的有限范围（B2.4d WorldMigration + RealityPause）**

- 授权范围：同账号同 worldId 的 HomeDevice 转移（WorldMigration，不分叉/不重键/不要求 CopyPermission）；源账号主动 SafePoint 排空确认（覆盖全部未删世界，含 InitialWorld/空世界）、Release/Claim 请求与 receipt、全账号 RealityPause 冷静期（max(3600000, OFFLINE_GRACE_HOURS×3600000)，仅服务时钟判定）与 DeviceAccountBinding、独立 WorldMigrationJournal 五阶段（Prepared/PauseActive/Released/Claimed/LocalPublished）、目标同 ID 目录追加唯一新本地发布点、逐 phase 崩溃恢复与迁回/碰撞规则（共享持久 ContractAdapter、A/B 两逻辑设备）
- 明确排除：e（端到端与双档 Cocos 整体验收，不另造迁移协议）；完整 FileCarry 留 B2.5；真实外部服务（AuthService/CommitRelay）、平台 OfflineGrace 离线累计计时、非 Primary 生产迁移、WorldRegistry 本机位置 API、AccessCode/ObserverSync

**v3.15 / VERDICT-346 ~ 355 纳入的有限范围（B2.4e 跨设备整体验收 + B2.4 闭环）**

- 授权范围：纯验收轮——端到端 Creator 双档（1920×1080 / 2560×1440，独立干净 profile，登录→序章→通关→本机 Fork→c 新 UUID 复制→d 同 ID 迁移→正式恢复同一条实际主链，无种植）、b/c/d 既有契约套件隔离重跑、三条门禁与固定 SHA 源码保护证据；同一 RealityPause 下 A/B、InitialWorld、c 复制目标、d 待迁目标全部拒新准入，发起设备跨窗口/重建绑定保持，活动自然 ended 结算后退场；新增运行时名/接口/key/schema/journal phase = 0，生产源码改动 0，测试脚本与证据仅落 quality-review
- B2.4 整体闭环：受限 Core（七项 data-only）/ 两逻辑设备 / ContractAdapter 范围完成；c 新 UUID 复制目标与 d 同 ID 迁移目标独立并存、receipt/journal 独立，c 目标跨 d 全链逐字节保持；服务归属为全局权威、目录追加为本地唯一发布点
- 明确剩余留 B2.5 或后续：完整 FileCarry（共享 codec/完整个人媒体/账号加密与密钥 suite）、真实 AuthService/CommitRelay/fetchServerTime、平台 OfflineGrace 累计计时、可信物理 deviceId、非 Primary 生产迁移、WorldRegistry 本机位置 API、AccessCode/ObserverSync、完整产品账号切换执行端口

**v3.16 / VERDICT-376 ~ 390 纳入的有限范围（B2.5a 冻结 + B2.5b 真实认证服务）**

- 授权范围：真实 AuthService（RealAuthServicePort / RealAuthServiceAdapter：login/logout/verify/refresh/fetchServerTime/readServerTime/readAccountFacts，ES256(P1363) 签名 receipt，HttpOnly/SameSite=Strict 会话 cookie）；fetchServerTime 逐字签名保留，仅从真实已认证服务投影经签名校验的非负安全整数 epochMs，返回 Promise<number>，失败拒绝，不以 fixture/Date.now/performance.now 回填；轻量账号/设备事实（RealAccountFact / RealAccountFacts / RealRegisteredDeviceFact，只读本人身份与注册设备事实、注册时写显示标签，AccountFacts.revision 固定 0）；独立 server 包（Node.js 24 / Fastify 5 / PostgreSQL 17，真实 loopback HTTP 与独立 PG 进程）自有构建/测试/迁移，不进 Cocos 模块树与客户端门禁
- 保留端口：RealWorldAuthorityPort / RealCommitRelayPort 在源码仅类型定义，边界冻结/机制未实施；b 认证适配器不作为世界权威，旧 AuthService.login/logout/verify 与 CommitRelay.relay 原样保留
- 明确排除：c / d / e / f；不实施 Relay 共享 wire schema、完整 FileCarry、个人静态加密迁移、真实 Release/Claim（无 readMigrationPayload）、平台 OfflineGrace/PhysicalDevice/原生 host、AccessCode/ObserverSync

**v3.17 / VERDICT-391 ~ 410 纳入的有限范围（P3 共享契约补冻 · 纯文档冻结）**

- 授权范围：纯文档契约补冻——新共享 schemaVersion=1（profile 逐字 ExternalSharedOnlineV1，真实 port mode 逐字 ExternalService）的精确数据契约：WorldCommitIdentity 二元身份（authorAccountId + authorSequence，同服务实例同账号跨世界共用序号；旧 027 三元为历史格式，新 schema 拒 LegacyIdentityUnsupported，不静默迁移）、账号事务分配的 1024 号段（3600000ms 寿命，不归还不复用）与 WorldAppendPermit（appendedAt+30000ms，服务签名逻辑追加时刻）、三类精确变化（MonotonicReveal/TraceTouch/DeveloperMapChange ↔ Monotonic/AddOnly/RestrictedWrite，地图一条提交一个对象一个操作）、稳定 UUID 对象按对象合并与 tombstone 不复活、RelayCommitEnvelope 群域随机 DEK + AES-256-GCM-HKDF-SHA256-v1 与 ES256(P1363) 作者签名、成员 membershipEpoch/keyEpoch 与 WorldRelayKey 点对点 KeyPackage/Acceptance 交接、AccessCode 六位首次准入与 WorldObserverAdmissionFact、WorldChangeLogWire/RelayCursor/RelayPullReply(Batch/Gap)/RelaySettlementSeal/WorldCheckpointWire 精确覆盖与不回写、初始开发结算政策（G=3600000/B=300000/U=60000/H=3960000/retention=86400000ms，恒满足 H≥G+B+U、retention≥H）、全部字段值域/限额/签密固定域
- 交付方式：仅 quality-review/b2-shared-contract-freeze 下规范与审查证据；零生产源码变更、零 TypeScript 导出/codec/ContractAdapter 扩展、零服务器新路由；文档接口 unknown 不是宽松正文 schema；C 类 future port/route/源码常量别名与 D 类延期项已在名库 v3.17 分区标注，不写入正式冻结表
- B2.5c 三段待授权（本轮不是 c 开工授权）：c-1 纯契约/codec/确定性合并与验证；c-2 独立轻量权威与真实 Relay；c-3 真实两客户端网络、队列/Gap/权限/密钥安全验收；每段另有实施授权
- 明确排除：真实 Relay 运行机制、完整 FileCarry、P4 个人静态加密/外部 checkpoint 证明/自身 TraceTouch 贡献恢复/长期 key 保护、P5 原生 OfflineGrace/OfflineTimeProof/OfflineGrant/PhysicalDevice/原生 host、旧三元身份迁移、产品 ObserverSync/首次加入 UI/EchoTrace/EditPresence/S5/地图编辑器全功能；24 小时 retention 不是无条件中继 SLA

**v3.18 / VERDICT-411 ~ 425 纳入的有限范围（B2.5c-1 契约与确定性重放 · 纯逻辑实现冻结）**

- 授权范围：B2.5c-1 纯逻辑契约与确定性重放——src/director 下五份独立源码：SharedCommitContracts.ts（P3 的 54 种数据 schema 纯类型复写 + SharedSchemaMap/SharedSchemaKind/SharedAuthorityPayload/SharedSchemaErrorCode 四个 codec 辅助类型）、SharedCanonicalBytes.ts（严格 canonical JSON 安全整数子集/独立 UTF8/无填充 base64url/domain 字节，decode 须与规范重编码逐字相同）、SharedCommitCodec.ts（validate/encode/decode 按 54 精确 schema 验证并深冻结副本）、SharedCommitValidator.ts（注入 SharedCryptoPort 四方法 sha256/verifyEs256/hkdfSha256/decryptAes256Gcm 与受信 SharedValidationContext，验 receipt/claim/作者/membership 签名、DEK/HKDF/GCM 与精确 envelope 摘要，结果分 Verified/Gap/HostFailure）、SharedWorldReducer.ts（replay 确定性重放：验真、identity 去重、总序、三类变化、封边 coverage/checkpoint 与独立 provisionalCoverage、个人诊断提案）；IntentPort.ts 仅尾部 type-only 追加 58 个类型导出，原 47617 字节前缀保全
- 实现边界：零网络、零服务器路由、零存储、零产品接线、零 cc/DOM/Node/引擎声明（隔离编译 target=ES2020/lib=ES2020/types=[]）；密码学与受信 producer 显式注入，生产模块不产生 key/nonce、不写秘密；validator WeakSet 能力与 reducer 本地可信 checkpoint 不写成可序列化 wire brand，provisionalCoverage 不作为 wire coverage entry；七个签名/AAD 域为字符串字面量（真实 NUL 结尾），不新建全局常量导出
- 交付方式：隔离测试 154/154 PASS（codec 76 + 真实密码学 validator 47 + replay 31，网络尝试计数 0）+ 既有三门禁；证据位于 quality-review/b2-5c-1；docs/NAMEBOOK.md 与 docs/spec/stage-1.md 在 c-1 基线后的 v3.17/P3 外部变化经用户独立确认归因闭合，原 raw FAIL 保留
- 待授权与排除：c-2 独立轻量权威与真实 Relay（HTTP 契约/CSRF/限流/幂等、真实 world/root/manifest/key 交接）与 c-3 真实两客户端网络/队列/Gap/权限/密钥安全验收各需独立实施授权；明确排除 P4 完整 FileCarry/外部 checkpoint 证明/自身 TraceTouch 贡献恢复、P5 原生 OfflineGrace/PhysicalDevice、旧三元身份迁移、产品 ObserverSync/编辑器接线、key 包密码学验收与分发

**v3.19 / VERDICT-426 ~ 440 纳入的有限范围（B2.5c-2a 冻结 · 仅冻结文书，零实现）**

- 范围授权：本轮仅冻结文书，零实现——VERDICT-426～440 正式裁定书、HTTP/端口契约、根与群 key 契约、PG/clock 存储契约、c-2b～f 阶段与遗留、协议前置回复、两项只读审计，全部位于 quality-review/b2-5c-2a；不创建 TypeScript、SQL、路由、TLS edge 或产品接线，源代码 diff 为空；名库 v3.19 附录按授权落盘至 docs/NAMEBOOK.md，冻结文件路径为规划、尚不存在并不算前置已实现
- P7/P8/P9 闭合：P7 采纳"新增独立会话 owner，保留旧源码"——RealSharedServiceSessionAdapter 实现既有 RealAuthServicePort 与 SharedServiceSessionPort/RegisteredAuthorSigningPort 窄能力，旧 AuthAdapter 原样保留；P8 采纳"loopback 基线 + 受信 LAN TLS edge"——必测基线为 b 现有精确 127.0.0.1 HTTP，LAN 必须同源 HTTPS，SharedTlsEdge 先严格核验唯一公共 Host/Origin/证书再固定转换；P9 允许"最小协议，无产品入口/UI"——独立 root set-code/challenge/redeem 路由与六位 AccessCode 真实自动准入，无产品入口/UI/ObserverSync。三项已闭合，无需再次申请相同授权；进入各阶段仍需当轮实施授权
- 12 项裁定摘要：1 端口——实施两旧接口全部已有方法，新增能力走独立 protocol port，不借"全部"暗增迁移/暂停/closure；2 同 server/PG/cookie——同 b 实例/PG/service 根/会话 family，Relay 失败不阻塞 Auth 与轻量 admission；3 LAN——只精确 loopback HTTP，LAN 必须受信同源 HTTPS edge；4 根 pin 交付——服务/root/TLS 三条信任独立，操作员批准完整公开 world/account/root/Genesis/manifest 元组，无 TOFU；5 群 key——必须真实 ECDH/GCM 解包、commitment、HMAC+注册签名 acceptance，服务无群 key；6 adapter 依赖——presentation 适配、director 纯协议、assets 独立组合根，presentation 仅 IntentPort type-only；7 HTTP wire——18 条 route/字段/错误/签名/CSRF/limits/幂等按 HTTP 契约冻结，未列扩展不得临时猜测；8 真实 clock——生产真实 wall/monotonic+durable floor/generation，回退失信、不回填，fixture 仅隔离测试 builder；9 PG——18 表、002 迁移与新 runner、跨世界全局 identity、uint64 cursor 十进制 string、旧 auth 锁序、COMMIT 成功才响应/原字节复取不重签；10 两客户端——c-2e 即含真实 loopback 两隔离 principal/device/cookiejar，不推迟到 c-3；11 文件位置——真实 HTTP 在 presentation、协议 director、独立 Builder 在 assets、server 独立 Node 包；12 独立组合根——必须 SharedRelayPrototypeBuilder 及同能力 harness，不接 WorldFolderBuilder/SceneBuilder/产品 UI，不扩旧 RealServiceBuilder
- c-2b～f 阶段拆分与入场前置：按 quality-review/b2-5c-2a/stages-and-open-items.md 执行——c-2b 协议/真实会话/轻量 authority、c-2c 真实 Relay、c-2d 最小真实 key/producer（可在 c-2b 后与 c-2c 并行）、c-2e 独立组合根与 loopback 双客户端、c-2f LAN HTTPS/安全与总验收；各阶段入场前置含本冻结包审阅落盘、b 健康、操作员公开 pins/LAN 证书/双设备/防火墙实配与当轮明确实施授权；本轮不启动 c-2b 实施
- 三门禁结果：check:naming PASS 0 ERROR / 45 既有 WARN（与 c-1 最终 WARN 逐条一致，增量 0）、check:dependencies PASS 0 ERROR（127 TS、437 静态依赖）、typecheck exit 0；本轮只验证基线健康，c-1 历史 154/154 不作本轮重跑，无真实 Relay/LAN/c-2 运行测试
- SHA 保护结果：终检 PASS 7154→7154，changed/removed/added 全空；保护 baseline SHA256 f01d9bebb8dcf2efcc3ee250f70f795787da1121cf113691e5576000465526bc，排除范围精确记录于保护脚本/baseline；未改白名单/脚本、未清旧 WARN、未回写历史 raw FAIL

**v3.20 / VERDICT-441 ~ 447 纳入的实施范围（B2.5c-2b 实施 · authority + 独立 session/signing/wire，不含 Relay）**

- 范围授权：c-2b 实施 authority 与独立认证/session/signing 及严格协议 wire——src/director 下 SharedServiceProtocolContracts.ts 与 SharedServiceProtocolCodec.ts、src/presentation 下 RealSharedServiceSessionAdapter.ts 与 RealWorldAuthorityAdapter.ts、assets/scripts 下 SharedRelayPrototypeBuilder.ts 独立组合根、server/src 下 12 个新文件（含 shared-main.ts/shared-cli.ts 入口）与 server/SharedBuild.mjs、server/tsconfig.shared.json、server/sql/002_shared_authority.sql（替代 c-2a 规划路径，旧 001 与 runner 不变）；不含 Relay——RelayService/RelayStorage/RelayRoute/RealCommitRelayAdapter 留 c-2c
- 操作与路由：15 条 authority 操作真实实现并经 loopback HTTP/PG 验收（含旧 b 兼容 readAccountFacts），18 操作类型契约与严格 canonical codec 冻结，Relay 3 条路由未开放（仅类型与严格 codec）；群 key package/producer、完整双客户端重放、LAN TLS 不在本轮实现与验收
- clock 证据分列：独立 server 20 场景 = 18 个 HTTP+PG 场景（17 真实 wall + 1 显式隔离 clock）+ 2 个 PG 场景（迁移 1、隔离 clock 1）；不能全称为 production clock 验收，生产入口不接 env/HTTP fixture 时间
- 测试与历史回归：独立 server 20/20、纯协议/字节/shape 32/32、客户端 ContractOracle 18/18、新生产客户端真实 HTTP/PG 11/11、历史 427/427（B2.4e 227/227 + c-1 154/154 + b server 16/16 + b client 30/30）隔离运行，原测试断言/源文件/历史 evidence 不回写
- 三门禁结果：check:naming PASS 0 ERROR / 45 既有 WARN（新增 0）、check:dependencies PASS 0 ERROR、root typecheck exit 0；独立 server typecheck/build 各 exit 0
- 保护审计 PASS：基线 7179→7251，旧文件无删除，唯一旧源码修改为 src/director/IntentPort.ts 1133 字节 type-only suffix（原字节前缀完整、运行时输出不变），未授权修改/新增=0；未放宽源码目录 whitelist，docs 与历史 raw FAIL 不回写

### B2.5c-2c 真实 Relay（VERDICT-448~451）

- 范围授权：c-2c 实施真实 Relay 三条 shared POST 路由与 ExternalService 客户端 adapter——server/src 下 RelayStorage.ts、RelayService.ts、RelayRoute.ts、buildRelayServer.ts 四份新增与 src/presentation/RealCommitRelayAdapter.ts 一份新增，共 5 份新增实施 TS；既有源码修改仅 2 处已批准项——RealSharedServiceSessionAdapter.ts（P10 request 局部截止修正）与 src/director/IntentPort.ts（原 50175 字节前缀保全，追加 199 字节 type-only suffix，一条 export type 重导出 SharedCommitValidator、ValidatedSharedCommit、SharedValidationResult 三个既有 c-1 validator 类型）；不含产品主链接线，新 Relay 经独立装配/验收 harness 调用
- submit 语义：只收已真实 authority admitted 的精确 envelope 与 public proof，校验 canonical bytes、摘要、来源 receipt、作者签名与注册设备绑定；位置递增、queue 原字节和原 receipt 同一 PG 事务提交；同 nonce 重传返回逐字原回复，fresh nonce 同 identity/摘要保留原位置并以当前 nonce 新签 wrapper，异摘要冲突拒绝并回滚；服务器不持群 key、不解密正文，不声称正文 AEAD、地图权限或共享 state 已验真
- pull 语义：先验证当前会话、CSRF 和成员权限，检查 generation/floor/到期，并对 authority admission 摘要账做从未入 queue 检测，短 admit→submit 窗口保守返回 MissingAdmittedEnvelope；三种签名 Gap 为 RetentionExpired、RelayGenerationChanged、MissingAdmittedEnvelope，空 Batch 不证明全量；cursor.position 为十进制 uint64，与作者序号、事件总序、结算边界分开，adapter 校验 next=after+count，拒绝跳位及空批推进
- ACK 语义：adapter 使用实际 c-1 SharedCommitValidator.validateCommit/ownsCommit，绑定完整候选原 wire、identity、摘要及当前会话；独立共享密文缓存 persistAndVerify 后再次 read 并重算 SHA，再以 adapter 自有 nonce 调注册设备签名能力，调用者预签名不转发；缺 key、缺来源、Gap、HostFailure、错误回读或会话变化不发 ACK；服务器同一事务核验 recipient/position/digest/设备签名并写 ACK/原 receipt，坏批次整体回滚
- retention / generation：retainedUntil=admittedAt+86400000ms，全部 ACK 不触发提前删除；到期经每个 world 的 Relay 事务惰性清理所有 generation 的原 envelope/public proof，保留轻量 tombstone、floor 与 receipt；floor 只由当前 generation 位置计算，旧 generation 不污染新 floor；迟到首次 enqueue 同一事务转为 tombstone；确证丢段推进持久 generation 一次并返回 Gap，重启不任意重置 generation；无后台全库即时擦除任务，不声称物理介质即时清除
- P10 deadline 局部修正（VERDICT-448）：仅在 RealSharedServiceSessionAdapter.request() 内、strict codec 通过后对 /relay/pull 使用 maximumWaitMs+7000（wait 仍 0..25000、deadline 7000..32000ms），其余 shared/auth 保持 12000ms；guard/session/signing/nonce/schema 不变，旧 session 其余字节保全
- P11 pull 引用重建（VERDICT-449）：pull 请求结果只保存轻量原签名 wrapper、queue 位置/identity/digest 引用和原 wire SHA，不把 ciphertext/public proof 复制到 authority 请求账；同 nonce 先验当前会话/成员、generation/floor/expiry/缺载，保留期内从唯一 queue 重建逐字原 Batch 并核验 SHA/服务签名，边界变化返回当前签名 Gap，撤员明确拒绝；永久 nonce/hash、异请求 Conflict 及普通 authority/submit/ACK 的至少七日轻量原结果规则保持
- 最终真实证据：server 真实 loopback HTTP/PG 完整套件 20/20（17 真实 wall clock + 3 显式隔离 clock）、首次入队并发补测 2/2、旧 generation 保留期定向补测 2/2、生产 Relay adapter 真实 HTTP/PG 22/22；Relay adapter 契约 oracle 32/32、P10 deadline 契约 oracle 13/13、历史回归分类合计 508；真实服务器默认 long poll 实测 25014ms，客户端合法 13000ms wait 实测约 13030ms 成功；24 小时 retention、显式丢段与撤权边界使用隔离 clock/测试世界，未声称生产实际等待 24 小时
- 三门禁与构建结果：check:naming PASS 0 ERROR / 45 既有 WARN（新增 0）、check:dependencies PASS 0 ERROR（132 TS / 448 静态依赖子句）、repository typecheck exit 0；server 独立 build/typecheck 均 exit 0
- 保护审计 PASS：基线 7435→7444，changed 仅 IntentPort type-only suffix 与已批准 P10 session 两处既有修改，新增仅五份精确实施 TS 与四份精确生成 JS，removed、unauthorizedChanged/Added/Removed 全空；两份既有 kernel 树各 14 份旧文件零差异

### B2.5c-2d（占位）

- 状态：待用户正式授权。



\## 5. 架构不变式（INV-1 \~ INV-9）



| 编号 | 不变式 | 依据 |

|---|---|---|

| INV-1 | 账本只能追加 | 初始架构原则 2 |

| INV-2 | 只有叙事导演能追加账本 | VERDICT-003、020 |

| INV-3 | 表现层只读 | 初始架构原则 3 |

| INV-4 | 解谜链只在终点写入账本 | VERDICT-003 |

| INV-5 | 谱面首演中途退出不写入任何东西 | VERDICT-017、025 |

| INV-6 | 逻辑拖尾色与渲染分离 | VERDICT-016 |

| INV-7 | 场景实体的元素类型只允许 4 种 | VERDICT-011 |

| INV-8 | 命名合规（禁止裸 Event、Developer、Rain 等） | VERDICT-003、004、011、023、039 |

| INV-9 | 全游戏只有一种距离单位 WorldMeter | VERDICT-021 |
- **INV-10（世界运动门控）**：谱面及禁止世界运动的转场期间，世界运动暂停推进，暂停时长不补算。门控必须与受限状态同时交付，最迟 T7。禁止“停止整个 FrameDriver”作为通用门控；只暂停世界运动部分，意图采集、谱面刷新、表现刷新继续。

- **INV-11（表现不写状态）**：`DeepTraceRevealSequence` / `ScreenInvertRipple` / `ExposurePulse` 等表现效果不得修改 `TraceTier`、解谜进度、账本或世界运动门控。逻辑层确认深痕触发，表现层只播放效果并报告播放结束或跳过。

- **INV-12（音频时间线）**：`Strike`、目标拍点、持续期计时统一使用同一条音频时间线。优先使用 Web Audio 的 `getOutputTimestamp()` 建立音频时间与 `performance.now()` 的映射；无可靠输出时间戳时可用平台延迟信息估算或多次采样校准。暂停、恢复、重新起播后必须重建映射。不得对已对齐输出的时钟重复扣减延迟。不批准无测量依据的固定补偿，也不批准首次敲击后自动校准。

- **INV-13（上下文覆盖）**：世界探索与谱面演奏是两套输入上下文。同一物理键在明确的玩法上下文中承担不同动作，不得将谱面键位覆盖传播到世界探索，也不得反向。世界运动门控（INV-10）必须在 Move、Jump 和世界物理推进前检查。


\## 6. 依赖方向矩阵（行依赖列）



图例：✓ 允许　✗ 禁止　R 只能使用读取接口　I 只能使用意图接口



| 从 ＼ 到 | constants | ledger | world | character | trace | chart | editor | musicEditor | director | presentation |

|---|---|---|---|---|---|---|---|---|---|---|

| constants | — | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

| ledger | ✓ | — | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

| world | ✓ | ✗ | — | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

| character | ✓ | ✗ | ✓ | — | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

| trace | ✓ | ✗ | ✓ | R | — | ✗ | ✗ | ✗ | ✗ | ✗ |

| chart | ✓ | ✗ | ✗ | ✗ | ✗ | — | ✗ | ✗ | ✗ | ✗ |

| editor | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | — | ✗ | ✗ | ✗ |

| musicEditor | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | R | — | ✗ | ✗ |

| director | ✓ | ✓（追加+读取） | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | — | ✗ |

| presentation | ✓ | R | R | R | R | R | R + I（仅类型） | R + I（仅类型） | I | — |



\*\*规则：\*\*

\- `constants` 是叶子，被所有模块依赖，自己不依赖任何模块

\- `ledger` 只依赖 `constants`，只引用 ID

\- `director` 是逻辑层最上层，其他逻辑模块不能反过来依赖它

\- `presentation` 只读，对所有逻辑模块只能使用读取接口

\- 意图接口（I）只接收"玩家想做什么"，不暴露写入能力

\- 账本的读取接口和追加接口放在 `ledger` 目录下两个不同文件，只有 `director` 可以引用追加接口

\- `editor` 可值依赖 `constants`、`chart`；对 `presentation`、`director`、`ledger`、`world`、`character`、`trace` 一律 ✗，且零 `cc` 引用（E8）

\- `presentation` → `editor` 为 R + I（仅 `import type`）：只读接口 `GuidanceEditorReader`、意图联合 `GuidanceEditorIntent`、发送端 `GuidanceEditorPort`；类型擦除后不存在值依赖，UI 不获得直接改 selection / chart / score 的能力。其他逻辑模块 → `editor` 一律 ✗

\- `assets/scripts/GuidanceEditorBuilder` 是独立编辑器模式组合根，可实例化 editor 与 UI，不以资产路径绕过逻辑域门禁；编辑器不连接 director / ledger

\- `musicEditor` 可值依赖 `constants`、`chart`；对 `editor` 为 R（仅 `import type` 冻结源契约 `ChartSourceData` / `MidiNoteEvent` / `NoteColor`）；对 `presentation`、`director`、`ledger`、`world`、`character`、`trace` 一律 ✗，且零 `cc` 引用（E8）。其他逻辑模块 → `musicEditor` 一律 ✗

\- `presentation` → `musicEditor` 为 R + I（仅 `import type`）：只读接口 `MusicEditorReader`、意图联合 `MusicEditorIntent`、发送端 `MusicEditorPort`；类型擦除后不存在值依赖。`assets/scripts/MusicEditorBuilder` 是音乐与引导线会话的独立组合根，不连接 director / ledger



\## 7. 本阶段需要的常量



| 常量 | 单位 | 范围 | 单调性与效果 |

|---|---|---|---|

| ScaleRef（角色身高） | WorldMeter | 1.6 | 全游戏唯一尺度锚点 |

| 主角最大移动速度 | WorldMeter/秒 | > 0 | — |

| 纵深可移动范围 | WorldMeter | > 0，远小于地图横向 | 少量靠近和远离 |

| ViewDistance（视距） | 无量纲倍率 | 有上下限 | 越大可视范围越大 |

| TrailLength（拖尾长度） | WorldMeter | ≥ 0，有上限 | 随移动速度增加只增不减 |

| GuideTransparency（引导透明度） | 百分比 | 0% \~ 100% | 越大越看不见，得分加成随透明度增加只增不减 |

| Perfect 判定窗口 | 毫秒 | > 0 | 必须严格小于 Good 窗口 |

| Good 判定窗口 | 毫秒 | > Perfect 窗口 | 超出即为 Miss |

| SYNC_TOLERANCE_MS | 毫秒 | 默认 30 | 音画同步容差；T0 实测偏差 16.87ms / 16.53ms，均在 30ms 内 |

| DEPTH_RANGE_WM | WorldMeter | 大于 0，远小于地图横向 | **总跨度**（非单侧距离）；裁剪以 MapCenter 为基准，两侧各 ±半个总跨度；必须计入中点偏移 |

| JUMP_INITIAL_SPEED_WM_PER_SECONDS | WorldMeter/秒 | 有限且 > 0 | 起跳瞬间向上的速度 |
| GRAVITY_WM_PER_SECONDS_SQUARED | WorldMeter/秒² | 有限且 > 0 | 向下重力加速度的正值幅度 |

| RHYTHM_STRIKE_WINDOW_MS | 毫秒 | 有限且 > 0，默认 100 | 节奏敲击判定窗口；目标拍点前后各 100ms，绝对偏差 ≤100ms 为成功 |

| beatClockOffsetMs | 毫秒 | 默认 0 | 加到输出对齐后的拍点时钟上的校准偏移；用户敲击稳定晚于目标时，所需偏移为负 |


\*\*特别说明：代码中禁止使用 `GuideOpacity`，只能用 `GuideTransparency`。\*\*

**拖尾 3D 跟随**：TrailRenderer 的段位置包含 Y 分量（vertical），拖尾在空中画出弧形 3D 轨迹。原地跳跃时拖尾在垂直方向拉伸。



### 7.1 纵深范围语义（VERDICT-100）

- `DEPTH_RANGE_WM` 表示纵深可移动区间的**总跨度**，不表示每侧距离。
- 当前数值：总跨度 5 WorldMeter，地图中点纵深坐标两侧各允许 2.5 WorldMeter。
- 合法区间：`[MapCenter.depth - DEPTH_RANGE_WM / 2, MapCenter.depth + DEPTH_RANGE_WM / 2]`，两端均包含。
- **实现铁律**：不得把“围绕零裁剪”无条件等同于“围绕 MapCenter 裁剪”。如果纵深坐标使用绝对坐标且中点不为零，必须计入中点偏移。
- 视距调整和镜头路线旋转不改变此逻辑区间。


### T7 视频谱面（VERDICT-121 ~ 126 细化）

**键盘打击垫**：谱面游玩时，英文键 + 符号键（Regular）、数字键 0~9（Drum）、空格键（Heavy）按键盘物理位置映射到屏幕，形成打击垫。ESC 为暂停键。谱面期间 WASD 不移动、数字键不触发世界解谜敲击、空格不跳跃。

**Note 判定**：Note 最小成员为 `timeMs` + `keyId`。判定要求时间有效 + 槽位匹配。三档 Perfect / Good / Miss，判定窗口沿用 `PERFECT_WINDOW_MS = 100`、`GOOD_WINDOW_MS = 200`。一次按下最多消费一条 Note。

**暂停**：`ToggleChartPause` 携带 `videoTimeMs`。暂停冻结媒体位置、Note 判定窗口及演奏进度；恢复时重建音频输出时间映射（VERDICT-120）。暂停不写账本；主动退出执行 AC-21。

**同步容差**：两档分辨率重新测量，按 `SYNC_TOLERANCE_MS = 30ms` 验收。

\## 8. 验收标准（AC-01 \~ AC-29）



\### A. 移动与箱庭

\- \*\*AC-01\*\*：主角可以沿横轴和纵深轴移动，纵深移动幅度明显小于横向移动

\- \*\*AC-02\*\*：镜头中心始终是主角

\- \*\*AC-03\*\*：玩家可以调节视距；调节视距不改变主角纵深坐标和距中点距离

\- \*\*AC-04\*\*：箱庭至少有三层纵深，前后景随镜头移动产生视差；至少有一段路线会让镜头随路线旋转

\- \*\*AC-05\*\*：调试面板显示主角距中点距离，单位为 WorldMeter，同时计入横轴和纵深轴

\- \*\*AC-06\*\*：主角画面高度与 1.6 WorldMeter 尺度一致



\### B. 拖尾

\- \*\*AC-07\*\*：拖尾长度随移动速度增加只增不减；静止时拖尾收拢

\- \*\*AC-08\*\*：拖尾颜色使用占位逻辑拖尾色，本阶段固定不变；任何逻辑不读取渲染出的颜色



\### C. 元素、可见性与解谜

\- \*\*AC-09\*\*：场景中至少有一个 Initial 实体、一个 Process 实体、一枚普通痕；元素类型只能是 4 种允许值之一

- **AC-10（待补验）**：普通模式下画面为低饱和；切换到触发模式后，可以看到处于形态（Concealed）的实体。
  - ✅ 分项 1（已通过）：Triggered 模式下可见 Concealed 实体（用户人工测试确认）。
  - ⏳ 分项 2（待补验）：Normal 模式下画面主体低饱和（背景变色不算；必须让场景主体确实呈低饱和，可用材质/资源配置/颜色处理实现，不强制后处理/LUT）。
  - 必须在阶段 1 完成前补齐并复验。

\- \*\*AC-11\*\*：一个形态实体在触发条件满足后变为明态；移出屏幕后变回形态

> **阶段 1 距离占位**：AC-11 的"移出屏幕后变回形态"在阶段 1 用"距离 ≥ FORGET_DISTANCE_WM 触发 Forget"作为占位实现。阶段 4 若引入屏幕可见性探针，由 presentation 向 director 暴露只读探针替代距离判断。阶段 1 保持距离占位。

### AC-12 节奏敲击（VERDICT-118 修订）

痕在场景中位置固定。主角移动使痕的屏幕投影进入指定敲击区域，同时背景音乐响起，越靠近痕音量越大（`TraceProximityVolume`）。在背景音乐的节拍上执行 `RhythmStrike`，判定窗口为目标拍点前后各 100ms（`RHYTHM_STRIKE_WINDOW_MS = 100`）。
- 输入：数字键 0~9（主键盘 + 小键盘，物理键识别，不依赖 NumLock）触发 Strike；每次独立按下触发一次，长按不产生连续 Strike。
- 感知模式切换：Tab 往返切换 Normal / Triggered。
- 敲击成功推进解谜链，失败保留待敲击阶段。
### AC-13 两步解谜链（VERDICT-119 修订）

第一步：主角移动，使固定痕满足指定接近距离，并使其屏幕投影进入指定敲击区域；条件成立后 `PuzzleProgress` 显式推进至"待敲击"阶段。离开有效范围则退回第一步。
第二步：在第一步条件仍成立时，对该痕完成一次 `RhythmStrike`，时间偏差 ≤100ms。**持续期规则**：第一次有效命中启动 7 秒持续期；有效区间为 `[首次命中时刻, 首次命中时刻 + 7000ms)`，区间内无 miss 则满 7000ms 完成。
**终点排除规则**：目标拍点时刻等于或晚于持续期终点的拍点，不计入本轮持续判定；归属以目标拍点时刻判断，不以按键事件或更新帧的处理顺序判断。
**终点前拍点仍须判定**：若其判定窗口尚未闭合，不得因已满七秒而提前宣布成功。
中间步骤只更新 `PuzzleProgress`，不写账本；链终点恰好写入一条 `NarrativeEvent`，并防止重复结算。

### AC-14 深痕产出与谱面入口（VERDICT-114 / 116 细化）

链终点若为深痕，同一次终点结算同时确定深痕产出并启动自动进入谱面的流程。深痕在触发前与普通痕无视觉区别（`TraceTier = Deep` 但表现层不显示特殊标记）。触发后播放 `DeepTraceRevealSequence`（阶段 1 灰盒：圆环缩放+淡出模拟 `ScreenInvertRipple`），序列结束后**自动**切换至谱面场景，不增加确认按钮或二次交互。视觉揭示、场景切换不额外写入该解谜链的账本事件。


\### D. 视频谱面

### AC-15 引导线谱面（VERDICT-133 修订）

谱面玩法保留键盘打击垫，并叠加白色引导线。头节点生成后 1000ms 内以 Space 按下边沿启动；判定点按路径弧长匀速移动。Tap 按输入时刻路径位置动态取网格键；Drag 检查独立绑定键的按住状态；Hold 持续按住固定起点键至尾端。多线具有独立运行状态。

**v3 / 编辑器补充验收（VERDICT-147 ~ 157）**：编辑器入口是独立入口，不需深痕授权、不启动世界，不代替本 AC。

### AC-16 视频与谱面数据分离（原条文保留）

视频与谱面数据分离。新增 GuidanceChart 作为独立数据；路径、节点、键绑定及速度不得编码进视频或由视频像素推导。

**v3 / 编辑器补充验收（VERDICT-147 ~ 157）**：v1/v2 固定速度相对实际启动；v3 采用绝对媒体目标时间，颜色是可选伴随文件；数据导出再加载，无色文件结果相同。

### AC-17 判定（VERDICT-133 修订）

判定以统一谱面时间轴、节点规则及物理键身份执行。Tap 保留 Perfect / Good / Miss；Drag / Hold 按已冻结规则记 Perfect 或 Miss。漏判、头节点超时、重复输入、多候选及按键边沿均具有确定性结果；每节点最多结算一次。暂停冻结判定，恢复不补算暂停时长。

**v3 / 编辑器补充验收（VERDICT-147 ~ 157）**：Tap ±100/200ms；v3 Drag/Hold 在绝对起/尾时刻检查，精确边界与晚 Head 不补发成功。

### AC-18 引导透明度与视觉（VERDICT-133 修订）

保留引导透明度调节及既有得分加成规则。引导线、节点、判定点采用白色，并按各自触发规则执行擦除或放大淡出。透明度、动画、擦除边界及帧率不得改变路径、键映射、时间窗口或判定结果。

**v3 / 编辑器补充验收（VERDICT-147 ~ 157）**：RGB 不作为 ElementType / TrailColor，不改变透明度或得分；本轮复用原计分实现，不增加新的颜色得分公式。

### AC-19 两档分辨率同步（原条文保留）

两档分辨率同步。引导线扩展须在原验收的两档分辨率下使用同一谱面坐标、弧长进度、网格映射及媒体时钟，继续满足原同步阈值。

**v3 / 编辑器补充验收（VERDICT-147 ~ 157）**：新编辑器在 1920×1080 / 2560×1440 下使用真实视频帧回调与 AudioOutputClock；同归一化数据、同输入判定一致。

### AC-20 完成与账本（VERDICT-133 修订，R26 B）

完整演奏采用 R26 B：全部判定对象已决且视频/音频媒体播放结束，才进入 Completed。头节点超时所属节点亦须全部终结。媒体异常无法结束时沿用独立超时兜底。完成后由 director 恰好写入一条带谱面引用的账本记录，与得分高低无关。

**v3 / 编辑器补充验收（VERDICT-147 ~ 157）**：v3 仍全部节点已决且媒体结束才 Completed；编辑器 preview Completed 零账本写入，gameplay 仍由 director 唯一追加。

### AC-21 中途退出与重入（VERDICT-133 修订）

中途退出立即终止未完成引导线、回收媒体与表现资源并返回世界，不写完整演奏账本。重入复位节点判定、启动时间、按键状态、得分、路径进度、媒体结束标志及超时计时；不重复写入既有解谜终点记录。

**v3 / 编辑器补充验收（VERDICT-147 ~ 157）**：preview 停止、Seek、重入不产生叙事事件；游戏入口与导演原逻辑不变。



\### E. 账本与架构

\- \*\*AC-22\*\*：每条叙事事件包含完整 20 维向量，以及写入时间、输入来源、章节标记、ChartRef

> **阶段 1 灰盒值允许**：阶段 1 的 NarrativeEvent 允许 vector 全零、ChapterTag 空对象、eventId 为占位字符串。感绪系统在阶段 4 实现（20 维真实值），章节系统在阶段 5 实现（ChapterTag 真实值）。阶段 4 / 5 接入后，新记录填真实值，旧记录保持灰盒，不做追溯补写。

\- \*\*AC-23\*\*：账本对外没有修改和删除记录的能力

\- \*\*AC-24\*\*：全工程中只有叙事导演调用了"追加账本"

\- \*\*AC-25\*\*：表现层模块不依赖任何账本写入能力

\- \*\*AC-26\*\*：命名检查：全工程不出现 INV-8 禁止的命名



\### F. 端到端

\- \*\*AC-27\*\*：一次完整流程：出生 → 移动 → 触发模式发现形态痕 → 完成两步解谜链 → 获得深痕 → 进入谱面 → 完整演奏 → 回到世界。账本恰好新增 2 条记录

\- \*\*AC-28\*\*：重复 AC-27 但谱面中途退出：账本只新增 1 条，再次进入完整演奏后最终是 2 条



\### G. 美术可替换（AC-29）

\- \*\*AC-29\*\*：所有占位美术（图片、动效参数、颜色、字体等）必须能在不修改任何逻辑代码的情况下被替换。美术资源与逻辑之间只通过配置或资源引用关联。

&#x20; - \*\*验证方法\*\*：任选一项占位资源，通过修改配置或替换资源文件将其换掉。检查两条：

&#x20;   - 所有逻辑目录（constants、ledger、world、character、trace、chart、director）代码无任何改动

&#x20;   - AC-01 \~ 28 依然全部通过

### AC-30 跳跃（VERDICT-107 修订）

世界探索中，主角位于地面或满足逻辑落地容差时，按下或持续按住空格可起跳；单次跳跃上升、下降并准确落回地面。持续按住空格时，每次落地立即再次起跳，实现连续弹跳；松开空格后不再自动起跳，但已开始的跳跃继续完成。空中不能再次起跳，上升阶段不得因接近地面重复起跳。跳跃期间允许原有横轴与纵深移动；原地跳跃不改变横轴、纵深及距中点距离。跳跃不增加账本记录、不自动生成痕；谱面及禁止操作的转场期间不接受起跳请求，也不缓存请求。

**验证覆盖**：单次起跳、按住连续起跳、松开后停止、空中再按无效、落地后继续按住仍可起跳、移动中跳跃、原地跳跃不改变距中点距离、拖尾 3D 跟随、镜头不跟随 Y 轴、谱面／转场中的无效请求。

### H. 音频编辑器最小交付（ME-01 ~ ME-10）

- **ME-01**：加载音乐工程（Mock 或 MIDI provenance），显示音轨时间轴与音符
- **ME-02**：音符放/删/改操作正常，时间轴与音轨实时更新
- **ME-03**：undo/redo 有界（≤100 项），撤销后新编辑截断 redo；草稿保存/恢复正常
- **ME-04**：离线简易试听（单次 PCM 渲染），播放/暂停/停止/seek 依据 AudioContext 时间
- **ME-05**：严格导出 ChartSourceData（schemaVersion=1、provenance='Midi'），通过 parseChartSourceData 校验
- **ME-06**：导出的 ChartSourceData 可被既有 GuidanceEditorSession 消费并经真实 ChartPremiere/LineEraseEffect 演奏
- **ME-07**：1920×1080 与 2560×1440 两档分辨率下时间轴、音符位置及试听一致
- **ME-08**：退出释放资源，重入复位草稿状态；不产生叙事事件，不连接 director / ledger
- **ME-09**：musicEditor 逻辑模块零 cc 引用；E1~E9 门禁全部通过
- **ME-10**：既有 GuidanceEditorSession / View / Builder 核心未修改；WorldFolderBuilder 仅新增 MidiTrackEditor 路由

### ME-11 ~ ME-19 音乐编辑器批量操作（VERDICT-191~195）

- ME-11：单选 / 多选（Ctrl+点击、Shift+点击、Ctrl+Shift 范围）
- ME-12：框选（空白拖动 > 4px，与实际 noteRect 相交的音符全部选中，可跨轨）
- ME-13：Ctrl+A 全选当前轨；Esc 取消选择
- ME-14：Ctrl+C / Ctrl+V（UI 内存剪贴板；pointer 优先，否则播放头；跨轨 flatten 到当前轨）
- ME-15：拖拽移动（整组 ghost 实时显示，mouseUp 只提交一次 MoveNotes）
- ME-16：Delete / Backspace 删除选中集合
- ME-17：批量操作的 Undo / Redo 整组恢复
- ME-18：恢复工程 / 草稿清选择；重启工作区清剪贴板
- ME-19：文本输入控件（input / textarea / select / contenteditable）不抢快捷键

### B1-01 ~ B1-11 B1 谱面接入游戏入口（VERDICT-196~200）

- B1-01：编辑器导出 `{chartId}.json` 与可选 `{chartId}.visual.json` 成对复制到 `assets/resources/chart/`
- B1-02：SceneBuilder Inspector 字段 ChartResourcePath 配置谱面资源路径（默认 `chart/guidance_c`）
- B1-03：主谱面缺失 / 路径非法 / 数据非法时拒绝加载，不以另一张谱面回退
- B1-04：颜色文件缺失时降级为默认颜色，不阻断谱面加载
- B1-05：颜色文件存在时经 parseGuidanceVisualData 严格校验 schema / chartId / nodeId / 8 位 RGB
- B1-06：完整首演完成后 director 同帧恰好追加一条带 ChartRef 的 NarrativeEvent（+1）
- B1-07：中途退出不新增完整演奏事件，重入不重复 T6
- B1-08：编辑器预览零游戏账本，不连接 director / ledger
- B1-09：v3 谱面复用既有 ChartPremiere / ChartRef / 判定 / 计分 / 完成逻辑
- B1-10：1920×1080 与 2560×1440 两档分辨率下导出字节、节点 / 得分 / 完成结果、账本增量一致
- B1-11：三条门禁（check-naming / check-dependencies / tsc）独立通过

### B2.1-01 ~ B2.1-10 B2.1 本地多世界基础（VERDICT-201~210）

- B2.1-01：默认 InitialWorld
- B2.1-02：动态多项
- B2.1-03：独立最小箱庭
- B2.1-04：墓碑删除
- B2.1-05：InitialWorld 删除后不重种
- B2.1-06：退出返回刷新
- B2.1-07：重启刷新
- B2.1-08：账号隔离
- B2.1-09：存储失败
- B2.1-10：分叉延后反馈

### B2.2-01 ~ B2.2-13 B2.2 账号里程碑与状态契约（VERDICT-211~225）

- B2.2-01：独立 key 不覆盖序章 key
- B2.2-02：FirstWorldCleared 严格解析
- B2.2-03：账号隔离
- B2.2-04：CopyPermission 只读派生
- B2.2-05：单向事实 false→true / true→true
- B2.2-06：损坏/未知版本/身份不匹配拒绝
- B2.2-07：WorldStateSnapshot 头部结构
- B2.2-08：七项归属类型契约
- B2.2-09：Complete / Incomplete 判别
- B2.2-10：已知缺失返回 Incomplete
- B2.2-11：完整恢复请求拒绝
- B2.2-12：WorldForkAvailability=NotImplemented 显示
- B2.2-13：契约测试 vs 生产验收区分

### B2.2c-01 球面穿越触发
Player 写入后，主角权威账本累计坐标 on/outside 且未穿越才授予入口；等号算触发；不要求前一位置在球内。

### B2.2c-02 穿越不可撤销
主角穿越后本运行期间不撤销；入口按 [accountId, worldId, protagonistCharacterId, source=SphereCrossing] 唯一。

### B2.2c-03 WorldBossChart 装配
每世界内容版本恰好绑定一首 schemaVersion=3 / tier='World' 谱面；系统只校验、加载、装配，不运行时改 tier。

### B2.2c-04 World 首演完成判据
沿用现行 C 判据（全部节点已决 + 媒体到既有完成边界）；与分数无关；中途退出不写完成账本、不生成 WorldClearRecord。

### B2.2c-05 RouteSignature 冻结
完成追加后从同一主角账本取完整累计坐标生成不可变 RouteSignature；不复用穿越时快照。

### B2.2c-06 六情感分类
正最大值严格为正选最大；正并列按 Red→Green→Blue→Black→White→Grey 选首项；六情感全零、其余维非零 → divergenceAxis=null、不计 RouteCoverage；完整零向量 → 不生成合法通关路线。

### B2.2c-07 ChartRef.state 兼容
T6 终点写 state='Entry'；T7/World 完成写 state='PremiereCompleted'；旧记录无 state 只读识别（T6_ENDPOINT_PLACEHOLDER→Entry，T7_COMPLETION_PLACEHOLDER→Regular 的 PremiereCompleted）；未知返回 Unclassified；不追溯改账本。

### B2.2c-08 账号通关提交链与幂等
记录先持久化，投影后更新；[accountId, worldId] 幂等；projection 已 true 时跳过重复 saveProjection；记录不进入 WorldStateSnapshot，不随世界墓碑删除。

### B2.2c-09 最小内容生产者
制作方世界内容文件声明 worldKind=Primary / 主角身份 / EventSpaceCenter=零坐标 / 有限正 EventDistance / 每分支 20 维非负向量；玩家仅提交选择 ID；director 按内容解析构造唯一 NarrativeEvent；同一运行只接受该交互的一个选择。

### B2.2c-10 完整链路
Primary 世界 → 玩家选择 → 非零向量追加 → 球面穿越 → WorldBossChart 入口 → 首演完成 → WorldClearRecord → FirstWorldCleared 写入 → CopyPermission=true。

### B2.2d-1-01 ~ B2.2d-1-05 B2.2d-1 完整状态恢复前置（核心机制，VERDICT-241~255）

- B2.2d-1-01：账本 round-trip
- B2.2d-1-02：PuzzleProgress 完整状态
- B2.2d-1-03：FormatTime immutable
- B2.2d-1-04：无副作用 hydration
- B2.2d-1-05：跨账号跨世界拒绝

### B2.2d-2-01 RecallCount 正式载体与合法行为
RecallCountSession 以同一权威 Ledger 校验来源；RecallEvent 只能选择当前主角已有事件；计数为非负安全整数；回忆不追加向量、不执行 SphereCrossing、不写账号事实。

### B2.2d-2-02 痕回放共享来源事件计数
真实痕绑定限定为 T6_MAIN_DEEP_TRACE → 当前主角的原 T6_ENDPOINT_PLACEHOLDER；ReplayTrace 与直接回忆共用计数；ReplayChart 返回 ChartReplayIgnored，不增加 RecallCount。

### B2.2d-2-03 他人事件第一次经历
experienceForeignEvent 只接受同一账号/世界权威账本中的已知其他角色与正式 Regular 叙事 Entry；第一次经历走现有同源追加，返回 Experienced / count=0；不单独制造穿越或通关事实。

### B2.2d-2-04 WorldLink 判别联合与孤立语义
WorldLinkSnapshot 为严格判别联合；Primary / FinalShore 显式 NotApplicable；BugShore 必须 Linked，携带单层 sourceWorldId + Bound/Orphaned + 完整 AIProfileSnapshot；Unknown 明确拒绝；孤立永久保留最后合法快照。

### B2.2d-2-05 AIProfileSnapshot 完整配置
AIProfile schemaVersion=1 保存 profileId / revision / providers / taskRoutes；提供方严格 CloudProvider / LocalProvider / TemplateProvider；降级链以 TemplateProvider 结束；RealityHint 与 OutputValidation 不得走 CloudProvider。

### B2.2d-2-06 ChartSnapshot 首演实际内容冻结
首演只关联同次合法 PremiereCompleted 账本事件与真实 ChartPlaybackResult.completed=true；ChartSnapshotRecord 保存实际播放谱面、完整布局、视觉节点 RGB、稳定媒体身份、透明度、完成事件 ID、冻结时间、归属与 contentDigest。

### B2.2d-2-07 ChartScore 持久化更新语义
ChartScoreRecord schemaVersion=1、scoringVersion=1；首演真实结果成为 best / latest，completedPlayCount=1；每场完整重演仅追加一个唯一 playId，次数严格 +1；仅严格高分替换 best，同分保留原最佳。

### B2.2d-2-08 七项完整认证与 Complete/Restored 产出
WorldStateCodec.parseComplete 只有在七项全非空、权威身份/版本/归属/结构/跨项引用全部通过并由内容绑定 Complete 验证器认证后才产生 WorldStateSnapshot；WorldStatePreparedRestore.publish() 成功才返回 Restored；活动演奏/揭示/七秒仍 UnsupportedBoundary。

### B2.3-01 CopyPermission 权限门槛
WorldForkSession.prepareWorldFork 要求同账号合法只读里程碑，CopyPermission === FirstWorldCleared === true；未知账号、错误投影、未取得权限均拒绝。

### B2.3-02 Complete Primary 来源校验
来源必须属于当前目录且未删除，必须是 WorldStateCodec.parseComplete 认证的同账号七项完整检查点，并经正式 Primary 内容绑定验证器再次验证；FinalShore 禁止分叉，BugShore 本批不支持。

### B2.3-03 七项精确继承与身份重键
Core 头、Ledger、PuzzleProgress、RecallCount、WorldLink、ChartSnapshot、ChartScore 的 account/world 复合身份统一重键到新 worldId；accountId 保持；characterId / chainId / traceId / eventId / chartId 保持；FormatTime 保留来源 immutable epochMs。

### B2.3-04 WorldForkOrigin 永久见证
WorldForkOrigin 是 Core 可选头，不是第八项玩法状态；非 null 的 inheritedCompletionEventId 必须匹配主角账本控制事实以及合法 Player World 首演完成事件；创建后普通保存不得补写、改写或删除。

### B2.3-05 继承完成后阻断再次首演
ForkWorldClearSession 扩展既有 WorldClearSession；继承完成时 completionStatus=Inherited、record=null；过滤 EnterWorldChart 与 RetryWorldClear，避免基类恢复产生的待重试候选被写成新世界通关记录。

### B2.3-06 未完成副本的真实新通关
来源尚未 World 首演完成时，目标见证 inheritedCompletionEventId=null，后续仍沿用正式制作选择 ID、非零向量追加、SphereCrossing、World 首演与 WorldClearStorage 提交流程；真正完成产生目标自己的合法 WorldClearRecord。

### B2.3-07 独立记忆、成绩与冻结内容
每个世界具有独立账本、解谜、回忆计数、链接配置、冻结谱面与成绩载体；分叉后目标自己的合法 Recall / ReplayTrace 只改目标 RecallCount；ReplayChart 只使用目标已继承的实际首演内容；重演不会追加完成账本、生成 WorldClearRecord、增加 RecallCount 或改账号投影。

### B2.3-08 目录追加唯一提交点 + 回滚
WorldForkStorage 使用短期日志桥接目标 Core key 与账号目录 key；顺序为：验证日志/计划及目录预期值 → 写 PendingWorldFork 日志 → 持目标租约写完整目标 Core → 回读确认 → 再比较目录 → 追加目标目录记录 → 清理日志；目录追加是唯一提交点；已发布目标不回滚，清理失败保留日志并重试。

### B2.3-09 租约 + 目录锁顺序
组合根先取得来源世界租约，再取得新目标世界租约，最后取得同账号目录独占锁；Web Locks 的 ifAvailable 检查使活动来源立即拒绝；缺少锁能力不采用无锁写入；目录锁回调内不等待世界租约。

### B2.3-10 两档分辨率 + 三条门禁
1920×1080 / 2560×1440 双档真实 Cocos 预览通过，共 54 张原始截图；check:naming / check:dependencies / typecheck 三条门禁独立通过；renderer/runtime 错误 0；外部请求 0。

### B2.4-01 InitialWorld 完全排除
InitialWorld 不进入 WorldHomeRegistry、不参与 CrossDeviceDuplicate、不迁移不传输；对 InitialWorld 的操作在网络与 ID/时钟工厂调用前拒绝为 ExcludedWorld；契约测试覆盖 InitialWorld 零调用排除。

### B2.4-02 归属索引与两层表
WorldHomeRegistry 为 accountId×worldId 账号级归属索引；HomeDevice 是设备归属，不是 WorldDeveloper 所有权转让；WorldRegistry 本机位置表语义保留，b 不实装。

### B2.4-03 登记来源合法性
登记来源由注入的同账号本机合法目录读取器确认：非 InitialWorld、合法 world- ID、active、EmptyWorld template；已删除/未知/错账号/损坏目录不登记。

### B2.4-04 首次归属原子与版本纪律
服务首次登记原子且不可覆盖已有归属；homeRevision=1；registryRevision 全账号每新增一世界递增一次；重试/读操作不增加归属版本；同请求幂等，同设备重复登记返回 AlreadyHomed。

### B2.4-05 HomeConflict 语义边界
HomeConflict 仅是"已有另一设备归属"的服务结果，不等价已确认复制品；不载入、不复制、不改写世界；不同设备登记已存在世界不能抢归属。

### B2.4-06 严格解码与观察不回退
请求无账号/设备可覆盖字段；响应作为 unknown 重新严格解码；session 观察的 registryRevision 不回退、已观察 record 不无故消失或改变；服务失败不返回缓存 Homed。

### B2.4-07 诊断完备
服务 unavailable、端口缺失、响应格式/身份/版本错误均返回明确诊断；不能用缓存回填成功。

### B2.4-08 无持久化与边界保持
b 不写三个 key 前缀（home-registry/reality-pause/migration）、无本地 journal；不改旧世界 lease、目录提交、账号保存或输入门控；不新增 service/sync 模块与依赖方向。

### B2.4-09 契约级验证与生产证据区分
34/34 契约测试 PASS（两逻辑设备共享同一 ContractAdapter、独立本地会话）；非真实登录、物理设备或网络服务；生产端到端与双档 Cocos 留 e，不冒称真实跨设备验收。

### B2.4-10 三门禁与核心保护
check:naming 117 TS 0 ERROR / 22 WARN（无新增告警）、check:dependencies 111 TS 约 388 子句 0 ERROR、typecheck 0 诊断；保护审计 587→595 路径 SHA256 全保持，IntentPort 剥离新增 type 导出后原字节前缀与基线一致。

### B2.4c-01 受限载荷与品牌不传输
CoreTransferPayload kind=RestrictedCoreTransfer 仅封装七项 Core 的 data-only 值及传输身份头；不携带账号事实、媒体文件、品牌或凭证；接收端重新 parseComplete 并经正式发布内容引用核验，摘要不替代正式核验。

### B2.4c-02 六路分流
Homed 不走复制；CrossDeviceDuplicate 唯一可走 c 复制（proof 精确匹配、同账号、来源 homeRevision1/Homed 且为另一设备）；Released 拒绝 claim 交 d；Migrated 不产出；AuthorityUnavailable / UnsupportedBoundary 拒绝导入；InitialWorld 在读取服务/分配 ID 前排除。

### B2.4c-03 权限门槛与账号事实隔离
接收账号经既有 AccountMilestoneReader 校验 CopyPermission=FirstWorldCleared 同账号合法投影；无权限拒载显示"档案损坏"，不改源/载荷/目录，不调用 ID 工厂；账号事实不进入载荷、不写入接收世界。

### B2.4c-04 新 UUID 重键与继承
目标 world-UUIDv4、transactionId=import-UUIDv4；源 accountId 保持；目标 revision0、新 capturedAt/forkOrigin、七项身份重键；FormatTime 原值、完成继承 Inherited、不生成 WorldClearRecord/FirstWorldCleared；Primary/null 且静止 Complete 才支持。

### B2.4c-05 服务先登记与归属不变
服务 registerWorldHome 以幂等 registrationId 登记；新目标 HomeDevice=接收设备，源世界 HomeDevice 不变；目标登记 HomeConflict 永远拒绝发布或覆盖；这不是迁移。

### B2.4c-06 两域提交与锁顺序
持独立导入锁 → 真实新目标 lease → 账号目录锁；目录追加是本地唯一发布点，服务登记是另一域权威点；服务 await 不持目录锁、不持远端源 lease；A 导出单独持来源真实 lease 并检查 active 本机目录。

### B2.4c-07 崩溃恢复与幂等
日志前无副作用；Prepared 后重用同 plan/ID；服务响应丢失重放同 registrationId；服务成功日志失败以 Prepared 重试；Core 写后目录前保留暂存重试；目录原子写成功但异常以回读判定；Published 标记失败阻止打开并恢复；Published 后不删除目录/Core，不把服务成功伪装撤销。

### B2.4c-08 恢复与打开门控
恢复以 journal 解析、权威 proof/当前归属、目标真实 lease、目标 Core/目录一致性协调；已发布但服务缺失/不可用/冲突先拒开，同 ID 登记对账后才开放；篡改、错误身份、损坏日志、目标碰撞保留原值并阻断；不删除已发布世界。

### B2.4c-09 组合原型与身份边界
同一 realm 的 A/B 逻辑设备共享一个 ContractAdapter，B 使用独立持久化世界存储命名空间；原型面板明确标注受限/ContractAdapter；B 打开须先权威归属 + receipt 门控，随后真实目标 lease 与既有正式 World factory；不冒充物理双设备或外部认证。

### B2.4c-10 三门禁、契约与保护
check:naming 0 ERROR / 22 WARN 无新增、check:dependencies 115 TS / 407 依赖 0 ERROR、typecheck 0 诊断；契约测试 87/87 PASS（领域/导入/存储 59 + 包装/内容 22 + 组合根 6），Creator 双逻辑设备 A→B 两档各 11 张截图；保护路径 603→621 SHA256 全保持。

### B2.4d-01 同 ID 迁移边界
WorldMigration 转移同账号同 worldId 的 HomeDevice；不用 rebaseWorldState、不重键、不新 forkOrigin、不改变 revision/capturedAt/FormatTime/七项；不要求 CopyPermission；InitialWorld 不迁移，非 Primary 生产迁移拒绝。

### B2.4d-02 独立 d 权威端口与旧契约保护
新增 MigrationAuthorityPort / WorldMigrationContractAdapter，不扩大旧 b/c 首次归属契约；d 参与的全部准入读同一持久权威；旧 c 操作额外受 d 准入/归属 guard，迁移后 homeRevision>1 仍不走 c 复制。

### B2.4d-03 SafePoint 排空确认全集合
SafePointDrainConfirmation 含 schemaVersion/accountId/sourceDeviceId/drainId/directoryDigest/worlds（worldId/revision/coreDigest），覆盖源设备账号全部未删世界（含 InitialWorld/空世界）；仅迁移世界必须 Primary 七项 Complete，其他世界严格 Core 及安全边界验证；排空不得只看磁盘旧值而忽略活动图（drain 契约 20/20 PASS）。

### B2.4d-04 活动自然排空与能力世代
SafePointDrainPort 持单次当前排空世代能力：关闭源新准入后取得按 worldId 排序的真实 leases，排尽在途世界/账号事实并重读目录/Core；Pending/Failed/缺失非继承通关记录、活动演奏/重演/揭示/七秒计时/排队入口/未恢复发布事务均未排空；不强制结束谱面、不跳过揭示、不清计时伪造安全点（boundary 契约 8/8 PASS）。

### B2.4d-05 确认失效与 30 秒服务寿命
确认随 lease 世代失效、集合变化、恢复写入或显式撤销立即永久无效；服务接收确认后另给服务时间 30 秒有效期，Release 原子消费；服务调用失败/响应丢失可用 migrationId 查询；不能重用确认启动第二迁移；无 bootId 要求。

### B2.4d-06 Release/Claim 请求与 receipt
MigrationReleaseRequest（schemaVersion/migrationId/worldId/expectedHomeRevision/drainId）与 MigrationClaimRequest（schemaVersion/migrationId/worldId/expectedHomeRevision）严格版本化；绑定账号/device 来自端口不得自报覆盖；MigrationReceipt.kind=PauseActive/Released/Claimed，含归属、pause、服务观察时间、source/claim device 证据。

### B2.4d-07 RealityPause 记录、版本递增与服务时钟
RealityPauseRecord 含 schemaVersion/accountId/migrationId/initiatingDeviceId/startedAtServerEpochMs/resumeNotBeforeServerEpochMs/endedAtServerEpochMs；Release 与 pause/绑定同一权威事务产生，期间 Home 仍 Homed，结束发布 Released、Claim 再 Homed；homeRevision 每次实际释放/认领 +1（Released +1 / Claimed +2），registryRevision 同步递增；冷静期 max(3600000, OFFLINE_GRACE_HOURS×3600000) 只由服务时钟判定，客户端无解除/缩短端口，墙钟/倒计时不参与资格（authority 契约 32/32 PASS）。

### B2.4d-08 全账号暂停准入与设备绑定
全账号所有设备/世界立即拒绝新进入、创建/删除/分叉/导入/迁移/新演奏/新叙事活动；已在活动边界仅保留必要输入与自然媒体时序，真实 Complete 且账号事实结算后安全退至只读目录，不强退活动，InitialWorld 同暂停，服务不明时拒绝新准入；DeviceAccountBinding 由服务持久保存，暂停中发起 device 登录/切换另一账号拒绝（含其他窗口/客户端重建），删本地缓存不能解除，只服务结束才解绑。

### B2.4d-09 受限载荷、journal、锁序、源字节与恢复
RestrictedMigrationCorePayload data-only 七项，接收端重新 parseComplete + 正式内容引用验证，WorldClearRecord/FirstWorldCleared 继续同账号受信读口、不进载荷；WorldMigrationJournal v1 按设备账号保存 entries，phase=Prepared/PauseActive/Released/Claimed/LocalPublished（不使用 CleanupPending），Claim 成功先日志再目标 Core、目录追加唯一新本地发布点、LocalPublished receipt 永久留；独立 key neurou-migration-v1:<account>、协调锁 neurou-cross-device:<account>，pause 缓存 neurou-reality-pause-v1: 仅诊断；源锁序=协调→排序所有世界 leases→账号事实锁→目录，目标=协调→目标 lease→目录，服务 await 不持最终目录锁，权威锁不反取世界/目录锁；源文件/Core/目录字节不改不删不写墓碑，Migrated 仅来自鲜读服务归属诊断；迁回须新事务，同值幂等/原值可迁回，异值/墓碑拒绝不复活；逐 phase 同 migrationId/期望版本恢复，不删除已发布世界伪装回滚，无 WebLocks 明确拒绝（storage 契约 34/34、prototype 契约 12/12 PASS）。

### B2.4d-10 三门禁、契约回归与双档验收
check:naming 0 ERROR / 22 既有 WARN 无新增、check:dependencies 120 TS / 约 423 依赖 0 ERROR、typecheck exit 0；新增契约 106/106 PASS（drain 20 + boundary 8 + authority 32 + storage 34 + prototype 12），B2.4c 回归 65/65 PASS（59 + 6）；Creator 双逻辑设备 A 排空→Release→暂停拒入→服务 fixture 时钟推进一小时→B 同 ID Claim→正式恢复，1920×1080/2560×1440 两档各 17 张截图（共 34 张），renderer/runtime 错误与外部请求均 0；测试推进的是服务 fixture 时钟（realElapsedHour:false），非真实等待/真实服务器；e 与完整 FileCarry、真实 AuthService/CommitRelay 留后续。

### B2.4e-01 纯验收轮与零新增冻结
e 仅完成端到端、双档 Creator、既有契约回归、三门禁与源码保护证据；测试脚本与交付材料只写 quality-review/b2-cross-device-e2e/，不修改 production、docs、名库、参照、核心算法或门禁规则；新增运行时名 / 接口 / key / schema / journal phase = 0，不借 e 补做 B2.5（VERDICT-346）。

### B2.4e-02 PROTOCOL 闭合与审计诚实
P1～P4 已由 VERDICT-301~310 闭合；用户确认 d 所见 docs 变化为 Trae 授权同步、正式验收 d 并追认 v3.14，来源问题按 PROTOCOL 闭合；d 历史原 SHA 差异、completeProtectedAuditPass:false 与旧诊断保持原值不追改；e 本轮审计单列 TraeAuthorized 且 rawHashEquality=false、sourceProtectionPass=true，不把授权归因改写成字节未变（VERDICT-347）。

### B2.4e-03 归属分层与 InitialWorld 边界
WorldHomeRegistry 仍是账号级服务归属权威，WorldRegistry 仍是本机位置层（e 未实装位置 API）；范围仅本账号自建/分叉的非 InitialWorld 世界，身份来自现有绑定 ContractAdapter 端口；InitialWorld 不登记、不作 c 传输或 d 迁移世界，但源全账号 SafePoint 排空与 RealityPause 仍包括 InitialWorld/空世界，两设备独立 InitialWorld 互不争抢归属（VERDICT-348）。

### B2.4e-04 同一主链 c+d 双目标独立
同一账号、同一持久权威、同一条实际 Creator 主链先验 c 合法复制（A 非 Initial 源→B 新 UUID：七项重键、FormatTime 保留、Inherited、源仍 Home=A），再验 d 同 ID 迁移（A 原 worldId 迁到 B：不重键、不 rebase、不改 revision/forkOrigin/capturedAt/FormatTime）；c 目标与 d 目标为不同 worldId，各有独立 Core/目录记录/receipt/当前 Home；c 目标先正式打开，d 全链及暂停拒入后其 Core 与导入 journal 逐字节保持（idsDistinct/journalsIndependent/copySurvivesMigrationAndPause 均 true；copy HomeRevision=1，迁移源 HomeRevision=3）（VERDICT-349）。

### B2.4e-05 同 ID 迁移链沿用与打开鲜读
沿用 d 主动排空→MigrationRelease→RealityPause→Released→MigrationClaim→LocalPublished→正式 Restored/Complete 链；服务归属是全局权威，目录追加是本地新发布唯一 commit point，独立日志协调两域；迁移源不改不删无墓碑；WorldClearRecord/FirstWorldCleared 继续同账号既有事实不随载荷复制；CopyPermission 仅是 c 门槛，d 不要求；源迁走后不凭 HomeConflict 或历史 c proof 自动复制，打开鲜读当前归属（VERDICT-350）。

### B2.4e-06 服务时钟权威与一小时标签
RealityPause 时长仍为 max(1 小时, OfflineGrace)，仅服务时钟裁决，客户端时钟/倒计时/缓存均不解锁；e 主链明确推进独立 ContractServiceClock fixture 3600000ms（3599999ms 再 1ms）并标注 ContractAdapter / serviceClockAdvancedMs:3600000 / realElapsedHour:false；活动续行补验 serviceClockAdvancedMs:0；该推进不是实际等待、真实服务器或平台 OfflineGrace 实现（VERDICT-351，契约 A03~A05 / MP07 回归）。

### B2.4e-07 全账号暂停拒入与活动自然退场
同一 RealityPause 下 A/B、InitialWorld、c 复制目标、d 待迁目标及其他世界均拒绝新准入（allAccountNewAdmissionRejected=true，含提前 Claim 拒绝）；发起逻辑设备跨窗口/客户端重建不能登录另一账号（initiatingDeviceBindingSurvivesRebuild=true，删本地缓存不解除）；另一窗口已在运行的活动保留必要输入与真实原生媒体自然时间线，不强退/seek/清时钟/伪造 ended，native 6 秒 ended 且世界及账号结算后进入 SafePoint，显式返回文件夹不能提前绕过；completedPlayCount+1、账号事实保持；INV-10/12/13 保持（VERDICT-352，两档 11/12/17~19 截图）。

### B2.4e-08 契约回归 227/227
e 隔离副本重跑 b/c/d 既有契约：b WorldHomeRegistry 34/34、c 主组 59/59（含 storage 30 不重复累计）+ 内容/共享权威 22/22 + 实际组合 6/6、d drain 20/20 + boundary 8/8 + authority 32/32 + storage 34/34 + prototype 12/12，合计 227/227 PASS / 0 FAIL；覆盖严格 data-only 与重新 parseComplete、身份/权限、服务 unavailable、Web Locks 拒绝、Release/Claim 幂等与响应丢失、每持久 phase 恢复、碰撞/原值迁回/异值拒绝、服务成功本地失败与本地已发布服务未知；d 历史 65 项 c 回归不额外计入；原脚本/已验收报告与 127 个生产 TS 路径前后 SHA 不变（VERDICT-353）。

### B2.4e-09 Creator 双档实际运行 40 张截图
Creator 固定 1920×1080 与 2560×1440 双档，各用独立干净 profile（DPR1），从正式登录/序章/通关/本机 Fork 开始，经 c 复制及 d 同 ID 迁移后正式打开，无玩法状态或世界文件种植；每档 20 张共 40 张 CDP PNG（36 份不同字节，每档 09/15/16 恢复画面因继承内容与 FormatTime 相同而同字节——世界身份由同期 runtime worldId、Core/目录/服务归属、receipt 及字节比较证明）；39 模块 sourceMap 含当前源码、served chunks 等于编译输出，首尾 compilationUnchanged:true；rendererErrors/runtimeErrors/externalRequests 均 0；两档 transferAcceptance/migrationAcceptance/integratedAcceptance/activeReplayPauseAcceptance/resolutionComparison 全 PASS，比较语义结果与不变式，随机 ID/时间不要求逐字节相等（VERDICT-354）。

### B2.4e-10 三门禁、源码保护与 B2.5 剩余
check:naming 0 ERROR / 22 既有 WARN 未放宽规则、check:dependencies 120 TS / 约 423 依赖 0 ERROR、typecheck exit 0；固定 e 基线 643 路径→终态 643 路径，productionFileCount=0、sourceProtectionPass=true（coreAndComposition 516 / settingsAndScenes 19 / otherReferences 34 均 PASS、junction 不变），唯一原字节变化为已列举的两项 Trae 授权正式 Markdown 同步（NAMEBOOK 84404→91494、stage-1 53741→60206 字节，rawHashEquality=false）；B2.4 受限 Core/ContractAdapter 范围闭合，完整 FileCarry（共享 codec/个人媒体/加密密钥 suite）、真实 AuthService/CommitRelay/fetchServerTime、平台 OfflineGrace、非 Primary 生产迁移、WorldRegistry 本机位置、AccessCode/ObserverSync 留 B2.5 或后续独立范围（VERDICT-355）。

### B2.5b-01 阶段恢复与 b 授权边界
P1/P2 已正式闭合，B2.5b 在仅 b 授权范围准入：允许新增契约、type-only 导出、独立组合根与模式分流，不放宽旧 guard、不冒用旧标签、不在失败时切 fixture；b 的真实认证闭环不自动构成 c/d/e/f 或完整跨设备/文件/物理验收（VERDICT-376）。

### B2.5b-02 P6 外部报告归因闭合
用户确认 docs/B2.4-overall-report.md、quality-review/B2.4-overall-report.md 为 Trae 按 PROTOCOL 授权落盘；本轮 closure 仅追加 TraeAuthorized 来源归因，不回写 a 的 UnknownExternal 观测、6,937→6,939、raw exit1、first FAIL 与旧 SHA 记录，rawHashEquality=false，不把授权等同 SHA 相等，b baseline 在两项已存在后捕获（VERDICT-382）。

### B2.5b-03 真实端口与 ExternalService
新增 RealAuthServicePort、RealCommitRelayPort、RealWorldAuthorityPort，真实 mode 逐字 ExternalService，不扩旧 ContractAdapter 联合；旧 AuthService.login/logout/verify 与 CommitRelay.relay 的同步签名、archive、原 ContractAdapter 类型/guard/receipt/key/锁原样保留；RealWorldAuthorityPort / RealCommitRelayPort 仅类型定义，边界冻结/机制未实施（VERDICT-377）。

### B2.5b-04 真实权威不承载世界 payload
服务仅允许账号事实、归属、暂停、设备绑定、幂等请求、不可逆载荷摘要及轻量 receipt，禁存世界文件/七项/媒体/共享状态，真实 API 不提供 readMigrationPayload；b 不实施迁移，完整文件仍由用户 FileCarry 搬运，源 live drain 持锁至 release 等机制留后续（VERDICT-378）。

### B2.5b-05 独立 server 包与真实运行时
server/ 为独立包：Node.js 24 LTS、Fastify 5、PostgreSQL 17，真实 loopback HTTP 开发，数据库为独立进程与耐久事务，无内存/SQLite/pg-mem 冒充 PG；服务器不恢复 archive/service/sync、不进入 Cocos 模块树，独立锁文件/构建/测试/迁移，不纳入客户端三条门禁（VERDICT-383）。

### B2.5b-06 认证与注册设备凭据
账号密码经 Argon2id 验证；首次登录以新 P-256 RegisteredCredential 的 challenge 持有证明加密码注册并由服务签发 deviceId，既有凭据登录核对 challenge/账号/公钥/世代，b 世代 generation=1，status 允许 Active/Revoked 而无客户端撤销 API；无匿名游客权限、不从 fixture 继承账号事实、不把注册公钥当硬件认证；账号仅由显式管理员 CLI 创建，通关事实/CopyPermission 不允许普通客户端赋值（VERDICT-384）。

### B2.5b-07 会话、刷新与登出
随机不透明访问/刷新凭据 DB 只存摘要，访问 15 分钟、刷新家族 7 日绝对寿命，旋转单次刷新并具备重用检测/事务撤销，HttpOnly/SameSite=Strict cookie（loopback HTTP 仅开发例外，本轮不提供 TLS 生产模式），精确 Host/Origin/CSRF 校验；adapter 登出期间先阻止新调用，结束或失败均清本地认证缓存，服务失败保留失败结果；无 localStorage token/密码/key（VERDICT-385）。

### B2.5b-08 签名服务器时间
fetchServerTime():Promise<number> 逐字签名保留，仅从真实已认证服务、经请求 nonce/实例/keyId/clockGeneration 的 ES256(P1363) 签名 receipt 校验后投影非负安全整数 epochMs；可信公钥由安装配置/带外引导（AuthorityTrustAnchor），不信任响应自带 key；失败拒绝，不 Date.now/performance.now/fixture 回填；一次时间样本不授予准入或结束 RealityPause（VERDICT-386）。

### B2.5b-09 轻量账号/设备事实与组合根窄边
用户 API 只读本人 RealAccountFacts（身份、注册设备列表、requestNonce、revision 固定 0，不是世界 revision 或 CAS）与注册设备事实，凭据注册时写显示标签；本轮无设备标签更新、凭据撤销/轮换或账号事实更新 API，不能写 device assurance、公钥世代、通关记录、FirstWorldCleared、CopyPermission、worldId/HomeDevice 或世界 payload，普通 API 严格字段白名单；RealServiceBuilder / buildRealAuthService 只独立装配新真实链，production adapter 不携 fixture 引用，旧 WorldFolderBuilder/SceneBuilder/B2.4 会话与 guard 不改，presentation 经 IntentPort 仅 type-only 窄边，director 契约零 cc（VERDICT-387、388）。

### B2.5b-10 三门禁、真实证据与延期项
check:naming 实测 0 ERROR / 22 既有 WARN 不放白名单、check:dependencies 0 ERROR、typecheck exit 0；server 独立 typecheck/build/test 与真实 PG17 + HTTP loopback 正反例、重启持久、adapter 验签/失败路径证据单列（客户端契约 24/24、真实 HTTP/PG 6/6、server 16/16，0 skipped），inject-only 不当真实 HTTP；b 不含 Relay、完整 FileCarry、个人静态加密迁移、平台 OfflineGrace/PhysicalDevice/原生 host、真实 Release/Claim、AccessCode/ObserverSync；P3/P4/P5 准备文档可并行并分别于 c/d/e 前补冻，INV-10/12/13、七项同主 key、持 lease/无 Web Locks 拒绝、目录追加唯一本地发布点、RealityPause≥OfflineGrace、源主动排空、发起设备账号绑定、VERDICT-046 全部沿用（VERDICT-389、390）。

### P3-01 纯文档补冻范围与规范来源
本轮只新增 quality-review/b2-shared-contract-freeze 下的规范与审查证据：零生产源码变更、零 ContractAdapter 扩展、零服务器新路由，不执行真实 Relay、完整 FileCarry、原生 OfflineGrace、PhysicalDevice 或 ObserverSync；新共享 schemaVersion=1、profile 逐字 ExternalSharedOnlineV1、mode 沿用 ExternalService，精确字段白名单、显式 null、canonical UTF-8/JCS 整数子集、安全整数、UUID 稳定 ID 与分域签名/摘要，Genesis 与内容 manifest 仅来自正式受审内容或带外确认的开发者根，v1 只覆盖有限地图/Trigger 子集（VERDICT-391、392）。

### P3-02 二元身份与序号段边界
新 ExternalService 唯一身份 WorldCommitIdentity 为 authorAccountId+authorSequence，同服务实例同账号跨世界共用序号空间；设备/世代/world 仅为验证绑定，不参与身份键；旧 027 三元为历史格式，输入新 profile 拒 LegacyIdentityUnsupported，不去设备字段、拼接、重键或去重迁移，旧格式迁移另有独立协议。权威按账号事务原子分配不重叠 1024 号段（AuthorSequenceSegment），绑定设备/世代/world/membershipEpoch、寿命 3600000ms，号码只消费不归还，崩溃空洞/备份恢复弃段、耗尽 SequenceExhausted 拒绝；号段不是 OfflineGrant，Web 拒离线有效共享提交，不用应用运行时长或 Date.now 冒充（VERDICT-393、394）。

### P3-03 AppendedAt、总序与三类精确变化
SharedAppendedAt 沿用 {epochMs:number}，由一次服务签名 WorldAppendPermit 给出逻辑追加时刻（30000ms 内有效），正文/header/claim/receipt 相等，作者签名与 AEAD 绑定；不是 Relay 收件时间或本地墙钟，不回改 Ledger/NarrativeEvent；总序为 epochMs→账号 ASCII→authorSequence，同毫秒不同身份正常排序，同身份不同摘要/上下文为 IdentityConflict，不 last-writer-wins。WorldChangeClass 三类严格映射历史 CommitClass：MonotonicReveal→Monotonic（仅有效 Residue 的 revealed:true）、TraceTouch→AddOnly（仅批准 Normal Trace，touchUnits=1）、DeveloperMapChange→RestrictedWrite（MapEditCommit 与 DeveloperRosterChange 两 subtype）；不写个人显露、Recall/Replay、Ledger、七项 Core、20 维向量、谱面/媒体或 CommunityMap，不把 035 已改的 RestrictedWrite 写回 SingleWriter（VERDICT-395、396）。

### P3-04 稳定对象合并与 DeveloperRoster/注销
world 内 map/entity/Trigger/traceTouch 为稳定 UUID 永不复用；编辑位置用整数 milli WorldMeter（lateralMilli/depthMilli，1000=1 WorldMeter），只作新 wire 表达，不改核心坐标；同对象后序有效修改胜、后序删除胜，tombstone 后同 ID 不复活，多对象保存拆多条独立提交，无 atomic 跨对象牵连、无共享编辑锁或开发者 revision CAS，Create 不能自报 Normal 来源；未封边暂态不先写不可逆个人事实，终局冲突/撤权沿用 MergeConflict/RevertedEdit。沿用 035：唯一 WorldDeveloper 不可转让，CoDeveloper 必须已是 WorldObserver，名单内开发者可编辑所有 EditTarget，仅 WorldDeveloper 增删名单/改 AccessCode，按总序位置判权限；WorldDeveloperClosureFact 为签名轻量注销事实、同毫秒先于 commit、不回填已封边前缀，名单 frozen 后既有 CoDeveloper 可继续编辑；不是第四类共享变化，b 无注销 API（VERDICT-397、398）。

### P3-05 WorldRelayKey 分域加密与 AccessCode 首次准入
WorldRelayKey 为成员域随机 256-bit 群 key，绑定 world/membership epoch，与账号个人层 key、六位 AccessCode、作者身份 key 分离，每 epoch 全新随机、不从旧 key 派生；每 commit 随机 256-bit DEK，HKDF-SHA256 群域 wrap、AES-256-GCM 独立 96-bit nonce/128-bit tag，header+包裹字段进 AAD，作者 ES256 签完整密文；重试复用同一完整 envelope 字节（含签名），异摘要隔离不重加密；cipherSuite=AES-256-GCM-HKDF-SHA256-v1。AccessCode 沿用 023 恰好 6 位数字（保留前导零、WorldDeveloper 选择、CSPRNG 仅为推荐），正确码自动授首次账号 WorldObserver 资格，不替换人工审批，改码不踢旧成员、不授开发者权、不派生 key/pin；在线认证+精确限流+服务端 pepper verifier，限流数值为 C 类候选；密钥送达与准入是分离事实，Pending/KeyPublisherUnavailable 不收回 Observer 资格（VERDICT-399、400）。

### P3-06 成员 epoch 密钥交接与 TraceTouch 聚合
开发者长期签名根由受信 Genesis/带外 pin（WorldDeveloperTrustAnchor），b 内存 RegisteredCredential 不是长期开发者根或硬件认证；目标接收密钥用独立 ECDH P-256 经注册设备签 challenge 证明，WorldRelayKeyPackage 经临时 ECDH/HKDF/AES-GCM 与开发者签名精确绑定 world/成员 epoch/key epoch/key commitment/账号/设备/世代/目标公钥/packageId，由用户或受控点对点搬运，不存 Relay/Auth 云 vault、不进 WorldCommit；WorldRelayKeyAcceptance 用群 key HMAC possession tag 与目标设备签名双验；成员加入/撤销以新随机 key 的 epoch 原子激活为边界，已 admitted 历史保持，未 admitted 旧 epoch 拒绝，不重加密原 identity。TraceTouchAggregate 为唯一成功应用 commit 加 1 的 uint128 精确总量与 min(65535,total) 画面强度，去重不加、溢出拒绝、无衰减/贡献者表/排名；仅聚合投影，不宣称端到端匿名，不生成 EchoTrace，本人贡献缺证明为 Unknown（VERDICT-401、402）。

### P3-07 WorldChangeLog 与 B2.4 journal 关系、Checkpoint 精确覆盖
WorldChangeLogWire 是三类共享事实的签名提交总序日志，CrossDeviceImportJournal 是七项导入事务恢复、WorldMigrationJournal 是迁移 phase 恢复；三者不统一、不互转、不新增统一主 key，B2.4 key/锁顺序/phase 与 CoreTransferPayload 归属保持，服务器不提供 readMigrationPayload。Checkpoint 覆盖=完整时间前缀+精确 identity/摘要/AppendedAt/admissionRevision/applyResult/finalDiagnostic，不按作者最大序号吞号段空洞；须可信本地 Genesis/父 checkpoint、精确已准入前缀与总序重放；state/coverage/checkpoint 摘要分别自洽，只有完整已 admitted 前缀的 count/prefix 摘要与 RelaySettlementSeal 相等，seal 不认证本地 state；applyResult 为历史单步结果，不因终局 MergeConflict 跳过旧单步重放；父 coverage 仅在新合法封边覆盖时 null→MergeConflict，既有非 null 诊断不回退、旧 checkpoint 字节永不回写，同账号多设备不豁免冲突；陌生 checkpoint 无重放证明为 CheckpointUnverifiable，hash/发送者签名不授 Complete（VERDICT-403、404）。

### P3-08 迟到、封边不复活与 SettleHorizon 有限延迟
seal 边界 ≤ 可信服务 S−H 且单调，checkpoint 边界与 seal 严格相等，封边后禁止新旧时刻准入；已及时 admitted 的历史不因今天才拉取变 Orphan，缺载是 Gap；可信 WorldCommitRejection 绑定真正 TimeTooLate 时沿用 028 个人 Common/Anomalous/OrphanCommit、撤回共享候选、每 identity 一次、拒绝变化永不复活；本地墙钟/自报文件/网络垃圾不产生该事实，online 许可通常先 PermitExpired，不得冒称离线迟到验收；已准入精确字节匹配但正文无效可 InvalidChange 覆盖，字节缺失/错摘要/缺群 key 不终局拒绝、不推进 checkpoint。H≥OfflineGrace(G)+boundedRelayDelay(B)+时间余量(U)、retention≥H；初始开发政策 G=3600000/B=300000/U=60000/H=3960000/retention=86400000ms，B 包含补发/排队/pull/退避/耐久而非 25s 长轮询，是网络恢复假设不是任意故障 SLA；超 B/Gap 为 BoundViolated，冻结结算，不偷延 OfflineGrant（VERDICT-405、406）。

### P3-09 Relay 边界降级与 ObserverSync 实施分段
沿用 024 客户端 HTTP pull（最长 25000ms 长轮询）：bounded 密文 WorldCommit 队列 + 轻量成员/权限/准入摘要与 receipt，可认证/限流，不保存共享 state/checkpoint/世界文件/个人层/向量/群 key 包/可读正文；RelayCursor.position 与作者序号/事件总序/结算边界分开，过 retention/代际丢段/缺 admitted 字节返回 Gap（RetentionExpired/RelayGenerationChanged/MissingAdmittedEnvelope），不跳过成功，只有验证后本地耐久才可 ACK；Relay 故障不等于 Auth/轻量权威故障，无 fixture 回退、不冒 ContractAdapter 标签。成员/WorldObserver 事实不等于开启产品 ObserverSync：本轮不接加入 UI、触痕生产、地图编辑器、Echo、EditPresence 或 S5；B2.5c 分 c-1 纯 codec/validator/确定性重放、c-2 真实轻量权威+bounded Relay、c-3 两客户端真实网络/密钥/Gap/故障验收，每段另需实施授权，B2.4 ContractAdapter 仅保留测试不增扩（VERDICT-407、408）。

### P3-10 三门禁、SHA 保护归因与不变式延期闭合
三条既有门禁实测 PASS（check:naming 0 ERROR / 22 既有 WARN 无增量、check:dependencies 0 ERROR、typecheck exit 0）；门禁不编译 Markdown、不证明新 codec/Relay 可执行；SHA 保护 raw FAIL 保留，仅 docs/NAMEBOOK.md、docs/spec/stage-1.md 为外部变更，用户确认 Trae 授权同步 B2.5b/v3.16，来源归因闭合，baseline/first FAIL/rawHashEquality=false 不改判为字节 PASS，除两项归因外无范围外修改。INV-10/12/13、目录追加唯一本地发布点、持 lease/无 Web Locks 拒绝、七项归属/revision/逻辑主 key/锁顺序、RealityPause≥OfflineGrace、源主动排空、发起设备账号绑定、VERDICT-046 个人层/共享层边界全部沿用；P4 外部 checkpoint 证明/个人自身贡献/长期 key 保护/异步存储、P5 原生离线时间证明、旧身份迁移、world/root 注册入口与生产保管负责人各有明确实施前置，云 key 包/三元静默转换/绝对匿名/未批准原生能力须先 PROTOCOL（VERDICT-409、410）。

### B2.5c-1-01 五份独立源码与文件边界
本轮批准增量为 src/director 下 SharedCommitContracts.ts、SharedCanonicalBytes.ts、SharedCommitCodec.ts、SharedCommitValidator.ts、SharedWorldReducer.ts 五份独立源码及 quality-review/b2-5c-1 隔离测试与交付证据；IntentPort.ts 仅允许尾部 type-only 追加（原 47617 字节前缀保全，尾部 1425 字节 type-only），服务器、旧客户端主链、编辑器、B2.1～B2.5b 核心与 archive/service/sync 均不接入或改造；P3 原计划 c-1 绑定的 HTTP 路径/CSRF/错误 wire/限流数值/future 网络端口按零网络范围留 c-2 开工前冻结（VERDICT-411、413）。

### B2.5c-1-02 数据契约与旧服务契约分离
SharedCommitContracts.ts 为唯一新增纯数据契约文件，逐项落实 P3 的 54 种 schema 并提供 SharedSchemaMap/SharedSchemaKind 类型映射、SharedAuthorityPayload 八种 purpose 载荷联合与 SharedSchemaErrorCode 本地解析错误类别；新身份仍为 authorAccountId+authorSequence，schemaVersion=1、profile=ExternalSharedOnlineV1、真实模式 ExternalService 逐字沿用，拒绝旧三元输入及多余字段、不做隐式迁移；旧 RealServiceContracts.ts 与旧同步 AuthService/CommitRelay 签名保持原状（VERDICT-412）。

### B2.5c-1-03 Codec 与 canonical 字节边界
正式冻结 SharedCommitCodec（validate/encode/decode 三入口按精确 schema 处理并生成冻结副本，只验证结构/值域/内在关系，不证明签名或来源）与 SharedCanonicalBytes（独立手写 UTF-8 与严格 JSON reader 按 RFC8785/JCS 安全整数子集生成唯一字节，键用 UTF-16 排序，decode 须重编码逐字相同，拒绝重复键/负零/非规范数字/accessor/非法 prototype/稀疏数组/循环；base64url 无 padding）；CANONICAL_DEPTH_LIMIT=128 为实现资源守卫，超限返回 LimitExceeded；SharedSchemaError 为运行时边界错误类（VERDICT-414、415）。

### B2.5c-1-04 验真模块与注入密码学端口
正式冻结 SharedCommitValidator 与 SharedCryptoPort（sha256/verifyEs256/hkdfSha256/decryptAes256Gcm 四方法，检查过的认证失败返回 null、backend 故障 throw）、SharedValidationContext（服务 pin/开发者 pin/Genesis 摘要/world/map/manifest/受信 clockGeneration/正式内容批准函数/epoch key 查询能力由可信调用方安装，不从输入文件取信任根）与 SharedValidationResult（Verified/Gap/HostFailure）；生产模块不产生 key/nonce、不写秘密、不调用网络、零 DOM/Node/平台依赖；owns* 能力由本实例私有 WeakSet 承载，复制/序列化/结构伪造不继承（VERDICT-416）。

### B2.5c-1-05 七个签名/AAD 域与 AEAD 绑定
正式固定七个实际域字面量（末尾为真实 NUL 字节）：Neurou/shared-authority/v1\0（receipt 除 signatureBase64Url 全字段）、Neurou/commit-admission-claim/v1\0（完整 claim 作者独立签名）、Neurou/world-commit/v1\0（envelope 除作者签名全字段）、Neurou/world-membership/v1\0（epoch proposal 除 developerSignatureBase64Url/activatedAtServerEpochMs 的开发者根签名）、Neurou/relay-dek/v1\0（HKDF info 绑定完整 header，salt=SHA256(JCS(identity))）、Neurou/relay-wrap/v1\0（DEK wrapping AAD 绑定完整 header）、Neurou/relay-body/v1\0（body AAD 绑定 header 与 wrappedCommitDataKey）；ES256 为 64 字节 P1363，nonce 12 字节、tag 16 字节，重算每个已签 epoch 成员 ECDH 指纹并拒绝签名材料重用；无包解密/分发/acceptance HMAC 生产验收（VERDICT-417）。

### B2.5c-1-06 来源失败、坏正文与主机故障分流
validateCommit 按精确容器→受信 receipt/claim/注册作者/成员/段/许可/历史时窗→精确 envelope 摘要→epoch key→envelope 签名/wrap/body AEAD→明文 schema/重复字段/manifest 顺序执行；来源可信且完整字节摘要相同后，坏 canonical/body/签名/tag 形成 invalid=true 本地能力，封边后可纳入 InvalidChange coverage；缺 key/缺字节/摘要不符/未知证明/错误 pin 为 Gap，不伪造终局拒绝；backend 异常/错误输出形状为 HostFailure；历史提交按签名 admittedAt 验许可时窗，不以当前墙钟使已准入事实失效（VERDICT-418）。

### B2.5c-1-07 确定性重放、封边与三类变化
正式冻结 SharedWorldReducer 与 SharedReplayRequest/SharedReplayResult/SharedReplayDiagnostic/SharedProvisionalCoverageEntry；replay 从受信 Genesis 或同实例可信 parent 开始，对完整 admitted 集自行验真、identity 去重与总序排序，结果不依赖输入数组顺序；返回 state 含未封边尾部，coverage/checkpoint.state 为已封边前缀，provisionalCoverage 为独立本地类型（finalDiagnostic 固定 null）不得序列化为正式 CheckpointCoverageEntry；无 seal 不生成 checkpoint；MonotonicReveal 只 OR、TraceTouch 唯一成功应用加一、DeveloperMapChange 单目标，名单权限按 AppendedAt→账号 ASCII→序号总序判断，tombstone 不复用 ID，同毫秒 closure 冻结名单而保留既有 CoDeveloper（VERDICT-419、420）。

### B2.5c-1-08 触痕边界、coverage 与本地可信 checkpoint
TraceTouch 要求受信 Genesis/manifest 的 Normal 资格，Echo/Anomalous/Recall/Replay 无共享入口；uint128 总量与饱和渲染分离，溢出不环绕；diagnostics 为确定性个人边界提案（scope=PersonalDiagnosticBoundary），不执行 NarrativeEvent/S5、不改七项 Core，selfContribution 固定 Unknown；seal 须满足 cutoff≤S−H、H≥G+B+U、retention≥H，精确前缀 count/digest 与 seal 一致才建 checkpoint；reducer 只继承本实例生成且完整字节相同的 parent，陌生快照 CheckpointUnverifiable，既有非 null 诊断不退回，同 seal 重取返回原 checkpoint；registry 仅本实例内存，不持久化、不对外导出信任（VERDICT-421、422、423）。

### B2.5c-1-09 隔离测试与真实密码学证据
154/154 PASS（codec 76、真实密码学 validator 47、replay 31），fail/cancelled/skipped/todo 均 0，源码与测试输入 SHA 运行前后稳定；严格隔离编译 target=ES2020、lib=ES2020、types=[]，无 DOM/Node/引擎声明；四个进程网络尝试计数均 0（只证明已执行路径）；IntentPort type-only 追加经 ES2015/removeComments 编译前后运行时 JS 均 17548 字节且完全相同；测试用内存真实 Node 密码学 fixture，与生产代码分离，不落私钥或群秘密（VERDICT-413、424）。

### B2.5c-1-10 三门禁、SHA 归因闭合与遗留边界
check:naming 0 ERROR / 45 WARN（基线 22、新增 23，均为 Trace 痕域语义告警，保留不放宽白名单）、check:dependencies 0 ERROR、typecheck exit 0；SHA 保护 raw FAIL 保留，docs/NAMEBOOK.md 与 docs/spec/stage-1.md 两项外部变化经用户独立确认"Trae 授权同步 v3.17/P3"归因闭合，不改写历史 raw；本轮无网络/服务器路由/真实 Relay/产品接线，c-2 需新一轮实施授权及真实 world/manifest/root/pin/key 交接前置，P4/P5、旧三元迁移、完整编辑器与 ObserverSync 产品接线继续延期（VERDICT-424、425）。



\## 9. 20 维向量顺序（已冻结）



| 序号 | 中文名 | 英文名 | 类别 |

|---|---|---|---|

| 1 | 红 | Red | 情感 |

| 2 | 绿 | Green | 情感 |

| 3 | 蓝 | Blue | 情感 |

| 4 | 黑 | Black | 情感 |

| 5 | 白 | White | 情感 |

| 6 | 灰 | Grey | 情感 |

| 7 | 物 | Initial | 元素 |

| 8 | 生 | Process | 元素 |

| 9 | 痕 | Trace | 元素 |

| 10 | 明 | Highlight | 元素 |

| 11 | 形 | Commented | 元素 |

| 12 | 雨 | Residue | 元素 |

| 13 | 信任 | Trust | 关系 |

| 14 | 亲近 | Closeness | 关系 |

| 15 | 理解 | Understanding | 关系 |

| 16 | 冲突 | Conflict | 关系 |

| 17 | 揭示程度 | TruthLevel | 真相 |

| 18 | 时间位置 | NarrativeTime | 时间 |

| 19 | 影响半径 | InfluenceRadius | 空间 |

| 20 | 玩家共情程度 | PlayerEmpathy | 共情 |



\- 枚举名：`NarrativeDimension`

\- 取值范围：每个维度都是非负实数

\- 存储格式：按上表顺序存为一个 20 位有序数组，附带 `VectorSchemaVersion = 1`

\- 代码中一律通过枚举名访问维度，禁止直接写数字下标



\*\*v3 时间模型说明（VERDICT-147 ~ 157；七项补充详见 quality-review/guidance-editor/VERDICT-147-157.md §v3 七项补充时间裁定）\*\*

\- `GuidanceChart.schemaVersion = 1 | 2 | 3`

\- v1 恰一条线；v2 至少一条线、固定速度；v3 至少一条线、采用绝对媒体时间表，线数无硬上限

\- v3 使用 `TimedGuidanceLine`（不携带 `speed`）与 `GuidanceNodeTiming`（普通节点 `targetTimeMs`，Hold 专有 `endTargetTimeMs`，以 `nodeId` 关联）；`targetTimeMs` 以视频/音轨开始为 0，暂停时媒体与谱面一起冻结，恢复不改变目标值

\- 时间—距离锚点为 Head（T0, 0）、普通节点起点（Ti, si）、Hold 尾端（Te, se），距离为 `aspectRatio` 加权弧长；时间升序、距离非递减。在 Ti ≤ t ≤ Ti+1 且 Ti+1 > Ti 时，位置函数分段插值：

  `s(t) = si + (si+1 − si) × (t − Ti) / (Ti+1 − Ti)`

  Head 以前 s=0，最后锚点以后 s=L；判定点位置仍由 `positionAtPathDistance(path, aspectRatio, s(t))` 给出，每线独立按 s(t) 擦除。



\## 10. 任务拆分顺序



| 顺序 | 任务 | 对应验收 | 说明 |

|---|---|---|---|

| T0 | 视频同步技术验证 | 第 7 节 | \*\*已完成，偏差 16.87ms / 16.53ms，通过\*\* |

| T1 | 工程骨架 + 命名检查脚本 | AC-24\~26 | \*\*需按 VERDICT-086 返工\*\* |

| T2 | 箱庭场景、主角移动、镜头、视距 | AC-01\~06 | — |

| T3 | 拖尾 | AC-07\~08 | — |

| T4 | 账本桩实现与叙事导演追加入口 | AC-22\~23 | \*\*依赖第 9 节维度顺序，已冻结，可开工\*\* |

| T5 | 元素、可见性、两种感知模式 | AC-09\~11 | — |

| T6 | 节奏敲击机制、解谜链、深痕 | AC-12\~14 | — |

| T7 | 视频谱面（判定、透明度、结算） | AC-15\~21 | 依赖 T0 通过 |

| T8 | 端到端联调 | AC-27\~28 | — |



\## 11. 测试与问题升级



\- 每个任务完成后由用户人工测试

\- EXECUTOR 连续两轮无法修复同一个人工测试问题时，由 PROTOCOL 整理现象、复现步骤和相关验收编号，交给 ARCHITECT 做根本原因分析

\- 任何"为了让测试通过而违反第 5 节不变式"的修改，一律视为失败



\## 12. 阶段 1 完成的定义



\- 第 8 节全部 29 条验收标准通过

\- 第 5 节全部不变式经代码审查确认没有被违反

\- 第 7 节技术验证有书面结论

\- 第 9 节维度顺序已经裁定并冻结

## 13. 表现层骨架命名（VERDICT-094）

| 文件 | 类型 | 职责 |
|---|---|---|
| src/presentation/FrameDriver.ts | FrameDriver（Cocos 组件） | 每帧驱动执行顺序：整理输入 → 交给意图接口 → 通知表现组件刷新 |
| src/presentation/CameraRig.ts | CameraRig（Cocos 组件） | 镜头对准主角、视距调整、沿路线旋转 |
| src/presentation/InputCollector.ts | InputCollector（Cocos 组件） | 采集原始输入，转换为 PlayerIntent |
| src/director/PlayerIntent.ts | PlayerIntent | 阶段 1 五种意图：移动、敲击、切换感知模式、进入谱面、退出谱面 |
| src/director/IntentPort.ts | IntentPort | presentation 通往 director 的唯一窄路 |

## 14. 引擎隔离规则（VERDICT-094）

- 逻辑模块（constants、ledger、world、character、trace、chart、editor、musicEditor、director）不得引用 `cc` 模块。
- 只有 `presentation` 可以引用 Cocos 引擎。
- 表现层可以保存显示状态（镜头参数、转场进度、渲染过渡色），但任何逻辑模块都不得读取这些状态。

## 15. 感知模式归属（VERDICT-094）

- 当前感知模式由 `director` 保存，作为运行时状态，不写入账本。
- `trace` 中判断可见性和交互的规则，以“当前感知模式”作为参数，`trace` 自身不保存模式。
- 表现层读取当前模式，用来切换低饱和滤镜。

## 16. 20 维序号对应关系（VERDICT-092）

- `docs/spec/stage-1.md` 第 9 节表格中的序号 1 ~ 20，对应代码中的 0 ~ 19。
- 即：表格序号 1（红，Red）= 代码 0；序号 20（玩家共情程度，PlayerEmpathy）= 代码 19。

## 17. 同步容差不变式（VERDICT-093）

- `SYNC_TOLERANCE_MS` 必须严格小于 `PERFECT_WINDOW_MS`。
- 当前占位值：`SYNC_TOLERANCE_MS = 30`、`PERFECT_WINDOW_MS = 100`（30 < 100 ✓；VERDICT-093 不变式仍成立）。
- 这条不变式必须加入自动化测试。

## 18. T0 同步验证记录（SyncVerificationRecord）

- 运行环境：桌面 Chromium 142（Electron 内核）
- 分辨率与最大偏差：1920×1080 → 16.87ms；2560×1440 → 16.53ms
- 样本数：各 10/10
- 素材规格：H.264/30fps/180帧/6.0s
- 判定圈编码对齐误差：0ms
- 容差：100ms，通过
- 结论：T0 通过，但仅对已测环境有效。正式发布用的运行环境必须做过同步验证。

## 19. 阶段 1 的 PC 构建目标（PROTOCOL 确认）

- 构建方式：**Web 桌面版 / 用 Electron 打包**
- 视频播放底层：浏览器内核的视频元素
- T0 覆盖情况：**已覆盖**，T0 结果直接生效，不需要在原生构建上补测。
- 新增规则：正式发布用的运行环境必须做过同步验证。每增加一个目标平台（包括以后的移动端），都要补一份同步验证记录（SyncVerificationRecord）。

- **Electron 版本锁定（Claude 补充）**：阶段 1 的 Electron 版本必须锁定为 T0 测试时使用的那个版本，在工程配置中写死，不允许宽松的版本范围。以后升级 Electron 大版本，算作"换了一个运行环境"，按 VERDICT-093 的规则补一份同步验证记录（SyncVerificationRecord）。
