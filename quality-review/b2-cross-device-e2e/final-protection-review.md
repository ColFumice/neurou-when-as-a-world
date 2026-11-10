# B2.4e 终态门禁与保护复核

终态于 2026-10-10 16:25:47～16:25:50 UTC（2026-10-11 00:25:47～00:25:50 上海时间）校验。三门禁全部 PASS：命名 0 ERROR / 22 既有 WARN；类型检查 exit 0；依赖 120 TS / 约 423 条静态依赖子句 / 0 ERROR。完整日志和结构化结果位于 final-gates/ 与 gate-results.json。

源码保护 PASS；productionFiles=[]，productionFileCount=0。643 protected 路径仍为 643，无增删。369 份冻结 canonical 原始副本完整，11 个重点生产组合/domain/storage 文件读 hash 仍匹配当前 e 基线；其他受保护源码、设置、场景及非授权参照零差异。production-code.diff 为 0 字节。该文件只表达生产源码零变化，不代替根任务对本批验收脚本与截图的单独 diff/清单。

rawHashEquality=false：两份官方 Markdown 在 e 基线后发生用户已授权的 Trae 同步，单列 authorizedDocumentChanges；unexpectedChanged/Added/Removed 均为空。NAMEBOOK 从 84,404 字节 / `27b6ae1dac6daca720382a9bc86a160034708477af61b0314836a01ea24f8bed` 变为 91,494 字节 / `7bb54b1885ba2d342afc01069f6c404ce5faab9a738c71dacfa1f489dc86641c`（mtime 16:05:53.889 UTC）；stage-1 从 53,741 字节 / `19fb77c3d9ee971d4bf2978636b2171d5de367ecf4ab3d0099b69ed1e8a2d0a9` 变为 60,206 字节 / `435196137d80fbc7dc9b68c3fb1587ad1e9b92e8cc62ca698aca205632c93496`（mtime 16:07:19.190 UTC）。官方文档变化原始文本 diff 单列 authorized-docs.diff；不以授权掩盖 hash 差异。

d 历史 raw FAIL、原始 hash 与全部历史证据保持未改。d-audit-protocol-closure.json 记录用户授权确认并闭合归因：rawHashEquality=false / protocolAttributionAccepted=true / violationResolved=true。归因来自用户确认，不伪称操作系统写入者取证。

审计脚本严格只列举现有三份官方 docs Markdown，未放宽其他文档、参照、docx、设置、schema、源码或增删保护。本代理只写本批 quality-review 证据，未改生产或官方文件。双档 Creator 端到端、契约回归与验收脚本证据由根任务另交付，静态门禁和 hash 结果不代替行为验收。
