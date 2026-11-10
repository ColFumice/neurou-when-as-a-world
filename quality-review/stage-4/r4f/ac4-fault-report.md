# R4f · 边界异常报告（R4f-patch）

日期：2026-10-25  
状态：**PASS（四项 fault e2e 已执行）**；Rust OS 进程死亡只验证进程清理。

## 1. Ledger Corrupt → HUD 只读诊断

`r4f-fault.e2e.mjs`：

- 篡改 `ledger.head.json`（checksum/eventCount 不一致）。
- 进入 w1：
  - `.game-hud__ledger` 显示 `LEDGER / CORRUPT · READ ONLY`。
  - HUD warning 显示账本只读诊断。
  - 游戏正常 ready，不白屏。
- 账本文件字节未变化（`ledgerUnchanged=true`）。
- 截图：`evidence/fault-ledger-corrupt.png`。

## 2. Tauri 命令失败

- 使用 page init script 设置 `window.__R4F_FAIL_INVOKE__ = true`；`tauriInvoke.invoke` 对所有 command 返回 `E2EBackendUnavailable`（测试 seam，默认关闭）。
- 进入 w1 后：
  - 不白屏；
  - 自动 fallback 到 `fallback-w1`；
  - HUD/overlay 显示 `谱面/项目加载失败：simulated Tauri command failure...`；
  - 账本显示 `账本不可用：simulated Tauri command failure`。
- 截图：`evidence/fault-tauri-unavailable.png`。

## 3. Rust 进程死亡

- 脚本从 Node 侧 `taskkill` App 进程树。
- 进程在 2s 内消失（`processKill=true`）。
- 不承诺前端存活；窗口随 Tauri 进程关闭。验证的是进程/端口清理。
- 未验证独立 Rust sidecar（当前无 sidecar）。

## 4. 快速 /edit / 连点退出

- 真实 game command 输入 `/edit`，连续派发 20 次 Enter；最终：
  - `.editor-screen` 数量 = 1；
  - `.game-screen` 数量 = 0；
  - 只发生一次跳转，无重复 screen。
- 没有做 heap snapshot/localStorage 泄漏断言；只验证 DOM 跳转幂等。
- `rapidEdit` 证据：`evidence/fault-e2e.json`。

## 5. 纯测试

`v4/tests/r4f/fault-boundary.test.ts`（5）：

- head 缺失/malformed/checksum/count 不一致；
- 篡改 head 后 append 被拒绝，appendLine 0 次；
- traces/triggers sidecar 坏 JSON/错 chartId/重复 id 降级；
- sidecar 不破坏主谱面解析。

## 证据

- `evidence/fault-e2e.json`
- `evidence/fault-ledger-corrupt.png`
- `evidence/fault-tauri-unavailable.png`
- `logs/patch-test-v4.log`
- `logs/patch-cargo-test.log`

## 残留

- 无 heap/localStorage 泄漏量测；快速路径只验证 DOM 幂等。
- Rust 进程死亡是窗口关闭，不是“前端仍存活”场景。
- OS 级外部网络防火墙仍受权限限制，按协议接受 CDP + 代码审查。

## 结论行

Fault：**Ledger Corrupt HUD、Tauri failure fallback、进程清理、20 次 /edit 单跳转均通过；无 heap 泄漏量测。**
