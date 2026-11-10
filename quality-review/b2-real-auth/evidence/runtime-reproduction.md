# B2.5b 本机 PostgreSQL 17 实库环境

本轮验收使用独立新建的 PostgreSQL 17.11 cluster，监听 `127.0.0.1:55436`。数据库为 `b25_auth`，应用角色 `b25_app` 不拥有 superuser / createdb / createrole。未安装系统服务，未复用、升级或删除任何已有数据库。

## 可复现启动与停止

在工程根运行：

```powershell
& .\quality-review\b2-real-auth\evidence\runtime\start-postgres.ps1
# 验收后停止，数据保留
& .\quality-review\b2-real-auth\evidence\runtime\stop-postgres.ps1
```

启动脚本首次使用 CSPRNG 生成本地 256-bit 密码，初始化 UTF-8 cluster 并创建独立应用角色及数据库；再次运行检查并复用本轮 cluster。默认 host/local 认证均为 SCRAM-SHA-256。只监听 loopback，不启动 Windows 服务。

运行数据库测试时由进程读取私密文件，并注入环境变量；禁止输出该 JSON、变量值或连接 URL：

```powershell
$b25PrivateConnection = Get-Content -LiteralPath '.\quality-review\b2-real-auth\evidence\runtime\.local\connection.json' -Raw | ConvertFrom-Json
$env:DATABASE_URL = $b25PrivateConnection.databaseUrl
try {
    # 在此运行 server 包的实际测试 / 迁移命令
} finally {
    Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
}
```

`runtime/.local/` 的 ACL 已关闭继承，仅当前本机用户拥有 FullControl；凭据、DB data、运行日志均在该目录。临时 initdb 密码文件与引导 SQL 在数据库创建后已移除。该私密目录、下载 ZIP 与解压二进制不进入代码 diff 或交付证据清单。

## 二进制来源与验收边界

EDB 官方 HTTPS 下载：<https://get.enterprisedb.com/postgresql/postgresql-17.11-1-windows-x64-binaries.zip>。ZIP 长度 `340719294` bytes，本地计算 SHA-256 `6eabdf00d2893713b75db4336a23c3fdf505f056e217ec6e2e95d901750cfea3`。本轮只解压 `pgsql/bin`、`pgsql/lib`、`pgsql/share` 与服务器许可证。

此摘要是本地完整性标识，未声称与第三方发布的校验值独立比对；`postgres.exe` Authenticode 状态为 `NotSigned`，不将下载来源当作硬件 attestation。精确来源、版本与监听地址分别见 `runtime-provenance.json`、`runtime-readiness.json`，应用角色权限及 DB owner 查询见 `runtime-database-facts.log`。

本机 loopback 实库验证不构成外部 HTTPS 部署、多设备物理认证、原生 OfflineGrace 或生产安全验收。

验收结束后已使用 `stop-postgres.ps1` 正常停止本轮专用 55436 cluster；数据库数据和私密连接文件保留。监听与子进程退出实测见 `runtime-lifecycle.json`；原 `runtime-readiness.json` 保留验收运行时点记录，不回写。再次复核前先运行启动脚本，随后执行 server/客户端测试命令。
