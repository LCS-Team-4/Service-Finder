import { request, setRateLimit, requireEnv } from '../lib/http'
import { replaceInSupabase } from '../lib/supabase'
import type { TrafficIncidentFeature, TrafficIncidentsResponse } from '../../types/accident.type'

setRateLimit('tomtom', 10, 60_000)


const tomtomUrl = requireEnv('TOMTOM_URL', process.env.TOMTOM_URL)
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