import { useEffect, useState } from 'react'
import { Link } from 'wouter'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useActivities, usePark } from '../api/index.js'

const ease = [0.22, 1, 0.36, 1]

export default function Home() {
  const reduce = useReducedMotion()
  const { park } = usePark()
  const { activities, status, retry } = useActivities()
  const slides = park?.slides ?? []
  const [slide, setSlide] = useState(0)
  const featured = slides[slide]

  useEffect(() => {
    if (reduce || slides.length === 0) return undefined
    const timer = window.setInterval(() => {
      setSlide((current) => (current + 1) % slides.length)
    }, 4500)
    return () => window.clearInterval(timer)
  }, [reduce, slides.length])

  return (
    <section className="space-y-5">
      <div className="relative h-80 overflow-hidden rounded-[2rem] shadow-lg">
        <AnimatePresence mode="wait">
          {featured ? (
            <motion.img
              key={featured.src}
              src={featured.src}
              alt={featured.alt}
              className="absolute inset-0 h-full w-full object-cover"
              initial={reduce ? false : { opacity: 0, scale: 1.08 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduce ? undefined : { opacity: 0 }}
              transition={{ duration: 0.7, ease }}
            />
          ) : null}
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/5" />
        <div className="relative flex h-full flex-col justify-end gap-3 p-5 text-white">
          <span className="text-xs font-medium tracking-[0.2em] uppercase">Parque de diversiones</span>
          <div>
            <h1 className="font-display text-4xl leading-none font-semibold">
              {park?.name ?? 'EcoHarmony Park'}
            </h1>
            <p className="mt-2 text-sm text-white/85">Naturaleza, juego y aire libre.</p>
          </div>
          <div className="flex gap-2" role="tablist" aria-label="Fotos del parque">
            {slides.map((item, index) => (
              <button
                key={item.src}
                type="button"
                role="tab"
                aria-label={item.alt}
                aria-selected={index === slide}
                className={`h-1.5 rounded-full transition-all ${index === slide ? 'w-6 bg-white' : 'w-1.5 bg-white/50'}`}
                onClick={() => setSlide(index)}
              />
            ))}
          </div>
        </div>
      </div>

      {status === 'loading' ? <p className="text-base-content/70 text-sm">Cargando actividades…</p> : null}
      {status === 'error' ? (
        <div className="alert alert-warning items-start text-sm">
          <span>No pudimos cargar las actividades.</span>
          <button type="button" className="btn btn-sm btn-outline" onClick={retry}>
            Reintentar
          </button>
        </div>
      ) : null}
      <div className="grid gap-4">
        {activities.map((activity, index) => (
          <motion.article
            key={activity.id}
            className="bg-base-100/90 overflow-hidden rounded-[1.75rem] shadow-md"
            initial={reduce ? false : { opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: reduce ? 0 : 0.08 * index, ease }}
          >
            <Link href={`/inscripcion?actividad=${activity.id}`} className="block">
              <div className="relative h-44 overflow-hidden">
                <img
                  src={activity.image}
                  alt=""
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                <div className="absolute right-3 bottom-3 left-3 text-white">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <h2 className="font-display text-2xl font-semibold">{activity.name}</h2>
                    <span className="badge badge-sm border-white/30 bg-white/15 text-white">
                      {activity.requiresSize ? 'Pide talle' : 'Sin talle'}
                    </span>
                  </div>
                  <p className="text-sm text-white/85">{activity.summary}</p>
                </div>
              </div>
            </Link>
            <div className="space-y-3 p-4">
              <div className="space-y-2">
                <p className="text-base-content/60 text-xs font-medium tracking-wide uppercase">Horarios</p>
                <ul className="flex flex-wrap gap-2">
                  {activity.times.map((time) => (
                    <li key={time} className="badge badge-outline">
                      {time}
                    </li>
                  ))}
                </ul>
              </div>
              <Link href={`/inscripcion?actividad=${activity.id}`} className="btn btn-primary btn-block">
                Reservar
              </Link>
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  )
}
