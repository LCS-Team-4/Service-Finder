import { NextFunction, Request, Response } from "express";
import { supabase } from "../config/supabase";
import { fetchServiceDetails } from "../models/Service";
import type { AuthRequest } from "../middleware/auth";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const SERVICE_STATUSES = ["pending", "approved", "rejected", "archived"] as const;
type ServiceStatus = (typeof SERVICE_STATUSES)[number];

const isServiceStatus = (value: unknown): value is ServiceStatus =>
  typeof value === "string" &&
  (SERVICE_STATUSES as readonly string[]).includes(value);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Text columns an admin may edit. Empty string -> NULL so fields can be cleared.
const NULLABLE_TEXT_FIELDS = [
  "type",
  "formatted_address",
  "opening_hours",
  "website",
  "phone",
  "wheelchair",
] as const;

type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };

function restUrl(path = "services"): URL {
  return new URL(`${process.env.SUPABASE_URL}/rest/v1/${path}`);
}

function restHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_KEY!;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

/**
 * Accepts every shape the frontend might reasonably send and returns the
 * PostGIS EWKT string Supabase expects: "SRID=4326;POINT(lng lat)".
 *   - null                                  -> clear the location
 *   - "SRID=4326;POINT(18.42 -33.92)"       -> validated + normalised
 *   - { lat, lng } / { latitude, longitude } -> converted
 */
function parseLocation(input: unknown): Parsed<string | null> {
  if (input === null) return { ok: true, value: null };

  let lat: number | undefined;
  let lng: number | undefined;

  if (typeof input === "string") {
    const match = input
      .trim()
      .match(
        /^(?:SRID=4326;)?POINT\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)$/i,
      );
    if (!match) {
      return {
        ok: false,
        message: 'location must look like "SRID=4326;POINT(lng lat)"',
      };
    }
    lng = Number(match[1]);
    lat = Number(match[2]);
  } else if (typeof input === "object") {
    const obj = input as Record<string, unknown>;
    lat = Number(obj.lat ?? obj.latitude);
    lng = Number(obj.lng ?? obj.longitude);
  } else {
    return { ok: false, message: "location has an unsupported format" };
  }

  if (lat === undefined || lng === undefined || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, message: "location needs numeric latitude and longitude" };
  }
  if (lat < -90 || lat > 90) {
    return { ok: false, message: "latitude must be between -90 and 90" };
  }
  if (lng < -180 || lng > 180) {
    return { ok: false, message: "longitude must be between -180 and 180" };
  }

  return { ok: true, value: `SRID=4326;POINT(${lng.toFixed(7)} ${lat.toFixed(7)})` };
}

/** true / false, or null when the row does not exist. */
async function rowHasLocation(id: string): Promise<boolean | null> {
  const url = restUrl();
  url.searchParams.set("id", `eq.${id}`);
  url.searchParams.set("select", "id,location");

  const response = await fetch(url.toString(), { headers: restHeaders() });
  if (!response.ok) {
    throw new Error(`Supabase returned ${response.status}: ${await response.text()}`);
  }
  const rows = (await response.json()) as Array<{ id: string; location: unknown }>;
  if (rows.length === 0) return null;
  return rows[0].location !== null && rows[0].location !== undefined;
}

// ---------------------------------------------------------------------------
// Public reads
// ---------------------------------------------------------------------------

export async function getServices(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const type =
      typeof req.query.type === "string" ? req.query.type : undefined;
    const search =
      typeof req.query.q === "string" ? req.query.q.trim() : undefined;
    const requestedLimit = Number(req.query.limit ?? 100);
    const limit = Number.isInteger(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 1000)
      : 100;

    let query = supabase
      .from("services")
      .select("*, category:service_categories(id,name,slug,parent_id)")
      .eq("status", "approved")
      // A service with no coordinates can never be shown on the map.
      .not("location", "is", null)
      .limit(limit);

    if (type) query = query.eq("category.slug", type);
    if (search) query = query.ilike("name", `%${search}%`);

    const { data, error } = await query;
    if (error) throw error;

    const rows = data ?? [];
    const byCategoryId = new Map<
      string,
      { id: string; name: string; slug: string; parent_id: string | null }
    >();
    for (const row of rows) {
      const cat = (row as any).category;
      if (cat) byCategoryId.set(cat.id, cat);
    }

    const parentIds = new Set(
      [...byCategoryId.values()]
        .map((c) => c.parent_id)
        .filter((id): id is string => !!id),
    );

    let parents = new Map<
      string,
      { id: string; name: string; slug: string; parent_id: string | null }
    >();
    if (parentIds.size > 0) {
      const { data: parentRows, error: parentError } = await supabase
        .from("service_categories")
        .select("id,name,slug,parent_id")
        .in("id", [...parentIds]);
      if (parentError) throw parentError;
      parents = new Map((parentRows ?? []).map((p) => [p.id, p]));
    }

    const enriched = rows.map((row: any) => {
      const cat = row.category;
      if (!cat) return row;
      return {
        ...row,
        category: {
          ...cat,
          parent: cat.parent_id ? (parents.get(cat.parent_id) ?? null) : null,
        },
      };
    });

    res.json(enriched);
  } catch (error) {
    next(error);
  }
}

export async function getServiceDetails(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const service = await fetchServiceDetails(req.params.externalId);

    if (!service) {
      res.status(404).json({ error: "Service not found" });
      return;
    }

    res.json(service);
  } catch (error) {
    next(error);
  }
}

// ---------------------------------------------------------------------------
// Admin: edit ANY service, at ANY status
// ---------------------------------------------------------------------------
//
// PATCH /api/services/:id
// Send only the fields you want to change, e.g.
//   { location: "SRID=4326;POINT(18.42 -33.92)" }     <- place a pin
//   { status: "archived" }                            <- hide from the map
//   { name: "...", phone: "..." }                     <- edit details
// `status` is OPTIONAL. (The old version demanded it, which is what made
// every "place on map" request fail with 400.)
export const updateService = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = req.params.id?.trim();
    if (!id || !UUID_RE.test(id)) {
      return res.status(400).json({ error: "A valid service id is required" });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const updates: Record<string, unknown> = {};

    // name (required column, so it can't be blanked)
    if (body.name !== undefined) {
      if (typeof body.name !== "string" || !body.name.trim()) {
        return res.status(400).json({ error: "Name cannot be empty" });
      }
      updates.name = body.name.trim();
    }

    // nullable text columns
    for (const field of NULLABLE_TEXT_FIELDS) {
      const value = body[field];
      if (value === undefined) continue;
      if (value !== null && typeof value !== "string") {
        return res.status(400).json({ error: `${field} must be text` });
      }
      updates[field] = typeof value === "string" && value.trim() ? value.trim() : null;
    }

    // location
    if (body.location !== undefined) {
      const parsed = parseLocation(body.location);
      if (!parsed.ok) return res.status(400).json({ error: parsed.message });
      updates.location = parsed.value;
    }

    // status (+ review metadata)
    if (body.status !== undefined) {
      if (!isServiceStatus(body.status)) {
        return res.status(400).json({
          error: `status must be one of: ${SERVICE_STATUSES.join(", ")}`,
        });
      }
      const status = body.status;
      updates.status = status;

      const note =
        typeof body.review_note === "string" && body.review_note.trim()
          ? body.review_note.trim()
          : null;

      if (status === "pending") {
        // Restoring to the queue: wipe the previous verdict.
        updates.reviewed_by = null;
        updates.review_note = note;
      } else {
        updates.reviewed_by = req.auth?.userId ?? null;
        updates.review_note =
          note ??
          {
            approved: "Approved by admin",
            rejected: "Rejected by admin",
            archived: "Archived by admin",
          }[status];
      }
    } else if (body.review_note !== undefined) {
      if (body.review_note !== null && typeof body.review_note !== "string") {
        return res.status(400).json({ error: "review_note must be text" });
      }
      updates.review_note =
        typeof body.review_note === "string" && body.review_note.trim()
          ? body.review_note.trim()
          : null;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error:
          "Nothing to update. Send at least one of: name, type, formatted_address, " +
          "location, opening_hours, website, phone, wheelchair, status, review_note",
      });
    }

    // Guard: never approve a service that has no pin.
    if (updates.status === "approved") {
      const willHaveLocation =
        updates.location !== undefined
          ? updates.location !== null
          : await rowHasLocation(id);

      if (willHaveLocation === null) {
        return res.status(404).json({ error: "Service not found" });
      }
      if (!willHaveLocation) {
        return res.status(400).json({
          error: "Place this service on the map before approving it.",
        });
      }
    }

    const url = restUrl();
    url.searchParams.set("id", `eq.${id}`);

    const response = await fetch(url.toString(), {
      method: "PATCH",
      headers: restHeaders({ Prefer: "return=representation" }),
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Supabase returned ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as unknown[];
    if (!data || data.length === 0) {
      return res.status(404).json({ error: "Service not found" });
    }

    return res.status(200).json({ data: data[0] });
  } catch (error) {
    next(error);
  }
};

// GET /api/services/by-status?status=pending|approved|rejected|archived|all
//   optional: &q=<name search>  &missing_location=true  &limit=<1-500>
export async function getServicesByStatus(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const rawStatus =
      typeof req.query.status === "string" ? req.query.status.trim() : "";
    const statuses =
      !rawStatus || rawStatus === "all"
        ? []
        : rawStatus.split(",").map((s) => s.trim());

    if (statuses.some((s) => !isServiceStatus(s))) {
      return res.status(400).json({
        error: `status must be one of: ${SERVICE_STATUSES.join(", ")}, all`,
      });
    }

    const search =
      typeof req.query.q === "string" ? req.query.q.trim() : "";
    const missingLocation = req.query.missing_location === "true";
    const limit = Math.min(Math.max(Number(req.query.limit ?? 100) || 100, 1), 500);

    const url = restUrl();
    url.searchParams.set(
      "select",
      "*,category:service_categories(id,name,slug,parent_id)",
    );
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("order", "created_at.desc");

    if (statuses.length === 1) {
      url.searchParams.set("status", `eq.${statuses[0]}`);
    } else if (statuses.length > 1) {
      url.searchParams.set("status", `in.(${statuses.join(",")})`);
    }
    if (search) url.searchParams.set("name", `ilike.*${search}*`);
    if (missingLocation) url.searchParams.set("location", "is.null");

    const response = await fetch(url.toString(), { headers: restHeaders() });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Supabase returned ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as any[];
    const enriched = (data ?? []).map((row) => ({
      ...row,
      type: row.category?.name ?? row.type ?? "Service",
    }));

    res.json(enriched);
  } catch (error) {
    next(error);
  }
}

// ---------------------------------------------------------------------------
// Authenticated user: suggestions
// ---------------------------------------------------------------------------

export async function suggestService(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.auth?.userId) {
      return res
        .status(401)
        .json({ error: "Authentication required to suggest a service" });
    }

    const {
      name,
      type,
      formatted_address,
      phone,
      website,
      opening_hours,
      latitude,
      longitude,
    } = req.body ?? {};

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "A service name is required" });
    }

    const location =
      typeof latitude === "number" && typeof longitude === "number"
        ? `SRID=4326;POINT(${longitude} ${latitude})`
        : null;

    const newService = {
      name: name.trim(),
      type: type ?? null,
      formatted_address: formatted_address ?? null,
      location,
      phone: phone ?? null,
      website: website ?? null,
      opening_hours: opening_hours ?? null,
      submitted_by: req.auth.userId,
      status: "pending",
    };

    // Service-role key so RLS cannot block the insert
    const response = await fetch(restUrl().toString(), {
      method: "POST",
      headers: restHeaders({ Prefer: "return=representation" }),
      body: JSON.stringify(newService),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[suggestService] Supabase error:", errorText);
      return res.status(response.status).json({
        error: "Failed to submit suggestion",
        details: errorText,
      });
    }

    const data = (await response.json()) as unknown[];
    return res.status(201).json({ data: data[0] });
  } catch (error) {
    next(error);
  }
}

export async function getMySuggestions(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const url = restUrl();
    url.searchParams.set("select", "id,name,type,status,created_at,review_note");
    url.searchParams.set("submitted_by", `eq.${req.auth.userId}`);
    url.searchParams.set("order", "created_at.desc");

    const response = await fetch(url.toString(), { headers: restHeaders() });
    if (!response.ok) throw new Error(await response.text());

    const data = await response.json();
    res.json(data ?? []);
  } catch (error) {
    next(error);
  }
}
