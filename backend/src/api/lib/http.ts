const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
import { RateLimiter } from './rate_limit'

const limiters = new Map<string, RateLimiter>()

export function setRateLimit(name: string, maxCalls: number, windowMs: number) {
  limiters.set(name, new RateLimiter(maxCalls, windowMs))
}
export function requireEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is not configured`)
  return value
}

export async function request<T = any>(
  baseUrl: string,
  path: string,
  options: {
    method?: string
    headers?: Record<string, string>
    params?: Record<string, string | number>
    body?: unknown
    retries?: number         
    limiter?: string          
  } = {}
): Promise<T> {
  const url = new URL(baseUrl + path)
  for (const [k, v] of Object.entries(options.params ?? {})) {
    url.searchParams.set(k, String(v))
  }

  const limiterName = options.limiter
  if (limiterName !== undefined) {
    const limiter = limiters.get(limiterName)
    if (limiter) await limiter.waitForSlot()
  }

  const res = await fetch(url, {
    method: options.method ?? 'GET',
    headers: options.body ? { 'Content-Type': 'application/json', ...options.headers } : options.headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

 //acts as the rate throttle 
  const retries = options.retries ?? 1
  if ((res.status === 429 || res.status >= 500) && retries > 0) {
    const retryAfter = Number(res.headers.get('Retry-After'))   // seconds, if they told us
    const waitMs = retryAfter > 0
      ? retryAfter * 1000                                        
      : 250 * Math.pow(2, (options.retries ?? 1) - retries + 1) 
    console.warn(`[http] ${res.status} — retrying in ${waitMs}ms (${retries} left)`)
    await sleep(waitMs)
    return request(baseUrl, path, { ...options, retries: retries - 1 })
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`)
  return res.json()


  
}