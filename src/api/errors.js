export class ApiError extends Error {
  constructor(status, payload = {}) {
    super(payload.message || 'No se pudo completar la solicitud.')
    this.name = 'ApiError'
    this.status = status
    this.errors = payload.errors ?? null
  }
}
