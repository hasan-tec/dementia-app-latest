-- Test Script: ownership.sql
-- Purpose: Rigorous verification of Row-Level Security, cross-account isolation,
--          composite foreign key integrity, and cascade rules.
-- Usage: Run in Supabase SQL editor or psql. Wrapped in a transaction that rolls back automatically.

BEGIN;

DO $$
DECLARE
  v_user_a_id uuid := '11111111-1111-4111-8111-111111111111';
  v_user_b_id uuid := '22222222-2222-4222-8222-222222222222';
  v_person_a_id uuid;
  v_person_b_id uuid;
  v_conv_a_id uuid;
  v_count integer;
  v_error_caught boolean := false;
  v_dummy_descriptor real[];
BEGIN
  RAISE NOTICE '=== Starting Ownership & Security Validation ===';

  -- Create dummy 128-element descriptor for testing
  v_dummy_descriptor := array_fill(0.05::real, ARRAY[128]);

  -- 1. Setup Mock Users in auth.users if they don't exist
  INSERT INTO auth.users (id, aud, role, email)
  VALUES 
    (v_user_a_id, 'authenticated', 'authenticated', 'caregiver_a@example.com'),
    (v_user_b_id, 'authenticated', 'authenticated', 'caregiver_b@example.com')
  ON CONFLICT (id) DO NOTHING;

  -- -------------------------------------------------------------------------
  -- Scenario 1: User A Inserts Data
  -- -------------------------------------------------------------------------
  -- Impersonate User A
  EXECUTE format('SET LOCAL request.jwt.claim.sub = %L', v_user_a_id::text);
  EXECUTE 'SET LOCAL role = authenticated';

  INSERT INTO public.people (owner_id, name, relation, photo_path, face_descriptor, descriptor_model, recognition_status)
  VALUES (v_user_a_id, 'Grandma Rose', 'Grandmother', '11111111-1111-4111-8111-111111111111/person1/photo.jpg', v_dummy_descriptor, 'face-api-v1', 'ready')
  RETURNING id INTO v_person_a_id;

  INSERT INTO public.conversations (owner_id, person_id, raw_text, summary, summary_source)
  VALUES (v_user_a_id, v_person_a_id, 'Had tea and talked about gardening', 'Talked about gardening over tea.', 'ai')
  RETURNING id INTO v_conv_a_id;

  -- User A can see their own records
  SELECT count(*) INTO v_count FROM public.people WHERE id = v_person_a_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FAILED: User A cannot read their own person record';
  END IF;

  SELECT count(*) INTO v_count FROM public.conversations WHERE id = v_conv_a_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FAILED: User A cannot read their own conversation record';
  END IF;

  RAISE NOTICE 'Passed: User A data insertion and self-read';

  -- -------------------------------------------------------------------------
  -- Scenario 2: Cross-Account Read Protection (User B reads User A)
  -- -------------------------------------------------------------------------
  -- Impersonate User B
  EXECUTE format('SET LOCAL request.jwt.claim.sub = %L', v_user_b_id::text);
  EXECUTE 'SET LOCAL role = authenticated';

  SELECT count(*) INTO v_count FROM public.people WHERE id = v_person_a_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FAILED: RLS breach - User B can read User A person record!';
  END IF;

  SELECT count(*) INTO v_count FROM public.conversations WHERE id = v_conv_a_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FAILED: RLS breach - User B can read User A conversation record!';
  END IF;

  RAISE NOTICE 'Passed: User B cannot read User A data';

  -- -------------------------------------------------------------------------
  -- Scenario 3: Cross-Account Modification Protection (User B modifies User A)
  -- -------------------------------------------------------------------------
  UPDATE public.people SET name = 'Hacked Name' WHERE id = v_person_a_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'FAILED: RLS breach - User B updated User A person record!';
  END IF;

  DELETE FROM public.people WHERE id = v_person_a_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'FAILED: RLS breach - User B deleted User A person record!';
  END IF;

  RAISE NOTICE 'Passed: User B cannot update or delete User A data';

  -- -------------------------------------------------------------------------
  -- Scenario 4: Relational Cross-Link Guard (Composite FK)
  -- User B tries to insert a conversation referencing User A's person
  -- -------------------------------------------------------------------------
  v_error_caught := false;
  BEGIN
    INSERT INTO public.conversations (owner_id, person_id, raw_text, summary, summary_source)
    VALUES (v_user_b_id, v_person_a_id, 'Sneaky conversation', 'Sneaky summary', 'manual');
  EXCEPTION WHEN foreign_key_violation THEN
    v_error_caught := true;
  END;

  IF NOT v_error_caught THEN
    RAISE EXCEPTION 'FAILED: Composite FK failed - User B was able to link conversation to User A person!';
  END IF;

  RAISE NOTICE 'Passed: Composite FK prevented linking conversation across accounts';

  -- -------------------------------------------------------------------------
  -- Scenario 5: Anonymous User Protection
  -- -------------------------------------------------------------------------
  EXECUTE 'SET LOCAL role = anon';
  EXECUTE 'RESET request.jwt.claim.sub';

  SELECT count(*) INTO v_count FROM public.people;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FAILED: Anonymous user can view people records!';
  END IF;

  SELECT count(*) INTO v_count FROM public.conversations;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FAILED: Anonymous user can view conversation records!';
  END IF;

  RAISE NOTICE 'Passed: Anonymous users cannot read any records';

  -- -------------------------------------------------------------------------
  -- Scenario 6: Cascade Delete Verification
  -- -------------------------------------------------------------------------
  EXECUTE format('SET LOCAL request.jwt.claim.sub = %L', v_user_a_id::text);
  EXECUTE 'SET LOCAL role = authenticated';

  DELETE FROM public.people WHERE id = v_person_a_id;
  
  -- Verify conversation was deleted via cascade
  SELECT count(*) INTO v_count FROM public.conversations WHERE id = v_conv_a_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FAILED: Cascade delete did not remove conversations for deleted person!';
  END IF;

  RAISE NOTICE 'Passed: Deleting person cascaded cleanly to conversations';

  RAISE NOTICE '=== ALL SECURITY & OWNERSHIP TESTS PASSED SUCCESSFULLY ===';
END $$;

-- Rollback ensures this test leaves zero dirty records in the database
ROLLBACK;
