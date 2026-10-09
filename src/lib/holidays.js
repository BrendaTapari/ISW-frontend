import { useEffect, useMemo, useState } from 'react'
import { getHolidays } from '../api/index.js'

const cache = new Map()

export function yearsForMonth(month) {
  const year = month.getFullYear()
  const index = month.getMonth()
  if (index === 0) return [year - 1, year]
  if (index === 11) return [year, year + 1]
  return [year]
}

export function clearHolidayCache(year) {
  cache.delete(String(year))
}

export function fetchHolidays(year) {
  const key = String(year)
  if (!cache.has(key)) {
    const request = getHolidays(year).catch((error) => {
      cache.delete(key)
      throw error
    })
    cache.set(key, request)
  }
  return cache.get(key)
}

export function useHolidays(years) {
  const key = years.join(',')
  const [store, setStore] = useState({})
  const [status, setStatus] = useState('loading')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    const yearList = key.split(',').filter(Boolean).map(Number)
    setStatus('loading')

    Promise.all(yearList.map((year) => fetchHolidays(year)))
      .then((lists) => {
        if (cancelled) return
        setStore((current) => {
          const next = { ...current }
          yearList.forEach((year, index) => {
            next[year] = lists[index]
          })
          return next
        })
        setStatus('ready')
      })
      .catch(() => {
        if (cancelled) return
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [key, attempt])

  const holidays = useMemo(() => Object.values(store).flat(), [store])
  const holidaySet = useMemo(() => new Set(holidays.map((item) => item.fecha)), [holidays])

  return {
    holidays,
    holidaySet,
    status,
    retry() {
      years.forEach((year) => clearHolidayCache(year))
      setAttempt((current) => current + 1)
    },
  }
}
