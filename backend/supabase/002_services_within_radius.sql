-- 002_services_within_radius.sql
-- Radius search RPC for the Service Finder app.
-- Returns approved services within `radius_meters` of the given point,
-- ordered by distance (closest first).
--
-- The return table matches the public.services columns plus `lat` and `lng`,
-- which are derived from the geography `location` column so the frontend
-- doesn't have to parse WKB.
--
-- Assumes:
--   - public.services.location is geography(Point, 4326)
--   - public.services.status exists with 'approved' as the default
--   - a GiST index on location (services_location_idx) exists
--
-- Called by: backend/src/models/Service.ts -> fetchServicesInRadius

create or replace function public.services_within_radius(
  center_lat double precision,
  center_lng double precision,
  radius_meters double precision,
  result_limit int default 100
)
returns table (
  id uuid,
  external_id text,
  name text,
  category_id uuid,
  type text,
  formatted_address text,
  location geography,
  opening_hours text,
  phone text,
  website text,
  wheelchair text,
  sourcename text,
  status text,
  submitted_by uuid,
  reviewed_by uuid,
  review_note text,
  imported_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  lat double precision,
  lng double precision
)
language sql
stable
as $$
  select s.id,
         s.external_id,
         s.name,
         s.category_id,
         s.type,
         s.formatted_address,
         s.location,
         s.opening_hours,
         s.phone,
         s.website,
         s.wheelchair,
         s.sourcename,
         s.status,
         s.submitted_by,
         s.reviewed_by,
         s.review_note,
         s.imported_at,
         s.created_at,
         s.updated_at,
         st_y(s.location::geometry) as lat,
         st_x(s.location::geometry) as lng
  from public.services s
  where s.location is not null
    and s.status = 'approved'
    and st_dwithin(
      s.location,
      st_setsrid(st_makepoint(center_lng, center_lat), 4326)::geography,
      radius_meters
    )
  order by st_distance(
    s.location,
    st_setsrid(st_makepoint(center_lng, center_lat), 4326)::geography
  )
  limit result_limit;
$$;