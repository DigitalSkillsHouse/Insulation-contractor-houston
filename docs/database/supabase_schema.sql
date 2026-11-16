-- ========================================================
-- Insulation Contractor Houston - Supabase Database Setup Schema
-- Copy and paste this script into your Supabase Dashboard:
-- Supabase Project -> SQL Editor -> New Query -> Run
-- Safe to run more than once. Use it on a brand new project or on the existing one.
--
-- Moving to a new Supabase account:
--   1. Create the project, then run this whole script.
--   2. Authentication -> Users -> Add user: create the admin login (email and password).
--   3. Vercel -> Project Settings -> Environment Variables: set SUPABASE_SERVICE_KEY to the new project's
--      secret key (Supabase -> Project Settings -> API Keys, the sb_secret_... value). Delete any old
--      SUPABASE_URL variable, because the code already points at the new project. Then redeploy.
--      Never paste the secret key into chat, code or a public place.
-- ========================================================

-- 1. Create leads table
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    zip VARCHAR(20),
    city VARCHAR(100) DEFAULT '',
    service VARCHAR(100) DEFAULT 'Attic Insulation',
    type VARCHAR(50) DEFAULT 'Form Submission',
    status VARCHAR(50) DEFAULT 'new',
    notes TEXT,
    value NUMERIC DEFAULT 0,
    page_url TEXT,
    location_data JSONB,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bring a pre-existing table up to date
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS value NUMERIC DEFAULT 0;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS location_data JSONB;
ALTER TABLE public.leads ALTER COLUMN city SET DEFAULT '';

-- Optional cleanup of placeholder text that older versions of the site saved.
-- Remove the two leading dashes on the next two lines to run it.
-- UPDATE public.leads SET city = '' WHERE city = 'Spring Area, TX' AND location_data IS NULL;
-- UPDATE public.leads SET zip = '' WHERE zip = 'Spring Area';


-- 2. Create site_settings table
CREATE TABLE IF NOT EXISTS public.site_settings (
    id INT PRIMARY KEY DEFAULT 1,
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    hours VARCHAR(255),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- 4. Drop legacy permissive RLS Policies
DROP POLICY IF EXISTS "Allow public select on leads" ON public.leads;
DROP POLICY IF EXISTS "Allow public insert on leads" ON public.leads;
DROP POLICY IF EXISTS "Allow public update on leads" ON public.leads;
DROP POLICY IF EXISTS "Allow public delete on leads" ON public.leads;

DROP POLICY IF EXISTS "Allow public select on site_settings" ON public.site_settings;
DROP POLICY IF EXISTS "Allow public insert on site_settings" ON public.site_settings;
DROP POLICY IF EXISTS "Allow public update on site_settings" ON public.site_settings;

-- Clean up any existing role-specific policies to allow clean re-runs
DROP POLICY IF EXISTS "Allow anon and authenticated insert on leads" ON public.leads;
DROP POLICY IF EXISTS "Allow authenticated select on leads" ON public.leads;
DROP POLICY IF EXISTS "Allow authenticated update on leads" ON public.leads;
DROP POLICY IF EXISTS "Allow authenticated delete on leads" ON public.leads;

DROP POLICY IF EXISTS "Allow public read on site_settings" ON public.site_settings;
DROP POLICY IF EXISTS "Allow authenticated insert on site_settings" ON public.site_settings;
DROP POLICY IF EXISTS "Allow authenticated update on site_settings" ON public.site_settings;
DROP POLICY IF EXISTS "Allow authenticated delete on site_settings" ON public.site_settings;

-- ========================================================
-- 5. RLS Policies for LEADS Table
-- ========================================================

-- POLICY 1: Public Lead Submission
-- Allows unauthenticated website visitors (anon) and authenticated users to submit estimate requests.
CREATE POLICY "Allow anon and authenticated insert on leads"
ON public.leads
FOR INSERT
TO public
WITH CHECK (true);

-- POLICY 2: Admin Lead Viewing
-- Restricts viewing lead records strictly to authenticated admin users. Anonymous public cannot read leads.
CREATE POLICY "Allow authenticated select on leads"
ON public.leads
FOR SELECT
TO authenticated
USING (true);

-- POLICY 3: Admin Lead Status & Notes Updates
-- Restricts updating lead records (status, notes) strictly to authenticated admin users.
CREATE POLICY "Allow authenticated update on leads"
ON public.leads
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- POLICY 4: Admin Lead Deletion
-- Restricts deleting lead records strictly to authenticated admin users.
CREATE POLICY "Allow authenticated delete on leads"
ON public.leads
FOR DELETE
TO authenticated
USING (true);

-- ========================================================
-- 6. RLS Policies for SITE_SETTINGS Table
-- ========================================================

-- POLICY 1: Public Settings Read
-- Allows anyone (public website visitors) to read phone number, email, address, and operating hours.
CREATE POLICY "Allow public read on site_settings"
ON public.site_settings
FOR SELECT
TO public
USING (true);

-- POLICY 2: Admin Settings Insert
-- Restricts creating site settings records strictly to authenticated admin users.
CREATE POLICY "Allow authenticated insert on site_settings"
ON public.site_settings
FOR INSERT
TO authenticated
WITH CHECK (true);

-- POLICY 3: Admin Settings Update
-- Restricts modifying site settings strictly to authenticated admin users.
CREATE POLICY "Allow authenticated update on site_settings"
ON public.site_settings
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- POLICY 4: Admin Settings Delete
-- Restricts deleting site settings strictly to authenticated admin users.
CREATE POLICY "Allow authenticated delete on site_settings"
ON public.site_settings
FOR DELETE
TO authenticated
USING (true);

-- 7. Insert initial default settings row
INSERT INTO public.site_settings (id, phone, email, address, hours)
VALUES (
    1,
    '(832) 291-2738',
    'info@insulationcontractorhouston.com',
    'Central Park Vista Ln, Houston, TX 77080',
    'Mon–Sat 8am–6pm'
)
ON CONFLICT (id) DO NOTHING;

-- If the settings row already exists with the old address, bring it up to date
UPDATE public.site_settings
SET address = 'Central Park Vista Ln, Houston, TX 77080', hours = 'Mon–Sat 8am–6pm'
WHERE id = 1 AND address LIKE 'Cypress Farms%';
