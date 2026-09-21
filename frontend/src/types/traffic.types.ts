export type TrafficCoordinate = [longitude: number, latitude: number]

export interface TrafficIncident {
  id: string
  icon_category: number | null
  magnitude_of_delay: number | null
  from_road: string | null
  to_road: string | null
  length_m: number | null
  delay_seconds: number | null
  road_numbers: string[] | null
  description: string | null
  geometry: unknown
  imported_at: string
}
