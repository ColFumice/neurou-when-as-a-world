# 前次测试尝试

这里保留修复前的失败记录，不能作为最终运行结果。

- runtime-error：前次资源导入、媒体准备或场景销毁阶段的失败诊断；问题经修复及 Creator 重新导入后复测。
- sync-attempt-before-display-timestamp：同步口径修正前的测量，曾使用帧回调派发时刻或重复延迟补偿。
- sync-error：前次测试残留的诊断输出。

最终结果见上级目录的 runtime-results.json（11/11）、regression-results.json（24/24）和 sync-results.json（两档媒体均在 30ms 内）。浏览器测试 profile 归档于上级目录 test-browser-profiles，不在 Creator temp 中。
