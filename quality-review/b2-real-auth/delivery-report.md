# 《雨若》B2.5a裁定落地与B2.5b交付

2026-10-11（Asia/Shanghai）。P1/P2已正式闭合，本轮已在授权范围完成独立真实认证服务及本机loopback验收：Node.js24.19.0、Fastify5、PostgreSQL17.11；login/logout/verify/refresh、签名fetchServerTime、轻量账号/RegisteredCredential设备事实。真实mode逐字ExternalService，失败不切fixture。**这是b范围的实现与验收，不是c/d/e/f或完整跨设备世界主链验收。**

## 八项交付

| 用户要求 | 交付位置 |
|---|---|
| 1. VERDICT-376～390、P1～P6与b授权 | verdicts-376-390.md；protocol-closure.md |
| 2. 名库v3.16最终附录提案 | namebook-v3.16-final-appendix-proposal.md；已冻结b名称、保留端口边界、候选c/d/e分别列出，交Trae落盘 |
| 3. 修改文件清单及代码diff | evidence/changed-files.json；evidence/code.diff；下表列全部源文件，工作区非Git，以本轮SHA基线生成可审阅unified diff |
| 4. 三条门禁 | evidence/三条门禁结果.md；evidence/final-gates/results.json与原始日志 |
| 5. b契约测试 | client-tests/results-contract.json：24项PASS；客户端契约/安全结构见contracts-and-security.md |
| 6. 真实HTTP证据 | client-tests/results-contract-and-http.json：24契约+6真实HTTP/PG，共30 PASS；http-requests.json；evidence/server-test-results.json与server-contract-and-http.log：16/16 PASS |
| 7. 新增命名 | 最终附录的20个已实施公开名称、2个保留端口；内部服务名称另注；client-tests/README.md也列源码清单 |
| 8. 遗留/待裁 | stages-and-open-items.md；deferred-contract-preparation.md；contracts-and-security.md列信任与部署边界 |

## 修改文件清单

原6962个受保护文件中，唯一允许变化的是IntentPort尾部type-only导出，原字节前缀完全相同；新增3个客户端/组合根源文件。server独立清点19个新文件。0未授权修改、0未授权新增、0删除；旧core、docs、NAMEBOOK、参照、archive、旧审查/raw FAIL均保持。完整SHA清单与保护结论在evidence/changed-files.json、protected-comparison.json。

| 操作 | 文件 | 目的 |
|---|---|---|
| 仅追加type-only | src/director/IntentPort.ts | 新增真实契约窄边导出 |
| 新增 | src/director/RealServiceContracts.ts | ExternalService纯数据/异步端口；两个后续保留端口仅类型 |
| 新增 | src/presentation/RealAuthServiceAdapter.ts | HTTP、P-256持有证明、ES256 pin/nonce/身份/时限校验、明确拒绝与刷新 |
| 新增 | assets/scripts/RealServiceBuilder.ts | 独立组合根，不改旧场景/玩法/UI |
| 新增 | server/package.json、package-lock.json、tsconfig.json | 独立Node24/Fastify5/PG17包与构建 |
| 新增 | server/.gitignore、.env.example、compose.yaml、initialize-private-directory.ps1、README.md | 私密目录、参数模板、可选DB容器与本机运行说明 |
| 新增 | server/migrations/001.sql | 认证/注册设备/挑战/会话摘要/幂等轻量表与时钟sequence |
| 新增 | server/src/app.ts、cli.ts、config.ts、contracts.ts | 严格路由与边界、管理员建账号/迁移/公钥带外导出 |
| 新增 | server/src/crypto.ts、db.ts、main.ts、strict-json.ts | ES256、Argon2id/事务、独立服务入口、重复键/安全数据校验 |
| 新增 | server/test/http.test.ts、main-process.test.ts | 真PG、socket HTTP、主进程/CLI、持久性及正反例 |

本目录还新增裁定、附录、契约/安全、阶段与审查文档，以及client-tests和evidence复现脚本/无秘密结果。它们是本轮质量交付，不属于旧参照修改；运行时二进制、下载ZIP、node_modules、dist、.local与私钥不进入分享diff。未修改根package、门禁脚本、白名单或tsconfig。

## 验收结论

| 检查 | 结果 | 限度 |
|---|---|---|
| check:naming | PASS，0 ERROR/22 WARN，历史逐条差异0 | 保留历史WARN，无新白名单 |
| check:dependencies | PASS，0 ERROR；122 TS/~425依赖子句 | 仓库既有门禁，server另测 |
| typecheck | PASS，exit0，无诊断 | 根TS构建范围 |
| server独立构建 | PASS | 独立tsconfig/依赖，不进Creator树 |
| 客户端契约 | 24/24 PASS | 真ES256签验；包括验签完成后超过12秒仍拒绝、pin/nonce/purpose/schema/PhysicalDevice/OfflineGrant/畸形JSON拒绝 |
| 客户端真实HTTP/PG | 6/6 PASS | 真socket/cookie-jar，access到期拒绝后refresh恢复、登出DB撤销、服务关闭无fallback；无浏览器/Creator视觉声明 |
| server真实PG/HTTP/进程 | 16/16 PASS，0 skipped | 登录挑战/密码/幂等、刷新重用/并发/固定TTL、严格schema/CSRF/Host/Origin/限流、主进程CLI/重启持久/稳定key/clock世代 |
| SHA保护与秘密分享检查 | PASS | 本轮基线之后字节稳定与允许增量；不回写a历史FAIL |

独立复审修正了access过期后刷新材料保留、refresh撤销提交、认证事务锁顺序和账号事实复查、Windows私密目录ACL，以及验签await后的期限复查。详情见independent-review.md。当前没有新增阻断b的架构PROTOCOL。

## 运行与边界

本轮专用PG地址127.0.0.1:55436，应用角色非superuser/createdb/createrole；实库schema只含7张轻量表/43列，无世界/个人payload。真实HTTP证据包含测试端口43126和独立main临时端口，默认服务端口43125。验收结束关闭服务测试监听并停止专用PG，**保留数据和私密配置**；最终状态见evidence/runtime-lifecycle.json，重启用evidence/runtime/start-postgres.ps1，server运行顺序见server/README.md。本轮没有安装系统服务、没有修改既有DB，不需要云账号。

浏览器保证只有RegisteredCredential，私钥/CSRF仅内存，重载需重新登录；没有PhysicalDevice、OfflineGrant或应用uptime替代。签名时间依赖明确运维clock断言与跳变监测，不能声称独立NTP证明或暂停期经过。新组合根尚未挂入产品UI/旧世界主链。Relay、完整FileCarry、个人加密存储/迁移、原生host和外部HTTPS留c/d/e/f；P3/P4/P5必须在对应实施前精确补冻。正式名库v3.16由Trae按最终附录落盘，本轮未代改docs或参照。
