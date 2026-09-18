// Three modes:
//   - exact:       browser GPS, highest precision
//   - approximate: IP lookup, city-level precision, no browser prompt
//   - declined:    no location at all — callers must render a "location off" state
//
// This module owns:
//   - reading and writing the user's chosen mode (localStorage)
//   - resolving a location in exact or approximate mode
//   - watching the user's exact location (for live tracking / directions)
//   - reading the browser's current geolocation permission state
//
// This module does NOT:
//   - call /nearby or any other API
//   - render anything
//   - know about the map, the sidebar, or the settings UI
//   - store anything on a server

export type LocationMode = 'exact' | 'approximate' | 'declined'

export interface ResolvedLocation {
  /** Whether this position came from GPS (exact) or IP lookup (approximate). */
  mode: 'exact' | 'approximate'
  /** Latitude in decimal degrees (WGS84). */
  lat: number
  /** Longitude in decimal degrees (WGS84). */
  lng: number
  /** Reported accuracy in meters. GPS provides real values; IP is nominal. */
  accuracyMeters: number
  /** Optional human-readable label, e.g. "Cape Town" for IP-based results. */
  label?: string
  /** Unix milliseconds when the fix was taken. */
  timestamp: number
}

export class LocationDeclinedError extends Error {
  constructor(message = 'Location is set to declined') {
    super(message)
    this.name = 'LocationDeclinedError'
  }
}

const STORAGE_KEY = 'service-finder.location.mode'
const DEFAULT_MODE: LocationMode = 'approximate'

export function getStoredMode(): LocationMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'exact' || stored === 'approximate' || stored === 'declined') {
      return stored
    }
    return DEFAULT_MODE
  } catch {
    return DEFAULT_MODE
  }
}

export function setStoredMode(mode: LocationMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // Silently fail — the mode won't persist, but the app keeps working.
  }
}

export async function getExactLocation(): Promise<ResolvedLocation> {
  if (!navigator.geolocation) {
    throw new Error('Geolocation is not supported by this browser')
  }

  return new Promise<ResolvedLocation>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          mode: 'exact',
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
          timestamp: position.timestamp,
        })
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new LocationDeclinedError('Location permission denied'))
          return
        }
        if (error.code === error.POSITION_UNAVAILABLE) {
          reject(new Error('Position unavailable'))
          return
        }
        if (error.code === error.TIMEOUT) {
          reject(new Error('Location request timed out'))
          return
        }
        reject(new Error(error.message || 'Failed to get location'))
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 60_000,
      },
    )
  })
}

export interface WatchExactLocationOptions {
  /** Minimum time between onUpdate callbacks, in milliseconds. Default 3000. */
  throttleMs?: number
}

export function watchExactLocation(
  onUpdate: (location: ResolvedLocation) => void,
  onError: (error: Error) => void,
  options: WatchExactLocationOptions = {},
): () => void {
  if (!navigator.geolocation) {
    throw new Error('Geolocation is not supported by this browser')
  }

  const throttleMs = options.throttleMs ?? 3000

  let lastEmit = 0
  let pendingTimer: ReturnType<typeof setTimeout> | null = null
  let pendingLocation: ResolvedLocation | null = null
  let stopped = false
  let watchId: number | null = null

  const clearPendingTimer = () => {
    if (pendingTimer !== null) {
      clearTimeout(pendingTimer)
      pendingTimer = null
    }
    pendingLocation = null
  }

  const stop = () => {
    if (stopped) return
    stopped = true
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId)
      watchId = null
    }
    clearPendingTimer()
  }

  const emit = (location: ResolvedLocation) => {
    lastEmit = Date.now()
    onUpdate(location)
  }

  const handleSuccess = (position: GeolocationPosition) => {
    if (stopped) return

    const location: ResolvedLocation = {
      mode: 'exact',
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracyMeters: position.coords.accuracy,
      timestamp: position.timestamp,
    }

    const now = Date.now()
    const elapsed = now - lastEmit

    if (elapsed >= throttleMs) {
      clearPendingTimer()
      emit(location)
      return
    }

    pendingLocation = location
    if (pendingTimer === null) {
      pendingTimer = setTimeout(() => {
        pendingTimer = null
        if (stopped || pendingLocation === null) return
        const queued = pendingLocation
        pendingLocation = null
        emit(queued)
      }, throttleMs - elapsed)
    }
  }

  const handleError = (error: GeolocationPositionError) => {
    if (stopped) return

    if (error.code === error.PERMISSION_DENIED) {
      onError(new LocationDeclinedError('Location permission denied'))
      stop()
      return
    }

    if (error.code === error.POSITION_UNAVAILABLE) {
      onError(new Error('Position unavailable'))
      return
    }

    if (error.code === error.TIMEOUT) {
      onError(new Error('Location request timed out'))
      return
    }

    onError(new Error(error.message || 'Failed to watch location'))
  }

  watchId = navigator.geolocation.watchPosition(
    handleSuccess,
    handleError,
    {
      enableHighAccuracy: true,
      timeout: 10_000,
      maximumAge: 60_000,
    },
  )

  return stop
}

let cachedApproximateLocation: ResolvedLocation | null = null

export async function getApproximateLocation(): Promise<ResolvedLocation> {
  if (cachedApproximateLocation) return cachedApproximateLocation

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch('https://ipwho.is/', {
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Approximate location lookup failed (HTTP ${response.status})`)
    }

    const data = await response.json()

    if (data && data.success === false) {
      throw new Error(data.message || 'Approximate location lookup failed')
    }

    if (typeof data.latitude !== 'number' || typeof data.longitude !== 'number') {
      throw new Error('Approximate location lookup returned invalid coordinates')
    }

    const label =
      [data.city, data.region].filter(Boolean).join(', ') || undefined

    const location: ResolvedLocation = {
      mode: 'approximate',
      lat: data.latitude,
      lng: data.longitude,
      accuracyMeters: 5000,
      label,
      timestamp: Date.now(),
    }

    cachedApproximateLocation = location
    return location
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Approximate location lookup timed out')
    }
    if (error instanceof Error) throw error
    throw new Error('Approximate location lookup failed')
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function resolveLocation(
  mode: LocationMode,
): Promise<ResolvedLocation> {
  if (mode === 'declined') {
    throw new LocationDeclinedError(
      'Location mode is set to declined',
    )
  }

  if (mode === 'exact') {
    return getExactLocation()
  }

  // mode === 'approximate' (the only remaining case)
  return getApproximateLocation()
}

export type GeolocationPermission =
  | 'granted'
  | 'denied'
  | 'prompt'
  | 'unsupported'

export async function getCurrentPermission(): Promise<GeolocationPermission> {
  if (!navigator.permissions) {
    return 'unsupported'
  }

  try {
    const status = await navigator.permissions.query({
      name: 'geolocation' as PermissionName,
    })
    return status.state as GeolocationPermission
  } catch {
    return 'unsupported'
  }
}