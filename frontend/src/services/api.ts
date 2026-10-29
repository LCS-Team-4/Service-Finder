import type { Service } from '../types/service.types';
import type { TrafficIncident } from '../types/traffic.types';

const configuredApiUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');
const API_BASE_URL = configuredApiUrl.endsWith('/api') ? configuredApiUrl : `${configuredApiUrl}/api`;

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
    throw new Error(`Unable to reach the backend API at ${API_BASE_URL}. Start the backend and check its Supabase configuration.`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    const preview = await response.text();
    const responseStatus = `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
    if (!preview.trim()) {
      throw new Error(
        `The backend returned an empty non-JSON response (${responseStatus}). Check the backend terminal for startup errors, confirm SUPABASE_URL and SUPABASE_SERVICE_KEY are set, and ensure only one backend is using port 5000.`,
      );
    }
    throw new Error(
      `The backend returned a non-JSON response (${responseStatus}, ${contentType || 'unknown content type'}): ${preview.slice(0, 150)}`,
    );
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

export function getTrafficIncidents() {
  return request<TrafficIncident[]>('/traffic-incidents', { method: 'GET' });
}

export type MeResponse = {
  id: string;
  email?: string;
  role: 'admin' | 'user';
};

export function getMe() {
  const token = localStorage.getItem('servicefinder_access_token');
  if (!token) {
    return Promise.reject(new Error('No access token'));
  }
  return request<MeResponse>('/auth/me', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// =========================================
// ADMIN
// =========================================
export type AdminService = {
  id: string;
  name: string;
  formatted_address: string | null;
  status: string;
  location: any;
  type: string | null;
};

export function getServicesByStatus(status: string) {
  const token = localStorage.getItem('servicefinder_access_token');
  if (!token) return Promise.reject(new Error('No token'));
  
  return request<AdminService[]>(`/services/by-status?status=${status}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function updateServiceStatus(id: string, status: 'approved' | 'rejected' | 'pending') {
  const token = localStorage.getItem('servicefinder_access_token');
  if (!token) return Promise.reject(new Error('No token'));

  return request<{ data: AdminService }>(`/services/${id}`, {
    method: 'PATCH',
    headers: { 
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}` 
    },
    body: JSON.stringify({ status }),
  });
}

export function triggerServiceImport() {
  const token = localStorage.getItem('servicefinder_access_token');
  if (!token) return Promise.reject(new Error('No token'));
  
  return request<{ imported: number; skipped: boolean }>('/admin/import/services', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function triggerTrafficImport() {
  const token = localStorage.getItem('servicefinder_access_token');
  if (!token) return Promise.reject(new Error('No token'));
  
  return request<{ imported: number; skipped: boolean }>('/admin/import/accidents', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}