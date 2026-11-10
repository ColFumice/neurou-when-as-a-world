# Stereo3DDemoScreen 变更说明（白皮书 GLSL 视差版）

- 日期：2026-10-23（Asia/Shanghai）
- 状态：**已按白皮书改为 GLSL 分层视频视差 + 绿色角色占位 + WASD 惯性控制，待用户确认**
- 范围：临时 Demo + 测试素材 + Demo 读取通道；不进入 R3.5c 编辑器

---

## 1. 白皮书对应关系

白皮书：

> 视差渲染：将视频分层后，在 GLSL 中根据相机位移参数，让前景以比背景更快的速度偏移 UV 坐标，产生物理遮挡感。
>
> 二次元角色绑定：Live2D/Spine 角色置于屏幕中心。（暂时用绿色矩形表示）

本 Demo 的落地：

| 白皮书 | Demo |
|---|---|
| 视频分层 | left.mp4 = 背景层；right.mp4 = 前景层 |
| GLSL 相机位移 | `uCamera`，A/D 或 ←/→ |
| 前景比背景快 | 背景 UV ×0.035；前景 UV ×0.120（约 3.4×） |
| 物理遮挡 | 前景白方块在绿色角色之后绘制，会遮住绿色矩形 |
| 角色中心 | 全屏 shader 中央绿色矩形，固定屏幕坐标，可缩放 |
| 角色缩放 | S/↓ 放大，W/↑ 缩小；`uCharacterScale` |
| 加速 | Shift 提高目标速度与线性加速度 |
| 惯性 | 速度按固定斜率线性加速/减速，松开后滑行至停 |
| 音频 | `audio.wav` 双声道；左 440Hz、右 660Hz |

> 上一版的 side-by-side 双眼模式已移除。它不是白皮书描述的 UV 分层视差。

---

## 2. 渲染管线

- `Stereo3DDemoScreen` 内嵌 WebGL2 全屏 quad；
- 两个 `<video>` 作为纹理源：
  - background texture：网格/地平线场景；
  - foreground texture：黑底白色 160×160 方块；
- 每帧 `texImage2D` 上传视频帧；
- 片元着色器：
  1. `bgUv = vUv + uCamera * 0.035`
  2. 采样背景
  3. 绘制中央绿色矩形（外深绿边 + 内绿色），尺寸乘 `uCharacterScale`
  4. `fgUv = vUv + uCamera * 0.120`
  5. 采样前景，按 `max(r,g,b)` 做黑底透明 mask
  6. 前景覆盖绿色角色 → 物理遮挡
- 视频通过 `media_read_file` 读取为字节，再转 `blob:` URL，避免 WebGL 读取 asset protocol 跨源视频纹理时受 CORS 限制。

### 相机 / 角色 / 惯性

- **A/D 或 ←/→**：相机水平移动，clamp [-1, 1]；
- **W/↑**：角色缩小；**S/↓**：角色放大；clamp [0.55, 2.2]；
- **Shift**：目标速度 ×2、加速度也提高；
- 速度不是按键瞬间置位，而是每帧按固定斜率逼近目标：
  - 加速：`v += accel * dt`；
  - 松开/反向：`v -= accel * dt`（线性衰减到 0，再反向）；
  - 位置：`x += v * dt`；
  - 到达边界时速度归零。
- 相机和角色缩放各自有独立速度/惯性；
- `Reset motion` 同时复位相机与角色缩放；
- HUD 显示 `CAM x.xx` 与 `ZOOM x.xx`。

### 背景/前景素材

```text
left.mp4  = 背景：深蓝网格、地平线、两条横向亮线；440Hz
right.mp4 = 前景：纯黑 + 白色 160×160 方块；660Hz
```

前景位置 x=420（源像素）；相机负方向时白方块向右移动更快，会扫过中央绿色矩形并遮住它。

---

## 3. 实际导入输出

已执行 `importStereo`：

```text
v4/.stereo-demo/project/media/stereo/58798dbd9bacfa2f/left.mp4
v4/.stereo-demo/project/media/stereo/58798dbd9bacfa2f/right.mp4
v4/.stereo-demo/project/media/stereo/58798dbd9bacfa2f/audio.wav
```

manifest pair：

```json
{
  "stereoPairId": "58798dbd9bacfa2f",
  "leftAssetId": "a9ce96b1a85adabe",
  "rightAssetId": "e739def2e5ec8917",
  "audioAssetId": "37ec4eef4d7b55b4"
}
```

---

## 4. 入口与使用

```powershell
cd v4/app
npm run tauri dev
```

> 本次新增了 `media_read_file` command/permission 与 GLSL 渲染；如果 Tauri 已经在跑，**需要重启 `npm run tauri dev`**（Vite HMR 不足以注册新 command/权限）。

1. 右上角 **Stereo3D Demo**；
2. 点击 **Import layers**：
   - 打开 project root；
   - `importStereo` 返回/复用 pair；
   - `media_read_file` 读背景/前景字节 → blob URL；
   - `audio.wav` 走 asset protocol；
3. 点击 **Play (Space)**；面板自动收起；
4. 移动：
   - **A/D 或 ←/→**：相机水平移动；
   - **S/↓**：绿色角色放大；**W/↑**：绿色角色缩小；
   - **Shift**：加速；
   - 松开后速度线性衰减，产生惯性滑行；
5. 观察：
   - 背景网格慢速横移；
   - 前景白方块快速横移；
   - **按 A 让白方块向右扫过绿色矩形**，产生遮挡；
   - 绿色矩形保持在屏幕中心，仅 W/S 改变尺寸；
6. 耳机左 440Hz / 右 660Hz；
7. **Hide panel / Show panel** 切换控制面板。

---

## 5. 验证结果

```text
cd v4/app && npm run build
tsc --noEmit exit 0
tsc -p tsconfig.node.json exit 0
vite v7.3.7
✓ 792 modules transformed
✓ built in 2.32s

npm run verify:v4
typecheck:v4 exit 0
四门禁 totalErrors=0
tests 116 / pass 116 / fail 0

cargo test
22 passed; 0 failed
```

说明：

- GLSL 已用 Edge headless WebGL2 做编译验证：`SHADER_OK`；
- 未在无头环境做主观遮挡判断；
- 绿色矩形/UV 偏移/遮挡关系可由用户按第 4 节直接确认；
- 视频纹理走 blob，已避免 asset protocol CORS 的不确定性。

---

## 6. SHA256

| 文件 | 字节 | SHA256 |
|---|---:|---|
| `v4/app/src/screens/Stereo3DDemoScreen.tsx` | 23,588 | `c08040a32ef5b108eecf5e4322925fc863361177c8e42b1e52d527f17cc3d7e2` |
| `v4/app/src/screens/stereo3d-demo.css` | 6,412 | `8b3c2dbb8a9617890640e12fa5fb752fc1ce44193180d8b629b49d046d05122c` |
| `v4/app/scripts/prepare-stereo-demo.ps1` | 1,928 | `fe5aef47d34837b835a5ac3f1ca6720fc357d0d00467d368818682b6e4935897` |
| `v4/app/src/App.tsx` | 18,873 | `18a7e2a565a78d7442033e5c26c624c94110652b33872c75a41e6ff56238f9ee` |
| `v4/app/src/app.css` | 23,940 | `706691e2cbc19831b7ab9034a89a32f52b01a9befd31cc182cc62754c952425a` |
| `v4/app/vite.config.ts` | 1,374 | `34e3c11e4b0491739ede6577eed2d54d0ba67d405beef7cc64f57946dfb0f5b3` |
| `v4/app/src-tauri/tauri.conf.json` | 911 | `2fc1631f666d5ea562d9bb77eb346671f487cc320440ee601ea34a46211cf9ba` |
| `v4/app/src-tauri/Cargo.toml` | 502 | `8802586cc0ea2a8f3bb4dca71a4773c0963e8b3f604f782bdbeb7c448b6f18af` |
| `v4/app/src-tauri/Cargo.lock` | 104,579 | `b4592a3b699bfce25e33607e1b04b28904b87aab1f2d7a7ca6fe4eed2775032b` |
| `v4/adapters/tauri/TauriProjectIo.ts` | 2,668 | `6f210120320ed671c928735e1a2bf88c1f75d4e1e1fe758ccaf1d024f053ab3a` |
| `v4/adapters/tauri/tauri-core.d.ts` | 317 | `a99e7a4407a82316b2b41ae1eb8df0e2583cc9672693067e4cc3cd416f7c8f5a` |
| `v4/adapters/tauri/TauriMediaImporter.ts` | 3,519 | `e01ce5d3f91292a77f374f81a776d6e0e4df91bc7b9b999ff0e5a1ea4eb26309` |
| `v4/tests/r3/tauri-media-importer.test.ts` | 6,782 | `81ebecb230050564fb189168f49368bda31fa1e22d8c951c76a3eb88ba506c28` |
| `src/commands/media/mod.rs` | 15,239 | `f0efbd1ff28588b500ad795c4035c70a00118a8d4c42f9c6428c3ef6ddf8a7c8` |
| `src/lib.rs` | 1,662 | `ced59054691a4d2acc6f682c4db57d933dd393c2d8c06899b1e4d3f962e6182b` |
| `build.rs` | 887 | `bf6822fa26f149b038d65fc3f5cec9f9a2bfb5611f054d936339eea4094217aa` |
| `capabilities/default.json` | 979 | `a61f8aef6f2201006f93eb7da063ff4b2ce69cc6dbd1b70374e4f15b528f56e1` |
| `gen/schemas/acl-manifests.json` | 77,343 | `9b21486db67df79f4a092e9711a92d825781201658fd54721182c031f6ff7d7f` |
| `gen/schemas/capabilities.json` | 807 | `e0ce1ea963499f7c6345e3fd8376d0c5587f0f712a9c2e8c7627398191f1611d` |
| `gen/schemas/desktop-schema.json` | 132,432 | `64422b931ff0b94160225696f68a0b46fd52a95e08f7484213f5572d40e46d3d` |
| `gen/schemas/windows-schema.json` | 132,432 | `64422b931ff0b94160225696f68a0b46fd52a95e08f7484213f5572d40e46d3d` |

---

## 7. 已知边界

1. 这是 **pseudo-3D / parallax**，不是双目立体 3D；符合白皮书“视频分层 UV 视差”描述。
2. 角色是 shader 绿色矩形，不是 Live2D/Spine；绑定留后续。
3. 背景/前景是测试素材；真实世界可替换为同分辨率、同时长的两层视频。
4. 前景黑底透明是 `max(r,g,b)` 阈值 mask；真实前景若需要 alpha，应改用 alpha 视频/深度遮罩。
5. `media_read_file` 是 Demo 读取通道：只允许 `media/` 相对路径，上限 256 MiB；R3.5c 不得把它当通用文件 API。
6. `assetProtocol.scope=["**"]` 仍是 Demo 临时范围；R3.5c 必须收窄。
7. 未进入 R3.5c；不包含编辑器 UI/轨道/Inspector。

---

## 8. 一句话状态

**已按白皮书改为 GLSL 背景/前景 UV 视差 + 绿色角色占位 + WASD/方向键/Shift 线性惯性控制；等待用户确认遮挡与惯性手感后，再开始 R3.5c。**
