import { useEffect, useState } from 'react'
import { request } from './client.js'

export { ApiError } from './errors.js'

let parkRequest = null
let activitiesRequest = null

export function getPark() {
  if (!parkRequest) {
    parkRequest = request('/park').catch((error) => {
      parkRequest = null
      throw error
    })
  }
  return parkRequest
}

export function getActivities() {
  if (!activitiesRequest) {
    activitiesRequest = request('/activities').catch((error) => {
      activitiesRequest = null
      throw error
    })
  }
  return activitiesRequest
}

export function getSlots(activityId, date) {
  const params = new URLSearchParams({ date })
  return request(`/activities/${encodeURIComponent(activityId)}/slots?${params}`)
}

export function getHolidays(year) {
  return request(`/holidays/${year}`)
}

export function createInscription(payload) {
  return request('/inscriptions', { method: 'POST', body: payload })
}

function useQuery(loader, deps) {
  const [status, setStatus] = useState('loading')
  const [data, setData] = useState(null)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')

    loader()
      .then((result) => {
        if (cancelled) return
        setData(result)
        setStatus('ready')
      })
      .catch(() => {
        if (cancelled) return
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
    // The loader closes over the latest deps listed by the caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { status, data }
}

export function usePark() {
  const query = useQuery(() => getPark(), [])
  return { park: query.data, status: query.status }
}

export function useActivities() {
  const [attempt, setAttempt] = useState(0)
  const query = useQuery(() => {
    if (attempt > 0) activitiesRequest = null
    return getActivities()
  }, [attempt])

  return {
    activities: query.data ?? [],
    status: query.status,
    retry() {
      setAttempt((current) => current + 1)
    },
  }
}

export function useSlots(activityId, date) {
  const [attempt, setAttempt] = useState(0)
  const [slots, setSlots] = useState([])
  const [status, setStatus] = useState('idle')

  useEffect(() => {
    if (!activityId || !date) {
      setSlots([])
      setStatus('idle')
      return undefined
    }

    let cancelled = false
    setSlots([])
    setStatus('loading')

    getSlots(activityId, date)
      .then((result) => {
        if (cancelled) return
        setSlots(result)
        setStatus('ready')
      })
      .catch(() => {
        if (cancelled) return
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [activityId, date, attempt])

  return {
    slots,
    status,
    retry() {
      setAttempt((current) => current + 1)
    },
  }
}
