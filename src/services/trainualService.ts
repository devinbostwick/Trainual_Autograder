/**
 * Client-side Trainual API service.
 * Routes through a CORS proxy since Trainual's API doesn't support
 * cross-origin browser requests directly.
 *
 * CORS Proxy options (set VITE_TRAINUAL_PROXY in .env.local):
 *   - Local dev:  http://localhost:3001  (run: npm run dev:server)
 *   - Production: Deploy server.ts to Render/Railway and set the URL
 */

import { getConfig, hasConfig } from './localConfig';

// Proxy base URL and password are read at call-time from localConfig
// so that dashboard edits take effect without a page reload.
function getProxyBase(): string {
  const proxy = getConfig('TRAINUAL_PROXY');
  return (proxy && proxy !== 'undefined')
    ? `${proxy.replace(/\/$/, '')}/api/trainual`
    : '/api/trainual';
}

function getPassword(): string {
  return getConfig('TRAINUAL_PASSWORD');
}

const TRAINUAL_CONFIG = {
  ADMIN_EMAIL: 'devin@threepointshospitality.com',
  ACCOUNT_ID: 'f9e05a9e-ccec-463e-beae-d1c5489f4c52',
  API_BASE: 'https://api.trainual.com/v1'
};

async function trainualFetch(endpoint: string, method: string = 'GET', payload?: any): Promise<any> {
  // Use the proxy — direct browser calls to Trainual are blocked by CORS
  const url = `${getProxyBase()}${endpoint}`;
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
  return hasConfig('TRAINUAL_PROXY') || hasConfig('TRAINUAL_PASSWORD');
}
