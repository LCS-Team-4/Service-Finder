# Service Finder

Web app to help users locate nearby public services (clinics, libraries, shelters, etc.) on an interactive map. Phase 2 adds login and user-submitted service suggestions.

## Structure

```
service-finder/
├── frontend/            # React + TypeScript (Vite)
│   ├── public/
│   └── src/
│       ├── components/  # Reusable UI pieces, grouped by feature
│       ├── pages/        # Route-level views (Home, Login, Dashboard, Admin)
│       ├── hooks/        # Custom hooks (useServices, useAuth)
│       ├── context/      # React context (AuthContext, etc.)
│       ├── services/     # API-calling layer (axios instances, endpoint wrappers)
│       ├── types/        # Shared TypeScript types/interfaces
│       ├── utils/        # Helpers, formatters, constants
│       └── styles/       # Global/shared CSS
├── backend/               # Node/Express API (TypeScript)
│   └── src/
│       ├── config/         # Env/config, Firebase admin init
│       ├── controllers/    # Request handlers
│       ├── routes/         # Express route definitions
│       ├── models/         # Data models (or JSON schema if using mock DB)
│       ├── middleware/     # Auth checks, error handling, rate limiting
│       ├── services/       # Business logic, incl. Maps API wrapper + caching
│       ├── types/          # Shared TypeScript types/interfaces
│       ├── utils/           # Helpers
│       └── data/            # Mock DB (JSON file) if not using Firestore
└── docs/                   # Planning docs, roadblock notes, diagrams (see api-integration-guide.md)
```

## Tech Stack
- Frontend: React + TypeScript (Vite), Axios, Maps API
- Backend: Node.js + Express + TypeScript, Firebase Authentication, mock DB (Firestore or JSON)
- Tooling: Git, Postman

## Handling the Maps API rate-limit roadblock
Free-tier Maps APIs cap daily requests and can throttle or go down. This structure bakes in a defense from day one:
- `backend/src/services/mapsService.ts` — all Maps API calls go through here, never called directly from routes/controllers.
- Response caching (in-memory or simple file cache) to cut duplicate lookups.
- Graceful fallback data + friendly error states in `frontend/src/components/Map` when the API is unavailable or limited.
- Request counting/logging so the team can see usage trending toward the daily cap.

See `docs/api-integration-guide.md` for the full plan, including the diagram of every API call and its trigger.

## API import flow

API imports should use this sequence:

1. Send the external request through its client in `backend/src/api`, using `request()` with a named rate limiter.
2. Map the response into the database row shape.
3. Send rows through `upsertToSupabase()`, which splits them into batches and waits between Supabase calls.

Do not call `fetch()` directly for imports or send all mapped rows in one upsert. Add a separate limiter with `setRateLimit()` when introducing another external API.

The service import can be tested with `POST /api/admin/import/services` and the `x-admin-import-token` header matching `ADMIN_IMPORT_TOKEN`. Automatic imports are disabled unless `IMPORT_INTERVAL_MS` is set to a positive value. Both callers use the same import lock, Geoapify limiter, and Supabase batch limiter.

Traffic incidents use a separate admin endpoint, `POST /api/admin/import/accidents`, and a separate interval (`TRAFFIC_IMPORT_INTERVAL_MS`, currently 30 minutes). Because incidents are a live snapshot, a run replaces the whole table (`replaceInSupabase`) instead of upserting. Setting `TRAFFIC_IMPORT_INTERVAL_MS` also triggers one import at boot. See `docs/api-integration-guide.md` for the full picture of which API is called where, how, and when.

## Getting Started
1. Install dependencies with `npm install` in both `backend/` and `frontend/`.
2. Configure `backend/.env` with `PORT` (defaults to `5000`), `SUPABASE_URL` (your Supabase project URL, such as `https://<project-ref>.supabase.co`), and `SUPABASE_SERVICE_KEY` (the server-side service-role key from the Supabase project API settings). Do not put the service-role key in the frontend. Add external API keys only for features you use.
3. Apply the Supabase schema and seed SQL described above.
4. Run the backend with `npm run dev` from `backend/`.
5. Run the frontend with `npm run dev` from `frontend/`. It proxies `/api` requests to `http://localhost:5000`, so the browser uses the same origin for auth and database-backed service requests.
6. To use a different backend host for the Vite dev proxy, set `BACKEND_URL` in `frontend/.env`. To bypass the proxy (for example, when deploying the frontend separately), set `VITE_API_BASE_URL` to the backend origin or its `/api` URL.
7. To build the backend for production: run `npm run build` from `backend/`, then `npm start`.

If the API reports a non-JSON response, first check the backend terminal: missing Supabase configuration prevents the backend from starting. If it reports `EADDRINUSE` on port 5000, stop the other backend process before restarting `npm run dev`.

## Database (Supabase / PostgreSQL + PostGIS)

Full schema and seed data live in `backend/supabase/`:

| File | Purpose |
|------|---------|
| `000_full_schema.sql` | Extensions, tables (`services`, `service_categories`, `profiles`, `traffic_incidents`), indexes, triggers, `services_within_radius` RPC, RLS policies |
| `001_service_categories.sql` | Legacy migration (safe to skip if using 000) |
| `002_seed_data.sql` | Categories + ~60 real-world South African public services (hospitals, clinics, police, fire stations, pharmacies, libraries, Home Affairs, shelters, schools, dentists) across major cities + sample traffic incidents |
| `README.md` | Detailed setup instructions |

**Apply in order:**
1. Run `000_full_schema.sql` in the Supabase SQL Editor
2. Run `002_seed_data.sql`

After seeding you can immediately query nearby services:
```sql
SELECT name, type, formatted_address, phone
FROM services_within_radius(-33.9249, 18.4241, 5000, 20);  -- Cape Town CBD, 5 km
```

See `backend/supabase/README.md` for more verification queries.
