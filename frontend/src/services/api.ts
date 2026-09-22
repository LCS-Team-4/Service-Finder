import type { Service } from "../types/service.types";
import type { TrafficIncident } from "../types/traffic.types";

const configuredApiUrl = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api").replace(/\/+$/, "");
const API_BASE_URL = configuredApiUrl.endsWith("/api") ? configuredApiUrl : `${configuredApiUrl}/api`;

type ApiError = { error?: string };

async function request<T>(path: string, options: RequestInit): Promise<T> {
	let response: Response;
	try {
		response = await fetch(`${API_BASE_URL}${path}`, {
			...options,
			headers: { "Content-Type": "application/json", ...options.headers },
		});
	} catch {
		throw new Error("Unable to reach the authentication server. Start the backend and check its Supabase configuration.");
	}
	const payload = await response.json() as T & ApiError;
	if (!response.ok) throw new Error(payload.error || "Something went wrong.");
	return payload;
}

export type AuthResponse = {
	user: { id: string; email?: string };
	session?: { access_token: string; refresh_token: string };
	needsEmailConfirmation?: boolean;
};

export function loginRequest(email: string, password: string) {
	return request<AuthResponse>("/auth/login", {
		method: "POST",
		body: JSON.stringify({ email, password }),
	});
}

export function signupRequest(firstName: string, lastName: string, phoneNumber: string, email: string, password: string) {
	return request<AuthResponse>("/auth/signup", {
		method: "POST",
		body: JSON.stringify({ firstName, lastName, phoneNumber, email, password }),
	});
}

export function forgotPasswordRequest(email: string) {
	return request<{ message: string }>("/auth/forgot-password", {
		method: "POST",
		body: JSON.stringify({ email }),
	});
}

export function resetPasswordRequest(accessToken: string, password: string) {
	return request<{ message: string }>("/auth/reset-password", {
		method: "POST",
		body: JSON.stringify({ accessToken, password }),
	});
}

export async function getServices(): Promise<Service[]> {
	const response = await fetch(`${API_BASE_URL}/services?limit=1000`);
	if (!response.ok) throw new Error(`Unable to load services (${response.status})`);
	return response.json() as Promise<Service[]>;
}

export async function getServiceDetails(externalId: string): Promise<Service> {
	const response = await fetch(`${API_BASE_URL}/services/${encodeURIComponent(externalId)}`);
	if (!response.ok) throw new Error(`Unable to load service details (${response.status})`);
	return response.json() as Promise<Service>;
}

export async function getTrafficIncidents(): Promise<TrafficIncident[]> {
	const response = await fetch(`${API_BASE_URL}/traffic-incidents`);
	if (!response.ok) throw new Error(`Unable to load traffic incidents (${response.status})`);
	return response.json() as Promise<TrafficIncident[]>;
}
