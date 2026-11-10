import { Protagonist } from '../character/Protagonist';
import { VisibilityState } from '../trace/VisibilityState';
import { VisibilityTransitionReason } from '../trace/VisibilityTransition';
import { InputSource } from '../ledger/NarrativeEvent';
import { VectorSchemaVersion } from '../../constants/index';
import { validatePuzzleControlState, validatePuzzleProgressSnapshot } from './PuzzleHydration';
const TRIGGER_DISTANCE_WM = 2;
const FORGET_DISTANCE_WM = 5;
export class DirectorSession {
    constructor() {
        this.currentPerceptionMode = 'Normal';
        this.protagonist = null;
        this.mapCenter = null;
        this.visibilityTrackedEntities = [];
        this.puzzleChain = null;
        this.deepTrace = null;
        this.ledgerEvents = [];
        this.ledgerAppend = {
            append: (event) => {
                this.ledgerEvents.push(Object.freeze(Object.assign(Object.assign({}, event), { vector: Object.freeze([...event.vector]), AppendedAt: Object.freeze(Object.assign({}, event.AppendedAt)), ChapterTag: Object.freeze(Object.assign({}, event.ChapterTag)), ChartRef: Object.freeze(Object.assign({}, event.ChartRef)) })));
            },
        };
        this.ledgerRead = null;
        this.screenProjectionProbe = null;
        this.rhythmStrikeProbe = null;
        this.beatClockProbe = null;
        this.beatClockOffsetMs = 0;
        this.endpointSettled = false;
        this.worldMotionGated = false;
        this.chartEntryScheduled = false;
        this.chartPremiere = null;
        this.chartClockProbe = null;
        this.chartMediaProbe = null;
        this.chartCompletionRecorded = false;
        this.puzzleControlHydrated = false;
        this.hasSubmittedFrame = false;
    }
    bindProtagonist(protagonist) {
        this.protagonist = protagonist;
    }
    bindMapCenter(mapCenter) {
        this.mapCenter = mapCenter;
    }
    bindVisibilityTrackedEntities(entities) {
        for (const entity of entities) {
            this.visibilityTrackedEntities.push(entity);
        }
    }
    getLedgerEvents() {
        var _a, _b;
        return (_b = (_a = this.ledgerRead) === null || _a === void 0 ? void 0 : _a.traverse()) !== null && _b !== void 0 ? _b : this.ledgerEvents.slice();
    }
    isWorldMotionGated() { return this.worldMotionGated; }
    getPuzzleControlState(revealPhase) {
        var _a;
        const chartState = (_a = this.chartPremiere) === null || _a === void 0 ? void 0 : _a.getState();
        if (!this.puzzleChain || !this.deepTrace || !this.chartPremiere || this.chartPremiere.getTier() !== 'Regular' ||
            this.chartEntryScheduled || this.worldMotionGated || (chartState !== 'Ready' && chartState !== 'Exited') ||
            (revealPhase !== 'Idle' && revealPhase !== 'Finished') ||
            (revealPhase === 'Idle' && this.deepTrace.isTriggered())) {
            throw new Error('UnsupportedBoundary: 解谜未装配或仍在活动谱面/揭示边界');
        }
        this.puzzleChain.capturePrivateState();
        return validatePuzzleControlState({ currentPerceptionMode: this.currentPerceptionMode,
            beatClockOffsetMs: this.beatClockOffsetMs, endpointSettled: this.endpointSettled,
            deepTraceTriggered: this.deepTrace.isTriggered(), chartCompletionRecorded: this.chartCompletionRecorded,
            revealPhase, chartEntryScheduled: false, worldMotionGated: false });
    }
    hydratePuzzleControlState(snapshot) {
        if (this.hasSubmittedFrame || this.puzzleControlHydrated || !this.puzzleChain || !this.deepTrace ||
            !this.chartPremiere || this.chartPremiere.getTier() !== 'Regular' || this.chartPremiere.getState() !== 'Ready' ||
            this.endpointSettled || this.chartCompletionRecorded || this.chartEntryScheduled || this.worldMotionGated) {
            throw new Error('解谜恢复只允许尚未运行的完整装配');
        }
        const descriptors = Object.getOwnPropertyDescriptors(snapshot);
        const identity = {};
        for (const name of ['accountId', 'worldId', 'chainId', 'deepTraceId']) {
            const descriptor = descriptors[name];
            if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value') || typeof descriptor.value !== 'string') {
                throw new Error('解谜恢复身份不可安全读取');
            }
            identity[name] = descriptor.value;
        }
        const validated = validatePuzzleProgressSnapshot(snapshot, identity.accountId, identity.worldId, identity.chainId, identity.deepTraceId, this.chartPremiere.getChartId(), this.getLedgerEvents());
        if (JSON.stringify(this.puzzleChain.capturePrivateState()) !== JSON.stringify(validated.chain) ||
            this.deepTrace.isTriggered() !== validated.control.deepTraceTriggered) {
            throw new Error('解谜恢复对象种子与已验证快照不一致');
        }
        this.currentPerceptionMode = validated.control.currentPerceptionMode;
        this.beatClockOffsetMs = validated.control.beatClockOffsetMs;
        this.endpointSettled = validated.control.endpointSettled;
        this.chartCompletionRecorded = validated.control.chartCompletionRecorded;
        this.worldMotionGated = false;
        this.chartEntryScheduled = false;
        this.puzzleControlHydrated = true;
    }
    bindPuzzleChain(chain) {
        this.puzzleChain = chain;
    }
    bindDeepTrace(trace) {
        this.deepTrace = trace;
    }
    bindLedgerAppend(append) {
        this.ledgerAppend = append;
    }
    bindLedgerSource(source) {
        this.ledgerAppend = source;
        this.ledgerRead = source;
    }
    bindScreenProjectionProbe(probe) {
        this.screenProjectionProbe = probe;
    }
    bindRhythmStrikeProbe(probe) {
        this.rhythmStrikeProbe = probe;
    }
    bindBeatClockProbe(probe) {
        this.beatClockProbe = probe;
    }
    bindChartPremiere(premiere) {
        this.chartPremiere = premiere;
    }
    bindChartMediaProbe(probe) {
        this.chartMediaProbe = probe;
    }
    bindChartClockProbe(probe) {
        this.chartClockProbe = probe;
    }
    getBeatClockOffsetMs() {
        return this.beatClockOffsetMs;
    }
    setBeatClockOffsetMs(offsetMs) {
        this.beatClockOffsetMs = offsetMs;
    }
    isChartEntryScheduled() {
        return this.chartEntryScheduled;
    }
    setPerceptionMode(mode) {
        this.currentPerceptionMode = mode;
    }
    static createWithProtagonist(protagonistSeed, mapCenter) {
        const session = new DirectorSession();
        const protagonist = new Protagonist(protagonistSeed);
        session.bindProtagonist(protagonist);
        session.bindMapCenter(mapCenter);
        return session;
    }
    submitFrameIntents(intents, frameDurationSeconds) {
        var _a, _b;
        this.hasSubmittedFrame = true;
        const frameBeganGated = this.worldMotionGated;
        if (intents.some(intent => intent.kind === 'EnterChart')) {
            this.handleEnterChartIntent();
        }
        let frameHasJump = false;
        for (const intent of intents) {
            switch (intent.kind) {
                case 'SwitchPerceptionMode':
                    if (!this.worldMotionGated) {
                        this.setPerceptionMode(intent.mode);
                    }
                    break;
                case 'Move':
                    if (!this.worldMotionGated && !frameBeganGated && this.protagonist !== null && this.mapCenter !== null) {
                        this.protagonist.move({ lateral: intent.lateral, depth: intent.depth }, frameDurationSeconds, this.mapCenter);
                    }
                    break;
                case 'Strike':
                    if (this.isChartContext() && intent.keyId !== undefined) {
                        (_a = this.chartPremiere) === null || _a === void 0 ? void 0 : _a.submitStrike({
                            videoTimeMs: intent.videoTimeMs,
                            keyId: intent.keyId,
                            phase: intent.phase,
                        });
                    }
                    else if (intent.keyId === undefined && !this.isChartContext()) {
                        this.handleStrikeIntent();
                    }
                    break;
                case 'EnterChart':
                    this.handleEnterChartIntent();
                    break;
                case 'ExitChart':
                    this.handleExitChartIntent();
                    break;
                case 'ToggleChartPause':
                    (_b = this.chartPremiere) === null || _b === void 0 ? void 0 : _b.togglePause(intent.videoTimeMs);
                    break;
                case 'Jump':
                    frameHasJump = !this.worldMotionGated && !frameBeganGated;
                    break;
            }
        }
        if (this.worldMotionGated || frameBeganGated) {
            this.driveChartPlayback(frameDurationSeconds);
            return;
        }
        if (this.protagonist === null) {
            return;
        }
        const groundedBeforeTick = this.protagonist.isGrounded();
        if (frameHasJump && groundedBeforeTick) {
            this.protagonist.jump();
        }
        this.protagonist.tickVertical(frameDurationSeconds);
        const groundedAfterTick = this.protagonist.isGrounded();
        if (frameHasJump && !groundedBeforeTick && groundedAfterTick) {
            this.protagonist.jump();
        }
        this.updateElementVisibility();
        this.updatePuzzleChain();
    }
    getCurrentPerceptionMode() {
        return this.currentPerceptionMode;
    }
    getChartPlaybackState() {
        return this.chartPremiere !== null ? this.chartPremiere.getState() : 'Ready';
    }
    isChartContext() {
        if (this.chartPremiere === null) {
            return false;
        }
        const state = this.chartPremiere.getState();
        return state === 'Playing' || state === 'Paused';
    }
    driveChartPlayback(frameDurationSeconds) {
        var _a;
        if (this.chartPremiere === null || this.chartClockProbe === null) {
            return;
        }
        const mediaTimeMs = this.chartClockProbe();
        if (this.chartPremiere.getState() === 'Ready' && mediaTimeMs >= 0) {
            this.chartPremiere.begin();
        }
        if (this.chartPremiere.getState() === 'Playing' && mediaTimeMs >= 0) {
            this.chartPremiere.advance(mediaTimeMs);
        }
        const media = (_a = this.chartMediaProbe) === null || _a === void 0 ? void 0 : _a.call(this);
        if (media !== undefined) {
            this.chartPremiere.advanceMediaStatus(media.ended, media.unavailable, frameDurationSeconds * 1000);
        }
        if (this.chartPremiere.getState() === 'Completed') {
            if (!this.chartCompletionRecorded) {
                this.recordChartCompletion(mediaTimeMs);
            }
            if (this.chartCompletionRecorded) {
                this.handleExitChartIntent();
            }
        }
    }
    recordChartCompletion(finishedAtMs) {
        if (this.ledgerAppend !== null && this.chartPremiere !== null) {
            this.ledgerAppend.append(this.buildCompletionNarrativeEvent(finishedAtMs));
            this.chartCompletionRecorded = true;
        }
    }
    buildCompletionNarrativeEvent(_finishedAtMs) {
        const zeroVector = [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        ];
        const eventId = 'T7_COMPLETION_PLACEHOLDER';
        return {
            eventId,
            vector: zeroVector,
            VectorSchemaVersion,
            AppendedAt: { epochMs: Date.now() },
            InputSource: InputSource.Player,
            ChapterTag: {},
            ChartRef: {
                chartId: this.chartPremiere !== null ? this.chartPremiere.getChartId() : '',
                state: 'PremiereCompleted',
            },
        };
    }
    resolveChartRef() {
        if (this.chartPremiere !== null) {
            return { chartId: this.chartPremiere.getChartId() };
        }
        return { chartId: 'CHART_NOT_BOUND' };
    }
    handleExitChartIntent() {
        if (!this.chartEntryScheduled) {
            return;
        }
        if (this.chartPremiere !== null) {
            if (this.chartPremiere.getState() === 'Completed' && !this.chartCompletionRecorded) {
                this.recordChartCompletion(this.chartPremiere.getCurrentTimeMs());
            }
            const probeTime = this.chartClockProbe !== null ? this.chartClockProbe() : -1;
            this.chartPremiere.requestExit(probeTime >= 0 ? probeTime : 0);
        }
        this.worldMotionGated = false;
        this.chartEntryScheduled = false;
    }
    updateElementVisibility() {
        if (this.protagonist === null) {
            return;
        }
        const protagonistPosition = this.protagonist.getPosition();
        const triggerDistanceSquared = TRIGGER_DISTANCE_WM * TRIGGER_DISTANCE_WM;
        const forgetDistanceSquared = FORGET_DISTANCE_WM * FORGET_DISTANCE_WM;
        for (const entity of this.visibilityTrackedEntities) {
            const entityPosition = entity.getPosition();
            const dx = entityPosition.lateral - protagonistPosition.lateral;
            const dz = entityPosition.depth - protagonistPosition.depth;
            const distanceSquared = dx * dx + dz * dz;
            const state = entity.getVisibilityState();
            if (state === VisibilityState.Concealed &&
                distanceSquared <= triggerDistanceSquared) {
                entity.applyVisibility({ reason: VisibilityTransitionReason.Trigger });
            }
            else if (state === VisibilityState.Revealed &&
                distanceSquared >= forgetDistanceSquared) {
                entity.applyVisibility({ reason: VisibilityTransitionReason.Forget });
            }
        }
    }
    handleStrikeIntent() {
        if (this.worldMotionGated) {
            return;
        }
        if (this.puzzleChain === null || this.rhythmStrikeProbe === null) {
            return;
        }
        const strike = this.rhythmStrikeProbe();
        if (strike === null) {
            return;
        }
        this.evaluatePuzzleApproach();
        if (!this.worldMotionGated) {
            this.puzzleChain.attemptStrike(strike);
        }
    }
    handleEnterChartIntent() {
        if (this.chartEntryScheduled || this.chartCompletionRecorded) {
            return;
        }
        if (!this.endpointSettled) {
            return;
        }
        if (this.chartPremiere !== null) {
            const premiereState = this.chartPremiere.getState();
            if (premiereState === 'Exited' || premiereState === 'Completed') {
                this.chartPremiere.reopen();
                this.chartCompletionRecorded = false;
            }
        }
        this.chartEntryScheduled = true;
        this.worldMotionGated = true;
    }
    updatePuzzleChain() {
        if (this.endpointSettled) {
            return;
        }
        if (this.puzzleChain === null || this.deepTrace === null) {
            return;
        }
        if (this.protagonist === null) {
            return;
        }
        const stage = this.puzzleChain.getProgress().getStage();
        if (stage === 'Completed') {
            this.settlePuzzleChainEndpoint();
            return;
        }
        this.evaluatePuzzleApproach();
        if (this.beatClockProbe !== null) {
            const now = this.beatClockProbe();
            const currentBeatTimeMs = now < 0 ? -1 : now + this.beatClockOffsetMs;
            if (currentBeatTimeMs >= 0) {
                this.puzzleChain.checkSustainedExpiry(currentBeatTimeMs);
                if (this.puzzleChain.getProgress().getStage() === 'Completed') {
                    this.settlePuzzleChainEndpoint();
                }
            }
        }
    }
    evaluatePuzzleApproach() {
        if (!this.protagonist || !this.deepTrace || !this.puzzleChain) {
            return;
        }
        const protagonistPosition = this.protagonist.getPosition();
        const tracePosition = this.deepTrace.getPosition();
        const deltaLateral = tracePosition.lateral - protagonistPosition.lateral;
        const deltaDepth = tracePosition.depth - protagonistPosition.depth;
        const distanceWm = Math.sqrt(deltaLateral * deltaLateral + deltaDepth * deltaDepth);
        const projection = this.screenProjectionProbe !== null ? this.screenProjectionProbe() : null;
        this.puzzleChain.evaluateStepCondition(distanceWm, projection);
    }
    settlePuzzleChainEndpoint() {
        if (this.endpointSettled) {
            return;
        }
        if (this.ledgerAppend === null) {
            return;
        }
        this.ledgerAppend.append(this.buildEndpointNarrativeEvent());
        this.endpointSettled = true;
        this.worldMotionGated = true;
        if (this.deepTrace !== null) {
            this.deepTrace.markTriggered();
        }
    }
    buildEndpointNarrativeEvent() {
        const zeroVector = [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        ];
        const eventId = 'T6_ENDPOINT_PLACEHOLDER';
        return {
            eventId,
            vector: zeroVector,
            VectorSchemaVersion,
            AppendedAt: { epochMs: Date.now() },
            InputSource: InputSource.Player,
            ChapterTag: {},
            ChartRef: Object.assign(Object.assign({}, this.resolveChartRef()), { state: 'Entry' }),
        };
    }
}
