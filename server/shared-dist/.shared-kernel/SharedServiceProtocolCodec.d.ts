import type { SharedHttpReply, SharedHttpRequest, SharedProtocolOperation, SharedProtocolSignatureKind } from './SharedServiceProtocolContracts';
/** Strict wire only. Crypto, authorization, time, network and storage remain injected platform responsibilities. */
export declare class SharedServiceProtocolCodec {
    static encode(value: unknown): string;
    static validatePayload(operation: SharedProtocolOperation, value: unknown): void;
    static parseRequest(operation: SharedProtocolOperation, raw: string): SharedHttpRequest<unknown>;
    static parseReply(operation: SharedProtocolOperation, raw: string, requestNonce: string): SharedHttpReply<unknown>;
    static validateSignatureInput(kind: SharedProtocolSignatureKind, value: unknown): void;
}
