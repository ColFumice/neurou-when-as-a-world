# B2.4a 交付报告 · 第 34 批

日期：2026-10-10（Asia/Shanghai）。执行角色：ARCHITECT；本轮 IMPLEMENTER 未进入生产机制实现。

**结论：裁定审查与提案已交付，B2.4a 全量契约冻结尚未通过；B2.4b 不启动。** 按用户“发现新的架构冲突或前置缺失，先停止，提交 PROTOCOL”的要求，提交四组前置问题 P1～P4。没有把它们静默修复或包装成已冻结机制；正式裁定书的“确认”与“受阻草案”逐条区分。

## 交付清单

| 要求 | 文件 | 交付状态 |
|---|---|---|
| VERDICT-286～300 正式裁定 | [verdicts-286-300.md](verdicts-286-300.md) | 15 条正式审查裁定；相关新结构受 P1～P4 阻塞，不冒称全量冻结 |
| 名库 v3.12 附录提案，交 Trae | [namebook-v3.12-proposal.md](namebook-v3.12-proposal.md) | 历史名补登、职责澄清、新结构候选分开；仅提案，未改名库，未发送消息 |
| 接口/数据结构草案 | [contracts-draft.md](contracts-draft.md) | data-only 示例，未创建生产 .ts；受阻处有明确标记 |
| 三条门禁 | [gate-results.json](gate-results.json) | 实际运行均 exit 0，完整日志保留 |
| b～e 子阶段拆分 | [stages-and-open-items.md](stages-and-open-items.md) | 明确入场条件、验证内容、模拟与生产证据区别 |
| 遗留/待裁定 | [PROTOCOL-B2.4a-001.md](PROTOCOL-B2.4a-001.md) | P1～P4 已整理为具体可选裁定；停止受影响最终冻结 |
| 未改源码/正式文档证据 | [protected-final-audit.json](protected-final-audit.json) | 564 路径 SHA256 前后比较：0 changed / 0 added / 0 removed；2 junction 不变，无不可读 |

## 已确认的核心裁定

- WorldRegistry 管本机位置复制检测，WorldHomeRegistry 管账号跨设备 HomeDevice 归属，服务是真源，本地 key 是缓存。
- CrossDeviceDuplicate 是检测结果，DuplicateWorld 是复制品加载资格，WorldFork 是新 ID 操作；已迁走的源设备必须分流 Migrated，不自动分叉。
- 跨设备合法 Primary 复制复用七项重键与本地目录追加发布；不能伪造本机来源 lease 或直接挪用旧 Fork 事务。
- WorldMigration 转移设备归属，保留 accountId/worldId/七项/revision/forkOrigin/FormatTime；原文件不改不删，不写删除墓碑；原账号通关事实继续有效，不复制/重造；CopyPermission 仍派生且不是迁移门槛。
- MigrationRelease 被服务接受先启动全账号 RealityPause，结束才 Released，再在线 Claim；暂停期间发起设备不可切账号。
- RealityPause 仅服务器判时，最低一小时且≥OfflineGrace；OfflineGrace 按最后成功联系 AuthService 后的设备开机累计运行时长。长度不等式不构成旧设备已排空证明。
- FileCarry 是可读共享日志/检查点加发送者本人个人层；本人层与媒体独立账号加密。七项 Core 含多层归属的状态/元数据，不是完整 FileCarry，运行时品牌不跨文件传递。
- 本轮只做端口草案；建议后续使用共享权威 ContractAdapter，真实服务接入另经阶段范围裁定。fetchServerTime 保持 `():Promise<number>`，无服务不以本机时钟替代。
- 完整 B2.4d 需要 OfflineGrace/SafePoint/可信资格闭环，不能全部留 B2.5 后仍宣称完整迁移。
- 三个新 key 的前缀和角色确认；内部 schema 受阻，本轮无 key 写入。旧锁顺序/七项主 key/INV-10、12、13 均保持。

## 本轮问题逐项定位

| 用户事项 | 裁定/材料 |
|---|---|
| 1 两登记表 | 286；P1 |
| 2 三名层级/触发/处理/新名 | 287、288；名库提案 |
| 3 迁移语义/源文件/继承 | 289、290；P3 |
| 4 全账号暂停/时钟/其他设备/切账号 | 291～293；P2 |
| 5 FileCarry vs 七项 | 294；P4；契约 §4 |
| 6 服务/时间/离线路径 | 295；契约 §3/7 |
| 7 宽限/安全点是否本批实现 | 296；P2；拆分表 d |
| 8 新 key | 297；名库提案 |
| 9 新锁顺序 | 298；契约 §6，新增锁为候选 |
| 10 跨设备复制复用 | 288；P3 新登记/本地发布恢复 |
| 11 迁移绑定 RealityPause | 291 |
| 12 子阶段 | 300；子阶段表 |
| 13 沿用不变式 | 299～300；名库提案末段 |
| 14 只冻结不实现/三门禁 | 本报告；正式裁定总状态；gate-results |

## 基线门禁与保护范围

| 门禁 | 退出码 | 结果 |
|---|---|---|
| npm run check:naming | 0 | 115 TS，0 ERROR / 22 WARN；4 Window=节奏判定时间窗、18 Trace=痕/深痕业务，人工复核无违规 |
| npm run typecheck | 0 | 无类型诊断；命令不打印文件数量，不虚构数量 |
| npm run check:dependencies | 0 | 109 TS，约 386 条静态依赖，0 ERROR |

命令在北京时间 2026-10-10 21:00:51～21:00:53 实际执行。时间原始值在 JSON 使用 UTC，不把宿主时间当客户端日期。三条完整 stdout/stderr 见 `check-naming.log`、`typecheck.log`、`check-dependencies.log`，没有增加测试、启动 Creator 或实装任何新机制。

前后 SHA256 清单覆盖 src、constants、assets、scripts、types、docs、settings、profiles、.trae、.creator 及根 package.json/package-lock.json/tsconfig.json、两份 docx、两份 logo、历史 jsonl。337 个实体文件加 227 个 junction 别名路径，共 564 项，两个 junction 指向保持。保护清单不含新 evidence 目录、node_modules、library/temp/tmp 等生成目录，报告不声称全盘审计。

工作区当前没有 Git 仓库，故未用 git diff 宣称“无改动”；改动边界以哈希清单和本轮工具写入目标为证。所有本轮新增文件都在 `quality-review/b2-cross-device-freeze/`；生产源码、docs、名库与参照文件没有改动。

## PROTOCOL 阻断原因

1. **P1**：两独立设备可自然创建相同 `(accountId,'InitialWorld')`，现有身份无法可靠判定复制。须正式限制范围或授权身份升级。
2. **P2**：服务器一小时与设备开机宽限/SafePoint 排空不能直接等同；发起设备跨账号绑定/重启强制还缺可信契约。须先批准时间、资格失效与安全点闭环。
3. **P3**：本地目录追加不能原子完成全球归属；迁移/跨设备新目标登记需要独立可恢复协议，Migrated 撤销证据、碰撞和迁回规则仍缺。
4. **P4**：共享日志/检查点 codec、全部个人媒体与账号加密载体未齐；不能将七项 Core 冒充完整 FileCarry/迁移。

这些是用户约束触发的 PROTOCOL 停止点，非技能要求或自动审批拒绝。所有可先完成的只读核对、具体提案和基线检查均已完成；下一步先回复该 PROTOCOL，再按批准范围补齐冻结，由 Trae 落盘正式名库/规格后进入 b。
