-- ========================================================
-- USA Insulation - Supabase Database Setup Schema
-- Copy and paste this script into your Supabase Dashboard:
-- Supabase Project -> SQL Editor -> New Query -> Run
-- ========================================================

-- 1. Create leads table
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    zip VARCHAR(20),
    city VARCHAR(100) DEFAULT 'Spring Area, TX',
    service VARCHAR(100) DEFAULT 'Attic Insulation',
    type VARCHAR(50) DEFAULT 'Form Submission',
    status VARCHAR(50) DEFAULT 'new',
    notes TEXT,
    value NUMERIC DEFAULT 0,
    page_url TEXT,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure value column exists on pre-existing table instances
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS value NUMERIC DEFAULT 0;


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
    '+1 409-996-4620',
    'info@insulationcontractorhouston.com',
    '23407 Snook Ln Bldg 1, Tomball, TX 77375',
    'Open 24 hours · 7 days a week'
)
ON CONFLICT (id) DO NOTHING;
