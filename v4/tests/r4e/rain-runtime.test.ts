import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { RainRuntime } from '../../app/src/game/rainRuntime';
import type {
  LocationResolver,
  LocationResult,
  WeatherResolver,
  WeatherResult,
} from '../../app/src/adapters/rainAdapters';
import { RainIntensity, RainModeState } from '../../core/world/types';

class FakeLocation implements LocationResolver {
  calls = 0;
  constructor(private result: LocationResult | (() => Promise<LocationResult>)) {}
  async resolve(): Promise<LocationResult> {
    this.calls += 1;
    return typeof this.result === 'function' ? this.result() : this.result;
  }
}

class FakeWeather implements WeatherResolver {
  calls = 0;
  constructor(private result: WeatherResult | (() => Promise<WeatherResult>)) {}
  async resolve(_lat: number, _lon: number): Promise<WeatherResult> {
    this.calls += 1;
    return typeof this.result === 'function' ? this.result() : this.result;
  }
}

const LOCATION_OK: LocationResult = {
  ok: true,
  latitude: 31.23,
  longitude: 121.47,
  timezone: 'Asia/Shanghai',
};

function weatherOk(code = 61, precipitationMm = 3): WeatherResult {
  return { ok: true, weatherCode: code, precipitationMm, isRain: true };
}

function makeRuntime(options: {
  location: FakeLocation;
  weather: FakeWeather;
  now: () => number;
  states?: RainModeState[];
}): RainRuntime {
  return new RainRuntime({
    locationResolver: options.location,
    weatherResolver: options.weather,
    now: options.now,
    onStateChange: (state) => options.states?.push(state),
  });
}

describe('R4e.2a RainRuntime', () => {
  test('默认关闭；setEnabled(false) 不请求', async () => {
    const location = new FakeLocation(LOCATION_OK);
    const weather = new FakeWeather(weatherOk());
    const runtime = makeRuntime({ location, weather, now: () => 0 });
    await runtime.setEnabled(false);
    await runtime.advanceTo(10_000_000);
    assert.equal(runtime.enabled, false);
    assert.equal(location.calls, 0);
    assert.equal(weather.calls, 0);
    assert.equal(runtime.state.active, false);
  });

  test('setEnabled(true) 立即 refresh；成功 → active + intensity', async () => {
    let now = 0;
    const location = new FakeLocation(LOCATION_OK);
    const weather = new FakeWeather(weatherOk(61, 3));
    const states: RainModeState[] = [];
    const runtime = makeRuntime({ location, weather, now: () => now, states });

    await runtime.setEnabled(true);
    assert.equal(location.calls, 1);
    assert.equal(weather.calls, 1);
    assert.equal(runtime.state.active, true);
    assert.equal(runtime.state.intensity, RainIntensity.Moderate);
    assert.equal(runtime.state.degradedReason, null);
    assert.equal(runtime.state.lastResolvedAt, 0);
    assert.equal(runtime.state.source, 'IpWeather');
    assert.equal(states.length, 1);
  });

  test('无雨成功 → active=false、degradedReason=null', async () => {
    const location = new FakeLocation(LOCATION_OK);
    const weather = new FakeWeather(weatherOk(0, 0));
    const runtime = makeRuntime({ location, weather, now: () => 0 });
    await runtime.setEnabled(true);
    assert.equal(runtime.state.active, false);
    assert.equal(runtime.state.degradedReason, null);
  });

  test('失败 → 30s 后重试；连续失败退避 60/120/240s 封顶', async () => {
    let now = 0;
    const location = new FakeLocation({ ok: false, reason: 'NetworkError' });
    const weather = new FakeWeather(weatherOk());
    const runtime = makeRuntime({ location, weather, now: () => now });

    await runtime.setEnabled(true);
    assert.equal(location.calls, 1);
    assert.equal(runtime.state.active, false);
    assert.equal(runtime.state.degradedReason, 'NetworkUnavailable');
    assert.equal(weather.calls, 0);

    now = 29_999;
    await runtime.advanceTo(now);
    assert.equal(location.calls, 1);

    now = 30_000;
    await runtime.advanceTo(now);
    assert.equal(location.calls, 2);

    now = 89_999;
    await runtime.advanceTo(now);
    assert.equal(location.calls, 2);

    now = 90_000;
    await runtime.advanceTo(now);
    assert.equal(location.calls, 3);

    now = 209_999;
    await runtime.advanceTo(now);
    assert.equal(location.calls, 3);

    now = 210_000;
    await runtime.advanceTo(now);
    assert.equal(location.calls, 4);

    now = 449_999;
    await runtime.advanceTo(now);
    assert.equal(location.calls, 4);

    now = 450_000;
    await runtime.advanceTo(now);
    assert.equal(location.calls, 5);

    now = 689_999;
    await runtime.advanceTo(now);
    assert.equal(location.calls, 5);

    now = 690_000;
    await runtime.advanceTo(now);
    assert.equal(location.calls, 6);
  });

  test('解析失败映射 LocationUnavailable / WeatherUnavailable', async () => {
    const location = new FakeLocation({ ok: false, reason: 'ParseError' });
    const weather = new FakeWeather(weatherOk());
    const runtime = makeRuntime({ location, weather, now: () => 0 });
    await runtime.setEnabled(true);
    assert.equal(runtime.state.active, false);
    assert.equal(runtime.state.degradedReason, 'LocationUnavailable');
    assert.equal(weather.calls, 0);

    const weatherLocation = new FakeLocation(LOCATION_OK);
    const badWeather = new FakeWeather({ ok: false, reason: 'ParseError' });
    const weatherRuntime = makeRuntime({
      location: weatherLocation,
      weather: badWeather,
      now: () => 0,
    });
    await weatherRuntime.setEnabled(true);
    assert.equal(weatherRuntime.state.active, false);
    assert.equal(weatherRuntime.state.degradedReason, 'WeatherUnavailable');
  });

  test('online 事件 → 立即重试', async () => {
    let now = 0;
    const location = new FakeLocation({ ok: false, reason: 'NetworkError' });
    const weather = new FakeWeather(weatherOk());
    const runtime = makeRuntime({ location, weather, now: () => now });

    await runtime.setEnabled(true);
    assert.equal(location.calls, 1);
    now = 1000;
    await runtime.notifyOnline();
    assert.equal(location.calls, 2);
  });

  test('10 分钟周期刷新', async () => {
    let now = 0;
    const location = new FakeLocation(LOCATION_OK);
    const weather = new FakeWeather(weatherOk());
    const runtime = makeRuntime({ location, weather, now: () => now });
    await runtime.setEnabled(true);
    assert.equal(weather.calls, 1);

    now = 599_999;
    await runtime.advanceTo(now);
    assert.equal(weather.calls, 1);

    now = 600_000;
    await runtime.advanceTo(now);
    assert.equal(weather.calls, 2);
  });

  test('refresh 抛异常 / onStateChange 抛异常都不外溢', async () => {
    const location = new FakeLocation(async () => {
      throw new Error('boom');
    });
    const weather = new FakeWeather(weatherOk());
    const runtime = new RainRuntime({
      locationResolver: location,
      weatherResolver: weather,
      now: () => 0,
      onStateChange: () => {
        throw new Error('callback boom');
      },
    });
    await runtime.setEnabled(true);
    assert.equal(runtime.state.active, false);
    assert.equal(runtime.state.degradedReason, 'NetworkUnavailable');
    await runtime.advanceTo(30_000);
    assert.equal(runtime.state.active, false);
  });
});
