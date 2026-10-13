export const NAME_MAX = 60
export const DNI_MAX = 8
export const AGE_MAX = 3

const namePattern = /^[\p{L}]+(?:[ '][\p{L}]+)*$/u

export function sanitizeName(value) {
  return value
    .replace(/[’`´]/g, "'")
    .replace(/[^\p{L}' ]/gu, '')
    .replace(/'{2,}/g, "'")
    .replace(/ {2,}/g, ' ')
    .slice(0, NAME_MAX)
}

export function sanitizeDigits(value, max) {
  return value.replace(/\D/g, '').slice(0, max)
}

export function emptyVisitor() {
  return { nombre: '', dni: '', edad: '', talle: '' }
}

export function todayISO() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export function parseISODate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function toISODate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function todayDate() {
  return parseISODate(todayISO())
}

export function isClosedWeekday(dateStr, closedWeekdays = [1]) {
  if (!dateStr) return false
  return closedWeekdays.includes(parseISODate(dateStr).getDay())
}

export function slotLabel(slot) {
  if (slot.status === 'closed') return 'Parque cerrado'
  if (slot.status === 'unavailable') return 'No disponible'
  if (slot.capacity === 0) return 'Sin cupos'
  return `${slot.capacity} cupos`
}

export function isPastDate(dateStr) {
  if (!dateStr) return false
  return dateStr < todayISO()
}

export function formatDayMonth(dateStr) {
  return parseISODate(dateStr).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
  })
}

export function formatDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function slotCapacity(slots, time) {
  const slot = (slots ?? []).find((item) => item.time === time)
  return slot ? slot.capacity : null
}

export function slotProblem(slots, date, time, people, holidays, closedWeekdays = [1]) {
  if (!date || !time) return null

  const slot = (slots ?? []).find((item) => item.time === time)
  if (!slot) return 'Ese horario no está disponible para la fecha elegida.'

  if (isPastDate(date)) return 'No podés elegir una fecha pasada.'

  if (isClosedWeekday(date, closedWeekdays) || holidays?.has(date) || slot.status === 'closed') {
    return 'El parque está cerrado en el horario seleccionado.'
  }

  if (slot.status === 'unavailable') {
    return 'La actividad no está disponible en el horario seleccionado.'
  }

  const count = Number(people)
  if (!Number.isInteger(count) || count < 1) return null

  if (slot.capacity < count) {
    if (slot.capacity === 0) {
      return 'No hay cupos disponibles para el horario seleccionado.'
    }
    return `No hay cupos suficientes. Quedan ${slot.capacity} lugares y querés inscribir ${count} personas.`
  }

  return null
}

export function validateInscription(form, activity, options = {}) {
  const errors = {}
  const holidays = options.holidays ?? null
  const closedWeekdays = options.closedWeekdays ?? [1]

  if (!activity) errors.activity = 'Seleccioná una actividad.'

  let dateReady = false
  if (options.holidaysReady === false) {
    errors.date = options.holidaysError
      ? 'No pudimos consultar los feriados. Reintentá.'
      : 'Estamos consultando los feriados.'
  } else if (!form.date) {
    errors.date = 'Seleccioná una fecha.'
  } else if (isPastDate(form.date)) {
    errors.date = 'No podés elegir una fecha pasada.'
  } else if (isClosedWeekday(form.date, closedWeekdays)) {
    errors.date = 'El parque no abre los lunes.'
  } else if (holidays?.has(form.date)) {
    errors.date = 'Ese día es feriado y el parque está cerrado.'
  } else {
    dateReady = true
  }

  if (dateReady && options.slotsReady === false) {
    errors.time = options.slotsError
      ? 'No pudimos consultar los horarios. Reintentá.'
      : 'Estamos consultando los horarios.'
  } else if (dateReady && !form.time) {
    errors.time = 'Seleccioná un horario.'
  }

  const people = Number(form.people)
  if (form.people === '' || !Number.isInteger(people) || people < 1) {
    errors.people = 'Inscribí al menos 1 persona.'
  }

  const email = form.email.trim()
  if (!email) errors.email = 'Ingresá el correo donde enviamos la confirmación.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'El correo no es válido.'
  }

  if (dateReady && form.time && options.slotsReady !== false) {
    const scheduleError = slotProblem(
      options.slots,
      form.date,
      form.time,
      form.people,
      holidays,
      closedWeekdays,
    )
    if (scheduleError) errors.schedule = scheduleError
  }

  const count = Number.isInteger(people) && people > 0 ? people : 0
  const visitorErrors = Array.from({ length: count }, (_, index) => {
    const visitor = form.visitors[index] ?? emptyVisitor()
    const item = {}

    const name = visitor.nombre.trim()
    if (!name) item.nombre = 'Ingresá el nombre.'
    else if (!namePattern.test(name)) {
      item.nombre = "Usá solo letras y un apóstrofe, como en O'Connor."
    }

    if (!/^\d{7,8}$/.test(visitor.dni)) {
      item.dni = 'El DNI debe tener 7 u 8 números.'
    }

    if (!/^\d{1,3}$/.test(visitor.edad)) {
      item.edad = 'Ingresá la edad solo con números.'
    } else {
      const age = Number(visitor.edad)
      if (age < 1 || age > 120) item.edad = 'La edad tiene que estar entre 1 y 120.'
    }

    if (activity?.requiresSize && !visitor.talle) {
      item.talle = 'Ingresá el talle de vestimenta.'
    }

    return item
  })

  if (visitorErrors.some((item) => Object.keys(item).length > 0)) {
    errors.visitors = visitorErrors
  }

  if (!form.acceptedTerms) {
    errors.terms = 'Tenés que aceptar los términos y condiciones de la actividad.'
  }

  return errors
}

export function validateStep(step, form, activity, options) {
  const all = validateInscription(form, activity, options)

  if (step === 'actividad') {
    return all.activity ? { activity: all.activity } : {}
  }

  if (step === 'horario') {
    const errors = {}
    if (all.date) errors.date = all.date
    if (all.time) errors.time = all.time
    // Si el horario tiene lugar pero no alcanza para el grupo, se corrige en el paso
    // de visitantes. Acá solo frena un horario donde no entra nadie.
    if (all.schedule) {
      const schedule = slotProblem(
        options.slots,
        form.date,
        form.time,
        1,
        options.holidays,
        options.closedWeekdays,
      )
      if (schedule) errors.schedule = schedule
    }
    return errors
  }

  if (step === 'visitantes') {
    const errors = {}
    if (all.people) errors.people = all.people
    if (all.email) errors.email = all.email
    if (all.visitors) errors.visitors = all.visitors
    if (all.schedule && /cupos/i.test(all.schedule)) errors.schedule = all.schedule
    return errors
  }

  return all
}

// Deja solo los errores ya mostrados que siguen vigentes, con el mensaje actual.
// No suma errores nuevos: esos aparecen recién al intentar avanzar.
export function pruneErrors(shown, current, fields) {
  const next = { ...shown }
  for (const field of fields) {
    if (!next[field]) continue
    if (field === 'visitors') {
      const visitors = next.visitors.map((item, index) => {
        const live = current.visitors?.[index] ?? {}
        return Object.fromEntries(
          Object.keys(item)
            .filter((key) => live[key])
            .map((key) => [key, live[key]]),
        )
      })
      if (visitors.some((item) => Object.keys(item).length > 0)) next.visitors = visitors
      else delete next.visitors
    } else if (current[field]) {
      next[field] = current[field]
    } else {
      delete next[field]
    }
  }
  return next
}

export function errorList(errors) {
  const list = []
  for (const key of ['activity', 'date', 'time', 'schedule', 'people', 'email', 'terms', 'submit']) {
    if (errors[key]) list.push(errors[key])
  }

  errors.visitors?.forEach((item, index) => {
    Object.values(item).forEach((message) => {
      list.push(`Persona ${index + 1}: ${message}`)
    })
  })

  return list
}

