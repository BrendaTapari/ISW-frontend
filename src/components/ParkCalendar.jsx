import { DayPicker } from 'react-day-picker'
import { es } from 'react-day-picker/locale/es'
import 'react-day-picker/style.css'
import { formatDayMonth, parseISODate, todayDate, todayISO, toISODate } from '../lib/inscription.js'

export default function ParkCalendar({
  value,
  onChange,
  month,
  onMonthChange,
  holidays,
  status,
  onRetry,
  invalid,
  closedWeekdays = [1],
}) {
  const today = todayDate()
  const selected = value ? parseISODate(value) : undefined
  const startMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const endMonth = new Date(today.getFullYear() + 1, 11, 1)
  const ready = status === 'ready'
  const holidayDates = holidays.map((item) => parseISODate(item.fecha))
  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`
  const monthHolidays = holidays.filter((item) => item.fecha.startsWith(monthKey) && item.fecha >= todayISO())

  return (
    <div className="grid gap-3">
      <DayPicker
        mode="single"
        locale={es}
        weekStartsOn={1}
        className={`park-calendar ${invalid ? 'park-calendar-invalid' : ''}`}
        month={month}
        onMonthChange={onMonthChange}
        startMonth={startMonth}
        endMonth={endMonth}
        selected={selected}
        onSelect={(date) => {
          if (!date) return
          onChange(toISODate(date))
        }}
        disabled={
          ready
            ? [{ before: today }, { dayOfWeek: closedWeekdays }, ...holidayDates]
            : true
        }
      />

      {status === 'loading' ? <p className="text-base-content/70 text-sm">Consultando feriados…</p> : null}

      {status === 'error' ? (
        <div className="alert alert-warning items-start text-sm">
          <span>No pudimos consultar los feriados.</span>
          <button type="button" className="btn btn-sm btn-outline" onClick={onRetry}>
            Reintentar
          </button>
        </div>
      ) : null}

      <p className="text-base-content/70 text-sm">
        No se pueden elegir fechas pasadas, los lunes ni los feriados.
      </p>

      {monthHolidays.length > 0 ? (
        <ul className="grid gap-1 text-sm">
          {monthHolidays.map((item) => (
            <li key={item.fecha} className="text-base-content/80">
              <span className="capitalize">{formatDayMonth(item.fecha)}</span>
              {` · ${item.nombre}`}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
