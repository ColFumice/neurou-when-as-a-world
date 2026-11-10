# B2.2d-2 依赖矩阵核对与同步提案

本轮无需扩展模块矩阵，也不新增模块目录。此文件交 Trae 作为规格同步说明；未修改 docs/spec/stage-1.md、名库、参照文件或检查脚本。

| 调用方 | 被依赖方 | 现有矩阵口径 | 本轮实际用途 |
| --- | --- | --- | --- |
| director / RecallCountSession | ledger、constants、director 内部 | 允许值/类型依赖 | 严格权威事件、Player 来源、同载体引用、合法计数候选 |
| director / ChartArchive、ChartReplaySession | chart、ledger、constants、director 内部 | 允许值/类型依赖 | 原谱面解析、原 ChartPremiere、真实结果、冻结与成绩候选 |
| director / WorldLinkSession | director 内部纯数据 | 无新增外部边 | typed AIProfile、单层来源读取、孤立快照；零服务调用 |
| director / WorldStateCodec、PrimaryWorldState、WorldStateSession | director 内部及既有 chart/ledger 契约 | 既有允许边 | 七项结构/引用校验、运行时认证、未激活图发布边界 |
| presentation / WorldMemoryView、ChartReplayView | director/IntentPort、director/PlayerIntent | I，仅 import type，现有两文件窄路 | 只读 payload/reader 与只含 ID 的 PlayerIntent |
| presentation / ChartReplayView | chart | R，仅 import type | ChartPremiereReader 的只读状态、布局与引导线读取 |
| presentation / WorldCoreStateStorage、WorldStateStorage | director/IntentPort | I，仅 import type | 平台适配器接收组合根绑定的 validator / leased writer，不值导入 director |
| assets/scripts 组合根 | director、presentation、chart、cc | 既有组合根职责 | 严格内容/媒体校验、构造与 seed、单 key 写入、租约/账号顺序、视图接线 |

director 未导入 editor：`ChartVisualSnapshot` 为独立纯数据契约，形状与实际编辑器发布的视觉数据一致。编辑器核心不改。逻辑层未引用 cc、DOM、localStorage、Web Locks、fetch 或 WebCrypto；实际字节读取和哈希验证留在组合根平台边界。AIProviderConfiguration 只保存配置，不创建服务依赖。

IntentPort.ts 增加对 RecallCountSnapshot、WorldLinkSnapshot、ChartSnapshotCollection、ChartScoreSnapshot、ChartMediaIdentity、ChartVisualSnapshot 的 `export type`，继续作为 presentation 的既有只读窄路；不暴露 LedgerAppend 或写能力值。PlayerIntent 只新增 RecallEvent / ReplayTrace / ReplayChart 的 ID 选择。

持久化仍由同一 WorldCoreStateStorage 处理完整世界文档；不增加 RecallCountStorage、WorldLinkStorage、ChartSnapshotStorage 或 ChartScoreStorage 四个分散 writer。WorldStateStorage 仅绑定严格七项 validator 与既有 leased writer，不绕过锁与 expected/revision 比较。

`npm run check:dependencies` 当前结论为 0 ERROR。Trae 同步建议只更新阶段范围、七项 codec 已实装、Complete/Restored 严格认证及稳定边界、Primary 生产与彼岸契约覆盖区别；矩阵单元和检查脚本均保持。

B2.3 本地分叉可依赖经认证的稳定 Primary 七项状态，但身份重建、引用 rebasing 与分叉事务应在 B2.3 自身裁定；不得据此新增 director→editor、逻辑层→平台或 presentation→director 值依赖。FileCarryPayload 不构成本地分叉启动的前置，本轮也未增加该域及依赖边。
