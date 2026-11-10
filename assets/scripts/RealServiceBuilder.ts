import type { RealAuthServicePort, RealServiceEnvironment } from './src/director/IntentPort';
import { RealAuthServiceAdapter } from './src/presentation/RealAuthServiceAdapter';

/**
 * Explicit independent composition. The caller supplies installed origin/key pins.
 * No gameplay UI, bootstrap side effect, ContractAdapter substitution or offline admission.
 * Browser deployment must serve the client and /api on this exact same configured origin.
 */
export function buildRealAuthService(environment: RealServiceEnvironment): RealAuthServicePort {
  if (environment.mode !== 'ExternalService') { throw Error('真实服务模式必须为 ExternalService'); }
  return new RealAuthServiceAdapter(environment);
}
