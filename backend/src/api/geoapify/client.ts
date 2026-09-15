import { request, setRateLimit, requireEnv } from '../lib/http'
import { upsertToSupabase } from '../lib/supabase'
import { ensureServiceCategories, resolveCategorySlug } from '../../services/categoryService'

setRateLimit('geoapify', 10, 60_000)


const geoapifyUrl = requireEnv('GEOAPIFY_URL', process.env.GEOAPIFY_URL)
const southAfricaRegions = [
  [16.45, -34.85, 20.58, -28.48],
  [20.58, -34.85, 24.7, -28.48],
  [24.7, -34.85, 28.82, -28.48],
  [28.82, -34.85, 32.95, -28.48],
  [16.45, -28.48, 20.58, -22.1],
  [20.58, -28.48, 24.7, -22.1],
  [24.7, -28.48, 28.82, -22.1],
  [28.82, -28.48, 32.95, -22.1],
] as const

export function geopaify(key: string, format: 'json' | 'xml' = 'json' ) {
  return {
    get: (path: string, extraParams: Record<string, string | number> = {}) =>
      request(geoapifyUrl, path, {
        params: { apiKey: key, format, ...extraParams },
        limiter: 'geoapify',
      }),
  }
}


let importInProgress = false

//sends API data to supabase 
export async function importServices(
  key = requireEnv('GEOAPIFY_API_KEY', process.env.GEOAPIFY_API_KEY),
  path = ''
) {
  if (importInProgress) return { imported: 0, skipped: true }
  importInProgress = true

  try {
    const categoryMap = await ensureServiceCategories()
    const categories = [
        'office.government.migration',
        'office.government.public_service',
        'service.fire_station',
        'service.social_facility.shelter',
        'healthcare.hospital',
        'healthcare.clinic_or_praxis',
        'healthcare.pharmacy',
        'healthcare.dentist',
        'education.library',
        'education.school',
        'service.police',
      ].join(',')
      const features: any[] = []

      for (const [west, south, east, north] of southAfricaRegions) {
        const pageSize = 300
        const maxPages = Math.max(1, Number(process.env.GEOAPIFY_MAX_PAGES ?? 3))
        for (let page = 0; page < maxPages; page++) {
          const data = await geopaify(key).get(path, {
            categories,
            filter: `rect:${west},${south},${east},${north}`,
            limit: pageSize,
            offset: page * pageSize,
          })
          const pageFeatures = data.features ?? []
          features.push(...pageFeatures)
          if (pageFeatures.length < pageSize) break
        }
      }

      const services = features.flatMap((feature: any) => {
      const props = feature.properties
      const address = typeof props.formatted === 'string' ? props.formatted.trim() : ''
      const name = typeof props.name === 'string' ? props.name.trim() : ''
      const coordinates = feature.geometry?.coordinates

      if (!address || !Array.isArray(coordinates) || coordinates.length < 2) return []

      const [lon, lat] = coordinates
      const categorySlug = resolveCategorySlug(props.categories, name, address)
      const category = categorySlug ? categoryMap.get(categorySlug) : undefined

      return [{
        external_id: props.place_id,
        name: name || address,
        type: category?.name ?? null,
        category_id: category?.id ?? null,
        formatted_address: address,
        location: `SRID=4326;POINT(${lon} ${lat})`,
        opening_hours: props.opening_hours ?? null,
        website: props.website ?? null,
        wheelchair: props.datasource?.raw?.wheelchair ?? null,
        sourcename: props.datasource?.sourcename ?? 'osm',
        imported_at: new Date().toISOString()
      }]
    })

    await upsertToSupabase('services', services, {
      batchSize: 100,
      onConflict: 'external_id',
    })

    return { imported: services.length, skipped: false }
  } finally {
    importInProgress = false
  }
}