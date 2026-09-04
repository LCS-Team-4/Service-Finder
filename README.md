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
└── docs/                   # Planning docs, roadblock notes, diagrams
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

See `docs/roadblock-notes.md` for the full plan.

## API import flow

API imports should use this sequence:

1. Send the external request through its client in `backend/src/api`, using `request()` with a named rate limiter.
2. Map the response into the database row shape.
3. Send rows through `upsertToSupabase()`, which splits them into batches and waits between Supabase calls.

Do not call `fetch()` directly for imports or send all mapped rows in one upsert. Add a separate limiter with `setRateLimit()` when introducing another external API.

The service import can be tested with `POST /api/admin/import/services` and the `x-admin-import-token` header matching `ADMIN_IMPORT_TOKEN`. Automatic imports are disabled unless `IMPORT_INTERVAL_MS` is set to a positive value. Both callers use the same import lock, Geoapify limiter, and Supabase batch limiter.

## Getting Started
1. `cd frontend && npm install`
2. `cd backend && npm install`
3. Copy `.env.example` to `.env` in both folders and fill in keys (Firebase, Maps API).
4. Run backend: `npm run dev` (from `backend/` — runs TypeScript directly via ts-node/nodemon)
5. Run frontend: `npm run dev` (from `frontend/`)
6. To build the backend for production: `npm run build` (from `backend/`), then `npm start`
