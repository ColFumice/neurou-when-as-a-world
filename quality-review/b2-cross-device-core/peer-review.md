# B2.4c 独立边界与代码复核

审查范围：本轮新 CoreTransfer、CoreTransferContent、CrossDeviceContractAdapter、CrossDeviceImportStorage、CrossDevicePrototype 及 WorldFolderBuilder 的追加组合。审查为代码与 ContractAdapter 契约复核；实际 Creator 双档运行、门禁和保护哈希按各自独立证据判定，本文不替代这些验收。

结论：**PASS，未发现待修的实装阻断。** 最初发现的四项实现缺口已由实现者修正，并有下面的具体验证；未编辑旧机制或正式 docs/名库。

|发现与修正|最终验证|
|---|---|
|B InitialWorld 初始化曾先取世界 lease 再取导入锁；改为 import→target→directory|prototype-contract-tests P01 验证真实组合发出的三把 namespaced 浏览器锁次序；全部释放|
|初始 Core 成功、目录写失败后不能重试；改为回读严格初态并复用原时刻|P02 目录写故障后以新的组合实例恢复；Core 原字节不变、只写一次、目录 createdAt 等于原 FormatTime|
|宿主销毁后异步资源/服务任务仍可能写或打开；新增 alive/dispose、宿主 isValid 和租约检查的 alive|P03 pending 资源销毁零写/零锁/零 factory；P05 已暂存 Core 的服务重放期间销毁，目录未发布、日志与 Core 保留；P06 打开权威请求期间销毁，真实目标 lease 释放、factory 未调用|
|已发布 revision0 只校验不可变头而接受另一份合法 Complete；初始版本增加精确计划比较|storage-contract-tests 的合法 Complete revision0 替换测试拒绝打开；更高 revision 的合法独立玩法状态仍可打开|

来源与权限边界已核查：InitialWorld 排除；同账号绑定设备端口；数据字段严格、品牌不随载荷跨设备、接收端重新 parseComplete；额外正式 chart/visual/media manifest 引用核验；CopyPermission 来自只读账号事实源而非载荷；无权限不分配目标身份；远端导入不伪造本机来源目录/lease。A 导出在真实来源 lease 与 active 目录中回读，独立适配器只复用 rebaseWorldState。

权威包装器在 publish 时核对当前 Homed/sourceDevice/版本一；同 transferId 精确 JSON 幂等，冲突不替换原值。verify 证明历史已发布载荷；director 随后鲜读当前归属以区分 Duplicate/Released/未来版本。公开 verifyAuthoritySource 要求当前 CrossDeviceDuplicate，避免 Prepared 后来源释放仍提交。ContractAdapter 为显式测试身份 seam，不宣称真实认证、物理设备或持久外部服务。

事务边界已核查：Prepared journal 持久后服务登记；同 registrationId 重放；服务 await 不持目录锁；目标真实 lease 覆盖 Core 写与发布；Core 回读、目录鲜读/CAS、目录追加是唯一本地发布点。服务成功而本地失败保留 journal/暂存；Published receipt 永久保留供准入；本地已有发布但服务不可用/缺失/冲突拒绝打开；不删发布世界伪装回滚。打开在权威 receipt/归属准入后交付持有的真实 B lease 给既有正式工厂。

组合与旧行为已核查：B 仅世界/日志存储和锁使用独立逻辑设备命名空间；账号事实读取没有复制为 payload 或 B projection。prototype 与本机 Fork 事务分开，旧 WorldForkStorage、WorldHomeRegistry、世界玩法/音频/输入驱动与编辑器代码不改；WorldFolderBuilder 仅追加面板挂载/卸载、导入 runtime factory 交接、销毁门控。逻辑零 cc，presentation 对 director 经 IntentPort type-only，Cocos/resources 只在组合根。

本审查新增验证：`prototype-contract-tests.cjs` **6/6 PASS**，`prototype-contract-results.json` 记录当次源码 SHA；`adapter-content.contract.cjs` **22/22 PASS**，覆盖精确 proof/幂等/来源账号隔离、历史 proof 与 Released/版本二分流、服务不可用、验证回调失败原子性与自洽但非正式内容拒绝。所有模拟资源、锁、存储和身份均标为 ContractAdapter，不作为真实 Creator 生产证据。

能力限制沿用本轮冻结：受限七项 Core；媒体字节由既有正式播放装配验证，不传完整个人媒体；共享内存权威销毁后不伪造恢复；迁移、RealityPause、真实服务、完整 FileCarry 与本机位置检测仍未实装。未出现新的 PROTOCOL 前置冲突。
