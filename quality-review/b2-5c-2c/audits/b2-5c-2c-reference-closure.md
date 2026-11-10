﻿# 审计报告 · c-2c 交付物文档引用闭合检查

- 生成时间：2026-10-11 12:22:58 UTC
## 0. 输入文件状态

| 输入 | 状态 | 字节 | SHA256 |
|---|---|---|---|
| quality-review/b2-5c-2c/delivery-report.md | 存在 | 17828 字节 | `5a0539215c2dadcdcd4ef854b942d7b543221e444dff1b678e1abfab637a64ad` |
| quality-review/b2-5c-2c/verdicts-448-451.md | 存在 | 4440 字节 | `5ca97670eac24d5c6c01da86f802dce404f848e0b65989da607c1dc79e553424` |
| quality-review/b2-5c-2c/namebook-v3.21-appendix-proposal.md | 存在 | 7418 字节 | `27dda96209de0ef682ab2d289765bce2d9b039c2beb33cfe6e50d0484f664a6c` |
| quality-review/b2-5c-2c/stages-and-open-items.md | 未找到 | - | - |
| quality-review/b2-5c-2c/implementation-plan.md | 存在 | 4333 字节 | `c5670099800072172a1bf9a400a6593b4d781e34f10266995dcca066adc1da1e` |
| quality-review/b2-5c-2c/protocol-prerequisites.md | 存在 | 4758 字节 | `7394d80a1ee7afa9b0941d18edf3206289fe1086d0a42e449da4b51a5071a636` |

**输入缺失清单**：
- 未找到：quality-review/b2-5c-2c/stages-and-open-items.md

## 1. 提取与解析规则

- 提取三类引用：①Markdown 链接 `[文本](路径)`；②含 `evidence/`、`quality-review/`、`docs/`、`src/`、`server/`、`assets/` 等前缀的斜杠路径字符串；③裸文件名（.md/.json/.log/.diff/.txt/.mjs/.sql/.sh）。源码 .ts 裸提及不在任务指定形态内，未纳入。路径字符类限定 ASCII（字母/数字/下划线/点/横线/斜杠），中文散文片段（如"docs/名库/参照最终字节均保持"）不作为路径捕获。
- 解析规则：以 `quality-review/`、`docs/`、`src/`、`server/`、`assets/`、`scripts/` 开头 → 仓库根相对；其余 → 相对来源文档所在目录 quality-review/b2-5c-2c/。剥离 `#` 锚点与行尾句点。
- 裸文件名分层兜底（依序尝试，命中即止，全部为机械规则并在解析列附实际路径）：①按来源目录相对解析；②按同行斜杠路径所属目录解析（如 "evidence/x/results.json、check-naming.log" 的同目录关系）；③同阶段目录（quality-review/b2-5c-2c/ 内）存在同名文件；④工作区 quality-review 之外存在同名文件（如 server/SharedBuild.mjs）；⑤同名文件仅存在于其他阶段目录 → 判悬空引用并列出位置；⑥全工作区无同名 → 判悬空引用。
- 判定：闭合（文件存在）/ 悬空引用 / 目录引用（存在）/ 目录引用（不存在）。同一 (原文,类型) 重复出现只记首现行。本报告只记录机械核对事实，不含修复建议。

## 2. 引用闭合明细

| 来源文件 | 行号 | 引用路径（原文） | 引用类型 | 判定与解析 |
|---|---|---|---|---|
| delivery-report.md | L3 | `stages-and-open-items.md` | 裸文件名 | 悬空引用（按源文件相对解析）；同名文件仅存在于其他阶段目录：D:\Project\A_New_Begin\Neurou_official\quality-review\b2-shared-contract-freeze\stages-and-open-items.md；D:\Project\A_New_Begin\Neurou_official\quality-review\b2-real-service-freeze\stages-and-open-items.md |
| delivery-report.md | L11 | `server/src/RelayStorage.ts` | 路径字符串 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\server\src\RelayStorage.ts` |
| delivery-report.md | L12 | `server/src/RelayService.ts` | 路径字符串 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\server\src\RelayService.ts` |
| delivery-report.md | L13 | `server/src/RelayRoute.ts` | 路径字符串 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\server\src\RelayRoute.ts` |
| delivery-report.md | L14 | `server/src/buildRelayServer.ts` | 路径字符串 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\server\src\buildRelayServer.ts` |
| delivery-report.md | L15 | `src/presentation/RealCommitRelayAdapter.ts` | 路径字符串 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\src\presentation\RealCommitRelayAdapter.ts` |
| delivery-report.md | L16 | `src/presentation/RealSharedServiceSessionAdapter.ts` | 路径字符串 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\src\presentation\RealSharedServiceSessionAdapter.ts` |
| delivery-report.md | L17 | `src/director/IntentPort.ts` | 路径字符串 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\src\director\IntentPort.ts` |
| delivery-report.md | L19 | `server/shared-dist/src` | 路径字符串 | 目录引用（存在）；解析：`D:\Project\A_New_Begin\Neurou_official\server\shared-dist\src` |
| delivery-report.md | L19 | `quality-review/b2-5c-2c/` | 路径字符串 | 目录引用（存在）；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\` |
| delivery-report.md | L19 | `evidence/artifact-inventory-final.json` | 路径字符串 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\evidence\artifact-inventory-final.json` |
| delivery-report.md | L21 | `evidence/source-final.diff` | Markdown 链接 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\evidence\source-final.diff` |
| delivery-report.md | L21 | `evidence/changed-files-final.json` | Markdown 链接 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\evidence\changed-files-final.json` |
| delivery-report.md | L21 | `code.diff` | 裸文件名 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\evidence\code.diff（按同行目录解析）` |
| delivery-report.md | L21 | `changed-files.json` | 裸文件名 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\evidence\changed-files.json（按同行目录解析）` |
| delivery-report.md | L51 | `evidence/validation-retention-final-lineage.json` | Markdown 链接 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\evidence\validation-retention-final-lineage.json` |
| delivery-report.md | L55 | `evidence/gate-runs/retention-final/results.json` | 路径字符串 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\evidence\gate-runs\retention-final\results.json` |
| delivery-report.md | L55 | `check-naming.log` | 裸文件名 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\evidence\gate-runs\retention-final\check-naming.log（按同行目录解析）` |
| delivery-report.md | L56 | `check-dependencies.log` | 裸文件名 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\evidence\gate-runs\retention-final\check-dependencies.log；D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\evidence\gate-runs\final\check-dependencies.log（同阶段目录内存在同名文件，共4处）` |
| delivery-report.md | L57 | `typecheck.log` | 裸文件名 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\evidence\server-build-checks\retention-final\typecheck.log；D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\evidence\server-build-checks\final\typecheck.log（同阶段目录内存在同名文件，共6处）` |
| delivery-report.md | L58 | `evidence/server-build-checks/retention-final/results.json` | 路径字符串 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\evidence\server-build-checks\retention-final\results.json` |
| delivery-report.md | L58 | `SharedBuild.mjs` | 裸文件名 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\server\SharedBuild.mjs（工作区存在同名文件，按裸名指称解析）` |
| delivery-report.md | L58 | `tsconfig.shared.json` | 裸文件名 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\server\tsconfig.shared.json（工作区存在同名文件，按裸名指称解析）` |
| delivery-report.md | L59 | `evidence/client-relay-contract/results.json` | 路径字符串 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\evidence\client-relay-contract\results.json` |
| delivery-report.md | L60 | `evidence/p10-deadline-results.json` | 路径字符串 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\evidence\p10-deadline-results.json` |
| delivery-report.md | L61 | `evidence/after-retention-fix/server-relay-results.json` | 路径字符串 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\evidence\after-retention-fix\server-relay-results.json` |
| delivery-report.md | L61 | `server-relay.log` | 裸文件名 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\evidence\after-retention-fix\server-relay.log（按同行目录解析）` |
| delivery-report.md | L62 | `evidence/after-retention-fix/server-relay-concurrency-results.json` | 路径字符串 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\evidence\after-retention-fix\server-relay-concurrency-results.json` |
| delivery-report.md | L62 | `server-relay-concurrency.log` | 裸文件名 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\evidence\after-retention-fix\server-relay-concurrency.log（按同行目录解析）` |
| delivery-report.md | L63 | `evidence/after-retention-fix/server-old-generation-retention-results.json` | 路径字符串 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\evidence\after-retention-fix\server-old-generation-retention-results.json` |
| delivery-report.md | L63 | `server-old-generation-retention.log` | 裸文件名 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\evidence\after-retention-fix\server-old-generation-retention.log（按同行目录解析）` |
| delivery-report.md | L64 | `evidence/after-retention-fix/client-real-http-results.json` | 路径字符串 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\evidence\after-retention-fix\client-real-http-results.json` |
| delivery-report.md | L64 | `client-real-http.log` | 裸文件名 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\evidence\after-retention-fix\client-real-http.log（按同行目录解析）` |
| delivery-report.md | L64 | `client-run-lineage.json` | 裸文件名 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\evidence\after-retention-fix\client-run-lineage.json（按同行目录解析）` |
| delivery-report.md | L65 | `evidence/runtime-readonly-facts.json` | 路径字符串 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\evidence\runtime-readonly-facts.json` |
| delivery-report.md | L66 | `evidence/relay-pull-metadata-inspection.json` | 路径字符串 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\evidence\relay-pull-metadata-inspection.json` |
| delivery-report.md | L70 | `evidence/after-retention-fix/runtime-stop.log` | 路径字符串 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\evidence\after-retention-fix\runtime-stop.log` |
| delivery-report.md | L89 | `evidence/history-b24/` | 路径字符串 | 目录引用（存在）；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\evidence\history-b24\` |
| delivery-report.md | L90 | `evidence/history-c1/` | 路径字符串 | 目录引用（存在）；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\evidence\history-c1\` |
| delivery-report.md | L91 | `evidence/history-b-auth/` | 路径字符串 | 目录引用（存在）；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\evidence\history-b-auth\` |
| delivery-report.md | L92 | `evidence/history-c2b-pure/` | 路径字符串 | 目录引用（存在）；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\evidence\history-c2b-pure\` |
| delivery-report.md | L93 | `evidence/history-c2b-http/verified-results.json` | 路径字符串 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\evidence\history-c2b-http\verified-results.json` |
| delivery-report.md | L95 | `results.json` | 裸文件名 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\evidence\server-relay-run-05\results.json；D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\evidence\server-relay-run-04\results.json（同阶段目录内存在同名文件，共19处）` |
| delivery-report.md | L95 | `verified-results.json` | 裸文件名 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\evidence\history-c2b-http\verified-results.json（同阶段目录内存在同名文件，共1处）` |
| delivery-report.md | L99 | `protected-final-audit.json` | Markdown 链接 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\protected-final-audit.json` |
| delivery-report.md | L99 | `evidence/intent-type-erasure-final.json` | 路径字符串 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\evidence\intent-type-erasure-final.json` |
| delivery-report.md | L105 | `evidence/delivery-report-p10-paused.md` | 路径字符串 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\evidence\delivery-report-p10-paused.md` |
| delivery-report.md | L105 | `evidence/implementation-plan-p11-paused.md` | 路径字符串 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\evidence\implementation-plan-p11-paused.md` |
| delivery-report.md | L105 | `verdicts-448-451.md` | 裸文件名 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\verdicts-448-451.md` |
| delivery-report.md | L113 | `independent-final-review.md` | Markdown 链接 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\independent-final-review.md` |
| delivery-report.md | L117 | `namebook-v3.21-appendix-proposal.md` | Markdown 链接 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\namebook-v3.21-appendix-proposal.md` |
| namebook-v3.21-appendix-proposal.md | L3 | `docs/NAMEBOOK.md` | 路径字符串 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\docs\NAMEBOOK.md` |
| namebook-v3.21-appendix-proposal.md | L3 | `docs/spec/stage-1.md` | 路径字符串 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\docs\spec\stage-1.md` |
| namebook-v3.21-appendix-proposal.md | L9 | `server/src/RelayStorage.ts` | 路径字符串 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\server\src\RelayStorage.ts` |
| namebook-v3.21-appendix-proposal.md | L10 | `server/src/RelayService.ts` | 路径字符串 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\server\src\RelayService.ts` |
| namebook-v3.21-appendix-proposal.md | L11 | `server/src/RelayRoute.ts` | 路径字符串 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\server\src\RelayRoute.ts` |
| namebook-v3.21-appendix-proposal.md | L12 | `src/presentation/RealCommitRelayAdapter.ts` | 路径字符串 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\src\presentation\RealCommitRelayAdapter.ts` |
| namebook-v3.21-appendix-proposal.md | L14 | `server/src/buildRelayServer.ts` | 路径字符串 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\server\src\buildRelayServer.ts` |
| namebook-v3.21-appendix-proposal.md | L30 | `server/.shared-kernel` | 路径字符串 | 目录引用（存在）；解析：`D:\Project\A_New_Begin\Neurou_official\server\.shared-kernel` |
| namebook-v3.21-appendix-proposal.md | L30 | `server/shared-dist/.shared-kernel` | 路径字符串 | 目录引用（存在）；解析：`D:\Project\A_New_Begin\Neurou_official\server\shared-dist\.shared-kernel` |
| namebook-v3.21-appendix-proposal.md | L30 | `SharedBuild.mjs` | 裸文件名 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\server\SharedBuild.mjs（按同行目录解析）` |
| namebook-v3.21-appendix-proposal.md | L42 | `evidence/new-names-final.json` | 路径字符串 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\evidence\new-names-final.json` |
| namebook-v3.21-appendix-proposal.md | L42 | `evidence/changed-files-final.json` | 路径字符串 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\evidence\changed-files-final.json` |
| namebook-v3.21-appendix-proposal.md | L42 | `evidence/source-final.diff` | 路径字符串 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\evidence\source-final.diff` |
| implementation-plan.md | L3 | `evidence/implementation-plan-p11-paused.md` | 路径字符串 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\evidence\implementation-plan-p11-paused.md` |
| implementation-plan.md | L3 | `evidence/implementation-plan-before-generation-retention-fix.md` | 路径字符串 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\evidence\implementation-plan-before-generation-retention-fix.md` |
| implementation-plan.md | L3 | `stages-and-open-items.md` | 裸文件名 | 悬空引用（按源文件相对解析）；同名文件仅存在于其他阶段目录：D:\Project\A_New_Begin\Neurou_official\quality-review\b2-shared-contract-freeze\stages-and-open-items.md；D:\Project\A_New_Begin\Neurou_official\quality-review\b2-real-service-freeze\stages-and-open-items.md |
| implementation-plan.md | L8 | `server/src/RelayStorage.ts` | 路径字符串 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\server\src\RelayStorage.ts` |
| implementation-plan.md | L9 | `server/src/RelayService.ts` | 路径字符串 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\server\src\RelayService.ts` |
| implementation-plan.md | L10 | `server/src/RelayRoute.ts` | 路径字符串 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\server\src\RelayRoute.ts` |
| implementation-plan.md | L11 | `server/src/buildRelayServer.ts` | 路径字符串 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\server\src\buildRelayServer.ts` |
| implementation-plan.md | L12 | `src/presentation/RealCommitRelayAdapter.ts` | 路径字符串 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\src\presentation\RealCommitRelayAdapter.ts` |
| implementation-plan.md | L14 | `quality-review/b2-5c-2c/` | 路径字符串 | 目录引用（存在）；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\` |
| implementation-plan.md | L15 | `delivery-report.md` | 裸文件名 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\delivery-report.md` |
| implementation-plan.md | L15 | `verdicts-448-451.md` | 裸文件名 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\verdicts-448-451.md` |
| implementation-plan.md | L15 | `protected-final-audit.json` | 裸文件名 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\protected-final-audit.json` |
| implementation-plan.md | L17 | `server/client` | 路径字符串 | 悬空引用；解析：`D:\Project\A_New_Begin\Neurou_official\server\client`；原文语境（L17 原样摘录）："……再做两项定向 PG 与 server/client 回归……"——路径 server\client 实际不存在 |
| implementation-plan.md | L17 | `independent-final-review.md` | 裸文件名 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\independent-final-review.md` |
| protocol-prerequisites.md | L9 | `quality-review/b2-5c-2a/http-and-port-draft.md` | 路径字符串 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2a\http-and-port-draft.md` |
| protocol-prerequisites.md | L10 | `src/presentation/RealSharedServiceSessionAdapter.ts` | 路径字符串 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\src\presentation\RealSharedServiceSessionAdapter.ts` |
| protocol-prerequisites.md | L11 | `src/director/SharedServiceProtocolContracts.ts` | 路径字符串 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\src\director\SharedServiceProtocolContracts.ts` |
| protocol-prerequisites.md | L45 | `evidence/c2b-source-stability.json` | 路径字符串 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\evidence\c2b-source-stability.json` |
| protocol-prerequisites.md | L46 | `evidence/protected-final-audit.json` | 路径字符串 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\evidence\protected-final-audit.json` |
| protocol-prerequisites.md | L48 | `implementation-plan.md` | 裸文件名 | 闭合；解析：`D:\Project\A_New_Begin\Neurou_official\quality-review\b2-5c-2c\implementation-plan.md` |

## 3. 统计

- 闭合：72
- 悬空引用：3
- 目录引用（存在）：9
- 目录引用（不存在）：0
- 跳过（URL/锚点）：0
- 输入缺失：1（未找到：quality-review/b2-5c-2c/stages-and-open-items.md）

注：同一引用在多行重复出现时只记首现行号；"按同行目录解析/工作区同名文件"为机械解析标注，原始相对路径本身未命中，供 PROTOCOL 判读。
