import { useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

// Brazo derecho: una curva hombro → mano. El punto del medio hace de codo, así el
// brazo se dobla al saludar en vez de girar rígido y cruzar el cuerpo.
const ARM_REST = 'M36 38 Q46 46 55 56'
const ARM_UP = 'M36 38 Q58 38 58 14'
const ARM_OUT = 'M36 38 Q61 36 67 19'
const ARM_IN = 'M36 38 Q56 38 50 12'
const WAVE = [ARM_REST, ARM_UP, ARM_OUT, ARM_IN, ARM_OUT, ARM_IN, ARM_UP, ARM_REST]

const FIGURE_H = 112
const FIGURE_W = (FIGURE_H * 72) / 110
const SPACING = 0.85 // distancia entre monigotes, en anchos de monigote
const RAISE = 0.42 // cuánto sube cada fila de atrás, en altos de monigote
const DEPTH = 0.86 // cuánto se achica cada fila de atrás
const EXIT_S = 0.25

function Monigote({ delay, wave }) {
  // Saluda una sola vez, al llegar. Si después cambia el grupo, no vuelve a saludar
  // ni se corta el saludo a la mitad.
  const [start] = useState({ delay, wave })

  return (
    <svg viewBox="0 0 72 110" className="h-full w-full overflow-visible" aria-hidden="true">
      <circle cx="36" cy="14" r="11" fill="#fff" stroke="#111" strokeWidth="2.4" />
      <line x1="36" y1="25" x2="36" y2="62" stroke="#111" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="36" y1="38" x2="16" y2="54" stroke="#111" strokeWidth="2.4" strokeLinecap="round" />
      <motion.path
        d={ARM_REST}
        fill="none"
        stroke="#111"
        strokeWidth="2.4"
        strokeLinecap="round"
        animate={start.wave ? { d: WAVE } : undefined}
        transition={{ delay: start.delay, duration: 1.5, ease: 'easeInOut' }}
      />
      <line x1="36" y1="62" x2="20" y2="96" stroke="#111" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="36" y1="62" x2="52" y2="96" stroke="#111" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

function rowsHeight(rows) {
  let top = 0
  for (let row = 0; row < rows; row += 1) top = Math.max(top, row * RAISE + DEPTH ** row)
  return top
}

// Cuántos de una fila quedan justo detrás de alguien de la fila de adelante.
function hidden(offsets, ahead) {
  return offsets.filter((offset) => ahead.some((other) => Math.abs(other - offset) < 0.25)).length
}

// Posiciones de una fila, en lugares respecto del centro, siempre simétricas. Centrada
// y pegada, o, si así queda detrás de la de adelante, de a pares en los huecos.
function centeredRow(inRow) {
  return Array.from({ length: inRow }, (_, column) => column - (inRow - 1) / 2)
}

function rowOffsets(inRow, ahead) {
  const centered = centeredRow(inRow)
  const spread = inRow % 2 === 1 ? [0] : []
  for (let step = inRow % 2 === 1 ? 1.5 : 1; spread.length < inRow; step += 1) spread.push(-step, step)
  spread.sort((left, right) => left - right)
  return hidden(spread, ahead) < hidden(centered, ahead) ? spread : centered
}

// Repartos posibles con un máximo de `front` por fila: ladrillos (N, N-1, N...) que
// empiezan por la fila larga o por la corta, y en cada uno la variante que pasa uno de
// la anteúltima fila a la última.
function splits(count, front) {
  const options = []
  for (const longFirst of [true, false]) {
    const counts = []
    for (let left = count, row = 0; left > 0; row += 1) {
      const long = row % 2 === 0 ? longFirst : !longFirst
      counts.push(Math.min(long ? front : front - 1, left))
      left -= counts.at(-1)
    }
    options.push(counts)
    if (counts.length > 1 && counts.at(-2) > 1) {
      options.push([...counts.slice(0, -2), counts.at(-2) - 1, counts.at(-1) + 1])
    }
  }
  return options
}

// Acomoda al grupo como en una foto: si no entran en una fila, arma filas atrás, más
// arriba y más chicas. Suma una fila solo si los monigotes crecen bastante. Entre los
// repartos que entran en el recuadro, elige el que deja menos gente tapada.
function arrange(ids, width, height) {
  const count = ids.length
  let best = null
  for (let rows = 1; rows <= count; rows += 1) {
    const front = Math.ceil((count + Math.floor(rows / 2)) / rows)
    if (rows > 1 && front < 2) break
    const byWidth = width / (((front - 1) * SPACING + 1) * (FIGURE_W / FIGURE_H))
    const size = Math.min(FIGURE_H, byWidth, height / rowsHeight(rows))
    if (!best || size > best.size * 1.12) best = { rows, front, size }
  }

  const spacing = FIGURE_W * SPACING * (best.size / FIGURE_H)
  const scaleOf = (row) => (best.size / FIGURE_H) * DEPTH ** row
  const options = splits(count, best.front)
  // Respaldo: los ladrillos centrados siempre entran, aunque alguno quede tapado.
  let layout = { rows: options[0].map(centeredRow), score: Infinity }
  for (const counts of options) {
    if (counts.length > best.rows) continue
    const rows = []
    for (const inRow of counts) rows.push(rowOffsets(inRow, rows.at(-1) ?? []))
    const fits = rows.every((offsets, row) =>
      offsets.every((offset) => Math.abs(offset) * spacing + (FIGURE_W * scaleOf(row)) / 2 <= width / 2 + 0.5),
    )
    const score = rows.reduce((total, offsets, row) => total + (row > 0 ? hidden(offsets, rows[row - 1]) : 0), 0)
    if (fits && score < layout.score) layout = { rows, score }
  }

  const places = []
  let index = 0
  layout.rows.forEach((offsets, row) => {
    for (const offset of offsets) {
      places.push({
        id: ids[index],
        x: width / 2 + offset * spacing - FIGURE_W / 2,
        y: -row * RAISE * best.size,
        scale: scaleOf(row),
        z: best.rows - row,
      })
      index += 1
    }
  })
  return places
}

export default function PeopleSky({ ids }) {
  const reduce = useReducedMotion()
  const stage = useRef(null)
  const [box, setBox] = useState({ width: 0, height: 0 })

  useLayoutEffect(() => {
    const element = stage.current
    const measure = () => setBox({ width: element.clientWidth, height: element.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // Qué cambió desde el render anterior: los nuevos caen escalonados y, si alguien se
  // fue, el resto espera a que termine de desaparecer antes de redistribuirse.
  const signature = ids.join(' ')
  const [change, setChange] = useState({ signature, ids, added: ids, removed: false })
  if (change.signature !== signature) {
    const before = new Set(change.ids)
    const after = new Set(ids)
    setChange({
      signature,
      ids,
      added: ids.filter((id) => !before.has(id)),
      removed: change.ids.some((id) => !after.has(id)),
    })
  }

  const places = box.width > 0 ? arrange(ids, box.width, box.height) : []

  return (
    <div className="relative h-44 overflow-hidden rounded-[1.75rem] bg-white">
      <div ref={stage} className="absolute inset-x-2 top-2 bottom-1">
        <AnimatePresence>
          {places.map((place) => {
            const order = change.added.indexOf(place.id)
            const delay = reduce ? 0 : order >= 0 ? order * 0.08 : change.removed ? EXIT_S : 0

            return (
              <motion.div
                key={place.id}
                className="absolute bottom-0 left-0"
                style={{ width: FIGURE_W, height: FIGURE_H, zIndex: place.z, originX: 0.5, originY: 1 }}
                initial={reduce ? false : { x: place.x, y: place.y - 190, scale: place.scale, opacity: 0 }}
                animate={{ x: place.x, y: place.y, scale: place.scale, opacity: 1 }}
                exit={reduce ? undefined : { opacity: 0, y: place.y + 24, transition: { duration: EXIT_S } }}
                transition={
                  reduce
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 260, damping: 18, delay, opacity: { duration: 0.2, delay } }
                }
              >
                <Monigote delay={delay + 0.45} wave={!reduce && order >= 0} />
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
