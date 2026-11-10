# 隔离测试首次失败记录

`test-runs/initial` 保留第一次原始结果：聚合总计 42/43 PASS，其中 validator 41/42 PASS，runner 自身被错误纳入一个测试项。唯一失败原因是测试 fixture 的通用 `signReceipt` 时间默认顺序先选 `appendedAt`，使 WorldCommitRejection 的 receipt 早于 `rejectedAtServerEpochMs`。修正 fixture 优先选择 rejection 的事实时间后，生产拒绝规则保持原样。

首次 runner 的 `*-tests.cjs` glob 同时命中了自身 `run-tests.cjs`，其误递归运行产出的 `test-runs/final` 也作为诊断原样保留，**不是最终验收证据**。runner 已排除自身，并明确聚合本轮 evidence 与 tests 两处的测试入口。正式最终验收使用独立 `final-verified` run name，不覆盖历史结果。

修正后 `test-runs/validation-repair-1` 实测 validator 42 + codec 73，共 115/115 PASS；root reducer 测试尚未在此 run 中。后续最终报告须包含 root reducer，并核对全部生产文件在编译/测试期间 SHA 不变。

以上改动仅涉及测试 fixture/helper；未修改既有门禁或放宽生产来源、时间与签名验证。所有原始 FAIL 日志、JUnit 和 JSON 均保留。
