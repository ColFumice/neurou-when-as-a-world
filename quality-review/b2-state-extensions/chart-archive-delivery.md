# ChartArchive 分项交付

本文件是 B2.2d-2 实现与契约证据，未修改共享 docs、名库或参照文件。

实现位于 `src/director/ChartArchive.ts`，逻辑层零 cc、DOM、存储及网络访问。`preparePremiere` / `prepareReplay` 只返回独立深冻结候选；外层单 key 事务负责落盘成功后发布。没有加入完整首演、退出或重演状态机的额外写入。

首演快照保存实际 ChartData / GuidanceChart、47 槽完整 KeyboardPadLayout、实际视觉节点 RGB、稳定媒体身份及原始字节 SHA256 / 长度、当次 guideTransparency、合法完成账本引用与冻结时间。`contentDigest` 是上述实际内容及透明度的规范 JSON SHA256。Final 谱面仅允许 FinalShore 并标记 FinalShorePersonal。

成绩 schemaVersion=1、scoringVersion=1，保存最高/最近真实完整演奏、完成次数及全部已完成 playId。最高分并列保留更早最佳，最近结果始终更新；退出结果与重复 playId 拒绝。重演不产生账本向量、不改变首演快照、不写账号通关事实。

结构校验拒绝未知字段、访问器、异原型、稀疏数组、循环、非有限数、无效布局/视觉/媒体、错误归属与引用、成绩计数/计分/关联不一致。旧 ChartData 的错误槽位 Miss 不消费 Note，故合法计数可超过 Note 数；GuidanceChart 仍严格等于节点数。

`validateSnapshots(raw, ledger, requireCompleteReferences=false)` 与 `validateScores(raw, snapshots, ledger, requireCompleteReferences=false)` 默认仅校验现有记录，允许诚实 partial。Full 调用必须传 true；历史缺实际内容或成绩明确拒绝，不用当前资源补历史，不填零分。旧精确零向量 T7 的缺失仍是完整性义务，已有快照另须实际冻结 Regular 身份；旧 T6 仅为入口。

发布清单位于 `assets/resources/chart/content-manifest.json`。`parseChartContentManifest` 严格解析 source / media / charts，媒体字节由组合根实际验证。`chart-manifest.cjs` 从 6 个真实发布资源与实际 SceneBuilder fallback 函数导出 7 个谱面身份，记录 2 个主媒体真实字节摘要。LegacyFallback 身份单独标识，既有 Regular 不改 tier。空视觉节点仅表示实际无覆盖色时的默认呈现规则。

验收命令：

- `node quality-review/b2-state-extensions/chart.contract.cjs`：24 / 24 PASS，机器结果 `chart-contract-results.json`，全部明确为 ContractTest。
- `node quality-review/b2-state-extensions/chart-manifest.cjs --check`：PASS。
- `npm run typecheck`：PASS。
- `npm run check:dependencies`：0 ERROR。
- `npm run check:naming`：0 ERROR，27 条现存判定窗口 / 痕域语义 WARN。

本分项没有生产预览声明。两档 Cocos、真实媒体字节验证、实际首演/重演/事务/恢复证据由组合根整体验收提供。FinalShore 没有生产内容流，其证据仅为严格归属契约测试。

新增公开命名：ChartArchive、ChartArchiveContext、ChartMediaIdentity、ChartVisualSnapshot、ChartContentManifest、ChartSnapshotRecord、ChartSnapshotCollection、ChartScorePlay、ChartScoreRecord、ChartScoreSnapshot、ChartArchiveCandidate、ChartPremiereArchiveInput、ChartReplayArchiveInput、parseChartContentManifest、chartContentDigest。
