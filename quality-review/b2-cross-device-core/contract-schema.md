# B2.4c 受限 Core 契约与故障恢复

本契约按实际 CoreTransfer、CrossDeviceContractAdapter、CrossDeviceImportStorage 与 CrossDevicePrototype 公共类型冻结。只有 ContractAdapter；不表示完整 FileCarry、外部认证或物理双设备已经存在。正式命名详见本目录 v3.13 附录。

## data-only 线格式与重新认证

以下是结构示例，section 值必须是对应既有完整合法快照，不能用示例注释代替。运行时品牌不序列化；没有品牌的接收值必须重新 parseComplete，并核验已发布 Chart/visual/media 引用。

```ts
type CoreTransferPayload = {
  schemaVersion: 1;
  kind: 'RestrictedCoreTransfer';
  transferId: string;
  sourceDeviceId: string;
  sourceHomeRevision: 1;
  state: {
    schemaVersion: 1;
    kind: 'Core';
    accountId: string;
    worldId: string; // 非 InitialWorld
    worldKind: 'Primary';
    shoreOrigin: null;
    revision: number;
    capturedAt: number;
    forkOrigin?: WorldForkOrigin;
    sections: {
      Ledger: LedgerSnapshot;
      PuzzleProgress: readonly PuzzleProgressSnapshot[];
      FormatTime: FormatTimeSnapshot;
      RecallCount: RecallCountSnapshot;
      WorldLink: WorldLinkSnapshot;
      ChartSnapshot: ChartSnapshotCollection;
      ChartScore: ChartScoreSnapshot;
    };
  };
};
type CrossDeviceImportRequest = {
  schemaVersion: 1; title: string; description: string;
};
type CrossDeviceImportJournal = {
  schemaVersion: 1;
  kind: 'CrossDeviceImportJournal';
  accountId: string;
  deviceId: string;
  entries: readonly {
    phase: 'Prepared' | 'HomeRegistered' | 'Published';
    plan: CrossDeviceImportPlan;
    homeReply: WorldHomeRegistrationReply | null;
  }[];
};
type CrossDeviceImportReceipt = {
  kind: 'Published' | 'Pending';
  mode: 'ContractAdapter';
  transactionId: string;
  targetWorldId: string;
  phase: 'Prepared' | 'HomeRegistered' | 'Published';
  error: string | null;
};
```

所有对象只接受 exact 自有数据字段和 plain/null 原型；拒绝访问器、symbol、循环、函数、undefined、非有限数、未知字段。数组必须连续，不接受稀疏或自定义属性。输出是深冻结独立副本。品牌由接收进程的正式 codec 重新生成，不能靠 JSON 标志取得。

CoreTransferProof 绑定 accountId/worldId/sourceDeviceId/transferId/sourceHomeRevision/sourceDigest。摘要只检查精确数据的一致性；proof 的可信来源是同一共享权威的发布记录，不能由载荷自报摘要代替。CrossDeviceContractAdapter 在 A 发布时检查源当前 HomeDevice；检测器另读当前 registry，允许分辨 Released 与未来迁移边界，不把历史 proof 当当前归属。

## 从 A 到 B 的协议

1. A 已有 active 非 InitialWorld 本机世界；持真实来源 lease、从主 Core 回读 Complete。用 b 登记/确认其 HomeDevice=A，然后向共享包装权威发布精确七项 data-only 载荷。
2. B 验证载荷 schema、重新认证七项及已发布内容；从既有同账号事实读取 CopyPermission。无权限显示“档案损坏”，不调用 ID/时间工厂，不修改输入/源文件/目录。
3. B 检测唯一可接受结果 CrossDeviceDuplicate；分配新 world-UUIDv4/import-UUIDv4/registrationId。直接复用 rebaseWorldState 生成 revision0、新 capturedAt 与来源头；七项身份重键，FormatTime 保留，完成继承 Inherited。账号事实不复制。
4. 持账号导入锁，取得真实 B 新目标 lease；写 Prepared journal。调用 registerWorldHome，同 registrationId 永久用于该计划的幂等重试；目标 HomeConflict 拒绝发布，日志保留。
5. 严格验证回复并回读当前 target HomeDevice=B/homeRevision1，写 HomeRegistered journal。服务 await 完成后才取得目录锁。
6. 目录锁内写目标 Core、接收端 Complete/正式内容回读、比较原计划；目录追加是唯一的本地发布点。写 Published receipt，c 永久保留。
7. B 打开前持真实目标 lease，当前服务 registry 与 Published receipt、目录、完整 Core 全部通过。初始 revision0 要与计划精确相等；合法进展 revision>0 仍须保持 forkOrigin 与 FormatTime。进入既有正式 factory，不改变游戏、音频、上下文门控。

源 HomeConflict 是 B 尝试登记来源旧 ID 时的归属冲突：它只提示“归属另一设备”，不能认证文件；已通过 proof 且当前源 HomeDevice=A 才判 CrossDeviceDuplicate。目标 HomeConflict 是新 UUID 已归另一设备：一律保留 journal 并拒绝本地发布，不抢占、不覆盖。成功只给新 UUID 登记 B，旧来源归属与文件不变。

## 崩溃点与恢复

| 崩溃/故障点 | 可观测状态 | 恢复动作 |
|---|---|---|
| Prepared 日志写入前失败 | 无新服务/目标/目录副作用 | 原输入保留；可重新准备。 |
| Prepared 持久后、服务调用前 | Prepared / homeReply=null | 读取 journal，持同目标真实 lease，重用所有 ID。 |
| 服务受理但回复丢失 | 本地仍 Prepared，服务可能已 Homed | 重放同 registrationId；严格解码，不能创建另一目标。 |
| 服务成功、HomeRegistered 写失败 | 本地 Prepared，服务已 Homed B | Prepared 恢复重放同登记；无服务补偿删除。 |
| HomeRegistered 后、Core 写前 | 权威已登记，目录未发布 | 重验 proof/权限/当前源与目标归属，持目标 lease，继续 Core 写入。 |
| Core 写后、目录追加前失败 | 暂存 revision0 Core，目录未发布 | 保存日志与暂存 Core；完整回读与计划相等才继续，不覆盖碰撞。 |
| 目录 setItem 已成功、适配器随后抛错 | 目录已有精确目标记录 | 回读目录判本地已发布，继续 Published 标记。 |
| 目录已发布、Published 标记失败 | HomeRegistered；目标目录/Core已存在 | 打开门控拒绝；恢复同计划/登记，确认目标/Core，再写 Published。 |
| Published setItem 已成功、适配器随后抛错 | Published 与精确目录/Core可回读 | 已确认当前权威时返回 Published；不声称回滚。 |
| Published 后服务不可用/缺失/冲突 | 本地世界与 receipt 保留 | assertCanOpen 拒绝打开；recover(account,targetWorldId) 对账，同 ID 登记成功并核验后恢复开放。服务与源证明不可取得时继续保留诊断。 |
| 目标目录 tombstone/记录冲突、Core初始值篡改、journal损坏 | 原始值与服务可能存在 | 明确阻断并保留原值；不删除世界伪装回滚，不重新创建已删除世界。 |
| 已发布 Core 合法进展 | Published；revision>0，稳定来源/FormatTime | 完整解析与当前归属仍通过时可开；禁止将初始计划覆盖进展。 |
| 无 Web Locks / lease失效 | 缺少真实排他能力 | 导入/发布/打开显式拒绝；不降级为无锁写。 |

服务登记和本地目录发布属于两个存储域，以 journal 协调。正常路径服务先行；“本地已发布、服务未登记”属于对账故障场景，绝不当作正常成功，也不通过删除目录/文件回滚。ContractAdapter 的 registry 与传输 proof 是进程内存状态，页面/进程重启后服务状态不会自称持久；本地 receipt 保留，无法重新取得可信源发布/归属时保持拒开等待对账。

## 不变式与后续边界

INV-10 世界运动、INV-12 音频时间线、INV-13 上下文覆盖沿用既有正式 factory；活动世界不导出，Primary/null 以外拒绝。七项仍用主 key，品牌必须在接收端重建，所有写入须真实 lease。独立 import→target→directory 锁顺序不改变 B2.3 source→target→directory；无服务 await 位于 directory 锁内。

本轮不实现完整 FileCarry、WorldMigration、RealityPause、真实外部服务、WorldRegistry 位置 API、账号切换执行端口、AccessCode 或 ObserverSync。Migrated 是保留结果名，c 没有迁移证明，不产出此状态。d 的具体结构/phase/执行端口和 B2.5 的加密/媒体/真实认证协议需在其阶段单独冻结。
