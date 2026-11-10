# B2.4e contract regressions and Creator harness peer review

Scope: read-only production review; isolated execution of the accepted b/c/d contract suites; review of the additive e Creator harness. No new protocol names or production changes.

## Contract regression result

`node quality-review/b2-cross-device-e2e/run-contract-regressions.cjs`: **227 / 227 PASS**, mode **ContractAdapter**. The first 205-case run, runner version, individual reports and logs are preserved under `prior-205-contract-evidence`; the final run adds the accepted 22-case c adapter/content suite.

| Accepted suite | e isolated PASS |
|---|---:|
| b WorldHomeRegistry | 34 / 34 |
| c restricted Core domain/storage | 59 / 59 |
| c composition | 6 / 6 |
| c adapter / formal content validation | 22 / 22 |
| d SafePoint drain | 20 / 20 |
| d RealityPause boundary | 8 / 8 |
| d shared authority | 32 / 32 |
| d migration storage | 34 / 34 |
| d composition | 12 / 12 |

All nine suite processes exit 0. Their scripts and fixture dependencies are copied into `contract-regressions/<original-stage-name>`, preserving relative requires and report-write locations. Only three copied workspace-root anchors are changed to point to the real repository; every test case and fixture body remains the accepted original. Individual reports and logs remain inside e.

Before/after SHA-256 checks cover **21 original scripts / accepted reports** and **127 production TypeScript source paths**. Every hash is unchanged; no previously accepted report is overwritten. The runner also checks expected test counts and individual case results rather than relying on child exit status alone.

MS27 remains **PASS**: migration back explicitly calls `f.advanceServiceBy(3600000)`, which is consumed by the fixture's `serviceNow: () => serverNow` closure. It verifies that historical Claim receipts cannot reopen or republish B after current ownership returns to A; no client-time shortcut or production authority mutation is introduced.

These are current-source ContractAdapter regressions with controlled identities, locks, storage faults and clocks. They are separate from Creator acceptance and do not seed its profile.

## Creator harness review

Reviewed `prepare-preview-harness.cjs` and generated `creator-preview.cjs`, including the accepted d parent flow. No blocking issue found in the reviewed flow. A read-only in-memory replay of the generator produces bytes identical to the generated harness; SHA-256 at review is `74d93efb28cac8b67dbfdc8b40849837ebef0e7564bafbbcd9c08e3599f8572b`. Both files pass `node --check`.

The e additions verify a complete sequence on each resolution: real completed InitialWorld → local fork → A Home registration/export → B restricted Core import with new UUID → B formal Complete/Restored open → source same-ID migration → account pause → service-time cutoff → B Claim/publication/open → rebuild → active-peer replay retirement.

- The copy assertions check seven section keys, new world identity and import forkOrigin, FormatTime, inherited Ledger/ChartSnapshot/ChartScore, per-section account/world rebinding, Published journal and B HomeDevice. InitialWorld does not appear in Home records.
- A source Core/directory and account clear/projection bytes are compared before and after import. The copy opens through the product port and must restore/capture all seven parts without changing its bytes.
- During pause, A InitialWorld/source entry, new B import, premature Claim and the existing B copy's open all reject. Reconstructed initiating-device login to another account rejects. Service fixture time advances explicitly by 3,599,999 ms and then 1 ms; no actual elapsed-hour claim is made.
- Same-ID Claim publishes beside the copy in the B directory. Import and migration journal keys differ; the import journal and copy Core are compared byte-for-byte after migration and after the final peer replay. The original copy Home revision remains 1; migrated source Home revision becomes 3.
- The accepted two-window active-peer flow is preserved. One idle A window Releases a different A world while B replays. B observes closed admission, keeps natural native playback, rejects explicit folder exit until a SafePoint, then retires after real native media end and stable Core. The fixture clock does not advance during that observation.
- **39 unique required source modules** explicitly include the b/c/d registry, codecs, authority adapters, import/migration storage, drain and pause boundary. Before the run, served source maps must contain current source and served chunks must equal local compiler output; after both resolutions the complete manifest must be identical before PASS is assigned.
- Each screenshot checks exact viewport/canvas size, DPR 1, no horizontal overflow, no observed runtime error and no Core error. Renderer errors, runtime errors and external requests must be empty. Each resolution uses a fresh isolated profile/partition, while its peer windows share the partition.

## Final Creator evidence: independent PASS

Independently reviewed `creator-preview-results.json` captured at `2026-10-10T16:24:30.253Z` and finished at `2026-10-10T16:25:21.926Z`. Both resolutions pass transfer, migration, integration and active-peer acceptance. The exact reviewed harness hash matches the result manifest; its successful path checks compilation before and after both resolutions. Lifecycle exit is 0; renderer errors, runtime errors and external requests are empty.

`peer-evidence-integrity-results.json` records the independent audit. All **40 PNGs** (20 per resolution) match the recorded SHA-256, PNG IHDR dimensions, viewport/canvas dimensions, DPR and captured no-error/no-overflow states. All **39 modules** match current source hashes, local compiler-output hashes and current localhost-served chunk hashes; both local and served source-map source contents include exact current source. Visually inspected the 1920×1080 active-replay shot and 2560×1440 formal copy-restored shot; the former shows active replay and waiting-for-SafePoint exit control, and the latter shows Complete / Restored 7/7.

The manifest has **40 unique filenames and 36 unique PNG SHA-256 values**. In each resolution, shots 09 (copy restored), 15 (migration restored) and 16 (rebuilt migration open) legitimately share identical image bytes because they render the same inherited content and FormatTime. The protocol does not require distinct screenshot hashes. Rechecked contemporaneous metadata: shot 09's runtime ID is the new copy UUID; shots 15/16 use the original migrated world ID. Their distinct identity and publication are established by runtime IDs plus the captured Core, Home records, directory and journals, not by screenshots alone. Earlier shorthand “no duplicates” referred only to filenames, not unique visual hashes.

Independent stored-state comparisons confirm the new-UUID copy's seven-part rebinding and inherited data, exact same-ID migration payload and revision, initial-world exclusion from Home records, and simultaneous B Home records for copy (revision 1) and migrated source (revision 3). The B directory includes both world IDs. Copy Core and import journal bytes survive migration, restart and the final second pause unchanged; the migration journal stays independent. A source Core/directory bytes and account WorldClearRecord / FirstWorldCleared bytes are preserved, and no B-namespaced account fact is created.

| Resolution | Native time before second pause | Native time after admission closes | Native time after rejected explicit folder exit | Natural end |
|---|---:|---:|---:|---:|
| 1920×1080 | 0.423647 s | 1.011889 s | 1.392548 s | 6 s |
| 2560×1440 | 0.419828 s | 1.075958 s | 1.476903 s | 6 s |

Both replays remain active / Playing with no pause, seeking or ended event during those observations. Only natural media end emits pause / ended, at time 6 with ended true; then runtime, FrameDriver and InputCollector are absent. The second migration remains PauseActive and the service fixture advances **0 ms during this peer observation**. CompletedPlayCount increases by one while Ledger, PuzzleProgress, FormatTime, RecallCount, WorldLink, ChartSnapshot and forkOrigin remain unchanged.

ContractAdapter fixture, logical-device and restricted-Core boundaries remain explicit; full FileCarry, real services and a real elapsed hour remain outside the evidence scope. Initial pause cutoff is exercised with the independent service fixture's explicit 3,600,000 ms advance, not client time.

The user has explicitly confirmed Trae's documentation authorization and accepted B2.4d. This e review uses the current authorized baseline and does not reopen the superseded d documentation-provenance question.
