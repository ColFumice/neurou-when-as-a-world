import {
  invoke as defaultInvoke,
  type TauriInvokeFn,
} from '../../../adapters/tauri/tauriInvoke';

export type RainResolverFailureReason = 'NetworkError' | 'ParseError';

/** R2 · X 层：IP 定位结果。 */
export type LocationResult =
  | {
    readonly ok: true;
    readonly latitude: number;
    readonly longitude: number;
    readonly timezone: string;
  }
  | {
    readonly ok: false;
    readonly reason: RainResolverFailureReason;
  };

/** R2 · X 层：天气解析结果。 */
export type WeatherResult =
  | {
    readonly ok: true;
    readonly weatherCode: number;
    readonly precipitationMm: number;
    readonly isRain: boolean;
  }
  | {
    readonly ok: false;
    readonly reason: RainResolverFailureReason;
  };

export interface LocationResolver {
  resolve(): Promise<LocationResult>;
}

export interface WeatherResolver {
  resolve(lat: number, lon: number): Promise<WeatherResult>;
}

interface LocationPayload {
  readonly latitude: number;
  readonly longitude: number;
  readonly timezone: string;
}

interface WeatherPayload {
  readonly weatherCode: number;
  readonly precipitationMm: number;
  readonly isRain: boolean;
}

function failureReason(code: string): RainResolverFailureReason {
  return code === 'ParseError' || code === 'InvalidRequest' ? 'ParseError' : 'NetworkError';
}

function validCoordinate(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value >= min
    && value <= max;
}

/** X · Tauri IP 定位适配器；不缓存，每次 resolve 都调用 Rust。 */
export class TauriLocationResolver implements LocationResolver {
  constructor(private readonly invokeFn: TauriInvokeFn = defaultInvoke) {}

  async resolve(): Promise<LocationResult> {
    try {
      const result = await this.invokeFn<LocationPayload>('location_resolve');
      if (!result.ok) return { ok: false, reason: failureReason(result.code) };
      const value = result.value;
      if (typeof value !== 'object' || value === null) {
        return { ok: false, reason: 'ParseError' };
      }
      if (!validCoordinate(value.latitude, -90, 90)
        || !validCoordinate(value.longitude, -180, 180)
        || typeof value.timezone !== 'string'
        || value.timezone.trim().length === 0) {
        return { ok: false, reason: 'ParseError' };
      }
      return {
        ok: true,
        latitude: value.latitude,
        longitude: value.longitude,
        timezone: value.timezone,
      };
    } catch {
      return { ok: false, reason: 'NetworkError' };
    }
  }
}

/** X · Tauri 天气适配器；不缓存，每次 resolve 都调用 Rust。 */
export class TauriWeatherResolver implements WeatherResolver {
  constructor(private readonly invokeFn: TauriInvokeFn = defaultInvoke) {}

  async resolve(lat: number, lon: number): Promise<WeatherResult> {
    if (!validCoordinate(lat, -90, 90) || !validCoordinate(lon, -180, 180)) {
      return { ok: false, reason: 'ParseError' };
    }
    try {
      const result = await this.invokeFn<WeatherPayload>('weather_resolve', { lat, lon });
      if (!result.ok) return { ok: false, reason: failureReason(result.code) };
      const value = result.value;
      if (typeof value !== 'object' || value === null) {
        return { ok: false, reason: 'ParseError' };
      }
      if (!Number.isSafeInteger(value.weatherCode)
        || value.weatherCode < 0
        || !Number.isFinite(value.precipitationMm)
        || value.precipitationMm < 0
        || typeof value.isRain !== 'boolean') {
        return { ok: false, reason: 'ParseError' };
      }
      return {
        ok: true,
        weatherCode: value.weatherCode,
        precipitationMm: value.precipitationMm,
        isRain: value.isRain,
      };
    } catch {
      return { ok: false, reason: 'NetworkError' };
    }
  }
}
