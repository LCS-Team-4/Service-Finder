-- =============================================================================
-- Service Finder – Full Database Schema (Supabase / PostgreSQL + PostGIS)
-- Run this in the Supabase SQL Editor (or psql) before any seed data.
-- =============================================================================

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 2. Service Categories (hierarchical)
CREATE TABLE IF NOT EXISTS public.service_categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,

parent_id   UUID CONSTRAINT service_categories_parent_id_fkey REFERENCES public.service_categories(id) ON DELETE SET NULL,,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS service_categories_parent_id_idx
  ON public.service_categories(parent_id);
CREATE INDEX IF NOT EXISTS service_categories_slug_idx
  ON public.service_categories(slug);

-- 3. Services (core table – places of interest)
CREATE TABLE IF NOT EXISTS public.services (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id        TEXT UNIQUE,                          -- Geoapify place_id or custom
  name               TEXT NOT NULL,
  type               TEXT,                                 -- human-readable category name
  category_id        UUID REFERENCES public.service_categories(id) ON DELETE SET NULL,
  formatted_address  TEXT,
  location           GEOGRAPHY(POINT, 4326),               -- PostGIS geography for distance queries
  opening_hours      TEXT,
  website            TEXT,
  phone              TEXT,
  wheelchair         TEXT,                                 -- yes / no / limited / unknown
  sourcename         TEXT DEFAULT 'manual',
  status             TEXT NOT NULL DEFAULT 'approved'
                       CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_by       UUID,                                 -- auth.users id
  reviewed_by        UUID,
  review_note        TEXT,
  imported_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS services_category_id_idx ON public.services(category_id);
CREATE INDEX IF NOT EXISTS services_external_id_idx ON public.services(external_id);
CREATE INDEX IF NOT EXISTS services_status_idx ON public.services(status);
CREATE INDEX IF NOT EXISTS services_location_gix ON public.services USING GIST (location);
CREATE INDEX IF NOT EXISTS services_name_trgm_idx ON public.services USING gin (name gin_trgm_ops);
-- (enable pg_trgm if you want fuzzy search: CREATE EXTENSION IF NOT EXISTS pg_trgm;)

-- Keep updated_at current
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS services_set_updated_at ON public.services;
CREATE TRIGGER services_set_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Profiles (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name    TEXT,
  last_name     TEXT,
  employee_id   TEXT,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  email         TEXT,
  password      TEXT,                    -- unused when using Supabase Auth (kept for compatibility)
  phone_number  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles(role);
CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles(email);

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Traffic Incidents (live snapshot from TomTom)
CREATE TABLE IF NOT EXISTS public.traffic_incidents (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id          TEXT,
  icon_category        INTEGER,
  magnitude_of_delay   INTEGER,
  from_road            TEXT,
  to_road              TEXT,
  length_m             NUMERIC,
  delay_seconds        INTEGER,
  road_numbers         TEXT[],
  description          TEXT,
  geometry             GEOGRAPHY(LINESTRING, 4326),
  imported_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS traffic_incidents_geometry_gix
  ON public.traffic_incidents USING GIST (geometry);
CREATE INDEX IF NOT EXISTS traffic_incidents_imported_at_idx
  ON public.traffic_incidents(imported_at DESC);

-- 6. RPC: services within radius (used by backend models)
CREATE OR REPLACE FUNCTION public.services_within_radius(
  center_lat     DOUBLE PRECISION,
  center_lng     DOUBLE PRECISION,
  radius_meters  DOUBLE PRECISION DEFAULT 5000,
  result_limit   INTEGER DEFAULT 50
)
RETURNS SETOF public.services
LANGUAGE sql
STABLE
AS $$
  SELECT s.*
  FROM public.services s
  WHERE s.status = 'approved'
    AND s.location IS NOT NULL
    AND ST_DWithin(
      s.location,
      ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
      radius_meters
    )
  ORDER BY s.location <-> ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography
  LIMIT result_limit;
$$;

-- 7. Helper view (optional – convenient for frontend)
CREATE OR REPLACE VIEW public.services_with_category AS
SELECT
  s.*,
  c.name  AS category_name,
  c.slug  AS category_slug,
  c.parent_id AS category_parent_id,
  ST_Y(s.location::geometry) AS latitude,
  ST_X(s.location::geometry) AS longitude
FROM public.services s
LEFT JOIN public.service_categories c ON c.id = s.category_id;

-- 8. Basic RLS (Row Level Security) – adjust to your needs
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.traffic_incidents ENABLE ROW LEVEL SECURITY;

-- Public read for approved services & categories & traffic
CREATE POLICY "Public read approved services"
  ON public.services FOR SELECT
  USING (status = 'approved');

CREATE POLICY "Public read categories"
  ON public.service_categories FOR SELECT
  USING (true);

CREATE POLICY "Public read traffic"
  ON public.traffic_incidents FOR SELECT
  USING (true);

-- Authenticated users can insert pending services (suggestions)
CREATE POLICY "Users can suggest services"
  ON public.services FOR INSERT
  TO authenticated
  WITH CHECK (status = 'pending' AND submitted_by = auth.uid());

-- Users can read/update their own profile
CREATE POLICY "Users read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

-- Service-role (backend) bypasses RLS automatically when using the service key.

COMMENT ON TABLE public.services IS 'Public service locations (hospitals, police, clinics, etc.)';
COMMENT ON TABLE public.service_categories IS 'Hierarchical categories for services';
COMMENT ON TABLE public.traffic_incidents IS 'Live traffic incidents snapshot (TomTom)';
COMMENT ON FUNCTION public.services_within_radius IS 'Returns approved services ordered by distance from a point';
