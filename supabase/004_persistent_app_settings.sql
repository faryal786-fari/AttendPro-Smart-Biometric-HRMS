-- AttendPro migration 004: persistent shared application settings.
-- Run after 001, 002 and 003 in Supabase SQL Editor.
-- Only the trusted FastAPI service-role backend can read/write this table.
CREATE TABLE IF NOT EXISTS public.attendpro_app_settings (
    key text PRIMARY KEY,
    value jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.attendpro_app_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.attendpro_app_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.attendpro_app_settings TO service_role;

COMMENT ON TABLE public.attendpro_app_settings IS
'Private AttendPro application configuration. Access only through authorized FastAPI service-role endpoints.';
