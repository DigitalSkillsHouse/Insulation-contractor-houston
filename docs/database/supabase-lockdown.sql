-- Insulation Contractor Houston — Supabase lockdown
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run. Does NOT delete lead data.

-- 1) Enable RLS (if somehow off)
ALTER TABLE IF EXISTS public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.site_settings ENABLE ROW LEVEL SECURITY;

-- 2) Drop open/anonymous insert/update/delete policies on leads
--    (names vary by project — drop known patterns, then recreate locked policies)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'leads'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.leads', pol.policyname);
  END LOOP;
END $$;

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'site_settings'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.site_settings', pol.policyname);
  END LOOP;
END $$;

-- 3) No policies for anon/authenticated on leads =
--    only the service role (used by /api/submit-lead and /api/admin) can read/write.
--    Optional: allow public read of non-sensitive site settings only.
CREATE POLICY "Public can read site settings"
  ON public.site_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- 4) Optional: remove the audit probe row if it still exists
DELETE FROM public.leads WHERE lead_id = 'PROBE-TEST';

-- After running:
-- Authentication → Providers → Email → disable "Enable sign ups"
-- (or Authentication → Settings → disable public sign-ups)
--
-- Verify: with the publishable key only, POST to /rest/v1/leads should fail (401/403).
