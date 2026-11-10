﻿﻿﻿# MANIFEST — legacy-v3.21 只读快照

- 快照时间：2026-10-18 19:52 +08:00
- 快照目的：产品级重构前置（R0）拍照存证。旧体系（名库 v3.21 / stage-1 B2.5c-2c 阶段）在重构启动前的只读基线。
- 快照方式：复制（不移动）。源文件未修改、未删除。

## 源文件（复制前）

| 源路径 | 字节数 | SHA256（复制前） |
| --- | --- | --- |
| `docs/NAMEBOOK.md` | 178559 | `398ED2E5AE2581094708FD5EDBEF958E9FCA20A3CBCCBC79F1A8CF7D9D381DAC` |
| `docs/spec/stage-1.md` | 108712 | `C4E9A3090BC96D2204E57401B57F788B448386D822ADA7EDAE6874C68AC63FCE` |

## 快照文件（复制后）

| 快照路径 | 字节数 | SHA256（复制后） |
| --- | --- | --- |
| `archive/legacy-v3.21/NAMEBOOK.md` | 178559 | `398ED2E5AE2581094708FD5EDBEF958E9FCA20A3CBCCBC79F1A8CF7D9D381DAC` |
| `archive/legacy-v3.21/stage-1.md` | 108712 | `C4E9A3090BC96D2204E57401B57F788B448386D822ADA7EDAE6874C68AC63FCE` |

## 一致性核对

- `NAMEBOOK.md`：复制前后 SHA256 一致（逐字节相同）。
- `stage-1.md`：复制前后 SHA256 一致（逐字节相同）。

## 说明

这是只读快照，不代表当前生效版本；当前生效版本仍是 `docs/` 下原文件（`docs/NAMEBOOK.md`、`docs/spec/stage-1.md`）。旧名库的最终废止需用户正式宣布；在正式宣布前，`docs/` 下原文件继续作为唯一生效口径。
