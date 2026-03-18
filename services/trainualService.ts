/**
 * Client-side Trainual API service.
 * Routes through a CORS proxy since Trainual's API doesn't support
 * cross-origin browser requests directly.
 *
 * CORS Proxy options (set VITE_TRAINUAL_PROXY in .env.local):
 *   - Local dev:  http://localhost:3001  (run: npm run dev:server)
 *   - Production: Deploy server.ts to Render/Railway and set the URL
 */

const _pw: string = process.env.TRAINUAL_PASSWORD as string;
const _proxy: string = process.env.TRAINUAL_PROXY as string;

// Proxy base URL — falls back to relative path for local dev via Vite proxy
// When TRAINUAL_PROXY is set (e.g. https://trainual-proxy.onrender.com),
// we append /api/trainual to match the server.ts route prefix.
const PROXY_BASE = (_proxy && _proxy !== 'undefined')
  ? `${_proxy.replace(/\/$/, '')}/api/trainual`
  : '/api/trainual';

const TRAINUAL_CONFIG = {
  ADMIN_EMAIL: 'devin@threepointshospitality.com',
  ACCOUNT_ID: 'f9e05a9e-ccec-463e-beae-d1c5489f4c52',
  PASSWORD: (_pw && _pw !== 'undefined') ? _pw : '',
  API_BASE: 'https://api.trainual.com/v1'
};

async function trainualFetch(endpoint: string, method: string = 'GET', payload?: any): Promise<any> {
  // Use the proxy — direct browser calls to Trainual are blocked by CORS
  const url = `${PROXY_BASE}${endpoint}`;
  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (payload) options.body = JSON.stringify(payload);

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.status === 200 || response.status === 201) {
        const text = await response.text();
        return text ? JSON.parse(text) : {};
      }
      if (response.status === 204) return {};
      if (response.status === 429) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt + 1) * 1000));
        continue;
      }
      throw new Error(`Trainual API Error: ${response.status} ${response.statusText}`);
    } catch (e: any) {
      if (attempt === 2) throw e;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  return null;
}

export async function fetchUsers() {
  return await trainualFetch('/users') || [];
}

export async function fetchSubjects() {
  return await trainualFetch('/subjects') || [];
}

export async function fetchSubjectTests(subjectId: number) {
  return await trainualFetch(`/subjects/${subjectId}/tests`) || [];
}

export async function assignCurriculums(userId: number, curriculumIds: number[]) {
  return await trainualFetch(`/users/${userId}/assign`, 'PUT', { curriculum_ids: curriculumIds });
}

export async function unassignCurriculums(userId: number, curriculumIds: number[]) {
  return await trainualFetch(`/users/${userId}/unassign`, 'PUT', { curriculum_ids: curriculumIds });
}

export function isTrainualConfigured(): boolean {
  const hasProxy = _proxy && _proxy !== 'undefined' && _proxy.length > 0;
  const hasPassword = _pw && _pw !== 'undefined' && _pw.length > 0;
  // Works if we have a proxy URL (production) OR locally with the dev server
  return !!(hasProxy || hasPassword);
}
