-- Migration: 003_import_onboarding.sql
-- Description: Creates the onboarding_progress and legacy_imports tables
--              with composite primary/unique keys, status constraints, and RLS.

-- 1. Table: onboarding_progress
CREATE TABLE IF NOT EXISTS public.onboarding_progress (
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tour_id text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  step_id text NOT NULL,
  status text NOT NULL DEFAULT 'in_progress',
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Composite primary key
  CONSTRAINT pk_onboarding_progress PRIMARY KEY (owner_id, tour_id),

  -- Status check constraint
  CONSTRAINT ck_onboarding_status CHECK (status IN ('in_progress', 'completed', 'skipped')),
  CONSTRAINT ck_onboarding_version CHECK (version >= 1)
);

-- Trigger for onboarding_progress.updated_at
DROP TRIGGER IF EXISTS trg_onboarding_updated_at ON public.onboarding_progress;
CREATE TRIGGER trg_onboarding_updated_at
BEFORE UPDATE ON public.onboarding_progress
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Row-Level Security for onboarding_progress
ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "onboarding_select_owner"
ON public.onboarding_progress
FOR SELECT
USING (auth.uid() = owner_id);

CREATE POLICY "onboarding_insert_owner"
ON public.onboarding_progress
FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "onboarding_update_owner"
ON public.onboarding_progress
FOR UPDATE
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "onboarding_delete_owner"
ON public.onboarding_progress
FOR DELETE
USING (auth.uid() = owner_id);


-- 2. Table: legacy_imports
CREATE TABLE IF NOT EXISTS public.legacy_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id text NOT NULL,
  entity_type text NOT NULL,
  legacy_id text NOT NULL,
  server_id uuid NOT NULL,
  payload_hash text NOT NULL,
  import_status text NOT NULL DEFAULT 'completed',
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Composite unique key to guarantee idempotent imports per client device/store
  CONSTRAINT uq_legacy_imports_mapping UNIQUE (owner_id, source_id, entity_type, legacy_id),

  -- Validation checks
  CONSTRAINT ck_legacy_imports_entity_type CHECK (entity_type IN ('person', 'conversation')),
  CONSTRAINT ck_legacy_imports_status CHECK (import_status IN ('completed', 'failed', 'conflict'))
);

-- Index for fast deduplication lookup during legacy import
CREATE INDEX IF NOT EXISTS idx_legacy_imports_lookup 
ON public.legacy_imports (owner_id, source_id, entity_type, legacy_id);

-- Row-Level Security for legacy_imports
ALTER TABLE public.legacy_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "legacy_imports_select_owner"
ON public.legacy_imports
FOR SELECT
USING (auth.uid() = owner_id);

CREATE POLICY "legacy_imports_insert_owner"
ON public.legacy_imports
FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "legacy_imports_update_owner"
ON public.legacy_imports
FOR UPDATE
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "legacy_imports_delete_owner"
ON public.legacy_imports
FOR DELETE
USING (auth.uid() = owner_id);
