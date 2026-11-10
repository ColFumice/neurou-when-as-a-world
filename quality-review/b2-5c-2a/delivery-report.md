# B2.5c-2a 冻结交付报告

日期：2026-10-11（Asia/Shanghai）。交付状态：**VERDICT-426～440与c-2接入契约冻结完成；本轮零机制实现**。P7/P8/P9已按用户本次正式答复闭合。新增内容只在quality-review/b2-5c-2a；不修改docs、名库、参照、c-1五模块、IntentPort、B2.1～B2.5b/产品核心、server或旧门禁。

## 交付索引

| 用户交付项 | 正式产物 |
|---|---|
| 正式裁定书 VERDICT-426～440 | [verdicts-426-440.md](verdicts-426-440.md)，15条逐号裁定 |
| 名库v3.19附录提案 | [namebook-v3.19-appendix-proposal.md](namebook-v3.19-appendix-proposal.md)，冻结/候选/排除分列，交Trae落盘 |
| c-2b～f子阶段/入场前置 | [stages-and-open-items.md](stages-and-open-items.md)，包括操作员公开pins、LAN证书/双设备、P4/P5/产品遗留 |
| 三门禁基线健康 | [baseline-health.md](evidence/baseline-health.md)、[原始results.json](evidence/baseline-gates/results.json)与三份日志 |
| 遗留/待裁定事项 | 阶段文档末表；P7～P9已闭合，P4/P5/长期根恢复/自动key传输/产品接线留后 |
| 精确HTTP/port实施契约 | [http-and-port-draft.md](http-and-port-draft.md)，18条路由、request/reply、错误/限流/CSRF/幂等、窄capability |
| 根pin/最小key/安全模型 | [key-delivery-and-pins.md](key-delivery-and-pins.md)，真实ECDH possession、P3包/acceptance、内存边界与未来K01～K15验收 |
| PG/clock冻结 | [storage-and-clock-contract.md](storage-and-clock-contract.md)，18表职责、002迁移、锁序、canonical原receipt、非回填 |
| 前置缺失与用户回复 | [protocol-prerequisites.md](protocol-prerequisites.md)，保留三项原问题、推荐和本次采纳来源 |
| 只读审计输入 | [port-network-audit.md](port-network-audit.md)、[clock-storage-audit.md](clock-storage-audit.md)，推荐以正式冻结包为准 |
| 独立终审 | [independent-review.md](evidence/independent-review.md)，跨nonce历史receipt wrapper与会话logout范围修正后通过 |

## 12项裁定对应

| 请求 | 裁定与实施边界 |
|---|---|
| 1 端口全部或部分 | VERDICT-427：实施两旧接口全部已有方法；world/Relay新增能力单独protocol port，不借“全部”暗增迁移/暂停/closure |
| 2 同server/PG/cookie | 429：同b实例/PG/service根/会话family；light facts与boundedcipher queue独立职责，Relay失败不阻塞Auth/admission |
| 3 LAN HTTP | 430：只精确loopback HTTP；LAN必须受信同源HTTPS edge，旧guard保持 |
| 4 根pin交付 | 431：服务/root/TLS三条信任独立；operator批准完整公开world/account/root/Genesis/manifest元组，无TOFU |
| 5 群key结构或实际 | 432：必须真实ECDH/GCM解包、commitment、HMAC+注册签名acceptance；服务无key不能验HMAC；显式内存/带外桥 |
| 6 adapter依赖 | 433：presentation适配、director纯协议、assets独立组合；presentation仅IntentPort type-only |
| 7 HTTP具体wire | 434/435 + HTTP契约：路径/字段/错误/签名/CSRF/limits/idempotence已冻结，未列扩展不得临时猜测 |
| 8 真实clock/fixture | 436：生产真实wall/mono+durable floor/generation，回退失信、不回填；fixture仅隔离测试builder，证据分列 |
| 9 PG表/迁移/事务 | 437 + storage：18表、002及新runner、global identity、uint64cursor string、旧auth锁序、commit后响应/原字节复取 |
| 10 两客户端何时 | 439：c-2e就含真实loopback两隔离principal/device/cookiejar；c-2f另验LAN真设备，不推迟到c-3 |
| 11 正式文件位置 | 433 + v3.19冻结表：真实HTTP在presentation，协议director，独立Builder在assets，server独立Node包 |
| 12 独立组合根 | 439：必须SharedRelayPrototypeBuilder及同能力harness；不接WorldFolderBuilder/SceneBuilder/UI，不扩旧RealServiceBuilder |

## 门禁与保护证据

| 检查 | 本轮实际结果 |
|---|---|
| node scripts/check-naming.js | PASS，0 ERROR / 45既有WARN；与c-1最终WARN逐条一致，增量0 |
| node scripts/check-dependencies.js | PASS，0 ERROR；127TS、437静态依赖 |
| node node_modules/typescript/bin/tsc --noEmit | PASS，exit0 |
| SHA保护终检 | PASS，7154→7154；changed/removed/added全空，[protected-comparison.json](evidence/protected-comparison.json) |

三门禁在14:27:48～14:27:50（上海）各执行一次；SHA终检14:51:35。本轮保护baseline SHA256为f01d9bebb8dcf2efcc3ee250f70f795787da1121cf113691e5576000465526bc。排除范围精确记录在保护脚本/baseline，包括本轮新目录、依赖/cache/私有key/runtime binaries；不是覆盖所有磁盘秘密或二进制。未改白名单/脚本、未清旧WARN、未回写任何历史raw FAIL。

基线时NAMEBOOK与stage-1已包含Trae执行的v3.18/c-1同步，见initial-state.json。本轮终检没有外部保护变化，因此不需要新增归因确认；此前v3.16/P3外部同步的授权与历史原始SHA记录保持。

## 本轮文件变化与验收声明

源代码diff为空；所有新增文书及可复核SHA/门禁runner证据限定本轮目录。未来文件清单是规划，不是已创建代码。没有运行新server/路由/PG迁移、Relay网络/双客户端/key交付/LAN/Cocos测试，没有新增产品UI或ObserverSync；对应测试仅为后续阶段验收计划。历史c-1 154/154结果不当本轮重跑或网络证据。

后续c-2b可以按入场表准备实施：独立真实session owner、受信TLSedge、最小AccessCode协议三项范围已获本次裁定，无需再次询问。真正进入某阶段时仍需该阶段实施授权与所列资源，当前用户只授权冻结。无云账号前置；操作员参与限于公开root/世界批准配置、publisher解锁能力及LAN origin/SAN证书/客户端trust/防火墙/真实双设备实配。
