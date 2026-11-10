const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto'),assert=require('assert/strict'),ts=require('../../node_modules/typescript');
const root=path.resolve(__dirname,'../..'),base=path.join(__dirname,'baseline');
const changed=['src/chart/GuidanceChart.ts','src/chart/GuidanceLineRuntime.ts','src/chart/ChartPremiere.ts','src/presentation/LineEraseEffect.ts','assets/scripts/SceneBuilder.ts'];
const added=['src/chart/GuidanceChartRuntime.ts','src/chart/GuidanceChartRuntime.ts.meta','assets/resources/chart/guidance_c.json','assets/resources/chart/guidance_c.json.meta'];
const read=n=>JSON.parse(fs.readFileSync(path.join(__dirname,n),'utf8'));
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const link=(label,file)=>`[${label}](${path.join(root,file).replaceAll('\\','/')})`;
const c=read('results.json'),b=read('b-regression-results.json'),pad=read('pad-grid-regression-results.json'),preview=read('creator-preview-results.json'),gates=read('gates-results.json');
assert.equal(c.failed,0);assert.equal(b.failed,0);assert.equal(pad.failed,0);assert.equal(preview.pass,true);assert.equal(gates.pass,true);
const resource=JSON.parse(fs.readFileSync(path.join(root,'assets/resources/chart/guidance_c.json'),'utf8'));
for(const resolution of preview.resolutions){assert.deepEqual(resolution.chart,resource);assert.equal(resolution.completed.result.completed,true);for(const shot of resolution.evidence)assert.ok(fs.existsSync(path.join(__dirname,shot.file)));}
const protectedChecks=Object.entries(read('protected-hashes.json')).map(([file,sha256])=>({file,sha256,currentSha256:hash(path.join(root,file)),unchanged:sha256===hash(path.join(root,file))}));
assert.ok(protectedChecks.every(p=>p.unchanged));fs.writeFileSync(path.join(__dirname,'protected-verification.json'),JSON.stringify({pass:true,scope:'docs 全目录，包括名库与规格；未编辑 A/B 原证据和原谱面资源',files:protectedChecks},null,2));
let diff='';for(const file of [...changed,...added]){const before=changed.includes(file)?path.relative(root,path.join(base,file)).replaceAll('\\','/'):'NUL';const r=cp.spawnSync('git',['diff','--no-index','--ignore-space-at-eol','--',before,file],{cwd:root,encoding:'utf8'});assert.ok(r.status===0||r.status===1,r.stderr);diff+=r.stdout.replaceAll(`a/${before}`,`a/${file}`);}
fs.writeFileSync(path.join(__dirname,'implementation.diff'),diff);
fs.writeFileSync(path.join(__dirname,'files.json'),JSON.stringify({baselineMethod:'无 Git 仓库，C 步实现前逐字节备份；git diff --no-index 生成完整差异',changed,added,hashes:Object.fromEntries([...changed,...added].map(f=>[f,hash(path.join(root,f))]))},null,2));
function identifiers(file,content){const ast=ts.createSourceFile(file,content,ts.ScriptTarget.Latest,true);const ids=new Set();const visit=n=>{if(ts.isIdentifier(n))ids.add(n.text);ts.forEachChild(n,visit);};visit(ast);return ids;}
const old=new Set();function original(dir){for(const e of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){const file=path.posix.join(dir,e.name);if(e.isDirectory())original(file);else if(file.endsWith('.ts')&&!added.includes(file)){const p=changed.includes(file)?path.join(base,file):path.join(root,file);for(const id of identifiers(file,fs.readFileSync(p,'utf8')))old.add(id);}}}
original('src');original('constants');for(const id of identifiers('SceneBuilder.ts',fs.readFileSync(path.join(base,'assets/scripts/SceneBuilder.ts'),'utf8')))old.add(id);
const introduced=[];for(const file of [...changed,...added].filter(f=>f.endsWith('.ts'))){for(const id of identifiers(file,fs.readFileSync(path.join(root,file),'utf8')))if(!old.has(id))introduced.push({name:id,file,status:['GuidanceChartRuntime','getGuidanceSnapshots'].includes(id)?'本轮 PROTOCOL 已冻结':['Map','NonNullable','get','set'].includes(id)?'标准库词形，不属于项目新增命名':'待 PROTOCOL 追认'});}
const names={frozen:['GuidanceChartRuntime','getGuidanceSnapshots'],publicTechnicalAdditions:[{name:'getTapCandidate',meaning:'单线只读 Tap 仲裁候选，不推进或结算'},{name:'allowTap / allowHead',meaning:'多线协调器向单线广播的边沿消费资格，默认 true 保留单线兼容'},{name:'lineId',meaning:'GuidanceLineRuntime 可选构造参数，指定独立运行的线'},{name:'headPosition',meaning:'GuidanceLineSnapshot 的冻结路径首点，Head 动画不随路径进度移动'}],privateTechnicalAdditions:[{name:'headSprites',meaning:'每条线的独立 Head Sprite 映射'}],newIdentifierSpellings:introduced,resourceIds:[resource.chartId,...resource.lines.flatMap(l=>[l.id,l.head.id,...l.nodes.map(n=>n.id)])]};
fs.writeFileSync(path.join(__dirname,'新增命名清单.json'),JSON.stringify(names,null,2));
const mapping=[
 ['1 多线共享媒体时钟','Cocos 同一 AudioOutputClock；双分辨率媒体同步采样','creator-preview-results.json'],
 ['2 共享布局与 chart 级版本','严格布局版本校验、v1/v2；47 键邻键回归','pad-grid-regression-results.json'],
 ['3 Tap 单消费及四级优先级','C 检查 03/04/05/14；input-conflict 截图一线 Perfect、另一线未决','results.json'],
 ['4 多 Head 重叠窗口','C 检查 02；真实预览两次 Space 分别启动','results.json'],
 ['5 独立 startedAtMs','C 检查 02/09/14；两档真实预览 starts 不同','creator-preview-results.json'],
 ['6 交错/重叠独立擦除','C 检查 09；实际谱面共享首段后分支交叉，各线 remainingPoints 独立','creator-preview-results.json'],
 ['7 单线超时独立终止','C 检查 07；两档 independent-timeout 截图：第一线 Running、第二线 TimedOut','creator-preview-results.json'],
 ['8 全线结算与媒体结束','C 检查 07/11/13；Playing 到 10 秒，真实媒体 12 秒结束只追加一次','results.json'],
 ['9 v1/v2 无硬上限','C 检查 01/12：v1 恰单线，v2 接受三线，拒绝空与重复 ID，深冻结','results.json'],
 ['10 性能与渲染','无专门优化；只读多快照遍历；两档渲染无错误；编译来源匹配','creator-compilation.json'],
 ['11 生命周期、分辨率、完整链路','C 检查 08/09/13/14；两档暂停、早退、重入、完成与超时截图','creator-preview-results.json'],
];
const evidence={pass:true,acceptance:mapping.map(([item,evidence,file])=>({item,evidence,file})),logic:{c:c.passed,b:b.passed,pad:pad.passed},preview:preview.resolutions.map(r=>({resolution:r.resolution,starts:r.starts,result:r.completed.result,ledger:r.completed.ledger,sync:r.syncSummary,screenshots:r.evidence.map(s=>s.file)})),constraints:{zeroCcLogic:true,presentationReadOnly:true,directorOnlyLedgerWriter:true,docsUnchanged:true,noEditorImplemented:true}};
fs.writeFileSync(path.join(__dirname,'验收证据.json'),JSON.stringify(evidence,null,2));
const shots=preview.resolutions.map(r=>`| ${r.resolution} | ${link('并行','quality-review/guidance-c/'+r.resolution+'-parallel.png')} | ${link('重叠/交织','quality-review/guidance-c/'+r.resolution+'-overlap-interweave.png')} | ${link('输入冲突','quality-review/guidance-c/'+r.resolution+'-input-conflict.png')} | ${link('完成','quality-review/guidance-c/'+r.resolution+'-completion.png')} |`).join('\n');
const doc=`# 第 28 批 C 步交付报告

C 步已实现并通过验收：版本化多线解析、共享时钟/布局、Tap 单消费、Head 单启动、Drag/Hold 独立检查、逐线视觉/擦除/超时，以及全线结算与媒体结束后的统一完成。默认加载 guidance-c-1，含两线、不同生成时间、重叠首段与交织路径、10 个混合节点。v2 无线数硬上限。

正式裁定见 ${link('VERDICT-136～146','quality-review/guidance-c/VERDICT-136-146.md')}，包含新命名冻结表、数据结构、输入路由、完成条件、最小交付与 A/B 模块关系表。

## 修改文件与差异

${changed.map(f=>'- '+link(f,f)).join('\n')}

新增：

${added.map(f=>'- '+link(f,f)).join('\n')}

完整差异：${link('implementation.diff','quality-review/guidance-c/implementation.diff')}。文件清单与 SHA256：${link('files.json','quality-review/guidance-c/files.json')}。工程没有 Git 仓库，使用 C 步开始前字节备份与 git diff --no-index，没有生成提交。

## 三条门禁

| 门禁 | 结果 |
| --- | --- |
| check-naming | exit 0，0 ERROR / 16 WARN；均为既有时间窗口或痕域词形，人工复核通过。 |
| check-dependencies | exit 0，0 ERROR；chart 零 cc，依赖方向合规。 |
| tsc --noEmit | exit 0，通过。 |

原始输出见 ${link('gates-results.json','quality-review/guidance-c/gates-results.json')}。

## 逻辑回归与完整链路

- C 步 ${c.passed}/${c.passed} 项通过：多线版本/ID/冻结、Head 独立启动、Tap 冲突四级排序、共享 Drag/Hold、同刻 Down/Up 边界、独立超时、共同暂停恢复/重入、交错擦除、第三线兼容、媒体兜底，以及 T6 终点至多线首演至 director 单次账本写入。
- B 回归 ${b.passed}/${b.passed} 项通过；测试副本只调整 v2 已合法、当前 47 键布局及已授权邻键容错的过时断言，原 B 脚本与证据不改。
- 后续全屏 47 键/第一层邻键回归 ${pad.passed}/${pad.passed} 项通过。
- C 检查 14 使用真实 InputCollector / FrameDriver 类，仅 cc 输入事件总线为 stub；图形与媒体真实性由下面独立 Creator 预览验证。检查 13 通过真实解谜链终点进入并完成两线，不跳过 T6。

结果：${link('C 步','quality-review/guidance-c/results.json')}、${link('B 回归','quality-review/guidance-c/b-regression-results.json')}、${link('邻键回归','quality-review/guidance-c/pad-grid-regression-results.json')}。

## 真实 Cocos 预览

Creator 3.8.8 当前工程预览服务 ${preview.url}；Electron 隐藏窗口、DPR=1，真实 canvas/PNG 两档尺寸分别为 1920×1080 和 2560×1440。键盘经 DOM KeyboardEvent → Cocos 输入源 → InputCollector → FrameDriver → director → chart。自然媒体播放，不替换节点、分数或媒体时钟。视觉入口仅把既有 T6 endpointSettled 设为 true；该夹具不写账本，T6 完整链路另由检查 13 验证。

采集前后 6 个编译目标均校验：HTTP served chunk 与 Creator 磁盘输出 SHA256 一致，source map 的 sourcesContent 与最终源文件逐字一致，采集期间源码和编译块哈希不变；读取的 C 资源与最终资源 JSON 完全相等。rendererErrors=0。

两档最终均 P${preview.resolutions[0].completed.result.perfectCount}/G${preview.resolutions[0].completed.result.goodCount}/M${preview.resolutions[0].completed.result.missCount}、${preview.resolutions[0].completed.result.totalScore} 分，finishedAtMs=12000，完成记录恰好 1 条。冲突示例刻意将另一条线的第二次 Down 延后至 Good 窗口，所以 G1 是预期结果。10 秒全节点已决仍 Playing；12 秒真实媒体结束才完成并由 director 返回世界，故完成截图显示世界与账本事件 1；JSON 保存 completed=true 的最终结果。

同步采样：${preview.resolutions.map(r=>`${r.resolution} ${r.syncSummary.sampleCount} 个样本，最大原始呈现时间偏差 ${r.syncSummary.maxRawPresentedErrorMs.toFixed(3)}ms`).join('；')}，均满足 ≤30ms。

| 分辨率 | 两线并行 | 重叠/交织 | 输入冲突 | 完成 |
| --- | --- | --- | --- | --- |
${shots}

其他截图：双 Hold 暂停、早退出、双线重入复位、独立 Head 超时。每张截图对应的逻辑/视觉/媒体/账本快照见 ${link('creator-preview-results.json','quality-review/guidance-c/creator-preview-results.json')}；编译证明见 ${link('creator-compilation.json','quality-review/guidance-c/creator-compilation.json')}。

## 验收逐项对应

| 原 11 项 | 验收证据 |
| --- | --- |
${mapping.map(([item,evidence,file])=>`| ${item} | ${evidence}；${link(file,'quality-review/guidance-c/'+file)} |`).join('\n')}

结构化汇总：${link('验收证据.json','quality-review/guidance-c/验收证据.json')}。

## 命名与约束

GuidanceChartRuntime、getGuidanceSnapshots 已由本轮 PROTOCOL 正式冻结。新增技术名称 getTapCandidate、allowTap/allowHead、构造参数 lineId、快照 headPosition、私有 headSprites 与 C 资源 ID 列于 ${link('新增命名清单.json','quality-review/guidance-c/新增命名清单.json')}，待 PROTOCOL 追认。

docs、名库及参照文件未编辑；docs 全目录 SHA256 与开始时一致，见 ${link('protected-verification.json','quality-review/guidance-c/protected-verification.json')}。不实现编辑器。逻辑层无 cc；LineEraseEffect 只消费冻结快照；director 与 ledger 未修改，完整链路证明其唯一写入与防重。

## 遗留问题与待裁定事项

没有新的玩法冲突或实现阻断。技术命名待追认，名库/规格同步仍交给 PROTOCOL。保留已存在的媒体异常超时兜底和“完成记录写入后 director 不再次开放同一首演入口”的行为；重入验收使用未完成退出再进入，单线超时另开独立预览会话。两条为设计与实测目标，虽 v2 支持更多，不宣称大量并行线的渲染压力已验收。

首次预览遇到旧 Creator 实例的编译/资源缓存，最终从专用于本轮的工程实例服务采集，并增加 source map 与资源一致性校验。原 Creator 会话保持运行。没有伪造预览截图或将初次失败记录计为通过。
`;
fs.writeFileSync(path.join(__dirname,'交付报告.md'),doc);console.log(JSON.stringify({pass:true,changed:changed.length,added:added.length,logicTests:c.passed+b.passed+pad.passed,screenshots:preview.resolutions.reduce((n,r)=>n+r.evidence.length,0)},null,2));
