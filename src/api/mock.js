import { ApiError } from './errors.js'
import { activityRecords, parkRecord } from './mock-data.js'
import { formatDate, validateInscription } from '../lib/inscription.js'

const db = {
  park: structuredClone(parkRecord),
  activities: structuredClone(activityRecords),
  inscriptions: [],
}

const holidayCache = new Map()

function delay(ms = 160) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function fail(status, payload) {
  throw new ApiError(status, payload)
}

function weekdayOf(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).getDay()
}

function offeredTimes(activity) {
  const times = []
  for (const daySlots of Object.values(activity.schedules)) {
    for (const item of daySlots) {
      if (item.status === 'open' && !times.includes(item.time)) times.push(item.time)
    }
  }
  return times.sort((left, right) => left.localeCompare(right))
}

function toActivity(activity) {
  return {
    id: activity.id,
    name: activity.name,
    code: activity.code,
    image: activity.image,
    summary: activity.summary,
    requiresSize: activity.requiresSize,
    terms: activity.terms,
    times: offeredTimes(activity),
  }
}

function slotsForDate(activity, dateStr) {
  if (!activity || !dateStr) return []
  return (activity.schedules[weekdayOf(dateStr)] ?? []).map((item) => ({ ...item }))
}

function findActivity(id) {
  return db.activities.find((activity) => activity.id === id) ?? null
}

async function loadHolidays(year) {
  const key = String(year)
  if (!holidayCache.has(key)) {
    const request = fetch(`https://api.argentinadatos.com/v1/feriados/${year}`)
      .then(async (response) => {
        if (!response.ok) throw new Error('No se pudieron consultar los feriados.')
        const data = await response.json()
        if (!Array.isArray(data)) throw new Error('No se pudieron consultar los feriados.')
        return data
          .filter((item) => typeof item?.fecha === 'string')
          .map((item) => ({ fecha: item.fecha, nombre: item.nombre || 'Feriado' }))
      })
      .catch((error) => {
        holidayCache.delete(key)
        throw error
      })
    holidayCache.set(key, request)
  }
  return holidayCache.get(key)
}

function registrationCode(activity, date, time) {
  const compactDate = date.replaceAll('-', '')
  const compactTime = time.replace(':', '')
  const serial = String(db.inscriptions.length + 1).padStart(4, '0')
  return `EHP-${activity.code}-${compactDate}-${compactTime}-${serial}`
}

async function createInscription(body) {
  const activity = findActivity(body?.activityId)
  const visitors = Array.isArray(body?.visitors) ? body.visitors : []
  const form = {
    date: body?.date ?? '',
    time: body?.time ?? '',
    people: body?.people ?? '',
    email: body?.email ?? '',
    visitors,
    acceptedTerms: Boolean(body?.acceptedTerms),
  }

  let holidaySet = new Set()
  if (form.date) {
    try {
      const list = await loadHolidays(Number(form.date.slice(0, 4)))
      holidaySet = new Set(list.map((item) => item.fecha))
    } catch {
      fail(503, {
        message: 'No pudimos consultar los feriados.',
        errors: { date: 'No pudimos consultar los feriados. Reintentá.' },
      })
    }
  }

  const slots = slotsForDate(activity, form.date)
  const errors = validateInscription(form, activity, {
    holidays: holidaySet,
    holidaysReady: true,
    slots,
    slotsReady: true,
    closedWeekdays: db.park.closedWeekdays,
  })

  if (Object.keys(errors).length > 0) {
    fail(422, { message: 'La inscripción no es válida.', errors })
  }

  const daySlots = activity.schedules[weekdayOf(form.date)]
  const stored = daySlots.find((item) => item.time === form.time)
  stored.capacity -= Number(form.people)

  const people = Number(form.people)
  const savedVisitors = visitors.slice(0, people).map((visitor) => ({
    nombre: visitor.nombre.trim(),
    dni: visitor.dni.trim(),
    edad: String(visitor.edad),
    talle: activity.requiresSize ? visitor.talle : '',
  }))
  const dateLabel = formatDate(form.date)
  const code = registrationCode(activity, form.date, form.time)
  const visitorLines = savedVisitors
    .map((visitor) => {
      const size = activity.requiresSize ? `, talle ${visitor.talle}` : ''
      return `${visitor.nombre}, DNI ${visitor.dni}, ${visitor.edad} años${size}`
    })
    .join('\n')

  const registration = {
    code,
    email: form.email.trim(),
    activityId: activity.id,
    activityName: activity.name,
    date: form.date,
    dateLabel,
    time: form.time,
    requiresSize: activity.requiresSize,
    image: activity.image,
    visitors: savedVisitors,
    qrText: [
      db.park.name,
      `Código: ${code}`,
      `Actividad: ${activity.name}`,
      `Fecha: ${dateLabel}`,
      `Horario: ${form.time}`,
      'Visitantes:',
      visitorLines,
    ].join('\n'),
  }

  db.inscriptions.push(registration)
  return registration
}

export async function mockRequest(path, options = {}) {
  await delay()
  const url = new URL(path, 'http://mock.local')
  const method = (options.method || 'GET').toUpperCase()
  const { pathname } = url

  if (method === 'GET' && pathname === '/park') {
    return structuredClone(db.park)
  }

  if (method === 'GET' && pathname === '/activities') {
    return db.activities.map(toActivity)
  }

  const activityMatch = pathname.match(/^\/activities\/([^/]+)$/)
  if (method === 'GET' && activityMatch) {
    const activity = findActivity(decodeURIComponent(activityMatch[1]))
    if (!activity) fail(404, { message: 'No encontramos esa actividad.' })
    return toActivity(activity)
  }

  const slotsMatch = pathname.match(/^\/activities\/([^/]+)\/slots$/)
  if (method === 'GET' && slotsMatch) {
    const activity = findActivity(decodeURIComponent(slotsMatch[1]))
    if (!activity) fail(404, { message: 'No encontramos esa actividad.' })
    const date = url.searchParams.get('date') || ''
    if (!date) fail(400, { message: 'Falta la fecha.', errors: { date: 'Seleccioná una fecha.' } })
    return slotsForDate(activity, date)
  }

  const holidayMatch = pathname.match(/^\/holidays\/(\d{4})$/)
  if (method === 'GET' && holidayMatch) {
    try {
      return await loadHolidays(holidayMatch[1])
    } catch {
      fail(503, { message: 'No pudimos consultar los feriados.' })
    }
  }

  if (method === 'POST' && pathname === '/inscriptions') {
    return createInscription(options.body)
  }

  fail(404, { message: 'No encontramos ese recurso.' })
  return null
}
