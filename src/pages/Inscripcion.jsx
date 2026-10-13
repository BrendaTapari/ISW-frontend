import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'wouter'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Check, Minus, Plus, Trash2 } from 'lucide-react'
import { ApiError, createInscription, useActivities, usePark, useSlots } from '../api/index.js'
import {
  AGE_MAX,
  DNI_MAX,
  NAME_MAX,
  emptyVisitor,
  errorList,
  formatDate,
  formatDayMonth,
  pruneErrors,
  sanitizeDigits,
  sanitizeName,
  slotCapacity,
  slotLabel,
  slotProblem,
  todayDate,
  validateInscription,
  validateStep,
} from '../lib/inscription.js'
import { useHolidays, yearsForMonth } from '../lib/holidays.js'
import ConfirmationEmail from '../components/ConfirmationEmail.jsx'
import ParkCalendar from '../components/ParkCalendar.jsx'
import PeopleSky from '../components/PeopleSky.jsx'
import { useSetDock } from '../components/dock-context.js'

const STEPS = [
  { key: 'horario', label: 'Horario' },
  { key: 'visitantes', label: 'Visitantes' },
  { key: 'confirmar', label: 'Confirmar' },
]

const STEP_COPY = [
  {
    title: 'Elegí fecha y horario',
    text: 'Primero elegí el día. Los horarios disponibles dependen de esa fecha.',
  },
  {
    title: 'Datos de los visitantes',
    text: 'Indicá cuántas personas van y completá los datos de cada una.',
  },
  {
    title: 'Confirmá la inscripción',
    text: 'Revisá los datos y aceptá los términos de la actividad.',
  },
]

function FieldError({ message, className = '' }) {
  if (!message) return null
  return <p className={`text-error text-sm ${className}`}>{message}</p>
}

function RequiredMark() {
  return (
    <span className="text-error" aria-hidden="true">
      {' *'}
    </span>
  )
}

function emptyForm() {
  return {
    date: '',
    time: '',
    people: '1',
    email: '',
    visitors: [emptyVisitor()],
    acceptedTerms: false,
  }
}

function Stepper({ step, furthest, onSelect }) {
  return (
    <ol className="flex" aria-label="Pasos de la inscripción">
      {STEPS.map((item, index) => {
        const done = index < step
        const current = index === step
        const reachable = index <= furthest

        return (
          <li key={item.key} className="flex min-w-0 flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              <span
                className={`h-0.5 flex-1 ${index === 0 ? 'opacity-0' : index <= step ? 'bg-primary' : 'bg-base-300'}`}
              />
              <button
                type="button"
                aria-current={current ? 'step' : undefined}
                aria-label={`${item.label}${done ? ', completo' : ''}`}
                disabled={!reachable}
                className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold disabled:opacity-100 ${
                  current || done ? 'bg-primary text-primary-content' : 'bg-base-300 text-base-content/50'
                }`}
                onClick={() => onSelect(index)}
              >
                {done ? <Check className="size-4" aria-hidden="true" /> : index + 1}
              </button>
              <span
                className={`h-0.5 flex-1 ${
                  index === STEPS.length - 1 ? 'opacity-0' : index < step ? 'bg-primary' : 'bg-base-300'
                }`}
              />
            </div>
            <span className={`mt-1 text-center text-[11px] leading-tight ${current ? 'font-semibold' : 'text-base-content/60'}`}>
              {item.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export default function Inscripcion() {
  const [, navigate] = useLocation()
  const [searchParams] = useSearchParams()
  const activityId = searchParams.get('actividad')
  const { park } = usePark()
  const { activities, status: activitiesStatus, retry: retryActivities } = useActivities()
  const activity = activities.find((item) => item.id === activityId) ?? null
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [confirmation, setConfirmation] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [step, setStep] = useState(0)
  const [furthest, setFurthest] = useState(0)
  const [direction, setDirection] = useState(1)

  const reduce = useReducedMotion()
  const [calendarMonth, setCalendarMonth] = useState(() => todayDate())
  const holidayYears = useMemo(() => yearsForMonth(calendarMonth), [calendarMonth])
  const { holidays, holidaySet, status: holidayStatus, retry: retryHolidays } = useHolidays(holidayYears)
  const { slots, status: slotsStatus, retry: retrySlots } = useSlots(activity?.id, form.date)
  // El tope de personas es el cupo del horario elegido. Sin horario todavía, no hay tope.
  const peopleLimit = slotCapacity(slots, form.time)
  const closedWeekdays = park?.closedWeekdays ?? [1]
  const clothingSizes = park?.clothingSizes ?? []
  const rules = useMemo(
    () => ({
      holidays: holidaySet,
      holidaysReady: holidayStatus === 'ready',
      holidaysError: holidayStatus === 'error',
      slots,
      slotsReady: !form.date || slotsStatus === 'ready',
      slotsError: slotsStatus === 'error',
      closedWeekdays,
    }),
    [closedWeekdays, form.date, holidaySet, holidayStatus, slots, slotsStatus],
  )
  const scheduleMessage =
    form.date && form.time && slotsStatus === 'ready'
      ? slotProblem(slots, form.date, form.time, form.people, holidaySet, closedWeekdays)
      : null
  const messages = useMemo(
    () => errorList(errors).filter((message) => message !== scheduleMessage),
    [errors, scheduleMessage],
  )
  const copy = STEP_COPY[step]

  useEffect(() => {
    if (activitiesStatus !== 'ready') return
    if (!activity) navigate('/')
  }, [activity, activitiesStatus, navigate])

  function scrollTop() {
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
  }

  // Aplica el cambio y saca los errores ya mostrados que el cambio corrigió.
  function changeForm(next, fields, shiftErrors = (shown) => shown) {
    setForm(next)
    setErrors((shown) => pruneErrors(shiftErrors(shown), validateInscription(next, activity, rules), fields))
  }

  function updateVisitor(index, field, value) {
    const visitors = form.visitors.map((visitor, visitorIndex) =>
      visitorIndex === index ? { ...visitor, [field]: value } : visitor,
    )
    changeForm({ ...form, visitors }, ['visitors'])
  }

  function updatePeople(value) {
    let next = value
    let count = Number(next)
    // Si el grupo ya supera el cupo (cambió el horario), se puede bajar pero no subir.
    const ceiling = Math.max(peopleLimit ?? Infinity, form.visitors.length)
    if (Number.isInteger(count) && count > ceiling) {
      count = ceiling
      next = String(ceiling)
    }
    const visitors = [...form.visitors]
    if (Number.isInteger(count) && count > 0) {
      while (visitors.length < count) visitors.push(emptyVisitor())
      visitors.length = count
    }
    changeForm({ ...form, people: next, visitors }, ['people', 'schedule', 'visitors'])
  }

  function removeVisitor(index) {
    const keep = (_, visitorIndex) => visitorIndex !== index
    const visitors = form.visitors.filter(keep)
    changeForm({ ...form, people: String(visitors.length), visitors }, ['people', 'schedule', 'visitors'], (shown) =>
      shown.visitors ? { ...shown, visitors: shown.visitors.filter(keep) } : shown,
    )
  }

  function goTo(next) {
    if (next === step || next < 0 || next > furthest) return
    if (next > step) {
      for (let index = step; index < next; index += 1) {
        const stepErrors = validateStep(STEPS[index].key, form, activity, rules)
        if (Object.keys(stepErrors).length > 0) {
          setErrors(stepErrors)
          setDirection(1)
          setStep(index)
          scrollTop()
          return
        }
      }
    }
    setErrors({})
    setDirection(next > step ? 1 : -1)
    setStep(next)
    scrollTop()
  }

  function nextStep() {
    const stepErrors = validateStep(STEPS[step].key, form, activity, rules)
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors)
      scrollTop()
      return
    }
    setErrors({})
    setDirection(1)
    setStep((current) => current + 1)
    setFurthest((current) => Math.max(current, step + 1))
    scrollTop()
  }

  function focusErrors(nextErrors) {
    const target =
      nextErrors.date || nextErrors.time || (nextErrors.schedule && !/cupos/i.test(nextErrors.schedule))
        ? 0
        : nextErrors.people || nextErrors.email || nextErrors.visitors || nextErrors.schedule
          ? 1
          : 2
    setDirection(target > step ? 1 : -1)
    setStep(target)
    scrollTop()
  }

  async function submit(event) {
    event.preventDefault()
    if (submitting) return
    if (step < STEPS.length - 1) {
      nextStep()
      return
    }

    const nextErrors = validateInscription(form, activity, rules)
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      focusErrors(nextErrors)
      return
    }

    const people = Number(form.people)
    setSubmitting(true)
    try {
      const registration = await createInscription({
        activityId: activity.id,
        date: form.date,
        time: form.time,
        people,
        email: form.email.trim(),
        acceptedTerms: form.acceptedTerms,
        visitors: form.visitors.slice(0, people).map((visitor) => ({
          nombre: visitor.nombre.trim(),
          dni: visitor.dni.trim(),
          edad: visitor.edad,
          talle: activity.requiresSize ? visitor.talle : '',
        })),
      })
      setConfirmation(registration)
      scrollTop()
    } catch (error) {
      const apiErrors =
        error instanceof ApiError && error.errors
          ? error.errors
          : { submit: 'No pudimos confirmar la inscripción. Reintentá.' }
      setErrors(apiErrors)
      focusErrors(apiErrors)
    } finally {
      setSubmitting(false)
    }
  }

  function reset() {
    setConfirmation(null)
    setErrors({})
    setForm(emptyForm())
    setDirection(1)
    setStep(0)
    setFurthest(0)
    scrollTop()
  }

  const setDock = useSetDock()
  const dockActions = useRef({ back() {}, next() {} })
  dockActions.current.back = () => {
    if (step === 0) navigate('/')
    else goTo(step - 1)
  }
  dockActions.current.next = () => {
    if (step < STEPS.length - 1) nextStep()
    else submit({ preventDefault() {} })
  }

  useEffect(() => {
    if (!setDock) return undefined
    if (confirmation || !activity) {
      setDock(null)
      return () => setDock(null)
    }

    setDock({
      label: step < STEPS.length - 1 ? 'Siguiente' : submitting ? 'Confirmando' : 'Confirmar',
      onBack: () => dockActions.current.back(),
      onNext: () => dockActions.current.next(),
    })
    return () => setDock(null)
  }, [activity, confirmation, setDock, step, submitting])

  if (confirmation) {
    return <ConfirmationEmail registration={confirmation} onReset={reset} />
  }

  if (!activity) {
    if (activitiesStatus === 'error') {
      return (
        <div className="alert alert-warning items-start text-sm">
          <span>No pudimos cargar las actividades.</span>
          <button type="button" className="btn btn-sm btn-outline" onClick={retryActivities}>
            Reintentar
          </button>
        </div>
      )
    }
    return <p className="text-base-content/70 text-sm">Cargando…</p>
  }

  const people = Number(form.people)
  const visitorCount = Number.isInteger(people) && people > 0 ? people : 0
  const capacityWarning = scheduleMessage && /cupos/i.test(scheduleMessage) ? scheduleMessage : null
  const atPeopleLimit = peopleLimit !== null && visitorCount >= peopleLimit

  return (
    <form className="space-y-4 [&_input]:text-base [&_select]:text-base" onSubmit={submit} noValidate>
      {activity ? (
        <div className="relative h-16 overflow-hidden rounded-[1.25rem] shadow-sm">
          <img src={activity.image} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-black/10" />
          <p className="absolute inset-y-0 left-4 flex items-center text-lg font-semibold text-white">
            {activity.name}
          </p>
        </div>
      ) : null}

      <Stepper step={step} furthest={furthest} onSelect={goTo} />

      <header className="space-y-1">
        <p className="text-primary text-xs font-semibold tracking-[0.16em] uppercase">
          Paso {step + 1} de {STEPS.length}
        </p>
        <h1 className="font-display text-3xl font-semibold">{copy.title}</h1>
        <p className="text-base-content/70">{copy.text}</p>
      </header>

      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={step}
          custom={direction}
          initial={reduce ? false : { opacity: 0, x: direction > 0 ? 28 : -28 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduce ? undefined : { opacity: 0, x: direction > 0 ? -28 : 28 }}
          transition={{ duration: 0.28 }}
          className="space-y-4"
        >
          {messages.length > 0 ? (
            <div className="alert alert-error items-start text-sm">
              <ul className="list-disc pl-4">
                {messages.map((message, index) => (
                  <li key={`${message}-${index}`}>{message}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {step === 0 ? (
            <section className="card bg-base-100 shadow-sm">
              <div className="card-body gap-4 p-4">
                <div className="grid gap-2">
                  <span className="label-text">Fecha</span>
                  <ParkCalendar
                    value={form.date}
                    month={calendarMonth}
                    onMonthChange={setCalendarMonth}
                    holidays={holidays}
                    status={holidayStatus}
                    onRetry={retryHolidays}
                    closedWeekdays={closedWeekdays}
                    invalid={Boolean(errors.date)}
                    onChange={(date) => {
                      setErrors({})
                      setForm((current) => ({ ...current, date, time: '' }))
                    }}
                  />
                </div>
                <FieldError message={errors.date} />

                <div className="grid gap-2">
                  <span className="label-text">
                    {form.date ? `Horarios del ${formatDayMonth(form.date)}` : 'Horario'}
                  </span>
                  {form.date && slotsStatus === 'loading' ? (
                    <p className="text-base-content/70 text-sm">Consultando horarios…</p>
                  ) : null}
                  {form.date && slotsStatus === 'error' ? (
                    <div className="alert alert-warning items-start text-sm">
                      <span>No pudimos consultar los horarios.</span>
                      <button type="button" className="btn btn-sm btn-outline" onClick={retrySlots}>
                        Reintentar
                      </button>
                    </div>
                  ) : null}
                  {form.date && slotsStatus === 'ready'
                    ? slots.map((slot) => (
                        <button
                          key={slot.time}
                          type="button"
                          className={`btn h-auto min-h-12 w-full cursor-pointer justify-between py-3 ${
                            form.time === slot.time ? 'btn-primary' : 'btn-outline'
                          }`}
                          onClick={() => {
                            setErrors({})
                            setForm((current) => ({ ...current, time: slot.time }))
                          }}
                        >
                          {slot.time}
                          <span className="badge badge-sm">{slotLabel(slot)}</span>
                        </button>
                      ))
                    : null}
                  {form.date ? null : (
                    <p className="bg-base-200 text-base-content/70 rounded-2xl px-4 py-3 text-sm">
                      Elegí un día para ver los horarios de esa fecha.
                    </p>
                  )}
                </div>
                <FieldError message={errors.time} />
                {scheduleMessage ? (
                  <div className="alert alert-warning items-start text-sm">
                    <span>{scheduleMessage}</span>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {step === 1 ? (
            <section className="card bg-base-100 shadow-sm">
              <div className="card-body gap-4 p-4">
                <PeopleSky count={visitorCount} />
                <p className="text-base-content/60 text-sm">
                  Los campos con <span className="text-error">*</span> son obligatorios.
                </p>
                <div className="flex items-center justify-between gap-3">
                  <span className="label-text">
                    Cantidad de personas
                    <RequiredMark />
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-circle btn-outline"
                      aria-label="Sacar una persona"
                      disabled={visitorCount <= 1}
                      onClick={() => updatePeople(String(visitorCount - 1))}
                    >
                      <Minus className="size-4" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={peopleLimit ?? undefined}
                      inputMode="numeric"
                      required
                      aria-label="Cantidad de personas"
                      className={`input input-bordered w-16 [appearance:textfield] text-center [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${errors.people ? 'input-error' : ''}`}
                      value={form.people}
                      onChange={(event) => updatePeople(event.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn-circle btn-primary"
                      aria-label="Agregar una persona"
                      disabled={atPeopleLimit}
                      onClick={() => updatePeople(String(Math.max(visitorCount, 0) + 1))}
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                </div>
                {peopleLimit !== null ? (
                  <p className="text-base-content/60 -mt-2 text-sm">
                    Quedan {peopleLimit} lugares para las {form.time}.
                  </p>
                ) : null}
                <FieldError message={errors.people} />

                <label className="form-control w-full">
                  <span className="label-text mb-1 block">
                    Correo para la confirmación
                    <RequiredMark />
                  </span>
                  <input
                    type="email"
                    required
                    className={`input input-bordered w-full ${errors.email ? 'input-error' : ''}`}
                    placeholder="nombre@correo.com"
                    value={form.email}
                    onChange={(event) => changeForm({ ...form, email: event.target.value }, ['email'])}
                  />
                </label>
                <FieldError message={errors.email} />

                {capacityWarning ? (
                  <div className="alert alert-warning items-start text-sm">
                    <span>{capacityWarning}</span>
                  </div>
                ) : null}

                {Array.from({ length: visitorCount }, (_, index) => {
                  const visitor = form.visitors[index] ?? emptyVisitor()
                  const visitorErrors = errors.visitors?.[index] ?? {}

                  return (
                    <fieldset key={index} className="rounded-box border-base-300 relative grid gap-3 border p-4">
                      <legend className="px-2 font-semibold">Persona {index + 1}</legend>
                      {visitorCount > 1 ? (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm btn-circle text-error absolute top-1 right-2"
                          aria-label={`Eliminar persona ${index + 1}`}
                          onClick={() => removeVisitor(index)}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      ) : null}
                      <label className="form-control">
                        <span className="label-text mb-1 block">
                          Nombre y apellido
                          <RequiredMark />
                        </span>
                        <input
                          required
                          className={`input input-bordered w-full ${visitorErrors.nombre ? 'input-error' : ''}`}
                          maxLength={NAME_MAX}
                          autoComplete="name"
                          value={visitor.nombre}
                          onChange={(event) => updateVisitor(index, 'nombre', sanitizeName(event.target.value))}
                        />
                        <FieldError message={visitorErrors.nombre} />
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                        <label className="form-control col-span-2 min-w-0">
                          <span className="label-text mb-1 block">
                            DNI
                            <RequiredMark />
                          </span>
                          <input
                            type="text"
                            required
                            inputMode="numeric"
                            autoComplete="off"
                            maxLength={DNI_MAX}
                            className={`input input-bordered w-full ${visitorErrors.dni ? 'input-error' : ''}`}
                            value={visitor.dni}
                            onChange={(event) =>
                              updateVisitor(index, 'dni', sanitizeDigits(event.target.value, DNI_MAX))
                            }
                          />
                          <FieldError message={visitorErrors.dni} />
                        </label>
                        <label className="form-control col-span-1 min-w-0">
                          <span className="label-text mb-1 block">
                            Edad
                            <RequiredMark />
                          </span>
                          <input
                            type="text"
                            required
                            inputMode="numeric"
                            autoComplete="off"
                            maxLength={AGE_MAX}
                            className={`input input-bordered w-full ${visitorErrors.edad ? 'input-error' : ''}`}
                            value={visitor.edad}
                            onChange={(event) =>
                              updateVisitor(index, 'edad', sanitizeDigits(event.target.value, AGE_MAX))
                            }
                          />
                          <FieldError message={visitorErrors.edad} />
                        </label>
                      </div>
                      {activity?.requiresSize ? (
                        <label className="form-control w-full">
                          <span className="label-text mb-1 block">
                            Talle de vestimenta
                            <RequiredMark />
                          </span>
                          <select
                            required
                            className={`select select-bordered w-full ${visitorErrors.talle ? 'select-error' : ''}`}
                            value={visitor.talle}
                            onChange={(event) => updateVisitor(index, 'talle', event.target.value)}
                          >
                            <option value="">Elegir talle</option>
                            {clothingSizes.map((size) => (
                              <option key={size} value={size}>
                                {size}
                              </option>
                            ))}
                          </select>
                          <FieldError message={visitorErrors.talle} />
                        </label>
                      ) : null}
                    </fieldset>
                  )
                })}

                <button
                  type="button"
                  className="btn btn-dash btn-primary btn-block"
                  disabled={atPeopleLimit}
                  onClick={() => updatePeople(String(Math.max(visitorCount, 0) + 1))}
                >
                  <Plus className="size-4" />
                  Añadir visitante
                </button>
              </div>
            </section>
          ) : null}

          {step === 2 && activity ? (
            <section className="card bg-base-100 shadow-sm">
              <div className="card-body gap-4 p-4">
                <dl className="grid gap-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-base-content/60">Actividad</dt>
                    <dd className="text-right font-semibold">{activity.name}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-base-content/60">Fecha</dt>
                    <dd className="text-right font-semibold capitalize">{form.date ? formatDate(form.date) : '—'}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-base-content/60">Horario</dt>
                    <dd className="text-right font-semibold">{form.time || '—'}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-base-content/60">Correo</dt>
                    <dd className="text-right font-semibold">{form.email || '—'}</dd>
                  </div>
                </dl>

                <ul className="grid gap-2">
                  {form.visitors.slice(0, visitorCount).map((visitor, index) => (
                    <li key={index} className="bg-base-200 rounded-2xl px-3 py-2 text-sm">
                      <p className="font-semibold">{visitor.nombre || `Persona ${index + 1}`}</p>
                      <p className="text-base-content/70">
                        DNI {visitor.dni || '—'} · {visitor.edad || '—'} años
                        {activity.requiresSize ? ` · Talle ${visitor.talle || '—'}` : ''}
                      </p>
                    </li>
                  ))}
                </ul>

                <div className="bg-base-200 rounded-2xl p-3 text-sm">
                  <h2 className="mb-1 font-semibold">Términos y condiciones</h2>
                  <p>{activity.terms}</p>
                </div>
                <label className="block text-center">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-primary mr-3 align-middle"
                    checked={form.acceptedTerms}
                    onChange={(event) => changeForm({ ...form, acceptedTerms: event.target.checked }, ['terms'])}
                  />
                  <span className="align-middle">Acepto los términos y condiciones de la actividad.</span>
                </label>
                <FieldError message={errors.terms} className="text-center" />
              </div>
            </section>
          ) : null}
        </motion.div>
      </AnimatePresence>
    </form>
  )
}
