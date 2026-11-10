# WorldLink、七项聚合与独立接线审计

本文件为本轮质量证据，不是 docs、名库或冻结参照文件。契约测试使用隔离存储、受控时钟和注入来源；不构成 BugShore、AI 服务或 foreign Recall 的生产验收。生产预览由主实现代理单独汇总。

## 修改范围

- `src/director/WorldLinkSession.ts` 及 `.meta`：版本化 AI 配置数据、单层来源身份、显式 NotApplicable、Bound/Orphaned 生命周期、来源进入时冻结、只读 hydration、持久化成功后发布及重入保护。
- `src/director/WorldStateCodec.ts`：原三项文档兼容读取，四项扩展整组出现，七项独立校验及交叉引用校验，私有 WeakSet 认证 Complete。PuzzleProgress 使用本次解析的 Ledger 参数，不引用之前解析的缓存。
- `src/director/WorldStateSession.ts`：七项来源绑定、真实完整认证、缺失项明确 Incomplete、准备未激活对象图后一次发布的恢复接口。WorldForkAvailability 仍为 NotImplemented。

未修改其他代理的生产文件。对根接线的唯一缺陷建议为：GC 失败不应清空已加载目录。主实现代理已修正，新增契约执行真实方法验证失败隔离与重试。

## 契约证据

| 文件 | 通过 | 失败 | 证据范围 |
| --- | ---: | ---: | --- |
| `world-link.contract-results.json` | 24 | 0 | 权威来源、完整配置、孤立冻结、只读恢复、输入严格性、失败保全 |
| `aggregation.contract-results.json` | 23 | 0 | 七项完整认证、不可伪造品牌、缺失/身份/引用拒绝、准备发布及失败丢弃 |
| `runtime-wiring.contract-results.json` | 11 | 0 | 真实 SceneBuilder/WorldFolderBuilder 方法与实际域/存储交互；完成事务、媒体摘要、旧文档不静默迁移、活动边界、GC 隔离及重试 |
| `ledger.contract-results.json` | 44 | 0 | d1 Ledger 回归 |
| `puzzle.contract-results.json` | 14 | 0 | d1 Puzzle 回归 |
| `b2a-account-regression-results.json` | 26 | 0 | 账号只读派生与单向投影回归 |
| `b2c-domain-regression-results.json` | 49 | 0 | 真实内容生产者、穿越、首演和路线域回归 |
| `b2c-storage-regression-results.json` | 56 | 0 | 通关记录及账号投影存储回归 |

五个既有回归脚本复制到本目录后执行，实际生产模块导入路径不变。没有覆盖此前 `b2-state-core` 的验收结果，也没有修改历史不支持聚合断言使其假通过。

`runtime-wiring.contract.cjs` 从当前 TypeScript AST 提取实际方法体并执行；视图接收端使用观察替身，存储与域使用实际实现。因此这是接线契约，不是 Cocos 生命周期或生产截图验收。

## 最终独立门禁

- `npm run typecheck`：PASS。
- `npm run check:dependencies`：0 ERROR，105 个逻辑文件，约 361 条静态依赖。
- `npm run check:naming`：0 ERROR / 27 WARN。告警为痕域 Trace 与判定时间窗 Window 的语义人工复核项。

## 新公开名称

`AIProviderConfiguration`、`AIProfile`、`AIProfileSnapshot`、`WorldLinkContext`、`WorldLinkSnapshot`、`WorldLinkSource`、`WorldLinkSourceReader`、`WorldLinkSession`、`validateWorldLinkSnapshot`、`validateAIProfile`、`WorldStatePreparedRestore`、`isValidatedWorldStateSnapshot`。

新增或扩展方法：`WorldLinkSession.enterFromSource`、`refreshSourceState`、`readEffectiveProfile`、`canReturnToSource`、`WorldStateCodec.parseComplete`、`WorldStateSession.bindCompleteSource`。

## 审计结论与边界

未发现新的架构阻断。真实 Primary 装配明确绑定 WorldLink NotApplicable；BugShore/FinalShore 语义由注入来源契约覆盖，未声称有生产运行时或服务调用。已确认根 `persistCore` 每次提交递增 revision，因此显式 Orphaned checkpoint 会落盘，不会因校验派生值相等而误当幂等空操作。只读来源墓碑投影本身不迁移存储。

新创建但尚未装配正式内容的世界保留 Unavailable + FormatTime 的原三项封套；正式内容首次初始化才建立扩展四项。历史三项读取和稳定无变化检查不补默认值、不自动迁移。

账号通关记录与里程碑没有进入世界七项，谱面 GC 保留 Ledger、其他世界项及墓碑。完整对象图发布由主实现代理完成并提供生产验收证据。
