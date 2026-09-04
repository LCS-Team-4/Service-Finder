import { request, setRateLimit, requireEnv } from '../lib/http'
import { upsertToSupabase } from '../lib/supabase'

setRateLimit('geoapify', 10, 60_000)


const geoapifyUrl = requireEnv('GEOAPIFY_URL', process.env.GEOAPIFY_URL)

const categoryLabels: Record<string, string> = {
  'office.government.migration': 'Home Affairs',
  'office.government.public_service': 'Public service office',
  'service.fire_station': 'Fire station',
  'service.social_facility.shelter': 'Shelter',
  'healthcare.hospital': 'Hospital',
  'healthcare.clinic_or_praxis': 'Clinic',
  'healthcare.pharmacy': 'Pharmacy',
  'healthcare.dentist': 'Dentist',
  'education.library': 'Library',
  'education.school': 'School',
  'service.police': 'Police station',
}

function getCategoryLabel(categories: unknown, name: string, address: string): string | null {
  const matchingCategory = Array.isArray(categories)
    ? categories
      .filter((category): category is string => typeof category === 'string')
      .sort((first, second) => second.length - first.length)
      .find((category) => categoryLabels[category])
    : undefined

  if (matchingCategory) return categoryLabels[matchingCategory]

  const text = `${name} ${address}`.toLowerCase()
  const nameMatches: Array<[string, string]> = [
    ['fire station', 'Fire station'],
    ['police station', 'Police station'],
    ['police', 'Police station'],
    ['shelter', 'Shelter'],
    ['pharmacy', 'Pharmacy'],
    ['chemist', 'Pharmacy'],
    ['dentist', 'Dentist'],
    ['library', 'Library'],
    ['school', 'School'],
    ['home affairs', 'Home Affairs'],
  ]

  return nameMatches.find(([term]) => text.includes(term))?.[1] ?? null
}

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

export async function importServices(
  key = requireEnv('GEOAPIFY_API_KEY', process.env.GEOAPIFY_API_KEY),
  path = ''
) {
  if (importInProgress) return { imported: 0, skipped: true }
  importInProgress = true

  try {
    const data = await geopaify(key).get(path,{

      categories: [
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
      ].join(','),
      filter: 'rect:16.45,-35.15,24.85,-28.45', // Western Cape bounding box
      limit: 300
    })

    const services = data.features.flatMap((feature: any) => {
      const props = feature.properties
      const address = typeof props.formatted === 'string' ? props.formatted.trim() : ''
      const name = typeof props.name === 'string' ? props.name.trim() : ''
      const coordinates = feature.geometry?.coordinates

      if (!address || !Array.isArray(coordinates) || coordinates.length < 2) return []

      const [lon, lat] = coordinates

      return [{
        external_id: props.place_id,
        name: name || address,
        type: getCategoryLabel(props.categories, name, address),
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