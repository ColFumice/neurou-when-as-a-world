# B2.5b 证据索引

本轮在 Node 24.19.0 / Fastify 5 / PostgreSQL 17.11 独立本机环境完成验收。数据库 `b25_auth` 与应用角色 `b25_app` 真实存在，验收期间监听 `127.0.0.1:55436`；角色不是 superuser / createdb / createrole。验收结束后已停止本轮专用 PostgreSQL，保留数据库与私密配置，重启脚本为 `runtime/start-postgres.ps1`。

| 证据 | 结论 |
| --- | --- |
| `final-gates/results.json`、`三条门禁结果.md` | 三条门禁 PASS；22 条命名 WARN 与 B2.5a 完全相同 |
| `server-test-results.json`、`server-contract-and-http.log` | 独立构建 PASS；16/16 实库 + HTTP + 主进程/CLI 测试 PASS，0 skipped |
| `../client-tests/results-contract-and-http.json`、`../client-tests/http-requests.json` | 客户端最终独立 24 项契约 + 6 项实际 HTTP/PG 测试 PASS；包含真实验签成功后跨期限拒绝回归，修复后重新实测HTTP |
| `protected-baseline.json`、`protected-comparison.json` | 原 6962 文件字节保护 PASS；仅授权 IntentPort type-only 尾追加，0 未授权修改/新增/删除 |
| `changed-files.json`、`code.diff` | 1 授权已有文件追加、3 新生产文件、19 新 server 包文件；每项带 SHA-256 或完整新文件 diff |
| `runtime-provenance.json`、`runtime-readiness.json`、`runtime-database-facts.log` | 官方 EDB PostgreSQL 17.11 HTTPS portable 来源、计算摘要、loopback/ACL 与角色权限 |
| `database-schema-boundary.log` | 实库查询 7 张表 / 43 列，限定认证/注册凭据/挑战/幂等轻量事实；无 WorldCommit/Core/FileCarry payload 表 |
| `server-private-acl.json` | server/.local 关闭ACL继承，仅当前用户、SYSTEM、Administrators 完全控制 |
| `runtime-lifecycle.json` | 验收后 PostgreSQL 正常停机；55436 / 客户端测试43126 / 默认HTTP43125无监听，匹配的服务与测试Node子进程为零；保留数据与配置 |
| `shareable-and-warning-audit.json` | 可分享 diff/清单/日志没有本轮 DB URL、两份私密 DB 密码或真实私钥 PEM；WARN 差异为零 |
| `pre-expiry-review/` | 末轮客户端期限修复前的点时门禁、SHA/diff/audit与第一次停机记录，保留原PASS范围 |

server 测试直接执行 package `npm test` 的构建与 Node test 步骤，避免宿主 PATH 的 Node 歧义。可复现命令：

```powershell
& 'C:\Program Files\nodejs\node.exe' .\quality-review\b2-real-auth\evidence\run-server-tests.cjs
& .\quality-review\b2-real-auth\evidence\runtime\audit-database.ps1
& 'C:\Program Files\nodejs\node.exe' .\quality-review\b2-real-auth\evidence\source-diff.cjs
```

`runtime/.local/`、`server/.local/`、私钥、下载 ZIP、解压二进制、node_modules 与 dist 是本机私密/临时运行资料，不作为可分享源码或验收材料。来自 EDB 的 ZIP 摘要仅为本地完整性标识；`postgres.exe` 未签署 Authenticode，不声称独立发布校验或物理 attestation。

B2.5a 的历史 raw FAIL 保持原状。Trae 两份阶段报告的归因由本轮用户裁定闭合；本轮新增 baseline 已包含这两份文件，未回写旧 raw 记录。
