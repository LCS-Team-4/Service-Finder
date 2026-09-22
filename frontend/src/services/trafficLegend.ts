import type { TrafficIncident } from '../types/traffic.types';

// TomTom's incident icon categories, mapped to a readable label and the colour
// used for the polyline plus the legend swatch.
export const incidentStyles: Record<number, { label: string; color: string }> = {
	0: { label: 'Unknown', color: '#7a6a58' },
	1: { label: 'Accident', color: '#8e1b12' },
	2: { label: 'Fog', color: '#77909c' },
	3: { label: 'Dangerous conditions', color: '#c56a24' },
	4: { label: 'Rain', color: '#3b77a2' },
	5: { label: 'Ice', color: '#5b8ca8' },
	6: { label: 'Traffic jam', color: '#b5362d' },
	7: { label: 'Lane closed', color: '#a9542a' },
	8: { label: 'Road closed', color: '#8d3a22' },
	9: { label: 'Road works', color: '#c56a24' },
	10: { label: 'Wind', color: '#847337' },
	11: { label: 'Flooding', color: '#2f6f8f' },
	14: { label: 'Broken down vehicle', color: '#a45b83' },
};

export function incidentStyleFor(code: number | null) {
	return (code !== null ? incidentStyles[code] : undefined) ?? { label: 'Road event', color: '#7a6a58' };
}

export type IncidentLegendEntry = { code: number | null; label: string; color: string; count: number };

// One legend row per icon category actually present in the current feed.
export function buildIncidentLegend(incidents: TrafficIncident[]): IncidentLegendEntry[] {
	const counts = new Map<number | null, number>();
	incidents.forEach((incident) => {
		const code = incident.icon_category ?? null;
		counts.set(code, (counts.get(code) ?? 0) + 1);
	});
	return [...counts.entries()]
		.map(([code, count]) => ({ code, count, ...incidentStyleFor(code) }))
		.sort((first, second) => second.count - first.count || first.label.localeCompare(second.label));
}
