CREATE TABLE authority_clock_state (
 service_instance_id text PRIMARY KEY, generation bigint NOT NULL CHECK(generation > 0 AND generation <= 9007199254740991),
 last_signed_epoch_ms bigint CHECK(last_signed_epoch_ms >= 0 AND last_signed_epoch_ms <= 9007199254740991),
 trusted boolean NOT NULL, operator_trust_revision text NOT NULL, ip_failure_counters jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE authority_worlds (
 world_id uuid PRIMARY KEY, service_instance_id text NOT NULL, registration jsonb NOT NULL, root_anchor jsonb NOT NULL,
 registration_receipt bytea NOT NULL, current_epoch bigint CHECK(current_epoch > 0), admission_revision bigint NOT NULL DEFAULT 0,
 observer_revision bigint NOT NULL DEFAULT 0, seal_revision bigint NOT NULL DEFAULT 0, sealed_through bigint,
 CHECK(admission_revision BETWEEN 0 AND 9007199254740991), CHECK(observer_revision BETWEEN 0 AND 9007199254740991),
 CHECK(seal_revision BETWEEN 0 AND 9007199254740991)
);
CREATE TABLE authority_author_sequences (
 account_id uuid PRIMARY KEY REFERENCES accounts(account_id), next_sequence bigint NOT NULL CHECK(next_sequence BETWEEN 1 AND 9007199254740991)
);
CREATE TABLE authority_sequence_segments (
 segment_id uuid PRIMARY KEY, account_id uuid NOT NULL REFERENCES accounts(account_id), device_id uuid NOT NULL REFERENCES devices(device_id),
 device_generation bigint NOT NULL, world_id uuid NOT NULL REFERENCES authority_worlds(world_id), membership_epoch bigint NOT NULL,
 first_sequence bigint NOT NULL CHECK(first_sequence > 0), last_sequence bigint NOT NULL CHECK(last_sequence <= 9007199254740991),
 issued_at bigint NOT NULL, expires_at bigint NOT NULL, payload jsonb NOT NULL, receipt bytea NOT NULL,
 CHECK(last_sequence-first_sequence=1023), CHECK(expires_at-issued_at=3600000), UNIQUE(account_id,first_sequence)
);
CREATE TABLE authority_requests (
 service_instance_id text NOT NULL, account_id uuid NOT NULL REFERENCES accounts(account_id), request_nonce text NOT NULL,
 operation text NOT NULL, world_id uuid, device_id uuid NOT NULL, device_generation bigint NOT NULL, request_sha256 text NOT NULL,
 result_wire bytea, result_kind text NOT NULL CHECK(result_kind IN ('Accepted','Rejected')), created_at bigint NOT NULL,
 PRIMARY KEY(service_instance_id,account_id,request_nonce), CHECK(request_sha256 ~ '^[0-9a-f]{64}$')
);
CREATE TABLE authority_append_permits (
 permit_id uuid PRIMARY KEY, world_id uuid NOT NULL REFERENCES authority_worlds(world_id), account_id uuid NOT NULL,
 author_sequence bigint NOT NULL, device_id uuid NOT NULL, device_generation bigint NOT NULL, segment_id uuid NOT NULL REFERENCES authority_sequence_segments(segment_id),
 membership_epoch bigint NOT NULL, change_class text NOT NULL, appended_at bigint NOT NULL, expires_at bigint NOT NULL,
 clock_generation bigint NOT NULL, consumed_sha256 text, payload jsonb NOT NULL, receipt bytea NOT NULL,
 CHECK(expires_at-appended_at=30000), UNIQUE(account_id,author_sequence)
);
CREATE TABLE authority_commit_admissions (
 account_id uuid NOT NULL, author_sequence bigint NOT NULL, world_id uuid NOT NULL REFERENCES authority_worlds(world_id),
 admission_revision bigint NOT NULL, envelope_sha256 text NOT NULL CHECK(envelope_sha256 ~ '^[0-9a-f]{64}$'), appended_at bigint NOT NULL,
 admitted_at bigint NOT NULL, public_header jsonb NOT NULL, payload jsonb NOT NULL, receipt bytea NOT NULL,
 PRIMARY KEY(account_id,author_sequence), UNIQUE(world_id,admission_revision)
);
CREATE TABLE authority_commit_rejections (
 account_id uuid NOT NULL, author_sequence bigint NOT NULL, world_id uuid NOT NULL REFERENCES authority_worlds(world_id),
 envelope_sha256 text NOT NULL, reason text NOT NULL CHECK(reason IN ('TimeTooLate','PermitExpired','EpochClosed','IdentityConflict')),
 payload jsonb NOT NULL, receipt bytea NOT NULL, PRIMARY KEY(account_id,author_sequence,envelope_sha256)
);
CREATE TABLE authority_observer_facts (
 world_id uuid NOT NULL REFERENCES authority_worlds(world_id), account_id uuid NOT NULL REFERENCES accounts(account_id),
 admission_revision bigint NOT NULL, code_revision bigint NOT NULL, admitted_at bigint NOT NULL, payload jsonb NOT NULL, receipt bytea NOT NULL,
 PRIMARY KEY(world_id,account_id), UNIQUE(world_id,admission_revision)
);
CREATE TABLE authority_agreement_credentials (
 world_id uuid NOT NULL REFERENCES authority_worlds(world_id), account_id uuid NOT NULL, device_id uuid NOT NULL, device_generation bigint NOT NULL,
 key_fingerprint text NOT NULL, credential jsonb NOT NULL, challenge_sha256 text NOT NULL, registered_at bigint NOT NULL,
 binding_receipt bytea NOT NULL, registration_receipt bytea NOT NULL,
 PRIMARY KEY(world_id,account_id,device_id,device_generation,key_fingerprint)
);
CREATE TABLE authority_membership_epochs (
 world_id uuid NOT NULL REFERENCES authority_worlds(world_id), membership_epoch bigint NOT NULL, change_id uuid UNIQUE NOT NULL,
 change_sha256 text NOT NULL, proposal jsonb NOT NULL, payload jsonb NOT NULL, activated_at bigint NOT NULL, receipt bytea NOT NULL,
 PRIMARY KEY(world_id,membership_epoch)
);
CREATE TABLE authority_access_codes (
 world_id uuid PRIMARY KEY REFERENCES authority_worlds(world_id), code_revision bigint NOT NULL, verifier text NOT NULL,
 failure_counters jsonb NOT NULL DEFAULT '{}'::jsonb, changed_at bigint NOT NULL,
 CHECK(code_revision BETWEEN 1 AND 9007199254740991), CHECK(verifier ~ '^[0-9a-f]{64}$')
);
CREATE TABLE authority_challenges (
 challenge_id uuid PRIMARY KEY, kind text NOT NULL CHECK(kind IN ('Credential','Observer')), world_id uuid NOT NULL REFERENCES authority_worlds(world_id),
 account_id uuid NOT NULL, device_id uuid NOT NULL, device_generation bigint NOT NULL, session_id uuid NOT NULL REFERENCES auth_families(session_id),
 challenge_sha256 text NOT NULL, public_challenge jsonb NOT NULL, challenge_receipt bytea NOT NULL, expires_at bigint NOT NULL,
 consumed boolean NOT NULL DEFAULT false, expected_tag_sha256 text, terminal_request_sha256 text,
 CHECK((kind='Credential') = (expected_tag_sha256 IS NOT NULL))
);
CREATE TABLE authority_settlement_seals (
 world_id uuid NOT NULL REFERENCES authority_worlds(world_id), seal_revision bigint NOT NULL, cutoff bigint NOT NULL,
 payload jsonb NOT NULL, receipt bytea NOT NULL, PRIMARY KEY(world_id,seal_revision), UNIQUE(world_id,cutoff)
);
CREATE TABLE relay_streams (
 world_id uuid PRIMARY KEY REFERENCES authority_worlds(world_id), generation bigint NOT NULL CHECK(generation > 0),
 next_position numeric(20,0) NOT NULL CHECK(next_position BETWEEN 1 AND 18446744073709551615),
 retention_floor numeric(20,0) NOT NULL DEFAULT 0 CHECK(retention_floor BETWEEN 0 AND 18446744073709551615)
);
CREATE TABLE relay_commit_queue (
 world_id uuid NOT NULL, generation bigint NOT NULL, position numeric(20,0) NOT NULL CHECK(position BETWEEN 1 AND 18446744073709551615),
 account_id uuid NOT NULL, author_sequence bigint NOT NULL, envelope_bytes bytea CHECK(octet_length(envelope_bytes)<=65536),
 public_proof jsonb, envelope_sha256 text NOT NULL, admitted_at bigint NOT NULL, retained_until bigint NOT NULL, tombstone boolean NOT NULL DEFAULT false,
 receipt bytea NOT NULL, PRIMARY KEY(world_id,generation,position), UNIQUE(account_id,author_sequence),
 FOREIGN KEY(account_id,author_sequence) REFERENCES authority_commit_admissions(account_id,author_sequence),
 CHECK(retained_until-admitted_at >= 86400000), CHECK(tombstone OR envelope_bytes IS NOT NULL)
);
CREATE TABLE relay_delivery_recipients (
 world_id uuid NOT NULL, generation bigint NOT NULL, position numeric(20,0) NOT NULL, account_id uuid NOT NULL, device_id uuid NOT NULL,
 device_generation bigint NOT NULL, PRIMARY KEY(world_id,generation,position,account_id,device_id,device_generation),
 FOREIGN KEY(world_id,generation,position) REFERENCES relay_commit_queue(world_id,generation,position)
);
CREATE TABLE relay_acknowledgements (
 world_id uuid NOT NULL, generation bigint NOT NULL, position numeric(20,0) NOT NULL, account_id uuid NOT NULL, device_id uuid NOT NULL,
 device_generation bigint NOT NULL, confirmation_sha256 text NOT NULL, receipt bytea NOT NULL,
 PRIMARY KEY(world_id,generation,position,account_id,device_id,device_generation),
 FOREIGN KEY(world_id,generation,position,account_id,device_id,device_generation)
 REFERENCES relay_delivery_recipients(world_id,generation,position,account_id,device_id,device_generation)
);
