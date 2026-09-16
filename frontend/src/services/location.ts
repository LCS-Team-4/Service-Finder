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