import { request, setRateLimit,requireEnv} from '../lib/http'

setRateLimit('geopify', 10, 60_000)


const geoapifyUrl = requireEnv('GEOPAFIY_URL', process.env.GEOPAFIY_URL)
if (!geoapifyUrl) {
  throw new Error('GEOPAFIY_URL is not configured')
}

export function geopaify(key: string, format: 'json' | 'xml' = 'json' ) {
  return {
    get: (path: string) =>
      request(geoapifyUrl, path, {
        params: { key, format },
        limiter: 'geopify',
      }),
  }
}

