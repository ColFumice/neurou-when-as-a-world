import type {
  RealServiceEnvironment, RealAuthServicePort, RealWorldAuthorityProtocolPort,
  SharedServiceSessionPort, RegisteredAuthorSigningPort,
} from './src/director/IntentPort';
import { SharedServiceProtocolCodec } from './src/director/SharedServiceProtocolCodec';
import { RealSharedServiceSessionAdapter } from './src/presentation/RealSharedServiceSessionAdapter';
import { RealWorldAuthorityAdapter } from './src/presentation/RealWorldAuthorityAdapter';

/** Explicit independent authority composition. No gameplay builders, UI or relay are wired. */
export function buildSharedRelayPrototype(environment: RealServiceEnvironment): {
  readonly auth: RealAuthServicePort;
  readonly session: SharedServiceSessionPort;
  readonly signer: RegisteredAuthorSigningPort;
  readonly authority: RealWorldAuthorityProtocolPort;
} {
  const codec = SharedServiceProtocolCodec;
  const session = new RealSharedServiceSessionAdapter(environment, codec);
  return Object.freeze({ auth: session, session, signer: session,
    authority: new RealWorldAuthorityAdapter(session, session, codec) });
}

/** Isolated real-loopback cookie transport. Uses the same codecs and production adapters. */
export function buildSharedRelayPrototypeForLoopbackHttpTest(environment: RealServiceEnvironment, transport: typeof fetch): {
  readonly auth: RealAuthServicePort;
  readonly session: SharedServiceSessionPort;
  readonly signer: RegisteredAuthorSigningPort;
  readonly authority: RealWorldAuthorityProtocolPort;
} {
  const codec = SharedServiceProtocolCodec;
  const session = RealSharedServiceSessionAdapter.forLoopbackHttpTest(environment, transport, codec);
  return Object.freeze({ auth: session, session, signer: session,
    authority: new RealWorldAuthorityAdapter(session, session, codec) });
}
