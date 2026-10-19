/**
 * App API Client
 * Sends authenticated requests to the Supabase Edge Function 'app-api'.
 * Attaches the current user's session Bearer token automatically.
 */

import { supabase } from '../lib/supabase';
import type {
  PersonListItem,
  PersonDetail,
  ConversationRecord,
  CreateConversationInput,
  CreateConversationResponse,
  ARBootstrapResponse,
  DashboardResponse,
  ImportResult,
} from '../lib/contracts';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/app-api` : '/api');

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  return {
    Authorization: token ? `Bearer ${token}` : '',
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  };
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers = new Headers(options.headers || {});
  Object.entries(authHeaders).forEach(([key, value]) => {
    if (value && !headers.has(key)) {
      headers.set(key, value);
    }
  });

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = `API request failed with status ${response.status}`;
    try {
      const errorJson = await response.json();
      if (errorJson?.error?.message) {
        errorDetail = errorJson.error.message;
      }
    } catch {
      // Use fallback
    }
    throw new Error(errorDetail);
  }

  return response.json() as Promise<T>;
}

export const api = {
  // People
  getPeople(): Promise<{ people: PersonListItem[] }> {
    return request<{ people: PersonListItem[] }>('/people');
  },

  getPerson(id: string): Promise<{ person: PersonDetail }> {
    return request<{ person: PersonDetail }>(`/people/${id}`);
  },

  createPerson(formData: FormData): Promise<{ person: PersonDetail }> {
    return request<{ person: PersonDetail }>('/people', {
      method: 'POST',
      body: formData,
    });
  },

  deletePerson(id: string): Promise<{ deleted: boolean }> {
    return request<{ deleted: boolean }>(`/people/${id}`, {
      method: 'DELETE',
    });
  },

  // Conversations
  getConversations(personId: string): Promise<{ conversations: ConversationRecord[] }> {
    return request<{ conversations: ConversationRecord[] }>(`/people/${personId}/conversations`);
  },

  createConversation(
    personId: string,
    input: CreateConversationInput
  ): Promise<CreateConversationResponse> {
    return request<CreateConversationResponse>(`/people/${personId}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  },

  // Dashboard & AR
  getDashboard(): Promise<DashboardResponse> {
    return request<DashboardResponse>('/dashboard');
  },

  getARBootstrap(): Promise<ARBootstrapResponse> {
    return request<ARBootstrapResponse>('/ar/bootstrap');
  },

  // Import
  importChunk(formData: FormData): Promise<ImportResult> {
    return request<ImportResult>('/import', {
      method: 'POST',
      body: formData,
    });
  },
};
