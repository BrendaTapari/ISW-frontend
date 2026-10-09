import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

function Monigote({ delay, wave }) {
  return (
    <svg viewBox="0 0 72 110" className="h-full w-auto overflow-visible" aria-hidden="true">
      <circle cx="36" cy="14" r="11" fill="#fff" stroke="#111" strokeWidth="2.4" />
      <line x1="36" y1="25" x2="36" y2="62" stroke="#111" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="36" y1="38" x2="16" y2="54" stroke="#111" strokeWidth="2.4" strokeLinecap="round" />
      <g transform="translate(36 38)">
        <motion.g
          style={{ transformOrigin: '0px 0px', transformBox: 'fill-box' }}
          initial={{ rotate: 0 }}
          animate={wave ? { rotate: [0, -78, -18, -72, -12, 0] } : { rotate: 0 }}
          transition={wave ? { delay, duration: 1.15, ease: 'easeInOut' } : { duration: 0 }}
        >
          <line x1="0" y1="0" x2="22" y2="16" stroke="#111" strokeWidth="2.4" strokeLinecap="round" />
        </motion.g>
      </g>
      <line x1="36" y1="62" x2="20" y2="96" stroke="#111" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="36" y1="62" x2="52" y2="96" stroke="#111" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

export default function PeopleSky({ count }) {
  const reduce = useReducedMotion()
  const previous = useRef(count)
  const [generation, setGeneration] = useState(0)

  useEffect(() => {
    const before = previous.current
    previous.current = count
    if (count > before && count - before !== 1) {
      setGeneration((current) => current + 1)
    }
  }, [count])

  const height = count > 8 ? 'h-16' : count > 4 ? 'h-20' : 'h-28'

  return (
    <div className="relative h-44 overflow-hidden rounded-[1.75rem] bg-white">
      <div className="absolute inset-x-2 bottom-1 flex items-end justify-center gap-1">
        <AnimatePresence mode="popLayout">
          {Array.from({ length: count }, (_, index) => (
            <motion.div
              key={`${generation}-${index}`}
              className={`${height} origin-bottom`}
              initial={reduce ? false : { y: -190, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={reduce ? undefined : { opacity: 0, y: 30 }}
              transition={{
                type: 'spring',
                stiffness: 260,
                damping: 18,
                delay: reduce ? 0 : index * 0.08,
              }}
            >
              <Monigote delay={0.45 + index * 0.08} wave={!reduce} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
