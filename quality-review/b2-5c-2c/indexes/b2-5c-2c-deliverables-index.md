# B2.5c-2c 交付物总索引

- 源：`quality-review/b2-5c-2c/evidence/artifact-inventory-final.json`（phase=B2.5c-2c delivery/evidence artifact inventory，fileCount=399，generatedUtc=2026-10-11T10:15:53.560Z）
- 文件计数 = 399（本索引实际列出 399 条，与源一致）
- 生成时间（源 JSON）：2026-10-11T10:15:53.560Z；本索引机械派生生成：2026-10-12（Trae EXECUTOR，只读源材料，未修改任何已有文件）
- 排除项（源 JSON exclusions）：`{"directoryNames":[".local",".secret","secrets","node_modules"],"fileNamePatterns":[".env",".env.*","*.(pem|key|p12|pfx)"],"thisManifest":"evidence/artifact-inventory-final.json","symlinkTargetsNotTraversed":true}`
- 用途摘要为按文件名/目录角色的机械派生描述，不替代源文件内容；每条路径/字节/SHA256 均逐字取自源 JSON。

## 分组统计

| 组 | 条目数 |
|---|---|
| 一、源码增量 | 0 |
| 二、服务器构建与迁移 | 0 |
| 三、客户端证据 | 140 |
| 四、服务器证据 | 40 |
| 五、历史回归 | 113 |
| 六、暂停记录与过程偏差 | 22 |
| 七、契约测试与命名 | 13 |
| 八、保护审计与 lineage | 58 |
| 九、交付文书与裁定 | 13 |
| 合计 | 399 |

## 一、源码增量（src/、server/src/、assets/scripts/）

源 inventory 限定 quality-review/b2-5c-2c/ 目录范围，其中**无** src/、server/src/、assets/scripts/ 条目（计 0 条）。c-2c 实际源码增量为 5 份新增 TS + 2 份修改（IntentPort type-only suffix、P10 session 局部修正）+ 4 份生成 JS，逐字记录于 evidence/changed-files-final.json 与 evidence/source-final.diff，并在 [b2-5c-2c-key-evidence-sha.md](b2-5c-2c-key-evidence-sha.md) 单列。

## 二、服务器构建与迁移（server/sql/、server/SharedBuild.mjs、tsconfig.shared.json）

源 inventory 内**无** server/sql/、server/SharedBuild.mjs、tsconfig.shared.json 条目（计 0 条）；server 独立构建结果见 evidence/server-build-checks/（归入第四组）。

## 三、客户端证据

范围：client-real-compiled-* / client-relay-contract / client-real-http* 及其编译产物、driver 与 lineage。

| 路径 | 字节 | SHA256 | 用途 |
|---|---|---|---|
| client-real-http.cjs | 35766 | bb413efa3cc6614159361ca651e8b2b836581a77d63f597456769a0b9e0d488f | 客户端真实 HTTP/PG 测试 driver（修复前版本） |
| client-real-http-after-retention-fix.cjs | 35826 | 511646f1e2901e62d96422f0296dc88cd2cc14d6a6bb316e928d15d06154eff2 | 客户端真实 HTTP/PG 测试 driver（retention 修复后版本） |
| client-real-http-retention-final.cjs | 35818 | 3c1394d2b479deaf040efa03ab2514c4cd6e8b1182e1f165297540e3e4698e13 | 客户端真实 HTTP/PG 测试 driver（最终版本） |
| evidence/after-retention-fix/client-real-http.log | 1966 | bb290f956b757cd103e6295c6fb0825542f34253bb5a0a70c673bf8e743d7b6a | retention 修复后补测证据·原始运行日志 |
| evidence/after-retention-fix/client-real-http-results.json | 5965 | 28f280fbcc185c74089a44c625432838f0265ebdb87feb8db8631a2a46fee9c1 | retention 修复后补测证据·测试/运行结果记录 JSON |
| evidence/after-retention-fix/client-run-lineage.json | 2596 | 2d4834dfa6e1d54833476aa6a44baa8d1fd362c7df2b3b2ab354d6582480ebd6 | retention 修复后补测证据·审计/状态记录 JSON |
| evidence/client-real-compiled/assets/scripts/SharedRelayPrototypeBuilder.js | 1613 | c31f1f793a3cff1e2cd1885c09cadd547d422e28c2b584ad3f8ca8e470f56d00 | 客户端真实测试编译产物（修复前）·编译产物 JS |
| evidence/client-real-compiled/src/director/SharedCanonicalBytes.js | 15717 | ceaa486b54f0c7ca1096c301149514124940fcdf9b6acca1ece9e902b0c71cb2 | 客户端真实测试编译产物（修复前）·编译产物 JS |
| evidence/client-real-compiled/src/director/SharedCommitCodec.js | 43978 | 7ec12d746e544e095b41dbe4717700e280a38c007bbd77918fabec585d4cef5b | 客户端真实测试编译产物（修复前）·编译产物 JS |
| evidence/client-real-compiled/src/director/SharedCommitValidator.js | 29640 | cee78e4716cbee619d304e8123bb2a29ee28b5d8698a0bab6edd4829bfebcdbe | 客户端真实测试编译产物（修复前）·编译产物 JS |
| evidence/client-real-compiled/src/director/SharedServiceProtocolCodec.js | 18211 | 1182df7457e9d45d91f435ca2f8243657ba5f332da8ad972c3458fcd72a20694 | 客户端真实测试编译产物（修复前）·编译产物 JS |
| evidence/client-real-compiled/src/presentation/RealCommitRelayAdapter.js | 12028 | d536aa62b74820d1085710d7af666499dc654f28235a762ab10e0d52e3288e4b | 客户端真实测试编译产物（修复前）·编译产物 JS |
| evidence/client-real-compiled/src/presentation/RealSharedServiceSessionAdapter.js | 45297 | 385818f28938dde601592faef502448a6d00300ec5a97ffdd1a09ead216035d5 | 客户端真实测试编译产物（修复前）·编译产物 JS |
| evidence/client-real-compiled/src/presentation/RealWorldAuthorityAdapter.js | 4413 | b20bb581767897293d918347e873967c690d21f80e7a727634eb241db6e91d83 | 客户端真实测试编译产物（修复前）·编译产物 JS |
| evidence/client-real-compiled-after-retention-fix/assets/scripts/SharedRelayPrototypeBuilder.js | 1613 | c31f1f793a3cff1e2cd1885c09cadd547d422e28c2b584ad3f8ca8e470f56d00 | 客户端真实测试编译产物（修复后）·编译产物 JS |
| evidence/client-real-compiled-after-retention-fix/src/director/SharedCanonicalBytes.js | 15717 | ceaa486b54f0c7ca1096c301149514124940fcdf9b6acca1ece9e902b0c71cb2 | 客户端真实测试编译产物（修复后）·编译产物 JS |
| evidence/client-real-compiled-after-retention-fix/src/director/SharedCommitCodec.js | 43978 | 7ec12d746e544e095b41dbe4717700e280a38c007bbd77918fabec585d4cef5b | 客户端真实测试编译产物（修复后）·编译产物 JS |
| evidence/client-real-compiled-after-retention-fix/src/director/SharedCommitValidator.js | 29640 | cee78e4716cbee619d304e8123bb2a29ee28b5d8698a0bab6edd4829bfebcdbe | 客户端真实测试编译产物（修复后）·编译产物 JS |
| evidence/client-real-compiled-after-retention-fix/src/director/SharedServiceProtocolCodec.js | 18211 | 1182df7457e9d45d91f435ca2f8243657ba5f332da8ad972c3458fcd72a20694 | 客户端真实测试编译产物（修复后）·编译产物 JS |
| evidence/client-real-compiled-after-retention-fix/src/presentation/RealCommitRelayAdapter.js | 12028 | d536aa62b74820d1085710d7af666499dc654f28235a762ab10e0d52e3288e4b | 客户端真实测试编译产物（修复后）·编译产物 JS |
| evidence/client-real-compiled-after-retention-fix/src/presentation/RealSharedServiceSessionAdapter.js | 45297 | 385818f28938dde601592faef502448a6d00300ec5a97ffdd1a09ead216035d5 | 客户端真实测试编译产物（修复后）·编译产物 JS |
| evidence/client-real-compiled-after-retention-fix/src/presentation/RealWorldAuthorityAdapter.js | 4413 | b20bb581767897293d918347e873967c690d21f80e7a727634eb241db6e91d83 | 客户端真实测试编译产物（修复后）·编译产物 JS |
| evidence/client-real-compiled-retention-final/assets/scripts/SharedRelayPrototypeBuilder.js | 1613 | c31f1f793a3cff1e2cd1885c09cadd547d422e28c2b584ad3f8ca8e470f56d00 | 客户端真实测试编译产物（最终）·编译产物 JS |
| evidence/client-real-compiled-retention-final/src/director/SharedCanonicalBytes.js | 15717 | ceaa486b54f0c7ca1096c301149514124940fcdf9b6acca1ece9e902b0c71cb2 | 客户端真实测试编译产物（最终）·编译产物 JS |
| evidence/client-real-compiled-retention-final/src/director/SharedCommitCodec.js | 43978 | 7ec12d746e544e095b41dbe4717700e280a38c007bbd77918fabec585d4cef5b | 客户端真实测试编译产物（最终）·编译产物 JS |
| evidence/client-real-compiled-retention-final/src/director/SharedCommitValidator.js | 29640 | cee78e4716cbee619d304e8123bb2a29ee28b5d8698a0bab6edd4829bfebcdbe | 客户端真实测试编译产物（最终）·编译产物 JS |
| evidence/client-real-compiled-retention-final/src/director/SharedServiceProtocolCodec.js | 18211 | 1182df7457e9d45d91f435ca2f8243657ba5f332da8ad972c3458fcd72a20694 | 客户端真实测试编译产物（最终）·编译产物 JS |
| evidence/client-real-compiled-retention-final/src/presentation/RealCommitRelayAdapter.js | 12028 | d536aa62b74820d1085710d7af666499dc654f28235a762ab10e0d52e3288e4b | 客户端真实测试编译产物（最终）·编译产物 JS |
| evidence/client-real-compiled-retention-final/src/presentation/RealSharedServiceSessionAdapter.js | 45297 | 385818f28938dde601592faef502448a6d00300ec5a97ffdd1a09ead216035d5 | 客户端真实测试编译产物（最终）·编译产物 JS |
| evidence/client-real-compiled-retention-final/src/presentation/RealWorldAuthorityAdapter.js | 4413 | b20bb581767897293d918347e873967c690d21f80e7a727634eb241db6e91d83 | 客户端真实测试编译产物（最终）·编译产物 JS |
| evidence/client-real-http-after-retention-fix.log | 1989 | 312f043ad5c44c6fdaac633f11ff31d34c380d5618f0891d820fba998068eef2 | 客户端真实 HTTP/PG 测试日志（修复后） |
| evidence/client-real-http-after-retention-fix-results.json | 5973 | d5a44bae04096efa1b0ae12907971551a59d6b70fcf86565dacf7271b7e092e2 | 客户端真实 HTTP/PG 测试结果（修复后） |
| evidence/client-real-http-results.json | 5965 | b432d878a1afd8613f7812a8e3d329ac49623f5d8f23e86936aaeecd00a093b9 | 客户端真实 HTTP/PG 测试结果（修复前 22/22） |
| evidence/client-real-http-run-01.log | 1989 | 312f043ad5c44c6fdaac633f11ff31d34c380d5618f0891d820fba998068eef2 | 客户端真实 HTTP/PG 测试运行日志（run01） |
| evidence/client-relay-compiled/src/director/SharedCanonicalBytes.js | 15717 | ceaa486b54f0c7ca1096c301149514124940fcdf9b6acca1ece9e902b0c71cb2 | 客户端 Relay 测试编译产物·编译产物 JS |
| evidence/client-relay-compiled/src/director/SharedCommitCodec.js | 43978 | 7ec12d746e544e095b41dbe4717700e280a38c007bbd77918fabec585d4cef5b | 客户端 Relay 测试编译产物·编译产物 JS |
| evidence/client-relay-compiled/src/director/SharedCommitValidator.js | 29640 | cee78e4716cbee619d304e8123bb2a29ee28b5d8698a0bab6edd4829bfebcdbe | 客户端 Relay 测试编译产物·编译产物 JS |
| evidence/client-relay-compiled/src/director/SharedServiceProtocolCodec.js | 18211 | 1182df7457e9d45d91f435ca2f8243657ba5f332da8ad972c3458fcd72a20694 | 客户端 Relay 测试编译产物·编译产物 JS |
| evidence/client-relay-compiled/src/presentation/RealCommitRelayAdapter.js | 12028 | d536aa62b74820d1085710d7af666499dc654f28235a762ab10e0d52e3288e4b | 客户端 Relay 测试编译产物·编译产物 JS |
| evidence/client-relay-contract/030fb026-14fd-4337-8c1f-a9a0bec5cdd1/ciphertext.json | 11116 | 131ec1f9529d7f56062de49dce669f5cee977ba4eb93e9b606dca3f96a7b9e12 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/03468a2b-9c8c-42ed-a690-431a1331ab80/ciphertext.json | 11116 | 25a0a8843df9d6fd9c23ab58b5971a028fa2393e9c8073b4af96b465353c22c6 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/04f83f27-dabf-4f1b-a7ea-37f68e23b2b3/ciphertext.json | 11116 | 9300acc82fbed4ac6f2b1663f69391dfecea79f47adc0cc3a22232a33ba3be81 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/05a7a6eb-d57a-44dc-9d5d-d359ae6b774c/ciphertext.json | 11116 | aabff48b23045baa66ad78ad0320914516c26cf9b9d2f52704e3b06284dd7fb4 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/087c91ff-2d6f-45fc-803b-1b6d81d1aad6/ciphertext.json | 11116 | dc747d8a479dac395a8a3239f655deba625cb3fb4689726e76dd1dcd94b31858 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/0b0c62f1-4466-472e-a067-072737ed438d/ciphertext.json | 11116 | e1d76355353f1a592937bacb1e2eac12889b81220263f96faf0dc09f594d48ea | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/0e0aece5-43b1-4dac-9892-e4be5b0f8961/ciphertext.json | 11116 | ca2192d7e059efe4532c5d6dc68ef21cd8690fcbb2090d9cb7fd0edd2acfbceb | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/10e2c07f-aa90-47f6-af30-62384ee69bd1/ciphertext.json | 11116 | a9a070f0771e1a8d94245c9f5a70cad679ffa83dd13018fca8a81119e87f59a6 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/120d358c-df0b-4537-9ca3-9ea6637b40bf/ciphertext.json | 11116 | 2f6f4437dc15ce4aa11e9a4b3cfbcd8978cfad569cf7f798d70904071a511734 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/142b6603-ca9a-4019-99a2-29eb9f695d6e/ciphertext.json | 11116 | 49d1cef2afa19cca904f4ef3c43b39b2fb84d9228b487a0b294c9576ca1dd218 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/1674f97c-f56e-404e-9b73-c8bd769491ac/ciphertext.json | 11116 | eb4f195c1cd630bb272cfafd29c2411d80e6adb59c5d5bcdce0a376c9ead94b3 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/1a1fc24e-1133-40cc-bd87-1b051514dfb4/ciphertext.json | 11116 | 85e648ec01a4be87b2acd6e5a909b2eb0cd78f2d7d44d21946a2f77e67ed67d3 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/1b82ad2e-f76e-4cf0-8750-eb22c20fee84/ciphertext.json | 11116 | 2786ef08636fff5fcb2bfae4b8ffef98c97c45b40d78399056c5af56ca5a547c | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/1f0af429-5a1b-45b6-91e5-2328500963ea/ciphertext.json | 11116 | 2a075f47629d203d80f1aa4e83d856dc615171981d04a6a570aec2f61b7ef844 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/1facc6c7-9c4b-4e28-aadd-42f440d59ec5/ciphertext.json | 11116 | 5a8d350b41842372fcc1085d53710491ad4732ec87866d17cd6a025c7c7954b9 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/1ff8d630-9f5c-41c0-8ed7-078d084d1c3c/ciphertext.json | 11116 | 9d6ecc0cac2c3889b57b03fd744fb89950d24e93cc32ccc338264910cbc730f8 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/2064c611-91b0-467d-96c3-e9c0eef115e5/ciphertext.json | 11116 | 46ec4d2c1b58cac18708849f5a6c65b52cabe8cad79c58418ad9abb574415565 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/21b5af31-a06e-4a24-b1ab-bce8c28ec04e/ciphertext.json | 11116 | 1eb64ad67b366d2056318e4f08336b3848f6f87a6cb8f5210f3990877bd8c242 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/22087b78-3852-493d-977d-224eb842fe3e/ciphertext.json | 11116 | 623c51dd781ccf5a2b8685ec1dce8d57147a3a1cec5f31b02b809ea01f403c1e | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/229feec3-191e-4936-a6c3-0f9e1e6d8c09/ciphertext.json | 11116 | 4f03714437958ecc72212029872037704ce918b3df6711e32b44fa57179ca690 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/255674d6-8fb6-4be4-a115-dbfb9c6ddfe4/ciphertext.json | 11116 | e5da375664c34fcc47b24fc392ada12579e0f9140ee89eb61bdbd6fc4242eae4 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/25daab1c-5a42-4886-9305-88e0a3ad494c/ciphertext.json | 11116 | 9f219c86311edd381b751b21e68fb56c8d2cd01d7ca7c91be158ab0e592c7606 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/2b186544-2706-4af5-bb69-82cb8b843f3f/ciphertext.json | 11116 | f90a7d700bf77da3b660731a7d3d775fb1277a21827c494c02ff2c7014c2eff2 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/334c081b-db98-477e-970d-34a660a052b9/ciphertext.json | 11116 | e386930a20494cee3423bd03205fc47043a1d7c632bff78d89bf69ca1cfcf083 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/3776956d-354b-4fe4-bd1f-cce76bffdf06/ciphertext.json | 11116 | f7a4f4aaa80ff39687eb0c606a4667379ed6feeea4b0b27e48270a8c58d771b7 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/37fe8291-7df3-4007-9b7c-cbf3ff688da2/ciphertext.json | 11116 | 21bccbb1d20061a729c858470b2e8b45c5437dd08e3a351b6d9cb92422825c12 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/39c8146a-437b-40f1-b227-87209f5d4827/ciphertext.json | 11116 | 83203422aa571d08b0742be28183248556e75cf969e75f91b2e422301a8f8a7b | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/3c892239-2f03-4b85-b570-8e2624158a60/ciphertext.json | 8321 | 21145d9e01f1c33a9710d17f9b351f01f3447dcf0d8519580afcfb454a03a5ad | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/3d77db80-33e1-4bc6-acce-7bd95eaffeee/ciphertext.json | 8321 | 135d64982db13b987e300f9b7f54504ad3ce31994fc84d4502fff29bead4bb6a | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/4361c507-3d5f-4d44-b0e9-f34f4ff0eb3d/ciphertext.json | 11116 | 42a24bf722617ff6898b065f1de2a56cd3d0dd732b17e2024fbed079835702eb | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/437f7eb5-a2ef-408b-85b3-26c43d86b49e/ciphertext.json | 11116 | 1d5c445329a6425e701fcdfa7a2c571bbe16421190a01de3ed5d03a7bdfb5eb4 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/4826bf84-b9cf-4e21-afa3-930f27b2d1d0/ciphertext.json | 11116 | 7ec788a76935fc1ec949fb08a18b3200c94448252d0b5db0c24cbfb9f7cb8983 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/483c514e-0ce3-4e43-bf80-0b9ee4243a0a/ciphertext.json | 11116 | 839c9d29d9d3da5ac4d9c43e5741c634772b2b85d67191a12a242cc7a6cb5db2 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/493aac66-244a-4bd2-b38a-4ae091bad80e/ciphertext.json | 11116 | b15ea424fbfd25b4ecc0b831f3ff1dc54681414fe2b69a290e05dc6682ba15c2 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/4badac04-5f0b-46f6-8cf4-9deb72123a2d/ciphertext.json | 11116 | bcc1b0f68b24644d92527e6e29e4b726a5f31530af65ba43e6fae0ef45a365a3 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/50594ce3-f112-45b0-9df1-9e5f527df2cc/ciphertext.json | 11116 | b37bcc805e15592420689c50b2657160a720ac21d05ae9a4901f4a093cbbc48c | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/5128c416-d512-40b3-be9b-20e3ed267faf/ciphertext.json | 11116 | 2834d879da37a65824f83f0addfef892a05ac6410a013dc0df2a7bc763de6442 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/5340a20e-fe61-49cc-9a64-a6f1a177876c/ciphertext.json | 11116 | 1e44a3bc3193b5a689696d4c26de3127ededdf8bd48bf1ec363e5ceabb4d385c | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/558cad2b-4472-46c1-9ad8-7a1051914f5c/ciphertext.json | 11116 | b3b50e3fd21126fb47156323442fa28aea22e63761e34098fe4157bbadc0f7a9 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/57892f96-c3d3-481b-b04f-17c52a1dc454/ciphertext.json | 11116 | 62df2f77ad09fa3924e53fa67b68b0a4d82d35ed129a90c7f2a70a266c36aea1 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/5f4a222e-a050-4d8e-84bc-fe8df6c00724/ciphertext.json | 11116 | e5becd2137404523fbc569056ac5f16ac13d5215da97ae8e5a8ff5d5068e51ea | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/60ea4b5a-6f44-45c2-bcad-a48a6b28be35/ciphertext.json | 11116 | ba31d8c6b28e986bd6b4b581ce1c07e644a4b16cbff8b70be070e15a005db791 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/62065363-eecf-480c-95ba-e8475448b017/ciphertext.json | 11116 | f7d3cec49334c80eebd3c3e3ce97ca546721b8975b90cb718b7e3fded1c570f8 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/6416a326-c9f2-4f07-99f1-ed0c96cf6bc8/ciphertext.json | 11116 | 719c1902c1bf4ecd94a157985d78fb46706e1a903aa828c3c4b4056adb1163fc | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/64884072-701b-4b00-97e1-f71894ca7b38/ciphertext.json | 11116 | fa28fcd7ec108f543498c4b96fa4f1752c0ba4221734bfc44850cd2681440ade | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/6d75e438-ffcb-40de-897e-1888066cfac1/ciphertext.json | 11116 | a1e1ae3ac593c4e7ac5ca22efe55802bf6a2735ec033cb7b6dfeeb672307f832 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/71ff80ac-a777-4cb5-908d-2015a887453f/ciphertext.json | 11116 | 385f40c25348f9223d3da19e7c0df3791489c05e679e049aa18e97df734efb32 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/78842bd0-b17c-4170-bc99-e6d5a2854011/ciphertext.json | 11116 | 9f5cfc2b7d0d16bb432d749197f7904a29e8ffe5bc5f4cc2d3198348295ae474 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/78d57e8b-b0a7-4f96-b375-defb77445dd4/ciphertext.json | 11116 | eefb121a727160b69f3abecb03d04eb61b383bcfafa4c696f3e47f7e19857e49 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/795f1320-9d77-452c-9868-af0c058fddfb/ciphertext.json | 11116 | 2956ea5a016ad1476fbe17d06e71ba6bb16b2b9287ed9829756d3b06cd841fd7 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/796b87f0-b95b-4d22-87b7-a925352a99f5/ciphertext.json | 11116 | 56e137486a756108efefeb89aff6af0b14a8446ca51d7beba56bd7426bc56619 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/7a4fd1d7-ef03-424c-9fc9-5493f4c01d57/ciphertext.json | 11116 | 72953e5ed8bea8775cf07acc03ff25f6b98772f48232f8fb078dc225ef806352 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/7ad5e3e3-a9ab-4068-a85d-8ad2322839a8/ciphertext.json | 11116 | dbdce98dea55ef08b46f22f33a4d9ddcf72c0f1650ca6edf7a22d79ad4a18480 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/7b9e52a8-c331-4fad-9568-e7001927a29d/ciphertext.json | 11116 | 8f18611b575815039a0b5e0c3ca9887b22f617c8dcaa35cd17138977a6ee4e0d | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/7da4db0a-e29f-426b-b654-961e3d807a0f/ciphertext.json | 11116 | db0e22a4f4eb07643933e8334cff99df590decfe6f2c88216b6e5f7cf56693b4 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/8029944f-2987-403e-b053-e3248b1977df/ciphertext.json | 11116 | be2fb1f5bdadec018a15dd9abb9dabeb560fef4dd236da41e9360ff180d562e3 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/809bd102-c454-484e-9066-4ec18ffd635b/ciphertext.json | 11116 | 6548ab7a537b53019f7f4dd6abf966f517a6185aa2cd976543b33173d2976a37 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/81bcd8c4-65e1-4d61-a15e-bb27f8472ac4/ciphertext.json | 11116 | 5e00d1c3c5bd012b070399d9021241194673b07af25903fce3e18e1e8efbecd4 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/838d43d5-c535-450d-8fb6-febc69def70e/ciphertext.json | 11116 | 83be942fa4fac4ffe1670621db31cc4c6c509955b9be3c3d61b3b92011f30c79 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/84738a3d-756b-4a10-ac76-3e4e50208a28/ciphertext.json | 11116 | addded54658c431292d3bd14ecdc7bb6378f6d4cfe796211b4f571ab3d63cc22 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/8adfb4ed-5d69-4b6d-af75-633d7903202b/ciphertext.json | 11116 | 95a269dd26553d5ca9904bf973edfdb6eeaa95e7b2aecc76f6190d0623e7d006 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/8dca0f4d-c2e5-403e-b474-e3deac7ef74e/ciphertext.json | 11116 | 81382aba1fe24cfc1d653367cfec4d69110e95443ac370098ac04d10d6b6b025 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/906ca9e5-7280-47ed-b301-30ae46df60da/ciphertext.json | 11116 | 83389769afc036ab4f96637b88112720cb0009189f9b325e3cc67f1886201863 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/9810908a-70c9-4193-848d-e6a8ebec197c/ciphertext.json | 11116 | 2f8973ebd3574a89337d9545e2055b2f24ffe5ce1b91afd1b3caa2314fa204c5 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/a5c06768-c05c-43f9-86c7-878473918a89/ciphertext.json | 11116 | 12b308d39b025160a710340eeb4f765e635c53f40aab90f44879b10149a2f425 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/a640119f-7b03-4d65-bf58-77fec5aa311e/ciphertext.json | 11116 | c9163bd6a9dae32916d880b0597d8c1c83b44854a41a4ce167bb9bcf780c4fd3 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/af390c0c-b7f1-4eda-90f8-7e82c0dc8cbd/ciphertext.json | 11116 | df8e4abff4881cb0a102cb8132e5081a977f6a8d3082b49ba0d037dfa78d30a2 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/afa2f785-1c2e-4054-827e-f80d15e6fcc8/ciphertext.json | 11116 | 05bfeb33f74560ca72c2e11b3739ed882144ebc850d08e78970083afe6e9e391 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/b1927850-a429-4e44-831c-551d64597435/ciphertext.json | 11116 | 199edd10285ad9a4e940a54b2b5bf0bbe06d9616884490935ec5ce07f24dda50 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/b5523b07-4ff4-4b41-8e65-5b5669e6d982/ciphertext.json | 11116 | 7269244f14ed60280eab132244d171b1e2b124231e38c0c00d5129fcf60545ce | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/bac19b6c-c5ae-4c81-9c2b-e2250f572043/ciphertext.json | 11116 | 28ae59034a4934e5450e132a0a63745e48bc13ab0defdd3178adc19e1e0595b8 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/bb82855a-f8b6-4c3b-add7-d22cdfb243e7/ciphertext.json | 11116 | c2379deb62f890c146808ced7d172c196a4294a95b1c4d7868fd35967a562399 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/be2a0b9e-bff4-43cc-96f3-69fb8d41745f/ciphertext.json | 11116 | aa36d6e97fd9c6cd6063460ef700e6f6e786adcf0a59aed9a8380477b2b7dbce | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/c068b9cf-9a44-4b54-87e3-2650266689ec/ciphertext.json | 11116 | 36d600b90293a52f2a8e3f6ca34023aa409fe3ece418b7a07d168d4864da0886 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/c2e93aaf-49ed-4380-b0af-8b85f20cc5d0/ciphertext.json | 11116 | 3314b7c0699c0eb9daf4ccf3954a9070827e0bdf705191c4be0a636704410629 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/ca580588-c46a-44d1-b79b-6e1aa7bcd524/ciphertext.json | 11116 | f6e9acc0587fe160a1592d45e2d1cbdafe53070ff240d8cfa424ed7ad2e22cb3 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/cfb8e3d6-3e6f-4bda-ad26-dddb8c60fa7f/ciphertext.json | 11116 | 43d5c1a3fe402844d838744d94b1dcb8b20f59f9751480de3d493367cf4935ff | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/d247066e-4183-42b5-aa23-803c976fbf5c/ciphertext.json | 11116 | 303b536a800a909ff40aaa75494ccbc7c941f6066b5d09d8961d4fa35e9c8889 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/d3f5d0c3-38e1-4410-af4e-cc12c822145c/ciphertext.json | 11116 | 488ff819dda7d545f73a2a322f7665c356306624c1b0ebcf23d51ca61a0ec0df | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/d5c4fe56-f34a-4280-a188-77b172200c2a/ciphertext.json | 11116 | 926d2521da86b49dd1a24a9dbe26b83da26f03df796760fb04e3ccd8d94d6ca7 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/d6d6b2db-5202-4796-a0cc-45a94d40af68/ciphertext.json | 11116 | 3ee7650af452cde46adc50729ba61ef73e30599687acdc2769c45632a7fcb580 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/d8ea250b-f5e9-4d4f-b671-dacdc59d2521/ciphertext.json | 11116 | 5fd3a742ebf34b8da46cdb19e31e86d38bfed232d6d4e385bffc35fa86f12d72 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/dce34d31-05b0-4f1d-bdeb-82b6330bace9/ciphertext.json | 11116 | 96e34e2e7a338511ca9e457300b0a1703b3d50c3431fc9555ec9afd8f72bb682 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/def5e37b-4afd-48fc-b528-f29cc6c87761/ciphertext.json | 11116 | 1d2ccd87d2525369ba943b2c72c13bc71559bc3e882787831b1b8bd149a2df70 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/e1c63420-7e9b-4291-aa82-f20c5de7c239/ciphertext.json | 11116 | 95dc089177626eed2973d2ed83f1ebbf2d4064f392dcb74da4fcb39d7b989799 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/e22b6cba-7d31-45fe-8425-0d34d32397f6/ciphertext.json | 11116 | b46f7b9009f2a5d8108daa0e999afae6ee6d047244460c1e7c2af465a84ad2a6 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/e4db2d5b-c490-4029-b0ad-1523e0d2f586/ciphertext.json | 11116 | a0e23495876012678ff60d93343fd0cd2ee888e7f3bbb761ccd87834cfbab330 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/e7a94dd7-8add-491e-b6a9-6b813d42bfb5/ciphertext.json | 11116 | bad7369841b1ea6443af34eb6da8e76a1547f16775214dd1f4c684b73bb92021 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/e7e9d031-1209-4681-823b-193079bca17c/ciphertext.json | 8321 | 79fd9bcf5491887e5c87bdf10af436df2b4b74301c7dedff59f87a6d87d58ec9 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/eae79c0a-816b-49be-a62c-cd913977178b/ciphertext.json | 11116 | ceeaf5e33d237184bb3163963e42122be5a0600a337a5efc8af19cbef5f49fd0 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/ebfe2a80-d7a9-4053-a5fe-3c63c95299a8/ciphertext.json | 11116 | 96bfc4e5be662b661072b96717556c64c9019b0ac00c9ca2054860822f388a07 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/ec350431-1790-4fd9-9bca-b379b8fe2cd9/ciphertext.json | 11116 | 7c69dd3af78ffe1a4f16b7044350b8c2845bb20d7b7c73447526423e47e1764a | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/efc1c1eb-7b42-44d3-a457-e5fcbe998537/ciphertext.json | 11116 | 741cb7cce04caad39adf6e36d9d19f5d22a953de616586da879805e936cbac80 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/f76fe63b-15cc-4e36-8982-454c59920830/ciphertext.json | 11116 | 1150af9e0531d0f1dfbe3e6dd7fc7d40c0adec7d88d1ec82861c923d9e64fb88 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/feef758b-a33d-4280-9402-e7b220f3b3ce/ciphertext.json | 11116 | 6681dde3c03c945a1231630a994e0f08d8c4aec88c7750b2e7d012ecaa974df2 | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/ffdde248-8894-4046-a998-1bcbd5846208/ciphertext.json | 11116 | 91974beb073c9c6dcdd4074837fdb562c13614f240f7cbb92f6ce0b0deb5b91c | Relay adapter 契约 oracle 证据·审计/状态记录 JSON |
| evidence/client-relay-contract/results.json | 3719 | ee95a7d478f9f0adc4b3995b751b6a9042e391a29ac40306d653da2edd106aee | Relay adapter 契约 oracle 证据·测试/运行结果记录 JSON |
| evidence/run-final-client.cjs | 2981 | 411d92c8d5b72e381b7b1926788547ccad11bf8520ff50c2718934687fe0a706 | 客户端最终测试运行脚本 |
| prepare-real-client-test.cjs | 4543 | 3fb9b07e6ec30f2c2d89905245de0cdc7778900f7a11c940298f37ae04c5bafc | 客户端真实测试准备脚本 |
| real-client-helper-source.cjs | 3867 | 0aa76329f0fad4fd13a24587ee3962c760b744049bd4369a45b58186a0dd8029 | 真实客户端 helper 源码 |
| real-client-relay-cases.txt | 8835 | 8f5cc8cb438cf5cce3600c571f384abfe4789e8a0ab82db45a069ded32be38e4 | 客户端 Relay 测试用例清单 |

## 四、服务器证据

范围：server-relay-run-* / server-relay-concurrency / server-old-generation-retention / server-build-checks / 运行时基础设施。

| 路径 | 字节 | SHA256 | 用途 |
|---|---|---|---|
| evidence/after-retention-fix/runtime-start.log | 666 | 3fb5a9498a7eee36d0f64f47dbb0e6427cbfe3b5fda7701806eb000ca869fb5d | retention 修复后补测证据·原始运行日志 |
| evidence/after-retention-fix/runtime-stop.log | 137 | 140787733b82669caf4a86e92d54ef0598c2241ba3f5d27a1a52511a8408063d | retention 修复后补测证据·原始运行日志 |
| evidence/after-retention-fix/server-build.log | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 | retention 修复后补测证据·原始运行日志 |
| evidence/after-retention-fix/server-old-generation-retention.log | 215 | 58c41d032f91b3094b41bfa834119083f76a4f88b755b3d9fa5d22ab25a0cea7 | retention 修复后补测证据·原始运行日志 |
| evidence/after-retention-fix/server-old-generation-retention-results.json | 748 | 008364993b0ecdd99d44a970fc742a555e47638524ba8f472c107bf04951fde1 | retention 修复后补测证据·测试/运行结果记录 JSON |
| evidence/after-retention-fix/server-relay.log | 1878 | 7dc4590f4a1ee105c2d321bdbc228c9034dd35cc495a15713adea02298c2b43d | retention 修复后补测证据·原始运行日志 |
| evidence/after-retention-fix/server-relay-concurrency.log | 199 | 273e20b74f302c726c5407b8f69e03002e255f4191a2b7ecb1e520f30117d7fd | retention 修复后补测证据·原始运行日志 |
| evidence/after-retention-fix/server-relay-concurrency-results.json | 696 | 21ea5cfceddde7da0cb983b8623c32baba3e63f64d82328c995af0df6f97d692 | retention 修复后补测证据·测试/运行结果记录 JSON |
| evidence/after-retention-fix/server-relay-results.json | 4380 | 85e63c837cf2dc2bb857b9ae981bbcc1aae158265d35218b16977d842901171f | retention 修复后补测证据·测试/运行结果记录 JSON |
| evidence/after-retention-fix/server-source-generated-sha256.json | 1145 | 444a3a8d3314ee93ca27aedfa159e636e471dd0ff8d28d2f228ec990010ee788 | retention 修复后补测证据·审计/状态记录 JSON |
| evidence/after-retention-fix/server-typecheck.log | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 | retention 修复后补测证据·原始运行日志 |
| evidence/prepare-databases.cjs | 1938 | 2e6b3e2deda93e26af412ea332d1182b426782e3871fb6cfca2c8a89d4e3740b | 测试数据库准备脚本 |
| evidence/run-server-build-checks.cjs | 3206 | abad735863baea98d22ab755345ed016c69d8b67bd9c790d5067bdea6911e20b | server 独立构建检查运行脚本 |
| evidence/runtime-readiness.json | 696 | f09d1780abb4304312cde9a3855cfe249e918b2a1a75e99d38e1733fa4e20f1c | 运行时就绪状态记录 |
| evidence/runtime-readonly-facts.json | 1854 | 9ed371f4b1a0165a17462c3a82d7d28632a9271d9166d3f7b329d92c23d68fd8 | PG 只读原字节/ACK/请求记忆核验 |
| evidence/runtime-start.log | 1113 | 2b4a2048580a3434570cee26ad18e40cc7580d3843eda29474ea6cae6d3ca9a5 | 运行时启动日志（原不完整日志保留） |
| evidence/runtime-start-completed.log | 713 | 2ae3d215e479e4321ac833ecd7d0af4ec21e8ef0ed3c46faf9ebc0c527757f08 | 运行时启动完成日志 |
| evidence/runtime-start-incomplete.log | 1113 | 2b4a2048580a3434570cee26ad18e40cc7580d3843eda29474ea6cae6d3ca9a5 | 运行时启动不完整日志（保留） |
| evidence/runtime-stop.log | 137 | 140787733b82669caf4a86e92d54ef0598c2241ba3f5d27a1a52511a8408063d | 运行时停止日志 |
| evidence/server-build-checks/final/build.log | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 | server 独立构建/typecheck 证据·原始运行日志 |
| evidence/server-build-checks/final/results.json | 2977 | e548d64e8b83165ed3d7039ad6e9d13945bcedda2250ede2ee85fb4904d93220 | server 独立构建/typecheck 证据·测试/运行结果记录 JSON |
| evidence/server-build-checks/final/typecheck.log | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 | server 独立构建/typecheck 证据·原始运行日志 |
| evidence/server-build-checks/retention-final/build.log | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 | server 独立构建/typecheck 证据·原始运行日志 |
| evidence/server-build-checks/retention-final/results.json | 3007 | 1857be32ceb46f1e279fa38b977d4cb8fc557be9b455eca5e6216ac1503b425f | server 独立构建/typecheck 证据·测试/运行结果记录 JSON |
| evidence/server-build-checks/retention-final/typecheck.log | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 | server 独立构建/typecheck 证据·原始运行日志 |
| evidence/server-relay-concurrency.log | 199 | 273e20b74f302c726c5407b8f69e03002e255f4191a2b7ecb1e520f30117d7fd | 原始运行日志 |
| evidence/server-relay-concurrency/results.json | 696 | ed78163b94181cbe9b112ab9c9b94acf66fe4ed55b813da9769e675a7b43add1 | 服务器首次入队并发补测证据（2/2）·测试/运行结果记录 JSON |
| evidence/server-relay-run-01.log | 207 | 9082ca608326ed20d0763bcd4298576fc84fda061c4b180f8ff29ae604cc9475 | 原始运行日志 |
| evidence/server-relay-run-01/results.json | 1408 | 27a77c5970fd7598992b2c4c99ed66237e5084fa3c481e74ada6d7120c563c5f | 服务器 Relay 测试运行证据（run01）·测试/运行结果记录 JSON |
| evidence/server-relay-run-02.log | 517 | 8c0d6a8fcedf44bfde8f410e61f3507590c3020ce1490e2ce367746b5e2edbf3 | 原始运行日志 |
| evidence/server-relay-run-02/results.json | 1784 | cb540ec42cfc38039358a78a348a534a323620eb93866f5efaa6dbf542dd1986 | 服务器 Relay 测试运行证据（run02）·测试/运行结果记录 JSON |
| evidence/server-relay-run-03.log | 1602 | d27b5422dd9b6a8604d5ccfde2c6e72e79baa7369e5b3f4f1dec4cd200bacb3f | 原始运行日志 |
| evidence/server-relay-run-03/results.json | 3756 | 0a02dece5b63fe255765f479e6abc8d5dbf766c575559d7abc882c4d90758885 | 服务器 Relay 测试运行证据（run03）·测试/运行结果记录 JSON |
| evidence/server-relay-run-04.log | 1915 | 1585dc12f1116c5179586bfa9ced3e8ba92991a22f8b567b92227132686b2f1c | 原始运行日志 |
| evidence/server-relay-run-04/results.json | 4987 | 4345f2d549b798dfa7e6fdf832003f1f3b7b011c3d7b36de2bce3e98c80d3e52 | 服务器 Relay 测试运行证据（run04）·测试/运行结果记录 JSON |
| evidence/server-relay-run-05.log | 1878 | 7dc4590f4a1ee105c2d321bdbc228c9034dd35cc495a15713adea02298c2b43d | 原始运行日志 |
| evidence/server-relay-run-05/results.json | 4378 | 8ba3d7831b9f267fa331e855cafdfde8bd6175c0a7eced57810dc2ad24c28443 | 服务器 Relay 测试运行证据（run05，最终 20/20）·测试/运行结果记录 JSON |
| evidence/start-postgres.ps1 | 4553 | 975b89b51173fef7f7e34f34134d8413b762ee08c35ed987f97c429387255917 | PostgreSQL 启动脚本 |
| evidence/stop-postgres.ps1 | 774 | ebcb1aa28f872af58d02e2798f46af4d9ba7e29ffd29bd31b2159ba69b2ab11a | PostgreSQL 停止脚本 |
| server-relay-tests.mjs | 44634 | cf326ef6c033e8867ad1a9f124d7a21864cdbef741e2d4bc1c0961187ce61872 | 服务器 Relay 测试 harness（20 项 + --concurrency-only 2 项） |

## 五、历史回归

范围：history-b24 / history-c1 / history-b-auth / history-c2b-pure / history-c2b-http。

| 路径 | 字节 | SHA256 | 用途 |
|---|---|---|---|
| evidence/history-b24/implementation/contract-regression-results.json | 67495 | e53b6667a9ddb83c6583644e3b38e7235f2ab209920a673f72f9ad5fd80bd321 | B2.4 ContractAdapter 逻辑 fixture 历史回归证据·测试/运行结果记录 JSON |
| evidence/history-b24/implementation/contract-regressions/b2-cross-device-core/adapter-content.contract.cjs | 15044 | 6945a5a94980165bedca4f0e68228d5df5d24e35fd01e83efa83318332effb79 | B2.4 ContractAdapter 逻辑 fixture 历史回归证据·测试/证据生成脚本 |
| evidence/history-b24/implementation/contract-regressions/b2-cross-device-core/adapter-content.contract.log | 51 | ac8f70ef0546115c06fa4defca865b32d52331cecb53ebf96b604b491e3273d9 | B2.4 ContractAdapter 逻辑 fixture 历史回归证据·原始运行日志 |
| evidence/history-b24/implementation/contract-regressions/b2-cross-device-core/adapter-content.contract-results.json | 3159 | c423ebc8537354e7dc259c8cc8e4d810439e9552621c3df33caa021824756b42 | B2.4 ContractAdapter 逻辑 fixture 历史回归证据·测试/运行结果记录 JSON |
| evidence/history-b24/implementation/contract-regressions/b2-cross-device-core/contract-results.json | 13863 | d1ee44a00ba3a92ad66779573f5a3f12f3b7a4ccac866520b89730948f44659a | B2.4 ContractAdapter 逻辑 fixture 历史回归证据·测试/运行结果记录 JSON |
| evidence/history-b24/implementation/contract-regressions/b2-cross-device-core/contract-test-helpers.cjs | 5481 | 514f57c1200381278c1672fe27dd46f82afc4bace058a805e52216ffb0cabcb2 | B2.4 ContractAdapter 逻辑 fixture 历史回归证据·测试/证据生成脚本 |
| evidence/history-b24/implementation/contract-regressions/b2-cross-device-core/contract-tests.cjs | 25191 | 4082e9f98c0c7ff66cfbf49e118f043ab5766bbafb489df5187d890c43972573 | B2.4 ContractAdapter 逻辑 fixture 历史回归证据·测试/证据生成脚本 |
| evidence/history-b24/implementation/contract-regressions/b2-cross-device-core/contract-tests.log | 37 | 6000beafa39602e7100022c40bb736e334c2147f05f540f8bb2bfca5824cec4f | B2.4 ContractAdapter 逻辑 fixture 历史回归证据·原始运行日志 |
| evidence/history-b24/implementation/contract-regressions/b2-cross-device-core/prototype-contract-results.json | 2215 | f131f167017ca075ba38c61ca277a15b916df9b6c75e343eb785fe9e7068208f | B2.4 ContractAdapter 逻辑 fixture 历史回归证据·测试/运行结果记录 JSON |
| evidence/history-b24/implementation/contract-regressions/b2-cross-device-core/prototype-contract-tests.cjs | 11418 | b618dda036ed09e2687d5f6c9b63c9f9a894b130d8fc9c01d97ae4e5d8a47c89 | B2.4 ContractAdapter 逻辑 fixture 历史回归证据·测试/证据生成脚本 |
| evidence/history-b24/implementation/contract-regressions/b2-cross-device-core/prototype-contract-tests.log | 49 | 474043bcf212fff7b497212dc80b636d1c21d274c5a3a41a6b6992ea475c5866 | B2.4 ContractAdapter 逻辑 fixture 历史回归证据·原始运行日志 |
| evidence/history-b24/implementation/contract-regressions/b2-cross-device-core/storage-contract-tests.cjs | 26840 | b55055fc10e52498c3c10278a1ec58334059194839e93d2c29f1759836d2ba32 | B2.4 ContractAdapter 逻辑 fixture 历史回归证据·测试/证据生成脚本 |
| evidence/history-b24/implementation/contract-regressions/b2-state-extensions/state-test-fixture.cjs | 8682 | fe9075f7394dd6520b1477575bcc7feb3ad6d3ddc1b33acfdd7861536c956440 | B2.4 ContractAdapter 逻辑 fixture 历史回归证据·测试/证据生成脚本 |
| evidence/history-b24/implementation/contract-regressions/b2-world-home-registry/contract-results.json | 6601 | 41e12956b02efbe9c4deef23fd0390005df43af4ada481438a39be133c5c532a | B2.4 ContractAdapter 逻辑 fixture 历史回归证据·测试/运行结果记录 JSON |
| evidence/history-b24/implementation/contract-regressions/b2-world-home-registry/contract-tests.cjs | 30951 | cc13f861327f123ce74a7aef5f583fe71a3577ce967899070e841b8692ab05e5 | B2.4 ContractAdapter 逻辑 fixture 历史回归证据·测试/证据生成脚本 |
| evidence/history-b24/implementation/contract-regressions/b2-world-home-registry/contract-tests.log | 36 | e722846b7f5c377f056d8ed8312796f9568d0107fa47a2299fbb16958df69f08 | B2.4 ContractAdapter 逻辑 fixture 历史回归证据·原始运行日志 |
| evidence/history-b24/implementation/contract-regressions/b2-world-migration/authority-contract-results.json | 6136 | 5a2bb52eb72701be975cf715dbbb9a7f1b904ac7b4a19f212a4fdf3b3ecaba3a | B2.4 ContractAdapter 逻辑 fixture 历史回归证据·测试/运行结果记录 JSON |
| evidence/history-b24/implementation/contract-regressions/b2-world-migration/authority-contract-tests.cjs | 30882 | 576f100f43677ff4f877b1ac185484f44f2cc06c5df164be8bab57fa38d8f0b4 | B2.4 ContractAdapter 逻辑 fixture 历史回归证据·测试/证据生成脚本 |
| evidence/history-b24/implementation/contract-regressions/b2-world-migration/authority-contract-tests.log | 61 | 06acea81a5bb9e3772323f2cd68622dd66501892cea0e85b653e2f65c5ad4bed | B2.4 ContractAdapter 逻辑 fixture 历史回归证据·原始运行日志 |
| evidence/history-b24/implementation/contract-regressions/b2-world-migration/boundary-contract-results.json | 1572 | 0b29c6157d90646743b2d2aec83f14892a4828a96437900de2f233b3fa010b6c | B2.4 ContractAdapter 逻辑 fixture 历史回归证据·测试/运行结果记录 JSON |
| evidence/history-b24/implementation/contract-regressions/b2-world-migration/boundary-contract-tests.cjs | 9889 | f37e14720be797569030516269fad5aec9a280f921fcfb0f219b49ac04d10fc6 | B2.4 ContractAdapter 逻辑 fixture 历史回归证据·测试/证据生成脚本 |
| evidence/history-b24/implementation/contract-regressions/b2-world-migration/boundary-contract-tests.log | 1572 | 0b29c6157d90646743b2d2aec83f14892a4828a96437900de2f233b3fa010b6c | B2.4 ContractAdapter 逻辑 fixture 历史回归证据·原始运行日志 |
| evidence/history-b24/implementation/contract-regressions/b2-world-migration/drain-contract-results.json | 4091 | c677dd833d15fcc561384f71281920282a11dfd0c4356c6d0ecdf566af2b4611 | B2.4 ContractAdapter 逻辑 fixture 历史回归证据·测试/运行结果记录 JSON |
| evidence/history-b24/implementation/contract-regressions/b2-world-migration/drain-contract-tests.cjs | 21001 | 1094020e1ca4c48156947a40599185c7243ee20d0a724b7f4c19b29c961bb576 | B2.4 ContractAdapter 逻辑 fixture 历史回归证据·测试/证据生成脚本 |
| evidence/history-b24/implementation/contract-regressions/b2-world-migration/drain-contract-tests.log | 4091 | c677dd833d15fcc561384f71281920282a11dfd0c4356c6d0ecdf566af2b4611 | B2.4 ContractAdapter 逻辑 fixture 历史回归证据·原始运行日志 |
| evidence/history-b24/implementation/contract-regressions/b2-world-migration/prototype-contract-results.json | 3566 | 7990fae44df66b6d12e8f25f5fa5fcce6367f31df77c33ca9e0b30f5e028a4f7 | B2.4 ContractAdapter 逻辑 fixture 历史回归证据·测试/运行结果记录 JSON |
| evidence/history-b24/implementation/contract-regressions/b2-world-migration/prototype-contract-tests.cjs | 19533 | cb268e7e7fb132d127f3b8908fe8dd84de3f9d543979aca6ffc110ee81f37001 | B2.4 ContractAdapter 逻辑 fixture 历史回归证据·测试/证据生成脚本 |
| evidence/history-b24/implementation/contract-regressions/b2-world-migration/prototype-contract-tests.log | 1369 | dfb519498da41a489576b7ff37be8157008617deb08b564f5e58324209ea2630 | B2.4 ContractAdapter 逻辑 fixture 历史回归证据·原始运行日志 |
| evidence/history-b24/implementation/contract-regressions/b2-world-migration/storage-contract-results.json | 5368 | 339665ffbf2f9726ee3fd7635386b1df509dca75265fdc4a209b38593c4cf512 | B2.4 ContractAdapter 逻辑 fixture 历史回归证据·测试/运行结果记录 JSON |
| evidence/history-b24/implementation/contract-regressions/b2-world-migration/storage-contract-tests.cjs | 36105 | 350180fd55cf1f84a20be179ade1a1986d769df187bdf44b371dc5657b1f3b04 | B2.4 ContractAdapter 逻辑 fixture 历史回归证据·测试/证据生成脚本 |
| evidence/history-b24/implementation/contract-regressions/b2-world-migration/storage-contract-tests.log | 3561 | 27a9914870b09dd8bbd153f64725fed778ba83883718d2f80b6adbfdac0f0710 | B2.4 ContractAdapter 逻辑 fixture 历史回归证据·原始运行日志 |
| evidence/history-b24/implementation/regression.log | 2187 | 96c029ee5f48aaf3c5f8af148538ec0507e4813b9a12acfc87debb49ada33fe4 | B2.4 ContractAdapter 逻辑 fixture 历史回归证据·原始运行日志 |
| evidence/history-b24/implementation/results.json | 1522 | 701405268ecbdf6ba21f43d9a90d4b79f532dbc2ae96c343d0f160d5da56f8b8 | B2.4 ContractAdapter 逻辑 fixture 历史回归证据·测试/运行结果记录 JSON |
| evidence/history-b24/implementation/run-contract-regressions.cjs | 9536 | 0f4e54522c71b00d7da3ed7d85af83fac4cf46e6ad71a6872a4a4c453a8557bb | B2.4 ContractAdapter 逻辑 fixture 历史回归证据·测试/证据生成脚本 |
| evidence/history-b-auth/implementation/client/http-requests.json | 1224 | ca6648bc526c44f74f4ef8c805c75676cf17d840bc6465fad53590f46143fe48 | 旧 b 认证历史回归证据·审计/状态记录 JSON |
| evidence/history-b-auth/implementation/client/results-contract-and-http.json | 3233 | 6962a10efc5c7c32bf735dd8015c32507d1bb54ee9feba0d9603fbfbcb3001af | 旧 b 认证历史回归证据·审计/状态记录 JSON |
| evidence/history-b-auth/implementation/client/run.cjs | 20258 | 7f716a8ebb4d0c1f2ab240b847f266201e033d5f4f58c233420da43f0e37be76 | 旧 b 认证历史回归证据·测试/证据生成脚本 |
| evidence/history-b-auth/implementation/old-client-contract-and-http.log | 1708 | 68e58422c00167c344386e8823948994efdad9de48ae3c7c5104a4b3d435aa0d | 旧 b 认证历史回归证据·原始运行日志 |
| evidence/history-b-auth/implementation/old-server-http.log | 4292 | dc46cc34927cf840dbca6389c00e61a447296ac7084b2982f74d6e8105ab3c67 | 旧 b 认证历史回归证据·原始运行日志 |
| evidence/history-b-auth/implementation/results.json | 6883 | f3c011cefebba595fc9762d3a2133dd1588d6abf43121983d2737d4921e6e552 | 旧 b 认证历史回归证据·测试/运行结果记录 JSON |
| evidence/history-b-auth/implementation/server/dist/src/app.js | 22607 | 5b942283350d2addf3858363a691fdf3b7924533a3389cc098a22b8e0886cc51 | 旧 b 认证历史回归证据·编译产物 JS |
| evidence/history-b-auth/implementation/server/dist/src/cli.js | 1713 | a817b530bb49bd854d865f2fbf0aa42902ed81f8c908c867fc868e09f01c68d6 | 旧 b 认证历史回归证据·编译产物 JS |
| evidence/history-b-auth/implementation/server/dist/src/config.js | 1177 | e1150fe360f327e67e78ba6a3a62143d55638917273728b4069cabadc31582ba | 旧 b 认证历史回归证据·编译产物 JS |
| evidence/history-b-auth/implementation/server/dist/src/contracts.js | 11 | 8e609bb71c20b858c77f0e9f90bb1319db8477b13f9f965f1a1e18524bf50881 | 旧 b 认证历史回归证据·编译产物 JS |
| evidence/history-b-auth/implementation/server/dist/src/crypto.js | 4376 | 0e25a55a857013b10346d35af4d3b07426040f19fc2ba21db0f07bb8032aea1b | 旧 b 认证历史回归证据·编译产物 JS |
| evidence/history-b-auth/implementation/server/dist/src/db.js | 2134 | 4b10d77a9f8f002606c48a4cd8a323b7ebdda2984966db592ae36ea9bd1a8486 | 旧 b 认证历史回归证据·编译产物 JS |
| evidence/history-b-auth/implementation/server/dist/src/main.js | 1204 | cc30a932f1d0dbdd1043dbd330830b67b71366926582ed6f0104fb42bb55ab40 | 旧 b 认证历史回归证据·编译产物 JS |
| evidence/history-b-auth/implementation/server/dist/src/strict-json.js | 2874 | 7074c5d639e2c3f84d4c639d2b19f8de36c1bd29de2640d70d17bf6019ace51d | 旧 b 认证历史回归证据·编译产物 JS |
| evidence/history-b-auth/implementation/server/dist/test/http.test.js | 20031 | 4411acf80e0b722cb46c86532bd744fa9004c9cf32842736d4dfb24af1172146 | 旧 b 认证历史回归证据·编译产物 JS |
| evidence/history-b-auth/implementation/server/dist/test/main-process.test.js | 6506 | 133194b6e52fdf8a0e9e60426c540d9b025ab92873847beb9e8c3849ef8e0cb6 | 旧 b 认证历史回归证据·编译产物 JS |
| evidence/history-b-auth/implementation/server/migrations/001.sql | 2326 | 5468eb425557c8ca1be6c5fb969dbd5bb038e7715b10e9f4842ea15859a30d13 | 旧 b 认证历史回归证据·SQL 迁移脚本 |
| evidence/history-b-auth/implementation/server/package.json | 667 | 2599ae4a12a65e4e46650bea6405f9788b1f4a70a0ceed3f23c6e882b0488f7a | 旧 b 认证历史回归证据·审计/状态记录 JSON |
| evidence/history-b-auth/implementation/server-isolated-build.log | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 | 旧 b 认证历史回归证据·原始运行日志 |
| evidence/history-b-auth/implementation/tsconfig-history.json | 1378 | 424d8f7be9a88d1a6c1ce3652a7f0d7fb3c27dde507f286fa9203e4b7d58cc40 | 旧 b 认证历史回归证据·审计/状态记录 JSON |
| evidence/history-c1/implementation/evidence/build/SharedCanonicalBytes.js | 15717 | ceaa486b54f0c7ca1096c301149514124940fcdf9b6acca1ece9e902b0c71cb2 | c-1 canonical/validator/replay 历史回归证据·编译产物 JS |
| evidence/history-c1/implementation/evidence/build/SharedCommitCodec.js | 43978 | 7ec12d746e544e095b41dbe4717700e280a38c007bbd77918fabec585d4cef5b | c-1 canonical/validator/replay 历史回归证据·编译产物 JS |
| evidence/history-c1/implementation/evidence/build/SharedCommitContracts.js | 77 | d43aa81f5bc89faa359e0f97c814ba25155591ff078fbb9bfd40f8c7c9683230 | c-1 canonical/validator/replay 历史回归证据·编译产物 JS |
| evidence/history-c1/implementation/evidence/build/SharedCommitValidator.js | 29640 | cee78e4716cbee619d304e8123bb2a29ee28b5d8698a0bab6edd4829bfebcdbe | c-1 canonical/validator/replay 历史回归证据·编译产物 JS |
| evidence/history-c1/implementation/evidence/build/SharedWorldReducer.js | 25881 | 16959cf9c23a56d4dfdcd020c1bf372658087ec7f4e738d456063335a6fbbe61 | c-1 canonical/validator/replay 历史回归证据·编译产物 JS |
| evidence/history-c1/implementation/evidence/fixtures.cjs | 28058 | 1926c37fcfac3ed12b76c3335148d041961161f606046bc2cbf5575fd1959bbe | c-1 canonical/validator/replay 历史回归证据·测试/证据生成脚本 |
| evidence/history-c1/implementation/evidence/no-network.cjs | 1233 | 304106476c3437e8366b0419a7fd22fa8a8f217b69696a81c29de123c5934ff4 | c-1 canonical/validator/replay 历史回归证据·测试/证据生成脚本 |
| evidence/history-c1/implementation/evidence/validator-tests.cjs | 17591 | 95977c043fddd391f3a760794dad5c0da880acffacb408a25796761cd2d602c2 | c-1 canonical/validator/replay 历史回归证据·测试/证据生成脚本 |
| evidence/history-c1/implementation/isolated-build.log | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 | c-1 canonical/validator/replay 历史回归证据·原始运行日志 |
| evidence/history-c1/implementation/junit.xml | 39153 | d24c062a5d7b86d1a87a354449973b10760078f199ff78b52bf17c0b4b7aa837 | c-1 canonical/validator/replay 历史回归证据·JUnit 测试报告 |
| evidence/history-c1/implementation/regression.log | 32484 | b2df69ec03b414a4d35dd31c896d28c4a415521024c166b6bf663f58823c1dcf | c-1 canonical/validator/replay 历史回归证据·原始运行日志 |
| evidence/history-c1/implementation/results.json | 8173 | 16586c5c5a3b4a6a19428f770f2152d1453e39b70df0ef4286143f66473d3fed | c-1 canonical/validator/replay 历史回归证据·测试/运行结果记录 JSON |
| evidence/history-c1/implementation/tests/codec-tests.cjs | 16594 | c4d3e7fd37cdf3d7db60d7fbc0331cc5da40387827d756b05ff7865f62960166 | c-1 canonical/validator/replay 历史回归证据·测试/证据生成脚本 |
| evidence/history-c1/implementation/tests/replay-tests.cjs | 27895 | b3157f0b0feb71e16bc49cd31a9bfcb8c1317def367823344be0638ca7aa8df7 | c-1 canonical/validator/replay 历史回归证据·测试/证据生成脚本 |
| evidence/history-c2b-http/authority-adapter.log | 1098 | e83536e792f42629d649608d13163668842785e34e00f9939716353eebcd9fe6 | c-2b 真实 authority HTTP/PG 历史回归证据·原始运行日志 |
| evidence/history-c2b-http/client/client-real-http.cjs | 21612 | 4f3748e11bd87f65d355d145d342aa93160f7fb48790f81c95295b5efeafda6f | c-2b 真实 authority HTTP/PG 历史回归证据·测试/证据生成脚本 |
| evidence/history-c2b-http/client/evidence/client-real-compiled/assets/scripts/SharedRelayPrototypeBuilder.js | 1613 | c31f1f793a3cff1e2cd1885c09cadd547d422e28c2b584ad3f8ca8e470f56d00 | c-2b 真实 authority HTTP/PG 历史回归证据·编译产物 JS |
| evidence/history-c2b-http/client/evidence/client-real-compiled/src/director/SharedCanonicalBytes.js | 15717 | ceaa486b54f0c7ca1096c301149514124940fcdf9b6acca1ece9e902b0c71cb2 | c-2b 真实 authority HTTP/PG 历史回归证据·编译产物 JS |
| evidence/history-c2b-http/client/evidence/client-real-compiled/src/director/SharedCommitCodec.js | 43978 | 7ec12d746e544e095b41dbe4717700e280a38c007bbd77918fabec585d4cef5b | c-2b 真实 authority HTTP/PG 历史回归证据·编译产物 JS |
| evidence/history-c2b-http/client/evidence/client-real-compiled/src/director/SharedServiceProtocolCodec.js | 18211 | 1182df7457e9d45d91f435ca2f8243657ba5f332da8ad972c3458fcd72a20694 | c-2b 真实 authority HTTP/PG 历史回归证据·编译产物 JS |
| evidence/history-c2b-http/client/evidence/client-real-compiled/src/presentation/RealSharedServiceSessionAdapter.js | 45297 | 385818f28938dde601592faef502448a6d00300ec5a97ffdd1a09ead216035d5 | c-2b 真实 authority HTTP/PG 历史回归证据·编译产物 JS |
| evidence/history-c2b-http/client/evidence/client-real-compiled/src/presentation/RealWorldAuthorityAdapter.js | 4413 | b20bb581767897293d918347e873967c690d21f80e7a727634eb241db6e91d83 | c-2b 真实 authority HTTP/PG 历史回归证据·编译产物 JS |
| evidence/history-c2b-http/client/evidence/client-real-http-results.json | 3496 | 4d62212203f5480ae69f140fe63a6cea25fd0cb96c4450be3b02877dc9b7531e | c-2b 真实 authority HTTP/PG 历史回归证据·测试/运行结果记录 JSON |
| evidence/history-c2b-http/results.json | 4548 | eeae074c4d0e08e459d204784c8f3af009eae229c3cc2a6fee4f688dc6b06d6d | c-2b 真实 authority HTTP/PG 历史回归证据·测试/运行结果记录 JSON |
| evidence/history-c2b-http/server/.shared-kernel |  | 0ce6373fb84ca71d4b5f170ce441d0e2bf17a70dcdb685d8d3b3ecbd9e9034b4 | c-2b 真实 authority HTTP/PG 历史回归证据·文件 |
| evidence/history-c2b-http/server/package.json | 18 | 1239d4d885dcad42201a27ed9324f8f0f760b78700d8db9ced39a511cffe7eae | c-2b 真实 authority HTTP/PG 历史回归证据·审计/状态记录 JSON |
| evidence/history-c2b-http/server/src |  | 02a2eb5cef3c175c121f6bd73ae74b728b21200adab13be503a7085f875a7170 | c-2b 真实 authority HTTP/PG 历史回归证据·文件 |
| evidence/history-c2b-http/server/test/shared-clock-migration.test.js | 4133 | 7b953d04c29483f33821810ca3594e60e4e5e37124c1b3867a62ddac54f81b38 | c-2b 真实 authority HTTP/PG 历史回归证据·编译产物 JS |
| evidence/history-c2b-http/server/test/shared-http.test.js | 41917 | 3993253ee259255d700935cf0eaecc004d0a1c879a30740b1a0a4ccd1ce4099a | c-2b 真实 authority HTTP/PG 历史回归证据·编译产物 JS |
| evidence/history-c2b-http/shared-authority.log | 2430 | 93ea3f4169c0600a365eef70f828b3d87428c846a698cee7ce195fb5263d3318 | c-2b 真实 authority HTTP/PG 历史回归证据·原始运行日志 |
| evidence/history-c2b-http/shared-clock-migration.test.ts | 3519 | 498885b2c23262b024313c789a7a7c06fc72dfff791fda05146731dee7170a67 | c-2b 真实 authority HTTP/PG 历史回归证据·源码快照 |
| evidence/history-c2b-http/shared-http.test.ts | 39270 | f3c963d5ec02ed8e4346045b1627272dbacb2786b4aeb2f0590ff37351e24164 | c-2b 真实 authority HTTP/PG 历史回归证据·源码快照 |
| evidence/history-c2b-http/verified-results.json | 3794 | 17a9cd25aa325fc92bbd1e5a45a1d869d8358e76d18bd6a2e7a357441bcbe3dd | c-2b 真实 authority HTTP/PG 历史回归证据·测试/运行结果记录 JSON |
| evidence/history-c2b-pure/client-contract.log | 1170 | 003ff7c28d1e42b33ca17896c461934e2a66a9d4fce260c2176a544f055f5b9c | c-2b protocol/transport oracle 历史回归证据·原始运行日志 |
| evidence/history-c2b-pure/client-contract-tests.cjs | 18567 | 7c7d886a8233ca5786855aa65c44cdb032e8f4956e6d4ae2b6da82288a3a5ff8 | c-2b protocol/transport oracle 历史回归证据·测试/证据生成脚本 |
| evidence/history-c2b-pure/evidence/client-compiled/src/director/SharedCanonicalBytes.js | 15717 | ceaa486b54f0c7ca1096c301149514124940fcdf9b6acca1ece9e902b0c71cb2 | c-2b protocol/transport oracle 历史回归证据·编译产物 JS |
| evidence/history-c2b-pure/evidence/client-compiled/src/director/SharedCommitCodec.js | 43978 | 7ec12d746e544e095b41dbe4717700e280a38c007bbd77918fabec585d4cef5b | c-2b protocol/transport oracle 历史回归证据·编译产物 JS |
| evidence/history-c2b-pure/evidence/client-compiled/src/director/SharedServiceProtocolCodec.js | 18211 | 1182df7457e9d45d91f435ca2f8243657ba5f332da8ad972c3458fcd72a20694 | c-2b protocol/transport oracle 历史回归证据·编译产物 JS |
| evidence/history-c2b-pure/evidence/client-compiled/src/presentation/RealSharedServiceSessionAdapter.js | 45297 | 385818f28938dde601592faef502448a6d00300ec5a97ffdd1a09ead216035d5 | c-2b protocol/transport oracle 历史回归证据·编译产物 JS |
| evidence/history-c2b-pure/evidence/client-compiled/src/presentation/RealWorldAuthorityAdapter.js | 4413 | b20bb581767897293d918347e873967c690d21f80e7a727634eb241db6e91d83 | c-2b protocol/transport oracle 历史回归证据·编译产物 JS |
| evidence/history-c2b-pure/evidence/protocol/build/RealServiceContracts.js | 77 | d43aa81f5bc89faa359e0f97c814ba25155591ff078fbb9bfd40f8c7c9683230 | c-2b protocol/transport oracle 历史回归证据·编译产物 JS |
| evidence/history-c2b-pure/evidence/protocol/build/SharedCanonicalBytes.js | 15717 | ceaa486b54f0c7ca1096c301149514124940fcdf9b6acca1ece9e902b0c71cb2 | c-2b protocol/transport oracle 历史回归证据·编译产物 JS |
| evidence/history-c2b-pure/evidence/protocol/build/SharedCommitCodec.js | 43978 | 7ec12d746e544e095b41dbe4717700e280a38c007bbd77918fabec585d4cef5b | c-2b protocol/transport oracle 历史回归证据·编译产物 JS |
| evidence/history-c2b-pure/evidence/protocol/build/SharedCommitContracts.js | 77 | d43aa81f5bc89faa359e0f97c814ba25155591ff078fbb9bfd40f8c7c9683230 | c-2b protocol/transport oracle 历史回归证据·编译产物 JS |
| evidence/history-c2b-pure/evidence/protocol/build/SharedServiceProtocolCodec.js | 18211 | 1182df7457e9d45d91f435ca2f8243657ba5f332da8ad972c3458fcd72a20694 | c-2b protocol/transport oracle 历史回归证据·编译产物 JS |
| evidence/history-c2b-pure/evidence/protocol/build/SharedServiceProtocolContracts.js | 77 | d43aa81f5bc89faa359e0f97c814ba25155591ff078fbb9bfd40f8c7c9683230 | c-2b protocol/transport oracle 历史回归证据·编译产物 JS |
| evidence/history-c2b-pure/evidence/protocol/results.json | 2949 | abbaffec74c478efb0f0a609f032e50300fdbd74ce27edbef079d6a338925fa4 | c-2b protocol/transport oracle 历史回归证据·测试/运行结果记录 JSON |
| evidence/history-c2b-pure/protocol-build.log | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 | c-2b protocol/transport oracle 历史回归证据·原始运行日志 |
| evidence/history-c2b-pure/protocol-contract.log | 25 | 264637e475903cc63ae51199bb7dba85f588e3f943ca3b8abb8c91e6a80dedea | c-2b protocol/transport oracle 历史回归证据·原始运行日志 |
| evidence/history-c2b-pure/protocol-contract-tests.cjs | 8530 | dbb244372130e250d262d8fae1ef1b884e5f47d6a3550f0b0765acfc8d081dac | c-2b protocol/transport oracle 历史回归证据·测试/证据生成脚本 |
| evidence/history-c2b-pure/results.json | 3667 | 5a89fca8f1565da79a0ba15afee42618477fc6b8df2859105bf1cd992b369cb8 | c-2b protocol/transport oracle 历史回归证据·测试/运行结果记录 JSON |
| evidence/history-c2b-pure/tsconfig-protocol.json | 817 | 3a114bf38e519eb8b765a611f8cfd2fcbb9dbff5dbb39896f98613e00ca271c6 | c-2b protocol/transport oracle 历史回归证据·审计/状态记录 JSON |
| evidence/prepare-b-auth-regression.cjs | 1681 | c771c1363b8eedadbb968808ee599d432eed407c63d0743711a7415a1478b8b5 | 旧 b 认证历史回归准备脚本 |
| evidence/run-b24-regression.cjs | 3534 | 15a0c89b13e0e2c45f21dd980a84025d81715bf4d90eaf6a38cd1fded458306b | B2.4 历史回归运行脚本 |
| evidence/run-b-auth-regression.cjs | 8744 | 04fc58256d8f9ae75e0db7ed5fbac23cb709811121f2f2f3da7aa394bd1d176b | 旧 b 认证历史回归运行脚本 |
| evidence/run-c1-regression.cjs | 5348 | 576c1884367c30cbc48d26d2e8cd66eef285f1dc7e5b99397868b441d8b1aa7b | c-1 历史回归运行脚本 |
| evidence/run-c2b-http-regression.cjs | 7903 | 90d9a99fa6b137586054e935c2424222fa312b510b02dd928167faa720049c2e | c-2b HTTP 历史回归运行脚本 |
| evidence/run-c2b-pure-regression.cjs | 4900 | 93e9516ed2995ae923c1f26efa0b77c9119f3df377c4614bbd9170f91d971fee | c-2b pure 历史回归运行脚本 |
| evidence/verify-c2b-http-regression.cjs | 2579 | 689a519c718aae036c55d1acf4b058b893d43b467f89798526af425f960a56b6 | c-2b HTTP 历史回归核验脚本 |

## 六、暂停记录与过程偏差

范围：*-paused* / *before-retention-fix* / *before-generation-retention-fix* / wip-* / 修复过程脚本。

| 路径 | 字节 | SHA256 | 用途 |
|---|---|---|---|
| evidence/canonical-audit-before-context-fix.json | 1545741 | 3c9df740bf963dd6ac8492a2f892b30ccbec6ddb61fca77c04af607ed829e0dd | canonical 审计上下文修复前快照 |
| evidence/canonical-audit-before-retention-fix.json | 1546800 | 2e7794ee1943d00dcbbdb5933d62825150019b9e6c83154976f12c4942385011 | canonical 审计 retention 修复前快照 |
| evidence/check-paused-server.cjs | 1758 | e9a4071d157a025a4b0e9230d430f18705116b63455596b0b72a119d0f057af8 | 暂停期 server 状态检查脚本 |
| evidence/delivery-report-before-generation-retention-fix.md | 15284 | b62b68a9b003f541ceb0788e8c51758b95766ccc9745f3b3ac31b0ede3f99d98 | 交付/复审文书 |
| evidence/delivery-report-p10-paused.md | 2486 | 86bcd02d9c9cec59a7645b485a286a3cf285a025bfc99070732a681332638ad3 | 交付/复审文书 |
| evidence/gate-runs/current-paused-source-state/check-dependencies.log | 419 | 697624a8aeefce0d78a342372d570ee0432574785113b499cbae48de8bd3d113 | 三门禁运行证据·原始运行日志 |
| evidence/gate-runs/current-paused-source-state/check-naming.log | 9190 | ce11f2a1822b000b65d76cf4f9814970dcaae3a2819feae78273775aae5c4a76 | 三门禁运行证据·原始运行日志 |
| evidence/gate-runs/current-paused-source-state/results.json | 12222 | cee9b43f4a32a8501937a7b25c9b334d24fed1de49bda85e5c8bb3733d1fb56d | 三门禁运行证据·测试/运行结果记录 JSON |
| evidence/gate-runs/current-paused-source-state/typecheck.log | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 | 三门禁运行证据·原始运行日志 |
| evidence/implementation-plan-before-generation-retention-fix.md | 3958 | 3588d5405124a457515f275f402dc5ddf77660e817134a15963fa0e67d4dbec4 | 交付/复审文书 |
| evidence/implementation-plan-p11-paused.md | 5097 | 3b3e596475ee4317c62e514876357002a3472b3a24b1745724a4879ad59c3353 | 交付/复审文书 |
| evidence/paused-evidence-summary.json | 4728 | 664ae6abeca0056f6644a719a5cd404304e0872f22d453cbfd2bf45e1dbaf369 | 暂停期证据汇总 |
| evidence/protected-implementation-paused-audit.json | 1543229 | 9e66cf208a710a5678dd8d28df49e340a94568850b165e512a1aff5b8c91ce61 | 暂停时点保护审计 |
| evidence/repair-canonical-audit-context.cjs | 1229 | e3999e3a5114f1d8932a1e79dafe0d4dd9d405a5e0fce552da29e7ef9d8808a6 | canonical 审计上下文修复脚本 |
| evidence/server-paused-noemit.log | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 | 暂停期 server noEmit 检查日志 |
| evidence/server-paused-noemit-results.json | 774 | 533a8153b3fb68f8356af4ca3e8c0ed949e4476dd50d81ff9b5dae8ff47942f4 | 暂停期 server noEmit 检查结果 |
| evidence/summarize-paused-evidence.cjs | 4786 | 31bf0dd2ca6cc5605707d41ee098e387f2aa92a54979a403c58c49fd5c7513a8 | 暂停期证据汇总脚本 |
| evidence/update-canonical-retention-audit.cjs | 2767 | 754a98fc76ca41e4a97284d191fa0318665cffd7ace4404010721748f64731cb | canonical 审计 retention 更新脚本 |
| evidence/verdicts-before-generation-retention-fix.md | 4166 | a34d6efc51a52b37ab80cf177eabc56c3d703c2fade00a39a373fdb8501f6dac | 交付/复审文书 |
| evidence/wip-changed-files.json | 2814 | b760ef4dcc97c9de950dfa43acd8cd21c5fda3eb588dc3c1e9f30a52e7cd1bc6 | WIP 源码变化快照 |
| evidence/wip-code.diff | 55067 | fffe43a6bf8dc72246094b6cef9f6802fea61495478bcb32de6985437b88a285 | WIP 源码 diff 快照 |
| evidence/wip-new-names.json | 99090 | f5486b70072e37a1d46d89597901f87bc1fa5459852e6a06ec371f38d4fbdffe | WIP 命名清单快照 |

## 七、契约测试与命名

范围：protocol-* / p10-deadline* / client-relay-contract-tests / new-names-*。

| 路径 | 字节 | SHA256 | 用途 |
|---|---|---|---|
| client-relay-contract-tests.cjs | 16054 | 8ad316aaeb3836e4a461cf2fd89c96cded185c8a7c38e7acb8573c3faaa951a8 | Relay adapter 契约 oracle 测试（32 项） |
| evidence/list-new-names.cjs | 9911 | bf76c0f88f66cbe0ecd480b2e5ed4b1f85c20e331fbbe5358109ce2f18c2075b | 命名清单扫描脚本 |
| evidence/new-names.json | 109353 | ced7829a3b26bfb0e3441b55769c01452e0d70dcbd16890f634e35a778e7b6c1 | 命名清单快照（过程） |
| evidence/new-names-final.json | 109353 | 8b75ae8727356930db60a151e14b43ac674517ea393d9018c87badbfc296635f | 最终命名清单（420 声明/217 唯一名/8 公开导出） |
| evidence/p10-authorization.json | 446 | 890106e447646815fe11aa1f1d023bdf101a8ae9df8a96f5675da5a8af64814f | P10 授权记录 |
| evidence/p10-compiled/src/director/SharedCanonicalBytes.js | 15717 | ceaa486b54f0c7ca1096c301149514124940fcdf9b6acca1ece9e902b0c71cb2 | P10 deadline oracle 编译产物·编译产物 JS |
| evidence/p10-compiled/src/director/SharedCommitCodec.js | 43978 | 7ec12d746e544e095b41dbe4717700e280a38c007bbd77918fabec585d4cef5b | P10 deadline oracle 编译产物·编译产物 JS |
| evidence/p10-compiled/src/director/SharedServiceProtocolCodec.js | 18211 | 1182df7457e9d45d91f435ca2f8243657ba5f332da8ad972c3458fcd72a20694 | P10 deadline oracle 编译产物·编译产物 JS |
| evidence/p10-compiled/src/presentation/RealSharedServiceSessionAdapter.js | 45297 | 385818f28938dde601592faef502448a6d00300ec5a97ffdd1a09ead216035d5 | P10 deadline oracle 编译产物·编译产物 JS |
| evidence/p10-deadline-results.json | 1662 | 8788459a9c62b16504883173266b180b993da9a355f3296fe9ad782fe10801c8 | P10 deadline 契约 oracle 结果（13/13） |
| p10-deadline-tests.cjs | 11619 | f766bc93236782e8ca19439abeb5db1a6e1c6cdac803cfd79ee3075ba912749d | P10 deadline 契约 oracle 测试（13 项） |
| protocol-p11-pull-retention.md | 6066 | 7e7bad49646ad9ba12fef017a6fd717d21827b03ff974e62b391129902ce59d4 | P11 pull 请求记忆与保留期设计说明 |
| protocol-prerequisites.md | 4758 | 7394d80a1ee7afa9b0941d18edf3206289fe1086d0a42e449da4b51a5071a636 | 前置冲突清单（P10/P11 待裁定项） |

## 八、保护审计与 lineage

范围：protected-* / artifact-inventory-* / validation-*-lineage.json / 门禁与审计脚本。

| 路径 | 字节 | SHA256 | 用途 |
|---|---|---|---|
| evidence/artifact-inventory.json | 68005 | c6a6639c69eedcddb9e167b1a879ccb4345af00f1cef933a6910807fe8ca351c | 交付物清单快照（过程） |
| evidence/artifact-inventory-complete.json | 68355 | c6b4ae5ebba9c728f89681aff7cb95d95b195d5829f6e8a5df29dd699002d6ea | 交付物完整清单快照（过程） |
| evidence/artifact-inventory-delivery.json | 69257 | 44a61a19b0d65d4973aad7d4c1d7ccc37f90967f1385adda5078aa8d2a971002 | 交付物清单（旧 generation 修复前交付快照） |
| evidence/assemble-final-audit.cjs | 3127 | 6f28c38f280085de6f30a97c089a94b4c05168a9baba0a75ba1a37fff5669b5e | 最终审计组装脚本 |
| evidence/audit-runtime-state.cjs | 3293 | c78501ea3022dea890a8469f2526428d0ab4385657d4a581b717b7d1bcdf80f3 | 运行时状态审计脚本 |
| evidence/c2b-source-stability.json | 8136 | da34c39957363b833efed6696ff0536093d52faff9525f54d101ea9f1254d54f | c-2b 23 份实施文件哈希稳定性核对 |
| evidence/changed-files.json | 3644 | b62b725863cdbecaee5dbe382971d7c5214ae5dd120e0380e5c4043a6bb0b01b | 源码变化记录（旧 generation 修复前快照） |
| evidence/changed-files-final.json | 3726 | fa04863ff229c5a9d58894bbc3d8cf0078ab3898b19e8786aec933ccf2dae5ac | 最终源码变化记录（5 新增 2 修改 + 4 生成物，前后 SHA） |
| evidence/check-c2b-stability.cjs | 1969 | 394aaa72733eb62a793889206164e4bacaeb092cf37b6a437903f394c38c5fb5 | c-2b 稳定性核对脚本 |
| evidence/check-document-references.cjs | 5074 | 96774d88c5f1316c77f4d038fe5a6c043c24d18fa20b6ca9919b7f777e37eae0 | 文档引用核对脚本 |
| evidence/code.diff | 61156 | cb8c2e9037974fe2fef09e833daa4e7b1c048f9f63ba42fb0c1646653e113c84 | 源码 diff（旧 generation 修复前快照） |
| evidence/document-reference-audit.json | 9530 | 39f67a27affb8dfa162eb87714d17ae9bc75f51a939fc4374565b5b0bb94df5f | 文档引用核对 |
| evidence/document-reference-delivery-audit.json | 11361 | c94eb197d1b91c9b6e7c186c6b22977d6d9451b648dec4c224fe7c651be307ab | 交付时点文档引用核对 |
| evidence/document-reference-final-audit.json | 13060 | d3fa6016e630065afe6577d30140d1c970d5b206fa9b8843719befdb415099e6 | 最终文档引用核对 |
| evidence/gate-runs/baseline/check-dependencies.log | 419 | d1fa83bd8bf24fd5c6a6306bd66da5a9bd5cfac1373efd3bc895e3b8450662fc | 三门禁运行证据·原始运行日志 |
| evidence/gate-runs/baseline/check-naming.log | 9190 | bcb6bd716f7aecf0c94edffde9fccccdce26ffd89635929e60b5b1d1ade0475f | 三门禁运行证据·原始运行日志 |
| evidence/gate-runs/baseline/results.json | 12212 | 2fe423ab146565c3404a10c97478cf92cd80b18b45fe396d8b28d536534ddbc1 | 三门禁运行证据·测试/运行结果记录 JSON |
| evidence/gate-runs/baseline/typecheck.log | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 | 三门禁运行证据·原始运行日志 |
| evidence/gate-runs/final/check-dependencies.log | 419 | 697624a8aeefce0d78a342372d570ee0432574785113b499cbae48de8bd3d113 | 三门禁运行证据·原始运行日志 |
| evidence/gate-runs/final/check-naming.log | 9190 | ce11f2a1822b000b65d76cf4f9814970dcaae3a2819feae78273775aae5c4a76 | 三门禁运行证据·原始运行日志 |
| evidence/gate-runs/final/results.json | 12137 | 13f9840c807c749aa8b0e0d8400e286e46cde95a07b178081a840917adaa4c7a | 三门禁运行证据·测试/运行结果记录 JSON |
| evidence/gate-runs/final/typecheck.log | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 | 三门禁运行证据·原始运行日志 |
| evidence/gate-runs/retention-final/check-dependencies.log | 419 | 697624a8aeefce0d78a342372d570ee0432574785113b499cbae48de8bd3d113 | 三门禁运行证据·原始运行日志 |
| evidence/gate-runs/retention-final/check-naming.log | 9190 | ce11f2a1822b000b65d76cf4f9814970dcaae3a2819feae78273775aae5c4a76 | 三门禁运行证据·原始运行日志 |
| evidence/gate-runs/retention-final/results.json | 12177 | a10371f73cafe59b07620d35adb25995cb6512d23a935ecb53f6452c64926803 | 三门禁运行证据·测试/运行结果记录 JSON |
| evidence/gate-runs/retention-final/typecheck.log | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 | 三门禁运行证据·原始运行日志 |
| evidence/intent-before-c2c.ts | 50175 | 1e29ebc8f7cf1bfef700eea7fc1bae8a09e6cdb4e1f39d9e2ef07549991649a3 | IntentPort.ts 修改前源码快照（原 50175 字节前缀） |
| evidence/IntentPort.after.emitted.js | 41756 | e382aee3d6c265b6a0df9037f4dee9ad320732311e130efd87173769c7f5e7b4 | IntentPort 编译产物（修改后，意图擦除核验） |
| evidence/IntentPort.before.emitted.js | 41756 | e382aee3d6c265b6a0df9037f4dee9ad320732311e130efd87173769c7f5e7b4 | IntentPort 编译产物（修改前，意图擦除核验） |
| evidence/intent-type-erasure-final.json | 1279 | 559774bbd67ce466c5948734f1995587074eb2f1275a3de656b8470302210e9a | IntentPort type-only suffix 意图擦除核验结果（前后 emitted 相同） |
| evidence/list-delivery-artifacts.cjs | 2554 | 9cc726942139907574b594a5dea0f0940550d4cacf93011b256d984b1d1d7cac | 交付物清单生成脚本 |
| evidence/prepare-final-evidence.cjs | 1803 | 1cceae99a89a00256af38612fc5d6cc4eb1eeb74ca9b1e9a69b3fdd504da00a4 | 最终证据准备脚本 |
| evidence/protected-baseline.json | 1539519 | 93271a26ec10bc0b5cd2e82ed436d80e8c6db98d62c59e6e1e71ebc7d3e3b354 | 保护审计基线 |
| evidence/protected-final-audit.json | 2260 | e1490ec3c7db76004532a2f0939bd584b91b609141998873e5287e45879d3d75 | 最终保护审计（canonical，7435→7444，PASS） |
| evidence/protected-implementation-final-audit.json | 1544269 | 7b3f89d6a4e7cada743af1f951ac2d2569f3859ea61ab64d6121a8c2aa92947d | 实施完成时点保护审计 |
| evidence/protected-implementation-interim-audit.json | 1543147 | 0a1250402da1397d12a9e2ced7392eb7fc9a05c7a7ffb466bfeee4c0f22d534b | 实施中途保护审计 |
| evidence/protected-post-delivery-audit.json | 1544269 | 08a6fde054145b78150b37d57a1d7e82b455a4f1656b3f8e89861e00a39edb12 | 交付后保护审计 |
| evidence/protected-prerequisite-recheck.json | 2260 | f778295258f877a1d72e306fe398fb005463f04bce0be546d38b137a7b567a6a | 前置只读复审保护核对 |
| evidence/protected-retention-final-audit.json | 1544269 | 83ddecdfdc72ac39aec95579374fd7b01cb654438593b46d78cadff5ba399485 | retention 修复后最终保护审计 |
| evidence/protect-files.cjs | 6592 | 46a9c24d20fea2bce78eebea8f350146ecf15a59ca27bdd951527dfbce8b6988 | 保护审计执行脚本 |
| evidence/protect-implementation.cjs | 10564 | ddc173da1c6523218f081f7b2782f50b8e350a77a7015c27f2033707df78375b | 实施保护审计脚本 |
| evidence/record-final-validation-lineage.cjs | 8044 | e261e1d95135c0374f714a116bae50d567199dd01b48f0b714026ad6c5aa77e2 | 验证 lineage 记录脚本 |
| evidence/record-retention-final-lineage.cjs | 8456 | 860dde12a47e008f57219b70928f91f6d820287da1190cbd5f678cadefdad10d | retention 最终 lineage 记录脚本 |
| evidence/relay-pull-metadata-inspection.json | 262 | a9468a1aa5e44e6730b624c06484329a8be1a2320a07a8c3423a6831ba8ea349 | P11 请求结果表元数据检查（42 条轻量引用） |
| evidence/run-final-gates.cjs | 3968 | d3c7cff4e6bac15ac74791f89ac33316c36cda3c9436c8c35f6a6c0b6a5a712b | 最终三门禁运行脚本 |
| evidence/run-gates.cjs | 3918 | 193b9ff51152e82f998b1c8fe7c77f0282f13c37612bc7a56d4c70ecd54111ce | 三门禁运行脚本 |
| evidence/scan-shareable-material.cjs | 5021 | 792667eeb070951ce60c8b327b591b99bd05f1fa0ade74cd905951d12e4a8c11 | 分享材料扫描脚本 |
| evidence/session-before-p10.ts | 44370 | 46238bab2bd3d082622d0b22ba2e3cb82f0330b40f77d70c4de6b229b8af1f8e | RealSharedServiceSessionAdapter.ts P10 修改前源码快照 |
| evidence/shareable-material-before-delivery.json | 101877 | c606697aff039b7e283cf6204b04ce78cc106e9c54401c94907636f66475d66f | 分享材料检查（交付前） |
| evidence/shareable-material-delivery.json | 106438 | c15e9bf5a90d45a5a2a2ece84e81a5fcd86efb7e852926db04998d44a4717180 | 分享材料检查（交付时点） |
| evidence/shareable-material-final.json | 103842 | 3141ec882153f5c1760560c3ec0ee9781b58af5cd9353a25052e144e3204085a | 分享材料检查（最终） |
| evidence/shareable-material-retention-final.json | 123629 | c8cba2c57bda50c2eac3e3f2dad668781488bf10d8e4026af8fa4adbb5f69c75 | 分享材料检查（retention 最终） |
| evidence/source-diff.cjs | 5927 | bef7072550cb3b741c40ef2f04b3cdf32d9654a8a68bd60f669839b376ea9b56 | 源码 diff 生成脚本 |
| evidence/source-final.diff | 61312 | a7b48f31c72304efeb1675267802a9228efcc9d8ac6fa4eb767796c6b1ad0523 | 最终完整源码 diff（覆盖七份源码，61312 字节） |
| evidence/validation-final-lineage.json | 16936 | 33c4d4bc5b405679501d43f593e95c6de08ce784ec7d8f20834b033c2d96eef9 | 验证 lineage（修复前时点） |
| evidence/validation-retention-final-lineage.json | 19025 | e99177f6061920fd2ffa4634c434cef132b0e9aee86753774105bd241ce758d9 | 最终验证 lineage（命令/exit/日志 SHA/源码 lineage） |
| evidence/verify-intent-erasure.cjs | 3665 | 2eb5c8e776189bbc5f3ff0da9f1a060f0c29a344a61643aab16b6f69cea4df33 | 意图擦除核验脚本 |
| protected-final-audit.json | 1547402 | 80bf5d894eb5693b6aa59f07fb01b92e9690a8086aa570ff2272bc2adb1963c4 | 最终保护审计（canonical，7435→7444，PASS） |

## 九、交付文书与裁定

范围：delivery-report / implementation-plan / verdicts / 提案 / 独立复审。

| 路径 | 字节 | SHA256 | 用途 |
|---|---|---|---|
| delivery-report.md | 17828 | 5a0539215c2dadcdcd4ef854b942d7b543221e444dff1b678e1abfab637a64ad | 交付报告（c-2c 实施与验证总结，PROTOCOL 审阅稿） |
| evidence/independent-delivery-document-review.json | 2533 | 2c26b2150a7e1ab4dfb35267eaf93b071a61a937708fa7d0d576fc4b428030c3 | 交付文书独立复审记录 JSON |
| evidence/independent-final-review.json | 2748 | 1934faffa2247aa1dd9459e154531a6e885b67a9e5d4811c07dda1a9003fa635 | 独立最终复审记录 JSON |
| evidence/README.md | 4341 | d07815109e01ecf021f50afeaa25dab8570e1d1519219f63ae5df6130a42cf40 | 本阶段目录说明 |
| evidence/record-delivery-document-review.cjs | 2569 | 8fc14fa2e7d12cf1808c18f00664ac780a3ec62ddafae6e168e1b144c60b3ad4 | 交付文书复审记录脚本 |
| evidence/record-independent-review.cjs | 2718 | c3781183b07c30987668f4b44ca9be563ffbf50761220a9f13a08ec4be5886f1 | 独立复审记录脚本 |
| implementation-plan.md | 4333 | c5670099800072172a1bf9a400a6593b4d781e34f10266995dcca066adc1da1e | 实施计划与完成对应表 |
| independent-final-review.md | 2184 | 1dff752955d75ff82d24f899f4527719cc01eb03a466459712e439cc7f11826f | 独立只读最终复审（原针对修复前 Storage） |
| independent-prerequisite-review.md | 2010 | 4f4b221cf7a76b61adb0c58aa11d81ad198f8dec1ebb780ed4da336953d6e0a2 | 只读前置复审 |
| namebook-v3.21-appendix-proposal.md | 7418 | 27dda96209de0ef682ab2d289765bce2d9b039c2beb33cfe6e50d0484f664a6c | 名库 v3.21 附录提案（A/B/C/D 分列） |
| verdicts-448.md | 1095 | 29175db14d9e316f92b96d285c0396c4272864831595afe1f44ad6619b3d3907 | VERDICT-448 P10 deadline 例外单独裁定原件 |
| verdicts-448-451.md | 4440 | 5ca97670eac24d5c6c01da86f802dce404f848e0b65989da607c1dc79e553424 | PROTOCOL 裁定合集（VERDICT-448~451） |
| verdicts-449.md | 1317 | c8fa75c8b9099837a39fe5cd66f27da18e9d9e4979daf9c476c75fc5ca102ceb | VERDICT-449 P11 pull 引用重建单独裁定原件 |

## 覆盖范围声明

本索引只覆盖 quality-review/b2-5c-2c/ 目录内 399 份文件（源：evidence/artifact-inventory-final.json），**不含** docs、名库（NAMEBOOK）、仓库源码（src/、server/src/、assets/scripts/）或本 indexes/ 目录自身。未找到情况：无（399 项全部在源 JSON 中找到路径/字节/SHA256）。
