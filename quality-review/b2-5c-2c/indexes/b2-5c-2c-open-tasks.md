# B2.5c-2c 待办汇总（c-2d / c-2e / c-2f / B2.5 / P4 / P5）

- 生成：2026-10-12，Trae（EXECUTOR）机械派生索引；只读源材料，未修改任何已有文件。
- 范围：只收录交付来源中标注"留 c-2d / c-2e / c-2f / B2.5 / P4 / P5"及"c-3 另议"的开放项；名库 C 类"明确排除"条目不列入。
- 未找到：`quality-review/b2-5c-2c/stages-and-open-items.md` 未找到（本阶段交付未包含该文件，经用户确认以其余来源完成并逐条标注实际出处）。

| 未完成能力 | 归属阶段 | 依赖前置 | 出处文件 |
|---|---|---|---|
| WorldRelayKeyDelivery / SharedCryptoAdapter / 最小生产群 key package/acceptance / producer（生产 key package/acceptance） | c-2d | c-2c 已完成并经 PROTOCOL 审阅；用户对 c-2d 正式授权 | NAMEBOOK.md v3.21 附录 D 类（L2012）；delivery-report.md（L119）；verdicts-448-451.md VERDICT-451（L25-29） |
| SharedRelayPrototype / SharedRelayDurableCache / 完整生产耐久 backend / 独立双客户端重放/coverage 闭环 | c-2e | c-2d 完成；用户对 c-2e 正式授权 | NAMEBOOK.md v3.21 附录 D 类（L2012）；delivery-report.md（L119）；verdicts-448-451.md VERDICT-451（L25-29） |
| SharedTlsEdge / 受信 LAN HTTPS / 两台实际设备与证书边界 / 总验收 | c-2f | c-2e 完成；操作员资源（LAN 地址/SAN/CA 信任与防火墙/证书） | NAMEBOOK.md v3.21 附录 D 类（L2012、L2014）；delivery-report.md（L119） |
| 产品主链接线（产品 Builder/组合根接入 Relay 与 authority） | c-3（另议） | 用户另行授权与方案裁定 | NAMEBOOK.md v3.21 附录 D 类（L2012"产品主链接线留 c-3 另议"）；stage-1.md §4 B2.5c-2c 范围授权 bullet（L267-269，注明不含产品主链接线）；delivery-report.md（L121） |
| 长期账号/root/key 保护恢复、完整 FileCarry/异步加密迁移（无真实 readMigrationPayload） | P4 | 对应阶段裁定与操作员资源 | NAMEBOOK.md v3.21 附录 D 类（L2014）；delivery-report.md（L121） |
| trusted host/TPM/attestation/物理设备/平台 OfflineGrace | P5 | 对应阶段裁定 | NAMEBOOK.md v3.21 附录 D 类（L2014）；delivery-report.md（L121） |
| 正式 world/Genesis/manifest/pins、长期 key、LAN 地址/SAN/CA 信任与防火墙（操作员资源依赖；本轮仅受批准本机原型） | 随 c-2f 及后续对应阶段（B2.5 阶段整体待办） | 对应阶段操作员资源参与 | NAMEBOOK.md v3.21 附录 D 类（L2014） |

## 统计

- 总计：7 条。
- 按归属阶段小计：c-2d 1 条；c-2e 1 条；c-2f 2 条（含操作员资源依赖行）；c-3（另议）1 条；P4 1 条；P5 1 条。
- 说明：docs/spec/stage-1.md 中 B2.5c-2d（占位，L280-282，"状态：待用户正式授权"）为下一阶段的授权门，不单列为能力条目，已并入各条"依赖前置"列。