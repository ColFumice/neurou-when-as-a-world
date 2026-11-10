"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharedCanonicalBytes = exports.SharedSchemaError = void 0;
/** Schema failures are data-boundary outcomes, never successful partial parsing. */
class SharedSchemaError extends Error {
    code;
    constructor(code, message = code) {
        super(message);
        this.code = code;
        this.name = 'SharedSchemaError';
        Object.setPrototypeOf(this, SharedSchemaError.prototype);
    }
}
exports.SharedSchemaError = SharedSchemaError;
const BASE64_URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const CANONICAL_DEPTH_LIMIT = 128;
function invalid(message) {
    throw new SharedSchemaError('CanonicalInvalid', message);
}
function scalarString(value) {
    for (let index = 0; index < value.length; index += 1) {
        const code = value.charCodeAt(index);
        if (code >= 0xd800 && code <= 0xdbff) {
            const next = value.charCodeAt(index + 1);
            if (next < 0xdc00 || next > 0xdfff || !Number.isFinite(next)) {
                invalid('Unpaired Unicode surrogate');
            }
            index += 1;
        }
        else if (code >= 0xdc00 && code <= 0xdfff) {
            invalid('Unpaired Unicode surrogate');
        }
    }
}
function descriptors(value) {
    if (Object.getOwnPropertySymbols(value).length !== 0) {
        invalid('Symbol property');
    }
    return Object.getOwnPropertyDescriptors(value);
}
function canonical(value, ancestors, depth) {
    if (depth > CANONICAL_DEPTH_LIMIT) {
        throw new SharedSchemaError('LimitExceeded', 'Canonical nesting limit');
    }
    if (value === null) {
        return 'null';
    }
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }
    if (typeof value === 'number') {
        if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
            invalid('Expected safe integer without negative zero');
        }
        return String(value);
    }
    if (typeof value === 'string') {
        scalarString(value);
        return JSON.stringify(value);
    }
    if (typeof value !== 'object') {
        invalid('Unsupported JSON value');
    }
    if (ancestors.has(value)) {
        invalid('Cyclic JSON value');
    }
    ancestors.add(value);
    const properties = descriptors(value);
    let result;
    if (Array.isArray(value)) {
        if (Object.getPrototypeOf(value) !== Array.prototype) {
            invalid('Unsupported array prototype');
        }
        const length = properties.length;
        if (!length || !('value' in length) || !Number.isSafeInteger(length.value) || length.value < 0) {
            invalid('Invalid array length');
        }
        if (Object.keys(properties).length !== length.value + 1) {
            invalid('Sparse array or extra array property');
        }
        const items = [];
        for (let index = 0; index < length.value; index += 1) {
            const property = properties[String(index)];
            if (!property || !('value' in property) || !property.enumerable) {
                invalid('Array accessor or missing element');
            }
            items.push(canonical(property.value, ancestors, depth + 1));
        }
        result = '[' + items.join(',') + ']';
    }
    else {
        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) {
            invalid('Unsupported object prototype');
        }
        const items = [];
        for (const key of Object.keys(properties).sort()) {
            scalarString(key);
            const property = properties[key];
            if (!('value' in property) || !property.enumerable) {
                invalid('Object accessor or non-enumerable property');
            }
            items.push(JSON.stringify(key) + ':' + canonical(property.value, ancestors, depth + 1));
        }
        result = '{' + items.join(',') + '}';
    }
    ancestors.delete(value);
    return result;
}
/** Small JSON parser keeps duplicate keys visible before any ordinary object exists. */
class SharedJsonReader {
    source;
    position = 0;
    constructor(source) {
        this.source = source;
    }
    read() {
        const result = this.value(0);
        this.space();
        if (this.position !== this.source.length) {
            invalid('Trailing JSON input');
        }
        return result;
    }
    space() {
        while (' \t\r\n'.indexOf(this.source.charAt(this.position)) >= 0 && this.position < this.source.length) {
            this.position += 1;
        }
    }
    value(depth) {
        if (depth > CANONICAL_DEPTH_LIMIT) {
            throw new SharedSchemaError('LimitExceeded', 'JSON nesting limit');
        }
        this.space();
        const first = this.source.charAt(this.position);
        if (first === '"') {
            return this.string();
        }
        if (first === '{') {
            this.position += 1;
            const result = Object.create(null);
            const keys = new Set();
            this.space();
            if (this.source.charAt(this.position) === '}') {
                this.position += 1;
                return result;
            }
            while (true) {
                this.space();
                if (this.source.charAt(this.position) !== '"') {
                    invalid('Expected JSON object key');
                }
                const key = this.string();
                if (keys.has(key)) {
                    invalid('Duplicate JSON key');
                }
                keys.add(key);
                this.space();
                if (this.source.charAt(this.position) !== ':') {
                    invalid('Expected JSON colon');
                }
                this.position += 1;
                Object.defineProperty(result, key, { value: this.value(depth + 1), enumerable: true, writable: true, configurable: true });
                this.space();
                const separator = this.source.charAt(this.position++);
                if (separator === '}') {
                    return result;
                }
                if (separator !== ',') {
                    invalid('Expected JSON object separator');
                }
            }
        }
        if (first === '[') {
            this.position += 1;
            const result = [];
            this.space();
            if (this.source.charAt(this.position) === ']') {
                this.position += 1;
                return result;
            }
            while (true) {
                result.push(this.value(depth + 1));
                this.space();
                const separator = this.source.charAt(this.position++);
                if (separator === ']') {
                    return result;
                }
                if (separator !== ',') {
                    invalid('Expected JSON array separator');
                }
            }
        }
        for (const entry of [{ text: 'true', value: true }, { text: 'false', value: false }, { text: 'null', value: null }]) {
            if (this.source.slice(this.position, this.position + entry.text.length) === entry.text) {
                this.position += entry.text.length;
                return entry.value;
            }
        }
        const match = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(this.source.slice(this.position));
        if (!match) {
            invalid('Invalid JSON value');
        }
        this.position += match[0].length;
        const number = Number(match[0]);
        if (!Number.isSafeInteger(number) || Object.is(number, -0)) {
            invalid('Invalid integer JSON value');
        }
        return number;
    }
    string() {
        this.position += 1;
        let result = '';
        while (this.position < this.source.length) {
            const character = this.source.charAt(this.position++);
            if (character === '"') {
                scalarString(result);
                return result;
            }
            if (character.charCodeAt(0) < 0x20) {
                invalid('Unescaped JSON control character');
            }
            if (character !== '\\') {
                result += character;
                continue;
            }
            const escape = this.source.charAt(this.position++);
            const escapes = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
            if (Object.prototype.hasOwnProperty.call(escapes, escape)) {
                result += escapes[escape];
                continue;
            }
            if (escape !== 'u') {
                invalid('Invalid JSON string escape');
            }
            const hex = this.source.slice(this.position, this.position + 4);
            if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
                invalid('Invalid Unicode escape');
            }
            result += String.fromCharCode(parseInt(hex, 16));
            this.position += 4;
        }
        return invalid('Unterminated JSON string');
    }
}
function assertBytes(bytes) {
    if (!(bytes instanceof Uint8Array) || Object.getPrototypeOf(bytes) !== Uint8Array.prototype) {
        invalid('Expected direct Uint8Array');
    }
}
/** Pure byte boundary: no platform codecs, network, clocks or crypto implementation. */
class SharedCanonicalBytes {
    static encode(value) {
        return SharedCanonicalBytes.utf8(canonical(value, new Set(), 0));
    }
    static decode(bytes) {
        const source = SharedCanonicalBytes.text(bytes);
        const result = new SharedJsonReader(source).read();
        if (!SharedCanonicalBytes.equalBytes(bytes, SharedCanonicalBytes.encode(result))) {
            invalid('Non-canonical JSON bytes');
        }
        return result;
    }
    static utf8(text) {
        if (typeof text !== 'string') {
            invalid('Expected text');
        }
        scalarString(text);
        const bytes = [];
        for (let index = 0; index < text.length; index += 1) {
            let code = text.charCodeAt(index);
            if (code >= 0xd800 && code <= 0xdbff) {
                code = 0x10000 + ((code - 0xd800) << 10) + text.charCodeAt(++index) - 0xdc00;
            }
            if (code < 0x80) {
                bytes.push(code);
            }
            else if (code < 0x800) {
                bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
            }
            else if (code < 0x10000) {
                bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
            }
            else {
                bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
            }
        }
        return new Uint8Array(bytes);
    }
    static text(bytes) {
        assertBytes(bytes);
        const characters = [];
        for (let index = 0; index < bytes.length;) {
            const first = bytes[index++];
            let code;
            let continuation;
            let minimum;
            if (first < 0x80) {
                code = first;
                continuation = 0;
                minimum = 0;
            }
            else if (first >= 0xc2 && first <= 0xdf) {
                code = first & 0x1f;
                continuation = 1;
                minimum = 0x80;
            }
            else if (first >= 0xe0 && first <= 0xef) {
                code = first & 0x0f;
                continuation = 2;
                minimum = 0x800;
            }
            else if (first >= 0xf0 && first <= 0xf4) {
                code = first & 7;
                continuation = 3;
                minimum = 0x10000;
            }
            else {
                return invalid('Invalid UTF-8 lead byte');
            }
            if (index + continuation > bytes.length) {
                invalid('Truncated UTF-8');
            }
            for (let count = 0; count < continuation; count += 1) {
                const next = bytes[index++];
                if ((next & 0xc0) !== 0x80) {
                    invalid('Invalid UTF-8 continuation');
                }
                code = (code << 6) | (next & 0x3f);
            }
            if (code < minimum || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) {
                invalid('Invalid UTF-8 scalar');
            }
            if (characters.length === 0 && code === 0xfeff) {
                invalid('UTF-8 BOM');
            }
            if (code <= 0xffff) {
                characters.push(String.fromCharCode(code));
            }
            else {
                code -= 0x10000;
                characters.push(String.fromCharCode(0xd800 | (code >> 10), 0xdc00 | (code & 0x3ff)));
            }
        }
        return characters.join('');
    }
    static base64UrlEncode(bytes) {
        assertBytes(bytes);
        let result = '';
        for (let index = 0; index < bytes.length; index += 3) {
            const first = bytes[index];
            const second = index + 1 < bytes.length ? bytes[index + 1] : 0;
            const third = index + 2 < bytes.length ? bytes[index + 2] : 0;
            result += BASE64_URL_ALPHABET.charAt(first >> 2);
            result += BASE64_URL_ALPHABET.charAt(((first & 3) << 4) | (second >> 4));
            if (index + 1 < bytes.length) {
                result += BASE64_URL_ALPHABET.charAt(((second & 15) << 2) | (third >> 6));
            }
            if (index + 2 < bytes.length) {
                result += BASE64_URL_ALPHABET.charAt(third & 63);
            }
        }
        return result;
    }
    static base64UrlDecode(text, expectedLength) {
        if (typeof text !== 'string' || !/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1) {
            invalid('Invalid base64url');
        }
        if (expectedLength !== undefined && (!Number.isSafeInteger(expectedLength) || expectedLength < 0)) {
            invalid('Invalid expected byte length');
        }
        if (expectedLength !== undefined && Math.floor(text.length * 3 / 4) !== expectedLength) {
            invalid('Unexpected decoded byte length');
        }
        const bytes = [];
        let value = 0;
        let bits = 0;
        for (let index = 0; index < text.length; index += 1) {
            value = (value << 6) | BASE64_URL_ALPHABET.indexOf(text.charAt(index));
            bits += 6;
            if (bits >= 8) {
                bits -= 8;
                bytes.push((value >> bits) & 255);
                value &= (1 << bits) - 1;
            }
        }
        const result = new Uint8Array(bytes);
        if (value !== 0 || SharedCanonicalBytes.base64UrlEncode(result) !== text) {
            invalid('Non-canonical base64url');
        }
        if (expectedLength !== undefined && result.length !== expectedLength) {
            invalid('Unexpected decoded byte length');
        }
        return result;
    }
    static equalBytes(first, second) {
        assertBytes(first);
        assertBytes(second);
        if (first.length !== second.length) {
            return false;
        }
        let difference = 0;
        for (let index = 0; index < first.length; index += 1) {
            difference |= first[index] ^ second[index];
        }
        return difference === 0;
    }
    static domain(domainString, value) {
        const prefix = SharedCanonicalBytes.utf8(domainString);
        const encoded = SharedCanonicalBytes.encode(value);
        const result = new Uint8Array(prefix.length + encoded.length);
        result.set(prefix, 0);
        result.set(encoded, prefix.length);
        return result;
    }
}
exports.SharedCanonicalBytes = SharedCanonicalBytes;
