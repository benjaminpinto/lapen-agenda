import {fetchWithAuth} from '@/utils/fetchWithAuth'

export const ADMIN_API = '/api/admin/tournaments'

/** Call the admin API. Always resolves to { ok, status, data } (data is null when the body is not JSON). */
export async function request(method, url, body) {
  try {
    const response = await fetchWithAuth(url, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    let data = null
    try {
      data = await response.json()
    } catch {
      data = null
    }
    return { ok: response.ok, status: response.status, data }
  } catch {
    return { ok: false, status: 0, data: { error: 'Falha de conexão. Tente novamente.' } }
  }
}

export const errorMessage = (result, fallback = 'Não foi possível concluir a ação.') => result?.data?.error || fallback
