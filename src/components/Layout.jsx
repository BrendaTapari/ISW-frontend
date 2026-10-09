import { useState } from 'react'
import { Link, useLocation } from 'wouter'
import { AnimatePresence, motion } from 'motion/react'
import { Leaf, Moon, Sun } from 'lucide-react'
import { usePark } from '../api/index.js'
import { DockContext } from './dock-context.js'

export default function Layout({ children }) {
  const [location] = useLocation()
  const [dock, setDock] = useState(null)
  const { park } = usePark()

  return (
    <DockContext.Provider value={setDock}>
    <div className="eco-app min-h-dvh">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
        <header className="sticky top-0 z-20 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
          <div className="border-base-300/80 bg-base-100/80 flex items-center justify-between rounded-full border px-4 py-2 shadow-[0_10px_30px_-18px_oklch(25%_0.04_155/0.7)] backdrop-blur-md">
            <Link href="/" className="font-display flex min-w-0 items-center gap-2 text-lg font-semibold tracking-tight">
              <Leaf className="text-primary size-5 shrink-0" />
              <span className="truncate">{park?.name ?? 'EcoHarmony Park'}</span>
            </Link>
            <label className="swap swap-rotate btn btn-ghost btn-circle btn-sm">
              <input type="checkbox" className="theme-controller" value="dark" />
              <Sun className="swap-off pointer-events-none size-4" />
              <Moon className="swap-on pointer-events-none size-4" />
            </label>
          </div>
        </header>

        <main className={`flex-1 px-4 pt-1 ${dock ? 'pb-32' : 'pb-8'}`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={location}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        {dock ? (
          <nav className="pointer-events-none fixed inset-x-0 bottom-4 z-30 mx-auto w-full max-w-md px-5 pb-[env(safe-area-inset-bottom)]">
            <ul className="bg-neutral/95 pointer-events-auto grid grid-cols-2 gap-1 rounded-full p-1.5 shadow-[0_16px_40px_-16px_oklch(18%_0.04_155/0.85)] backdrop-blur-md">
              <li>
                <button
                  type="button"
                  className="text-neutral-content/80 flex min-h-12 w-full cursor-pointer items-center justify-center rounded-full text-sm font-medium"
                  onClick={dock.onBack}
                >
                  Atrás
                </button>
              </li>
              <li className="relative">
                <span className="bg-primary absolute inset-0 rounded-full" />
                <button
                  type="button"
                  className="text-primary-content relative z-10 flex min-h-12 w-full cursor-pointer items-center justify-center rounded-full text-sm font-semibold"
                  onClick={dock.onNext}
                >
                  {dock.label}
                </button>
              </li>
            </ul>
          </nav>
        ) : null}
      </div>
    </div>
    </DockContext.Provider>
  )
}
