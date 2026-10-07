export const PUBLIC_API = '/api/tournaments'

async function call(method, url, body, signal) {
  try {
    const response = await fetch(url, {
      method,
      signal,
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

/** Always resolves to { ok, status, data } (data is null when the body is not JSON). */
export const getJson = (url, signal) => call('GET', url, undefined, signal)
export const postJson = (url, body) => call('POST', url, body)

export const errorMessage = (result, fallback = 'Não foi possível carregar os dados.') => result?.data?.error || fallback
