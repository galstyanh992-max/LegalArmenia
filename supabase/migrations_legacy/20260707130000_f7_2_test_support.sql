-- =============================================================================
-- F7.2 TEST SUPPORT (staging only) — provisioning/teardown RPCs for the harness.
-- Needed because app.cases is not writable through the public compat views and
-- the `app` schema is not exposed to PostgREST, so f7_2_policy_test.mjs (which
-- uses supabase-js only) cannot create a disposable case directly.
--
-- SECURITY: SECURITY DEFINER but EXECUTE granted ONLY to service_role. Not
-- callable by anon/authenticated. Do NOT deploy to production if you don't run
-- the harness there.
-- =============================================================================

-- Create a disposable case, set persona roles, attach uploader+member as members.
CREATE OR REPLACE FUNCTION public.f7_test_provision(
  p_admin uuid, p_lawyer uuid, p_uploader uuid, p_member uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = app, public, auth
AS $$
DECLARE v_case uuid;
BEGIN
  -- profiles are auto-created by the on_auth_user_created trigger; just set roles
  UPDATE app.user_profiles SET app_role='admin',  is_active=true WHERE user_id=p_admin;
  UPDATE app.user_profiles SET app_role='lawyer', is_active=true WHERE user_id=p_lawyer;
  UPDATE app.user_profiles SET app_role='client', is_active=true WHERE user_id IN (p_uploader, p_member);

  INSERT INTO app.cases(title, status, created_by, lawyer_id)
  VALUES ('F7.2 disposable test case', 'open', p_lawyer, p_lawyer)
  RETURNING case_id INTO v_case;

  -- uploader + generic member + lawyer are all attached as case members
  -- (lawyer is also authorized via app.cases.lawyer_id; membership added per spec)
  INSERT INTO app.case_members(case_id, user_id, case_role)
  VALUES (v_case, p_uploader, 'client'),
         (v_case, p_member,   'client'),
         (v_case, p_lawyer,   'lawyer');

  RETURN v_case;
END $$;

REVOKE ALL ON FUNCTION public.f7_test_provision(uuid,uuid,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.f7_test_provision(uuid,uuid,uuid,uuid) TO service_role;

-- Remove a disposable case and all its files/members.
CREATE OR REPLACE FUNCTION public.f7_test_teardown(p_case uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = app, public, auth
AS $$
BEGIN
  DELETE FROM app.client_documents WHERE case_id = p_case;
  DELETE FROM app.case_members     WHERE case_id = p_case;
  DELETE FROM app.cases            WHERE case_id = p_case;
END $$;

REVOKE ALL ON FUNCTION public.f7_test_teardown(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.f7_test_teardown(uuid) TO service_role;
