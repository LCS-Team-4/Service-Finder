import type { Service } from "../types/service.types";
import type { TrafficIncident } from "../types/traffic.types";

const API_URL =
	(import.meta as ImportMeta & { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ??
	"http://localhost:5000/api";

export async function getServices(): Promise<Service[]> {
	const response = await fetch(`${API_URL}/services?limit=500`);
	if (!response.ok) throw new Error(`Unable to load services (${response.status})`);
	return response.json() as Promise<Service[]>;
}

export async function getServiceDetails(externalId: string): Promise<Service> {
	const response = await fetch(`${API_URL}/services/${encodeURIComponent(externalId)}`);
	if (!response.ok) throw new Error(`Unable to load service details (${response.status})`);
	return response.json() as Promise<Service>;
}

export async function getTrafficIncidents(): Promise<TrafficIncident[]> {
	const response = await fetch(`${API_URL}/traffic-incidents`);
	if (!response.ok) throw new Error(`Unable to load traffic incidents (${response.status})`);
	return response.json() as Promise<TrafficIncident[]>;
}
