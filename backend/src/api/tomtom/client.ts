import { request, setRateLimit, requireEnv } from '../lib/http'
import { replaceInSupabase, upsertToSupabase } from '../lib/supabase'
import { supabase } from '../../config/supabase'
import { ensureServiceCategories } from '../../services/categoryService'
import type { TrafficIncidentFeature, TrafficIncidentsResponse } from '../../types/accident.type'

setRateLimit('tomtom', 10, 60_000)


const tomtomUrl = requireEnv('TOMTOM_URL', process.env.TOMTOM_URL)
const tomtomSearchUrl = process.env.TOMTOM_SEARCH_URL ?? 'https://api.tomtom.com/search/2'
const tomtomBbox = process.env.TOMTOM_BBOX ?? '18.35,-34.35,19.00,-33.75'
const incidentFields = '{incidents{type,geometry{type,coordinates},properties{iconCategory,magnitudeOfDelay,events{description,code,iconCategory},from,to,length,delay,roadNumbers,timeValidity}}}'

export function tomtom(key: string, format: 'json' | 'xml' = 'json') {
  return {
    get: <T = unknown>(path: string, extraParams: Record<string, string | number> = {}) =>
      request<T>(tomtomUrl, path, {
        params: { key, format, ...extraParams }, // double-check this — TomTom's docs use `key`, not `apiKey` like Geoapify does
        limiter: 'tomtom', 
      }),
  }
}

let trafficImportInProgress = false

export async function importTrafficIncidents(
  key = requireEnv('TOMTOM_API_KEY', process.env.TOMTOM_API_KEY),
  path = ''
) {
  if (trafficImportInProgress) return { imported: 0, skipped: true }
  trafficImportInProgress = true

  try {
    const apiResponse = await tomtom(key).get<TrafficIncidentsResponse>(path, {
      bbox: tomtomBbox,
      fields: incidentFields,
      language: 'en-GB',
      timeValidityFilter: 'present',
    })

    if (!isTrafficIncidentsResponse(apiResponse)) {
      throw new Error('TomTom traffic response did not contain a valid incidents array')
    }

    const rows = apiResponse.incidents.map((feature) => {
      const coords = feature.geometry.coordinates
      const wkt = 'LINESTRING(' + coords.map(([lng, lat]: [number, number]) => `${lng} ${lat}`).join(', ') + ')'

      return {
        icon_category: feature.properties.iconCategory,
        magnitude_of_delay: feature.properties.magnitudeOfDelay,
        from_road: feature.properties.from,
        to_road: feature.properties.to,
        length_m: feature.properties.length,
        delay_seconds: feature.properties.delay,
        road_numbers: feature.properties.roadNumbers,
        description: feature.properties.events[0]?.description ?? null,
        geometry: `SRID=4326;${wkt}`,
        imported_at: new Date().toISOString(),
      }
    })

      await replaceInSupabase('traffic_incidents', rows, { batchSize: 100 })

    return { imported: rows.length, skipped: false }
  } finally {
    trafficImportInProgress = false
  }
}

function isTrafficIncidentsResponse(value: unknown): value is TrafficIncidentsResponse {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { incidents?: unknown }).incidents)) {
    return false
  }

  return (value as TrafficIncidentsResponse).incidents.every(isTrafficIncidentFeature)
}

function isTrafficIncidentFeature(value: unknown): value is TrafficIncidentFeature {
  if (!value || typeof value !== 'object') return false

  const feature = value as Partial<TrafficIncidentFeature>
  return feature.type === 'Feature'
    && feature.geometry?.type === 'LineString'
    && Array.isArray(feature.geometry.coordinates)
    && feature.geometry.coordinates.every(
      (coordinate) => Array.isArray(coordinate)
        && coordinate.length === 2
        && coordinate.every((value) => typeof value === 'number'),
    )
}

type TomTomServiceResult = {
  id: string
  poi?: {
    name?: string
    phone?: string
    url?: string
    categories?: string[]
  }
  address?: {
    freeformAddress?: string
  }
  position?: {
    lat?: number
    lon?: number
  }
}

type ExistingService = {
  id: string
  external_id: string | null
  name: string
  type: string | null
  category_id: string | null
  formatted_address: string | null
  location: string | null
  phone: string | null
  website: string | null
  opening_hours: string | null
  wheelchair: string | null
}

const serviceSearchCategories = (process.env.TOMTOM_SERVICE_CATEGORIES ?? 'school,hospital,clinic,pharmacy,dentist,library,police station,fire station,shelter')
  .split(',')
  .map((category) => category.trim())
  .filter(Boolean)

const serviceSearchCenters = (process.env.TOMTOM_SERVICE_CENTERS ?? '-33.9249,18.4241;-29.8587,31.0218;-26.2041,28.0473;-25.7479,28.2293;-33.918,18.4233;-33.9608,22.4617;-29.0852,26.1596;-23.9045,29.4689;-28.7282,24.7499')
  .split(';')
  .map((center) => center.split(',').map(Number))
  .filter(([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon))

async function searchTomTomServices(key: string, category: string, latitude: number, longitude: number) {
  const pageSize = 100
  const maxPages = Math.max(1, Number(process.env.TOMTOM_SERVICE_MAX_PAGES ?? 3))
  const results: TomTomServiceResult[] = []

  for (let page = 0; page < maxPages; page++) {
    const response = await request<{ results?: TomTomServiceResult[]; summary?: { totalResults?: number } }>(
      tomtomSearchUrl,
      `/categorySearch/${encodeURIComponent(category)}.json`,
      {
        params: {
          key,
          countrySet: 'ZA',
          lat: latitude,
          lon: longitude,
          radius: Number(process.env.TOMTOM_SERVICE_RADIUS ?? 10000),
          limit: pageSize,
          ofs: page * pageSize,
        },
        limiter: 'tomtom',
      },
    )

    const pageResults = response.results ?? []
    results.push(...pageResults)
    if (pageResults.length < pageSize || results.length >= (response.summary?.totalResults ?? 0)) break
  }

  return results
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function parsePoint(location: string | null): [number, number] | null {
  if (!location) return null
  const wkt = location.match(/POINT\s*\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)/i)
  if (wkt) return [Number(wkt[1]), Number(wkt[2])]

  if (!/^[0-9a-f]+$/i.test(location) || location.length < 34) return null
  const bytes = new Uint8Array(location.match(/.{2}/g)!.map((pair) => parseInt(pair, 16)))
  const littleEndian = bytes[0] === 1
  const view = new DataView(bytes.buffer)
  const geometryType = view.getUint32(1, littleEndian)
  const coordinateOffset = 5 + (geometryType & 0x20000000 ? 4 : 0)
  if ((geometryType & 0xff) !== 1 || bytes.length < coordinateOffset + 16) return null
  return [
    view.getFloat64(coordinateOffset, littleEndian),
    view.getFloat64(coordinateOffset + 8, littleEndian),
  ]
}

function distanceInMeters(first: [number, number], second: [number, number]) {
  const latitude = ((first[1] + second[1]) / 2) * Math.PI / 180
  const longitudeMeters = 111_320 * Math.cos(latitude)
  return Math.hypot((first[0] - second[0]) * longitudeMeters, (first[1] - second[1]) * 110_574)
}

function mapTomTomService(result: TomTomServiceResult, category: string, categoryId: string | null) {
  const name = result.poi?.name?.trim()
  const latitude = result.position?.lat
  const longitude = result.position?.lon
  if (!result.id || !name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null

  return {
    external_id: `tomtom:${result.id}`,
    name,
    type: category,
    category_id: categoryId,
    formatted_address: result.address?.freeformAddress ?? null,
    location: `SRID=4326;POINT(${longitude} ${latitude})`,
    phone: result.poi?.phone ?? null,
    website: result.poi?.url ? (result.poi.url.startsWith('http') ? result.poi.url : `https://${result.poi.url}`) : null,
    sourcename: 'tomtom',
    imported_at: new Date().toISOString(),
  }
}

function enrichableFields(existing: ExistingService, candidate: ReturnType<typeof mapTomTomService>) {
  if (!candidate) return {}
  const updates: Record<string, string> = {}
  for (const field of ['formatted_address', 'phone', 'website'] as const) {
    if (!existing[field] && candidate[field]) updates[field] = candidate[field]
  }
  if (!existing.category_id && candidate.category_id) updates.category_id = candidate.category_id
  if (!existing.type && candidate.type) updates.type = candidate.type
  return updates
}

let serviceImportInProgress = false

export async function importTomTomServices(
  key = requireEnv('TOMTOM_API_KEY', process.env.TOMTOM_API_KEY),
) {
  if (serviceImportInProgress) return { fetched: 0, inserted: 0, enriched: 0, skipped: true }
  serviceImportInProgress = true

  try {
    const categories = await ensureServiceCategories()
    const results: Array<{ result: TomTomServiceResult; category: string }> = []
    for (const category of serviceSearchCategories) {
      for (const [latitude, longitude] of serviceSearchCenters) {
        const categoryResults = await searchTomTomServices(key, category, latitude, longitude)
        results.push(...categoryResults.map((result) => ({ result, category })))
      }
    }

    const unique = Array.from(new Map(results.map((entry) => [entry.result.id, entry])).values())
    const { data: existingRows, error } = await supabase
      .from('services')
      .select('id,external_id,name,type,category_id,formatted_address,location,phone,website,opening_hours,wheelchair')
      .limit(10_000)
    if (error) throw error

    const existing = (existingRows ?? []) as ExistingService[]
    const inserts: NonNullable<ReturnType<typeof mapTomTomService>>[] = []
    let enriched = 0
    for (const { result, category } of unique) {
      const categoryDefinition = getTomTomCategory(category, categories)
      const candidate = mapTomTomService(result, categoryDefinition.name, categoryDefinition.id || null)
      if (!candidate) continue
      const coordinates = parsePoint(candidate.location.replace(/^SRID=4326;/, ''))
      const match = existing.find((service) =>
        service.external_id === candidate.external_id ||
        (normalizeName(service.name) === normalizeName(candidate.name) && coordinates && parsePoint(service.location) && distanceInMeters(coordinates, parsePoint(service.location)!) <= 150),
      )
      if (!match) {
        inserts.push(candidate)
        continue
      }
      const updates = enrichableFields(match, candidate)
      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase.from('services').update(updates).eq('id', match.id)
        if (updateError) throw updateError
        enriched++
      }
    }

    if (inserts.length > 0) {
      await upsertToSupabase('services', inserts, { batchSize: 100, onConflict: 'external_id' })
    }
    return { fetched: unique.length, inserted: inserts.length, enriched, skipped: false }
  } finally {
    serviceImportInProgress = false
  }
}

function getTomTomCategory(category: string, categories: Map<string, { id: string; name: string }>) {
  const normalized = category.toLowerCase().trim()
  const aliases: Record<string, string> = {
    'government office': 'public-service-office',
    'government offices': 'public-service-office',
    police: 'police-station',
    'police station': 'police-station',
    'fire station': 'fire-station',
    'fire stations': 'fire-station',
    'social shelter': 'shelter',
    'primary school': 'school',
    'high school': 'school',
  }
  const slug = aliases[normalized] ?? normalized.replace(/\s+/g, '-')
  return categories.get(slug) ?? { id: '', name: category.trim() || 'Public service office' }
}