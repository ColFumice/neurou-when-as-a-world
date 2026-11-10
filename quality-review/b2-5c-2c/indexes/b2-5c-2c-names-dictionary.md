# B2.5c-2c 新增命名词典

- 源：`quality-review/b2-5c-2c/evidence/new-names-final.json`（generatedUtc=2026-10-11T10:11:05.671Z；5 份新增实施 TS）。
- 声明统计：声明 420 处 / 唯一名称 217 个 / 顶层声明 27 / 公开导出 8。
- 生成：2026-10-12，Trae（EXECUTOR）机械派生索引；只读源材料，未修改任何已有文件。
- 排序：名称字典序（忽略大小写的序数排序），便于查询。
- 类别口径：公开类型=导出顶层类/接口/类型别名；公开方法=导出顶层函数；常量=顶层变量绑定；私有成员=类/接口成员与非导出顶层声明；局部变量=函数内变量/参数/类型参数绑定。域字面量与资源 ID：源 JSON 未包含该类条目（计数 0），未推测补入。
- 不计入本词典：P10 已批准 session 局部修正的两处局部绑定（requestLimitMs、maximumWaitMs，scope=request，非顶层非导出）与 IntentPort type-only 语句引用的三个既有 c-1 名（SharedCommitValidator、ValidatedSharedCommit、SharedValidationResult）。源 JSON excluded 口径：Imports；Pre-existing source declarations except explicit P10 local delta；Generated copies；Test/harness declarations；IntentPort type-only re-export references。
- 用途摘要：8 个公开名为交付报告职责描述（出处见摘要内行号），其余为按 kind/scope/归属文件的机械派生描述，不替代源码语义。

| 名称 | 类别 | 归属文件 | 位置（行号） | 用途摘要 |
|---|---|---|---|---|
| _request | 局部变量 | server/src/RelayRoute.ts | server/src/RelayRoute.ts L26 | 局部参数绑定（server/src/RelayRoute.ts） |
| a | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L30、L225 | 局部参数绑定（server/src/RelayService.ts） |
| account_id | 私有成员 | server/src/RelayStorage.ts | server/src/RelayStorage.ts L16 | RelayStoredCommit 内属性签名（server/src/RelayStorage.ts） |
| acknowledge | 私有成员 | server/src/RelayService.ts；src/presentation/RealCommitRelayAdapter.ts | server/src/RelayService.ts L302；src/presentation/RealCommitRelayAdapter.ts L80 | RelayService 内方法（server/src/RelayService.ts） |
| action | 局部变量 | server/src/RelayStorage.ts | server/src/RelayStorage.ts L31 | 局部参数绑定（server/src/RelayStorage.ts） |
| admission | 局部变量 | server/src/RelayService.ts；src/presentation/RealCommitRelayAdapter.ts | server/src/RelayService.ts L186；src/presentation/RealCommitRelayAdapter.ts L38 | 局部变量绑定（server/src/RelayService.ts） |
| admitted_at | 私有成员 | server/src/RelayStorage.ts | server/src/RelayStorage.ts L21 | RelayStoredCommit 内属性签名（server/src/RelayStorage.ts） |
| admittedAt | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L218 | 局部变量绑定（server/src/RelayService.ts） |
| advancePosition | 私有成员 | src/presentation/RealCommitRelayAdapter.ts | src/presentation/RealCommitRelayAdapter.ts L197 | <module> 内函数（src/presentation/RealCommitRelayAdapter.ts） |
| after | 局部变量 | server/src/RelayService.ts；src/presentation/RealCommitRelayAdapter.ts | server/src/RelayService.ts L235；src/presentation/RealCommitRelayAdapter.ts L51 | 局部变量绑定（server/src/RelayService.ts） |
| anchor | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L194 | 局部变量绑定（server/src/RelayService.ts） |
| app | 局部变量 | server/src/RelayRoute.ts；server/src/buildRelayServer.ts | server/src/RelayRoute.ts L24；server/src/buildRelayServer.ts L28 | 局部参数绑定（server/src/RelayRoute.ts） |
| assertCurrent | 私有成员 | src/presentation/RealCommitRelayAdapter.ts | src/presentation/RealCommitRelayAdapter.ts L167 | RealCommitRelayAdapter 内方法（src/presentation/RealCommitRelayAdapter.ts） |
| author_sequence | 私有成员 | server/src/RelayStorage.ts | server/src/RelayStorage.ts L17 | RelayStoredCommit 内属性签名（server/src/RelayStorage.ts） |
| authorAccountId | 私有成员 | server/src/RelayService.ts | server/src/RelayService.ts L24 | RelayPullResultMemory 内属性签名（server/src/RelayService.ts） |
| authority | 局部变量 | server/src/buildRelayServer.ts | server/src/buildRelayServer.ts L32 | 局部变量绑定（server/src/buildRelayServer.ts） |
| authorization | 私有成员 | server/src/RelayService.ts | server/src/RelayService.ts L153、L155 | RelayService 内方法（server/src/RelayService.ts） |
| authorSequence | 私有成员 | server/src/RelayService.ts | server/src/RelayService.ts L24 | RelayPullResultMemory 内属性签名（server/src/RelayService.ts） |
| authSigner | 局部变量 | server/src/buildRelayServer.ts | server/src/buildRelayServer.ts L15、L20、L24 | 局部参数绑定（server/src/buildRelayServer.ts） |
| b | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L30、L225 | 局部参数绑定（server/src/RelayService.ts） |
| batch | 局部变量 | server/src/RelayService.ts；src/presentation/RealCommitRelayAdapter.ts | server/src/RelayService.ts L95、L261；src/presentation/RealCommitRelayAdapter.ts L59 | 局部变量绑定（server/src/RelayService.ts） |
| binary | 局部变量 | src/presentation/RealCommitRelayAdapter.ts | src/presentation/RealCommitRelayAdapter.ts L209 | 局部变量绑定（src/presentation/RealCommitRelayAdapter.ts） |
| binding | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L170 | 局部变量绑定（server/src/RelayService.ts） |
| bindings | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L191 | 局部变量绑定（server/src/RelayService.ts） |
| Body | 私有成员 | server/src/RelayRoute.ts | server/src/RelayRoute.ts L42 | relayRoutes 内属性签名（server/src/RelayRoute.ts） |
| bodyLimit | 局部变量 | server/src/RelayRoute.ts | server/src/RelayRoute.ts L41 | 局部变量绑定（server/src/RelayRoute.ts） |
| build | 私有成员 | server/src/buildRelayServer.ts | server/src/buildRelayServer.ts L24 | <module> 内函数（server/src/buildRelayServer.ts） |
| buildIsolatedRelayServer | 公开方法 | server/src/buildRelayServer.ts | server/src/buildRelayServer.ts L20 | 服务器 Relay 装配函数：显式隔离 clock 测试入口（delivery-report.md L14） |
| buildRelayServer | 公开方法 | server/src/buildRelayServer.ts | server/src/buildRelayServer.ts L15 | 服务器 Relay 装配函数：真实 clock 入口，单 clock 组合（delivery-report.md L14） |
| byte | 局部变量 | src/presentation/RealCommitRelayAdapter.ts | src/presentation/RealCommitRelayAdapter.ts L222 | 局部变量绑定（src/presentation/RealCommitRelayAdapter.ts） |
| bytes | 私有成员 | server/src/RelayStorage.ts；server/src/RelayService.ts；src/presentation/RealCommitRelayAdapter.ts | server/src/RelayStorage.ts L81；server/src/RelayService.ts L18、L31、L133、L163、L270；src/presentation/RealCommitRelayAdapter.ts L210、L219 | RelayStorage 内方法（server/src/RelayStorage.ts） |
| c | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L180 | 局部参数绑定（server/src/RelayService.ts） |
| cache | 局部变量 | src/presentation/RealCommitRelayAdapter.ts | src/presentation/RealCommitRelayAdapter.ts L23 | 局部参数绑定（src/presentation/RealCommitRelayAdapter.ts） |
| candidate | 局部变量 | server/src/RelayService.ts；src/presentation/RealCommitRelayAdapter.ts | server/src/RelayService.ts L250；src/presentation/RealCommitRelayAdapter.ts L95 | 局部变量绑定（server/src/RelayService.ts） |
| carry | 局部变量 | src/presentation/RealCommitRelayAdapter.ts | src/presentation/RealCommitRelayAdapter.ts L199 | 局部变量绑定（src/presentation/RealCommitRelayAdapter.ts） |
| charge | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L143 | 局部变量绑定（server/src/RelayService.ts） |
| charged | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L48 | 局部变量绑定（server/src/RelayService.ts） |
| child | 局部变量 | server/src/buildRelayServer.ts | server/src/buildRelayServer.ts L34、L35 | 局部参数绑定（server/src/buildRelayServer.ts） |
| claim | 局部变量 | server/src/RelayService.ts；src/presentation/RealCommitRelayAdapter.ts | server/src/RelayService.ts L164；src/presentation/RealCommitRelayAdapter.ts L37 | 局部变量绑定（server/src/RelayService.ts） |
| client | 局部变量 | server/src/RelayStorage.ts；server/src/RelayService.ts | server/src/RelayStorage.ts L31、L32、L46、L52、L65、L77；server/src/RelayService.ts L54、L177、L184、L204、L232、L287、L302 | 局部参数绑定（server/src/RelayStorage.ts） |
| clock | 局部变量 | server/src/RelayService.ts；server/src/buildRelayServer.ts | server/src/RelayService.ts L40；server/src/buildRelayServer.ts L20、L24 | 局部参数绑定（server/src/RelayService.ts） |
| code | 私有成员 | server/src/RelayService.ts；server/src/RelayRoute.ts；src/presentation/RealCommitRelayAdapter.ts | server/src/RelayService.ts L29；server/src/RelayRoute.ts L28；src/presentation/RealCommitRelayAdapter.ts L10、L183、L184 | <arrow-function> 内属性签名（server/src/RelayRoute.ts） |
| codec | 私有成员 | server/src/RelayService.ts；src/presentation/RealCommitRelayAdapter.ts | server/src/RelayService.ts L35；src/presentation/RealCommitRelayAdapter.ts L21 | RelayService 内属性（server/src/RelayService.ts） |
| commit | 私有成员 | server/src/RelayStorage.ts；server/src/RelayService.ts；src/presentation/RealCommitRelayAdapter.ts | server/src/RelayStorage.ts L83；server/src/RelayService.ts L247、L265；src/presentation/RealCommitRelayAdapter.ts L25、L29、L70 | RelayStorage 内方法（server/src/RelayStorage.ts） |
| commits | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L243、L289 | 局部变量绑定（server/src/RelayService.ts） |
| comparePosition | 私有成员 | src/presentation/RealCommitRelayAdapter.ts | src/presentation/RealCommitRelayAdapter.ts L192 | <module> 内函数（src/presentation/RealCommitRelayAdapter.ts） |
| config | 局部变量 | server/src/buildRelayServer.ts | server/src/buildRelayServer.ts L15、L20、L24 | 局部参数绑定（server/src/buildRelayServer.ts） |
| confirmation | 局部变量 | src/presentation/RealCommitRelayAdapter.ts | src/presentation/RealCommitRelayAdapter.ts L114 | 局部变量绑定（src/presentation/RealCommitRelayAdapter.ts） |
| constructor | 私有成员 | server/src/RelayStorage.ts；server/src/RelayService.ts；src/presentation/RealCommitRelayAdapter.ts | server/src/RelayStorage.ts L29；server/src/RelayService.ts L40；src/presentation/RealCommitRelayAdapter.ts L10、L19 | RelayStorage 内构造器（server/src/RelayStorage.ts） |
| context | 局部变量 | src/presentation/RealCommitRelayAdapter.ts | src/presentation/RealCommitRelayAdapter.ts L86、L167 | 局部变量绑定（src/presentation/RealCommitRelayAdapter.ts） |
| copy | 私有成员 | src/presentation/RealCommitRelayAdapter.ts | src/presentation/RealCommitRelayAdapter.ts L179 | RealCommitRelayAdapter 内方法（src/presentation/RealCommitRelayAdapter.ts） |
| count | 私有成员 | server/src/RelayStorage.ts；server/src/RelayService.ts；src/presentation/RealCommitRelayAdapter.ts | server/src/RelayStorage.ts L66；server/src/RelayService.ts L37；src/presentation/RealCommitRelayAdapter.ts L197 | detectLostRange 内属性签名（server/src/RelayStorage.ts） |
| current | 局部变量 | server/src/RelayService.ts；src/presentation/RealCommitRelayAdapter.ts | server/src/RelayService.ts L214；src/presentation/RealCommitRelayAdapter.ts L168 | 局部变量绑定（server/src/RelayService.ts） |
| currentMember | 私有成员 | server/src/RelayService.ts | server/src/RelayService.ts L177 | RelayService 内方法（server/src/RelayService.ts） |
| damaged | 私有成员 | server/src/RelayStorage.ts | server/src/RelayStorage.ts L66 | detectLostRange 内属性签名（server/src/RelayStorage.ts） |
| Data | 私有成员 | server/src/RelayService.ts | server/src/RelayService.ts L16 | <module> 内类型别名（server/src/RelayService.ts） |
| detail | 局部变量 | server/src/RelayService.ts；src/presentation/RealCommitRelayAdapter.ts | server/src/RelayService.ts L29；src/presentation/RealCommitRelayAdapter.ts L10、L185 | 局部参数绑定（server/src/RelayService.ts） |
| detectLostRange | 私有成员 | server/src/RelayStorage.ts | server/src/RelayStorage.ts L65 | RelayStorage 内方法（server/src/RelayStorage.ts） |
| deviceSignatureBase64Url | 局部变量 | src/presentation/RealCommitRelayAdapter.ts | src/presentation/RealCommitRelayAdapter.ts L129 | 局部变量绑定（src/presentation/RealCommitRelayAdapter.ts） |
| digest | 局部变量 | src/presentation/RealCommitRelayAdapter.ts | src/presentation/RealCommitRelayAdapter.ts L220 | 局部变量绑定（src/presentation/RealCommitRelayAdapter.ts） |
| digits | 局部变量 | src/presentation/RealCommitRelayAdapter.ts | src/presentation/RealCommitRelayAdapter.ts L198 | 局部变量绑定（src/presentation/RealCommitRelayAdapter.ts） |
| disconnected | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L49 | 局部变量绑定（server/src/RelayService.ts） |
| done | 局部变量 | server/src/RelayRoute.ts | server/src/RelayRoute.ts L26 | 局部参数绑定（server/src/RelayRoute.ts） |
| empty | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L83 | 局部变量绑定（server/src/RelayService.ts） |
| entries | 私有成员 | server/src/RelayService.ts | server/src/RelayService.ts L24、L265 | RelayPullResultMemory 内属性签名（server/src/RelayService.ts） |
| entriesSha | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L311 | 局部变量绑定（server/src/RelayService.ts） |
| entriesSha256 | 局部变量 | src/presentation/RealCommitRelayAdapter.ts | src/presentation/RealCommitRelayAdapter.ts L136 | 局部变量绑定（src/presentation/RealCommitRelayAdapter.ts） |
| entry | 局部变量 | server/src/RelayService.ts；src/presentation/RealCommitRelayAdapter.ts | server/src/RelayService.ts L279、L290、L307、L314；src/presentation/RealCommitRelayAdapter.ts L91 | 局部变量绑定（server/src/RelayService.ts） |
| envelope | 私有成员 | server/src/RelayService.ts | server/src/RelayService.ts L18、L172 | PreparedRelayCommit 内属性签名（server/src/RelayService.ts） |
| envelope_bytes | 私有成员 | server/src/RelayStorage.ts | server/src/RelayStorage.ts L18 | RelayStoredCommit 内属性签名（server/src/RelayStorage.ts） |
| envelope_sha256 | 私有成员 | server/src/RelayStorage.ts | server/src/RelayStorage.ts L20 | RelayStoredCommit 内属性签名（server/src/RelayStorage.ts） |
| envelopeDigest | 私有成员 | src/presentation/RealCommitRelayAdapter.ts | src/presentation/RealCommitRelayAdapter.ts L208 | <module> 内函数（src/presentation/RealCommitRelayAdapter.ts） |
| envelopeSha256 | 私有成员 | server/src/RelayService.ts | server/src/RelayService.ts L24 | RelayPullResultMemory 内属性签名（server/src/RelayService.ts） |
| epoch | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L190 | 局部变量绑定（server/src/RelayService.ts） |
| error | 局部变量 | server/src/RelayStorage.ts；server/src/RelayService.ts；server/src/RelayRoute.ts；server/src/buildRelayServer.ts；src/presentation/RealCommitRelayAdapter.ts | server/src/RelayStorage.ts L38；server/src/RelayService.ts L103、L125；server/src/RelayRoute.ts L10、L27；server/src/buildRelayServer.ts L37；src/presentation/RealCommitRelayAdapter.ts L48、L77、L146、L181 | 局部变量绑定（server/src/RelayStorage.ts） |
| exact | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L272 | 局部变量绑定（server/src/RelayService.ts） |
| expire | 私有成员 | server/src/RelayStorage.ts | server/src/RelayStorage.ts L52 | RelayStorage 内方法（server/src/RelayStorage.ts） |
| expired | 局部变量 | server/src/RelayStorage.ts | server/src/RelayStorage.ts L54 | 局部变量绑定（server/src/RelayStorage.ts） |
| expires | 私有成员 | server/src/RelayService.ts | server/src/RelayService.ts L37 | RelayService 内属性签名（server/src/RelayService.ts） |
| f | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L136 | 局部变量绑定（server/src/RelayService.ts） |
| fact | 局部变量 | server/src/RelayService.ts；src/presentation/RealCommitRelayAdapter.ts | server/src/RelayService.ts L221、L312；src/presentation/RealCommitRelayAdapter.ts L36、L135 | 局部变量绑定（server/src/RelayService.ts） |
| fail | 私有成员 | server/src/RelayService.ts | server/src/RelayService.ts L29 | <module> 内函数（server/src/RelayService.ts） |
| failure | 私有成员 | src/presentation/RealCommitRelayAdapter.ts | src/presentation/RealCommitRelayAdapter.ts L181 | RealCommitRelayAdapter 内方法（src/presentation/RealCommitRelayAdapter.ts） |
| fault | 私有成员 | server/src/RelayRoute.ts；src/presentation/RealCommitRelayAdapter.ts | server/src/RelayRoute.ts L29；src/presentation/RealCommitRelayAdapter.ts L181 | failure 内属性签名（src/presentation/RealCommitRelayAdapter.ts） |
| final | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L53 | 局部变量绑定（server/src/RelayService.ts） |
| finalSample | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L101 | 局部变量绑定（server/src/RelayService.ts） |
| first | 局部变量 | src/presentation/RealCommitRelayAdapter.ts | src/presentation/RealCommitRelayAdapter.ts L175、L192 | 局部参数绑定（src/presentation/RealCommitRelayAdapter.ts） |
| floor | 私有成员 | server/src/RelayStorage.ts；server/src/RelayService.ts | server/src/RelayStorage.ts L54；server/src/RelayService.ts L236 | expire 内属性签名（server/src/RelayStorage.ts） |
| fromBytes | 私有成员 | server/src/RelayService.ts | server/src/RelayService.ts L31 | <module> 内函数（server/src/RelayService.ts） |
| gap | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L237 | 局部变量绑定（server/src/RelayService.ts） |
| generation | 私有成员 | server/src/RelayStorage.ts | server/src/RelayStorage.ts L7、L14、L68 | RelayStoredStream 内属性签名（server/src/RelayStorage.ts） |
| handle | 私有成员 | server/src/RelayService.ts | server/src/RelayService.ts L42 | RelayService 内方法（server/src/RelayService.ts） |
| header | 私有成员 | server/src/RelayService.ts | server/src/RelayService.ts L18、L165、L185、L205 | PreparedRelayCommit 内属性签名（server/src/RelayService.ts） |
| hexDigest | 私有成员 | src/presentation/RealCommitRelayAdapter.ts | src/presentation/RealCommitRelayAdapter.ts L219 | <module> 内函数（src/presentation/RealCommitRelayAdapter.ts） |
| identity | 私有成员 | server/src/RelayService.ts | server/src/RelayService.ts L24 | RelayPullResultMemory 内属性签名（server/src/RelayService.ts） |
| index | 局部变量 | server/src/RelayService.ts；src/presentation/RealCommitRelayAdapter.ts | server/src/RelayService.ts L265；src/presentation/RealCommitRelayAdapter.ts L200、L211 | 局部参数绑定（server/src/RelayService.ts） |
| input | 局部变量 | server/src/RelayService.ts；server/src/RelayRoute.ts | server/src/RelayService.ts L42、L153、L161；server/src/RelayRoute.ts L43 | 局部参数绑定（server/src/RelayService.ts） |
| invoke | 私有成员 | src/presentation/RealCommitRelayAdapter.ts | src/presentation/RealCommitRelayAdapter.ts L149 | RealCommitRelayAdapter 内方法（src/presentation/RealCommitRelayAdapter.ts） |
| key | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L72、L143、L150 | 局部变量绑定（server/src/RelayService.ts） |
| keys | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L272 | 局部参数绑定（server/src/RelayService.ts） |
| kind | 私有成员 | server/src/RelayService.ts；src/presentation/RealCommitRelayAdapter.ts | server/src/RelayService.ts L21；src/presentation/RealCommitRelayAdapter.ts L181 | RelayPullResultMemory 内属性签名（server/src/RelayService.ts） |
| legacy | 局部变量 | server/src/RelayRoute.ts | server/src/RelayRoute.ts L28 | 局部变量绑定（server/src/RelayRoute.ts） |
| limit | 私有成员 | server/src/RelayService.ts | server/src/RelayService.ts L140 | RelayService 内方法（server/src/RelayService.ts） |
| lockStream | 私有成员 | server/src/RelayStorage.ts | server/src/RelayStorage.ts L46 | RelayStorage 内方法（server/src/RelayStorage.ts） |
| MAX_CURSOR | 常量 | server/src/RelayService.ts | server/src/RelayService.ts L27 | 模块顶层常量绑定（server/src/RelayService.ts） |
| maximum | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L143 | 局部参数绑定（server/src/RelayService.ts） |
| maximumCount | 局部变量 | src/presentation/RealCommitRelayAdapter.ts | src/presentation/RealCommitRelayAdapter.ts L51 | 局部参数绑定（src/presentation/RealCommitRelayAdapter.ts） |
| maximumWait | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L46 | 局部变量绑定（server/src/RelayService.ts） |
| maximumWaitMs | 局部变量 | src/presentation/RealCommitRelayAdapter.ts | src/presentation/RealCommitRelayAdapter.ts L52 | 局部参数绑定（src/presentation/RealCommitRelayAdapter.ts） |
| membership | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L193 | 局部变量绑定（server/src/RelayService.ts） |
| memory | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L94、L271、L287 | 局部变量绑定（server/src/RelayService.ts） |
| missingAdmission | 私有成员 | server/src/RelayStorage.ts | server/src/RelayStorage.ts L77 | RelayStorage 内方法（server/src/RelayStorage.ts） |
| mode | 私有成员 | src/presentation/RealCommitRelayAdapter.ts | src/presentation/RealCommitRelayAdapter.ts L17 | RealCommitRelayAdapter 内属性（src/presentation/RealCommitRelayAdapter.ts） |
| next | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L244 | 局部变量绑定（server/src/RelayService.ts） |
| next_position | 私有成员 | server/src/RelayStorage.ts | server/src/RelayStorage.ts L8 | RelayStoredStream 内属性签名（server/src/RelayStorage.ts） |
| nonce | 局部变量 | server/src/RelayService.ts；server/src/RelayRoute.ts | server/src/RelayService.ts L204、L261、L302；server/src/RelayRoute.ts L37 | 局部参数绑定（server/src/RelayService.ts） |
| now | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L141 | 局部变量绑定（server/src/RelayService.ts） |
| O | 局部变量 | src/presentation/RealCommitRelayAdapter.ts | src/presentation/RealCommitRelayAdapter.ts L149 | 局部类型参数绑定（src/presentation/RealCommitRelayAdapter.ts） |
| observer | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L199 | 局部变量绑定（server/src/RelayService.ts） |
| omitted | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L223 | 局部变量绑定（server/src/RelayService.ts） |
| operation | 局部变量 | server/src/RelayService.ts；server/src/RelayRoute.ts；src/presentation/RealCommitRelayAdapter.ts | server/src/RelayService.ts L42、L140、L153；server/src/RelayRoute.ts L41；src/presentation/RealCommitRelayAdapter.ts L149 | 局部参数绑定（server/src/RelayService.ts） |
| operations | 常量 | server/src/RelayRoute.ts | server/src/RelayRoute.ts L8 | 模块顶层常量绑定（server/src/RelayRoute.ts） |
| parsed | 局部变量 | src/presentation/RealCommitRelayAdapter.ts | src/presentation/RealCommitRelayAdapter.ts L153 | 局部变量绑定（src/presentation/RealCommitRelayAdapter.ts） |
| payload | 私有成员 | server/src/RelayService.ts；src/presentation/RealCommitRelayAdapter.ts | server/src/RelayService.ts L43、L179、L232、L264、L295、L302；src/presentation/RealCommitRelayAdapter.ts L55、L131、L150 | currentMember 内属性签名（server/src/RelayService.ts） |
| pendingKey | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L47 | 局部变量绑定（server/src/RelayService.ts） |
| pendingPulls | 私有成员 | server/src/RelayService.ts | server/src/RelayService.ts L38 | RelayService 内属性（server/src/RelayService.ts） |
| permit | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L189 | 局部变量绑定（server/src/RelayService.ts） |
| pin | 局部变量 | server/src/buildRelayServer.ts | server/src/buildRelayServer.ts L27 | 局部参数绑定（server/src/buildRelayServer.ts） |
| pool | 局部变量 | server/src/RelayStorage.ts；server/src/buildRelayServer.ts | server/src/RelayStorage.ts L29；server/src/buildRelayServer.ts L15、L20、L24 | 局部参数绑定（server/src/RelayStorage.ts） |
| position | 私有成员 | server/src/RelayStorage.ts；server/src/RelayService.ts；src/presentation/RealCommitRelayAdapter.ts | server/src/RelayStorage.ts L15；server/src/RelayService.ts L24、L217、L278；src/presentation/RealCommitRelayAdapter.ts L197 | RelayStoredCommit 内属性签名（server/src/RelayStorage.ts） |
| prepareCommit | 私有成员 | server/src/RelayService.ts | server/src/RelayService.ts L161 | RelayService 内方法（server/src/RelayService.ts） |
| prepared | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L44、L184、L204 | 局部变量绑定（server/src/RelayService.ts） |
| PreparedRelayCommit | 私有成员 | server/src/RelayService.ts | server/src/RelayService.ts L18 | <module> 内接口（server/src/RelayService.ts） |
| previous | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L144 | 局部变量绑定（server/src/RelayService.ts） |
| prior | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L60、L208 | 局部变量绑定（server/src/RelayService.ts） |
| proof | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L223 | 局部变量绑定（server/src/RelayService.ts） |
| public_proof | 私有成员 | server/src/RelayStorage.ts | server/src/RelayStorage.ts L19 | RelayStoredCommit 内属性签名（server/src/RelayStorage.ts） |
| pull | 私有成员 | server/src/RelayService.ts；src/presentation/RealCommitRelayAdapter.ts | server/src/RelayService.ts L232；src/presentation/RealCommitRelayAdapter.ts L51 | RelayService 内方法（server/src/RelayService.ts） |
| pullMemory | 私有成员 | server/src/RelayService.ts | server/src/RelayService.ts L270 | RelayService 内方法（server/src/RelayService.ts） |
| pullReceipt | 私有成员 | server/src/RelayService.ts | server/src/RelayService.ts L261 | RelayService 内方法（server/src/RelayService.ts） |
| rates | 私有成员 | server/src/RelayService.ts | server/src/RelayService.ts L37 | RelayService 内属性（server/src/RelayService.ts） |
| raw | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L42 | 局部参数绑定（server/src/RelayService.ts） |
| readBack | 局部变量 | src/presentation/RealCommitRelayAdapter.ts | src/presentation/RealCommitRelayAdapter.ts L116 | 局部变量绑定（src/presentation/RealCommitRelayAdapter.ts） |
| RealCommitRelayAdapter | 公开类型 | src/presentation/RealCommitRelayAdapter.ts | src/presentation/RealCommitRelayAdapter.ts L16 | 客户端 ExternalService adapter：relay=submit、pull、完整 c-1 validator 验真、耐久回读后注册设备签 ACK（delivery-report.md L15） |
| reason | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L237 | 局部参数绑定（server/src/RelayService.ts） |
| receipt | 私有成员 | server/src/RelayStorage.ts；server/src/RelayService.ts | server/src/RelayStorage.ts L24；server/src/RelayService.ts L23、L168、L222、L263、L296、L313 | RelayStoredCommit 内属性签名（server/src/RelayStorage.ts） |
| receipts | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L167 | 局部变量绑定（server/src/RelayService.ts） |
| recipient | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L226 | 局部变量绑定（server/src/RelayService.ts） |
| recipients | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L225 | 局部变量绑定（server/src/RelayService.ts） |
| reconstructPull | 私有成员 | server/src/RelayService.ts | server/src/RelayService.ts L287 | RelayService 内方法（server/src/RelayService.ts） |
| relay | 私有成员 | server/src/buildRelayServer.ts；src/presentation/RealCommitRelayAdapter.ts | server/src/buildRelayServer.ts L33；src/presentation/RealCommitRelayAdapter.ts L25 | RealCommitRelayAdapter 内方法（src/presentation/RealCommitRelayAdapter.ts） |
| RelayClientFault | 私有成员 | src/presentation/RealCommitRelayAdapter.ts | src/presentation/RealCommitRelayAdapter.ts L9 | <module> 内类（src/presentation/RealCommitRelayAdapter.ts） |
| RelayOperation | 私有成员 | server/src/RelayService.ts | server/src/RelayService.ts L17 | <module> 内类型别名（server/src/RelayService.ts） |
| RelayPullResultMemory | 私有成员 | server/src/RelayService.ts | server/src/RelayService.ts L19 | <module> 内接口（server/src/RelayService.ts） |
| relayRoutes | 公开方法 | server/src/RelayRoute.ts | server/src/RelayRoute.ts L24 | Relay 路由注册函数：strict canonical wire、独立 route bodyLimit、错误 wire，继承旧 Host/Origin/session/CSRF 边界（delivery-report.md L13） |
| RelayService | 公开类型 | server/src/RelayService.ts | server/src/RelayService.ts L34 | Relay 服务类：已 admitted 校验、来源/摘要/作者签名、pull 缺载/到期/世代三种 Gap、P11 引用重建、ACK 与限流（delivery-report.md L12） |
| RelayStorage | 公开类型 | server/src/RelayStorage.ts | server/src/RelayStorage.ts L28 | Relay 存储类：queue 原字节/位置/receipt 同一 PG 事务、ACK、到期 tombstone/floor、持久 generation 与丢段检测（delivery-report.md L11） |
| RelayStoredCommit | 公开类型 | server/src/RelayStorage.ts | server/src/RelayStorage.ts L12 | Relay 存储提交行类型（RelayStorage 持久结构） |
| RelayStoredStream | 公开类型 | server/src/RelayStorage.ts | server/src/RelayStorage.ts L5 | Relay 存储流行类型（RelayStorage 持久结构） |
| rememberPull | 私有成员 | server/src/RelayService.ts | server/src/RelayService.ts L263 | RelayService 内方法（server/src/RelayService.ts） |
| reply | 局部变量 | server/src/RelayService.ts；server/src/RelayRoute.ts；src/presentation/RealCommitRelayAdapter.ts | server/src/RelayService.ts L111；server/src/RelayRoute.ts L27、L42；src/presentation/RealCommitRelayAdapter.ts L34、L57、L133、L152 | 局部变量绑定（server/src/RelayService.ts） |
| request | 局部变量 | server/src/RelayService.ts；server/src/RelayRoute.ts；src/presentation/RealCommitRelayAdapter.ts | server/src/RelayService.ts L42；server/src/RelayRoute.ts L10、L27、L42；src/presentation/RealCommitRelayAdapter.ts L80 | 局部参数绑定（server/src/RelayService.ts） |
| requestNonce | 局部变量 | src/presentation/RealCommitRelayAdapter.ts | src/presentation/RealCommitRelayAdapter.ts L30、L53、L82、L150、L181 | 局部变量绑定（src/presentation/RealCommitRelayAdapter.ts） |
| requestSha | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L59 | 局部变量绑定（server/src/RelayService.ts） |
| requireContext | 私有成员 | src/presentation/RealCommitRelayAdapter.ts | src/presentation/RealCommitRelayAdapter.ts L161 | RealCommitRelayAdapter 内方法（src/presentation/RealCommitRelayAdapter.ts） |
| resolve | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L123 | 局部参数绑定（server/src/RelayService.ts） |
| RESPONSE_LIMIT | 常量 | server/src/RelayService.ts | server/src/RelayService.ts L28 | 模块顶层常量绑定（server/src/RelayService.ts） |
| result | 局部变量 | server/src/RelayService.ts；server/src/RelayRoute.ts；src/presentation/RealCommitRelayAdapter.ts | server/src/RelayService.ts L54、L134；server/src/RelayRoute.ts L44；src/presentation/RealCommitRelayAdapter.ts L221 | 局部变量绑定（server/src/RelayService.ts） |
| retained_until | 私有成员 | server/src/RelayStorage.ts | server/src/RelayStorage.ts L22 | RelayStoredCommit 内属性签名（server/src/RelayStorage.ts） |
| retainedUntil | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L219 | 局部变量绑定（server/src/RelayService.ts） |
| retention_floor | 私有成员 | server/src/RelayStorage.ts | server/src/RelayStorage.ts L9 | RelayStoredStream 内属性签名（server/src/RelayStorage.ts） |
| RETENTION_MS | 常量 | server/src/RelayService.ts | server/src/RelayService.ts L26 | 模块顶层常量绑定（server/src/RelayService.ts） |
| roster | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L197 | 局部变量绑定（server/src/RelayService.ts） |
| row | 局部变量 | server/src/RelayStorage.ts；server/src/RelayService.ts | server/src/RelayStorage.ts L66、L83；server/src/RelayService.ts L179、L192、L245、L291、L308 | 局部变量绑定（server/src/RelayStorage.ts） |
| rows | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L242 | 局部变量绑定（server/src/RelayService.ts） |
| same | 私有成员 | server/src/RelayService.ts；src/presentation/RealCommitRelayAdapter.ts | server/src/RelayService.ts L30；src/presentation/RealCommitRelayAdapter.ts L175 | <module> 内函数（server/src/RelayService.ts） |
| sample | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L57 | 局部变量绑定（server/src/RelayService.ts） |
| schemaFailure | 私有成员 | server/src/RelayRoute.ts；src/presentation/RealCommitRelayAdapter.ts | server/src/RelayRoute.ts L10；src/presentation/RealCommitRelayAdapter.ts L182 | <module> 内函数（server/src/RelayRoute.ts） |
| schemaVersion | 私有成员 | server/src/RelayService.ts | server/src/RelayService.ts L20 | RelayPullResultMemory 内属性签名（server/src/RelayService.ts） |
| second | 局部变量 | src/presentation/RealCommitRelayAdapter.ts | src/presentation/RealCommitRelayAdapter.ts L175、L192 | 局部参数绑定（src/presentation/RealCommitRelayAdapter.ts） |
| segment | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L188 | 局部变量绑定（server/src/RelayService.ts） |
| service | 局部变量 | server/src/RelayRoute.ts | server/src/RelayRoute.ts L24 | 局部参数绑定（server/src/RelayRoute.ts） |
| service_instance_id | 私有成员 | server/src/RelayService.ts | server/src/RelayService.ts L78 | <arrow-function> 内属性签名（server/src/RelayService.ts） |
| session | 局部变量 | server/src/RelayService.ts；src/presentation/RealCommitRelayAdapter.ts | server/src/RelayService.ts L56、L140、L153、L177、L204、L232、L302；src/presentation/RealCommitRelayAdapter.ts L19 | 局部变量绑定（server/src/RelayService.ts） |
| sharedSigner | 局部变量 | server/src/buildRelayServer.ts | server/src/buildRelayServer.ts L15、L20、L24 | 局部参数绑定（server/src/buildRelayServer.ts） |
| signer | 局部变量 | server/src/RelayService.ts；src/presentation/RealCommitRelayAdapter.ts | server/src/RelayService.ts L40；src/presentation/RealCommitRelayAdapter.ts L20 | 局部参数绑定（server/src/RelayService.ts） |
| skeleton | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L266、L288 | 局部变量绑定（server/src/RelayService.ts） |
| skeletonWire | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L275 | 局部变量绑定（server/src/RelayService.ts） |
| source | 局部变量 | server/src/RelayRoute.ts；src/presentation/RealCommitRelayAdapter.ts | server/src/RelayRoute.ts L26；src/presentation/RealCommitRelayAdapter.ts L92 | 局部参数绑定（server/src/RelayRoute.ts） |
| stable | 局部变量 | src/presentation/RealCommitRelayAdapter.ts | src/presentation/RealCommitRelayAdapter.ts L32、L84 | 局部变量绑定（src/presentation/RealCommitRelayAdapter.ts） |
| started | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L45 | 局部变量绑定（server/src/RelayService.ts） |
| status | 私有成员 | server/src/RelayService.ts | server/src/RelayService.ts L29、L42、L82 | handle 内属性签名（server/src/RelayService.ts） |
| statusCode | 私有成员 | server/src/RelayRoute.ts | server/src/RelayRoute.ts L28 | <arrow-function> 内属性签名（server/src/RelayRoute.ts） |
| storage | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L40 | 局部参数绑定（server/src/RelayService.ts） |
| stored | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L116 | 局部变量绑定（server/src/RelayService.ts） |
| storedStatus | 私有成员 | server/src/RelayService.ts | server/src/RelayService.ts L133 | RelayService 内方法（server/src/RelayService.ts） |
| stream | 局部变量 | server/src/RelayStorage.ts；server/src/RelayService.ts | server/src/RelayStorage.ts L52、L65、L77；server/src/RelayService.ts L85、L204、L232、L302 | 局部参数绑定（server/src/RelayStorage.ts） |
| submit | 私有成员 | server/src/RelayService.ts；src/presentation/RealCommitRelayAdapter.ts | server/src/RelayService.ts L204；src/presentation/RealCommitRelayAdapter.ts L29 | RelayService 内方法（server/src/RelayService.ts） |
| T | 局部变量 | server/src/RelayStorage.ts；src/presentation/RealCommitRelayAdapter.ts | server/src/RelayStorage.ts L31；src/presentation/RealCommitRelayAdapter.ts L179 | 局部类型参数绑定（server/src/RelayStorage.ts） |
| textDigest | 私有成员 | src/presentation/RealCommitRelayAdapter.ts | src/presentation/RealCommitRelayAdapter.ts L215 | <module> 内函数（src/presentation/RealCommitRelayAdapter.ts） |
| tombstone | 私有成员 | server/src/RelayStorage.ts | server/src/RelayStorage.ts L23 | RelayStoredCommit 内属性签名（server/src/RelayStorage.ts） |
| transaction | 私有成员 | server/src/RelayStorage.ts | server/src/RelayStorage.ts L31 | RelayStorage 内方法（server/src/RelayStorage.ts） |
| trustedTime | 局部变量 | server/src/RelayStorage.ts | server/src/RelayStorage.ts L52 | 局部参数绑定（server/src/RelayStorage.ts） |
| unsigned | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L157、L195、L305 | 局部变量绑定（server/src/RelayService.ts） |
| unsignedAck | 局部变量 | src/presentation/RealCommitRelayAdapter.ts | src/presentation/RealCommitRelayAdapter.ts L127 | 局部变量绑定（src/presentation/RealCommitRelayAdapter.ts） |
| validated | 局部变量 | src/presentation/RealCommitRelayAdapter.ts | src/presentation/RealCommitRelayAdapter.ts L102 | 局部变量绑定（src/presentation/RealCommitRelayAdapter.ts） |
| validator | 局部变量 | src/presentation/RealCommitRelayAdapter.ts | src/presentation/RealCommitRelayAdapter.ts L22 | 局部参数绑定（src/presentation/RealCommitRelayAdapter.ts） |
| value | 局部变量 | server/src/RelayStorage.ts；server/src/RelayService.ts；server/src/RelayRoute.ts；src/presentation/RealCommitRelayAdapter.ts | server/src/RelayStorage.ts L35、L81；server/src/RelayService.ts L81、L150、L272；server/src/RelayRoute.ts L14；src/presentation/RealCommitRelayAdapter.ts L162、L179、L201、L208、L215 | 局部变量绑定（server/src/RelayStorage.ts） |
| verifier | 私有成员 | server/src/RelayService.ts | server/src/RelayService.ts L36 | RelayService 内属性（server/src/RelayService.ts） |
| verifyStoredSource | 私有成员 | server/src/RelayService.ts | server/src/RelayService.ts L184 | RelayService 内方法（server/src/RelayService.ts） |
| version | 局部变量 | server/src/RelayRoute.ts | server/src/RelayRoute.ts L16 | 局部变量绑定（server/src/RelayRoute.ts） |
| window | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L142 | 局部变量绑定（server/src/RelayService.ts） |
| wire | 私有成员 | server/src/RelayService.ts | server/src/RelayService.ts L18、L42、L112、L162、L185、L205、L263、L297 | PreparedRelayCommit 内属性签名（server/src/RelayService.ts） |
| wireSha256 | 私有成员 | server/src/RelayService.ts | server/src/RelayService.ts L22 | RelayPullResultMemory 内属性签名（server/src/RelayService.ts） |
| world | 局部变量 | server/src/RelayService.ts | server/src/RelayService.ts L78、L177、L184、L204、L232、L302 | 局部变量绑定（server/src/RelayService.ts） |
| world_id | 私有成员 | server/src/RelayStorage.ts | server/src/RelayStorage.ts L6、L13 | RelayStoredStream 内属性签名（server/src/RelayStorage.ts） |
| worldId | 局部变量 | server/src/RelayStorage.ts；server/src/RelayService.ts；src/presentation/RealCommitRelayAdapter.ts | server/src/RelayStorage.ts L46；server/src/RelayService.ts L58、L140；src/presentation/RealCommitRelayAdapter.ts L51 | 局部参数绑定（server/src/RelayStorage.ts） |

## 分类小计（按唯一名称）

| 类别 | 唯一名称数 |
|---|---|
| 公开类型 | 5 |
| 公开方法 | 3 |
| 常量 | 4 |
| 私有成员 | 84 |
| 局部变量 | 121 |
| 域字面量 | 0 |
| 资源 ID | 0 |
| 合计 | 217 |

## 分类小计（按声明出现次数）

| 类别 | 出现次数 |
|---|---|
| 公开类型 | 5 |
| 公开方法 | 3 |
| 常量 | 4 |
| 私有成员 | 100 |
| 局部变量 | 308 |
| 域字面量 / 资源 ID | 0（源 JSON 未包含该类条目） |
| 合计 | 420 |
