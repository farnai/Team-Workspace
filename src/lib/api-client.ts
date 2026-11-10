export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const endpoint = url.startsWith('/') ? url : `/${url}`
  const targetUrl = endpoint.startsWith('/api') ? endpoint : `/api${endpoint}`

  const res = await fetch(targetUrl, {
    method,
    headers: body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
    body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  })

  const json = await res.json().catch(() => null)

  if (res.status === 401 && typeof window !== 'undefined') {
    window.location.href = '/login'
  }

  if (!res.ok) {
    throw new ApiError(json?.error ?? `შეცდომა (${res.status})`, res.status)
  }

  return (json?.data !== undefined ? json.data : json) as T
}

export const api = {
  get: <T>(url: string) => request<T>('GET', url),
  post: <T>(url: string, body?: unknown) => request<T>('POST', url, body),
  patch: <T>(url: string, body?: unknown) => request<T>('PATCH', url, body),
  delete: <T>(url: string) => request<T>('DELETE', url),
}

export function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'უცნობი შეცდომა'
}
