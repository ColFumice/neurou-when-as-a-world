import type { SharedSchemaErrorCode } from './SharedCommitContracts';
/** Schema failures are data-boundary outcomes, never successful partial parsing. */
export declare class SharedSchemaError extends Error {
    readonly code: SharedSchemaErrorCode;
    constructor(code: SharedSchemaErrorCode, message?: string);
}
/** Pure byte boundary: no platform codecs, network, clocks or crypto implementation. */
export declare class SharedCanonicalBytes {
    static encode(value: unknown): Uint8Array;
    static decode(bytes: Uint8Array): unknown;
    static utf8(text: string): Uint8Array;
    static text(bytes: Uint8Array): string;
    static base64UrlEncode(bytes: Uint8Array): string;
    static base64UrlDecode(text: string, expectedLength?: number): Uint8Array;
    static equalBytes(first: Uint8Array, second: Uint8Array): boolean;
    static domain(domainString: string, value: unknown): Uint8Array;
}
