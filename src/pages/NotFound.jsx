import { Link } from 'wouter'
import { CircleAlert } from 'lucide-react'

export default function NotFound() {
  return (
    <section className="hero rounded-[1.75rem] bg-base-100 shadow-sm">
      <div className="hero-content w-full flex-col items-stretch px-4 py-12 text-center">
        <CircleAlert className="text-warning size-10" />
        <h1 className="text-2xl font-bold">Página no encontrada</h1>
        <p className="text-base-content/70">Esa ruta no existe en EcoHarmony Park.</p>
        <Link href="/" className="btn btn-primary btn-block">
          Volver al inicio
        </Link>
      </div>
    </section>
  )
}
