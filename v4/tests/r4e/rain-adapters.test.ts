import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TauriLocationResolver,
  TauriWeatherResolver,
} from '../../app/src/adapters/rainAdapters';
import type { TauriInvokeFn } from '../../adapters/tauri/tauriInvoke';

describe('R4e.2a rain Tauri adapters', () => {
  test('TauriLocationResolver maps location_resolve', async () => {
    const calls: { command: string; args?: Record<string, unknown> }[] = [];
    const invoke: TauriInvokeFn = (async (command, args) => {
      calls.push({ command, args });
      return {
        ok: true,
        value: { latitude: 31.23, longitude: 121.47, timezone: 'Asia/Shanghai' },
      };
    }) as TauriInvokeFn;
    const resolver = new TauriLocationResolver(invoke);
    const result = await resolver.resolve();
    assert.deepEqual(result, {
      ok: true,
      latitude: 31.23,
      longitude: 121.47,
      timezone: 'Asia/Shanghai',
    });
    assert.equal(calls[0]?.command, 'location_resolve');
  });

  test('TauriLocationResolver 失败返回 ok=false，解析错误区分 ParseError', async () => {
    const invoke: TauriInvokeFn = (async () => ({
      ok: false,
      code: 'ParseError',
      message: 'invalid',
    })) as TauriInvokeFn;
    const resolver = new TauriLocationResolver(invoke);
    assert.deepEqual(await resolver.resolve(), { ok: false, reason: 'ParseError' });
  });

  test('TauriWeatherResolver maps weather_resolve(lat, lon)', async () => {
    const calls: { command: string; args?: Record<string, unknown> }[] = [];
    const invoke: TauriInvokeFn = (async (command, args) => {
      calls.push({ command, args });
      return {
        ok: true,
        value: { weatherCode: 61, precipitationMm: 3.2, isRain: true },
      };
    }) as TauriInvokeFn;
    const resolver = new TauriWeatherResolver(invoke);
    const result = await resolver.resolve(31.23, 121.47);
    assert.deepEqual(result, {
      ok: true,
      weatherCode: 61,
      precipitationMm: 3.2,
      isRain: true,
    });
    assert.equal(calls[0]?.command, 'weather_resolve');
    assert.equal(calls[0]?.args?.lat, 31.23);
    assert.equal(calls[0]?.args?.lon, 121.47);
  });

  test('TauriWeatherResolver 非法坐标不请求；失败返回 ok=false', async () => {
    let calls = 0;
    const invoke: TauriInvokeFn = (async () => {
      calls += 1;
      return { ok: false, code: 'NetworkError', message: 'offline' };
    }) as TauriInvokeFn;
    const resolver = new TauriWeatherResolver(invoke);
    assert.deepEqual(await resolver.resolve(91, 0), { ok: false, reason: 'ParseError' });
    assert.equal(calls, 0);
    assert.deepEqual(await resolver.resolve(31, 121), { ok: false, reason: 'NetworkError' });
    assert.equal(calls, 1);
  });
});
