# B2.3 验收证据逐条对应

PROTOCOL 已正式验收 B2.3；名库 v3.11 全部名称与生产装配 Implemented 已追认。protocol-acceptance.json 记录用户确认，以下原测试、门禁、截图及哈希证据保持原值。

Trae 后续已落盘 v3.11 名库附录、B2.3 授权范围及证据标签，独立记录在 post-acceptance-trae-landings.json / post-acceptance-trae.diff。accepted-delivery-results.json 保留原交付结果；accepted-protected-manifest.json 明示历史字节的来源、重建方法及准备时间。原 30/32 保护字节计数与并发两文件哈希只描述原采证时点；本回执更新不宣称重跑契约、门禁或生产验收。

契约使用实际领域类、七项验证器与存储实现，显式注入时钟/存储/锁或 Cocos 环境。生产证据从 Creator 3.8.8 的 localhost:7456 服务运行实际编译代码，用正式控件和原媒体完成；只读 DOM/组件/storage 用于观察，没有写存储、注入向量、伪造快照、改时钟或直接调用通关方法。

## 契约测试

| 用户验收项 | 实际证据 | 结果及边界 |
| --- | --- | --- |
| CopyPermission 前置 | domain-results.json；runtime-wiring.contract-results.json | 不同账号、false/损坏权限拒绝；拒绝前不调用身份/时间工厂；提交前实际重读权限 |
| 新身份分配 | domain-results.json | 新 world-UUID v4、独立 transactionId；已存在或墓碑 ID 拒绝；角色局部 ID 保留，新 account/world/character 复合身份 |
| 七项继承 round-trip | domain-results.json；inheritance.contract-results.json | 全七项精确继承、深拷贝/冻结无别名、完整认证；原 FormatTime 不变 |
| 引用 rebasing | domain-results.json | 所有七项世界 envelope、Puzzle worldId 和 SphereCrossing 入口/复合 entryId 重键；event/chain/trace/chart ID 与实际谱面资源保留 |
| 事务成功/失败 | storage.contract-results.json | 41条；实际持久写前缀重新建 adapter 模拟中断，journal/target/directory/cleanup 各阶段故障、回滚失败、quota、精确冲突保全、幂等 |
| 目标精确等于源 | runtime-wiring.contract-results.json | 实际组合根 callback；仍能 Complete 的额外合法账本事件/回忆/成绩篡改也拒绝；陈旧版本/摘要、目录文字、租约与权限拒绝 |
| 副本独立性 | domain-results.json；inheritance.contract-results.json | 修改副本不影响原数组/冻结数据；实际回忆/重玩只写目标 |
| 原世界保持 active | storage.contract-results.json；folder-regression-results.json | 分叉不删除源；原 create/delete/GC/exit 12条当前异步接线回归 |
| WorldClearRecord 不继承 | inheritance.contract-results.json | Inherited 不重演首演、不 Retry 补造记录；公开基类 retry 绕过也不能提交；重玩只更新成绩 |
| 未完成副本新通关 | domain-results.json；inheritance.contract-results.json | 已穿越未首演/未穿越来源；目标后续真实新完成可提交目标记录，失败重试可恢复；这项是契约证据 |
| 活动边界与历史缺失 | domain-results.json；既有 aggregate 回归 | 未认证/Incomplete 拒绝；活动计时/揭示/演奏仍 UnsupportedBoundary，不从旧稳定存档伪装当前状态 |
| 失败保持原状态 | storage.contract-results.json；runtime-wiring.contract-results.json | 未发表目标精确清理；源/账号从不写；已发表目标不回滚；坏/冲突字节保留 |

本批核心契约 132 PASS（领域54、事务41、继承23、实际接线14），当前文件夹/原组合根派生回归23 PASS。14组有效历史套件原文396 PASS。另4组旧阶段预期/缺环境套件原文9 PASS / 12 FAIL保留原结果，详见 domain-delivery.md 与 regression-summary.json；没有把失败算成通过，也没有改写历史测试或原验收文件。

## 生产验收

creator-preview-results.json：PASS；1920×1080 / 2560×1440 各27张、共54张未加工 PNG。creator-preview-lifecycle.json 记录预览进程 exitCode=0；源码映射、served chunk 与当前源文件一致，采证前后编译源未变。renderer/runtime/external request 都为0。

下表编号分别在两档分辨率运行，文件前缀为 `1920x1080-` 或 `2560x1440-`；每张截图的路径、PNG 原始尺寸和 SHA256 见 delivery-results.json。布局已目视复核19/20/21/25/26关键状态，未裁剪或合成。

| 用户验收项 | 截图后缀/观察 | 实际结果 |
| --- | --- | --- |
| 真实取得复制权限 | 00-new-account-created-format-time；01～04；18-copy-permission-complete-source-fork-ready | 新账号false；正式玩家选择→非零账本→球面穿越→原World媒体完整结束→FirstWorldCleared/CopyPermission true |
| 触发分叉→新世界列表 | 19-fork-committed-new-world-list-source-active | 点击真实分叉控件，一条新UUID记录；原InitialWorld仍active；journal清理完成 |
| 进入副本→七项恢复 | 20-fork-seven-sections-complete-restored-inherited-premiere | 已持久目标revision0，经原 SceneBuilder 未激活装配发布；7/7、Complete/Restored；进入不改存储字节 |
| FormatTime/局部ID/冻结资源继承 | 19/20 的严格只读存储比对 | FormatTime 与来源同值；主角/事件ID、计数、完整谱面与成绩精确继承，入口复合world ID重键 |
| 修改副本→原世界不变 | 21-fork-recall-count-changed-source-bytes-unchanged；22/23 | 副本回忆2→3，World完整重玩次数2→3；源 Core 原始字节不变；谱面冻结内容不变 |
| 原世界仍可进入 | 24-directory-fork-complete-both-worlds-active；25-original-world-restored-unchanged-after-fork-mutation | 两世界active；重入原世界回忆2、World完成次数2，源revision11与原始字节不变 |
| WorldClearRecord不继承 | 20/23/26 与账号原始字节比对 | 副本Inherited、record=null；账号仅原始一条通关记录，projection/记录均无重写 |
| 持久副本新窗口恢复 | 26-fresh-window-fork-origin-and-seven-sections-restored | 同profile/账号新BrowserWindow，副本revision2、回忆3/重玩3、origin保持；Complete/Restored无新事件/账号事实 |
| 两档一致 | resolutionComparison；两档forkAcceptance | 分叉/继承/独立性/账号事实结论一致；原始截图/viewport/GameCanvas尺寸分别为两档，无水平溢出 |
| 保留T6/T7 | 07～12 与原账本/解谜控制比对 | 原自然七秒、原60BPM拍点、原揭示/Regular媒体；T6/T7灰盒零向量、Entry/PremiereCompleted、终点防重及重复输入行为保留 |

## 三条门禁与审计

| 门禁 | 结果 |
| --- | --- |
| npm run typecheck | PASS / exit0 |
| npm run check:dependencies | PASS / 0 ERROR；109逻辑文件、约386依赖 |
| npm run check:naming | PASS / 0 ERROR / 22既有语义WARN |
| 交接基线命名脚本补充复核 | PASS / 0 ERROR / 27既有语义WARN；为 Trae 授权白名单落盘前规则的历史补充结果 |

没有新增依赖方向。既有 A/B/C/T6/T7/编辑器、账号投影/通关/七项领域核心实现按基线保留；WorldClearSession 仅联合类型增加 Inherited。本批逻辑层 cc import=0。原采证时32个保护文件中30个字节保持；另外2个是已归因的 PROTOCOL 授权 Trae spec/checker 并发落盘，原样保留并附独立 diff。原 NAMEBOOK、两份参照docx、archive、其他保护文件保持的历史结果不改写。

## 明确未以生产验收宣称的项目

未完成副本后续新首演、事务quota/中断恢复、多adapter锁竞争、BugShore/FinalShore拒绝边界仅契约验证。真实预览使用已首演的正式 Primary；Primary 的 WorldLink 合法为 NotApplicable，不把没有来源的链接伪造为 Bound。活动续演/揭示恢复、Shore新生产入口、FileCarryPayload、WorldRegistry及跨设备等均未实现。
