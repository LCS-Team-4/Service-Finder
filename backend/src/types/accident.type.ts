export type IncidentCoordinate = [longitude: number, latitude: number]

export interface IncidentEvent {
  code: number
  description: string
  iconCategory: number
}

export interface IncidentProperties {
  iconCategory: number
  magnitudeOfDelay: number
  from: string
  to: string
  length: number
  delay: number
  roadNumbers: string[]
  timeValidity: 'present' | string
  events: IncidentEvent[]
}

export interface IncidentGeometry {
  type: 'LineString'
  coordinates: IncidentCoordinate[]
}

export interface TrafficIncidentFeature {
  type: 'Feature'
  properties: IncidentProperties
  geometry: IncidentGeometry
}

export interface TrafficIncidentsResponse {
  incidents: TrafficIncidentFeature[]
}

export interface accident {
  id: string
}


