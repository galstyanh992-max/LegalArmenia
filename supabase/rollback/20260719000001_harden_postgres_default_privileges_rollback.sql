BEGIN;

-- FAIL_CLOSED_FUTURE_OBJECT_CONTAINMENT
-- Preserve PUBLIC/anon/authenticated revocations.
-- Additionally revoke service_role defaults for future postgres-created public objects.

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL PRIVILEGES ON TABLES FROM service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL PRIVILEGES ON SEQUENCES FROM service_role;

COMMIT;
