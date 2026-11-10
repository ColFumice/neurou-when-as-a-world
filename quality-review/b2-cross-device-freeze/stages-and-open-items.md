# B2.4 子阶段与遗留事项

总状态：B2.4a 已完成只读审查、裁定与提案交付；**全量冻结未完成**。依用户遇冲突先停的约束，提交 PROTOCOL-B2.4a-001，未进入 B2.4b。以下为按原拆分方向拟定的计划，不是源码实施授权。

## 子阶段拆分表

| 子阶段 | 内容 | 入场前置 | 可审阅的出场证据 |
|---|---|---|---|
| B2.4b WorldHomeRegistry 最小闭环 | 可信世界/设备身份；AuthService 注入契约和共享权威测试适配；首次登记、同设备核对、另一设备检测；本地 WorldRegistry 位置判定；缓存非权威 | P1 身份策略与范围获批；P2 的准入/离线资格边界明确；正式名库与字段落盘；不增加 service/sync 模块 | 两设备共享同一服务、独立本地存储；首次登记并发只有一个归属、错账号/错设备/陈旧版本/无服务拒绝；InitialWorld 未解决时明确限制；三门禁 |
| B2.4c CrossDeviceDuplicate | DuplicateWorld 处理、CopyPermission、可信完整载荷入口、七项重键、新 UUID、独立导入事务与目录追加本地发布 | b 完成；P4 的完整载体或正式受限范围批准；目标未发布回滚/日志恢复及目标新归属登记与本地发布的协调协议获批 | 无权限拒载且不改文件；有权限新 UUID/FormatTime 保留、Inherited 与未完成真实新通关各自准确；源字节与账号记录保持；发布前后故障/重复投递/恢复；不能用本机 fork 冒充跨设备 |
| B2.4d WorldMigration + RealityPause | 先全账号暂停再 Released/Claim；所有设备准入与源 Migrated；保留实例与文件；OfflineGrace、可信开机时间、SafePoint、发起设备账号绑定；本机/服务恢复 | P2 排空/时钟/切账号方案、P3 全球归属与本地提交范围/碰撞/迁回策略、P4 完整迁移载体获批；b/c 基线健康 | 同 worldId/revision/forkOrigin/FormatTime、账号记录不重造；冻结跨世界/跨窗口；服务器时间调控、离线/睡眠/重启/安全点/在途提交；同账号非 HomeDevice 可 Release；无原载荷不能恢复世界；原文件不删；全阶段故障恢复 |
| B2.4e 端到端 + 双档 Cocos | 用正式组合根与真实媒体跑完整用户链，1920×1080 / 2560×1440；两逻辑设备/存储及共享权威适配；回归旧机制 | b/c/d 验收闭合；明确是 ContractAdapter 还是另经批准的 ExternalService | 正式用户操作、真实 Complete/Restored、源/目标/账号摘要、服务状态和存储 journal、刷新/重启恢复、双档直接截图与编译/served source 证据；静态门禁另列；模拟设备/快进时钟不冒充物理双设备或真实服务器 |

若 P4 选择仅 Core 原型，则 c/e 只能声称受限复制传输原型，d 完整迁移仍阻塞；若 P1 选择排除 InitialWorld，则所有阶段都必须明确它不支持。不能在拆分表里把这些限制抹去后宣称 B2.4 完整跨设备交付。

## 遗留/待裁定事项

| 项目 | 当前结论 | 阻塞 |
|---|---|---|
| P1 旧 InitialWorld 全球实例身份 | 固定同 ID 不能区分复制/独立初始化；无自动改名 | b 的全范围、c/d 的旧初始世界 |
| P2 两套时间/旧离线资格/安全点/切账号 | 服务器时间与设备运行时间各守原义；单靠长度不等式不够 | d 及跨设备准入安全证明 |
| P3 权威 CAS 与本地目录发布 | 两存储域不能伪装同一原子点；源不写删除墓碑；目标碰撞保留 | c 的新归属与发布协调、d 的迁移/迁回/恢复 |
| P4 全 FileCarry 载体 | 共享 codec/完整个人媒体/账号加密未齐；七项不是完整文件 | c 完整携带、d 完整迁移 |
| 世界种类范围 | Primary/null 是当前正式来源；FinalShore 历史可迁移不可复制，BugShore 归档挂起 | 非 Primary 生产迁移是否纳入另提请 |
| 真实服务部署 | stage-1 排除外部服务与独立 service/sync 模块；先契约适配 | 真实认证/设备身份/部署/联网产品验收 |
| 账号事实与世界文件 | 同账号迁移继续既有 WorldClearRecord/FirstWorldCleared；CopyPermission 派生 | 不通过文件凭据补造账号事实 |
| DeviceId/凭据/密钥 | 现有骨架没有可信结构/平台能力 | P2/P4，不能 UUID 工厂冒充认证设备 |
| 本机位置载体与新增 key/锁 schema | 三 key 前缀/角色已确认；位置API/设备绑定存储/协调锁/pending guard 仍提案 | b/d 的最终契约 |

## 本轮基线门禁

| 命令 | 结果 | 证据含义 |
|---|---|---|
| npm run check:naming | exit 0；115 TS；0 ERROR / 22 WARN | 4 Window 为节奏时间窗、18 Trace 为痕/深痕业务，已人工复核；不放宽白名单 |
| npm run typecheck | exit 0；无诊断 | 当前源码类型基线健康，不含本文候选接口的生产实现 |
| npm run check:dependencies | exit 0；109 TS；约 386 依赖子句；0 ERROR | 既有矩阵与逻辑零 cc 门禁通过，不新增依赖方向 |

完整输出和命令时间见 `gate-results.json`、`check-naming.log`、`typecheck.log`、`check-dependencies.log`。本轮未运行新机制测试/Creator，双档 Cocos 是 e 的未来验收，不借用 B2.3 截图宣称本轮完成。
