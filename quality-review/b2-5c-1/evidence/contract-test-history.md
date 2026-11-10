# B2.5c-1 隔离测试历史与最终证据

正式最终验收是 [final-verified](test-runs/final-verified/results.json)：**154/154 PASS**，validator 47、codec 76、replay 31，零 skip/cancel/todo。严格编译零 DOM/cc 声明、生产/测试输入前后 SHA 稳定；四个进程网络阻断尝试计数均 0。真实内存 Node ES256/P1363、AES-256-GCM、HMAC-SHA256 RFC5869 HKDF、SHA-256 后端只验证纯数据契约路径。

| 保存的运行 | 原始结果 | 说明 |
|---|---:|---|
| `initial` | 42/43 PASS，1 FAIL | 通用 fixture 的 rejection receipt 时间选择顺序错误；runner 还错误命中自身 |
| `final` | 无有效测试计数 | 由首次误递归 runner 产生的诊断；不是最终验收 |
| `validation-repair-1` | 115/115 PASS | 当时 validator 42、codec 73，尚未包含 replay |
| `replay-initial` | 140/142 PASS，2 FAIL | R14、R23 用 deepStrictEqual 比较 codec 的 null-prototype 数据与普通 fixture 对象，差异是原型；改为比较数据语义 |
| `membership-boundaries` | 152/154 PASS，2 FAIL | 新增用途隔离负测错误限定拒绝理由；R29 新构造违反自锚结构规则 |
| `final-verified` | 154/154 PASS | 全部三个 suite 最终稳定版本，source/testInputsStable=true |

`membership-boundaries` 的 signed epoch “registered signing key” 复用负测实际已经得到 `Gap`，由于 exact schema 提前拒绝，它没有走到后续 `MemberKeyPurposeConflict`；只纠正测试对拒绝理由的错误假设，拒绝规则保留。developer root/service root 复用与 ECDH 指纹错配、非 root 缺 Observer 来源四个新增负测均直接通过。

R29 测试构造曾把 Trigger 的 ID 与自身 anchor ID 同时设为冲突目标，先违反 exact schema 的禁止自锚规则，不能据此要求后续合并冲突诊断。根代理改用与原 anchor 不同的冲突 target，再测试跨类别 ID 冲突；生产 guard 未放宽。该失败也出现在本目录 `membership-boundaries` raw TAP 中；根代理另一次直接运行同一构造失败据其报告记录，不伪造额外 raw 日志。

所有历史 FAIL/TAP/JUnit/JSON 原样保留，[首次失败说明](initial-test-failure-note.md) 不回写。数据守卫修复与新增回归测试在最终运行前完成；最终 source 与 fixture/helper/tests 的 SHA 绑定在 `final-verified/results.json` 中。网络计数是被测路径证据，不能解释为 OS sandbox 或真实 Relay 测试。

来源保护另行记录：原 `protected-comparison.json` / `protected-first-failure.json` 的 raw FAIL 保留；本次用户确认 Trae 同步的两个精确 docs hash 在 [source-attribution-closure.md](source-attribution-closure.md) 独立闭合。不能把测试 PASS、三门禁 PASS、来源归因闭合与 raw SHA 相等合并成一个未注明语义的 PASS。
