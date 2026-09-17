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