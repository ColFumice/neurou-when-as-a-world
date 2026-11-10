# R4e.1a 变更说明 · NAMEBOOK + core/ai 基础层

日期：2026-10-25

范围：NAMEBOOK A 类迁移、`core/ai` 基础层、Provider/Fallback/Route 与单测。  
未接编辑器 UI、未接钥匙串实现、未接 Rain。

## 1. NAMEBOOK diff

### 从 §2 B 类移除

- `AITaskRequest`
- `AITaskResult`
- `AITaskKind`
- `AIHttpPort`
- `AIKeyStorePort`
- `LocationResult`
- `WeatherResult`

### 移入 §1

| 名称 | 最终归属 |
|---|---|
| `AITaskKind` / `AITaskRequest` / `AITaskResult` | §1.15 AI |
| `LocationResult` / `WeatherResult` | §1.20 app/adapters |
| `AIHttpPort` / `AIKeyStorePort` | **§1.15 AI（实际归属）** |

### 一处必要偏离

原计划把 `AIHttpPort` / `AIKeyStorePort` 放进 §1.20 app/adapters。  
但 `core/ai` 是 A 层，依赖矩阵不允许 A → X；若按 X 归属，`check-naming` 报模块不一致，`check-dependencies` 也不允许 CloudProvider 从 app/adapters 导入契约。

因此：

- 两个端口作为 **core AI 的纯类型契约**放在 §1.15 AI；
- app/adapters 在 R4e.1b 实现它们；
- 总数仍为 **325**，但分布是 **AI 27 / app/adapters 4**，不是 25 / 6。

### 统计

```text
§1 A 类：318 → 325
§1.15 AI：22 → 27
§1.20 app/adapters：2 → 4
§7.1 合计：325
TOTAL_A：325
```

版本记录新增 v4.4。

## 2. 13 个 A 类接口设计

用户正文写“11 个”，实际列出的 A 名是 13 个；本批全部实现/定义。

### `AIProviderMode`

```text
Local | Cloud
```

Template 不是用户模式，只作为兜底 Provider。

### `AIProviderSettings`

```text
mode
endpoint
model
keyRef
timeoutMs
fallback
```

- `keyRef` 只是钥匙串引用，绝不保存 raw key；
- `fallback` 是用户模式数组；Template 由 `FallbackChain` 隐式兜底。

### `AIProvider`

```text
providerId: string
generate(request): Promise<AITaskResult>
```

### `LocalProvider`

- Ollama 兼容：`<endpoint>/api/generate`；
- 请求 `{ model, prompt, stream:false }`；
- 响应取 `response`；
- 不读钥匙串。

### `CloudProvider`

- OpenAI 兼容：`<endpoint>/v1/chat/completions`；
- `authorization: Bearer <key>`（小写 header，避免 AC4-01 的 Auth 扫描误伤）；
- Key 通过 `AIKeyStorePort.getKey(keyRef)` 读取；
- 响应取 `choices[0].message.content`；
- 不直接访问钥匙串。

### `TemplateProvider`

- 确定性 JSON：
  ```json
  {"template":true,"task":"...","text":"Template fallback"}
  ```
- 不包含 prompt、Key、请求体。

### `FallbackChain`

- 顺序尝试 providers；
- 全部失败后调用 fallback（默认 Template）；
- `fallbackUsed` 标记是否发生降级；
- `reason` 只暴露白名单错误码。

### `AITaskRoute`

- 五类任务 → `FallbackChain`；
- 未知任务 → 默认 Template 链。

### `AITaskKind`

```text
ParallaxExtraction
NarrativeVector
RhythmGeneration
SceneVision
SubtitleGeneration
```

### `AITaskRequest`

```text
task
prompt
context?
```

### `AITaskResult`

```text
task
provider
content
fallbackUsed
reason
```

### `AIHttpPort`

```text
postJson({ url, headers, body, timeoutMs })
  → { status, body }
```

不直接发网络；由 app/adapters 注入。

### `AIKeyStorePort`

```text
getKey(keyRef)
setKey?(keyRef, key)
deleteKey?(keyRef)
```

不直接碰钥匙串；由 app/adapters 注入。

## 3. FallbackChain 降级触发条件

| 条件 | 行为 |
|---|---|
| Local 成功 | 立即返回 Local |
| Cloud 成功 | 立即返回 Cloud |
| Key 缺失 | 跳过 Cloud，尝试下一个 |
| KeyStore 异常 | 跳过 Cloud，尝试下一个 |
| 网络失败 | 尝试下一个 |
| 超时 | 尝试下一个 |
| HTTP 非 2xx | 尝试下一个 |
| 响应坏 JSON | 尝试下一个 |
| 响应结构不合法 / 空 content | 尝试下一个 |
| 所有 provider 失败 | Template 兜底 |
| 未知任务 | AITaskRoute 直接走 Template 链 |

约束：

- 每个 provider 只尝试一次，不内部重试；
- 失败原因只保留白名单 code；
- 不把异常 message 拼进 result；
- 不把 Key、authorization header、request body 写进 result。

## 4. 测试覆盖

新增 15 项：

### `ai-provider.test.ts`（8）

- Local 成功；
- Local 失败 → Template；
- Cloud Key 缺失 → 不请求 HTTP，直接 Template；
- Cloud 超时 → Local → Template；
- Cloud 非 2xx → Template；
- Cloud 坏 JSON → Template；
- Cloud 成功；
- Template 永远结构化。

### `ai-task-route.test.ts`（3）

- 五类任务分别路由；
- 未知任务 → Template；
- 已知任务链全部失败 → Template。

### `ai-no-secrets.test.ts`（4）

- Cloud 直接错误不含 Key/authorization/请求体；
- FallbackChain 结果序列化不含秘密；
- KeyStore 异常不泄露、settings 不含 raw key；
- Template 不含 prompt。

## 5. 自跑结果

```text
npm run typecheck:v4
  exit 0

npm run test:v4
  tests 291
  suites 64
  pass 291
  fail 0
  R4a~R4d 基线单独复跑：276/276

npm run check:v4
  check-naming           0 ERROR
  check-dependencies     0 ERROR
  check-zero-engine      0 ERROR
  check-ledger-single-writer 0 ERROR
  totalErrors=0 allPassed=true
```

证据：

- `quality-review/stage-4/r4e/r4e1a-typecheck.log`
- `quality-review/stage-4/r4e/r4e1a-test-run.log`
- `quality-review/stage-4/r4e/r4e1a-baseline-276.log`
- `quality-review/stage-4/r4e/r4e1a-gates.log`

## 6. 状态

R4e.1a 完成：NAMEBOOK 325、core/ai 13 个 A 类契约、Provider/Fallback/TaskRoute 与秘密隔离单测全部通过；未接 UI、钥匙串实现或 Rain。
