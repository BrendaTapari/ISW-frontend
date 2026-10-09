import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { motion, useReducedMotion } from 'motion/react'
import { Mail } from 'lucide-react'
import { usePark } from '../api/index.js'

export default function ConfirmationEmail({ registration, onReset }) {
  const reduce = useReducedMotion()
  const { park } = usePark()
  const parkName = park?.name ?? 'EcoHarmony Park'
  const [qr, setQr] = useState('')
  const [qrFailed, setQrFailed] = useState(false)

  useEffect(() => {
    let active = true
    setQr('')
    setQrFailed(false)

    QRCode.toDataURL(registration.qrText, { margin: 1, width: 220 })
      .then((url) => {
        if (active) setQr(url)
      })
      .catch(() => {
        if (active) setQrFailed(true)
      })

    return () => {
      active = false
    }
  }, [registration.qrText])

  return (
    <motion.section
      className="space-y-4"
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {registration.image ? (
        <div className="relative h-48 overflow-hidden rounded-3xl shadow-md">
          <img src={registration.image} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
          <p className="absolute right-4 bottom-4 left-4 text-2xl font-semibold text-white">
            {registration.activityName}
          </p>
        </div>
      ) : null}
      <div className="alert alert-success items-start text-sm">
        <Mail className="size-5 shrink-0" />
        <span>
          Inscripción confirmada. Este es el correo de confirmación para {registration.email}.
        </span>
      </div>

      <article className="card bg-base-100 shadow-sm">
        <div className="card-body gap-4 p-4">
          <header className="space-y-1">
            <p className="text-sm">
              <span className="font-semibold">De:</span> {parkName}
            </p>
            <p className="text-sm">
              <span className="font-semibold">Para:</span> {registration.email}
            </p>
            <p className="text-sm">
              <span className="font-semibold">Asunto:</span> Confirmación de inscripción —{' '}
              {registration.activityName}
            </p>
          </header>

          <div className="divider my-0" />

          <div className="space-y-3">
            <h1 className="font-display text-3xl font-semibold">Tu lugar está reservado</h1>
            <p>
              {parkName} confirmó la inscripción a{' '}
              <strong>{registration.activityName}</strong> el {registration.dateLabel} a las{' '}
              {registration.time}.
            </p>
            <p className="break-all">
              Código de inscripción:{' '}
              <span className="font-mono font-semibold">{registration.code}</span>
            </p>
          </div>

          <ul className="space-y-3">
            {registration.visitors.map((visitor) => (
              <li key={visitor.dni} className="rounded-box bg-base-200 p-3 text-sm">
                <p className="font-semibold">{visitor.nombre}</p>
                <p>DNI {visitor.dni}</p>
                <p>Edad {visitor.edad}</p>
                {registration.requiresSize ? <p>Talle {visitor.talle}</p> : null}
              </li>
            ))}
          </ul>

          <div className="flex flex-col items-start gap-2">
            <h2 className="font-semibold">Código QR</h2>
            {qr ? (
              <motion.img
                src={qr}
                alt={`Código QR de la inscripción ${registration.code}`}
                className="rounded-box bg-white p-2"
                width="220"
                height="220"
                initial={reduce ? false : { opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35 }}
              />
            ) : null}
            {qrFailed ? <p className="text-sm">No se pudo generar el código QR.</p> : null}
          </div>
        </div>
      </article>

      <button type="button" className="btn btn-outline btn-block" onClick={onReset}>
        Nueva inscripción
      </button>
    </motion.section>
  )
}
