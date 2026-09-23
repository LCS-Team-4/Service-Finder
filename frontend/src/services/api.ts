import type { TrafficIncident } from '../types/traffic.types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

type ApiError = { error?: string };

async function request<T>(path: string, options: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        ...options.headers,
      },
    });
  } catch {
    throw new Error('Unable to reach the authentication server. Start the backend and check its Supabase configuration.');
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    const preview = await response.text();
    throw new Error(`Expected JSON, got "${contentType}": ${preview.slice(0, 150)}`);
  }

  const payload = await response.json() as T & ApiError;
  if (!response.ok) throw new Error(payload.error || 'Something went wrong.');
  return payload;
}

export type AuthResponse = {
  user: { id: string; email?: string };
  session?: { access_token: string; refresh_token: string };
  needsEmailConfirmation?: boolean;
};

export async function getTrafficIncidents(): Promise<TrafficIncident[]> {
  const response = await fetch(`${API_BASE_URL}/traffic-incidents`);
  if (!response.ok) throw new Error(`Unable to load traffic incidents (${response.status})`);
  return response.json() as Promise<TrafficIncident[]>;
}

export function loginRequest(email: string, password: string) {
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function signupRequest(firstName: string, lastName: string, phoneNumber: string, email: string, password: string) {
  return request<AuthResponse>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ firstName, lastName, phoneNumber, email, password }),
  });
}

export function forgotPasswordRequest(email: string) {
  return request<{ message: string }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function resetPasswordRequest(accessToken: string, password: string) {
  return request<{ message: string }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ accessToken, password }),
  });
}

// ---------- Services ----------

import type { Service } from '../types/service.types';

export function getServices(params?: { type?: string; q?: string; limit?: number }) {
  const search = new URLSearchParams();
  if (params?.type) search.set('type', params.type);
  if (params?.q) search.set('q', params.q);
  if (params?.limit) search.set('limit', String(params.limit));
  const qs = search.toString();
  return request<Service[]>(`/services${qs ? `?${qs}` : ''}`, { method: 'GET' });
}

export function getServiceDetails(externalId: string) {
  return request<Service>(`/services/${encodeURIComponent(externalId)}`, { method: 'GET' });
}