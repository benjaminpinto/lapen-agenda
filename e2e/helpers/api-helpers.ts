import { APIRequestContext } from '@playwright/test';

export async function createUserViaAPI(request: APIRequestContext, userData: {
  email: string;
  password: string;
  name: string;
  phone: string;
  pix_key?: string;
  is_lapen_member?: boolean;
}) {
  const response = await request.post('/api/auth/register', {
    data: userData
  });
  
  const data = await response.json();
  console.debug('[API] POST /api/auth/register ->', { status: response.status(), data });
  return { success: response.ok(), data, token: data.token };
}

export async function loginViaAPI(request: APIRequestContext, email: string, password: string) {
  const response = await request.post('/api/auth/login', {
    data: { email, password }
  });
  
  const data = await response.json();
  console.debug('[API] POST /api/auth/login ->', { status: response.status(), data });
  return { success: response.ok(), data, token: data.token };
}

export async function createMatchViaAPI(request: APIRequestContext, token: string, matchData: any) {
  const response = await request.post('/api/matches/create', {
    headers: { 'Authorization': `Bearer ${token}` },
    data: matchData
  });
  
  const data = await response.json();
  console.debug('[API] POST /api/matches/create ->', { status: response.status(), data });
  return data;
}
