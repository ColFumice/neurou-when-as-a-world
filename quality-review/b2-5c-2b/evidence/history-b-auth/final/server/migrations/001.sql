BEGIN;
CREATE TABLE IF NOT EXISTS service_schema_versions (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS accounts (
 account_id uuid PRIMARY KEY, account_name text UNIQUE NOT NULL CHECK (account_name ~ '^[A-Za-z0-9_.-]{3,64}$'),
 password_hash text NOT NULL, created_at bigint NOT NULL, disabled boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS devices (
 device_id uuid PRIMARY KEY, account_id uuid NOT NULL REFERENCES accounts(account_id), generation integer NOT NULL CHECK (generation > 0),
 key_fingerprint text NOT NULL, public_key_jwk jsonb NOT NULL, label text NOT NULL,
 assurance text NOT NULL CHECK (assurance = 'RegisteredCredential'), status text NOT NULL CHECK (status IN ('Active','Revoked')),
 created_at bigint NOT NULL, UNIQUE(account_id,key_fingerprint)
);
CREATE TABLE IF NOT EXISTS auth_families (
 session_id uuid PRIMARY KEY, account_id uuid NOT NULL REFERENCES accounts(account_id), device_id uuid NOT NULL REFERENCES devices(device_id),
 csrf_hash text NOT NULL, absolute_expires_at bigint NOT NULL, revoked boolean NOT NULL DEFAULT false,
 created_at bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_tokens (
 token_hash text PRIMARY KEY, session_id uuid NOT NULL REFERENCES auth_families(session_id),
 kind text NOT NULL CHECK (kind IN ('Access','Refresh')), expires_at bigint NOT NULL, used boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS auth_tokens_session_index ON auth_tokens(session_id);
CREATE TABLE IF NOT EXISTS device_challenges (
 challenge_id uuid PRIMARY KEY, purpose text NOT NULL CHECK (purpose IN ('LoginDevice','RegisterDevice')),
 account_name text NOT NULL, device_id uuid, public_key_jwk jsonb NOT NULL, key_fingerprint text NOT NULL,
 challenge_data jsonb NOT NULL, expires_at bigint NOT NULL, consumed boolean NOT NULL DEFAULT false,
 owner_session_id uuid REFERENCES auth_families(session_id)
);
CREATE TABLE IF NOT EXISTS lightweight_requests (
 account_id uuid NOT NULL REFERENCES accounts(account_id), request_id uuid NOT NULL, operation text NOT NULL,
 request_digest text NOT NULL, result jsonb NOT NULL, PRIMARY KEY(account_id,request_id)
);
CREATE SEQUENCE IF NOT EXISTS service_clock_generation;
INSERT INTO service_schema_versions(version) VALUES (1) ON CONFLICT DO NOTHING;
COMMIT;
