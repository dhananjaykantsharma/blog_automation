export interface User {
  email: string
  name: string
}

interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  user: User
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// Access token lives only in memory; the refresh token is an httpOnly cookie.
let accessToken: string | null = null
let refreshPromise: Promise<TokenResponse> | null = null

async function parseError(res: Response): Promise<ApiError> {
  let message = res.statusText || 'Request failed'
  try {
    const body = await res.json()
    if (typeof body.detail === 'string') message = body.detail
    else if (Array.isArray(body.detail)) message = body.detail[0]?.msg ?? message
  } catch {
    // non-JSON body
  }
  return new ApiError(res.status, message)
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)

  const res = await fetch(`/api${path}`, { ...init, headers, credentials: 'include' })

  if (res.status === 401 && retry && !path.startsWith('/auth/')) {
    try {
      await refreshSession()
      return request<T>(path, init, false)
    } catch {
      throw await parseError(res)
    }
  }
  if (!res.ok) throw await parseError(res)
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// For requests that can't go through request(), such as the SSE stream in blogs.ts
export function getAccessToken(): string | null {
  return accessToken
}

export function refreshSession(): Promise<TokenResponse> {
  // Deduplicate concurrent refreshes (e.g. several requests failing at once)
  refreshPromise ??= request<TokenResponse>('/auth/refresh', { method: 'POST' }, false)
    .then((data) => {
      accessToken = data.access_token
      return data
    })
    .catch((err) => {
      accessToken = null
      throw err
    })
    .finally(() => {
      refreshPromise = null
    })
  return refreshPromise
}

export async function login(email: string, password: string): Promise<User> {
  const data = await request<TokenResponse>(
    '/auth/login',
    { method: 'POST', body: JSON.stringify({ email, password }) },
    false,
  )
  accessToken = data.access_token
  return data.user
}

export async function logout(): Promise<void> {
  try {
    await request<void>('/auth/logout', { method: 'POST' }, false)
  } finally {
    accessToken = null
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
