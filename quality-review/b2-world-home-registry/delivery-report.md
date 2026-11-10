# B2.4a 冻结完成 + B2.4b 最小闭环交付

日期：2026-10-10（Asia/Shanghai）。本轮依据用户 PROTOCOL 对 P1～P4 的正式裁定及直接实施 b 的授权。

**B2.4a 已完成冻结，B2.4b 已完成契约级最小闭环。** 旧受阻材料保留审查时点，301～310 明确覆盖其过时的停止/等待 Trae 结论。没有再次要求确认，没有进入 c/d/e 或 B2.5。

## 冻结交付

| 要求 | 文件 | 结果 |
|---|---|---|
| VERDICT-301～310 | [正式裁定](verdicts-301-310.md) | P1 初始世界排除；P2 源主动排空确认/冷静期；P3 两域+journal；P4 受限 Core；b 直接授权 |
| 名库 v3.12 附录 | [冻结附录](namebook-v3.12-frozen-appendix.md) | 历史名补登；b 公开类型/字段/方法本轮冻结；c/d 实施前细化、B2.5 全量 FileCarry 分开 |
| b/c/d/e 拆分与入场前置 | [拆分表](stages-b2.4.md) | 本轮 b 可进入；c/d/e 后续各自冻结与验收，不重复以全 FileCarry 阻断受限原型 |
| 冻结基线三门禁 | [基线结果](baseline-gates/results.json) | 全 PASS，原 115/109 TS 基线，无源码实现时运行 |

本轮没有编辑正式 docs/NAMEBOOK.md；此附录已是本次 HANDOFF/实施冻结依据，供 Trae 后续落盘，无工具发送给其他人。

## B2.4b 代码交付

| 文件 | 改动与职责 |
|---|---|
| src/director/WorldHomeRegistry.ts | 新增 strict data-only codec、固定账号/设备 session、账号索引读取/合法本地来源登记及诊断。排除 InitialWorld/未知/删除/错误目录；响应 identity/request/version/record 校验、拒绝版本回退/已知归属修改/消失。无世界写入、权限修改、平台时钟或 cc |
| src/presentation/WorldHomeContractAdapter.ts | 新增一个可共享的内存权威，bindDevice 固定两个逻辑设备身份；首次归属原子、homeRevision=1、registryRevision递增；同请求幂等，同设备 AlreadyHomed，其他设备 HomeConflict；无网络/本地存储/迁移 |
| 对应两份 .ts.meta | 新模块 Cocos 资产元数据，UUID 独立；未以此宣称 Creator 生产流程验收 |
| src/director/IntentPort.ts | 原文件字节前缀保持，只追加 type-only 转发；无新玩家意图、行为或写入能力 |

第一设备成功登记后，第二设备读取相同账号索引能看到原 HomeDevice；第二设备同世界登记得到 HomeConflict，不覆盖归属。不同账号同 worldId 各有独立归属。HomeConflict 仅索引冲突结果，b 不执行 CrossDeviceDuplicate/复制处理。

Session 在登记之前重新严格读取已有本机目录，确认当前账号非 InitialWorld 的 active 自建/分叉世界。ID 工厂只在合法来源和绑定服务检查通过后调用；一次失败保留同 session/world 的 registrationId 重试。每次读取/登记成功都来自新的已解码服务响应，服务失败不返回缓存 Homed。

适配器通过组合根注入 codec 回调和受控权威时钟；先完成 snapshot/reply 验证再发布共享 Map，错误时钟、验证故障/重入不发布归属或幂等记录。纯逻辑与 presentation 的依赖矩阵不扩方向。

## 验证结果

**34/34 契约测试 PASS，0 FAIL。** [逐项结果](contract-results.json)、[可复跑脚本](contract-tests.cjs)。使用真实 WorldFolderSession 产目录/创建元数据、共享同一 ContractAdapter 的两逻辑设备、TypeScript 内存转译，无 emit。

覆盖内容包括：并发首次登记唯一/不覆盖、同设备重复与原请求幂等、账号/设备隔离、InitialWorld 零调用排除、未知/删除/错账号/坏目录、服务 unavailable/端口缺失、稳定重试 ID、严格对象/稠密数组/访问器不执行/符号与未知字段拒绝、状态/身份/安全整数、恶意响应不污染观察、版本回退/已知归属改变或消失、同版本新增归属拒绝、深冻结独立对象，以及时钟/验证回调/重入的失败原子性。

| 实现后门禁 | 退出码 | 实际结果 |
|---|---|---|
| npm run check:naming | 0 | 117 TS，0 ERROR / 22 WARN |
| npm run typecheck | 0 | 无诊断 |
| npm run check:dependencies | 0 | 111 TS，约 388 条依赖子句，0 ERROR |

[最终门禁结果](gate-results.json) 保留完整三日志与运行时间；北京时间约 21:34:33～21:34:35。22 条 WARN 与基线逐条一致：4 Window 是节奏判定时间窗，18 Trace 是痕/深痕业务，无新增告警，未改白名单。门禁不替代契约测试；契约测试也不代表实际 Cocos 或真实服务验收。

## 核心保护证据

[保护审计](protected-final-audit.json) 以 SHA256 比较 587 个原路径，最终 595 路径（包含 junction 别名）。未删除文件，无意外新增或改动。唯一已有文件改动为 IntentPort 及其 junction 别名；**剥离新增 type 导出后，原字节前缀 SHA256 与基线完全一致**。

新增两个源码及两个 meta，对应四个实体文件、八个含别名路径。其余 B2.1/B2.2/B2.3、A/B/C/T6/T7/编辑器核心、docs、名库、两 docx/两 logo/历史 jsonl、archive 参照和工程配置保持原 SHA256。src 逻辑零 cc 依赖门禁通过。无 Git 仓库，报告使用哈希清单而非虚构 git diff。

只读架构/代码交叉审查已 PASS；修正的版本容量与目录 trim 校验有对应回归测试。测试源摘要和最终源码摘要已核对一致。

## 能力边界与下一阶段

本轮能力是**共享内存 ContractAdapter 下的账号归属契约**：不存在真实登录、物理设备认证、网络服务、持久服务端或生产 UI/世界加载准入接线。共享适配实例销毁后内存索引消失；这不是持久化账号服务承诺。没有写三个新 localStorage key，也没有改变旧世界 lease/目录提交或账号记录。

WorldRegistry 本机位置检测、CrossDeviceDuplicate 处理、受限七项传输、WorldMigration、RealityPause、SafePoint 运行协议、账号切换强制、完整 FileCarry 均未实现。本轮不从解析 HomeState.Released 就宣称具有释放/认领机制。

P1～P4 现已闭合，未发现新的架构阻断。c/d 仍须在其实施阶段细化线格式、导入/迁移 journal、源主动确认与持续暂停、账号绑定、碰撞/迁回等具体契约；这些不重新阻断已完成的 b。本轮已授权工作到此交付完成。
