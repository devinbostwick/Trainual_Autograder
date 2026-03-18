/**
 * Client-side Trainual API service.
 * Calls the Trainual API directly from the browser using Basic Auth.
 * Credentials are injected at build time via Vite env variables.
 */

// Password is injected at build time by Vite's define config
const _pw: string = process.env.TRAINUAL_PASSWORD as string;

const TRAINUAL_CONFIG = {
  ADMIN_EMAIL: 'devin@threepointshospitality.com',
  ACCOUNT_ID: 'f9e05a9e-ccec-463e-beae-d1c5489f4c52',
  PASSWORD: (_pw && _pw !== 'undefined') ? _pw : '',
  API_BASE: 'https://api.trainual.com/v1'
};

function buildAuthHeader(): string {
  const username = `${TRAINUAL_CONFIG.ADMIN_EMAIL}&${TRAINUAL_CONFIG.ACCOUNT_ID}`;
  return `Basic ${btoa(`${username}:${TRAINUAL_CONFIG.PASSWORD}`)}`;
}

async function trainualFetch(endpoint: string, method: string = 'GET', payload?: any): Promise<any> {
  const url = `${TRAINUAL_CONFIG.API_BASE}${endpoint}`;
  const options: RequestInit = {
    method,
    headers: {
      'Authorization': buildAuthHeader(),
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
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
  return await trainualFetch('/users?curriculums_assigned=true&roles_assigned=true') || [];
}

export async function fetchSubjects() {
  return await trainualFetch('/curriculums?assigned_users=true') || [];
}

export async function fetchSubjectTests(subjectId: number) {
  return await trainualFetch(`/curriculums/${subjectId}/surveys`) || [];
}

export async function assignCurriculums(userId: number, curriculumIds: number[]) {
  return await trainualFetch(`/users/${userId}/assign_curriculums`, 'PUT', { curriculum_ids: curriculumIds });
}

export async function unassignCurriculums(userId: number, curriculumIds: number[]) {
  return await trainualFetch(`/users/${userId}/unassign_curriculums`, 'PUT', { curriculum_ids: curriculumIds });
}

export function isTrainualConfigured(): boolean {
  return !!(TRAINUAL_CONFIG.PASSWORD && TRAINUAL_CONFIG.PASSWORD !== 'undefined' && TRAINUAL_CONFIG.PASSWORD.length > 0);
}
