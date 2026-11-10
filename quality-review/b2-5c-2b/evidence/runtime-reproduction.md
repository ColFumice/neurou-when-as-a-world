# c-2b 本机 PostgreSQL17 独立测试环境

本轮复用此前下载的 EDB PostgreSQL17.11 可执行二进制，只读旧二进制目录。新建集群数据、凭据、日志均位于 `quality-review/b2-5c-2b/evidence/runtime/.local/`，只监听 `127.0.0.1:55437`。没有复用、升级或删除旧 `b25_auth` 集群数据，也未安装 Windows 服务。

专用应用角色 `c2b_app` 没有 superuser、createdb 或 createrole。`c2b_authority` 用于新共享权威测试；`c2b_history_auth` 用于旧 b 回归，避免并发测试改动同一数据库。两者密码只保存在 ACL 关闭继承、当前操作员可读的私密 connection.json，不进入交付日志。

独立复审对本轮尚未发布的 002 迁移补上持久来源 IP 预算时，初次开发测试库已保存旧 002 checksum，因此另创建全新 `c2b_authority_final`，通过私密 `connection-final.json` 运行定稿迁移与最终测试。旧测试库及旧 checksum ledger 全部保留，不改 ledger、不吞 checksum 漂移；这不是已有生产数据库升级。创建事实见 `runtime-final-database.json`。

真实生产客户端 Builder/Authority adapter 的 HTTP 验收另外使用全新 `c2b_client_authority`，通过私密 `connection-client.json` 读取相同限权应用角色连接。它与服务器最终测试 DB 隔离，以免 clock/clock-floor/限流/故障注入用例影响客户端生产时钟证据；创建事实见 `runtime-client-database.json`。

从工程根启动与停止：

```powershell
& .\quality-review\b2-5c-2b\evidence\start-postgres.ps1
& .\quality-review\b2-5c-2b\evidence\stop-postgres.ps1
```

停止保留数据。启动/停止脚本只使用固定本轮路径；后台 native 启动使用 Hidden Start-Process。首次启动的 setup shell 因 Windows 子进程输出句柄继承停滞，已仅停止该 setup shell；PG 数据与服务保持，新脚本通过 pg_ctl 状态检查继续完成引导。原空日志保留，完成日志为 runtime-start-completed.log。

调用新 server 测试时只进程读取私密 `databaseUrl`；旧 b 历史回归脚本读取 `historyDatabaseUrl`。脚本 redacts 已知密码和 URL，禁止打印 connection JSON、环境变量值或秘钥。原 b 与 c-1 测试的全部输出独立重定向本轮目录。

这套环境只提供本机 loopback + PG 实库开发验收，不替代生产操作员世界/root/Genesis/manifest 公共 pins 的实配，也不提供 LAN TLS、真实物理设备或 OfflineGrant 验收。
