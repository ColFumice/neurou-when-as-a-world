import type { SharedSchemaKind, SharedSchemaMap } from './SharedCommitContracts';
/** Shape validation grants no crypto/source/lease capability. Those boundaries remain separate. */
export declare class SharedCommitCodec {
    validate<K extends SharedSchemaKind>(kind: K, value: unknown): SharedSchemaMap[K];
    encode<K extends SharedSchemaKind>(kind: K, value: unknown): Uint8Array;
    decode<K extends SharedSchemaKind>(kind: K, bytes: Uint8Array): SharedSchemaMap[K];
}
