﻿# B2.5c 后续待办汇总（c-2d / c-2e / c-2f / P4 / P5 / c-3）

生成：2026-10-11，由 Trae（EXECUTOR）按用户授权生成。来源：docs/NAMEBOOK.md（v3.21 附录 D 类，本轮落盘后）、docs/spec/stage-1.md（B2.5c-2c 章节，本轮落盘后）、quality-review/b2-5c-2c/delivery-report.md、quality-review/b2-5c-2c/verdicts-448-451.md。

说明：任务指定源文件 `quality-review/b2-5c-2c/stages-and-open-items.md` 不存在（GPT 本轮未产出，经用户确认用其余来源完成）；本表所有条目均可在上列实际存在来源中找到原文出处，未臆造。范围只收录名库与交付报告中标注"留 c-2d / c-2e / c-2f / P4 / P5"及"留 c-3 另议"的开放项；名库 C 类"明确排除"条目不列入。

| 未完成能力 | 归属阶段 | 依赖前置 | 备注 | 出处 |
|---|---|---|---|---|
| WorldRelayKeyDelivery / SharedCryptoAdapter / 最小生产群 key package/acceptance / producer | c-2d | c-2c 已完成并经 PROTOCOL 审阅；用户对 c-2d 正式授权 | 测试注入的完整 validator、native crypto oracle 与 fsync 文件能力不提前宣布该能力完成 | NAMEBOOK.md v3.21 D 类；delivery-report.md（命名、剩余范围与后续入场）；verdicts-448-451.md（VERDICT-451） |
| SharedRelayPrototype / SharedRelayDurableCache / 完整独立双客户端生产重放链（replay/coverage 闭环）/ 完整生产耐久 backend | c-2e | c-2d 完成；用户对 c-2e 正式授权 | 本轮新 Relay 经独立装配/验收 harness 调用，不能据此声称 c-2e 组合根已扩展 | NAMEBOOK.md v3.21 D 类；delivery-report.md；verdicts-448-451.md（VERDICT-451） |
| SharedTlsEdge / 受信 LAN HTTPS / 两台实际设备与证书边界 / 总验收 | c-2f | c-2e 完成；操作员资源（LAN 地址/SAN/CA 信任与防火墙/证书） | 本轮未实配 LAN HTTPS、云或物理双设备，只走 loopback HTTP | NAMEBOOK.md v3.21 D 类；delivery-report.md；verdicts-448-451.md（VERDICT-451） |
| 产品主链接线（产品 Builder/组合根接入 Relay 与 authority） | c-3（另议） | 用户另行授权与方案裁定 | 不含在本轮与 c-2d/e/f 授权范围内；归属以另议结论为准 | NAMEBOOK.md v3.21 A/D 类；stage-1.md B2.5c-2c 章节（不含产品主链接线）；delivery-report.md |
| 长期账号/root/key 保护恢复、完整 FileCarry/异步加密迁移 | P4 | 对应阶段裁定与操作员资源 | 保持延期；无真实 readMigrationPayload | NAMEBOOK.md v3.21 D 类；delivery-report.md |
| trusted host/TPM/attestation/物理设备/平台 OfflineGrace | P5 | 对应阶段裁定 | 保持延期；无原生 host/bootId 能力 | NAMEBOOK.md v3.21 D 类；delivery-report.md |
| 正式 world/Genesis/manifest/pins、长期 key、LAN 地址/SAN/CA 信任与防火墙 | 随 c-2f 及后续对应阶段 | 操作员资源参与 | 服务器独立函数可用于受批准本机原型；无云账号依赖；本轮只验受明确批准的临时本机开发世界 | NAMEBOOK.md v3.21 D 类 |
