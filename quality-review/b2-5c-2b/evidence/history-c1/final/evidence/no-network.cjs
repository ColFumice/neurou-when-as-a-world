'use strict';
// Test instrumentation only. This is evidence that the exercised modules use no network,
// not a general OS security sandbox. No HTTP/socket helper is available to this test run.
const Module = require('node:module');
const denied = new Set(['http', 'https', 'http2', 'net', 'tls', 'dns', 'dgram', 'undici']);
const oldLoad = Module._load;
let deniedAttempts = 0;
const fail = name => { deniedAttempts += 1; throw new Error('NO_NETWORK_TEST: attempted ' + name); };
process.on('exit', () => { process.stderr.write('NO_NETWORK_TEST_ATTEMPTS:' + deniedAttempts + '\n'); });
Module._load = function(name, ...rest) {
  const normalized = name.startsWith('node:') ? name.slice(5) : name;
  if (denied.has(normalized)) return fail(name);
  return oldLoad.call(this, name, ...rest);
};
if (typeof process.getBuiltinModule === 'function') {
  const original = process.getBuiltinModule;
  process.getBuiltinModule = function(name) {
    const normalized = name.startsWith('node:') ? name.slice(5) : name;
    if (denied.has(normalized)) return fail(name);
    return original.call(this, name);
  };
}
globalThis.fetch = () => fail('global fetch');
globalThis.WebSocket = class { constructor() { fail('global WebSocket'); } };
