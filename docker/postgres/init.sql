-- ===========================================
-- TIVIFY PostgreSQL Initialization
-- ===========================================
-- This script initializes the PostgreSQL database with proper security configurations

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- SECURITY: Create separate application user (not superuser)
-- Replace 'tivify_app_user' and 'secure_password' with your actual credentials
-- This user should be the one used in application connection strings
-- The POSTGRES_USER from environment variables is the initial superuser
-- DO NOT use superuser credentials in production application connections

-- SECURITY NOTE: Row-Level Security (RLS) should be enabled when database schema is finalized
-- Uncomment and implement RLS policies for sensitive data:
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE streams ENABLE ROW LEVEL SECURITY;
-- etc.

-- SECURITY: Restrict default public schema privileges
-- This prevents users from creating objects in public schema by default
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO PUBLIC;

-- SECURITY: Log all connections (PostgreSQL logs connection attempts)
-- Review logs regularly: docker logs tivify-postgres | grep "connection"

-- SECURITY: Consider enabling these settings in postgresql.conf (via -c flags in docker-entrypoint):
-- log_statement = 'all'        # Log all SQL statements (verbose, use for debugging)
-- log_min_duration_statement = 1000  # Log queries slower than 1 second
-- password_encryption = 'scram-sha-256'  # Use SCRAM-SHA-256 instead of MD5 (set in docker-entrypoint)
