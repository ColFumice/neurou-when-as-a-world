# B2.4d 存储与保护范围收尾复核

复核对象：冻结原始源码、当前四处授权组合/type 修改、六个新模块、迁移存储与准入接线。此文件是存储实施者的收尾复核；不冒称另一独立作者完成的评审。未发现尚未处理的存储实现阻断。

源 Prepared 先持久保存完整载荷；只有生产 SafePointDrainStorage 签发的当前能力经服务受理后才 Release。源恢复读取服务状态和精确载荷，失去当前排空能力且服务尚无 Release 时保持 Pending。源 Core、目录、账号事实均无迁移写路径；源未结算 journal 的组合准入 guard 阻止继续活动改变冻结载荷。

目标先验证当前权威载荷及本机同 ID 碰撞，再 Claim。服务 await 位于目录锁外；Claimed 日志先于 Core 与目录写入。新 Core 通过真实目标 lease、严格 Complete/正式引用验证及 expected-null CAS 保存原 revision；既有完全一致 Core/目录允许原值认领，不同进展、不同记录或墓碑先于 Claim 拒绝。目录追加是新目标的唯一本地发布点。journal/Core/目录原子写后抛异常以回读确认；已发布目标不删除。每次打开检查鲜读准入与当前 HomeRecord，旧 Claim receipt 无法回退归属。

异步服务读与最终 Core/目录提交之间新增同步权威准入复查，生产组合确有接线。RealityPauseBoundary 只筛选新活动输入，既有演奏、回映、揭示、计时及账号通关结算仍沿用既有时钟/算法自然完成；组合根据真实 Complete 与已结算事实退出活动。旧 Fork/Registry/CoreTransfer/ImportStorage 算法文件均未变化。三个组合文件存在授权 hook/routing 调整，完整原始行不变并非本轮声明，具体修改见 code.diff。

Storage ContractAdapter 最新 **34/34 PASS**；真实原型组合 ContractAdapter 最新 **12/12 PASS**。MS27 的旧 33/34 失败来自测试在 authority 冻结 bindings 后仍替换 bindings.serviceNow，实际服务闭包时钟未推进；已改为测试 fixture 的显式 advanceServiceBy，并保留 storage-pre-clock-seam-diagnostic.json。修复没有修改 production。三门禁 PASS；Creator 结果由根任务最后一次实际预览产物单独裁定，不能以这些组合契约代替生产验收。

**完整 protected 审计为 FAIL；授权源码范围为 PASS，二者不能合并。** 固定基线有 621 路径、354 份 canonical 原始源码副本，最终增加 22 个含 junction alias 的路径。审计确认其余 472 个核心路径、16 个既有跨设备核心路径、19 个 settings/scenes 路径保持原 SHA；IntentPort 保留标准化旧前缀，只追加精确 type exports。allowlist 未放宽，基线未改。

基线于 **2026-10-10 14:17:27.060 UTC** 捕获。docs/NAMEBOOK.md 当前 mtime 为 **14:18:07.552 UTC**，SHA 从 `da90bf96378770299fc95a94b61ccb838a074e7e584658fae1384320b1a1b9df` 变为 `27b6ae1dac6daca720382a9bc86a160034708477af61b0314836a01ea24f8bed`；docs/spec/stage-1.md 当前 mtime 为 **14:18:08.029 UTC**，SHA 从 `b8420ec8735ec8dcec51bdffd82af4c7d485c2a982a4acf755d9242ca96d3aa6` 变为 `19fb77c3d9ee971d4bf2978636b2171d5de367ecf4ab3d0099b69ed1e8a2d0a9`。这些当前 SHA 与最终 manifest 相符。

可验证内容：NAMEBOOK 第 1186 行开始是 v3.13 / VERDICT-311～325 / B2.4c 附录；stage-1 第 27、197、695～722 行列出 c 范围与验收，d 仍被列为后续/须冻结。内容与 c 同步相符。团队未执行 docs 写入；**现有证据不能证明写入者是 Trae，也不能证明全部文档变化只有 c 落盘**。mtime 不能作为可信作者来源，基线未保存 .md 原文，故无法生成完整旧文档文本 diff。详细观测与限制见 observed-doc-drift.json。保留当前外部变化及 full protected FAIL，不回滚、不改 allowlist、不把未知 provenance 宣称已验证。
