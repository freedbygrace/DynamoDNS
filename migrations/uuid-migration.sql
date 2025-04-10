-- Create a temporary UUID conversion function
CREATE OR REPLACE FUNCTION convert_id_to_uuid(id INTEGER)
RETURNS UUID AS $$
BEGIN
    -- Base UUID namespace with a static prefix for our app
    RETURN uuid_generate_v5('11111111-1111-1111-1111-111111111111'::UUID, id::TEXT);
END;
$$ LANGUAGE plpgsql;

-- Enable uuid-ossp extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Migrate organizations first since it's a parent table
-- Create temporary UUID column
ALTER TABLE organizations ADD COLUMN temp_id UUID DEFAULT gen_random_uuid();

-- Update with deterministic UUIDs based on original IDs
UPDATE organizations SET temp_id = convert_id_to_uuid(id);

-- Start migrating related tables (we will add foreign key constraints later)
-- 2. Users table
-- Add temp UUID column
ALTER TABLE users ADD COLUMN temp_id UUID DEFAULT gen_random_uuid();
ALTER TABLE users ADD COLUMN temp_organization_id UUID;

-- Update with deterministic UUIDs
UPDATE users SET 
    temp_id = convert_id_to_uuid(id),
    temp_organization_id = (SELECT temp_id FROM organizations WHERE id = users.organization_id);

-- 3. Domains table
ALTER TABLE domains ADD COLUMN temp_id UUID DEFAULT gen_random_uuid();
ALTER TABLE domains ADD COLUMN temp_organization_id UUID;

UPDATE domains SET 
    temp_id = convert_id_to_uuid(id),
    temp_organization_id = (SELECT temp_id FROM organizations WHERE id = domains.organization_id);

-- 4. DNS Records
ALTER TABLE dns_records ADD COLUMN temp_id UUID DEFAULT gen_random_uuid();
ALTER TABLE dns_records ADD COLUMN temp_domain_id UUID;

UPDATE dns_records SET 
    temp_id = convert_id_to_uuid(id),
    temp_domain_id = (SELECT temp_id FROM domains WHERE id = dns_records.domain_id);

-- 5. Providers
ALTER TABLE providers ADD COLUMN temp_id UUID DEFAULT gen_random_uuid();

UPDATE providers SET temp_id = convert_id_to_uuid(id);

-- 6. API Tokens
ALTER TABLE api_tokens ADD COLUMN temp_id UUID DEFAULT gen_random_uuid();
ALTER TABLE api_tokens ADD COLUMN temp_organization_id UUID;

UPDATE api_tokens SET 
    temp_id = convert_id_to_uuid(id),
    temp_organization_id = (SELECT temp_id FROM organizations WHERE id = api_tokens.organization_id);

-- 7. DNS History
ALTER TABLE dns_history ADD COLUMN temp_id UUID DEFAULT gen_random_uuid();
ALTER TABLE dns_history ADD COLUMN temp_record_id UUID;
ALTER TABLE dns_history ADD COLUMN temp_user_id UUID;

UPDATE dns_history SET 
    temp_id = convert_id_to_uuid(id),
    temp_record_id = (SELECT temp_id FROM dns_records WHERE id = dns_history.record_id),
    temp_user_id = CASE 
                    WHEN user_id IS NOT NULL THEN (SELECT temp_id FROM users WHERE id = dns_history.user_id)
                    ELSE NULL
                   END;

-- 8. DNS Metrics
ALTER TABLE dns_metrics ADD COLUMN temp_id UUID DEFAULT gen_random_uuid();
ALTER TABLE dns_metrics ADD COLUMN temp_domain_id UUID NULL;
ALTER TABLE dns_metrics ADD COLUMN temp_record_id UUID NULL;

UPDATE dns_metrics SET 
    temp_id = convert_id_to_uuid(id),
    temp_domain_id = CASE 
                    WHEN domain_id IS NOT NULL THEN (SELECT temp_id FROM domains WHERE id = dns_metrics.domain_id)
                    ELSE NULL
                   END,
    temp_record_id = CASE 
                    WHEN record_id IS NOT NULL THEN (SELECT temp_id FROM dns_records WHERE id = dns_metrics.record_id)
                    ELSE NULL
                   END;

-- Now drop old columns and rename new ones
-- 1. Organizations
ALTER TABLE organizations 
  DROP CONSTRAINT organizations_pkey,
  ALTER COLUMN id TYPE UUID USING temp_id,
  ADD PRIMARY KEY (id),
  DROP COLUMN temp_id;

-- 2. Users
ALTER TABLE users 
  DROP CONSTRAINT users_pkey,
  ALTER COLUMN id TYPE UUID USING temp_id,
  ALTER COLUMN organization_id TYPE UUID USING temp_organization_id,
  ADD PRIMARY KEY (id),
  DROP COLUMN temp_id,
  DROP COLUMN temp_organization_id;

-- 3. Domains
ALTER TABLE domains 
  DROP CONSTRAINT domains_pkey,
  ALTER COLUMN id TYPE UUID USING temp_id,
  ALTER COLUMN organization_id TYPE UUID USING temp_organization_id,
  ADD PRIMARY KEY (id),
  DROP COLUMN temp_id,
  DROP COLUMN temp_organization_id;

-- 4. DNS Records
ALTER TABLE dns_records 
  DROP CONSTRAINT dns_records_pkey,
  ALTER COLUMN id TYPE UUID USING temp_id,
  ALTER COLUMN domain_id TYPE UUID USING temp_domain_id,
  ADD PRIMARY KEY (id),
  DROP COLUMN temp_id,
  DROP COLUMN temp_domain_id;

-- 5. Providers
ALTER TABLE providers 
  DROP CONSTRAINT providers_pkey,
  ALTER COLUMN id TYPE UUID USING temp_id,
  ADD PRIMARY KEY (id),
  DROP COLUMN temp_id;

-- 6. API Tokens
ALTER TABLE api_tokens 
  DROP CONSTRAINT api_tokens_pkey,
  ALTER COLUMN id TYPE UUID USING temp_id,
  ALTER COLUMN organization_id TYPE UUID USING temp_organization_id,
  ADD PRIMARY KEY (id),
  DROP COLUMN temp_id,
  DROP COLUMN temp_organization_id;

-- 7. DNS History
ALTER TABLE dns_history 
  DROP CONSTRAINT dns_history_pkey,
  ALTER COLUMN id TYPE UUID USING temp_id,
  ALTER COLUMN record_id TYPE UUID USING temp_record_id,
  ALTER COLUMN user_id TYPE UUID USING temp_user_id,
  ADD PRIMARY KEY (id),
  DROP COLUMN temp_id,
  DROP COLUMN temp_record_id,
  DROP COLUMN temp_user_id;

-- 8. DNS Metrics
ALTER TABLE dns_metrics 
  DROP CONSTRAINT dns_metrics_pkey,
  ALTER COLUMN id TYPE UUID USING temp_id,
  ALTER COLUMN domain_id TYPE UUID USING temp_domain_id,
  ALTER COLUMN record_id TYPE UUID USING temp_record_id,
  ADD PRIMARY KEY (id),
  DROP COLUMN temp_id,
  DROP COLUMN temp_domain_id,
  DROP COLUMN temp_record_id;

-- Now recreate the foreign key constraints
ALTER TABLE users 
  ADD CONSTRAINT users_organization_id_fkey 
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE domains 
  ADD CONSTRAINT domains_organization_id_fkey 
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE dns_records 
  ADD CONSTRAINT dns_records_domain_id_fkey 
  FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE;

ALTER TABLE api_tokens 
  ADD CONSTRAINT api_tokens_organization_id_fkey 
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE dns_history 
  ADD CONSTRAINT dns_history_record_id_fkey 
  FOREIGN KEY (record_id) REFERENCES dns_records(id) ON DELETE CASCADE,
  ADD CONSTRAINT dns_history_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE dns_metrics 
  ADD CONSTRAINT dns_metrics_domain_id_fkey 
  FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE,
  ADD CONSTRAINT dns_metrics_record_id_fkey 
  FOREIGN KEY (record_id) REFERENCES dns_records(id) ON DELETE CASCADE;

-- Drop the conversion function when we're done
DROP FUNCTION convert_id_to_uuid;

-- Create the webhook tables
CREATE TABLE IF NOT EXISTS "custom_roles" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL UNIQUE,
  "description" TEXT,
  "permissions" TEXT[] NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "created_by" UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "webhooks" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "organization_id" UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  "secret" TEXT,
  "events" TEXT[] NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "last_triggered" TIMESTAMP,
  "created_by" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "webhook_delivery_logs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "webhook_id" UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  "payload" JSONB NOT NULL,
  "response" TEXT,
  "status_code" INTEGER,
  "status" BOOLEAN NOT NULL,
  "error" TEXT,
  "timestamp" TIMESTAMP NOT NULL DEFAULT now(),
  "duration_ms" INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "groups" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_by" UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "group_memberships" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "group_id" UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  "entity_type" TEXT NOT NULL, -- 'user', 'organization', 'group'
  "entity_id" UUID NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "conditions" JSONB
);