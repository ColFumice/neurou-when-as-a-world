# B2.4d authority / admission peer review

Scope: additive ContractAdapter authority, RealityPause admission, production composition lifecycle and active-runtime retirement. Reviewed the current sources after the fixes below. This is a review artifact, not a docs/namebook/reference change.

## Result

No unresolved P1/P2 finding remains in the reviewed authority and admission paths. A shared durable authority publishes ownership, account pause and initiating-device binding together; local migration journal/Core/directory publication remains a separate storage domain. The client does not infer pause expiry from its own wall clock.

This conclusion is scoped to the ContractAdapter prototype and the reviewed callbacks. It does not establish physical-device authentication, actual external-service consistency or an actual elapsed hour.

The final `validation-summary.json` reports implementation validation and evidence integrity PASS, but `completeProtectedAuditPass: false`: two official documents drifted after the original baseline and their provenance remains unverified. This authority review does not turn that whole-workspace protection exception into a PASS; no baseline or protection allowlist was changed.

## Findings resolved during this review

| Finding | Risk | Final handling / evidence |
|---|---|---|
| Release accepted while source PauseActive journal write fails, leaving Prepared; service snapshot later disappears | A source-history filter could treat Prepared as never released and reopen a moved source | `WorldMigrationPrototype.assertAdmissionNow` checks every matching Source history entry, including Prepared, against current authority HomeDevice. MP12 exercises accepted Release + journal quota + missing service domain; both sync and async source admission reject. |
| Empty sandbox runtime had no active graph boundary | A paused account could leave a MinimalWorldBuilder runtime admitted | `WorldFolderBuilder.update` retires that already-persisted empty runtime when migration admission is closed. |
| Fork final target write / directory publication may run after the initial admission check | Queued local work could publish during RealityPause | Injected fork `assertTargetLease` and `writeTarget` perform fresh synchronous migration admission checks at the final boundaries. Existing B2.3 transaction semantics are preserved. |
| Login resource/auth await may finish after the folder component is destroyed | A disposed view could continue account/world setup | Login rechecks `isValid(this, true)` after `checkLogin`; MP10 also verifies disposal while the formal manifest is pending, and MP11 verifies disposal during async target-open validation releases its lease and never invokes the runtime factory. |

## Verified authority properties

`authority-contract-results.json`: **32 / 32 PASS**, mode **ContractAdapter**.

- Source Release requires a current, issuer-authenticated live drain capability, an exact drained Core digest and the current HomeDevice revision. A serialized assertion alone cannot authorize Release.
- Drain acceptance has a service-owned 30-second TTL. Reaccepting the same live capability does not extend it; consumed source account/device/drain IDs cannot authorize another migration. Reconstruction requires a fresh drain unless replaying an already-committed exact Release.
- Service Release starts `max(1 hour, OfflineGrace)` pause and binds the initiating device to the paused account in the same durable service snapshot. InitialWorld is excluded from Home registration but included in account-wide pause admission.
- All logical devices and world IDs of the paused account reject new admission. The initiating device rejects switching to another account, including after client reconstruction; another device's unrelated account remains independent.
- Only a service operation advances PauseActive to Released. The synchronous final-write guard reads durable service state and never computes expiry. Client `Date.now` changes cannot end a pause; invalid or regressing service time fails closed.
- Exact Release and Claim retries preserve receipts and ownership, including lost responses and reconstruction. Source cannot Claim its own migration. Claim races have one winner. Migration back uses a new transaction from the current HomeDevice, and replaying historical requests does not rewrite current ownership.
- Missing Web Locks, unavailable service, malformed durable schema and failed durable service writes reject rather than fabricate ownership or consume a live drain capability.

`prototype-contract-results.json`: **12 / 12 PASS**, mode **ContractAdapter**. It covers the actual additive composition with real codecs, live drain issuer and world leases, including all-A-world drain, whole-account pause, reconstruction, same-ID target publication/open, local directory quota recovery, missing Web Locks and disposal boundaries.

The final static gate artifact at review time reports naming **0 ERROR / 22 WARN**, typecheck **PASS**, and dependency check **0 ERROR** (120 TypeScript files, approximately 423 static dependency clauses). These are static checks, separate from Creator acceptance.

## Active runtime boundary reviewed

`SceneBuilder` installs `RealityPauseBoundary` around frame intents rather than changing the audio clock or forcing active sessions to Completed. Existing chart controls remain routed to the active session. A previously scheduled reveal-to-chart continuation and an active seven-second sustain can finish through their existing paths. New activity intents are refused while account admission is closed.

Automatic retirement under closed migration admission requires a live `Complete` capture, no queued world intents and no Pending/Failed account clear transaction. `WorldFolderBuilder.exitRuntime` consults the installed SafePoint probe only while `isRuntimeClosed()` is true, and refuses that retirement while the probe is false. A healthy account's explicit exit retains its existing behavior. `createRuntime` and actual retirement both clear the previous runtime's probe. Stable retirement stops the runtime, destroys media/DOM and releases its lease after deferred destruction. The source drain likewise refuses active or unsettled state; it does not force the chart to end.

## Creator active-peer supplement: verified PASS

Rechecked the final `creator-preview-results.json` captured at `2026-10-10T15:34:56.998Z`, its exact harness hash and the on-disk/served evidence. Both **1920×1080** and **2560×1440** report `activeReplayPauseAcceptance.pass: true`. The run has no renderer errors, runtime errors or external requests, and its Electron lifecycle exits with code 0.

Two BrowserWindows share one persistent partition. B opens the already-Claimed same-ID migrated world and starts a formal WorldMemory ChartReplay. A remains at its folder and Releases a different, newly forked A world. The recorded source preflight is idle with no runtime/open/directory operation in flight. B observes closed admission while its replay remains active and Playing, without native pause, seeking or ended events during playback.

| Resolution | Native time before pause | Native time after pause | Native time at second active observation | Natural end |
|---|---:|---:|---:|---:|
| 1920×1080 | 0.424809 s | 0.983210 s | 1.390025 s | 6 s |
| 2560×1440 | 0.446395 s | 1.709317 s | 2.128458 s | 6 s |

The harness deliberately clicks the product folder-exit control during closed admission to verify that it waits for the SafePoint. Both replays continue naturally after that click. Only the natural end emits `pause` / `ended`, both at time 6 with `ended: true`. Runtime, FrameDriver and InputCollector are gone afterward. The service clock advances **0 ms during this supplement**, and the second migration remains PauseActive after retirement.

Independently compared stored evidence: B completedPlayCount increases **1 → 2**, Core revision advances **0 → 1**, and Ledger, PuzzleProgress, FormatTime, RecallCount, WorldLink, ChartSnapshot and forkOrigin are preserved. The separately released A source Core and A directory bytes are unchanged. FirstWorldCleared projection and WorldClearRecord account storage bytes remain unchanged.

All **34 PNGs** (17 per resolution) were read directly: SHA-256 matches the manifest, PNG IHDR dimensions match the exact requested resolution, viewport/canvas dimensions agree, and captured states have no horizontal overflow or errors. No duplicate filename exists in the 34-entry manifest; the visually identical reopen shots legitimately share image bytes.

The exact harness SHA-256 is `9dfa1c3ebb20ebabdf6c1c8c731bb2db5edae7724eca1958024219eb05eee01d`. Its successful path checks compilation before both resolutions and asserts that the compilation manifest is identical afterward, before setting `report.pass = true`. Independently rechecked all **33 modules** in that manifest: current source hashes, local compiler-output hashes, current HTTP-served chunk hashes, and both local/served source-map source contents agree. This ties the production observations to the final reviewed source rather than an earlier Creator compilation.

## Honest prototype boundaries

- The authority uses a shared same-origin durable service fixture, fixed logical device IDs and injected service time. It is ContractAdapter validation, not real AuthService/CommitRelay or physical devices.
- Service fixture advancement demonstrates server-time semantics, not one real elapsed hour. Clients expose only countdown/admission behavior in the product flow.
- Seven-section restricted Core transfer does not transfer the full shared-layer codec, personal media or encryption suite and is not FileCarry.
- The source's initiating device must explicitly reach a SafePoint and drain all local worlds before Release. An already-active runtime on a different device may continue only to its natural SafePoint; account pause closes all new admission immediately.
- Service and local storage cannot be a single atomic transaction. Durable journals and fresh authority checks coordinate recovery; existing source and published target files are retained rather than deleted as fake rollback.

