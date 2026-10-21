# Service Finder – Database Setup (Supabase)

## Order of execution

1. **000_full_schema.sql** – Creates extensions (uuid-ossp, postgis), tables, indexes, triggers, the `services_within_radius` RPC, view, and basic RLS policies.
2. **001_service_categories.sql** – (legacy) Adds `category_id` column if you already had a services table. Safe to skip if you run 000.
3. **002_seed_data.sql** – Inserts all categories + ~60 realistic South African public-service locations (hospitals, clinics, police, fire, pharmacies, libraries, Home Affairs, shelters, schools, dentists) across Johannesburg, Pretoria, Cape Town, Durban, Bloemfontein, Gqeberha, East London, Polokwane, Mbombela and Kimberley, plus a few sample traffic incidents.

## How to apply

### Option A – Supabase Dashboard
1. Open your project → SQL Editor
2. Paste and run `000_full_schema.sql`
3. Paste and run `002_seed_data.sql`

### Option B – psql / CLI
```bash
psql "$DATABASE_URL" -f backend/supabase/000_full_schema.sql
psql "$DATABASE_URL" -f backend/supabase/002_seed_data.sql
```

## Required extensions
- `uuid-ossp`
- `postgis` (for geography columns and distance queries)

These are usually available on Supabase by default; the schema enables them with `CREATE EXTENSION IF NOT EXISTS`.

## Tables created
| Table                 | Purpose                                      |
|-----------------------|----------------------------------------------|
| service_categories    | Hierarchical categories (Emergency, Healthcare, …) |
| services              | All public-service locations (PostGIS POINT) |
| profiles              | User profiles linked to auth.users           |
| traffic_incidents     | Live traffic snapshot (PostGIS LINESTRING)   |

## Useful queries after seeding
```sql
-- Count by category
SELECT c.name, COUNT(s.id)
FROM service_categories c
LEFT JOIN services s ON s.category_id = c.id
GROUP BY c.name ORDER BY 2 DESC;

-- Services near Cape Town CBD (5 km)
SELECT * FROM services_within_radius(-33.9249, 18.4241, 5000, 20);

-- All hospitals
SELECT name, formatted_address, phone
FROM services
WHERE type = 'Hospital' AND status = 'approved';
```

## Notes
- Coordinates are approximate but realistic for the named facilities.
- `external_id` values start with `seed-` so they never collide with real Geoapify place_ids.
- Status is set to `approved` so the public API returns them immediately.
- The backend service-role key bypasses RLS; the policies protect the anon/authenticated roles.
