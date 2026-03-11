import Link from "next/link";

const LAST_UPDATED = "11 de marzo de 2026";

export default function SiteFooter() {
  return (
    <footer className="border-t border-barbas-gold/25 bg-barbas-black/95">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        <div className="flex flex-col gap-3 text-xs text-gray-400 sm:flex-row sm:items-center sm:justify-between">
          <p className="leading-relaxed">
            Copyright 2026 Ingeniero de Software Carlos Cortes. Todos los derechos reservados.
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link
              href="/politica-de-datos"
              className="text-barbas-gold hover:text-yellow-400 transition-colors"
            >
              Politica de Uso de Datos
            </Link>
            <span className="text-gray-500">Actualizado: {LAST_UPDATED}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
