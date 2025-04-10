-- Enable uuid-ossp extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables with a clean slate approach
-- We'll save data first, then recreate the schema with UUIDs

-- Create temporary tables to store data
CREATE TEMP TABLE tmp_organizations AS SELECT * FROM organizations;
CREATE TEMP TABLE tmp_users AS SELECT * FROM users;
CREATE TEMP TABLE tmp_domains AS SELECT * FROM domains;
CREATE TEMP TABLE tmp_dns_records AS SELECT * FROM dns_records;
CREATE TEMP TABLE tmp_providers AS SELECT * FROM providers;
CREATE TEMP TABLE tmp_api_tokens AS SELECT * FROM api_tokens;
CREATE TEMP TABLE tmp_dns_history AS SELECT * FROM dns_history;
CREATE TEMP TABLE tmp_dns_metrics AS SELECT * FROM dns_metrics;

-- Drop all tables (in reverse order of dependencies)
DROP TABLE IF EXISTS dns_metrics;
DROP TABLE IF EXISTS dns_history;
DROP TABLE IF EXISTS dns_records;
DROP TABLE IF EXISTS api_tokens;
DROP TABLE IF EXISTS domains;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS providers;
DROP TABLE IF EXISTS organizations;

-- Now recreate tables with UUID fields
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  credentials JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES providers(id) ON DELETE SET NULL,
  provider_domain_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  auto_update BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  last_checked TIMESTAMP
);

CREATE TABLE dns_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  ttl INTEGER NOT NULL DEFAULT 3600,
  priority INTEGER,
  provider_record_id TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  auto_update BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  last_updated TIMESTAMP
);

CREATE TABLE api_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  permissions TEXT[] NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  last_used TIMESTAMP
);

CREATE TABLE dns_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES dns_records(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  previous_value TEXT,
  new_value TEXT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE dns_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type TEXT NOT NULL,
  domain_id UUID REFERENCES domains(id) ON DELETE CASCADE,
  record_id UUID REFERENCES dns_records(id) ON DELETE CASCADE,
  value DOUBLE PRECISION NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT now()
);

-- Create new tables for the features that were missing
CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  secret TEXT,
  events TEXT[] NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_triggered TIMESTAMP,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE webhook_delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  response TEXT,
  status_code INTEGER,
  status BOOLEAN NOT NULL,
  error TEXT,
  timestamp TIMESTAMP NOT NULL DEFAULT now(),
  duration_ms INTEGER NOT NULL
);

CREATE TABLE custom_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  permissions TEXT[] NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE group_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  conditions JSONB
);

-- Helper function to generate a UUID from an integer
CREATE OR REPLACE FUNCTION int_to_uuid(id INTEGER) RETURNS UUID AS $$
BEGIN
  RETURN uuid_generate_v5('11111111-1111-1111-1111-111111111111'::UUID, id::TEXT);
END;
$$ LANGUAGE plpgsql;

-- Insert data back into the tables with UUIDs
-- Organizations
INSERT INTO organizations (id, name, is_active, created_at)
SELECT int_to_uuid(id), name, is_active, created_at
FROM tmp_organizations;

-- Providers
INSERT INTO providers (id, name, type, credentials, is_active, created_at)
SELECT int_to_uuid(id), name, type, credentials, is_active, created_at
FROM tmp_providers;

-- Users
INSERT INTO users (id, username, password, email, full_name, role, organization_id, created_at)
SELECT int_to_uuid(id), username, password, email, full_name, role, int_to_uuid(organization_id), created_at
FROM tmp_users;

-- Domains
INSERT INTO domains (id, name, organization_id, provider_id, provider_domain_id, is_active, auto_update, created_at, last_checked)
SELECT int_to_uuid(id), name, int_to_uuid(organization_id), 
       CASE WHEN provider_id IS NOT NULL THEN int_to_uuid(provider_id) ELSE NULL END,
       provider_domain_id, is_active, auto_update, created_at, last_checked
FROM tmp_domains;

-- DNS Records
INSERT INTO dns_records (id, domain_id, name, type, content, ttl, priority, provider_record_id, notes, is_active, auto_update, created_at, last_updated)
SELECT int_to_uuid(id), int_to_uuid(domain_id), name, type, content, ttl, priority, provider_record_id, notes, is_active, auto_update, created_at, last_updated
FROM tmp_dns_records;

-- API Tokens
INSERT INTO api_tokens (id, organization_id, name, token, permissions, created_by, expires_at, is_active, created_at, last_used)
SELECT int_to_uuid(id), int_to_uuid(organization_id), name, token, permissions, 
       CASE WHEN created_by IS NOT NULL THEN int_to_uuid(created_by) ELSE NULL END,
       expires_at, is_active, created_at, last_used
FROM tmp_api_tokens;

-- DNS History
INSERT INTO dns_history (id, record_id, action, previous_value, new_value, user_id, timestamp)
SELECT int_to_uuid(id), int_to_uuid(record_id), action, previous_value, new_value, 
       CASE WHEN user_id IS NOT NULL THEN int_to_uuid(user_id) ELSE NULL END,
       timestamp
FROM tmp_dns_history;

-- DNS Metrics
INSERT INTO dns_metrics (id, metric_type, domain_id, record_id, value, timestamp)
SELECT int_to_uuid(id), metric_type, 
       CASE WHEN domain_id IS NOT NULL THEN int_to_uuid(domain_id) ELSE NULL END,
       CASE WHEN record_id IS NOT NULL THEN int_to_uuid(record_id) ELSE NULL END,
       value, timestamp
FROM tmp_dns_metrics;

-- Drop the conversion function
DROP FUNCTION int_to_uuid;

-- Clean up session table if it exists
DROP TABLE IF EXISTS session;

-- Recreate session table for auth
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");