# B2.5c-2b 历史回归证据

日期：2026-10-11。所有历史测试用例在本轮独立证据目录执行；旧报告与旧测试脚本不回写。当前五份 c-1 内核和旧 b 核心不改。

| 组 | 结果 | 实施方式 | 本轮证据 |
|---|---|---|---|
| B2.4e b/c/d 历史契约 | 227 / 227 PASS | 旧 runner 副本只替换工作区 root 锚；原九套用例/断言在当前源上执行；ContractAdapter/逻辑设备 | history-b24/final/results.json、contract-regression-results.json |
| B2.5c-1 canonical/validator/reducer | 154 / 154 PASS | 测试/fixture/no-network 文件精确字节副本；五份当前源独立 ES2020/no-DOM 编译到本轮；新旧编译 JS SHA 一致 | history-c1/final/results.json、junit.xml |
| B2.5b server auth | 16 / 16 PASS | 原两份 TypeScript 测试及旧 b 源显式 file list 独立编译；真实 loopback HTTP + PG17 新专用 history DB | history-b-auth/final/results.json、old-server-http.log |
| B2.5b client auth | 30 / 30 PASS（24 契约 + 6 真实 HTTP） | 原 runner 副本只替换 root 与独立 server build 路径；旧 RealAuthServiceAdapter 源不改；真实 TCP cookie jar | history-b-auth/final/client/results-contract-and-http.json、http-requests.json |

总计 **427 / 427 PASS**。c-1 网络阻断统计为 0，测试不是 OS sandbox。旧 b 使用真实 PG17.11 与 Node24.19.0，私密连接文件只进程读，不输出 URL / 密码 / key / CSRF / Cookie。

这些结果证明历史契约与旧认证基线健康；不将它们计作新 authority 实施测试、实际生产服务验收、Relay、c-2d 群 key producer、双客户端、LAN HTTPS、PhysicalDevice 或 OfflineGrant。
