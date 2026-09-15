-- 002_services_within_radius.sql
-- Radius search RPC for the Service Finder app.
-- Returns approved services within `radius_meters` of the given point,
-- ordered by distance (closest first).
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
returns setof public.services
language sql
stable
as $$
  select s.*
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