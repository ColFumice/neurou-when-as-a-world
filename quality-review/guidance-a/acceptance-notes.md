# A 步验收脚本

运行 `node quality-review/guidance-a/acceptance.cjs`，完整结果写入同目录 `results.json`。脚本不修改 `src/`、`docs/`、名库或既有验收证据。

逻辑验收覆盖独立资源严格加载、弧长与擦除逻辑、1000ms Head 窗口、Tap 输入时刻动态取键、三档判定、媒体结束与独立异常超时、暂停恢复、退出重入、完整解谜链与 director 恰好一次记账。Head 验证生成时刻、+100ms、+999ms、+1000ms 可启动，+1000.001ms 超时；重复按下、错误键、漏敲与暂停冻结继续验收。本轮用户明确授权将原 100ms 数值改为 1000ms，冻结名称仍为 `HEAD_WINDOW_MS`。默认打击垫 48 个槽位逐一验证中心、左下角和共享横边界。

采集与帧序验收使用仅替代 `cc.Component` 和事件总线的 stub，运行真实 `InputCollector`、`FrameDriver`、`DirectorSession`：证明原始 Down / Up 时间戳及顺序、重复按下抑制、失焦释放、输入先于帧末窗口关闭。此部分不属于 Creator 引擎或视觉验收；真实 Creator 预览与两档分辨率证据由主任务另行提供。

## 本脚本消费的新增名称，待 PROTOCOL 追认

冻结名 `GuidanceChart`、`GuidanceLine`、`NodePath`、`HeadNode`、`TapNode`、`JudgmentPoint`、`GuidanceNode`、`ChartNodeKind`、`resolveGridKeyAt`、`HEAD_WINDOW_MS` 不在新增提案内。

| 新增名称 | 用途 |
| --- | --- |
| `GuidancePosition` | 归一化路径坐标只读值 |
| `parseGuidanceChart` | A 步资源严格解析、校验、复制与冻结 |
| `measurePathLength` | aspectRatio 加权弧长计算 |
| `positionAtPathDistance` | 按逻辑弧长查询路径位置 |
| `GuidanceLineRuntime` | A 步单线运行状态承载 |
| `GuidanceLineState` | Pending / Waiting / Running / TimedOut / Finished / Exited |
| `GuidanceJudgement` | 节点最终判定向 ChartPremiere 的内部输出 |
| `GuidanceNodeSnapshot` | 节点位置、判定档位与结算时刻只读视图 |
| `GuidanceLineSnapshot` | 头节点、运行进度、未擦除路径与节点只读视图 |
| `getGuidanceSnapshot` | ChartPremiereReader 新增只读接口 |
| `phase` 与 `Down` / `Up` | Strike 及 PlayerIntent.Strike 的带时间戳按键边沿；省略等同 Down |
| `bindChartMediaProbe` / `chartMediaProbe` | director 读取媒体结束及不可用状态；消费顺序位于输入之后 |

该表仅列此验收脚本实际消费的接口，不替代主任务提供的完整新增命名清单。
