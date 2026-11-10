# R4f · 端到端脚本报告（R4f-patch 更新）

日期：2026-10-25  
状态：**PASS（真实 Tauri CDP）**；OS 级防火墙按 PROTOCOL 接受“CDP + 代码审查”有条件通过。

## 脚本

- `v4/app/tests/e2e/r4f.e2e.mjs`
- `v4/app/tests/e2e/r4f-cdp.mjs`
- `v4/app/tests/e2e/r4f-fixtures.mjs`
- `v4/app/tests/e2e/r4f-fault.e2e.mjs`

## 主 E2E

```text
attempt 1: perfect=6 good=0 miss=0 complete=true
reopen:    perfect=6 good=0 miss=0 complete=true
ledger lines=1
ledger valid=true
ledgerAfterReopen lines=1
treeVisible=true
restored=true
externalRequests=[]
```

证据：

- `evidence/e2e-run.json`
- `evidence/e2e-completed.png`
- `evidence/e2e-success-report.json`

## 0 外部网络

- CDP Network：`externalRequests=[]`。
- 代码审查：默认 `rainEnabled=false`，AI/天气只在用户显式操作后调用；未开启 Rain/AI 的 E2E 不触发 Rust 网络命令。
- `netsh` 防火墙因无管理员权限未创建；按用户 PROTOCOL 裁定为 **有条件通过**，后续有管理员权限时可复跑。

## 运行环境

- 真实 Tauri App + WebView2 CDP，不是 Playwright。
- 项目树节点存在轻微漂移，脚本使用有限候选点；本次运行通过，属于可重跑性风险。
- 全部 fixture 在 `finally` 恢复；`restored=true`。
