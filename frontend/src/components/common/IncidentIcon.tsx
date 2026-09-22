import { Ban, CarFront, CircleAlert, CloudFog, CloudRain, Construction, Snowflake, TrafficCone, TriangleAlert, Wind } from 'lucide-react';

const iconProps = { size: 16, strokeWidth: 2.5 };

export function IncidentIcon({ category }: { category: number | null }) {
  // TomTom icon categories map to the closest Lucide traffic symbol.
  switch (category) {
    case 1: return <CarFront {...iconProps} />;
    case 2: return <CloudFog {...iconProps} />;
    case 3: return <TriangleAlert {...iconProps} />;
    case 4: return <CloudRain {...iconProps} />;
    case 5: return <Snowflake {...iconProps} />;
    case 6: return <TrafficCone {...iconProps} />;
    case 7:
    case 8: return <Ban {...iconProps} />;
    case 9: return <Construction {...iconProps} />;
    case 10: return <Wind {...iconProps} />;
    default: return <CircleAlert {...iconProps} />;
  }
}