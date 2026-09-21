export type SouthAfricaArea = {
  name: string
  bbox: [west: number, south: number, east: number, north: number]
  center: [latitude: number, longitude: number]
}

const southAfricaAreas: SouthAfricaArea[] = [
  { name: 'Western Cape', bbox: [16.4, -35.0, 21.0, -30.0], center: [-33.9, 18.4] },
  { name: 'Garden Route and Karoo', bbox: [21.0, -35.0, 25.5, -30.0], center: [-33.9, 22.5] },
  { name: 'Eastern Cape', bbox: [25.5, -35.0, 30.0, -30.0], center: [-33.0, 27.9] },
  { name: 'KwaZulu-Natal coast', bbox: [30.0, -32.0, 33.0, -26.0], center: [-29.6, 31.0] },
  { name: 'Free State', bbox: [24.0, -30.0, 30.0, -26.0], center: [-29.1, 26.2] },
  { name: 'Northern Cape', bbox: [16.4, -30.0, 24.0, -22.0], center: [-28.7, 24.7] },
  { name: 'North West', bbox: [24.0, -26.0, 28.0, -22.0], center: [-25.9, 25.6] },
  { name: 'Gauteng', bbox: [27.0, -27.5, 30.0, -24.5], center: [-26.2, 28.0] },
  { name: 'Limpopo', bbox: [27.0, -25.0, 33.0, -22.0], center: [-23.9, 29.5] },
]

const nextAreaByConsumer = new Map<string, number>()

const trafficAreas = southAfricaAreas.flatMap((area) => {
  const [west, south, east, north] = area.bbox
  const tiles: SouthAfricaArea[] = []
  const tileWidth = 0.75
  const tileHeight = 0.75

  for (let tileWest = west; tileWest < east; tileWest += tileWidth) {
    for (let tileSouth = south; tileSouth < north; tileSouth += tileHeight) {
      const tileEast = Math.min(tileWest + tileWidth, east)
      const tileNorth = Math.min(tileSouth + tileHeight, north)
      tiles.push({
        name: `${area.name} tile ${tiles.length + 1}`,
        bbox: [tileWest, tileSouth, tileEast, tileNorth],
        center: [(tileSouth + tileNorth) / 2, (tileWest + tileEast) / 2],
      })
    }
  }

  return tiles
})

export function getNextSouthAfricaArea(consumer: string): SouthAfricaArea {
  const currentIndex = nextAreaByConsumer.get(consumer) ?? 0
  const area = southAfricaAreas[currentIndex % southAfricaAreas.length]
  nextAreaByConsumer.set(consumer, (currentIndex + 1) % southAfricaAreas.length)
  return area
}

export function getNextSouthAfricaTrafficArea(): SouthAfricaArea {
  const currentIndex = nextAreaByConsumer.get('tomtom-accidents') ?? 0
  const area = trafficAreas[currentIndex % trafficAreas.length]
  nextAreaByConsumer.set('tomtom-accidents', (currentIndex + 1) % trafficAreas.length)
  return area
}

export function formatBbox(area: SouthAfricaArea) {
  return area.bbox.join(',')
}
