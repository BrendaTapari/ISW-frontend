import { ApiError } from './errors.js'
import { mockRequest } from './mock.js'

// Sin VITE_API_URL responde el mock. Con la URL del backend, las mismas
// funciones pasan a fetch y el resto de la app no cambia.
const baseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

export async function request(path, options = {}) {
  if (!baseUrl) return mockRequest(path, options)

  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(response.status, payload)
  return payload
}
