## 变更

- 动机：
- 变更层（core / adapters / app / Rust / docs / CI）：
- 影响范围：

## 冻结边界

- [ ] 未改 R4a.1 判定数学
- [ ] 未改 `AudioOutputClock`
- [ ] 未改 `ChartPremiereDirector`
- [ ] 未改 R4f 账本单写者
- [ ] UI 只产生 proposal，用户确认后才 apply（如适用）

## 测试

```bash
npm run typecheck:v4
npm run check:v4
npm run test:v4
npm --prefix v4/app run build
# 如涉及 Rust：
cd v4/app/src-tauri && cargo test
```

- [ ] 单元测试
- [ ] e2e（脚本名：）
- [ ] 手动路径
- [ ] 失败路径 / 回退路径

## 证据

截图、日志、Release/Pages 链接（请移除 Key 与私有媒体）。

## 版本

- [ ] 版本号 / tag / Release 说明已更新（如适用）
