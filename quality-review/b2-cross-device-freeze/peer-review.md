# B2.4a 文档交叉审稿记录

日期：2026-10-10（Asia/Shanghai）。两条独立只读审稿线，均未改生产文件。

| 审稿线 | 核对范围 | 最终结论 |
|---|---|---|
| 历史裁定/数据归属 | VERDICT-014/020/024/046/047/053/059、当前名库、归档方法签名；五份交付草案 | PASS；历史语义与受阻状态准确，无残余实质问题 |
| B2.3/事务与锁 | 七项重键/Primary 边界、目录发布、lease、迁移不写源墓碑、登记与发布双域恢复 | PASS；文档自洽，无残余实质问题 |

审稿修正已经合入：

1. 明确重键仅支持既有 Primary/null，FinalShore 不复制，BugShore 不因 Complete 自动开放。
2. 保持 Core 多项状态的既有所有权，不把世界 FormatTime/WorldLink 统归个人层。
3. FileCarry 共享层可读/认证，个人层及媒体按账号独立加密；读取与本人解密分开。
4. Migrated 原设备与普通 CrossDeviceDuplicate 分流，撤销证据继续作为 P3 前置。
5. P3 同时覆盖跨设备新 UUID 的服务登记和本地目录发布；独立导入 journal/key 待冻结，不混迁移/fork 日志。
6. 保留旧非泛型 CommitRelay 与 fetchServerTime():Promise<number>，不静默变更历史接口。

PASS 仅表示文档审稿通过，不表示 P1～P4 已获批准，不表示全量冻结完成，不构成 B2.4b 实施授权。静态门禁与保护文件 SHA256 审计分别存证，不以审稿结论替代它们。
