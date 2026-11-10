# B2.5a 第36批审查交付报告

2026-10-11（Asia/Shanghai）。**正式审查裁定与提案包已交付；B2.5a未全量冻结，B2.5b～f不准入实现。** 本轮发现真实服务迁移边界、共享生产载体、静态加密提交和物理平台前置，依用户明确停止规则提交PROTOCOL；没有用占位类型、fixture时间或逻辑deviceId宣称真实完成。

## 交付索引

| 要求 | 文件 | 状态 |
|---|---|---|
| 正式裁定356～375 | [裁定书](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-real-service-freeze/verdicts-356-375.md) | 20个连续编号；既有确认有效，受阻/候选不授实现权 |
| v3.16附录提案交Trae | [名库附录提案](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-real-service-freeze/namebook-v3.16-appendix-proposal.md) | 当前v3.15已落；v3.16未正式冻结/合并 |
| 接口/结构草案 | [契约草案](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-real-service-freeze/contracts-draft.md) | 真实异步端口/无payload权威/relay外壳/容器/grant候选；完整共享与个人媒体/存储补冻明确缺项 |
| 安全模型 | [安全模型](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-real-service-freeze/security-model.md) | 账号与群key分域、AES-GCM、恢复/轮换/AAD、信任/平台/服务故障边界 |
| 三条门禁 | [实测结果](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-real-service-freeze/evidence/三条门禁结果.md) | 三项exit0；命名0ERROR/22既有WARN，依赖0ERROR，typecheck无诊断 |
| b～f阶段表/遗留 | [子阶段及待裁定](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-real-service-freeze/stages-and-open-items.md) | 逐阶段入场/出场门槛与未齐契约 |
| 新冲突正式提交 | [PROTOCOL-B2.5a-001](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-real-service-freeze/PROTOCOL-B2.5a-001.md) | P1～P5架构/前置；P6两项外部报告新增来源 |
| 可执行部署方向 | [部署方案](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-real-service-freeze/deployment-plan.md) | 同服务器代码、原生/Compose、本地HTTP→LAN HTTPS；用户资源逐项列明，未部署 |
| 独立审阅 | [复核记录](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-real-service-freeze/peer-review.md) | 已修正截图原图/密钥轮换/relay关系/receipt与AAD/验签等一致性问题 |

## 13项请求映射

| 请求项 | 裁定/材料 |
|---|---|
| 1 服务部署 | 357、deployment-plan；本地真实服务与同代码容器，非云前置 |
| 2 AuthService | 358～360；保留旧签名、独立异步port、密码+旋转会话+设备挑战，无OAuth前置 |
| 3 CommitRelay | 361～362；客户端增量拉取/长轮询、有限队列、正文E2EE，服务器无存档 |
| 4 共享codec/载荷关系 | 363～364、P3；FileCarryPayload唯一完整名，七项受限Core不升级完整 |
| 5 本人媒体 | 365、P4；已处理截图/结构化谱面与成绩/实际个人视频，实字节，原图不持久 |
| 6 加密suite与安全 | 366～368、security-model；随机账号根/DEK、恢复/轮换/唯一nonce/AAD |
| 7 开机累计时长 | 369、P5；Web不应用计时降级，原生boot/uptime提案 |
| 8 SafePoint | 370、P2；历史禁止集+d真实Primary自然排空与30秒源确认 |
| 9 物理deviceId | 371、P5；Web凭据等级不等同物理机，需可信host/硬件边界裁定 |
| 10 fixture→真实多设备 | 372；重新认证/登记/CAS/保留冲突文件，不迁移fixture授权 |
| 11 保留ContractAdapter | 373、P1；独立环境，真实失败不切fixture，旧key/锁不改 |
| 12 不可用降级 | 374；无权威拒新跨设备，原生有效grant可自然排空，Web拒离线资格 |
| 13 阶段拆分 | 375、stages-and-open-items；b～f前置与证据 |

14～15的不变式与本轮边界见375；沿用INV-10/12/13、七项同主key、持lease/无锁拒绝、目录追加唯一本地发布点、RealityPause≥OfflineGrace、源主动确认、发起设备绑定、046共享可读+本人层按账号加密。无A/B/C/T6/T7/编辑器或B2.1～B2.4核心修改，无新机制实现。

## 实测与保护结论

三门禁按当前package脚本真实执行：check:naming exit0（128TS、0ERROR/22WARN）、check:dependencies exit0（120TS/约423依赖、0ERROR）、typecheck exit0（TS5.5.4、现有Creator声明/原配置）。候选Markdown不在门禁范围；这不是新服务/密码实现/完整FileCarry/物理设备/真实一小时验收。

初始保护清单6,937文件，原baseline不重建；首次新增docs/B2.4-overall-report.md，最终另外发现quality-review/B2.4-overall-report.md，终态6,939文件。原有文件changed/removed为空，raw全工作区保护比较FAIL，两项来源UnknownExternal待P6分别确认。本轮代理仅写quality-review/b2-real-service-freeze新交付目录，未写两项外部报告；不删除外部文件、不将未确认来源当Trae授权。最终比对继续使用相同初始清单，见[evidence/protected-files-comparison.json](D:/Project/A_New_Begin/Neurou_official/quality-review/b2-real-service-freeze/evidence/protected-files-comparison.json)，首次差异与完整hash另保留。

当前不是Git仓库，使用SHA-256保护证据，排除缓存/依赖及本轮交付目录的范围见环境与初始清单。没有实现测试、Creator新机制验收、外部部署或实际账号申请。后续必须先完成PROTOCOL的具体解冻裁定，不能把本交付报告当b启动授权。
