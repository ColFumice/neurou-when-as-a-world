import type {
  CoreTransferPayload, CoreTransferProof, CrossDeviceAuthorityPort,
  WorldHomeContext, WorldHomeRegistrySnapshot, WorldHomeRegistrationRequest,
} from '../director/IntentPort';
import type { WorldHomeContractAdapter } from './WorldHomeContractAdapter';

/** Composition supplies the strict codecs and canonical digest; no director values cross this edge. */
export interface CrossDeviceContractBindings {
  readonly parsePayload: (raw: unknown) => CoreTransferPayload;
  readonly parseProof: (raw: unknown, payload: CoreTransferPayload) => CoreTransferProof;
  readonly parseRegistry: (raw: unknown, expectedAccountId: string) => WorldHomeRegistrySnapshot;
  readonly parseContext: (raw: unknown) => WorldHomeContext;
  readonly digestState: (state: CoreTransferPayload['state']) => string;
}

interface PublishedTransfer {
  readonly payloadText: string;
  readonly proofText: string;
}

/**
 * Shared restricted-transfer fixture wrapping the B2.4b ownership authority.
 * An export is admitted only by its bound HomeDevice; proof verification compares
 * the exact past serialized export. The director separately reads current home
 * ownership to distinguish a duplicate from Released or unsupported migration.
 * This in-memory fixture is neither authentication nor a persistent file service.
 */
export class CrossDeviceContractAdapter {
  private readonly bindings: CrossDeviceContractBindings;
  private readonly transfers = new Map<string, PublishedTransfer>();

  constructor(private readonly homeAdapter: Pick<WorldHomeContractAdapter, 'bindDevice'>,
    bindings: CrossDeviceContractBindings) {
    this.bindings = Object.freeze({ parsePayload: bindings.parsePayload, parseProof: bindings.parseProof,
      parseRegistry: bindings.parseRegistry, parseContext: bindings.parseContext, digestState: bindings.digestState });
  }

  bindDevice(rawContext: WorldHomeContext): CrossDeviceAuthorityPort {
    const validated = this.bindings.parseContext(rawContext);
    const context = Object.freeze({ accountId: validated.accountId, deviceId: validated.deviceId });
    const home = this.homeAdapter.bindDevice(context);
    if (home.mode !== 'ContractAdapter' || home.context.accountId !== context.accountId ||
        home.context.deviceId !== context.deviceId) { throw new Error('跨设备契约的归属会话身份不匹配'); }
    return Object.freeze({ mode: 'ContractAdapter' as const, context,
      readRegistry: (): Promise<unknown> => home.readRegistry(),
      registerWorldHome: (request: WorldHomeRegistrationRequest): Promise<unknown> => home.registerWorldHome(request),
      publishTransfer: async (raw: CoreTransferPayload): Promise<unknown> => {
        const payload = this.payload(raw, context);
        if (payload.sourceDeviceId !== context.deviceId) { throw new Error('只有绑定的来源设备可以发布受限 Core'); }
        const payloadText = JSON.stringify(payload);
        await this.checkSource(payload, home.readRegistry.bind(home));
        const proof = this.proof(payload);
        const proofText = JSON.stringify(proof);
        // Compare after the await as well: concurrent publication cannot replace a transfer identity.
        const key = this.key(context.accountId, payload.transferId), previous = this.transfers.get(key);
        if (previous && (previous.payloadText !== payloadText || previous.proofText !== proofText)) {
          throw new Error('传输标识已经绑定其他载荷；原传输保留');
        }
        const response = this.bindings.parseProof(JSON.parse(previous?.proofText ?? proofText) as unknown, payload);
        if (!previous) { this.transfers.set(key, Object.freeze({ payloadText, proofText })); }
        return response;
      },
      verifyTransfer: async (raw: CoreTransferPayload): Promise<unknown> => {
        const payload = this.payload(raw, context), payloadText = JSON.stringify(payload);
        const previous = this.transfers.get(this.key(context.accountId, payload.transferId));
        if (!previous || previous.payloadText !== payloadText) { throw new Error('载荷缺少同账号来源发布证明，或与已发布值不匹配'); }
        const expected = this.proof(payload);
        if (JSON.stringify(expected) !== previous.proofText) { throw new Error('来源发布证明与当前载荷摘要不匹配'); }
        return this.bindings.parseProof(JSON.parse(previous.proofText) as unknown, payload);
      },
    });
  }

  private payload(raw: unknown, context: WorldHomeContext): CoreTransferPayload {
    const payload = this.bindings.parsePayload(raw);
    if (payload.state.accountId !== context.accountId) { throw new Error('受限 Core 传输账号与绑定会话不匹配'); }
    if (payload.state.worldId === 'InitialWorld') { throw new Error('InitialWorld 不参与跨设备传输'); }
    if (payload.sourceHomeRevision !== 1) { throw new Error('受限 Core 原型不支持迁移后的来源归属'); }
    return payload;
  }

  private async checkSource(payload: CoreTransferPayload, readRegistry: () => Promise<unknown>): Promise<void> {
    const snapshot = this.bindings.parseRegistry(await readRegistry(), payload.state.accountId);
    const record = snapshot.records.find(value => value.worldId === payload.state.worldId);
    if (!record || record.homeState !== 'Homed' || record.homeDeviceId !== payload.sourceDeviceId ||
        record.homeRevision !== 1 || record.homeRevision !== payload.sourceHomeRevision) {
      throw new Error('传输来源没有当前 Homed/版本一的同设备权威归属');
    }
  }

  private proof(payload: CoreTransferPayload): CoreTransferProof {
    const sourceDigest = this.bindings.digestState(payload.state);
    if (typeof sourceDigest !== 'string' || !/^[a-f0-9]{64}$/.test(sourceDigest)) { throw new Error('受限 Core 摘要工厂未返回合法 SHA256'); }
    return this.bindings.parseProof({ schemaVersion: 1, accountId: payload.state.accountId,
      worldId: payload.state.worldId, sourceDeviceId: payload.sourceDeviceId, transferId: payload.transferId,
      sourceHomeRevision: 1, sourceDigest }, payload);
  }

  private key(accountId: string, transferId: string): string { return JSON.stringify([accountId, transferId]); }
}
