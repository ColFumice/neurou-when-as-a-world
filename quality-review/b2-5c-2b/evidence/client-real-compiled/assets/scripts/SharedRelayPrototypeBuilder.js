"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSharedRelayPrototype = buildSharedRelayPrototype;
exports.buildSharedRelayPrototypeForLoopbackHttpTest = buildSharedRelayPrototypeForLoopbackHttpTest;
const SharedServiceProtocolCodec_1 = require("../../src/director/SharedServiceProtocolCodec");
const RealSharedServiceSessionAdapter_1 = require("../../src/presentation/RealSharedServiceSessionAdapter");
const RealWorldAuthorityAdapter_1 = require("../../src/presentation/RealWorldAuthorityAdapter");
/** Explicit independent authority composition. No gameplay builders, UI or relay are wired. */
function buildSharedRelayPrototype(environment) {
    const codec = SharedServiceProtocolCodec_1.SharedServiceProtocolCodec;
    const session = new RealSharedServiceSessionAdapter_1.RealSharedServiceSessionAdapter(environment, codec);
    return Object.freeze({ auth: session, session, signer: session,
        authority: new RealWorldAuthorityAdapter_1.RealWorldAuthorityAdapter(session, session, codec) });
}
/** Isolated real-loopback cookie transport. Uses the same codecs and production adapters. */
function buildSharedRelayPrototypeForLoopbackHttpTest(environment, transport) {
    const codec = SharedServiceProtocolCodec_1.SharedServiceProtocolCodec;
    const session = RealSharedServiceSessionAdapter_1.RealSharedServiceSessionAdapter.forLoopbackHttpTest(environment, transport, codec);
    return Object.freeze({ auth: session, session, signer: session,
        authority: new RealWorldAuthorityAdapter_1.RealWorldAuthorityAdapter(session, session, codec) });
}
