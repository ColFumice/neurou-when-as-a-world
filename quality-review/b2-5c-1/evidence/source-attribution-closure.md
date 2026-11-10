# B2.5c-1 外部来源归因闭合

本次独立问题：本轮 c-1 SHA 基线后，docs/NAMEBOOK.md 与 docs/spec/stage-1.md 再次被外部更新，名库内容包含 v3.17/P3 同步。请确认这次两项修改是否同样由 Trae 按“交 Trae 落盘”授权完成？此次归因独立于上轮确认；原始 SHA FAIL 将保留。

用户本次回复逐字：**确认：Trae 授权同步 v3.17/P3**。问题项 `request_user_input_async / call_3ceb5cdebb034f7dafc0ea72c3d11894 / 0`，不沿用旧 P3 回复。

c-1 原基线 `2026-10-11T04:05:40.542Z` 与 SHA `004da1c8a9f7d78e081f0d130e3401bb728d7240d581805427b1cd364a0047cb` 保留。第一次与复核的 raw protection 均为 **FAIL**，`rawHashEquality=false`；归因复核为 **闭合**，`attributionPending=false`。

| 文件 | 基线 SHA-256 | 本次归因 SHA-256 | 来源 |
|---|---|---|---|
| `docs/NAMEBOOK.md` | `cf1e686fcf56e1f05c9b897a94872da1195390694a7a31b4c1da16cea159850e` | `150978462ee718a717d46abd846a8d27556cd539e1d8bc66cad27ad8c469c619` | Trae，用户本次确认 |
| `docs/spec/stage-1.md` | `a11d5be896857a7586d59c3f9dcd6feb1e13861b1a7c279972cc968f23f25aaf` | `94c186628f23e12a18d6bb28acaa6c66caef8c6e8e43da71a8da592f661a5340` | Trae，用户本次确认 |

原始 [first FAIL](protected-first-failure.json)、[首次判定](protected-comparison.json)、[独立复核](protected-closure-recheck.json) 均保留。其余保护范围无非授权变化、无删除、无额外新增；仅五个允许的新 director 源文件及 IntentPort type-only 尾部追加。不能将此结论表述为 docs 未变或 raw PASS；后续任何新 hash 变化需要新的来源事件。
