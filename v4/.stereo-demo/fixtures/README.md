# R5b.2 · 旧 e2e fixture

旧 R4f / R5a e2e 假设 8s 合成双目视频、6 个 note、8s sidecar。R5b.2 起 demo project
改用 72s theme media，因此这些旧脚本默认指向本目录的独立 fixture，不再改 demo project。

| fixture | 内容 | 用途 |
|---|---|---|
| `r4f-8s/` | 6 帧 / 8s chart、旧 8s pair（`58798dbd9bacfa2f`）、旧 audio、空 ledger | R4f / R4f-fault / R5a e2e |
| `fallback-pair/` | 同 `r4f-8s`，但 manifest `activePairId` 指向不存在的 pair；含 world/theme 底图 | R5b.2 fallback 链 / 无视频底图 |

## e2e 选择方式

- 旧 e2e 默认使用 `r4f-8s`；`NEUROU_E2E_PROJECT` 可覆盖路径。
- 启动 Vite 时 `startVite(projectRoot)` 会设置 `VITE_NEUROU_PROJECT_ROOT`，
  前端 `DEMO_PROJECT_ROOT` / `DEFAULT_EDITOR_PROJECT_ROOT` 读取该变量。
- 备份目录按 fixture 分离：`quality-review/stage-4/r4f/backup-fixture`、
  `quality-review/stage-5/r5a/backup-fixture`，不覆盖旧 demo 备份。

## 约束

- fixture 只服务测试，不是正式资产；不要删除旧 pair。
- 不修改 R4a–R5a 判定逻辑；fixture 只提供数据。
- `fallback-pair` 的 `activePairId` 是故意无效的 `ffffffffffffffff`，用于触发
  `MEDIA FALLBACK` 警告；无视频底图测试会临时重命名旧 pair 文件并在 finally 恢复。
