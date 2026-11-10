/** JSON grammar parser rejects duplicate keys before JSON.parse can erase them. */
export function parseStrictJson(text) {
    let i = 0;
    function whitespace() { while (/[\x20\x09\x0a\x0d]/.test(text[i] ?? '') && i < text.length)
        i++; }
    function string() {
        const start = i++;
        while (i < text.length) {
            const char = text[i++];
            if (char === '"') {
                const value = JSON.parse(text.slice(start, i));
                if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value))
                    throw new Error('Invalid Unicode');
                return value;
            }
            if (char === '\\')
                i++;
        }
        throw new Error('Unterminated string');
    }
    function value(depth = 0) {
        if (depth > 32)
            throw new Error('Too deeply nested');
        whitespace();
        const char = text[i];
        if (char === '"') {
            string();
            return;
        }
        if (char === '{') {
            i++;
            whitespace();
            const keys = new Set();
            if (text[i] === '}') {
                i++;
                return;
            }
            for (;;) {
                whitespace();
                if (text[i] !== '"')
                    throw new Error('Object key required');
                const key = string();
                if (keys.has(key))
                    throw new Error('Duplicate key');
                keys.add(key);
                whitespace();
                if (text[i++] !== ':')
                    throw new Error('Colon required');
                value(depth + 1);
                whitespace();
                const next = text[i++];
                if (next === '}')
                    return;
                if (next !== ',')
                    throw new Error('Invalid object');
            }
        }
        if (char === '[') {
            i++;
            whitespace();
            if (text[i] === ']') {
                i++;
                return;
            }
            for (;;) {
                value(depth + 1);
                whitespace();
                const next = text[i++];
                if (next === ']')
                    return;
                if (next !== ',')
                    throw new Error('Invalid array');
            }
        }
        const match = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(i));
        if (!match)
            throw new Error('Invalid value');
        i += match[0].length;
        if (/^-?\d/.test(match[0]) && !Number.isSafeInteger(Number(match[0])))
            throw new Error('Unsafe number');
    }
    value();
    whitespace();
    if (i !== text.length)
        throw new Error('Trailing data');
    return JSON.parse(text);
}
