# R4e.1b 变更说明 · AI HTTP / 钥匙串 / 编辑器 AI 面板 / 可预览关键帧生成

日期：2026-10-25  
状态：**PASS** · 305/305 tests；R4a~R4d 276/276；gates 0 ERROR；Rust 27/27；App 876 modules build。

范围：R4e.1b 的 X 层 Tauri AI 适配器、Rust `ai_http_request` / `secret_*`、编辑器 AI 面板、
`editor.json.ai` 持久化、`RhythmGenerationTask` 预览 → 确认 → 一条 Undo。  
不做：Rain、R4e.2、其他 AI 任务 UI、R5；不修改 R4a~R4d；不在游戏 rAF 内调用 AI。

## 1. 交付摘要

| 项 | 结果 |
|---|---|
| X 层 HTTP | `TauriAIHttp implements AIHttpPort`，调用 Rust `ai_http_request` |
| X 层钥匙串 | `TauriAIKeyStore implements AIKeyStorePort`，调用 Rust `secret_set/get/delete` |
| Rust HTTP | `reqwest`，native TLS，GET/POST，100..120000ms 超时钳制 |
| Rust 钥匙串 | `keyring` Windows native backend；service 固定 `cn.neurou.app` |
| 设置持久化 | `editor.json.ai`，仅 endpoint/model/keyRef/fallback；raw key 拒绝 |
| 面板 | Local / Cloud、endpoint/model、password key、立即清空、KEY 状态、Test、Generate |
| 生成 | 读取 v2 notes → `AITaskRoute` → `RhythmGeneration` → AI PROPOSED 预览 |
| 确认 | 一次 batch 插入 → **一条** `ChartEditUndo` 历史 |
| 取消 | 不碰轨道、不写历史、不写文件 |
| 状态 | `Unavailable → Running → Ready / Fallback`，显示 `provider / fallbackUsed / reason` |
| Secret 隔离 | 不进 `editor.json`、ledger、日志、错误消息、保存后的 DOM |

## 2. Rust 命令设计

### 2.1 `ai_http_request`

用户给出的最小签名是 `ai_http_request(endpoint, method, body, timeoutMs)`。  
Cloud 需要 `authorization` header，因此实现增加**可选** `headers` 参数：

```text
ai_http_request(
  endpoint: string,
  method: "GET" | "POST",
  body: string,
  timeout_ms: number,
  headers?: Record<string, string>
) -> {
  status: number,
  body: string,
  headers: Record<string, string>
}
```

Tauri 前端调用参数使用 camelCase：

```ts
invoke('ai_http_request', {
  endpoint: input.url,
  method: 'POST',
  body: input.body,
  timeoutMs: input.timeoutMs,
  headers: input.headers,
});
```

实现位置：

- `v4/app/src-tauri/src/commands/ai.rs`
- `v4/app/src-tauri/src/lib.rs`
- `v4/app/src-tauri/build.rs`（APP_COMMANDS）
- `v4/app/src-tauri/capabilities/default.json`（ACL）

约束：

- 只允许 `http://` / `https://`，拒绝 `file:`、空 host、控制字符和空白；
- method 只允许 GET / POST；
- timeout clamp 到 `100..120000ms`；
- `headers` 可空；`content-type: application/json` 由 Rust 统一补；
- 返回 status / body / response headers；HTTP 非 2xx 不抛异常，交给 Provider 判定；
- 网络错误只返回 `NetworkError` / 通用 message，不把 URL、body、header 或异常原文带到前端；
- **CORS**：请求由 Rust `reqwest` 发出，不经过 WebView `fetch`，因此没有浏览器 CORS preflight；
  Tauri IPC 也不需要 `Access-Control-Allow-Origin`。Local Ollama / Cloud 均按原生 HTTP 调用。

> 偏离说明：`headers` 是为 Cloud `authorization` 增加的必要扩展；没有把 Key 放进 URL 或 body。

### 2.2 `secret_*`

```text
secret_set(service, account, value) -> void
secret_get(service, account) -> string | null
secret_delete(service, account) -> void
```

- service 固定：`cn.neurou.app`
- account：`keyRef`，默认 `ai:cloud`
- backend：`keyring` 3.x + `windows-native`
- `get` 的 `NoEntry` 映射为 `null`；
- `delete` 的 `NoEntry` 视为成功；
- 其他钥匙串错误统一返回 `KeyStoreUnavailable`；
- service/account 非空、长度 <= 256、禁止控制字符；
- Rust 不打印 value；错误 message 不包含 value；
- 前端适配器不再拼接原始 Rust message，统一映射到 `key-store`。

### 2.3 Tauri ACL 注意点

仅添加 Rust `#[tauri::command]` 不够。Tauri 2 还需要：

1. `build.rs` 的 `APP_COMMANDS` 加入四个新命令；
2. `capabilities/default.json` 加入：
   - `allow-ai-http-request`
   - `allow-secret-set`
   - `allow-secret-get`
   - `allow-secret-delete`

本批自跑第一次启动时就是缺少这两处，导致 UI 显示 `KEYSTORE UNAVAILABLE`（实际命令未注册）。补齐后
`secret_get` 正常返回 `null`，UI 变为 `NOT SET`，Cloud 可选。这是本批修复的真实集成问题。

## 3. X 层适配器

### `v4/adapters/tauri/tauriAIHttp.ts`

```ts
class TauriAIHttp implements AIHttpPort {
  postJson({ url, headers, body, timeoutMs })
    -> { status, body }
}
```

- 注入 `TauriInvokeFn`，测试不触碰真实 Tauri；
- 调用 `ai_http_request`；
- 失败映射到安全 code `network` / `invalid-request`；
- 不透传 Rust message，避免 header/body 进入错误文本。

### `v4/adapters/tauri/tauriAIKeyStore.ts`

```ts
class TauriAIKeyStore implements AIKeyStorePort {
  getKey(keyRef): Promise<string | null>
  setKey(keyRef, key): Promise<void>
  deleteKey(keyRef): Promise<void>
}
```

- service 常量 `cn.neurou.app`；
- account = `keyRef`；
- 失败统一抛 code `key-store`；
- 不缓存 Key，不写日志。

## 4. `editor.json.ai` 与设置模型

`EditorWorldFile` 增加 `ai` 字段与 `setAISettings`：

```json
{
  "ai": {
    "mode": "Local",
    "localEndpoint": "http://127.0.0.1:11434",
    "localModel": "qwen2.5:7b",
    "cloudEndpoint": "https://api.openai.com/v1",
    "cloudModel": "gpt-4o-mini",
    "keyRef": "ai:cloud",
    "timeoutMs": 30000,
    "fallback": ["Local"]
  }
}
```

- `fromJson` 接受可选 `ai`；旧 editor.json 没有 `ai` 时使用默认值；
- `toJson` 写出 `ai`；
- `exactKeys` 严格拒绝未知字段，raw key 字段（例如 `apiKey`）无法混入；
- 只保存 `keyRef`；Key 本体只在系统钥匙串；
- `setAISettings` 标记 dirty，由编辑器 Save / Save AI Settings 写入 `editor.json`。

实测临时保存后检查：

```json
{"cloudEndpoint":"https://api.openai.com/v1","cloudModel":"gpt-4o-mini","fallback":["Local"],"keyRef":"ai:cloud","localEndpoint":"http://127.0.0.1:11434","localModel":"qwen2.5:7b","mode":"Local","timeoutMs":30000}
```

文件中 `apiKey` / `sk-` 扫描为 false；证据采集后已恢复 demo editor.json 原始 hash。

## 5. 编辑器 AI 面板

文件：`v4/app/src/editor/EditorAIPanel.tsx`

功能：

- Local / Cloud 模式切换；钥匙串不可用时 Cloud button disabled，Local 仍可用；
- Local / Cloud endpoint 与 model；
- API Key password input：
  - `保存到系统钥匙串` 调 `TauriAIKeyStore.setKey`；
  - 保存后立即 `setKeyInput('')`，DOM 中不再保留 Key；
  - `清除 Key` 调 `deleteKey`；
- 状态：`KEY STORED` / `NOT SET` / `KEYSTORE UNAVAILABLE`；
- `Test Connection`；
- `Generate Keyframes`；
- `Save AI Settings`；
- 状态行显示 `STATUS / PROVIDER / FALLBACK / REASON / PROPOSALS`；
- 不显示 Key、authorization、请求体。

页面入口：`EditorToolbar` 新增 `AI` 按钮，显示当前生成状态；`EditorScreen` 管理面板和生成会话。

## 6. 生成、预览、确认与 Undo

文件：

- `v4/app/src/editor/aiKeyframeGeneration.ts`
- `v4/app/src/editor/aiSettings.ts`
- `v4/app/src/editor/EditorScreen.tsx`

流程：

1. 点击 `Generate Keyframes`；
2. `file.exportV2().notes` 作为 chart v2 音符上下文；
3. prompt 要求返回：
   ```json
   {"keyframes":[{"timeMs":0,"durationMs":0,"chartLayerIndex":1,"gridCellId":null,"chartPadKind":"TopMost","chartKeyId":null}]}
   ```
4. `buildRhythmRoute` → `AITaskRoute({ RhythmGeneration: FallbackChain(...) })`；
5. Provider 返回后解析 `keyframes`；解析失败 / Template 结果则使用 v2 notes 的确定性 Template 候选；
6. 状态写为 `Ready` 或 `Fallback`，保存 `provider / fallbackUsed / reason`；
7. 预览区显示半透明虚线 `AI PROPOSED` 列表；
8. 用户点击 `Confirm`：
   - `file.addKeyframes(proposals)`；
   - 所有 proposals 一次写入；
   - `ChartEditUndo.pushBatch` 记录为**一条** batch history；
   - 不清空、不自动保存，保留 dirty；
9. 用户点击 `Cancel`：
   - 只清空 UI proposals；
   - 轨道、history、dirty、文件都不变。

### 6.1 `ChartEditUndo` batch

`v4/core/editor/history.ts` 增加内部 batch patch（不新增 A 类导出）：

```text
kind: 'batch'
before: KeyframeLocation[]
after: KeyframeLocation[]
```

`EditorWorldFile.applyPatch` 支持批量 undo/redo：

- 确认插入 6 个 keyframe：undo 删除全部 6 个，redo 恢复全部 6 个；
- 原有单 keyframe patch 行为不变；
- R3.5 的 42 个 editor 回归测试全过；
- R4a~R4d 不修改。

### 6.2 状态机

```text
Unavailable --Generate/Test--> Running
Running --provider success--> Ready
Running --fallback/Template--> Fallback
Running --error--> Unavailable(reason)
Ready/Fallback --Confirm--> Ready(reason=Applied, proposals=[])
Ready/Fallback --Cancel--> Unavailable(reason=Cancelled, proposals=[])
```

UI 上 `provider`、`fallbackUsed`、`reason` 均可见；`reason` 只来自 Provider 白名单或 UI 固定文案。

## 7. 测试

### 7.1 新增 R4e.1b 测试（14）

| 文件 | 数量 | 覆盖 |
|---|---:|---|
| `v4/tests/r4e/tauriAIHttp.test.ts` | 2 | 命令参数映射、安全错误、header/Key 不进入错误 |
| `v4/tests/r4e/tauriAIKeyStore.test.ts` | 3 | get/set/delete、service/account、Unavailable 映射、NoEntry |
| `v4/tests/r4e/aiKeyframeGeneration.test.ts` | 6 | 解析、Template、batch confirm/undo/redo、cancel、状态、settings/raw key 拒绝 |
| `v4/tests/r4e/aiPanel.test.ts` | 3 | 四状态、面板序列化无 Key/Authorization/prompt、钥匙串不可用 Cloud disabled 契约 |

### 7.2 R4e 总计

```text
R4e.1a：15
R4e.1b：14
R4e 总计：29
```

### 7.3 Rust

新增 `commands/ai.rs` 4 项、`commands/secret.rs` 1 项测试：

- endpoint 校验；
- timeout 钳制；
- header 校验；
- method 限制；
- secret service/account 校验。

`cargo test`：27 passed / 0 failed（含既有 fs/media 测试）。

## 8. 自跑结果

### 8.1 静态 / 单测 / 构建

```text
npm run typecheck:v4                 exit 0
npm run test:v4                      tests 305 / suites 68 / pass 305 / fail 0
R4a~R4d 基线单独复跑                  tests 276 / pass 276 / fail 0
npm run check:v4                     naming/dependencies/zero-engine/ledger 全部 0 ERROR
                                     totalErrors=0 allPassed=true
v4/app npm run typecheck             exit 0
v4/app npm run build                 876 modules transformed / built in 2.60s
cargo test                           27 passed / 0 failed
cargo build                          exit 0
```

证据：

- `quality-review/stage-4/r4e/r4e1b-typecheck-v4.log`
- `quality-review/stage-4/r4e/r4e1b-test-run.log`
- `quality-review/stage-4/r4e/r4e1b-baseline-276.log`
- `quality-review/stage-4/r4e/r4e1b-gates.log`
- `quality-review/stage-4/r4e/r4e1b-app-typecheck.log`
- `quality-review/stage-4/r4e/r4e1b-app-build.log`
- `quality-review/stage-4/r4e/r4e1b-cargo-test.log`
- `quality-review/stage-4/r4e/r4e1b-cargo-build.log`

### 8.2 实机 smoke（编辑器）

路径：项目树 chromato → 双击 → console `cd w1` → 游戏界面 `/edit` → 编辑器 → AI 按钮。

实测结果：

1. 首次因 ACL 未注册，面板显示 `KEYSTORE UNAVAILABLE`；补齐 `build.rs` + capabilities 后重启，
   面板显示 `NOT SET`，Cloud 可选择（证明命令与钥匙串可用）。
2. 在 password input 输入临时 dummy key，点击保存：
   - 状态变为 `KEY STORED`；
   - input value 立即变为空字符串；
   - `document.body.innerText` 不包含该 dummy key；
   - 清除后 `NOT SET`，直接读钥匙串为 `null`。
3. `Generate Keyframes`（本机没有 Local Ollama）：
   - 状态 `STATUS / FALLBACK`；
   - `PROVIDER / Template`；
   - `FALLBACK / YES`；
   - `PROPOSALS / 6`；
   - 预览区出现虚线 `AI PROPOSED` 列表。
4. `Confirm`：
   - 时间轴 keyframe DOM 从 6 → 12；
   - 编辑器 dirty = UNSAVED；
   - `Ctrl+Z` 一次后 12 → 6，证明整批只有一条 history；
   - 再次生成后 `Cancel`，keyframe 仍为 6，overlay 消失。
5. `Save AI Settings`：
   - `editor.json` 出现完整 `ai` 字段；
   - `apiKey` / `sk-` 扫描 false；
   - 检查后恢复 demo editor.json 原始 hash。

截图证据：

- `quality-review/stage-4/r4e/evidence/editor-ai-panel-keyring-not-set.png`
- `quality-review/stage-4/r4e/evidence/editor-ai-preview-fallback.png`
- `quality-review/stage-4/r4e/evidence/editor-ai-keyring-unavailable-before-acl.png`（修复前对照）

## 9. 实机验收清单（人工）

前置：Windows 能正常访问凭据管理器；`v4/app` 与 Tauri shell 已重建。

### A. 钥匙串可用

- [ ] 打开 AI 面板，状态为 `NOT SET`，Cloud 可点击；
- [ ] 输入测试 Key → 保存；
- [ ] 显示 `KEY STORED`，password input 立即清空；
- [ ] 页面文本 / DevTools DOM 中搜不到该 Key；
- [ ] 重启应用，重新打开编辑器，仍显示 `KEY STORED`；
- [ ] 清除 Key → `NOT SET`，再次打开不再自动填入。

### B. 钥匙串不可用

- [ ] 拒绝/禁用当前用户凭据管理器访问；
- [ ] 打开面板显示 `KEYSTORE UNAVAILABLE`；
- [ ] Cloud button disabled；Local 仍可选；
- [ ] Generate 仍可走 Local → Template，不崩溃、不阻塞编辑器；
- [ ] 错误文本 / 日志中没有 Key。

### C. Local / Cloud Provider

- [ ] Local endpoint/model 填 Ollama 兼容地址，Test Connection 成功；
- [ ] 生成时状态 `Ready`，provider 显示 Local；
- [ ] Cloud 填兼容 endpoint/model，保存 Cloud Key；
- [ ] Test / Generate 成功时 provider 显示 Cloud；
- [ ] 删除 Cloud Key 后再生成，显示 `Fallback` 至少一次，最终 Template 可出预览。

### D. 预览 / 确认 / Undo / 取消

- [ ] Generate 后预览区有半透明虚线 `AI PROPOSED`；
- [ ] 记录当前 keyframe 数；
- [ ] Cancel → 数量不变、无 UNSAVED、history 不增加；
- [ ] 再 Generate → Confirm → 数量增加；
- [ ] `Ctrl+Z` **一次**回到 Confirm 前数量；
- [ ] `Ctrl+Y` 一次恢复全部 AI keyframe；
- [ ] 全程不会自动播放、不会自动保存。

### E. 持久化与安全

- [ ] Save AI Settings 后 `editor.json.ai` 包含 mode/endpoint/model/keyRef/timeout/fallback；
- [ ] 文件中没有 raw key、`authorization`、`Bearer`；
- [ ] 重新打开项目，endpoint/model/keyRef 保留，Key 状态从钥匙串读取；
- [ ] ledger、`editor.json`、控制台日志搜索不到测试 Key；
- [ ] 游戏 rAF / 游戏进程不触发 AI 请求；
- [ ] 不存在 Rain / R4e.2 入口。

## 10. 关键文件

### Rust / Tauri

- `v4/app/src-tauri/Cargo.toml`（reqwest / keyring）
- `v4/app/src-tauri/Cargo.lock`
- `v4/app/src-tauri/build.rs`
- `v4/app/src-tauri/capabilities/default.json`
- `v4/app/src-tauri/src/commands/ai.rs`
- `v4/app/src-tauri/src/commands/secret.rs`
- `v4/app/src-tauri/src/commands/mod.rs`
- `v4/app/src-tauri/src/lib.rs`

### X / app

- `v4/adapters/tauri/tauriAIHttp.ts`
- `v4/adapters/tauri/tauriAIKeyStore.ts`
- `v4/app/src/editor/aiSettings.ts`
- `v4/app/src/editor/aiKeyframeGeneration.ts`
- `v4/app/src/editor/EditorAIPanel.tsx`
- `v4/app/src/editor/EditorScreen.tsx`
- `v4/app/src/editor/EditorToolbar.tsx`
- `v4/app/src/editor/editor.css`

### Core editor

- `v4/core/editor/types.ts`
- `v4/core/editor/history.ts`
- `v4/core/editor/EditorWorldFile.ts`

### Tests

- `v4/tests/r4e/tauriAIHttp.test.ts`
- `v4/tests/r4e/tauriAIKeyStore.test.ts`
- `v4/tests/r4e/aiKeyframeGeneration.test.ts`
- `v4/tests/r4e/aiPanel.test.ts`

## 11. 已知限制与说明

1. **Rust 命令 header 扩展**：用户最小签名没有 headers；为 Cloud auth 增加可选 `headers`，已在 §2.1 说明。
2. **CORS**：Rust 原生 HTTP 不经过浏览器 CORS；不需要也不能靠 `Access-Control-Allow-Origin` 解决。若未来改为 WebView fetch，才需要 CORS。
3. **Cloud 实网未打真实 Key**：本批没有可用 Cloud 凭据；Cloud 行为由 R4e.1a Provider 测试和 R4e.1b 适配器测试覆盖。
4. **本机 Local 不可用**：实机 smoke 没有 Ollama，预期走 Template；这验证了 fallback 路径，但没有验证真实 Local 模型质量。
5. **AI 状态不写盘**：`editor.json.ai` 只保存设置；`Unavailable/Running/Ready/Fallback` 与 proposals 是编辑会话 UI 状态，不写 ledger/file。
6. **`EditorWorldFile.aiGeneration`**：保留既有占位属性以兼容 R3.5 测试；R4e.1b 的生成状态由 `EditorScreen` 会话状态承载。
7. **Template 预览来自 notes**：Template 不会理解 prompt，`aiKeyframeGeneration.ts` 用 v2 notes 生成确定性候选，仍然必须用户 Confirm。
8. **响应体在 Rust 侧一次性读入内存**：已有 timeout 上限；未追加单独 body size cap。
9. **R4a~R4d 未改动**；`EditorToolbar` / `EditorScreen` / `editor.css` 是 R3.5 编辑器文件，不是 R4d 游戏链路。

## 12. 一行状态

**R4e.1b PASS：X 层 AI HTTP/钥匙串、`editor.json.ai`、AI 面板、RhythmGeneration 预览 → 单条 Undo 确认、取消无副作用、Key 不出现在文件/DOM/错误/日志；305/305 tests，R4a~R4d 276/276，gates 0，Rust 27/27。**
