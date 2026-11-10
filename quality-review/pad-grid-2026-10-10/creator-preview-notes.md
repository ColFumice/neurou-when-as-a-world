# 全屏网格与邻键容错 Creator 预览证据

最终预览通过：Cocos Creator 3.8.8，localhost:7456；1920×1080 / 2560×1440，DPR=1。真实 inner/canvas/CSS/PNG 均为对应分辨率；每档 11 张截图、8 项检查全部通过，共 22 张截图。rendererErrors=0。

真实 layoutVersion=pad-layout-2；逻辑布局与 ChartPadView 的槽位数据完全一致。47 个可见槽位由 13/13/11/10 键四行组成，每行占 25% 高、铺满全宽，无空隙，无 Space 槽位或 label。13 键行每格宽 1/13，11 键行宽 1/11，10 键行宽 1/10。所有 47 个 label 的位置都经归一化坐标与容器尺寸校验。

所有节点输入刻意使用与目标不同、且边或角直接接触的邻键：Drag 目标 S 按 A；Hold 目标 F 按 R；Tap 目标 U 按数字 5，目标 P 按数字 8，后两者为真实矩形角接触。每档退出/重入两次入口，共记录 8 条邻键节点输入。每次演奏均 P4/G0/M0、400 分。暂停 350ms 前后媒体时间、路径及视觉快照完全一致；中途退出账本 0，重入清状态，10 秒全部节点已决仍 Playing/账本0，12 秒真实媒体结束返回世界，账本恰好追加一次。

1920×1080 rVFC 样本 610，输出时钟与媒体呈现时间最大原始误差 18.176ms；2560×1440 样本 581，最大原始误差 19.668ms。均满足既有≤30ms门槛。

预览动作经真实 DOM KeyboardEvent → Cocos 输入源 → InputCollector → FrameDriver → director。入口仅设置既有 T6 endpointSettled=true 夹具，不替换节点/分数/媒体时钟；本轮没有宣称重新完成无夹具真实 T6 长链。采集在场景就绪后调用 cc.profiler.hideStats，仅隐藏遮住 Z/X 的引擎 debug 统计覆盖，不改变产品源码或玩法。

采集前后确认 6 个最终编译目标：SceneBuilder / GuidanceLineRuntime / LineEraseEffect / GuidanceChart / KeyboardPadLayout / ChartPadView。实际 HTTP served chunk 与 Creator 磁盘编译产物 SHA256 相同；包含 pad-layout-2、isMatchingGridKey、hasHeldGridKey、rebuildSlotLabels 等新版 marker；采集前后源码与 chunk hash 不变。

主要证据：creator-preview-results.json、creator-compilation.json、creator-preview.cjs。可复现：使用已有 node_modules/electron/dist/electron.exe 运行 creator-preview.cjs，当前项目 Creator 预览服务须运行。

历史排障已独立留存：initial-cache-failure.json 是刷新前的旧布局缓存，不计最终结果；profiler-early-call-failure.json 是采集夹具过早调用 hideStats，不是 renderer 玩法错误，已移动到场景就绪后；preview-with-profiler-results.json 是首次成功但统计覆盖挡住部分标签的结果。最终清晰截图与 creator-preview-results.json 对应。
