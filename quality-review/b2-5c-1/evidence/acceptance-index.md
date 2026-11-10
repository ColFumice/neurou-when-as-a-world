# 最终154项验收索引

实际名称由最终 TAP 自动提取。V01–V47/ C01–C76 是本索引编号，R01–R31 是测试原有编号；不改测试名称或原始输出。

| 编号 | 套件 | 实际测试名称 | 结果 |
|---|---|---|---|
| V01 | validator | native-HMAC RFC5869 vector and native AES-GCM backend are independent cryptographic evidence | PASS |
| V02 | validator | installed Genesis trust succeeds and serialized/runtime brands confer no trust | PASS |
| V03 | validator | real registered author proof and epoch accept developer | PASS |
| V04 | validator | real registered author proof and epoch accept coDeveloper | PASS |
| V05 | validator | real registered author proof and epoch accept observer | PASS |
| V06 | validator | real registered author proof and epoch accept observerDevice2 | PASS |
| V07 | validator | old admitted permit stays valid by signed acceptance time; no current wall clock exists in validator | PASS |
| V08 | validator | repeated historical receipt validates without reconstructing a physical identity | PASS |
| V09 | validator | wrong installed service public key never bootstraps from receipt | PASS |
| V10 | validator | wrong installed developer pin fails before trusting membership publisher | PASS |
| V11 | validator | tampered authenticated service receipt is Gap, never a technical-invalid body capability | PASS |
| V12 | validator | wrong receipt purpose cannot reuse a service signature from another protocol purpose | PASS |
| V13 | validator | signed admission request nonce must match author-signed admission claim nonce | PASS |
| V14 | validator | author claim signature cannot be replaced by service assertion | PASS |
| V15 | validator | claim/admission final digest disagreement is missing provenance | PASS |
| V16 | validator | tampered exact envelope bytes do not turn into trustworthy InvalidChange | PASS |
| V17 | validator | valid signed claim + admission binds exact malformed envelope bytes as technical InvalidChange | PASS |
| V18 | validator | duplicate JSON keys in exact admitted envelope are technical-invalid rather than silently parsed | PASS |
| V19 | validator | bad envelope ES256 signature with valid independent claim is technical-invalid | PASS |
| V20 | validator | wrong wrapping AAD cannot yield a body or shared change | PASS |
| V21 | validator | wrong body AAD cannot yield a body or shared change | PASS |
| V22 | validator | authenticated body duplicate keys fail strict decoding | PASS |
| V23 | validator | authenticated inner appended time must equal signed public header | PASS |
| V24 | validator | authenticated body cannot change content manifest context | PASS |
| V25 | validator | map entity content approval is required even for an authenticated developer body | PASS |
| V26 | validator | missing epoch key stays Gap even if exact bytes are admitted | PASS |
| V27 | validator | missing key plus exact bad bytes cannot advance settlement as InvalidChange | PASS |
| V28 | validator | key capability returning wrong committed group key is Gap | PASS |
| V29 | validator | membership activated after logical append cannot authorize it | PASS |
| V30 | validator | forged author credential absent from signed epoch is Gap | PASS |
| V31 | validator | every signed epoch member agreement fingerprint binds its actual ECDH key | PASS |
| V32 | validator | signed epoch rejects ECDH reuse of registered signing key even for a non-author member | PASS |
| V33 | validator | signed epoch rejects ECDH reuse of developer root key even for a non-author member | PASS |
| V34 | validator | signed epoch rejects ECDH reuse of service root key even for a non-author member | PASS |
| V35 | validator | non-root signed epoch member must retain Observer admission provenance | PASS |
| V36 | validator | permit acceptance at exact expiry endpoint is rejected | PASS |
| V37 | validator | unknown future clock generation is Gap; signed historical generation remains accepted | PASS |
| V38 | validator | untrusted signed clock status does not become trusted because signature verifies | PASS |
| V39 | validator | AddCoDeveloper requires signed active Observer fact at AppendedAt | PASS |
| V40 | validator | RemoveCoDeveloper accepts old valid admission source without requiring target still active | PASS |
| V41 | validator | roster cannot use another observer admission fact as target provenance | PASS |
| V42 | validator | missing observer fact is Gap, not author narrative evidence | PASS |
| V43 | validator | injected crypto outage and producer outage are HostFailure, never technical InvalidChange | PASS |
| V44 | validator | bad cryptography return shape cannot be mistaken for trustworthy digest or key | PASS |
| V45 | validator | signed seal must satisfy S-H and policy fingerprint | PASS |
| V46 | validator | seal chain needs runtime-trusted prior receipt and increasing boundary | PASS |
| V47 | validator | developer closure and rejection proofs stay separate from shared change/body | PASS |
| C01 | codec | canonical decode rejects duplicate and escaped duplicate JSON keys | PASS |
| C02 | codec | canonical decode rejects alternate JSON spellings and trailing input | PASS |
| C03 | codec | strict UTF8 rejects BOM, truncation, overlong, surrogate and out of range encodings | PASS |
| C04 | codec | UTF8 agrees with independent Node encoding across scalar ranges | PASS |
| C05 | codec | object descriptor validation never invokes accessors | PASS |
| C06 | codec | canonical objects reject symbols, hidden properties and foreign prototypes | PASS |
| C07 | codec | canonical arrays reject holes, properties, symbols and custom prototypes | PASS |
| C08 | codec | canonical data rejects cycles, invalid Unicode and unsupported number types | PASS |
| C09 | codec | canonical nesting safety rejects unbounded hostile data | PASS |
| C10 | codec | JCS UTF16 key order and integer subset known vector | PASS |
| C11 | codec | canonical base64url matches independent byte oracle and rejects alternate tails | PASS |
| C12 | codec | domain bytes retain NUL separator and byte comparison is exact | PASS |
| C13 | codec | schema roundtrip and immutable copy: WorldCommitIdentity | PASS |
| C14 | codec | schema roundtrip and immutable copy: SharedPosition | PASS |
| C15 | codec | schema roundtrip and immutable copy: SharedContentReference | PASS |
| C16 | codec | schema roundtrip and immutable copy: WorldSharedGenesis | PASS |
| C17 | codec | schema roundtrip and immutable copy: AuthorSequenceSegment | PASS |
| C18 | codec | schema roundtrip and immutable copy: SharedAppendedAt | PASS |
| C19 | codec | schema roundtrip and immutable copy: WorldAppendPermit | PASS |
| C20 | codec | schema roundtrip and immutable copy: WorldCommitAdmission | PASS |
| C21 | codec | schema roundtrip and immutable copy: WorldCommitAdmissionClaim | PASS |
| C22 | codec | schema roundtrip and immutable copy: SignedWorldCommitAdmissionClaim | PASS |
| C23 | codec | schema roundtrip and immutable copy: WorldDeveloperClosureFact | PASS |
| C24 | codec | schema roundtrip and immutable copy: WorldCommitRejection | PASS |
| C25 | codec | schema roundtrip and immutable copy: WorldAuthorKeyBinding | PASS |
| C26 | codec | schema roundtrip and immutable copy: WorldChangeClass | PASS |
| C27 | codec | schema roundtrip and immutable copy: SharedCommitClass | PASS |
| C28 | codec | schema roundtrip and immutable copy: MonotonicRevealChange | PASS |
| C29 | codec | schema roundtrip and immutable copy: TraceTouchChange | PASS |
| C30 | codec | schema roundtrip and immutable copy: EditTarget | PASS |
| C31 | codec | schema roundtrip and immutable copy: SharedMapEntityDefinition | PASS |
| C32 | codec | schema roundtrip and immutable copy: SharedTriggerDefinition | PASS |
| C33 | codec | schema roundtrip and immutable copy: MapEditOperation | PASS |
| C34 | codec | schema roundtrip and immutable copy: MapEditCommitChange | PASS |
| C35 | codec | schema roundtrip and immutable copy: DeveloperRosterChange | PASS |
| C36 | codec | schema roundtrip and immutable copy: WorldChange | PASS |
| C37 | codec | schema roundtrip and immutable copy: WorldCommit | PASS |
| C38 | codec | schema roundtrip and immutable copy: RestrictedWriteHeader | PASS |
| C39 | codec | schema roundtrip and immutable copy: RelayCommitHeader | PASS |
| C40 | codec | schema roundtrip and immutable copy: WrappedRelayDataKey | PASS |
| C41 | codec | schema roundtrip and immutable copy: RelayCommitEnvelope | PASS |
| C42 | codec | schema roundtrip and immutable copy: AdmittedWorldCommit | PASS |
| C43 | codec | schema roundtrip and immutable copy: SharedEntityRecord | PASS |
| C44 | codec | schema roundtrip and immutable copy: SharedTriggerRecord | PASS |
| C45 | codec | schema roundtrip and immutable copy: TraceTouchAggregate | PASS |
| C46 | codec | schema roundtrip and immutable copy: DeveloperRosterState | PASS |
| C47 | codec | schema roundtrip and immutable copy: SharedWorldState | PASS |
| C48 | codec | schema roundtrip and immutable copy: WorldChangeLogWire | PASS |
| C49 | codec | schema roundtrip and immutable copy: RelaySettlementSeal | PASS |
| C50 | codec | schema roundtrip and immutable copy: CheckpointCoverageEntry | PASS |
| C51 | codec | schema roundtrip and immutable copy: WorldCheckpointWire | PASS |
| C52 | codec | schema roundtrip and immutable copy: SharedSettlementPolicy | PASS |
| C53 | codec | schema roundtrip and immutable copy: RelayCursor | PASS |
| C54 | codec | schema roundtrip and immutable copy: RelayPullReply | PASS |
| C55 | codec | schema roundtrip and immutable copy: SharedAuthorityReceipt | PASS |
| C56 | codec | schema roundtrip and immutable copy: WorldKeyAgreementPublicKey | PASS |
| C57 | codec | schema roundtrip and immutable copy: WorldDeveloperTrustAnchor | PASS |
| C58 | codec | schema roundtrip and immutable copy: WorldObserverAdmissionFact | PASS |
| C59 | codec | schema roundtrip and immutable copy: WorldMemberCredential | PASS |
| C60 | codec | schema roundtrip and immutable copy: WorldRelayKeyDescriptor | PASS |
| C61 | codec | schema roundtrip and immutable copy: WorldMembershipEpoch | PASS |
| C62 | codec | schema roundtrip and immutable copy: WorldMembershipEpochProposal | PASS |
| C63 | codec | schema roundtrip and immutable copy: WorldMembershipChange | PASS |
| C64 | codec | schema roundtrip and immutable copy: WorldRelayKeyPackageContext | PASS |
| C65 | codec | schema roundtrip and immutable copy: WorldRelayKeyPackage | PASS |
| C66 | codec | schema roundtrip and immutable copy: WorldRelayKeyAcceptance | PASS |
| C67 | codec | exact schema rejects extra and missing fields without broad compatibility | PASS |
| C68 | codec | sequence, permit and settlement exact boundaries reject incoherent facts | PASS |
| C69 | codec | touch count uses exact uint128 and independently saturates rendering | PASS |
| C70 | codec | sorted state and coverage preserve exact identities rather than max sequence | PASS |
| C71 | codec | single-object map operations reject old atomic edit arrays and target mismatch | PASS |
| C72 | codec | receipt purpose, identity, accepted-time and key bindings remain distinct | PASS |
| C73 | codec | codec preserves admitted raw bytes for cryptographic invalid-body classification | PASS |
| C74 | codec | stable definition IDs share one domain while references may recur | PASS |
| C75 | codec | Genesis and state reject every cross-kind stable ID collision including tombstones | PASS |
| C76 | codec | created records require edit attribution without excluding edited Genesis records | PASS |
| R01 | replay | R01 deterministic three-class replay, unique touch and canonical checkpoint hashes | PASS |
| R02 | replay | R02 same-millisecond order is account ASCII then sequence, independent of receipt order | PASS |
| R03 | replay | R03 two devices share an account with nonoverlapping segments; holes stay absent from coverage | PASS |
| R04 | replay | R04 signed overlapping segments from different devices are refused | PASS |
| R05 | replay | R05 same identity with two authored envelope digests is an IdentityConflict | PASS |
| R06 | replay | R06 different objects remain independent when one target is deleted | PASS |
| R07 | replay | R07 tombstones prevent Replace/Create resurrection, repeated Delete is NoEffect without new diagnostic | PASS |
| R08 | replay | R08 CoDeveloper permission is evaluated at total-order position, not receipt or pull order | PASS |
| R09 | replay | R09 observer cannot edit map, developer can grant observer then editing works | PASS |
| R10 | replay | R10 unsealed tail emits provisional coverage only and reorders on earlier revocation | PASS |
| R11 | replay | R11 seal includes only complete prefix, tail cannot add terminal coverage or diagnostics | PASS |
| R12 | replay | R12 missing admitted prefix is Gap even with valid seal signature | PASS |
| R13 | replay | R13 seal beyond S-H is rejected; H and retention inequalities are enforced | PASS |
| R14 | replay | R14 exact admitted bad body is covered as technical InvalidChange without state side effects | PASS |
| R15 | replay | R15 missing key and missing exact byte source prevent advancement, not InvalidChange | PASS |
| R16 | replay | R16 host failure never becomes InvalidChange or stores a trusted checkpoint | PASS |
| R17 | replay | R17 checkpoint parent is runtime trusted, not serialized brand or self-consistent hashes | PASS |
| R18 | replay | R18 trusted parent can advance without old log; null diagnostic becomes sealed MergeConflict | PASS |
| R19 | replay | R19 same seal retry returns original checkpoint rather than inventing a new parent chain | PASS |
| R20 | replay | R20 signed new identity below a sealed boundary is Gap, while exact covered duplicate adds nothing | PASS |
| R21 | replay | R21 account closure at the same timestamp freezes root roster but preserves existing CoDeveloper edits | PASS |
| R22 | replay | R22 closure not bound by seal and newly backdated closure cannot change trusted parent | PASS |
| R23 | replay | R23 trigger dangling creation is invalid; deleting anchor preserves existing trigger definition | PASS |
| R24 | replay | R24 explicit Create records attribution, equal Replace is NoEffect and deletion is permanent | PASS |
| R25 | replay | R25 bound failure or pending candidates prevents a checkpoint; input is immutable across awaits | PASS |
| R26 | replay | R26 same-account device conflicts have no exemption and exact aggregate survives display saturation | PASS |
| R27 | replay | R27 uint128 overflow and deleted trace target do not add touch or narrative facts | PASS |
| R28 | replay | R28 exact covered re-delivery inherits local trust after old epoch key removal; new input remains Gap | PASS |
| R29 | replay | R29 stable IDs remain globally reserved across entity, trigger, trace touch and map, including tombstones | PASS |
| R30 | replay | R30 independent closure projects in an empty tail without backdating an earlier checkpoint | PASS |
| R31 | replay | R31 locally observed signed allocation conflicts remain detectable across trusted checkpoint advances | PASS |

独立五源码 AST 导入均限于共享内核，无禁止的平台/DOM/网络/时钟标识。源SHA与final-verified相同；完整机械结果与限度见 acceptance-index.json。
