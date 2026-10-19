-- Migration: 001_people_conversations.sql
-- Description: Creates the people and conversations tables with strict account ownership,
--              composite foreign key guards, validation checks, and row-level security.

-- Helper: auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. Table: people
CREATE TABLE IF NOT EXISTS public.people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  relation text NOT NULL,
  photo_path text,
  face_descriptor real[] NULL,
  descriptor_model text NULL,
  recognition_status text NOT NULL DEFAULT 'unprocessed',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Composite candidate key enabling composite FK protection from child tables
  CONSTRAINT uq_people_id_owner UNIQUE (id, owner_id),

  -- Field constraints
  CONSTRAINT ck_people_name_length CHECK (char_length(trim(name)) > 0 AND char_length(name) <= 120),
  CONSTRAINT ck_people_relation_length CHECK (char_length(trim(relation)) > 0 AND char_length(relation) <= 80),
  CONSTRAINT ck_people_recognition_status CHECK (
    recognition_status IN ('unprocessed', 'ready', 'failed', 'no_face', 'multiple_faces', 'unverified')
  ),

  -- Descriptor consistency: if descriptor is present, model and 128 elements are required
  CONSTRAINT ck_people_descriptor_consistency CHECK (
    (face_descriptor IS NULL AND descriptor_model IS NULL) OR
    (face_descriptor IS NOT NULL AND descriptor_model IS NOT NULL AND array_length(face_descriptor, 1) = 128)
  )
);

-- Trigger for people.updated_at
DROP TRIGGER IF EXISTS trg_people_updated_at ON public.people;
CREATE TRIGGER trg_people_updated_at
BEFORE UPDATE ON public.people
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Index for ordering people
CREATE INDEX IF NOT EXISTS idx_people_owner_created_at 
ON public.people (owner_id, created_at DESC);

-- Row-Level Security for people
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;

CREATE POLICY "people_select_owner" 
ON public.people 
FOR SELECT 
USING (auth.uid() = owner_id);

CREATE POLICY "people_insert_owner" 
ON public.people 
FOR INSERT 
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "people_update_owner" 
ON public.people 
FOR UPDATE 
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "people_delete_owner" 
ON public.people 
FOR DELETE 
USING (auth.uid() = owner_id);


-- 2. Table: conversations
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id uuid NOT NULL,
  raw_text text NOT NULL,
  summary text NOT NULL,
  summary_source text NOT NULL DEFAULT 'ai',
  date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Composite FK enforcing that conversation owner matches person owner exactly
  CONSTRAINT fk_conversations_person_owner 
    FOREIGN KEY (person_id, owner_id) 
    REFERENCES public.people(id, owner_id) 
    ON DELETE CASCADE,

  -- Field constraints
  CONSTRAINT ck_conversations_raw_text_length CHECK (char_length(trim(raw_text)) > 0 AND char_length(raw_text) <= 10000),
  CONSTRAINT ck_conversations_summary_length CHECK (char_length(summary) <= 300),
  CONSTRAINT ck_conversations_summary_source CHECK (summary_source IN ('ai', 'manual', 'fallback'))
);

-- Index for newest conversation queries
CREATE INDEX IF NOT EXISTS idx_conversations_owner_person_ordering 
ON public.conversations (owner_id, person_id, date DESC, created_at DESC, id DESC);

-- Row-Level Security for conversations
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversations_select_owner" 
ON public.conversations 
FOR SELECT 
USING (auth.uid() = owner_id);

CREATE POLICY "conversations_insert_owner" 
ON public.conversations 
FOR INSERT 
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "conversations_update_owner" 
ON public.conversations 
FOR UPDATE 
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "conversations_delete_owner" 
ON public.conversations 
FOR DELETE 
USING (auth.uid() = owner_id);
