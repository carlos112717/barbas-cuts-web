import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Politica de Uso de Datos | Barbas Cut's",
  description: "Politica de uso, tratamiento y proteccion de datos personales de Barbas Cut's.",
};

export default function PoliticaDeDatosPage() {
  return (
    <main className="min-h-screen bg-barbas-black px-4 py-8 text-white sm:px-6">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-8 rounded-2xl border border-barbas-gold/25 bg-barbas-dark p-6">
          <p className="text-xs uppercase tracking-wider text-barbas-gold">Documento Legal</p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Politica de Uso de Datos</h1>
          <p className="mt-3 text-sm text-gray-300">
            Ultima actualizacion: 11 de marzo de 2026.
          </p>
        </header>

        <section className="space-y-6 rounded-2xl border border-white/10 bg-barbas-dark p-6 leading-relaxed text-sm text-gray-200 sm:text-base">
          <p>
            En Barbas Cut&apos;s tratamos los datos personales con responsabilidad, transparencia
            y medidas de seguridad razonables para proteger tu informacion.
            Al registrarte o usar la plataforma, aceptas esta politica.
          </p>

          <div>
            <h2 className="mb-2 text-lg font-semibold text-white">1. Datos que recopilamos</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Nombre completo.</li>
              <li>Correo electronico.</li>
              <li>Telefono y/o numero de WhatsApp.</li>
              <li>Foto de perfil (si decides subirla).</li>
              <li>Informacion de reservas (servicio, barbero, fecha y hora).</li>
            </ul>
          </div>

          <div>
            <h2 className="mb-2 text-lg font-semibold text-white">2. Finalidad del uso</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Gestionar registro, inicio de sesion y perfil del usuario.</li>
              <li>Programar, confirmar, modificar y cancelar citas.</li>
              <li>Enviar notificaciones y correos relacionados con tus reservas.</li>
              <li>Contactarte para soporte operativo del servicio.</li>
              <li>Mejorar la experiencia de uso y la disponibilidad de horarios.</li>
            </ul>
          </div>

          <div>
            <h2 className="mb-2 text-lg font-semibold text-white">3. Base de tratamiento</h2>
            <p>
              El tratamiento se realiza por la necesidad operativa de prestar el servicio de reservas
              y por tu consentimiento al utilizar la aplicacion.
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-lg font-semibold text-white">4. Conservacion de datos</h2>
            <p>
              Conservamos la informacion durante el tiempo necesario para operar la cuenta, mantener
              historial de citas y cumplir obligaciones tecnicas o legales aplicables.
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-lg font-semibold text-white">5. Comparticion y terceros</h2>
            <p>
              No vendemos tus datos personales. Podemos usar proveedores tecnologicos de infraestructura
              y correo para operar la plataforma, bajo controles de seguridad y acceso restringido.
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-lg font-semibold text-white">6. Seguridad de la informacion</h2>
            <p>
              Se aplican medidas tecnicas y de acceso para proteger los datos contra uso no autorizado,
              alteracion o perdida. Ningun sistema es 100% invulnerable, pero se trabaja bajo buenas
              practicas de seguridad.
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-lg font-semibold text-white">7. Tus derechos</h2>
            <p className="mb-2">
              Puedes solicitar actualizacion o correccion de tu informacion desde tu perfil. Tambien
              puedes solicitar eliminacion de datos, sujeto a limitaciones legales u operativas.
            </p>
            <p>
              Para solicitudes de privacidad, utiliza los canales oficiales de contacto de la barberia
              y del administrador.
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-lg font-semibold text-white">8. Cambios de la politica</h2>
            <p>
              Esta politica puede actualizarse para reflejar mejoras del servicio o cambios normativos.
              La fecha de actualizacion se publica siempre en este documento.
            </p>
          </div>

          <div className="rounded-xl border border-barbas-gold/30 bg-black/25 p-4 text-sm text-gray-300">
            Documento elaborado para Barbas Cut&apos;s.
            Desarrollo y mantenimiento: Ingeniero de Software Carlos Cortes.
          </div>
        </section>

        <div className="mt-6">
          <Link
            href="/"
            className="inline-flex items-center rounded-lg border border-barbas-gold px-4 py-2 text-sm font-semibold text-barbas-gold transition-colors hover:bg-barbas-gold/10"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
